const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const PRODUCT_NAME = "Codex Slides";
const APP_ID = "io.nexu.codex-slides";

app.setName(PRODUCT_NAME);
if (process.platform === "win32") app.setAppUserModelId(APP_ID);

let mainWindow = null;
let serverProcess = null;
let serverLogFd = null;
let appUrl = "";

function resolveDesktopIconPath() {
  const iconName = process.platform === "darwin"
    ? "codex-slides-app-icon.png"
    : "codex-slides-mark.png";
  if (!app.isPackaged) return path.join(__dirname, "..", "public", "brand", iconName);
  const bundledWebIcon = path.join(process.resourcesPath, "next", "public", "brand", iconName);
  return fs.existsSync(bundledWebIcon)
    ? bundledWebIcon
    : path.join(process.resourcesPath, iconName);
}

function applyDesktopIdentity() {
  if (process.platform === "darwin" && app.dock) app.dock.setIcon(resolveDesktopIconPath());
}

ipcMain.handle("codex-slides:copy-text", (event, value) => {
  if (typeof value !== "string" || !value || value.length > 32_768) return false;
  try {
    const senderOrigin = new URL(event.senderFrame.url).origin;
    if (!appUrl || senderOrigin !== new URL(appUrl).origin) return false;
  } catch {
    return false;
  }
  clipboard.writeText(value);
  return true;
});

function freePort(preferred = 4311) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => {
      const fallback = net.createServer();
      fallback.unref();
      fallback.once("error", reject);
      fallback.listen(0, "127.0.0.1", () => {
        const address = fallback.address();
        const port = typeof address === "object" && address ? address.port : preferred + 1;
        fallback.close(() => resolve(port));
      });
    });
    server.listen(preferred, "127.0.0.1", () => server.close(() => resolve(preferred)));
  });
}

function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(`${url}/api/agents`, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry();
      });
      request.setTimeout(2_000, () => request.destroy());
      request.once("error", retry);
    };
    const retry = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`${PRODUCT_NAME} server did not become ready at ${url}`));
        return;
      }
      setTimeout(attempt, 350);
    };
    attempt();
  });
}

async function startPackagedServer() {
  const serverRoot = path.join(process.resourcesPath, "next");
  const entry = path.join(serverRoot, "server.js");
  if (!fs.existsSync(entry)) throw new Error(`Packaged Next.js server is missing: ${entry}`);
  const port = await freePort(4311);
  const logPath = path.join(app.getPath("userData"), "codex-slides-server.log");
  serverLogFd = fs.openSync(logPath, "a");
  serverProcess = spawn(process.execPath, [entry], {
    cwd: serverRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NEXT_TELEMETRY_DISABLED: "1",
      CODEX_SLIDES_DATA_DIR: path.join(app.getPath("userData"), "data"),
    },
    stdio: ["ignore", serverLogFd, serverLogFd],
    windowsHide: true,
  });
  serverProcess.once("exit", (code) => {
    if (code && !app.isQuitting) dialog.showErrorBox(PRODUCT_NAME, `The local server stopped unexpectedly (${code}). See ${logPath}.`);
  });
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(serverProcess.pid), "/T", "/F"], { windowsHide: true });
    } else {
      serverProcess.kill("SIGTERM");
    }
  }
  serverProcess = null;
  if (serverLogFd != null) fs.closeSync(serverLogFd);
  serverLogFd = null;
}

function secureWindowOptions() {
  return {
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: "#F6F5F1",
    title: PRODUCT_NAME,
    icon: resolveDesktopIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  };
}

// Presenter popup: same hardened webPreferences, but shown immediately (no
// ready-to-show handler is attached to child windows) and sized for the
// separate notes + timer view.
function presenterWindowOptions() {
  return {
    ...secureWindowOptions(),
    width: 1320,
    height: 820,
    minWidth: 720,
    minHeight: 620,
    show: true,
    backgroundColor: "#111318",
  };
}

function createWindow() {
  mainWindow = new BrowserWindow(secureWindowOptions());
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
    // Presenter mode opens a named blank popup and writes its own HTML via
    // document.write(). Keep the exception narrow so unrelated blank popups
    // remain denied by the desktop shell.
    if (url === "about:blank" && frameName.startsWith("codex-slides-presenter-")) {
      return { action: "allow", overrideBrowserWindowOptions: presenterWindowOptions() };
    }
    try {
      if (new URL(url).origin === new URL(appUrl).origin) {
        return { action: "allow", overrideBrowserWindowOptions: secureWindowOptions() };
      }
    } catch {
      // Non-URL targets are denied below.
    }
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin === new URL(appUrl).origin) return;
    } catch {
      // Deny malformed targets.
    }
    event.preventDefault();
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });
  void mainWindow.loadURL(appUrl);
  mainWindow.on("closed", () => { mainWindow = null; });
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  try {
    applyDesktopIdentity();
    appUrl = process.env.CODEX_SLIDES_URL?.replace(/\/$/, "")
      || (app.isPackaged ? await startPackagedServer() : "http://127.0.0.1:4311");
    createWindow();
  } catch (error) {
    dialog.showErrorBox(`${PRODUCT_NAME} could not start`, error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && appUrl) createWindow();
});
app.on("before-quit", () => { app.isQuitting = true; stopServer(); });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
