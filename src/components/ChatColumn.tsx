"use client";

import {
  ArrowsOut,
  Check,
  CheckCircle,
  ChatsCircle,
  Circle,
  CircleNotch,
  CopySimple,
  CrosshairSimple,
  DotsThree,
  FileText,
  MagnifyingGlass,
  MinusCircle,
  PencilSimple,
  Plus,
  SidebarSimple,
  Trash,
  Wrench,
  X,
  XCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { WorkflowProgress } from "@/lib/workflowProgress";
import { useI18n } from "@/i18n/I18nProvider";
import { translate, type UiLocale } from "@/i18n/messages";

export interface ChatMsg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  ran?: string; // e.g. "Ran for 1m 45s" meta line
  doc?: {
    title: string;
    subtitle: string;
    icon?: string;
    pages?: { title: string; points: string[] }[];
  };
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
  /** Exact provider usage when available. The UI derives a visibly-labelled
   * estimate from answer text for older/local messages without usage data. */
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

export interface ChatConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
}

function estimateOutputTokens(text: string) {
  const compact = text.trim();
  if (!compact) return 0;
  let ascii = 0;
  let nonAscii = 0;
  for (const character of compact) {
    if (character.charCodeAt(0) <= 127) ascii += 1;
    else nonAscii += 1;
  }
  return Math.max(1, Math.round(ascii / 4 + nonAscii * 1.05));
}

function formatTokenCount(value: number, locale: UiLocale) {
  return value >= 10_000
    ? `${(value / 1000).toFixed(value >= 100_000 ? 0 : 1)}k`
    : new Intl.NumberFormat(locale).format(Math.round(value));
}

function answerDurationLabel(ran: string | undefined, done: string) {
  if (!ran) return done;
  return ran.replace(/^Ran for\s+/i, `${done} `);
}

function AnswerMeta({ message }: { message: ChatMsg }) {
  const { locale, t } = useI18n();
  const [copied, setCopied] = useState(false);
  const fallbackOutputTokens = estimateOutputTokens(message.content);
  const outputTokens = message.usage?.outputTokens ?? fallbackOutputTokens;
  const estimated = message.usage?.outputTokens == null || message.usage.estimated;

  async function copyAnswer() {
    if (!message.content.trim()) return;
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!message.content.trim() || message.process?.state === "running") return null;

  return (
    <div className="answer-meta">
      <span className="answer-meta-summary">
        <span>{answerDurationLabel(message.ran, t("chat.answerDone"))}</span>
        {outputTokens > 0 && (
          <>
            <i aria-hidden="true">·</i>
            <span
              title={estimated
                ? t("chat.estimatedTokens")
                : t("chat.reportedTokens")}
            >
              {t("chat.outputTokens", { count: `${estimated ? "≈ " : ""}${formatTokenCount(outputTokens, locale)}` })}
            </span>
          </>
        )}
        {typeof message.usage?.costUsd === "number" && (
          <>
            <i aria-hidden="true">·</i>
            <span>${message.usage.costUsd.toFixed(message.usage.costUsd < 0.01 ? 4 : 2)}</span>
          </>
        )}
      </span>
      <span className="answer-meta-divider" aria-hidden="true" />
      <button
        type="button"
        className="answer-action"
        onClick={() => void copyAnswer()}
        aria-label={copied ? t("chat.answerCopied") : t("chat.copyAnswer")}
        title={copied ? t("chat.copied") : t("chat.copyAnswer")}
      >
        {copied ? <Check size={15} weight="bold" /> : <CopySimple size={15} />}
      </button>
      <span className="sr-only" aria-live="polite">{copied ? t("chat.answerCopied") : ""}</span>
    </div>
  );
}

