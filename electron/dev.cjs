const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const electronBinary = require("electron");

const PRODUCT_NAME = "Codex Slides";
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_URL = "http://127.0.0.1:4311";
const TARGETS = new Set(["all", "web", "desktop"]);
const desktopBuilderConfig = path.join(PROJECT_ROOT, "electron-builder.dev.yml");
const electronBuilderCli = require.resolve("electron-builder/cli.js");
const nextBinary = require.resolve("next/dist/bin/next");

let web = null;
let desktop = null;
let ownsWeb = false;
let closing = false;
let shutdownPromise = null;
let generatedTsConfigPath = null;

function printHelp() {
  process.stdout.write(`${PRODUCT_NAME} development runner

Usage:
  pnpm dev [all|web|desktop] [--web-port <port>]

Commands:
  pnpm dev                  Start Web + Desktop (default)
  pnpm dev:web              Start Web only
  pnpm dev:desktop          Start Desktop and its Web dependency

Options:
  --web-port <port>         Override the port from CODEX_SLIDES_URL
  -h, --help                Show this help
`);
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--web-port must be an integer between 1 and 65535");
  }
  return port;
}

function parseArgs(argv) {
  let target = "all";
  let targetSet = false;
  let webPort = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "-h" || arg === "--help") return { help: true, target, webPort };
    if (arg === "--web-port") {
      const value = argv[index + 1];
      if (value == null) throw new Error("--web-port requires a value");
      webPort = parsePort(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--web-port=")) {
      webPort = parsePort(arg.slice("--web-port=".length));
      continue;
    }
    if (!arg.startsWith("-") && TARGETS.has(arg) && !targetSet) {
      target = arg;
      targetSet = true;
      continue;
    }
    throw new Error(`Unknown development runner argument: ${arg}`);
  }

  return { help: false, target, webPort };
}

function resolveAppUrl(webPort) {
  let appUrl;
  try {
    appUrl = new URL(process.env.CODEX_SLIDES_URL || DEFAULT_URL);
  } catch {
    throw new Error("CODEX_SLIDES_URL must be a valid absolute URL");
  }
  if (appUrl.protocol !== "http:") {
    throw new Error("The development runner requires an http:// CODEX_SLIDES_URL");
  }
  if (appUrl.username || appUrl.password) {
    throw new Error("CODEX_SLIDES_URL must not contain credentials");
  }
  if (webPort != null) appUrl.port = String(webPort);
  return appUrl;
}

function displayUrl(appUrl) {
  return appUrl.toString().replace(/\/$/, "");
}

function healthUrl(appUrl) {
  return new URL("/api/agents", appUrl);
}

function isCodexSlidesHealthPayload(value) {
  return Boolean(value && typeof value === "object" && Array.isArray(value.agents));
}

function probeDevServer(appUrl, timeoutMs = 1_500) {
  return new Promise((resolve) => {
    let settled = false;
    let body = "";
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      resolve(ready);
    };
    const request = http.get(healthUrl(appUrl), { headers: { accept: "application/json" } }, (response) => {
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1_000_000) {
          response.destroy();
          finish(false);
        }
      });
      response.once("end", () => {
        if (response.statusCode !== 200) {
          finish(false);
          return;
        }
        try {
          finish(isCodexSlidesHealthPayload(JSON.parse(body)));
        } catch {
          finish(false);
        }
      });
      response.once("error", () => finish(false));
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      finish(false);
    });
    request.once("error", () => finish(false));
  });
}

