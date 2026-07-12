const { spawn } = require("node:child_process");
const http = require("node:http");
const electronBinary = require("electron");

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const url = process.env.PPT_ANYTHING_URL || "http://127.0.0.1:4311";
let web = null;
let desktop = null;
let ownsWeb = false;
let closing = false;

function probeDevServer(timeoutMs = 1_500) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      resolve(ready);
    };
    const request = http.get(`${url}/api/agents`, (response) => {
      response.resume();
      finish(Boolean(response.statusCode && response.statusCode < 500));
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      finish(false);
    });
    request.once("error", () => finish(false));
  });
}

async function waitForDevServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeDevServer()) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Dev server did not start at ${url}`);
}

function stopChild(child, signal = "SIGTERM") {
  if (!child?.pid || child.exitCode != null || child.signalCode != null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.unref();
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  stopChild(desktop);
  if (ownsWeb) stopChild(web);
  process.exitCode = code;

  const forceStop = setTimeout(() => {
    stopChild(desktop, "SIGKILL");
    if (ownsWeb) stopChild(web, "SIGKILL");
  }, 3_000);
  forceStop.unref();
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

async function ensureWebServer() {
  if (await probeDevServer(700)) {
    process.stdout.write(`[ppt-anything] Reusing Web service at ${url}\n`);
    return;
  }

  ownsWeb = true;
  process.stdout.write(`[ppt-anything] Starting Web service at ${url}\n`);
  web = spawn(pnpm, ["dev:web"], {
    detached: process.platform !== "win32",
    stdio: "inherit",
    env: process.env,
  });
  web.once("error", (error) => {
    process.stderr.write(`[ppt-anything] Web service failed: ${error.message}\n`);
    shutdown(1);
  });
  web.once("exit", (code) => {
    if (!closing) shutdown(code || 1);
  });
  await waitForDevServer();
}

void ensureWebServer()
  .then(() => {
    if (closing) return;
    process.stdout.write(`[ppt-anything] Starting Desktop against ${url}\n`);
    desktop = spawn(electronBinary, ["."], {
      detached: process.platform !== "win32",
      stdio: "inherit",
      env: { ...process.env, PPT_ANYTHING_URL: url },
    });
    desktop.once("error", (error) => {
      process.stderr.write(`[ppt-anything] Desktop failed: ${error.message}\n`);
      shutdown(1);
    });
    desktop.once("exit", (code) => shutdown(code ?? 0));
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    shutdown(1);
  });
