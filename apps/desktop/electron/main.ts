import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRIDGE_DEFAULT_PORT, SYNC_DEFAULT_PORT, isExtensionConnectRequest } from "@ghostboard/shared";
import { createExtensionMessageServer } from "@ghostboard/extension-messaging";
import { initDb } from "./db/index";
import { createBridgeServer } from "./bridge/server";
import { getOrCreateBridgeToken } from "./bridge/token";
import { registerIpcHandlers } from "./ipc/handlers";
import { createJobSpySidecar } from "./jobspy/sidecar";
import { createSyncServer, type SyncServer } from "./sync/server";
import { setSyncServerDisabled, setSyncServerInfo, setSyncServerUnavailable } from "./sync/info";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron's default sandboxed preload context can't run electron-vite's
      // ESM (.mjs) preload output ("Cannot use import statement outside a
      // module"). contextIsolation stays on, so the renderer still can't touch
      // Node directly — only the contextBridge API in preload.ts is exposed.
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    // Surface renderer errors in the main-process terminal during dev — a
    // blank window otherwise gives no clue that e.g. preload failed to load.
    win.webContents.on("console-message", (_e, level, message) => {
      if (level >= 2) console.error(`[renderer] ${message}`);
    });
    win.webContents.on("render-process-gone", (_e, details) => {
      console.error("[renderer] process gone:", details.reason);
    });
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const existingWindow = BrowserWindow.getAllWindows()[0];
    if (!existingWindow) return;
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.focus();
  });

  app.whenReady().then(async () => {
    const db = await initDb();
    const jobSpySidecar = createJobSpySidecar(path.resolve(app.getAppPath(), "../../services/jobspy"));
    const jobSpyStartup = jobSpySidecar.start();
    registerIpcHandlers(db, () => jobSpySidecar.start());
    void jobSpyStartup.catch((error) => {
      console.error("[jobspy] Automatic startup failed:", error);
    });

    const port = Number(process.env.GHOSTBOARD_BRIDGE_PORT) || BRIDGE_DEFAULT_PORT;
    const { token } = getOrCreateBridgeToken(port);
    createBridgeServer(db, token, port);
    const extensionMessageServer = createExtensionMessageServer({});
    extensionMessageServer.onJsonMessage((message, client) => {
      if (!isExtensionConnectRequest(message)) return;
      extensionMessageServer.sendJsonTo(client, { type: "bridge-authentication", port, token });
    });
    let syncServer: SyncServer | undefined;
    if (process.env.GHOSTBOARD_SYNC_DISABLED === "1") {
      setSyncServerDisabled();
    } else {
      const configuredSyncPort = Number(process.env.GHOSTBOARD_SYNC_PORT);
      const syncPort = Number.isInteger(configuredSyncPort) && configuredSyncPort > 0 && configuredSyncPort <= 65_535
        ? configuredSyncPort
        : SYNC_DEFAULT_PORT;
      const candidate = createSyncServer({ db, token, port: syncPort });
      try {
        const info = await candidate.ready;
        syncServer = candidate;
        setSyncServerInfo(info, token);
        console.log(`[sync] companion listening on 0.0.0.0:${info.port}`);
      } catch (error) {
        await candidate.close();
        const reason = error instanceof Error ? error.message : "unknown startup error";
        setSyncServerUnavailable(`The iPhone companion could not start on port ${syncPort}. Restart the desktop or choose another GHOSTBOARD_SYNC_PORT.`);
        console.error("[sync] companion startup failed:", reason);
      }
    }

    app.once("before-quit", () => {
      jobSpySidecar.stop();
      void extensionMessageServer.close();
      void syncServer?.close();
    });

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
