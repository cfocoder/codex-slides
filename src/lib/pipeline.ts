// The closed loop: requirement -> outline -> per-page copy -> per-slide image.
//
//  - TEXT stages run on the selected engine: the zero-config Codex Responses
//    endpoint (engine "codex") OR a detected local agent CLI (codex/claude/gemini).
//  - IMAGE stages always run on Codex's zero-config image backend.
//  - One image call per slide (the html-video lesson: never ask for the whole
//    deck in one shot), each isolated so one failure doesn't sink the deck.

import { generateSlideImage } from "./codex-image";
import { codexJson, codexText, parseLooseJson, type CodexInputAttachment } from "./codex-text";
import { runCliAgentText } from "./agents";
import {
  attachMaterialsToProject,
  loadProjectInputAttachments,
  loadProjectMaterialBuffers,
  loadStagedInputAttachments,
} from "./materials";
import {
  buildImagePrompt,
  buildMarkEditPrompt,
  buildOutlinePrompt,
  buildOutlineRevisePrompt,
  buildPageDescriptionPrompt,
  extractSlideText,
} from "./prompts";
import {
  loadProject,
  newProjectId,
  replaceProjectPages,
  saveProject,
  saveSlideImage,
} from "./store";
import type {
  Engine,
  OutlinePage,
  PptConfig,
  ProgressEvent,
  Project,
  SlidePage,
} from "./types";

type Emit = (e: ProgressEvent) => void;

async function generateText(
  engine: Engine,
  prompt: string,
  opts: { json?: boolean; signal?: AbortSignal; attachments?: CodexInputAttachment[] } = {},
): Promise<string> {
  if (engine === "codex") {
    return opts.json
      ? JSON.stringify(await codexJson(prompt, { signal: opts.signal, attachments: opts.attachments }))
      : codexText(prompt, { signal: opts.signal, attachments: opts.attachments });
  }
  const localItems = (opts.attachments ?? []).filter((item) => item.path);
  const localPrompt = localItems.length
    ? [
        prompt,
        "",
        "The user attached these context items. Read them from disk and use their contents and visuals when answering:",
        ...localItems.map((item) => `- ${item.name}: ${item.path}`),
      ].join("\n")
    : prompt;
  const { text } = await runCliAgentText(engine, localPrompt, { signal: opts.signal });
  return text;
}

async function generateJson<T>(
  engine: Engine,
  prompt: string,
  signal?: AbortSignal,
  attachments?: CodexInputAttachment[],
): Promise<T> {
  const text = await generateText(engine, prompt, { json: engine === "codex", signal, attachments });
  return parseLooseJson<T>(text);
}

function normalizeOutline(raw: any): OutlinePage[] {
  // Accept [{title,points}] or {slides:[...]} / {outline:[...]}
  const arr = Array.isArray(raw) ? raw : raw?.slides ?? raw?.outline ?? raw?.pages ?? [];
  return (arr as any[])
    .map((p) => ({
      title: String(p?.title ?? p?.heading ?? "").trim(),
      points: Array.isArray(p?.points)
        ? p.points.map((x: any) => String(x).trim()).filter(Boolean)
        : [],
    }))
    .filter((p) => p.title);
}

export interface RunOptions {
  signal?: AbortSignal;
}

function outlineToPages(outline: OutlinePage[]): SlidePage[] {
  return outline.map((o, i) => ({
    index: i + 1,
    title: o.title,
    points: [...o.points],
    status: "pending" as const,
  }));
}

/**
 * Stage 1 only (搜索/写大纲 → 草稿): write the outline and persist a DRAFT project
 * with every slide still `pending`. No images are drawn yet — the caller can let
 * the user edit and confirm the outline before rendering. Emits `project` + `outline`.
 */
export async function planOutline(
  config: PptConfig,
  emit: Emit,
  opts: RunOptions = {},
): Promise<Project> {
  const { signal } = opts;
  const engineLabel = config.engine;
  emit({ type: "agent", agent: engineLabel, engine: config.engine });

  emit({ type: "log", message: "Writing the outline…" });
  const stagedAttachments = loadStagedInputAttachments(config.materialIds);
  const outlineRaw = await generateJson<any>(
    config.engine,
    buildOutlinePrompt(config),
    signal,
    stagedAttachments,
  );
  const outline = normalizeOutline(outlineRaw);
  if (!outline.length) throw new Error("Outline generation returned no slides");

  const title = outline[0]?.title || config.requirement.slice(0, 40) || "Untitled deck";
  const id = newProjectId(title);
  const now = new Date().toISOString();
  const project: Project = {
    id,
    createdAt: now,
    updatedAt: now,
    config,
    agent: engineLabel,
    title,
    outline,
    pages: outlineToPages(outline),
    researchDoc: config.researchDoc,
    status: "draft",
  };
  // Copy staged context items into the project now so the draft owns them durably
  // (the user may spend minutes editing the outline before rendering).
  if (config.materialIds?.length) {
    project.materials = attachMaterialsToProject(id, config.materialIds);
  }
  saveProject(project);
  emit({ type: "project", id });
  emit({ type: "outline", outline, title });
  return project;
}

/**
 * Stages 2+3 (一页页生成): render every not-yet-rendered slide of an existing
 * project, one image per slide, each isolated so one failure doesn't sink the deck.
 * Sets status rendering → ready. Emits `page_*` + `done`.
 */
