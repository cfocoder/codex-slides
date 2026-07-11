// PPT Anything — Codex MCP integration.
//
// The web app remains the visual source of truth. These tools expose the same
// workflows to Codex, while open_ppt_anything returns a first-class resource
// link that the bundled skill opens in the in-editor Browser.

import { spawn } from "node:child_process";
import { existsSync, openSync, closeSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const APP_DIR = resolve(process.env.PPT_ANYTHING_APP_DIR || PLUGIN_ROOT);
const BASE = (process.env.PPT_ANYTHING_URL || "http://127.0.0.1:4311").replace(/\/$/, "");
const SERVER_LOG = process.env.PPT_ANYTHING_LOG || join(tmpdir(), "ppt-anything-server.log");
const manifest = JSON.parse(
  await readFile(join(PLUGIN_ROOT, ".codex-plugin", "plugin.json"), "utf8"),
);

const CAPABILITIES = [
  ["Open and operate the full workspace", "open_ppt_anything", "Browser"],
  ["Discover every Codex-callable workflow", "get_capabilities", "MCP"],
  ["Generate topic-specific onboarding questions", "get_onboarding_questions", "MCP"],
  ["Run source-backed deep research", "deep_research", "MCP"],
  ["Create a complete deck in one call", "create_deck", "MCP + Browser"],
  ["Create a draft outline before rendering", "create_outline", "MCP + Browser"],
  ["Revise or replace an outline", "revise_outline", "MCP"],
  ["Rank visual inspiration directions", "rank_inspiration", "MCP"],
  ["Render a confirmed draft", "render_deck", "MCP + Browser"],
  ["List existing decks", "list_projects", "MCP"],
  ["Read a deck and its slide state", "get_project", "MCP"],
  ["Discover categories and templates", "list_templates", "MCP"],
  ["Execute a natural-language deck edit", "edit_deck", "MCP + Browser"],
  ["Restyle and optionally redraw a whole deck", "restyle_deck", "MCP + Browser"],
  ["Add, duplicate, delete, or transition slides", "manage_slide", "MCP"],
  ["Generate or regenerate one slide", "regenerate_slide", "MCP"],
  ["Upload a reference image or document", "upload_material", "MCP"],
  ["Replace a slide with a local PNG", "upload_slide_image", "MCP"],
  ["Apply an annotated-PNG edit", "mark_edit_slide", "MCP + Browser"],
  ["Download PDF or PPTX", "export_deck", "MCP + Browser"],
  ["Play, navigate, and inspect the deck visually", "open_ppt_anything", "Browser UI"],
];

const server = new McpServer(
  { name: manifest.name, version: manifest.version },
  {
    instructions: [
      "PPT Anything is a Codex-native presentation workspace backed by a local web app.",
      "When a user asks to open, launch, preview, view, play, or interact with PPT Anything, call open_ppt_anything and then immediately navigate the returned resource link in the Codex in-editor Browser. Do not merely print the URL or ask the user to open it manually.",
      "Use MCP tools for deterministic deck mutations. Keep the Browser open for visual inspection, direct manipulation, presentation mode, and final verification.",
      "For multi-step creation, prefer create_outline -> revise_outline/rank_inspiration -> render_deck. Use create_deck for a one-call result.",
    ].join(" "),
  },
);

let booting = null;

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function reachable() {
  try {
    const response = await fetch(`${BASE}/api/agents`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function runCommand(command, args, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: APP_DIR,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const collect = (chunk) => {
      output = `${output}${chunk}`.slice(-12000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} ${args.join(" ")} timed out`));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise(output);
      else reject(new Error(`${command} ${args.join(" ")} failed (${code})\n${output}`));
    });
  });
}

async function ensureServer() {
  if (await reachable()) return;
  if (process.env.PPT_ANYTHING_NO_AUTO_START === "1") {
    throw new Error(`PPT Anything is not reachable at ${BASE}.`);
  }
  if (!booting) {
    booting = (async () => {
      if (!existsSync(join(APP_DIR, ".next", "BUILD_ID"))) {
        await runCommand("npm", ["run", "build"], 10 * 60_000);
      }
      const fd = openSync(SERVER_LOG, "a");
      try {
        const child = spawn("npm", ["run", "start"], {
          cwd: APP_DIR,
          detached: true,
          env: process.env,
          stdio: ["ignore", fd, fd],
        });
        child.unref();
      } finally {
        closeSync(fd);
      }
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        await sleep(1000);
        if (await reachable()) return;
      }
      throw new Error(`PPT Anything did not start at ${BASE}. See ${SERVER_LOG}.`);
    })().finally(() => {
      booting = null;
    });
  }
  await booting;
}

function browserUrl(projectId) {
  return projectId ? `${BASE}/project/${encodeURIComponent(projectId)}` : BASE;
}

function resourceLink(uri, name, description) {
  return { type: "resource_link", uri, name, description, mimeType: "text/html" };
}

function ok(message, data = {}, links = []) {
  return {
    content: [
      { type: "text", text: message },
      ...links.map((link) => resourceLink(link.uri, link.name, link.description)),
    ],
    structuredContent: data,
  };
}

function failed(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: `PPT Anything error: ${message}` }],
    structuredContent: { error: message },
  };
}

function register(name, config, handler) {
  server.registerTool(name, config, async (args, extra) => {
    try {
      return await handler(args, extra);
    } catch (error) {
      return failed(error);
    }
  });
}

async function apiFetch(path, init = {}) {
  await ensureServer();
  return fetch(`${BASE}${path}`, init);
}

async function apiJson(path, init = {}) {
  const response = await apiFetch(path, init);
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  if (!response.ok) {
    throw new Error(data.error || data.raw || `HTTP ${response.status}`);
  }
  return data;
}

async function postJson(path, body, signal) {
  return apiJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

async function consumeSse(response, onEvent) {
  if (!response.ok || !response.body) {
    throw new Error((await response.text().catch(() => "")) || `HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLines = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (!dataLines.length) continue;
      try {
        const event = JSON.parse(dataLines.join("\n"));
        if (event.type === "error") streamError = String(event.error || "stream failed");
        onEvent(event);
      } catch {
        // Ignore malformed progress frames, but keep consuming the operation.
      }
    }
  }
  if (streamError) throw new Error(streamError);
}

async function postSse(path, body, onEvent, signal) {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  await consumeSse(response, onEvent);
}

function projectLink(projectId, label = "Open deck in Codex Browser") {
  return {
    uri: browserUrl(projectId),
    name: label,
    description: "Open the live PPT Anything workspace in the Codex in-editor Browser.",
  };
}

function slideSummary(page) {
  return {
    index: page.index,
    title: page.title,
    status: page.status,
    image: page.image,
    transition: page.transition || "none",
    error: page.error,
  };
}

function mimeFor(path) {
  const ext = extname(path).toLowerCase();
  return {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
  }[ext] || "application/octet-stream";
}

async function fileForm(filePath, field = "file", maxBytes = 30 * 1024 * 1024) {
  const absolute = resolve(filePath);
  const bytes = await readFile(absolute);
  if (bytes.length > maxBytes) throw new Error(`File exceeds ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const form = new FormData();
  form.append(field, new Blob([bytes], { type: mimeFor(absolute) }), basename(absolute));
  return { form, absolute, bytes };
}

register(
  "get_capabilities",
  {
    title: "Get PPT Anything capabilities",
    description: "Discover every MCP and in-editor Browser workflow exposed by PPT Anything.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => ok(
    `PPT Anything exposes ${CAPABILITIES.length} callable workflow surfaces. Use open_ppt_anything for the live visual workspace.`,
    { baseUrl: BASE, capabilities: CAPABILITIES.map(([capability, tool, surface]) => ({ capability, tool, surface })) },
    [{ uri: BASE, name: "Open PPT Anything", description: "Open the full workspace in the Codex Browser." }],
  ),
);

register(
  "open_ppt_anything",
  {
    title: "Open PPT Anything in the Codex Browser",
    description: "Start PPT Anything if needed and return the home or project workspace. After this tool returns, navigate its resource link in the in-editor Browser; do not only print the URL.",
    inputSchema: {
      projectId: z.string().optional().describe("Existing project id. Omit to open the home/create workspace."),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ projectId }) => {
    await ensureServer();
    const uri = browserUrl(projectId);
    return ok(
      `PPT Anything is ready at ${uri}. Open this resource now in the Codex in-editor Browser and keep it visible for interaction.`,
      { url: uri, projectId: projectId || null, browserAction: "navigate" },
      [{ uri, name: projectId ? "Open deck workspace" : "Open PPT Anything", description: "Live Codex-controllable presentation workspace." }],
    );
  },
);

register(
  "get_onboarding_questions",
  {
    title: "Generate deck onboarding questions",
    description: "Generate tailored questions for pages, audience, language, category, style, and content emphasis before making a deck.",
    inputSchema: { topic: z.string().min(1) },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ topic }, extra) => {
    const data = await postJson("/api/onboard", { requirement: topic }, extra.signal);
    return ok(`Generated ${data.questions?.length || 0} onboarding questions.`, data);
  },
);

register(
  "deep_research",
  {
    title: "Deep research a deck topic",
    description: "Run Codex web research and return a source-backed editable Markdown brief.",
    inputSchema: {
      topic: z.string().min(1),
      rounds: z.number().int().min(1).max(4).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ topic, rounds = 2 }, extra) => {
    let markdown = "";
    const queries = [];
    await postSse("/api/research", { requirement: topic, rounds }, (event) => {
      if (event.type === "doc") markdown = event.markdown || "";
      if (event.type === "search" && event.query) queries.push(event.query);
    }, extra.signal);
    return ok(markdown || "No research document was produced.", { topic, rounds, queries, markdown });
  },
);

const deckConfigShape = {
  topic: z.string().min(1).describe("What the deck is about"),
  pages: z.number().int().min(1).max(30).optional(),
  aspect: z.enum(["16:9", "4:3", "1:1", "9:16", "3:4"]).optional(),
  language: z.enum(["auto", "zh", "en", "ja"]).optional(),
  style: z.string().optional(),
  template: z.string().optional().describe("Template id from list_templates"),
  resolution: z.enum(["1K", "2K", "4K"]).optional(),
  materialIds: z.array(z.string()).optional().describe("Reference ids returned by upload_material"),
  fast: z.boolean().optional().describe("Render slide images concurrently with rate-limit-aware queuing"),
  research: z.boolean().optional(),
  researchDoc: z.string().optional().describe("An already-reviewed research brief"),
};

register(
  "create_deck",
  {
    title: "Create and render a complete deck",
    description: "Generate a complete image-native deck. Returns a project resource link that should be opened in the Codex Browser.",
    inputSchema: deckConfigShape,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async (args, extra) => {
    let researchDoc = args.researchDoc;
    if (args.research && !researchDoc?.trim()) {
      await postSse("/api/research", { requirement: args.topic, rounds: 2 }, (event) => {
        if (event.type === "doc") researchDoc = event.markdown;
      }, extra.signal);
    }
    let projectId = "";
    let title = "";
    let rendered = 0;
    let errored = 0;
    await postSse("/api/generate", {
      requirement: args.topic,
      pages: args.pages ?? 6,
      aspect: args.aspect ?? "16:9",
      language: args.language ?? "auto",
      style: args.style ?? "",
      template: args.template,
      resolution: args.resolution ?? "2K",
      materialIds: args.materialIds ?? [],
      engine: "codex",
      ...(args.fast ? { fast: true } : {}),
      ...(researchDoc ? { mode: "research", researchDoc } : {}),
    }, (event) => {
      if (event.type === "project") projectId = event.id;
      if (event.type === "outline") title = event.title;
      if (event.type === "page_rendered") rendered += 1;
      if (event.type === "page_error") errored += 1;
    }, extra.signal);
    if (!projectId) throw new Error("Generation finished without creating a project.");
    return ok(
      `Created “${title || args.topic}” (${rendered} rendered${errored ? `, ${errored} failed` : ""}). Open it now in the Codex Browser.`,
      { projectId, title, rendered, errored, previewUrl: browserUrl(projectId) },
      [projectLink(projectId)],
    );
  },
);

register(
  "create_outline",
  {
    title: "Create a draft deck outline",
    description: "Run optional research, generate an editable outline, and persist a draft without rendering slide images yet.",
    inputSchema: deckConfigShape,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async (args, extra) => {
    let projectId = "";
    let title = "";
    let outline = [];
    let researchDoc = args.researchDoc || "";
    await postSse("/api/outline", {
      requirement: args.topic,
      pages: args.pages ?? 6,
      aspect: args.aspect ?? "16:9",
      language: args.language ?? "auto",
      style: args.style ?? "",
      template: args.template,
      resolution: args.resolution ?? "2K",
      materialIds: args.materialIds ?? [],
      engine: "codex",
      ...(args.fast ? { fast: true } : {}),
      ...(args.research || researchDoc ? { mode: "research", researchDoc: researchDoc || undefined } : {}),
    }, (event) => {
      if (event.type === "project") projectId = event.id;
      if (event.type === "outline") {
        title = event.title;
        outline = event.outline || [];
      }
      if (event.type === "research" && event.markdown) researchDoc = event.markdown;
    }, extra.signal);
    if (!projectId) throw new Error("Outline generation finished without creating a draft.");
    return ok(
      `Created draft “${title || args.topic}” with ${outline.length} slides. Review or revise it before render_deck.`,
      { projectId, title, outline, researchDoc, previewUrl: browserUrl(projectId) },
      [projectLink(projectId, "Open draft outline")],
    );
  },
);

register(
  "revise_outline",
  {
    title: "Revise a deck outline",
    description: "Revise a draft outline with natural language, or replace it with an explicit ordered page list.",
    inputSchema: {
      projectId: z.string(),
      instruction: z.string().optional(),
      pages: z.array(z.object({ title: z.string(), points: z.array(z.string()).optional() })).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ projectId, instruction, pages }, extra) => {
    if (!instruction?.trim() && !pages?.length) throw new Error("Provide instruction or pages.");
    const data = pages?.length
      ? await apiJson(`/api/projects/${encodeURIComponent(projectId)}/outline`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages }),
          signal: extra.signal,
        })
      : await postJson(`/api/projects/${encodeURIComponent(projectId)}/outline`, { message: instruction }, extra.signal);
    return ok(
      data.reply || `Saved ${data.pages?.length || pages?.length || 0} outline pages.`,
      { projectId, ...data },
      [projectLink(projectId, "Review revised outline")],
    );
  },
);

register(
  "rank_inspiration",
  {
    title: "Rank visual inspiration",
    description: "Rank PPT Anything's community visual directions against a topic and outline.",
    inputSchema: {
      topic: z.string().optional(),
      outlineTitles: z.array(z.string()).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ topic = "", outlineTitles = [] }, extra) => {
    if (!topic.trim() && !outlineTitles.length) throw new Error("Provide topic or outlineTitles.");
    const data = await postJson("/api/inspire", { requirement: topic, outlineTitles }, extra.signal);
    return ok(`Ranked ${data.ranked?.length || 0} visual directions.`, data);
  },
);

register(
  "render_deck",
  {
    title: "Render a draft deck",
    description: "Render every confirmed draft page as an image, then return its Browser preview.",
    inputSchema: { projectId: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ projectId }, extra) => {
    let rendered = 0;
    let errored = 0;
    await postSse(`/api/projects/${encodeURIComponent(projectId)}/render`, {}, (event) => {
      if (event.type === "page_rendered") rendered += 1;
      if (event.type === "page_error") errored += 1;
    }, extra.signal);
    return ok(
      `Rendered ${rendered} slides${errored ? `; ${errored} failed` : ""}. Open the result in the Codex Browser.`,
      { projectId, rendered, errored, previewUrl: browserUrl(projectId) },
      [projectLink(projectId)],
    );
  },
);

register(
  "list_projects",
  {
    title: "List PPT Anything decks",
    description: "List existing decks with render state and Browser resource links.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const data = await apiJson("/api/projects");
    const projects = (data.projects || []).map((project) => ({ ...project, previewUrl: browserUrl(project.id) }));
    const lines = projects.map((project) => `- ${project.title} — ${project.rendered}/${project.total} slides — ${project.id}`);
    return ok(
      lines.join("\n") || "No PPT Anything decks yet.",
      { projects },
      projects.slice(0, 10).map((project) => projectLink(project.id, project.title)),
    );
  },
);

register(
  "get_project",
  {
    title: "Get a PPT Anything deck",
    description: "Read project configuration, outline, slide state, materials, and optional saved chat.",
    inputSchema: {
      projectId: z.string(),
      includeChat: z.boolean().optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ projectId, includeChat = false }) => {
    const project = await apiJson(`/api/projects/${encodeURIComponent(projectId)}`);
    if (!includeChat) delete project.chat;
    return ok(
      `“${project.title}” has ${project.pages?.length || 0} slides and is ${project.status || "ready"}.`,
      { project: { ...project, previewUrl: browserUrl(projectId) } },
      [projectLink(projectId)],
    );
  },
);

register(
  "list_templates",
  {
    title: "List PPT Anything templates",
    description: "List available deck categories and template ids for create_deck or restyle_deck.",
    inputSchema: { categoryId: z.string().optional() },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ categoryId }) => {
    const data = await apiJson("/api/templates");
    const templates = categoryId
      ? (data.templates || []).filter((template) => template.categoryId === categoryId)
      : data.templates || [];
    return ok(
      templates.map((template) => `- ${template.id} — ${template.name}: ${template.description}`).join("\n"),
      { categories: data.categories, templates },
    );
  },
);

register(
  "edit_deck",
  {
    title: "Edit a deck with natural language",
    description: "Plan and execute the same add/rewrite/redraw/optimize flow as the Deck Agent chat, including multi-slide edits.",
    inputSchema: {
      projectId: z.string(),
      instruction: z.string().min(1),
      slideIndex: z.number().int().min(1).optional(),
      materialIds: z.array(z.string()).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ projectId, instruction, slideIndex, materialIds = [] }, extra) => {
    const project = await apiJson(`/api/projects/${encodeURIComponent(projectId)}`);
    const contextPage = slideIndex ? project.pages?.find((page) => page.index === slideIndex) : undefined;
    const { plan } = await postJson(`/api/projects/${encodeURIComponent(projectId)}/chat`, {
      message: instruction,
      context: contextPage ? { slideIndex, title: contextPage.title } : undefined,
      attachmentIds: materialIds,
    }, extra.signal);
    const changed = [];
    if (plan.action === "add") {
      const afterIndex = Number.isInteger(plan.afterIndex) ? plan.afterIndex : project.pages.length;
      const added = await postJson(`/api/projects/${encodeURIComponent(projectId)}/slides`, { action: "add", afterIndex, title: plan.title }, extra.signal);
      const index = Math.min(Math.max(afterIndex + 1, 1), added.pages.length);
      const generated = await postJson(`/api/projects/${encodeURIComponent(projectId)}/regenerate`, {
        index,
        instruction: plan.instruction || instruction,
        title: plan.title,
      }, extra.signal);
      changed.push(slideSummary(generated.page));
    } else if (plan.action === "edit") {
      for (const index of plan.targets || []) {
        const generated = await postJson(`/api/projects/${encodeURIComponent(projectId)}/regenerate`, {
          index,
          instruction: plan.instruction || instruction,
          title: plan.targets?.length === 1 ? plan.title : undefined,
        }, extra.signal);
        changed.push(slideSummary(generated.page));
      }
    }
    return ok(
      `${plan.reply || "Deck request complete."}${changed.length ? ` Changed slide${changed.length === 1 ? "" : "s"} ${changed.map((page) => page.index).join(", ")}.` : ""}`,
      { projectId, plan, changed, previewUrl: browserUrl(projectId) },
      [projectLink(projectId, "Inspect edited deck")],
    );
  },
);

register(
  "restyle_deck",
  {
    title: "Restyle a whole deck",
    description: "Apply a template, free-text style, and reference materials; optionally redraw every slide.",
    inputSchema: {
      projectId: z.string(),
      template: z.string().optional(),
      style: z.string().optional(),
      materialIds: z.array(z.string()).optional(),
      redraw: z.boolean().optional().describe("Defaults to true"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ projectId, template, style, materialIds = [], redraw = true }, extra) => {
    const updated = await apiJson(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, style, materialIds }),
      signal: extra.signal,
    });
    const changed = [];
    if (redraw) {
      for (const page of updated.pages || []) {
        try {
          const generated = await postJson(`/api/projects/${encodeURIComponent(projectId)}/regenerate`, { index: page.index }, extra.signal);
          changed.push(slideSummary(generated.page));
        } catch (error) {
          changed.push({ index: page.index, status: "error", error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
    return ok(
      redraw ? `Restyled ${changed.filter((page) => page.status !== "error").length}/${updated.pages?.length || 0} slides.` : "Saved the new deck style without redrawing yet.",
      { projectId, template: updated.config?.template, style: updated.config?.style, changed, previewUrl: browserUrl(projectId) },
      [projectLink(projectId, "Inspect restyled deck")],
    );
  },
);

register(
  "manage_slide",
  {
    title: "Manage deck slide structure",
    description: "Add, duplicate, delete, or set the transition of a slide.",
    inputSchema: {
      projectId: z.string(),
      action: z.enum(["add", "duplicate", "delete", "transition"]),
      index: z.number().int().min(1).optional(),
      afterIndex: z.number().int().min(0).optional(),
      transition: z.enum(["none", "fade", "push", "wipe", "zoom", "flip"]).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  async ({ projectId, action, index, afterIndex, transition }, extra) => {
    if (["duplicate", "delete", "transition"].includes(action) && !index) throw new Error(`${action} requires index.`);
    if (action === "transition" && !transition) throw new Error("transition action requires transition.");
    const path = `/api/projects/${encodeURIComponent(projectId)}/slides`;
    const data = action === "delete"
      ? await apiJson(path, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index }),
          signal: extra.signal,
        })
      : await postJson(path, { action, index, afterIndex, transition }, extra.signal);
    return ok(
      `${action} complete. The deck now has ${data.pages?.length || 0} slides.`,
      { projectId, action, pages: (data.pages || []).map(slideSummary) },
      [projectLink(projectId)],
    );
  },
);

register(
  "regenerate_slide",
  {
    title: "Generate or regenerate one slide",
    description: "Draw a blank slide or redraw an existing slide with an optional instruction.",
    inputSchema: {
      projectId: z.string(),
      index: z.number().int().min(1),
      instruction: z.string().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ projectId, index, instruction }, extra) => {
    const data = await postJson(`/api/projects/${encodeURIComponent(projectId)}/regenerate`, { index, instruction }, extra.signal);
    return ok(
      `Slide ${index} is rendered.`,
      { projectId, page: slideSummary(data.page), previewUrl: browserUrl(projectId) },
      [projectLink(projectId, `Inspect slide ${index}`)],
    );
  },
);

register(
  "upload_material",
  {
    title: "Upload a deck reference",
    description: "Stage a local image, PDF, text, Markdown, CSV, or JSON file for use by create_deck, edit_deck, or restyle_deck.",
    inputSchema: { filePath: z.string().describe("Absolute or workspace-relative local file path") },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  async ({ filePath }, extra) => {
    const { form, absolute } = await fileForm(filePath, "file", 20 * 1024 * 1024);
    const response = await apiFetch("/api/materials", { method: "POST", body: form, signal: extra.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return ok(`Uploaded ${basename(absolute)} as material ${data.id}.`, { material: data, filePath: absolute });
  },
);

register(
  "upload_slide_image",
  {
    title: "Replace a slide with a local PNG",
    description: "Upload a normalized PNG as the visual for one slide. Use the Browser UI for JPG/WebP normalization.",
    inputSchema: {
      projectId: z.string(),
      index: z.number().int().min(1),
      imagePath: z.string(),
      title: z.string().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  async ({ projectId, index, imagePath, title }, extra) => {
    const { form, absolute, bytes } = await fileForm(imagePath, "image");
    if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("upload_slide_image requires a valid PNG.");
    form.set("image", new Blob([bytes], { type: "image/png" }), basename(absolute));
    if (title) form.append("title", title);
    const response = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/slides/${index}/image`, {
      method: "POST",
      body: form,
      signal: extra.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return ok(`Replaced slide ${index} with ${basename(absolute)}.`, { projectId, page: slideSummary(data.page) }, [projectLink(projectId)]);
  },
);

register(
  "mark_edit_slide",
  {
    title: "Edit a slide from an annotated PNG",
    description: "Cowart-style visual editing: persist an annotated slide screenshot, read its marks and note, and generate a clean revised slide.",
    inputSchema: {
      projectId: z.string(),
      index: z.number().int().min(1),
      annotatedImagePath: z.string(),
      note: z.string().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ projectId, index, annotatedImagePath, note = "" }, extra) => {
    const { form, absolute, bytes } = await fileForm(annotatedImagePath, "image");
    if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("mark_edit_slide requires a valid annotated PNG.");
    form.set("image", new Blob([bytes], { type: "image/png" }), basename(absolute));
    form.append("index", String(index));
    const sourceResponse = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/mark/source`, {
      method: "POST",
      body: form,
      signal: extra.signal,
    });
    const sourceData = await sourceResponse.json().catch(() => ({}));
    if (!sourceResponse.ok) throw new Error(sourceData.error || `HTTP ${sourceResponse.status}`);
    const editForm = new FormData();
    editForm.append("index", String(index));
    editForm.append("source", sourceData.image);
    editForm.append("note", note);
    const editResponse = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/mark`, {
      method: "POST",
      body: editForm,
      signal: extra.signal,
    });
    const editData = await editResponse.json().catch(() => ({}));
    if (!editResponse.ok) throw new Error(editData.error || `HTTP ${editResponse.status}`);
    return ok(
      `Applied the annotations to slide ${index}; the marked source remains saved as ${sourceData.image}.`,
      { projectId, markedSource: sourceData.image, page: slideSummary(editData.page), previewUrl: browserUrl(projectId) },
      [projectLink(projectId, `Inspect edited slide ${index}`)],
    );
  },
);

register(
  "export_deck",
  {
    title: "Export a PPT Anything deck",
    description: "Return a downloadable PDF or PPTX resource link for a rendered deck.",
    inputSchema: {
      projectId: z.string(),
      format: z.enum(["pdf", "pptx"]).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ projectId, format = "pdf" }) => {
    await apiJson(`/api/projects/${encodeURIComponent(projectId)}`);
    const uri = `${BASE}/api/projects/${encodeURIComponent(projectId)}/export?format=${format}`;
    return ok(
      `${format.toUpperCase()} export is ready: ${uri}`,
      { projectId, format, downloadUrl: uri },
      [{ uri, name: `Download ${format.toUpperCase()}`, description: `Exported ${format.toUpperCase()} presentation.` }],
    );
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
