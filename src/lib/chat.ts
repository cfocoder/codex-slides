// Conversational editing (M4): turn a natural-language edit into a concrete plan
// (which slides to change + the instruction). Execution reuses the validated
// per-slide regenerate route, so chat itself only classifies — it stays fast.

import { codexJson, parseLooseJson, type CodexInputAttachment } from "./codex-text";
import { runCliAgentText } from "./agents";
import type { AgentToolCall } from "./agentActivity";
import { buildDeckDesignSystemContext } from "./designSystem";
import { materialRolePrompt, scenarioPromptContext } from "./scenarios";
import type { DesignFileReference, Project } from "./types";

export interface ChatPlan {
  action: "edit" | "add" | "reply";
  reply: string;
  targets: number[]; // 1-based slide indices to regenerate
  afterIndex?: number; // add a new slide after this 1-based index; 0 = before slide 1
  title?: string; // exact resulting title when adding or explicitly retitling one slide
  instruction: string; // self-contained imperative change
  /** Real tool events captured from local CLI agents (Codex JSONL today). */
  activities?: AgentToolCall[];
}

export interface ChatSlideContext {
  slideIndex: number;
  title?: string;
}

export function buildChatPrompt(
  project: Project,
  message: string,
  context?: ChatSlideContext,
  attachments: CodexInputAttachment[] = [],
  designFiles: DesignFileReference[] = [],
): string {
  const slides = project.pages
    .map((p) => `${p.index}. ${p.title}${p.points?.length ? ` — ${p.points.join("; ")}` : ""}`)
    .join("\n");
  const selected = context
    ? project.pages.find((page) => page.index === context.slideIndex)
    : undefined;
  return [
    "You are the dedicated creation and editing agent for one presentation. Stay focused on making this deck better: create, insert, rewrite, redraw, restyle, reorder, or optimize slides.",
    "Here are the current slides:",
    slides,
    "",
    `The deck's overall topic: ${project.title}.`,
    scenarioPromptContext(project.config.scenarioId),
    materialRolePrompt(project.config.materialContexts),
    buildDeckDesignSystemContext(project.config.designSystem),
    selected
      ? `The user attached slide ${selected.index} as the active context: "${selected.title}"${selected.points?.length ? `. Its content includes: ${selected.points.join("; ")}` : ""}. References such as "this slide", "after this", "before it", "这页", "它后面" refer to this slide.`
      : "No slide is attached to this turn.",
    attachments.length
      ? `The user attached ${attachments.length} new context item(s) to this turn: ${attachments.map((item) => item.name).join(", ")}. Read and use the actual attached content when deciding the action and writing a self-contained instruction.`
      : "No new file or image is attached to this turn.",
    designFiles.length
      ? [
          "<design_file_references>",
          "The user explicitly referenced these local project files with @. Read only the files needed for this request and treat their contents as source material:",
          ...designFiles.map((file) => `- ${file.name}: ${file.path}`),
          "</design_file_references>",
        ].join("\n")
      : "No Design Files path was referenced with @ in this turn.",
    "",
    `The user says: "${message}"`,
    "",
    "Decide whether to edit existing slides, add one new slide, or just reply. Return ONLY this JSON:",
    '{"action": "edit|add|reply", "reply": "one short sentence back to the user", "targets": [slide numbers], "afterIndex": 0, "title": "short exact slide title when applicable", "instruction": "a self-contained imperative instruction"}',
    "",
    "Rules:",
    "- action=edit changes existing slides. Put their 1-based indices in targets and omit afterIndex.",
    "- action=add inserts exactly one new slide. targets=[] and afterIndex is the slide number it follows (0 means before slide 1). title must be the short exact title for the new slide. instruction must fully describe the new slide's role, content, and visual direction.",
    "- For action=edit, include title only when the user explicitly asks to rename/retitle exactly one target slide; otherwise omit it.",
    "- action=reply makes no deck change. targets=[] and omit afterIndex.",
    "- When an attached slide exists, resolve contextual wording against it. If the user asks to edit it, target that slide. If the user asks to add after it, afterIndex is that slide number. If they ask to add before it, afterIndex is one less.",
    "- If the user means the whole deck (all / 整体 / 全部 / every slide / restyle), targets = ALL slide numbers.",
    "- If they name a slide, a number, or a topic, resolve it to the matching slide number(s).",
    "- If the request is unrelated to this presentation, action=reply and briefly steer them back to creating or editing this deck.",
    "- If a presentation request is ambiguous, action=reply and ask one brief clarifying question.",
    "- instruction must be concrete and standalone (include the style/tone/content change explicitly). Keep on-slide text meaning unless the user asks to change it.",
    "- Treat <brand_design_system> as always-on project context. Preserve it for every action unless the user's latest message explicitly overrides a rule for the requested slide(s).",
    "- reply is short and in the user's language.",
  ].join("\n");
}

export function parseChatPlan(raw: any, pageCount: number): ChatPlan {
  const targetsRaw = Array.isArray(raw?.targets) ? raw.targets : [];
  const targets = Array.from(
    new Set(
      targetsRaw
        .map((n: any) => Math.trunc(Number(n)))
        .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= pageCount),
    ),
  ) as number[];
  const requestedAfter = Math.trunc(Number(raw?.afterIndex));
  const afterIndex = Number.isInteger(requestedAfter)
    ? Math.max(0, Math.min(pageCount, requestedAfter))
    : undefined;
  const rawAction = String(raw?.action ?? "").toLowerCase();
  const action: ChatPlan["action"] =
    rawAction === "add"
      ? "add"
      : rawAction === "edit" || targets.length
        ? "edit"
        : "reply";
  const title = String(raw?.title ?? "").trim().slice(0, 80);
  return {
    action,
    reply: String(raw?.reply ?? "Done."),
    targets: action === "edit" ? targets : [],
    afterIndex: action === "add" ? (afterIndex ?? pageCount) : undefined,
    title: action !== "reply" && title ? title : undefined,
    instruction: String(raw?.instruction ?? "").trim(),
  };
}

export async function planChatEdit(
  project: Project,
  message: string,
  context?: ChatSlideContext,
  attachments: CodexInputAttachment[] = [],
  designFiles: DesignFileReference[] = [],
  signal?: AbortSignal,
): Promise<ChatPlan> {
  const prompt = buildChatPrompt(project, message, context, attachments, designFiles);
  const localAttachments = attachments.filter((attachment) => attachment.path);
  const localPrompt = localAttachments.length
    ? [
        prompt,
        "",
        "Local context paths available for this turn:",
        ...localAttachments.map((attachment) => `- ${attachment.name}: ${attachment.path}`),
      ].join("\n")
    : prompt;
  if (project.config.engine === "codex") {
    const raw = await codexJson<any>(prompt, { signal, attachments });
    return parseChatPlan(raw, project.pages.length);
  }
  const result = await runCliAgentText(project.config.engine, localPrompt, { signal });
  return {
    ...parseChatPlan(parseLooseJson<any>(result.text), project.pages.length),
    activities: result.activities,
  };
}
