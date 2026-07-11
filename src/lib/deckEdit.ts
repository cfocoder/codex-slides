// Client-side helpers shared by the home live workspace and /project/[id].
// Keeps per-slide editing ("逐页编辑") in one place so both surfaces behave the same.

import type { ContextItem } from "@/lib/contextItems";
import type { OutlinePage, PptConfig, ProgressEvent, SlideTransition } from "@/lib/types";

export interface UiSlide {
  index: number;
  title: string;
  status: "pending" | "working" | "described" | "rendered" | "error";
  image?: string;
  error?: string;
  bust?: number;
  transition?: SlideTransition;
}

/** Live activity shown in the chat column while the deck is being built or edited. */
export interface GenStatus {
  /** outlining → planning the deck; rendering → drawing pages; editing → applying an edit. */
  phase: "outlining" | "rendering" | "editing";
  total: number;
  done: number;
  /** 1-based index of the slide currently being drawn, if any. */
  current?: number;
  currentTitle?: string;
  /** short label for the editing phase, e.g. "Re-tuning the whole deck". */
  note?: string;
}

/** Derive the live GenStatus from slide state. Returns null when idle. */
export function deriveStatus(
  slides: UiSlide[],
  opts: { streaming?: boolean; editing?: boolean; note?: string } = {},
): GenStatus | null {
  const { streaming, editing, note } = opts;
  if (!streaming && !editing) return null;
  const done = slides.filter((s) => s.status === "rendered").length;
  const workingList = slides.filter((s) => s.status === "working");
  const working = workingList[0];
  if (streaming && slides.length === 0) {
    return { phase: "outlining", total: 0, done: 0 };
  }
  // Fast mode draws several pages at once; surface that instead of a single
  // "Drawing slide N" line so the card matches what the filmstrip shows.
  const parallelNote =
    !note && !editing && workingList.length > 1
      ? `并行绘制 ${workingList.length} 页中…`
      : note;
  return {
    phase: editing && !streaming ? "editing" : "rendering",
    total: slides.length,
    done,
    current: working?.index,
    currentTitle: working?.title,
    note: parallelNote,
  };
}

export function fileUrl(projectId: string, name?: string, bust?: number) {
  if (!projectId || !name) return "";
  return `/api/files/${projectId}/${name}${bust ? `?t=${bust}` : ""}`;
}

// ---- staged flow: outline (step 2-4) then render (step 5) ----------------

/** Parse an SSE stream of ProgressEvent JSON frames (`data: {...}\n\n`). */
export async function readSSE(
  resp: Response,
  onEvent: (ev: ProgressEvent) => void,
): Promise<void> {
  if (!resp.ok || !resp.body) {
    throw new Error((await resp.text().catch(() => "")) || `HTTP ${resp.status}`);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as ProgressEvent);
      } catch {
        /* ignore a malformed frame */
      }
    }
  }
}

/** Step 2: run (optional research +) outline generation → draft project. */
export async function streamOutline(
  config: PptConfig,
  onEvent: (ev: ProgressEvent) => void,
): Promise<void> {
  const resp = await fetch("/api/outline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  await readSSE(resp, onEvent);
}

/** Step 5: render the confirmed draft's slides, one image per slide. */
export async function streamRender(
  projectId: string,
  onEvent: (ev: ProgressEvent) => void,
): Promise<void> {
  const resp = await fetch(`/api/projects/${projectId}/render`, { method: "POST" });
  await readSSE(resp, onEvent);
}

/** Inspiration step: codex-rank the community style catalog for this deck. */
export async function rankInspire(
  requirement: string,
  outlineTitles: string[],
): Promise<{ ranked: string[]; reasons: Record<string, string> }> {
  const r = await fetch("/api/inspire", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirement, outlineTitles }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || `HTTP ${r.status}`);
  }
  return r.json();
}

/** Apply a picked template/style to the draft before rendering (inspiration step). */
export async function patchProjectStyle(
  projectId: string,
  patch: { template?: string | null; style?: string },
): Promise<void> {
  const r = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || `HTTP ${r.status}`);
  }
}

/** Persist an edited draft outline (title/points/order). */
export async function saveOutline(projectId: string, pages: OutlinePage[]): Promise<void> {
  const r = await fetch(`/api/projects/${projectId}/outline`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pages }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || `HTTP ${r.status}`);
  }
}

/** Persist the conversation so reopening the project restores the dialogue. */
export async function saveChat(projectId: string, messages: unknown[]): Promise<void> {
  try {
    await fetch(`/api/projects/${projectId}/chat`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
  } catch {
    /* best-effort; the live chat state is the source of truth in-session */
  }
}

/** Persist all conversations plus the active selection. The server keeps
 *  `project.chat` mirrored to the active messages for backwards compatibility. */
export async function saveConversations(
  projectId: string,
  conversations: unknown[],
  activeConversationId: string,
): Promise<void> {
  try {
    await fetch(`/api/projects/${projectId}/chat`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversations, activeConversationId }),
    });
  } catch {
    /* best-effort; the live conversation state remains authoritative in-session */
  }
}

