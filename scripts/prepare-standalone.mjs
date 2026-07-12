#!/usr/bin/env node

import { cpSync, existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = process.env.CODEX_SLIDES_DIST_DIR || ".next-desktop";
const standalone = join(root, distDir, "standalone");
const server = join(standalone, "server.js");
if (!existsSync(server)) throw new Error("Next standalone server was not produced.");

const rootRequire = createRequire(import.meta.url);
const sourceNext = dirname(rootRequire.resolve("next/package.json"));
const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const standalonePackageFile = join(standalone, "package.json");
const standalonePackage = JSON.parse(readFileSync(standalonePackageFile, "utf8"));
const runtimeDependencies = ["next", "react", "react-dom", "pdf-lib", "pptxgenjs"];
standalonePackage.main = "server.js";
standalonePackage.scripts = {};
standalonePackage.dependencies = Object.fromEntries(
  runtimeDependencies.map((name) => [name, rootPackage.dependencies[name]]),
);
delete standalonePackage.devDependencies;
writeFileSync(standalonePackageFile, `${JSON.stringify(standalonePackage, null, 2)}\n`, "utf8");

// Next 14's pnpm trace can contain package files without the corresponding
// pnpm links. Reinstall only the already-downloaded production runtime into the
// generated directory: no network, lifecycle scripts, workspace, or lockfile.
rmSync(join(standalone, "node_modules"), { recursive: true, force: true });
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const install = spawnSync(pnpm, [
  "install",
  "--dir", standalone,
  "--prod",
  "--offline",
  "--ignore-scripts",
  "--ignore-workspace",
  "--no-lockfile",
], { cwd: root, stdio: "inherit" });
if (install.status !== 0) throw new Error(`Standalone production install failed (${install.status ?? "unknown"}).`);

const destinationNext = realpathSync(join(standalone, "node_modules", "next"));

// Next 14.2's file tracer misses this statically-required metadata helper in
// standalone mode. Copy the small runtime family so packaged servers do not
// depend on the source checkout or fail only after Electron starts.
cpSync(
  join(sourceNext, "dist", "lib", "metadata"),
  join(destinationNext, "dist", "lib", "metadata"),
  { recursive: true },
);
cpSync(
  join(sourceNext, "dist", "shared"),
  join(destinationNext, "dist", "shared"),
  { recursive: true },
);

// A repeated local packaging run can otherwise feed the previous Electron
// output back into Next's trace. It is generated state, never app input.
rmSync(join(standalone, "dist"), { recursive: true, force: true });

for (const unsafe of ["data", ".next-dev", ".claude"]) {
  if (existsSync(join(standalone, unsafe))) {
    throw new Error(`Unsafe local directory was traced into standalone: ${unsafe}`);
  }
}

const standaloneRequire = createRequire(server);
for (const dependency of runtimeDependencies) {
  const resolved = standaloneRequire.resolve(dependency);
  if (!resolved.startsWith(`${standalone}${sep}`)) {
    throw new Error(`${dependency} escaped the standalone runtime: ${resolved}`);
  }
}

const nextRequire = createRequire(join(destinationNext, "package.json"));
const styledJsx = nextRequire.resolve("styled-jsx/package.json");
if (!styledJsx.startsWith(`${standalone}${sep}`)) {
  throw new Error(`styled-jsx escaped the standalone runtime: ${styledJsx}`);
}
const metadataHelper = nextRequire.resolve("next/dist/lib/metadata/get-metadata-route");
process.stdout.write(
  `Standalone runtime ready: ${relative(standalone, metadataHelper)}; local project data excluded.\n`,
);
