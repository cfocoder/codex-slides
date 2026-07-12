#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));
const desktopPkg = JSON.parse(read("electron/package.json"));
const nextConfig = read("next.config.mjs");
const main = read("electron/main.cjs");
const builder = read("electron-builder.yml");
const release = read(".github/workflows/release-desktop.yml");
const prepareStandalone = read("scripts/prepare-standalone.mjs");

assert.equal(pkg.main, "electron/main.cjs");
assert.equal(desktopPkg.main, "main.cjs");
assert.equal(desktopPkg.version, pkg.version);
assert.ok(pkg.scripts["electron:dev"]);
assert.ok(pkg.scripts["electron:dist"]);
assert.match(nextConfig, /output:\s*"standalone"/);
assert.match(nextConfig, /outputFileTracingExcludes/);
assert.match(nextConfig, /"\.\/data\/\*\*\/\*"/);
assert.match(main, /PPT_ANYTHING_DATA_DIR/);
assert.match(main, /contextIsolation:\s*true/);
assert.match(main, /nodeIntegration:\s*false/);
assert.match(main, /sandbox:\s*true/);
assert.match(builder, /target:\s*dmg/);
assert.match(builder, /target:\s*nsis/);
assert.match(builder, /target:\s*AppImage/);
assert.match(builder, /app:\s*electron/);
assert.match(builder, /npmRebuild:\s*false/);
assert.match(builder, /!node_modules/);
assert.match(builder, /from:\s*\.next\/standalone\/node_modules/);
assert.match(prepareStandalone, /get-metadata-route/);
assert.match(prepareStandalone, /Unsafe local directory/);
assert.match(prepareStandalone, /rmSync\(join\(standalone, "dist"\)/);
assert.match(release, /macos-latest/);
assert.match(release, /windows-latest/);
assert.match(release, /ubuntu-latest/);

process.stdout.write("Electron contract passed: standalone server, sandboxed shell, macOS/Windows/Linux packaging.\n");
