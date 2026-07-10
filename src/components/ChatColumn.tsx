"use client";

import {
  ArrowsOut,
  CheckCircle,
  Circle,
  CircleNotch,
  CrosshairSimple,
  Plus,
  SidebarSimple,
  Wrench,
  XCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ContextItems from "@/components/ContextItems";
import ContextOptionItems from "@/components/ContextOptionItems";
import ImagePreviewDialog from "@/components/ImagePreviewDialog";
import {
  CONTEXT_ITEM_ACCEPT,
  mergeContextItems,
  uploadContextItems,
  type ContextItem,
} from "@/lib/contextItems";
import type { ChatRequest, GenStatus, SlideChatContext } from "@/lib/deckEdit";
import type { AgentProcess } from "@/lib/agentActivity";
import { getCommunityTemplate } from "@/lib/community";
import { shouldSubmitTextarea } from "@/lib/keyboard";
import type { ContextOptionItem } from "@/lib/types";

export interface ChatMsg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  ran?: string; // e.g. "Ran for 1m 45s" meta line
  doc?: { title: string; subtitle: string; icon?: string };
  attachment?: SlideChatContext;
  contextItems?: ContextItem[];
  contextOptions?: ContextOptionItem[];
  /** Clickable next-step chips (step 6 guidance); clicking sends the text as a follow-up. */
  suggestions?: string[];
  process?: AgentProcess;
  /** Inspiration step (参考灵感): an in-chat card with a Browse button that opens
   *  the style picker popup, or resolves to a chosen/skipped state after render. */
  inspiration?: {
    query: string;
    coverIds: string[];
    total: number;
    chosen?: string;
    resolved?: boolean;
  };
  ts?: number;
}

function SlideAttachment({
  slide,
  compact = false,
  onSelectSlide,
}: {
  slide: SlideChatContext;
  compact?: boolean;
  onSelectSlide?: (index: number) => void;
}) {
  const fallbackTitle = `Slide ${slide.slideIndex}`;
  const showTitle = slide.title.trim().toLocaleLowerCase() !== fallbackTitle.toLocaleLowerCase();
  const [imageFailed, setImageFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => setImageFailed(false), [slide.imageUrl]);
  return (
    <div className={`slide-attachment${compact ? " compact" : ""}`}>
      <button
        type="button"
        className="slide-attachment-thumb"
        disabled={!slide.imageUrl || imageFailed}
        onClick={() => setPreviewOpen(true)}
        aria-label={`Preview ${fallbackTitle}`}
      >
        {slide.imageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageUrl} alt="" onError={() => setImageFailed(true)} />
        ) : (
          <span className="slide-attachment-placeholder" aria-hidden="true">▦</span>
        )}
        {slide.imageUrl && !imageFailed && <span className="slide-preview-glyph" aria-hidden="true"><ArrowsOut size={12} /></span>}
      </button>
      <button
        type="button"
        className="slide-attachment-locate"
        onClick={() => (onSelectSlide ? onSelectSlide(slide.slideIndex) : setPreviewOpen(true))}
        aria-label={onSelectSlide ? `Go to ${fallbackTitle}` : `Preview ${fallbackTitle}`}
      >
        <span className="slide-attachment-copy">
          <b>{fallbackTitle}</b>
          {showTitle && <small>{slide.title}</small>}
        </span>
        {onSelectSlide && <CrosshairSimple size={15} aria-hidden="true" />}
      </button>
      {previewOpen && slide.imageUrl && (
        <ImagePreviewDialog
          src={slide.imageUrl}
          title={fallbackTitle}
          subtitle={showTitle ? slide.title : undefined}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

/** In-chat inspiration card (Image #10): topic-matched cover thumbnails + a
 *  Browse button that opens the style popup. After the user picks or skips it
 *  collapses to a resolved summary line. */
function InspirationCard({
  inspiration,
  onInspire,
}: {
  inspiration: NonNullable<ChatMsg["inspiration"]>;
  onInspire?: (action: "browse" | "skip") => void;
}) {
  const { query, coverIds, total, chosen, resolved } = inspiration;
  const chosenName = chosen ? getCommunityTemplate(chosen)?.name : undefined;
  const extra = Math.max(0, total - coverIds.length);
  return (
    <div className={`inspo-card${resolved ? " resolved" : ""}`}>
      <div className="inspo-head">
        <span className="inspo-ic" aria-hidden="true">
          ✦
        </span>
        <span className="inspo-copy">
          <b>视觉参考灵感</b>
          <small>
            {resolved
              ? chosen
                ? `已选：${chosenName ?? "自定义风格"}`
                : "已跳过 · 使用默认风格"
              : `${total} 个风格 · 匹配「${query}」`}
          </small>
        </span>
        {!resolved && onInspire && (
          <button type="button" className="inspo-browse" onClick={() => onInspire("browse")}>
            浏览
          </button>
        )}
      </div>
      <div className="inspo-thumbs" aria-hidden="true">
        {coverIds.map((id) => {
          const t = getCommunityTemplate(id);
          return t ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} src={t.cover} alt="" loading="lazy" />
          ) : null;
        })}
        {extra > 0 && <span className="inspo-more">+{extra}</span>}
      </div>
      {!resolved && onInspire && (
        <div className="inspo-actions">
          <button type="button" className="inspo-skip" onClick={() => onInspire("skip")}>
            跳过
          </button>
        </div>
      )}
    </div>
  );
}