/** Natural-language outline revision during the draft/edit stage. */
export async function reviseOutlineChat(
  projectId: string,
  message: string,
): Promise<{ pages: OutlinePage[]; reply: string }> {
  const r = await fetch(`/api/projects/${projectId}/outline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  const pages: OutlinePage[] = (d.pages ?? []).map((p: any) => ({
    title: String(p.title ?? ""),
    points: Array.isArray(p.points) ? p.points.map((x: any) => String(x)) : [],
  }));
  return { pages, reply: String(d.reply ?? "") };
}

function toUiSlide(page: any): UiSlide {
  return {
    index: Number(page.index),
    title: String(page.title ?? `Slide ${page.index}`),
    status: page.status as UiSlide["status"],
    image: page.image || undefined,
    error: page.error || undefined,
    bust: Date.now(),
    transition: page.transition ?? "none",
  };
}

async function slideAction(
  projectId: string,
  method: "POST" | "DELETE",
  body: Record<string, unknown>,
): Promise<UiSlide[]> {
  const response = await fetch(`/api/projects/${projectId}/slides`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return (data.pages ?? []).map(toUiSlide);
}

export function addProjectSlide(projectId: string, afterIndex?: number, title?: string): Promise<UiSlide[]> {
  return slideAction(projectId, "POST", { action: "add", afterIndex, title });
}

export function duplicateProjectSlide(projectId: string, index: number): Promise<UiSlide[]> {
  return slideAction(projectId, "POST", { action: "duplicate", index });
}

export function deleteProjectSlide(projectId: string, index: number): Promise<UiSlide[]> {
  return slideAction(projectId, "DELETE", { index });
}

export function setProjectSlideTransition(
  projectId: string,
  index: number,
  transition: SlideTransition,
): Promise<UiSlide[]> {
  return slideAction(projectId, "POST", { action: "transition", index, transition });
}

export async function generateSingleSlide(
  projectId: string,
  index: number,
  instruction: string,
  title?: string,
): Promise<UiSlide> {
  const response = await fetch(`/api/projects/${projectId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index, instruction, title }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return toUiSlide(data.page);
}

export async function uploadProjectSlide(
  projectId: string,
  index: number,
  image: Blob,
  title: string,
): Promise<UiSlide> {
  const form = new FormData();
  form.append("image", image, "slide.png");
  form.append("title", title);
  const response = await fetch(`/api/projects/${projectId}/slides/${index}/image`, {
    method: "POST",
    body: form,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return toUiSlide(data.page);
}

/** Regenerate a single slide, optionally with an edit instruction. Returns new image name. */
export async function regenerateSlide(
  projectId: string,
  index: number,
  instruction?: string,
  title?: string,
): Promise<string> {
  const r = await fetch(`/api/projects/${projectId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index, instruction: instruction || undefined, title: title || undefined }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d.page.image as string;
}

/** Save the exact marked-up canvas so chat and the editor share one immutable input. */
export async function saveMarkSource(
  projectId: string,
  index: number,
  blob: Blob,
): Promise<string> {
  const fd = new FormData();
  fd.append("index", String(index));
  fd.append("image", blob, "mark.png");
  let response: Response;
  try {
    response = await fetch(`/api/projects/${projectId}/mark/source`, { method: "POST", body: fd });
  } catch {
    throw new Error("Connection to the local server was interrupted.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  if (!data.image) throw new Error("The marked image snapshot was not saved.");
  return String(data.image);
}

/** Submit a persisted marked-up canvas edit for a slide. Returns new image name. */
export async function markSlide(
  projectId: string,
  index: number,
  source: string,
  note: string,
): Promise<string> {
  const fd = new FormData();
  fd.append("index", String(index));
  fd.append("note", note);
  fd.append("source", source);
  let r: Response;
  try {
    r = await fetch(`/api/projects/${projectId}/mark`, { method: "POST", body: fd });
  } catch {
    throw new Error("Connection to the local server was interrupted.");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  if (!d.page?.image) throw new Error("The mark edit completed without an image.");
  return d.page.image as string;
}

export interface ChatPlan {
  action: "edit" | "add" | "reply";
  reply: string;
  targets: number[];
  afterIndex?: number;
  title?: string;
  instruction: string;
}

export interface SlideChatContext {
  slideIndex: number;
  title: string;
  imageUrl?: string;
}

export interface ChatRequest {
  message: string;
  context?: SlideChatContext;
  attachments?: ContextItem[];
}

/** Ask the agent to turn an NL edit into a plan (which slides + how). */
export async function planChatEdit(
  projectId: string,
  message: string,
  context?: SlideChatContext,
  attachments: ContextItem[] = [],
): Promise<ChatPlan> {
  const r = await fetch(`/api/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      context,
      attachmentIds: attachments.map((item) => item.id),
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d.plan as ChatPlan;
}