async function waitForDevServer(appUrl, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (!closing && Date.now() < deadline) {
    if (await probeDevServer(appUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (closing) throw new Error("Web service stopped before becoming ready");
  throw new Error(`Web service did not start at ${displayUrl(appUrl)}`);
}

function activeChild(child) {
  return Boolean(child?.pid && child.exitCode == null && child.signalCode == null);
}

function stopChild(child, signal = "SIGTERM") {
  if (!activeChild(child)) return;
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

function waitForChild(child) {
  if (!activeChild(child)) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", resolve));
}

function shutdown(code = 0) {
  if (shutdownPromise) {
    if (code !== 0) process.exitCode = code;
    return shutdownPromise;
  }

  closing = true;
  process.exitCode = code;
  const children = [desktop, ownsWeb ? web : null].filter(activeChild);
  const exits = children.map(waitForChild);

  shutdownPromise = (async () => {
    try {
      for (const child of children) stopChild(child);
      if (children.length === 0) return;

      let forceTimer;
      await Promise.race([
        Promise.all(exits),
        new Promise((resolve) => {
          forceTimer = setTimeout(() => {
            for (const child of children) stopChild(child, "SIGKILL");
            resolve();
          }, 3_000);
        }),
      ]);
      if (forceTimer) clearTimeout(forceTimer);
    } finally {
      if (generatedTsConfigPath) fs.rmSync(generatedTsConfigPath, { force: true });
      generatedTsConfigPath = null;
    }
  })();

  return shutdownPromise;
}

function localBindHost(appUrl) {
  if (appUrl.hostname === "localhost") return "127.0.0.1";
  if (appUrl.hostname === "127.0.0.1" || appUrl.hostname === "[::1]") {
    return appUrl.hostname.replaceAll("[", "").replaceAll("]", "");
  }
  throw new Error(
    `No reusable Web service found at ${displayUrl(appUrl)}. Automatic startup requires a loopback CODEX_SLIDES_URL.`,
  );
}

function effectivePort(appUrl) {
  return appUrl.port || "80";
}

function devDistDir(appUrl) {
  const configured = process.env.CODEX_SLIDES_DIST_DIR?.trim();
  if (configured) return configured;
  return `.next-dev/port-${effectivePort(appUrl)}`;
}

function prepareDevTsConfig(appUrl, distDir) {
  const fileName = `tsconfig.next-dev-${effectivePort(appUrl)}.json`;
  const base = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "tsconfig.json"), "utf8"));
  const include = Array.isArray(base.include) ? base.include : ["next-env.d.ts", "**/*.ts", "**/*.tsx"];
  const nextTypes = `${distDir}/types/**/*.ts`;
  const config = {
    ...base,
    include: [...new Set([...include, nextTypes])],
  };
  generatedTsConfigPath = path.join(PROJECT_ROOT, fileName);
  fs.writeFileSync(generatedTsConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return fileName;
}

async function startWebService(appUrl) {
  const host = localBindHost(appUrl);
  const port = effectivePort(appUrl);
  const distDir = devDistDir(appUrl);
  const tsConfigPath = prepareDevTsConfig(appUrl, distDir);
  let startupSettled = false;
  let rejectStartup;
  const startupFailure = new Promise((_, reject) => {
    rejectStartup = reject;
  });

  ownsWeb = true;
  process.stdout.write(`[codex-slides] Starting Web service at ${displayUrl(appUrl)}\n`);
  web = spawn(process.execPath, [nextBinary, "dev", "-H", host, "-p", port], {
    detached: process.platform !== "win32",
    stdio: "inherit",
    env: {
      ...process.env,
      CODEX_SLIDES_URL: displayUrl(appUrl),
      CODEX_SLIDES_DIST_DIR: distDir,
      CODEX_SLIDES_TSCONFIG_PATH: tsConfigPath,
    },
  });
  web.once("error", (error) => {
    if (!startupSettled) rejectStartup(new Error(`Web service failed: ${error.message}`));
    else if (!closing) void shutdown(1);
  });
  web.once("exit", (code, signal) => {
    if (closing) return;
    const detail = signal || code || 0;
    if (!startupSettled) rejectStartup(new Error(`Web service exited before becoming ready (${detail})`));
    else void shutdown(code || 1);
  });

  await Promise.race([waitForDevServer(appUrl), startupFailure]);
  startupSettled = true;
  process.stdout.write(`[codex-slides] Web service ready at ${displayUrl(appUrl)}\n`);
}

async function ensureWebServer(appUrl) {
  if (await probeDevServer(appUrl, 700)) {
    process.stdout.write(`[codex-slides] Reusing Web service at ${displayUrl(appUrl)}\n`);
    return;
  }
  await startWebService(appUrl);
}

function desktopEnvironment(appUrl) {
  const env = { ...process.env, CODEX_SLIDES_URL: displayUrl(appUrl) };
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === "ELECTRON_RUN_AS_NODE") delete env[key];
  }
  return env;
}

