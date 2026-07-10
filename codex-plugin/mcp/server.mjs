// PPT Anything — Codex MCP plugin (M6).
//
// Exposes the ppt-anything web app's capabilities as MCP tools so Codex can
// build/preview/edit/export decks WITHOUT leaving the editor (cowart model).
// Tools call the running Next app's HTTP API; a tiny daemon ensures it is up
// and Codex opens previews in its in-editor browser.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, "..", ".."); // web/
const BASE = process.env.PPT_ANYTHING_URL || "http://localhost:4311";

const manifest = JSON.parse(
  readFileSync(join(__dirname, "..", ".codex-plugin", "plugin.json"), "utf8"),
);

// --- daemon: ensure the web app is reachable, else boot it ------------------
async function reachable() {
  try {
    const r = await fetch(`${BASE}/api/agents`, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}

let booting = null;
async function ensureServer() {
  if (await reachable()) return true;
  if (!booting) {
    booting = (async () => {
      const child = spawn("npm", ["run", "start"], {
        cwd: WEB_DIR,
        detached: true,
        stdio: "ignore",
        env: process.env,
      });
      child.unref();
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        if (await reachable()) return true;
      }
      return false;
    })();
  }
  return booting;
}

function text(s) {
  return { content: [{ type: "text", text: s }] };
}

// --- SSE helper -------------------------------------------------------------
async function consumeSse(resp, onEvent) {
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of resp.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()));
      } catch {
        /* ignore */
      }
    }
  }
}

// --- server + tools ---------------------------------------------------------
const server = new McpServer(
  { name: manifest.name, version: manifest.version },
  {
    instructions:
      "Build slide decks by image generation, driven by Codex. create_deck makes a deck (optionally research-backed); open_preview returns a URL to open in the in-editor browser; regenerate_slide / export_deck / list_projects / deep_research complete the loop.",
  },
);

server.registerTool(
  "create_deck",
  {
    title: "Create a slide deck",
    description:
      "Generate a slide deck (each slide is an image drawn by Codex). Returns a project id + preview URL. Optionally research-backed.",
    inputSchema: {
      topic: z.string().describe("What the deck is about"),
      pages: z.number().int().min(1).max(30).optional().describe("slide count (default 6)"),
      aspect: z.enum(["16:9", "4:3", "1:1", "9:16", "3:4"]).optional(),
      language: z.enum(["auto", "zh", "en", "ja"]).optional(),
      style: z.string().optional().describe("free-text visual style/tone"),
      research: z.boolean().optional().describe("run deep research first and ground the deck in it"),
    },
  },
  async ({ topic, pages, aspect, language, style, research }) => {
    if (!(await ensureServer())) return text(`ppt-anything web app not reachable at ${BASE}. Build it once (npm run build) then retry.`);
    let researchDoc;
    if (research) {
      const rr = await fetch(`${BASE}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement: topic, rounds: 2 }),
      });
      await consumeSse(rr, (e) => {
        if (e.type === "doc") researchDoc = e.markdown;
      });
    }
    const resp = await fetch(`${BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirement: topic,
        pages: pages ?? 6,
        aspect: aspect ?? "16:9",
        language: language ?? "auto",
        style: style ?? "",
        resolution: "2K",
        engine: "codex",
        ...(researchDoc ? { mode: "research", researchDoc } : {}),
      }),
    });
    let id = null;
    let rendered = 0;
    let errored = 0;
    await consumeSse(resp, (e) => {
      if (e.type === "project") id = e.id;
      else if (e.type === "page_rendered") rendered++;
      else if (e.type === "page_error") errored++;
    });
    if (!id) return text("Deck generation failed (no project created). Check the app logs.");
    return text(
      `Deck created: ${id}\nSlides rendered: ${rendered}${errored ? ` (${errored} errored)` : ""}\n` +
        `Preview (open in the in-editor browser): ${BASE}/project/${id}\n` +
        `Export: ${BASE}/api/projects/${id}/export?format=pdf  |  ?format=pptx`,
    );
  },
);

server.registerTool(
  "deep_research",
  {
    title: "Deep research a topic",
    description: "Run the web-search research loop and return a cited markdown brief.",
    inputSchema: { topic: z.string(), rounds: z.number().int().min(1).max(4).optional() },
  },
  async ({ topic, rounds }) => {
    if (!(await ensureServer())) return text(`web app not reachable at ${BASE}`);
    const rr = await fetch(`${BASE}/api/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirement: topic, rounds: rounds ?? 2 }),
    });
    let doc = "";
    await consumeSse(rr, (e) => {
      if (e.type === "doc") doc = e.markdown;
    });
    return text(doc || "No research document produced.");
  },
);

server.registerTool(
  "list_projects",
  {
    title: "List decks",
    description: "List existing ppt-anything projects with preview URLs.",
    inputSchema: {},
  },
  async () => {
    if (!(await ensureServer())) return text(`web app not reachable at ${BASE}`);
    const d = await (await fetch(`${BASE}/api/projects`)).json();
    const list = (d.projects ?? [])
      .map((p) => `- ${p.title} — ${p.rendered}/${p.total} slides — ${BASE}/project/${p.id}`)
      .join("\n");
    return text(list || "No projects yet.");
  },
);

server.registerTool(
  "open_preview",
  {
    title: "Open a deck preview",
    description: "Return the preview URL for a project to open in the in-editor browser.",
    inputSchema: { projectId: z.string() },
  },
  async ({ projectId }) => text(`${BASE}/project/${projectId}`),
);

server.registerTool(
  "regenerate_slide",
  {
    title: "Regenerate a slide",
    description: "Regenerate one slide, optionally with an edit instruction.",
    inputSchema: {
      projectId: z.string(),
      index: z.number().int().min(1),
      instruction: z.string().optional(),
    },
  },
  async ({ projectId, index, instruction }) => {
    if (!(await ensureServer())) return text(`web app not reachable at ${BASE}`);
    const r = await fetch(`${BASE}/api/projects/${projectId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, instruction }),
    });
    const d = await r.json();
    if (!r.ok) return text(`Error: ${d.error}`);
    return text(`Slide ${index} regenerated. Preview: ${BASE}/project/${projectId}`);
  },
);

server.registerTool(
  "export_deck",
  {
    title: "Export a deck",
    description: "Return the download URL for a deck as PDF or PPTX.",
    inputSchema: { projectId: z.string(), format: z.enum(["pdf", "pptx"]).optional() },
  },
  async ({ projectId, format }) =>
    text(`${BASE}/api/projects/${projectId}/export?format=${format ?? "pdf"}`),
);

const transport = new StdioServerTransport();
await server.connect(transport);
