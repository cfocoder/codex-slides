// Shared domain types for ppt-anything.

export type Aspect = "16:9" | "4:3" | "1:1" | "9:16" | "3:4";
export type Language = "zh" | "en" | "ja" | "auto";
export type Resolution = "1K" | "2K" | "4K";
export type SlideTransition = "none" | "fade" | "push" | "wipe" | "zoom" | "flip";

/** Which engine drives the TEXT stages (outline + per-page copy). */
export type Engine = "codex" | "codex-cli" | "claude-cli" | "gemini-cli";

export interface PptConfig {
  requirement: string;
  aspect: Aspect;
  pages: number; // desired page count (a hint to the model)
  language: Language;
  style?: string; // free-text style / tone, e.g. "swiss international, indigo accent"
  resolution: Resolution;
  engine: Engine;
  template?: string; // DeckTemplate id (see lib/templates.ts); overrides/augments style
  materialIds?: string[]; // staged context-item ids (images and supported documents)
  mode?: "direct" | "research"; // deep-research mode seeds the outline from a research doc
  researchDoc?: string; // markdown research brief used as outline context (research mode)
  fast?: boolean; // fast mode: render every page in parallel (rate-limit-queued) instead of one-by-one
}

export interface MaterialRecord {
  id: string;
  name: string;
  file: string; // file name within the project's materials/ dir
  kind?: "image" | "file";
  mimeType?: string;
  size?: number;
  role?: "logo" | "reference" | "content" | "slide";
}

export interface ProjectFileRecord {
  path: string;
  name: string;
  kind: "document" | "image" | "data" | "code" | "other";
  source: "generated" | "uploaded";
  size: number;
  updatedAt: string;
  editable: boolean;
}

export const DEFAULT_CONFIG: PptConfig = {
  requirement: "",
  aspect: "16:9",
  pages: 6,
  language: "auto",
  style: "",
  resolution: "2K",
  engine: "codex",
};

export interface OutlinePage {
  title: string;
  points: string[];
}

export type SlideStatus = "pending" | "described" | "rendered" | "error";

export interface SlidePage {
  index: number; // 1-based
  title: string;
  points: string[];
  description?: string; // "页面文字" body used to compose the image
  imagePrompt?: string;
  image?: string; // file name relative to the project dir, e.g. "03.png"
  status: SlideStatus;
  error?: string;
  /** Presentation-mode transition used when this page becomes active. */
  transition?: SlideTransition;
}

/**
 * Lifecycle of a deck in the staged flow:
 *  - draft:     outline written, no slides rendered yet (awaiting confirm/edit)
 *  - rendering: per-slide image generation in progress
 *  - ready:     generation finished (has rendered slides)
 * Missing/undefined ⇒ treat as "ready" (back-compat for pre-staged project.json).
 */
export type ProjectStatus = "draft" | "rendering" | "ready";

/** A non-file choice attached to a user turn, displayed like other context. */
export interface ContextOptionItem {
  id: string;
  kind: "research" | "style" | "setting" | "speed";
  label: string;
  value?: string;
}

/** A persisted conversation turn (mirrors the client ChatMsg, JSON-safe). */
export interface StoredChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  ran?: string;
  doc?: {
    title: string;
    subtitle: string;
    icon?: string;
    pages?: { title: string; points: string[] }[];
  };
  attachment?: { slideIndex: number; title: string; imageUrl?: string };
  contextItems?: { id: string; name: string; url?: string; kind?: string }[];
  contextOptions?: ContextOptionItem[];
  suggestions?: string[];
  process?: {
    state: "running" | "complete" | "error";
    title: string;
    notes?: string[];
    tools: {
      id: string;
      name: string;
      label: string;
      detail?: string;
      state: "pending" | "running" | "complete" | "error";
    }[];
  };
  inspiration?: {
    query: string;
    coverIds: string[];
    total: number;
    chosen?: string;
    resolved?: boolean;
  };
  /** Provider-reported usage when available. Older/local turns can omit it; the
   *  client then labels its visible-output count as an estimate. */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    costUsd?: number;
    model?: string;
    estimated?: boolean;
  };
  ts?: number;
}

/** One independently managed conversation inside a presentation project. */
export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredChatMessage[];
}

export interface Project {
  id: string;
  createdAt: string;
  updatedAt: string;
  config: PptConfig;
  agent: string; // orchestrating agent actually used
  title: string;
  outline: OutlinePage[];
  pages: SlidePage[];
  materials?: MaterialRecord[];
  researchDoc?: string;
  status?: ProjectStatus;
  /** Full conversation history so reopening a project restores the dialogue. */
  chat?: StoredChatMessage[];
  /** Multi-session history. `chat` remains as a backwards-compatible mirror of
   *  the active conversation for older project files and API clients. */
  conversations?: StoredConversation[];
  activeConversationId?: string;
}

export interface DetectedAgent {
  id: string;
  label: string;
  vendor: string;
  bin: string;
  available: boolean;
  path?: string;
  /** true = usable as the text engine in this app */
  supported: boolean;
}

// ---- SSE progress events streamed by /api/generate, /api/outline, /api/.../render ----
export type ProgressEvent =
  | { type: "agent"; agent: string; engine: Engine }
  | { type: "project"; id: string }
  | { type: "research"; phase: "searching" | "synthesizing" | "brief"; detail?: string; markdown?: string }
  | { type: "outline"; outline: OutlinePage[]; title: string }
  | { type: "page_start"; index: number; total: number; title: string }
  | { type: "page_described"; index: number }
  | { type: "page_rendered"; index: number; image: string }
  | { type: "page_error"; index: number; error: string }
  | { type: "log"; message: string }
  | { type: "done"; id: string }
  | { type: "error"; error: string };
