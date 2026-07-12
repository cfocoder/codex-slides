#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const env = {
  ...process.env,
  NODE_ENV: "production",
  CODEX_SLIDES_DIST_DIR: ".next-desktop",
};

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [require.resolve("next/dist/bin/next"), "build"]);
run(process.execPath, [join(root, "scripts", "prepare-standalone.mjs")]);
