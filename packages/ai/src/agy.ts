import type { CompletionRequest, CompletionResponse } from "./types";

interface AgyJsonOutput {
  conversation_id?: string;
  status?: string;
  response?: string;
  error?: string;
  duration_seconds?: number;
  num_turns?: number;
  usage?: Record<string, unknown>;
}

function isNodeEnvironment(): boolean {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

export function resolveAgyBinary(): string {
  if (!isNodeEnvironment()) return "agy";
  const envPath = process.env.AGY_PATH;
  if (envPath) return envPath;
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (home) {
    const userBinary = `${home}/.local/bin/agy`;
    return userBinary;
  }
  return "agy";
}

export function isAgyAvailable(): boolean {
  if (!isNodeEnvironment()) return false;
  // In Node environment, agy is available if it exists in standard paths or PATH
  return true;
}

export function formatAgyPrompt(request: CompletionRequest): string {
  const systemParts = request.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content.trim())
    .filter(Boolean);
  const userParts = request.messages
    .filter((m) => m.role !== "system")
    .map((m) => m.content.trim())
    .filter(Boolean);

  if (systemParts.length === 0) {
    return userParts.join("\n\n");
  }

  return [
    "### SYSTEM INSTRUCTIONS ###",
    ...systemParts,
    "",
    "### USER REQUEST ###",
    ...userParts,
  ].join("\n");
}

export async function completeWithAgy(request: CompletionRequest): Promise<CompletionResponse> {
  if (!isNodeEnvironment()) {
    throw new Error("Antigravity CLI is only available in a Node environment.");
  }

  const [childProcessModule, fsModule, osModule, pathModule] = await Promise.all([
    import(/* @vite-ignore */ "node:child_process"),
    import(/* @vite-ignore */ "node:fs"),
    import(/* @vite-ignore */ "node:os"),
    import(/* @vite-ignore */ "node:path"),
  ]);

  const { spawn } = childProcessModule;
  const fs = fsModule.default ?? fsModule;
  const os = osModule.default ?? osModule;
  const path = pathModule.default ?? pathModule;

  let binary = process.env.AGY_PATH;
  if (!binary || !fs.existsSync(binary)) {
    const userAgy = path.join(os.homedir(), ".local/bin/agy");
    const brewAgy = "/opt/homebrew/bin/agy";
    if (fs.existsSync(userAgy)) {
      binary = userAgy;
    } else if (fs.existsSync(brewAgy)) {
      binary = brewAgy;
    } else {
      binary = "agy";
    }
  }

  const prompt = formatAgyPrompt(request);

  const currentPath = process.env.PATH ?? "";
  const extraPaths = [path.join(os.homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin"];
  const missing = extraPaths.filter((p: string) => !currentPath.includes(p));
  const envPath = missing.length > 0 ? `${missing.join(path.delimiter)}${path.delimiter}${currentPath}` : currentPath;

  const args: string[] = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--dangerously-skip-permissions",
    "--print-timeout",
    "10m",
  ];

  if (request.reasoningEffort) {
    args.push("--effort", request.reasoningEffort);
  }

  if (process.env.AGY_MODEL) {
    args.push("--model", process.env.AGY_MODEL.trim());
  }

  return new Promise((resolve, reject) => {
    const child = spawn(binary!, args, {
      env: { ...process.env, PATH: envPath },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err: Error) => {
      reject(new Error(`Failed to launch Antigravity CLI ('${binary}'): ${err.message}`));
    });

    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      if (code !== 0) {
        const errorDetail = stderr.trim() || stdout.trim() || `exit code ${code}${signal ? ` (signal ${signal})` : ""}`;
        reject(new Error(`Antigravity CLI ('${binary}') failed: ${errorDetail}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as AgyJsonOutput;
        if (parsed.status && parsed.status !== "SUCCESS") {
          reject(
            new Error(
              `Antigravity CLI returned status '${parsed.status}': ${parsed.error ?? parsed.response ?? "Unknown error"}`,
            ),
          );
          return;
        }

        if (typeof parsed.response !== "string") {
          reject(new Error("Antigravity CLI output missing 'response' text field."));
          return;
        }

        resolve({
          text: parsed.response,
          provider: "agy",
          model: process.env.AGY_MODEL ?? "antigravity",
        });
      } catch (parseError) {
        reject(
          new Error(
            `Failed to parse Antigravity CLI JSON response: ${parseError instanceof Error ? parseError.message : "invalid JSON"}\nOutput was: ${stdout.slice(0, 500)}`,
          ),
        );
      }
    });
  });
}
