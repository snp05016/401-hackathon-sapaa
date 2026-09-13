import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_JOBSPY_URL = "http://127.0.0.1:8001";
const INSTALL_MARKER = ".requirements.sha256";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isHealthy(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 750);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitUntilHealthy(
  url: string,
  server: ChildProcessWithoutNullStreams,
  timeoutMilliseconds = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`JobSpy service exited during startup with code ${server.exitCode}`);
    }
    if (await isHealthy(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("JobSpy service did not become ready within 30 seconds");
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  onProcess: (child: ChildProcessWithoutNullStreams | null) => void,
  env?: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: env ?? process.env, stdio: "pipe" });
    let errorOutput = "";
    onProcess(child);
    child.stderr.on("data", (chunk: Buffer) => {
      errorOutput = `${errorOutput}${chunk.toString()}`.slice(-8_000);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      onProcess(null);
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}${
            errorOutput.trim() ? `: ${errorOutput.trim()}` : ""
          }`,
        ),
      );
    });
  });
}

async function findPython(): Promise<string> {
  for (const command of ["python3.13", "python3.12", "python3.11", "python3.10", "python3", "python"]) {
    try {
      await runCommand(
        command,
        ["-c", "import sys; raise SystemExit(0 if (3, 10) <= sys.version_info[:2] <= (3, 13) else 1)"],
        process.cwd(),
        () => undefined,
      );
      return command;
    } catch {
      // Try the next supported Python executable.
    }
  }
  throw new Error("JobSpy requires Python 3.10 through 3.13. Install a supported Python and relaunch the desktop app.");
}

export interface JobSpySidecar {
  start(): Promise<void>;
  stop(): void;
}

export function createJobSpySidecar(serviceDirectory: string): JobSpySidecar {
  let activeProcess: ChildProcessWithoutNullStreams | null = null;
  let startPromise: Promise<void> | null = null;
  let stopping = false;

  async function start(): Promise<void> {
    if (startPromise) return startPromise;

    startPromise = (async () => {
      const configuredUrl = (process.env.JOBSPY_URL ?? DEFAULT_JOBSPY_URL).replace(/\/$/, "");
      if (configuredUrl !== DEFAULT_JOBSPY_URL || (await isHealthy(configuredUrl))) return;

      const requirementsPath = path.join(serviceDirectory, "requirements.txt");
      const applicationPath = path.join(serviceDirectory, "main.py");
      if (!(await exists(requirementsPath)) || !(await exists(applicationPath))) {
        throw new Error(`JobSpy service files were not found at ${serviceDirectory}`);
      }

      const virtualEnvironmentDirectory = path.join(serviceDirectory, ".venv");
      const virtualEnvironmentPython = path.join(
        virtualEnvironmentDirectory,
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
      );

      const virtualEnvironmentIsCompatible =
        (await exists(virtualEnvironmentPython)) &&
        (await runCommand(
          virtualEnvironmentPython,
          ["-c", "import sys; raise SystemExit(0 if (3, 10) <= sys.version_info[:2] <= (3, 13) else 1)"],
          serviceDirectory,
          () => undefined,
        ).then(
          () => true,
          () => false,
        ));

      if (!virtualEnvironmentIsCompatible) {
        if (await exists(virtualEnvironmentDirectory)) {
          await rm(virtualEnvironmentDirectory, { recursive: true, force: true });
        }
        const python = await findPython();
        await runCommand(
          python,
          ["-m", "venv", virtualEnvironmentDirectory],
          serviceDirectory,
          (child) => {
            activeProcess = child;
          },
        );
      }

      const requirements = await readFile(requirementsPath);
      const requirementsHash = createHash("sha256").update(requirements).digest("hex");
      const markerPath = path.join(virtualEnvironmentDirectory, INSTALL_MARKER);
      const installedHash = (await exists(markerPath)) ? (await readFile(markerPath, "utf8")).trim() : "";

      if (installedHash !== requirementsHash) {
        await runCommand(
          virtualEnvironmentPython,
          ["-m", "pip", "install", "--no-user", "--disable-pip-version-check", "-r", requirementsPath],
          serviceDirectory,
          (child) => {
            activeProcess = child;
          },
          { ...process.env, PIP_USER: "0", PIP_NO_INPUT: "1" },
        );
        await writeFile(markerPath, `${requirementsHash}\n`, "utf8");
      }

      if (stopping || (await isHealthy(configuredUrl))) return;

      const server = spawn(
        virtualEnvironmentPython,
        ["-m", "uvicorn", "main:app", "--app-dir", serviceDirectory, "--host", "127.0.0.1", "--port", "8001"],
        {
          cwd: serviceDirectory,
          env: { ...process.env, PYTHONUNBUFFERED: "1", PIP_USER: "0" },
          stdio: "pipe",
        },
      );
      activeProcess = server;
      server.stdout.on("data", (chunk: Buffer) => process.stdout.write(`[jobspy] ${chunk.toString()}`));
      server.stderr.on("data", (chunk: Buffer) => process.stderr.write(`[jobspy] ${chunk.toString()}`));
      server.once("error", (error) => console.error("[jobspy] Failed to start:", error));
      server.once("exit", (code, signal) => {
        if (activeProcess === server) activeProcess = null;
        if (!stopping && code !== 0) {
          console.error(`[jobspy] Service exited with ${signal ? `signal ${signal}` : `code ${code}`}`);
        }
      });
      await waitUntilHealthy(configuredUrl, server);
    })().catch((error) => {
      startPromise = null;
      throw error;
    });

    return startPromise;
  }

  return {
    start,

    stop() {
      stopping = true;
      if (activeProcess && !activeProcess.killed) activeProcess.kill();
      activeProcess = null;
    },
  };
}
