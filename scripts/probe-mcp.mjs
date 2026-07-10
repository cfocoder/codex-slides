#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, ".codex-plugin", "plugin.json"), "utf8"));
const sourceCandidate = process.env.PPT_ANYTHING_PLUGIN_SOURCE || join(homedir(), "plugins", manifest.name);
const runtimeRoot = (() => {
  try {
    const candidate = realpathSync(resolve(sourceCandidate));
    if (existsSync(join(candidate, "node_modules", "@modelcontextprotocol", "sdk"))) return candidate;
  } catch {
    // Fall back to this plugin root for repository and archive installs.
  }
  return root;
})();
const sdkRoot = join(runtimeRoot, "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm", "client");
const { Client } = await import(pathToFileURL(join(sdkRoot, "index.js")).href);
const { StdioClientTransport } = await import(pathToFileURL(join(sdkRoot, "stdio.js")).href);

const live = process.argv.includes("--live");
const expected = [
  "get_capabilities",
  "open_ppt_anything",
  "get_onboarding_questions",
  "deep_research",
  "create_deck",
  "create_outline",
  "revise_outline",
  "rank_inspiration",
  "render_deck",
  "list_projects",
  "get_project",
  "list_templates",
  "edit_deck",
  "restyle_deck",
  "manage_slide",
  "regenerate_slide",
  "upload_material",
  "upload_slide_image",
  "mark_edit_slide",
  "export_deck",
];

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(root, "scripts/start-mcp.mjs")],
  cwd: root,
  env: {
    ...process.env,
    ...(live ? {} : { PPT_ANYTHING_NO_AUTO_START: "1" }),
  },
  stderr: "pipe",
});
const client = new Client({ name: "ppt-anything-probe", version: "1.0.0" });

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [...expected].sort(), "MCP tool inventory drifted");

  const capabilities = await client.callTool({ name: "get_capabilities", arguments: {} });
  assert.equal(capabilities.isError, undefined);
  assert.equal(capabilities.structuredContent?.capabilities?.length, 21);
  assert.ok(capabilities.content.some((item) => item.type === "resource_link"));

  if (live) {
    const projects = await client.callTool({ name: "list_projects", arguments: {} });
    assert.equal(projects.isError, undefined);
    const templates = await client.callTool({ name: "list_templates", arguments: {} });
    assert.equal(templates.isError, undefined);
    assert.ok(templates.structuredContent?.templates?.length >= 45);
    const opened = await client.callTool({ name: "open_ppt_anything", arguments: {} });
    assert.ok(opened.content.some((item) => item.type === "resource_link"));
  }

  process.stdout.write(`MCP probe passed: ${expected.length} tools${live ? ", live API and Browser link" : ""}.\n`);
} finally {
  await client.close();
}