function WorkflowProgressCard({ workflow }: { workflow: WorkflowProgress }) {
  const { t } = useI18n();
  const currentIndex = workflow.steps.findIndex((step) => step.state === "active");
  const completed = workflow.steps.filter((step) => step.state === "complete" || step.state === "skipped").length;
  const activeStep = currentIndex >= 0 ? currentIndex + 1 : Math.min(workflow.steps.length, completed + 1);
  const progress = workflow.progress && workflow.progress.total > 0
    ? Math.round((workflow.progress.done / workflow.progress.total) * 100)
    : null;

  return (
    <section className="workflow-progress" aria-label={t("chat.progress")}>
      <div className="workflow-progress-head">
        <strong>{t("chat.progress")}</strong>
        <span>{t("chat.progressStep", { current: activeStep, total: workflow.steps.length })}</span>
      </div>
      {progress != null && (
        <div className="workflow-progress-bar" aria-label={t("chat.progressPages", { done: workflow.progress!.done, total: workflow.progress!.total })}>
          <i style={{ width: `${Math.max(progress, workflow.progress!.done > 0 ? 6 : 2)}%` }} />
        </div>
      )}
      <div className="workflow-steps">
        {workflow.steps.map((step, index) => (
          <div className={`workflow-step ${step.state}`} key={step.id}>
            <span className="workflow-step-icon" aria-hidden="true">
              {step.state === "complete" ? (
                <CheckCircle size={17} weight="fill" />
              ) : step.state === "active" ? (
                <CircleNotch size={17} className="spin" />
              ) : step.state === "skipped" ? (
                <MinusCircle size={17} />
              ) : (
                <Circle size={17} />
              )}
            </span>
            <span className="workflow-step-copy">
              <b>{index + 1}. {step.label}</b>
              <small>{step.detail}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function conversationAge(timestamp: number, locale: UiLocale) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return translate(locale, "time.justNow");
  if (seconds < 3600) return translate(locale, "time.minutesAgo", { count: Math.floor(seconds / 60) });
  if (seconds < 86_400) return translate(locale, "time.hoursAgo", { count: Math.floor(seconds / 3600) });
  return translate(locale, "time.daysAgo", { count: Math.floor(seconds / 86_400) });
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
  const { t } = useI18n();
  const fallbackTitle = t("chat.slide", { index: slide.slideIndex });
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
        aria-label={t("chat.previewSlide", { index: slide.slideIndex })}
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
        aria-label={onSelectSlide
          ? t("chat.goToSlide", { index: slide.slideIndex })
          : t("chat.previewSlide", { index: slide.slideIndex })}
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

function OutlineDocumentCard({ doc }: { doc: NonNullable<ChatMsg["doc"]> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const card = (
    <>
      <span className="ic" aria-hidden="true"><FileText size={17} /></span>
      <span className="doc-card-copy">
        <span className="t">{doc.title}</span>
        <span className="s">{doc.subtitle}</span>
      </span>
      {doc.pages?.length ? <span className="doc-card-open">{t("chat.viewOutline")} <ArrowsOut size={13} /></span> : null}
    </>
  );

  return (
    <>
      {doc.pages?.length ? (
        <button type="button" className="doc-card" onClick={() => setOpen(true)}>{card}</button>
      ) : (
        <div className="doc-card">{card}</div>
      )}
      {open && doc.pages?.length ? (
        <div className="outline-preview-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="outline-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("chat.outlineLabel", { title: doc.title })}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="outline-preview-head">
              <span className="outline-preview-icon" aria-hidden="true"><FileText size={18} /></span>
              <span>
                <strong>{doc.title}</strong>
                <small>{doc.subtitle}</small>
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("chat.closeOutline")}><X size={17} /></button>
            </header>
            <div className="outline-preview-pages">
              {doc.pages.map((page, index) => (
                <article className="outline-preview-page" key={`${index}-${page.title}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{page.title || t("chat.slide", { index: index + 1 })}</strong>
                    {page.points.length ? (
                      <ul>{page.points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}</ul>
                    ) : (
                      <small>{t("chat.noPoints")}</small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
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
  const { t } = useI18n();
  const { query, coverIds, total, chosen, resolved } = inspiration;
  const chosenName = chosen ? getCommunityTemplate(chosen)?.name : undefined;
  const chosenTemplate = chosen ? getCommunityTemplate(chosen) : undefined;
  const [previewOpen, setPreviewOpen] = useState(false);
  const extra = Math.max(0, total - coverIds.length);
  const visibleCoverIds = chosen ? [chosen] : coverIds;
  return (
    <>
      <div className={`inspo-card${resolved ? " resolved" : ""}`}>
        <div className="inspo-head">
          <span className="inspo-ic" aria-hidden="true">
            ✦
          </span>
          <span className="inspo-copy">
          <b>{t("chat.inspiration")}</b>
            <small>
              {resolved
                ? chosen
                ? t("chat.inspirationChosen", { name: chosenName ?? t("chat.customStyle") })
                : t("chat.inspirationSkipped")
              : t("chat.inspirationMatches", { count: total, query })}
            </small>
          </span>
          {!resolved && onInspire && (
            <button type="button" className="inspo-browse" onClick={() => onInspire("browse")}>
            {t("chat.browse")}
            </button>
          )}
        </div>
        <div className="inspo-thumbs" aria-hidden="true">
          {visibleCoverIds.map((id) => {
            const t = getCommunityTemplate(id);
            return t ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={id} src={t.cover} alt="" loading="lazy" />
            ) : null;
          })}
          {!chosen && extra > 0 && <span className="inspo-more">+{extra}</span>}
        </div>
        {!resolved && onInspire && (
          <div className="inspo-actions">
            <button type="button" className="inspo-skip" onClick={() => onInspire("skip")}>
            {t("chat.skip")}
            </button>
          </div>
        )}
        {resolved && chosenTemplate && (
          <div className="inspo-actions resolved-actions">
            <button type="button" className="inspo-preview" onClick={() => setPreviewOpen(true)}>
              {t("chat.previewAgain")} <ArrowsOut size={13} />
            </button>
          </div>
        )}
      </div>
      {previewOpen && chosenTemplate ? (
        <ImagePreviewDialog
          src={chosenTemplate.cover}
          title={chosenTemplate.name}
          subtitle={t("chat.currentInspiration")}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}

function AgentProcessCard({ process }: { process: AgentProcess }) {
  const { locale, t } = useI18n();
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
        <span>{process.state === "running" ? t("chat.stateWorking") : process.state === "complete" ? t("chat.stateDone") : t("chat.stateStopped")}</span>
      </div>
      {process.notes?.length ? (
        <div className="agent-process-notes">
          {process.notes.map((note, index) => <p key={index}>{note}</p>)}
        </div>
      ) : null}
      {process.tools.length ? (
        <div className="agent-tools" aria-label={t("chat.toolCalls")}>
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
                {tool.state === "running" ? t("chat.toolRunning") : tool.state === "complete" ? t("chat.toolDone") : tool.state === "error" ? t("chat.toolFailed") : t("chat.toolWaiting")}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Live progress card pinned to the bottom of the feed while work is in flight. */
function StatusCard({ status }: { status: GenStatus }) {
  const { t } = useI18n();
  const { phase, total, done, current, currentTitle, note } = status;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const detail = note
    ? note
    : current
      ? t("status.drawingSlide", { index: current, title: currentTitle ? ` — ${currentTitle}` : "" })
      : phase === "editing"
        ? t("status.workingEdit")
        : phase === "outlining"
          ? t("status.outliningDeck")
          : t("status.renderingPages");
  const phaseLabel = phase === "outlining"
    ? t("status.outlining")
    : phase === "rendering"
      ? t("status.rendering")
      : t("status.editing");

  return (
    <div className="genstatus" role="status" aria-live="polite">
      <div className="genstatus-head">
        <span className="genstatus-title">
          <span className="pulse-dot" /> {phaseLabel}
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
            <span>{phase === "outlining" ? t("status.outliningDeck") : t("status.outlineReady")}</span>
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
  placeholder,
  homeHref,
  context = null,
  onClearContext,
  focusKey = 0,
  onSelectSlide,
  onInspire,
  workflow,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
  conversationManagementDisabled = false,
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
  /** Persistent four-step project progress shown throughout the workflow. */
  workflow?: WorkflowProgress;
  /** Optional project-scoped multi-session controls. */
  conversations?: ChatConversationSummary[];
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onCreateConversation?: () => void;
  onRenameConversation?: (id: string, title: string) => void;
  onDeleteConversation?: (id: string) => void;
  conversationManagementDisabled?: boolean;
}) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [collapseSettled, setCollapseSettled] = useState(false);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ContextItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationQuery, setConversationQuery] = useState("");
  const [conversationActionsId, setConversationActionsId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationPanelRef = useRef<HTMLDivElement>(null);

  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLocaleLowerCase();
    if (!query) return conversations ?? [];
    return (conversations ?? []).filter((conversation) => conversation.title.toLocaleLowerCase().includes(query));
  }, [conversationQuery, conversations]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, status, queued.length]);

  useEffect(() => {
    if (!focusKey) return;
    textareaRef.current?.focus();
  }, [focusKey]);

  useEffect(() => () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
  }, []);

  useEffect(() => {
    if (!conversationOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element;
      if (target.closest(".chatcol-conversations")) return;
      if (!conversationPanelRef.current?.contains(target)) setConversationOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setConversationOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [conversationOpen]);

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
    const m = text.trim() || (attachments.length ? t("chat.useAttachments") : "");
    if (!m || !onSend || uploading) return; // allowed while busy → parent queues it
    setText("");
    onSend({ message: m, context: context ?? undefined, attachments });
    setAttachments([]);
    setUploadError("");
    onClearContext?.();
  }

  function toggleCollapsed() {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    if (collapsed) {
      setCollapseSettled(false);
      setCollapsed(false);
      window.setTimeout(() => textareaRef.current?.focus(), 230);
      return;
    }
    setConversationOpen(false);
    setCollapseSettled(false);
    setCollapsed(true);
    collapseTimerRef.current = setTimeout(() => setCollapseSettled(true), 230);
  }

  function beginRename(conversation: ChatConversationSummary) {
    setRenamingId(conversation.id);
    setRenameText(conversation.title);
    setDeleteConfirmId(null);
  }

  function commitRename() {
    if (!renamingId || !renameText.trim()) return;
    onRenameConversation?.(renamingId, renameText.trim());
    setRenamingId(null);
    setRenameText("");
    setConversationActionsId(null);
  }

  // Typing dots only when we're waiting on a reply and have no richer status card.
  const waiting = busy && !status && messages[messages.length - 1]?.role === "user";

  return (
    <aside className={`chatcol${collapsed ? " collapsed" : ""}${collapseSettled ? " collapse-settled" : ""}`}>
      <div className="chatcol-head">
        <div className="chatcol-head-main">
          {homeHref && (
            <>
              <Link className="workspace-home" href={homeHref} aria-label={t("topbar.backProjects")}>
                <span className="glyph" aria-hidden="true">◈</span>
                <span>PPT Anything</span>
              </Link>
              <span className="workspace-head-sep" aria-hidden="true" />
            </>
          )}
          <span className="chatcol-title">▦ {label}</span>
        </div>
        <div className="chatcol-head-actions">
          {busy && <span className="chatcol-live">{t("chat.working")}</span>}
          {conversations?.length ? (
            <button
              type="button"
              className={`chatcol-conversations${conversationOpen ? " active" : ""}`}
              onClick={() => setConversationOpen((value) => !value)}
              aria-label={t("chat.manageConversations")}
              aria-expanded={conversationOpen}
              title={t("chat.conversations")}
            >
              <ChatsCircle size={18} weight={conversationOpen ? "fill" : "regular"} />
              <span>{conversations.length}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="chatcol-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? t("chat.expand") : t("chat.collapse")}
            aria-expanded={!collapsed}
            title={collapsed ? t("chat.expandTitle") : t("chat.collapseTitle")}
          >
            <SidebarSimple size={18} weight={collapsed ? "fill" : "regular"} aria-hidden="true" />
          </button>
        </div>
      </div>

      {collapseSettled && (
        <button
          type="button"
          className="chatcol-reopen"
          onClick={toggleCollapsed}
          aria-label={t("chat.expand")}
          title={t("chat.expandTitle")}
        >
          <SidebarSimple size={18} weight="fill" aria-hidden="true" />
        </button>
      )}

      {conversationOpen && conversations?.length ? (
        <div className="conversation-panel" ref={conversationPanelRef}>
          <div className="conversation-panel-head">
            <span>{t("chat.conversations")} <b>{conversations.length}</b></span>
            <button
              type="button"
              className="conversation-new"
              disabled={conversationManagementDisabled || !onCreateConversation}
              onClick={() => {
                onCreateConversation?.();
                setConversationOpen(false);
              }}
            >
              <Plus size={14} /> {t("chat.newConversation")}
            </button>
          </div>
          <label className="conversation-search">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              value={conversationQuery}
              onChange={(event) => setConversationQuery(event.target.value)}
              placeholder={t("chat.searchConversations")}
              aria-label={t("chat.searchConversations")}
            />
          </label>
          <div className="conversation-list">
            {filteredConversations.map((conversation) => (
              <div
                className={`conversation-row${conversation.id === activeConversationId ? " active" : ""}`}
                key={conversation.id}
              >
                {renamingId === conversation.id ? (
                  <form
                    className="conversation-rename"
                    onSubmit={(event) => {
                      event.preventDefault();
                      commitRename();
                    }}
                  >
                    <input
                      autoFocus
                      value={renameText}
                      maxLength={80}
                      onChange={(event) => setRenameText(event.target.value)}
                      aria-label={t("chat.conversationName")}
                    />
                    <button type="submit" aria-label={t("chat.saveConversationName")}><Check size={14} /></button>
                    <button type="button" onClick={() => setRenamingId(null)} aria-label={t("chat.cancelRename")}><X size={14} /></button>
                  </form>
                ) : deleteConfirmId === conversation.id ? (
                  <div className="conversation-delete-confirm">
                    <span>{t("chat.deleteConversationQuestion")}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteConversation?.(conversation.id);
                        setDeleteConfirmId(null);
                        setConversationActionsId(null);
                      }}
                    >{t("chat.confirm")}</button>
                    <button type="button" onClick={() => setDeleteConfirmId(null)}>{t("chat.cancel")}</button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="conversation-select"
                      disabled={conversationManagementDisabled}
                      onClick={() => {
                        onSelectConversation?.(conversation.id);
                        setConversationOpen(false);
                      }}
                    >
                      <span>{conversation.title}</span>
                      <small>{t("chat.messageCount", { count: conversation.messageCount })} · {conversationAge(conversation.updatedAt, locale)}</small>
                    </button>
                    <button
                      type="button"
                      className="conversation-actions-trigger"
                      onClick={() => setConversationActionsId((id) => id === conversation.id ? null : conversation.id)}
                      aria-label={t("chat.manageNamed", { name: conversation.title })}
                      title={t("chat.manageConversations")}
                    >
                      <DotsThree size={18} weight="bold" />
                    </button>
                    {conversationActionsId === conversation.id ? (
                      <div className="conversation-row-actions">
                        <button type="button" onClick={() => beginRename(conversation)}><PencilSimple size={13} /> {t("chat.rename")}</button>
                        <button
                          type="button"
                          className="danger"
                          disabled={conversations.length <= 1 || conversationManagementDisabled}
                          onClick={() => setDeleteConfirmId(conversation.id)}
                        ><Trash size={13} /> {t("chat.delete")}</button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ))}
            {!filteredConversations.length ? <div className="conversation-empty">{t("chat.noConversationMatch")}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="chatfeed" ref={feedRef}>
        {!messages.length ? (
          <div className="chat-empty">
            <ChatsCircle size={22} />
            <strong>{t("chat.emptyTitle")}</strong>
            <span>{t("chat.emptyBody")}</span>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={m.id ?? i} className={`msg ${m.role}${m.process ? " with-process" : ""}`}>
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
            {m.doc && <OutlineDocumentCard doc={m.doc} />}
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
            {m.role === "assistant" ? <AnswerMeta message={m} /> : null}
          </div>
        ))}

        {status && !workflow && <StatusCard status={status} />}

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
          <div key={`q${i}`} className="msg user queued" title={t("chat.queuedHelp")}>
            <span className="queued-tag">⏳ {t("chat.queued")}</span>
            {q.context && <SlideAttachment slide={q.context} compact onSelectSlide={onSelectSlide} />}
            {q.attachments?.length ? <ContextItems items={q.attachments} compact /> : null}
            <div className="msg-user-bubble" style={{ whiteSpace: "pre-wrap" }}>{q.message}</div>
          </div>
        ))}
      </div>

      {workflow ? <WorkflowProgressCard workflow={workflow} /> : null}

      {onSend && (
        <div className="chatcol-composer">
          <div className="composer" style={{ padding: "10px 12px 8px", borderRadius: 16 }}>
            {context && (
              <div className="composer-context">
                <SlideAttachment slide={context} compact onSelectSlide={onSelectSlide} />
                <button type="button" onClick={onClearContext} aria-label={t("chat.removeSlideContext", { index: context.slideIndex })}>×</button>
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
                  ? t("chat.queuePlaceholder")
                  : context
                    ? t("chat.slidePlaceholder", { index: context.slideIndex })
                    : placeholder ?? t("chat.defaultPlaceholder")
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
                title={t("chat.addFiles")}
                aria-label={t("chat.addFiles")}
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
                title={busy ? t("chat.queue") : t("chat.send")}
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