function AgentProcessCard({ process }: { process: AgentProcess }) {
  return (
    <div className={`agent-process ${process.state}`} role="status" aria-live="polite">
      <div className="agent-process-head">
        <span className="agent-process-state" aria-hidden="true">
          {process.state === "running" ? (
            <CircleNotch size={16} className="spin" />
          ) : process.state === "complete" ? (
            <CheckCircle size={16} weight="fill" />
          ) : (
            <XCircle size={16} weight="fill" />
          )}
        </span>
        <strong>{process.title}</strong>
        <span>{process.state === "running" ? "Working" : process.state === "complete" ? "Done" : "Stopped"}</span>
      </div>
      {process.notes?.length ? (
        <div className="agent-process-notes">
          {process.notes.map((note, index) => <p key={index}>{note}</p>)}
        </div>
      ) : null}
      {process.tools.length ? (
        <div className="agent-tools" aria-label="Tool calls">
          {process.tools.map((tool) => (
            <div className={`agent-tool ${tool.state}`} key={tool.id}>
              <span className="agent-tool-icon" aria-hidden="true">
                {tool.state === "running" ? (
                  <CircleNotch size={14} className="spin" />
                ) : tool.state === "complete" ? (
                  <CheckCircle size={14} weight="fill" />
                ) : tool.state === "error" ? (
                  <XCircle size={14} weight="fill" />
                ) : (
                  <Circle size={14} />
                )}
              </span>
              <span className="agent-tool-copy">
                <span><Wrench size={12} aria-hidden="true" /><code>{tool.name}</code></span>
                <strong>{tool.label}</strong>
                {tool.detail && <small>{tool.detail}</small>}
              </span>
              <span className="agent-tool-status">
                {tool.state === "running" ? "Running" : tool.state === "complete" ? "Done" : tool.state === "error" ? "Failed" : "Waiting"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const PHASE_LABEL: Record<GenStatus["phase"], string> = {
  outlining: "Planning the deck…",
  rendering: "Drawing slides…",
  editing: "Applying your edit…",
};

/** Live progress card pinned to the bottom of the feed while work is in flight. */
function StatusCard({ status }: { status: GenStatus }) {
  const { phase, total, done, current, currentTitle, note } = status;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const detail = note
    ? note
    : current
      ? `Drawing slide ${current}${currentTitle ? ` — ${currentTitle}` : ""}`
      : phase === "editing"
        ? "Working out the edit…"
        : phase === "outlining"
          ? "Outlining the deck"
          : "Rendering pages";

  return (
    <div className="genstatus" role="status" aria-live="polite">
      <div className="genstatus-head">
        <span className="genstatus-title">
          <span className="pulse-dot" /> {PHASE_LABEL[phase]}
        </span>
        {total > 0 && <span className="genstatus-count">{done} / {total}</span>}
      </div>

      {total > 0 && (
        <div className="genbar" aria-hidden>
          <i style={{ width: `${Math.max(pct, done > 0 ? 6 : 4)}%` }} />
        </div>
      )}

      <div className="gensteps">
        {phase !== "editing" && (
          <div className={`genstep ${phase === "outlining" ? "active" : "done"}`}>
            <span className="dot">{phase === "outlining" ? "⟳" : "✓"}</span>
            <span>{phase === "outlining" ? "Outlining the deck" : "Outline ready"}</span>
          </div>
        )}
        <div className="genstep active">
          <span className="dot">⟳</span>
          <span>{detail}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Left conversation column of the workspace. Renders the agent narrative + user
 * turns, a live status card while generating, queued follow-ups, and a composer.
 * Follow-ups can be typed during generation — the parent queues them and runs
 * them when work finishes (multi-round dialogue).
 */
export default function ChatColumn({
  label = "Slides",
  messages,
  busy,
  onSend,
  status = null,
  queued = [],
  placeholder = "Ask for an edit — e.g. “make slide 2 warmer”",
  homeHref,
  context = null,
  onClearContext,
  focusKey = 0,
  onSelectSlide,
  onInspire,
}: {
  label?: string;
  messages: ChatMsg[];
  busy: boolean;
  onSend?: (request: ChatRequest) => void | Promise<void>;
  /** live activity to surface as a pinned status card (null = idle) */
  status?: GenStatus | null;
  /** follow-ups the user queued while work was in flight */
  queued?: ChatRequest[];
  placeholder?: string;
  /** Optional compact product link used when the workspace is a standalone page. */
  homeHref?: string;
  /** Slide attached by the per-page Ask AI action. */
  context?: SlideChatContext | null;
  onClearContext?: () => void;
  /** Increment to move keyboard focus into the deck-agent composer. */
  focusKey?: number;
  /** Select and reveal a slide when a chat attachment is clicked. */
  onSelectSlide?: (index: number) => void;
  /** Inspiration card actions: open the Browse popup, or skip the style step. */
  onInspire?: (action: "browse" | "skip") => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ContextItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, status, queued.length]);

  useEffect(() => {
    if (!focusKey) return;
    textareaRef.current?.focus();
  }, [focusKey]);

  async function addFiles(files: Iterable<File>) {
    const selected = Array.from(files);
    if (!selected.length) return;
    setUploading(true);
    setUploadError("");
    const result = await uploadContextItems(selected);
    if (result.items.length) setAttachments((current) => mergeContextItems(current, result.items));
    if (result.errors.length) setUploadError(result.errors.join(" · "));
    setUploading(false);
  }

  function submit() {
    const m = text.trim() || (attachments.length ? "Use the attached context for this presentation." : "");
    if (!m || !onSend || uploading) return; // allowed while busy → parent queues it
    setText("");
    onSend({ message: m, context: context ?? undefined, attachments });
    setAttachments([]);
    setUploadError("");
    onClearContext?.();
  }

  // Typing dots only when we're waiting on a reply and have no richer status card.
  const waiting = busy && !status && messages[messages.length - 1]?.role === "user";

  return (
    <aside className={`chatcol${collapsed ? " collapsed" : ""}`}>
      <div className="chatcol-head">
        <div className="chatcol-head-main">
          {homeHref && (
            <>
              <Link className="workspace-home" href={homeHref} aria-label="Back to projects">
                <span className="glyph" aria-hidden="true">◈</span>
                <span>PPT Anything</span>
              </Link>
              <span className="workspace-head-sep" aria-hidden="true" />
            </>
          )}
          <span className="chatcol-title">▦ {label}</span>
        </div>
        <div className="chatcol-head-actions">
          {busy && <span className="chatcol-live">working</span>}
          <button
            type="button"
            className="chatcol-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand conversation panel" : "Collapse conversation panel"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand conversation" : "Collapse conversation"}
          >
            <SidebarSimple size={18} weight={collapsed ? "fill" : "regular"} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="chatfeed" ref={feedRef}>
        {messages.map((m, i) => (
          <div key={m.id ?? i} className={`msg ${m.role}${m.process ? " with-process" : ""}`}>
            {m.ran && <div className="ran">{m.ran} ›</div>}
            {m.role === "user" && m.contextOptions?.length ? (
              <ContextOptionItems items={m.contextOptions} compact />
            ) : null}
            {m.role === "user" && m.contextItems?.length ? <ContextItems items={m.contextItems} compact /> : null}
            {m.role === "user" && m.attachment ? <SlideAttachment slide={m.attachment} onSelectSlide={onSelectSlide} /> : null}
            {m.content && (
              <div className={m.role === "user" ? "msg-user-bubble" : undefined} style={{ whiteSpace: "pre-wrap" }}>
                {m.content}
              </div>
            )}
            {m.process && <AgentProcessCard process={m.process} />}
            {m.doc && (
              <div className="doc-card">
                <span className="ic">{m.doc.icon ?? "▤"}</span>
                <div>
                  <div className="t">{m.doc.title}</div>
                  <div className="s">{m.doc.subtitle}</div>
                </div>
              </div>
            )}
            {m.role !== "user" && m.attachment && <SlideAttachment slide={m.attachment} onSelectSlide={onSelectSlide} />}
            {m.inspiration && <InspirationCard inspiration={m.inspiration} onInspire={onInspire} />}
            {m.role !== "user" && m.contextItems?.length ? <ContextItems items={m.contextItems} compact /> : null}
            {m.suggestions?.length ? (
              <div className="suggest-row">
                {m.suggestions.map((s, k) => (
                  <button
                    key={k}
                    type="button"
                    className="suggest-chip"
                    disabled={!onSend}
                    onClick={() => onSend?.({ message: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {status && <StatusCard status={status} />}

        {waiting && (
          <div className="msg assistant">
            <span className="typing">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}

        {queued.map((q, i) => (
          <div key={`q${i}`} className="msg user queued" title="Queued — runs when the current work finishes">
            <span className="queued-tag">⏳ queued</span>
            {q.context && <SlideAttachment slide={q.context} compact onSelectSlide={onSelectSlide} />}
            {q.attachments?.length ? <ContextItems items={q.attachments} compact /> : null}
            <div className="msg-user-bubble" style={{ whiteSpace: "pre-wrap" }}>{q.message}</div>
          </div>
        ))}
      </div>

      {onSend && (
        <div className="chatcol-composer">
          <div className="composer" style={{ padding: "10px 12px 8px", borderRadius: 16 }}>
            {context && (
              <div className="composer-context">
                <SlideAttachment slide={context} compact onSelectSlide={onSelectSlide} />
                <button type="button" onClick={onClearContext} aria-label={`Remove slide ${context.slideIndex} context`}>×</button>
              </div>
            )}
            {attachments.length > 0 && (
              <ContextItems
                items={attachments}
                onRemove={(id) => setAttachments((items) => items.filter((item) => item.id !== id))}
                compact
                scrollable
              />
            )}
            {uploadError && <div className="context-upload-error" role="alert">{uploadError}</div>}
            <textarea
              ref={textareaRef}
              rows={3}
              placeholder={
                busy
                  ? "Queue a deck follow-up — it runs when this finishes…"
                  : context
                    ? `Ask about slide ${context.slideIndex} — e.g. “add a follow-up after this”`
                    : placeholder
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.files);
                if (!files.length) return;
                event.preventDefault();
                void addFiles(files);
              }}
              onKeyDown={(e) => {
                if (shouldSubmitTextarea({
                  key: e.key,
                  shiftKey: e.shiftKey,
                  isComposing: e.nativeEvent.isComposing,
                  keyCode: e.nativeEvent.keyCode,
                })) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="composer-bar">
              <button
                type="button"
                className="cbtn icononly"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                title="Add images or files"
                aria-label="Add images or files"
              >
                <Plus size={18} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={CONTEXT_ITEM_ACCEPT}
                multiple
                hidden
                onChange={(event) => {
                  void addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
              <span className="spacer" />
              <button
                className="send-btn"
                disabled={uploading || (!text.trim() && !attachments.length)}
                onClick={submit}
                title={busy ? "Queue follow-up" : "Send"}
              >
                {busy ? "＋" : "↑"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
