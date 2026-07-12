const { spawn } = require("node:child_process");
const http = require("node:http");
const electronBinary = require("electron");

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const url = process.env.PPT_ANYTHING_URL || "http://127.0.0.1:4311";
const next = spawn(pnpm, ["dev"], { stdio: "inherit", env: process.env });
let desktop = null;
let closing = false;

function waitForDevServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(`${url}/api/agents`, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry();
      });
      request.setTimeout(1_500, () => request.destroy());
      request.once("error", retry);
    };
    const retry = () => Date.now() >= deadline
      ? reject(new Error(`Dev server did not start at ${url}`))
      : setTimeout(attempt, 300);
    attempt();
  });
}

function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  if (desktop && !desktop.killed) desktop.kill("SIGTERM");
  if (!next.killed) next.kill("SIGTERM");
  process.exitCode = code;
}

next.once("exit", (code) => shutdown(code ?? 0));
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

waitForDevServer().then(() => {
  desktop = spawn(electronBinary, ["."], {
    stdio: "inherit",
    env: { ...process.env, PPT_ANYTHING_URL: url },
  });
  desktop.once("exit", (code) => shutdown(code ?? 0));
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  shutdown(1);
});