function desktopShellFingerprint() {
  const hash = crypto.createHash("sha256");
  for (const file of [
    path.join(PROJECT_ROOT, "electron", "main.cjs"),
    path.join(PROJECT_ROOT, "electron", "preload.cjs"),
    path.join(PROJECT_ROOT, "electron", "package.json"),
    path.join(PROJECT_ROOT, "public", "brand", "codex-slides-app-icon.png"),
    desktopBuilderConfig,
  ]) {
    hash.update(file);
    hash.update(fs.readFileSync(file));
  }
  hash.update(electronBinary);
  return hash.digest("hex");
}

function findMacDesktopBinary(outputRoot) {
  for (const directory of ["mac-arm64", "mac", "mac-x64"]) {
    const executable = path.join(outputRoot, directory, `${PRODUCT_NAME}.app`, "Contents", "MacOS", PRODUCT_NAME);
    if (fs.existsSync(executable)) return executable;
  }
  return null;
}

function ensureMacDesktopBinary() {
  if (process.platform !== "darwin") return electronBinary;

  const outputRoot = path.join(PROJECT_ROOT, ".tmp", "electron-dev-build");
  const markerPath = path.join(outputRoot, "codex-slides-dev-shell.json");
  const fingerprint = desktopShellFingerprint();
  const existing = findMacDesktopBinary(outputRoot);
  if (existing && fs.existsSync(markerPath)) {
    try {
      if (fs.readFileSync(markerPath, "utf8") === fingerprint) return existing;
    } catch {
      // Rebuild the generated shell below.
    }
  }

  process.stdout.write("[codex-slides] Preparing branded macOS Desktop shell\n");
  const built = spawnSync(process.execPath, [
    electronBuilderCli,
    "--mac",
    "--dir",
    "--config",
    desktopBuilderConfig,
    "--publish",
    "never",
  ], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
    stdio: "inherit",
  });
  if (built.status !== 0) {
    throw new Error(`Could not build branded macOS desktop shell (exit ${built.status ?? "unknown"})`);
  }

  const executable = findMacDesktopBinary(outputRoot);
  if (!executable) throw new Error(`Branded macOS desktop shell was not produced in ${outputRoot}`);
  fs.writeFileSync(markerPath, fingerprint, "utf8");
  return executable;
}

function startDesktop(appUrl) {
  process.stdout.write(`[codex-slides] Starting Desktop against ${displayUrl(appUrl)}\n`);
  desktop = spawn(ensureMacDesktopBinary(), [PROJECT_ROOT], {
    detached: process.platform !== "win32",
    stdio: "inherit",
    env: desktopEnvironment(appUrl),
  });
  desktop.once("error", (error) => {
    process.stderr.write(`[codex-slides] Desktop failed: ${error.message}\n`);
    void shutdown(1);
  });
  desktop.once("exit", (code) => {
    if (!closing) void shutdown(code ?? 0);
  });
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const appUrl = resolveAppUrl(options.webPort);
  await ensureWebServer(appUrl);
  if (options.target === "web" || closing) return;
  startDesktop(appUrl);
}

void main().catch(async (error) => {
  if (closing) return;
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  await shutdown(1);
});