export async function renderProject(
  id: string,
  emit: Emit,
  opts: RunOptions = {},
): Promise<Project> {
  const { signal } = opts;
  const project = loadProject(id);
  if (!project) throw new Error("project not found");
  const { config } = project;

  const materialBuffers = loadProjectMaterialBuffers(id, project.materials);
  const projectAttachments = loadProjectInputAttachments(id, project.materials);
  if (projectAttachments.length) {
    emit({ type: "log", message: `Using ${projectAttachments.length} context item(s)` });
  }
  const hasMaterials = materialBuffers.length > 0;

  project.status = "rendering";
  saveProject(project);

  const total = project.pages.length;
  for (const page of project.pages) {
    if (signal?.aborted) throw new Error("aborted");
    if (page.status === "rendered") continue;
    emit({ type: "page_start", index: page.index, total, title: page.title });
    try {
      const descPrompt = buildPageDescriptionPrompt(config, project.outline, page, page.index, total);
      const descRaw = await generateText(config.engine, descPrompt, {
        signal,
        attachments: projectAttachments,
      });
      page.description = extractSlideText(descRaw);
      page.status = "described";
      saveProject(project);
      emit({ type: "page_described", index: page.index });

      const imgPrompt = buildImagePrompt(config, page, page.index, total, hasMaterials);
      page.imagePrompt = imgPrompt;
      const bytes = await generateSlideImage(imgPrompt, {
        refImages: materialBuffers,
        aspect: config.aspect,
        resolution: config.resolution,
        signal,
      });
      page.image = saveSlideImage(id, page.index, bytes);
      page.status = "rendered";
      saveProject(project);
      emit({ type: "page_rendered", index: page.index, image: page.image });
    } catch (e: any) {
      page.status = "error";
      page.error = String(e?.message ?? e);
      saveProject(project);
      emit({ type: "page_error", index: page.index, error: page.error });
    }
  }

  project.status = "ready";
  saveProject(project);
  emit({ type: "done", id });
  return project;
}

/**
 * Full one-shot generation (outline → render), kept for `/api/generate` and the
 * Codex MCP plugin. The staged web flow uses planOutline + renderProject instead.
 */
export async function runGeneration(
  config: PptConfig,
  emit: Emit,
  opts: RunOptions = {},
): Promise<Project> {
  const project = await planOutline(config, emit, opts);
  return renderProject(project.id, emit, opts);
}

/**
 * Rewrite a DRAFT project's outline from a natural-language instruction (编辑大纲
 * via chat). Returns the new pages + a short reply. Drops any images and keeps the
 * project a draft, since a changed outline invalidates rendered slides.
 */
export async function reviseOutline(
  id: string,
  instruction: string,
  signal?: AbortSignal,
): Promise<{ pages: SlidePage[]; reply: string }> {
  const project = loadProject(id);
  if (!project) throw new Error("project not found");
  const raw = await generateJson<any>(
    project.config.engine,
    buildOutlineRevisePrompt(project, instruction),
    signal,
  );
  const outline = normalizeOutline(raw?.outline ?? raw);
  if (!outline.length) throw new Error("Outline revision returned no slides");
  project.status = "draft";
  replaceProjectPages(project, outlineToPages(outline));
  const reply = String(raw?.reply ?? "已更新大纲。").trim() || "已更新大纲。";
  return { pages: project.pages, reply };
}

// ---- multi-round edits -------------------------------------------------

/** Regenerate one slide from scratch, optionally folding in an edit instruction. */
export async function regeneratePage(
  id: string,
  index: number,
  instruction?: string,
  signal?: AbortSignal,
): Promise<SlidePage> {
  const project = loadProject(id);
  if (!project) throw new Error("project not found");
  const page = project.pages.find((p) => p.index === index);
  if (!page) throw new Error("page not found");
  const total = project.pages.length;
  const projectAttachments = loadProjectInputAttachments(id, project.materials);

  if (instruction) {
    const isBlank = !page.image && page.status === "pending" && page.points.length === 0;
    if (isBlank) {
      page.title = instruction.trim().slice(0, 80) || `Slide ${index}`;
      page.points = [instruction.trim()];
      project.outline[index - 1] = { title: page.title, points: [...page.points] };
    } else {
      page.points = [...page.points, `(edit) ${instruction}`];
    }
  }
  const descPrompt = buildPageDescriptionPrompt(
    project.config,
    project.outline,
    page,
    index,
    total,
  );
  const descRaw = await generateText(project.config.engine, descPrompt, {
    signal,
    attachments: projectAttachments,
  });
  page.description = extractSlideText(descRaw);

  const materialBuffers = loadProjectMaterialBuffers(id, project.materials);
  const imgPrompt = buildImagePrompt(project.config, page, index, total, materialBuffers.length > 0);
  page.imagePrompt = imgPrompt;
  const bytes = await generateSlideImage(imgPrompt, {
    refImages: materialBuffers,
    aspect: project.config.aspect,
    resolution: project.config.resolution,
    signal,
  });
  page.image = saveSlideImage(id, index, bytes);
  page.status = "rendered";
  page.error = undefined;
  saveProject(project);
  return page;
}

/**
 * Mark-driven edit (cowart-style): the annotated screenshot is passed as a
 * reference image; the model returns a clean, revised slide honoring the marks.
 */
export async function markEditPage(
  id: string,
  index: number,
  annotatedPng: Buffer,
  note: string,
  signal?: AbortSignal,
): Promise<SlidePage> {
  const project = loadProject(id);
  if (!project) throw new Error("project not found");
  const page = project.pages.find((p) => p.index === index);
  if (!page) throw new Error("page not found");

  const prompt = buildMarkEditPrompt(project.config, note);
  const bytes = await generateSlideImage(prompt, {
    // The annotation canvas already contains the complete original slide. A
    // second, clean copy used to compete with it and frequently made the model
    // return the untouched original instead of following the red marks.
    refImages: [annotatedPng],
    aspect: project.config.aspect,
    resolution: project.config.resolution,
    signal,
  });
  page.image = saveSlideImage(id, index, bytes);
  page.status = "rendered";
  page.error = undefined;
  saveProject(project);
  return page;
}
