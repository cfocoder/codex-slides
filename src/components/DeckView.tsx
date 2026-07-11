"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "@phosphor-icons/react";
import {
  BrandDesignSystemPanel,
  type BrandDesignSystemSubmit,
} from "@/components/BrandDesignSystemPanel";
import DesignFiles from "@/components/DesignFiles";
import ChatColumn, { type ChatMsg } from "@/components/ChatColumn";
import type { MaterialTrayItem } from "@/components/MaterialTray";
import OutlineBoard from "@/components/OutlineBoard";
import InspireDialog from "@/components/InspireDialog";
import SlideStage, { type MarkAgentEvent } from "@/components/SlideStage";
import WorkspaceModeTabs from "@/components/WorkspaceModeTabs";
import {
  COMMUNITY_TEMPLATES,
  getCommunityTemplate,
  inspireQueryFor,
  matchCommunityTemplates,
} from "@/lib/community";
import { getTemplate } from "@/lib/templates";
import {
  addProjectSlide,
  cacheProjectCheckpoint,
  deriveStatus,
  fileUrl,
  generateSingleSlide,
  patchProjectStyle,
  planChatEdit,
  regenerateSlide,
  reviseOutlineChat,
  saveConversations,
  saveOutline,
  saveProjectCheckpoint,
  streamRender,
  type ChatRequest,
  type GenStatus,
  type ProjectCheckpointPatch,
  type SlideChatContext,
  type UiSlide,
} from "@/lib/deckEdit";
import type { OutlinePage, ProgressEvent, Project } from "@/lib/types";
import { normalizeDeckDesignSystem } from "@/lib/designSystem";
import { outlineSnapshotMessage, styleSnapshotMessage } from "@/lib/chatArtifacts";
import { useChatConversations } from "@/lib/useChatConversations";
import { buildWorkflowProgress } from "@/lib/workflowProgress";
import { useI18n } from "@/i18n/I18nProvider";
import { translate, type UiLocale } from "@/i18n/messages";
import {
  createAgentRunId,
  elapsedRunLabel,
  patchAgentTool,
  patchAgentTools,
  stopRunningTools,
} from "@/lib/agentActivity";

function projectSlides(project: Project): UiSlide[] {
  // Stable across server render + hydration; avoids changing every image URL
  // while React attaches to the server-rendered workspace.
  const bust = new Date(project.updatedAt).getTime();
  return project.pages.map((slide) => ({
    index: slide.index,
    title: slide.title,
    status: (slide.status as UiSlide["status"]) ?? "pending",
    image: slide.image,
    error: slide.error,
    bust,
    transition: slide.transition ?? "none",
  }));
}

function projectOutline(project: Project): OutlinePage[] {
  return (project.outline?.length ? project.outline : project.pages).map((page) => ({
    title: page.title,
    points: [...(page.points ?? [])],
  }));
}

/** Upgrade legacy chat history in memory so projects created before persistent
 * workflow cards still expose the decisions that produced the current deck.
 * The debounced conversation save writes this enriched shape on the next open. */
function enrichProjectChat(project: Project, messages: ChatMsg[], locale: UiLocale): ChatMsg[] {
  if (!messages.length) return messages;
  const outline = projectOutline(project);
  const hasWorkflowEvidence = messages.some((message) => (
    Boolean(message.doc || message.inspiration || message.process || message.artifact)
      || /大纲|outline|视觉参考|visual reference|逐页生成|generating slides/i.test(message.content)
  ));
  if (!hasWorkflowEvidence) return messages;

  const next = messages.map((message) => ({ ...message }));
  const outlineIndex = next.findIndex((message) => message.doc);
  if (outline.length && outlineIndex >= 0 && !next[outlineIndex].doc?.pages?.length) {
    next[outlineIndex] = {
      ...next[outlineIndex],
      doc: {
        ...next[outlineIndex].doc!,
        pages: outline.map((page) => ({ title: page.title, points: [...page.points] })),
        artifactId: "outline",
      },
    };
  } else if (outline.length && outlineIndex < 0) {
    next.push({
      ...outlineSnapshotMessage(project.title, outline),
      id: `legacy-outline-${project.id}`,
    });
  }

  if (!next.some((message) => message.artifact?.kind === "questions")) {
    const confirmationIndex = next.findIndex((message) => (
      message.role === "user" && /^(已确认|confirmed)[:：]/i.test(message.content.trim())
    ));
    const confirmedLines = confirmationIndex >= 0
      ? next[confirmationIndex].content.split("\n").filter((line) => /[:：]/.test(line)).length - 1
      : 0;
    const insertIndex = confirmationIndex >= 0 ? confirmationIndex + 1 : Math.min(2, next.length);
    next.splice(insertIndex, 0, {
      id: `legacy-questions-${project.id}`,
      role: "assistant",
      content: "",
      artifact: {
        id: "questions",
        kind: "questions",
        title: translate(locale, "designFiles.questionsTitle"),
        subtitle: confirmedLines > 0
          ? translate(locale, "designFiles.questionsConfirmed", { count: confirmedLines })
          : translate(locale, "designFiles.questionsConfirmedOpenBrief"),
      },
    });
  }

  if (project.config.template && !next.some((message) => message.inspiration?.resolved)) {
    let inspirationIndex = -1;
    for (let index = next.length - 1; index >= 0; index -= 1) {
      const message = next[index];
      if (message.id?.startsWith("inspire-") || /视觉参考|visual reference|ビジュアルリファレンス|挑一个|pick a style|スタイルを選/i.test(message.content)) {
        inspirationIndex = index;
        break;
      }
    }
    const snapshot = styleSnapshotMessage(project.config.template, project.config.requirement);
    const localizedContent = translate(locale, "flow.styleConfirmed", {
      name: getCommunityTemplate(project.config.template)?.name ?? project.config.template,
    });
    if (inspirationIndex >= 0) {
      next[inspirationIndex] = {
        ...next[inspirationIndex],
        content: localizedContent,
        inspiration: snapshot.inspiration,
      };
    } else {
      next.push({
        ...snapshot,
        id: `legacy-inspiration-${project.id}`,
        content: localizedContent,
      });
    }
  }

  const hasRenderProcess = next.some((message) => (
    message.process?.tools.some((tool) => tool.name === "render_deck")
  ));
  if (project.status !== "draft" && !hasRenderProcess) {
    const rendered = project.pages.filter((page) => page.status === "rendered").length;
    const failed = project.pages.filter((page) => page.status === "error").length;
    next.push({
      id: `legacy-render-${project.id}`,
      role: "assistant",
      content: translate(locale, "project.readyIntro", {
        title: project.title,
        count: project.pages.length,
        rendered,
      }),
      process: {
        state: failed ? "error" : "complete",
        title: failed
          ? translate(locale, "flow.renderFinishedWithErrors")
          : translate(locale, "flow.renderFinished"),
        notes: [translate(locale, "flow.renderRestored")],
        tools: [{
          id: "render",
          name: "render_deck",
          label: translate(locale, "flow.renderTool"),
          detail: `${rendered} / ${project.pages.length}${failed ? ` · ${translate(locale, "flow.failedCount", { count: failed })}` : ""}`,
          state: failed ? "error" : "complete",
        }],
      },
    });
  }
  return next;
}

function projectChat(project: Project, locale: UiLocale): ChatMsg[] {
  if (Array.isArray(project.chat) && project.chat.length) {
    return enrichProjectChat(project, project.chat as unknown as ChatMsg[], locale);
  }
  const rendered = project.pages.filter((slide) => slide.status === "rendered").length;
  const fallback: ChatMsg[] = [
    project.status === "draft"
      ? {
          role: "assistant",
          content: translate(locale, "project.draftIntro", { title: project.title, count: project.pages.length }),
          doc: {
            title: project.title,
            subtitle: translate(locale, "flow.outlineDoc", { count: project.pages.length }),
            pages: projectOutline(project),
            artifactId: "outline",
          },
        }
      : {
          role: "assistant",
          content: translate(locale, "project.readyIntro", { title: project.title, count: project.pages.length, rendered }),
          doc: { title: project.title, subtitle: `${project.config.aspect} · ${project.agent}`, icon: "▤" },
        },
  ];
  return enrichProjectChat(project, fallback, locale);
}

/** Shows a persisted project immediately from server-provided data. */
export default function DeckView({ projectId, initialProject }: { projectId: string; initialProject: Project }) {
  const { locale, t } = useI18n();
  const [project, setProject] = useState<Project>(initialProject);
  const [workspaceView, setWorkspaceView] = useState<"deck" | "files">(
    initialProject.workflow?.workspaceMode === "files" ? "files" : "deck",
  );
  const [designFilePath, setDesignFilePath] = useState<string | undefined>();
  const [designFileOpenKey, setDesignFileOpenKey] = useState(0);
  const [slides, setSlides] = useState<UiSlide[]>(() => projectSlides(initialProject));
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<"outline" | "inspire" | "deck">(() => {
    if (initialProject.workflow?.stage === "inspire") return "inspire";
    if (initialProject.workflow?.stage === "rendering" || initialProject.workflow?.stage === "deck") return "deck";
    if (initialProject.workflow?.stage === "outline" || initialProject.status === "draft") return "outline";
    return "deck";
  });
  const [outline, setOutline] = useState<OutlinePage[]>(() => projectOutline(initialProject));
  const initialConversations = initialProject.conversations?.map((conversation) => ({
    ...conversation,
    messages: enrichProjectChat(initialProject, conversation.messages as unknown as ChatMsg[], locale),
  }));
  const conversationState = useChatConversations({
    initialConversations,
    initialActiveConversationId: initialProject.activeConversationId,
    initialMessages: projectChat(initialProject, locale),
    initialTitle: initialProject.title,
  });
  const chat = conversationState.messages;
  const setChat = conversationState.setMessages;
  const [queue, setQueue] = useState<ChatRequest[]>([]);
  const [chatContext, setChatContext] = useState<SlideChatContext | null>(null);
  const [chatFocusKey, setChatFocusKey] = useState(0);
  const [focusSlideIndex, setFocusSlideIndex] = useState<number | null>(null);
  const [focusSlideKey, setFocusSlideKey] = useState(0);
  const [inspireOpen, setInspireOpen] = useState(false);
  const [inspireMsgId, setInspireMsgId] = useState<string | null>(null);
  const [inspirationSkipped, setInspirationSkipped] = useState(
    initialProject.status !== "draft"
      && !initialProject.config.template
      && !initialProject.config.designSystem,
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkpointTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCheckpointRef = useRef<ProjectCheckpointPatch | null>(null);
  const resumeRenderRef = useRef(false);
  const markRunRef = useRef<{ id: string; startedAt: number; slideIndex: number } | null>(null);

  const [showDesignSystem, setShowDesignSystem] = useState(false);
  const [designSystemSaving, setDesignSystemSaving] = useState(false);
  const [designSystemError, setDesignSystemError] = useState("");
  const [retuning, setRetuning] = useState(false);
  const [designSystemProgress, setDesignSystemProgress] = useState(0);
  const designSystemTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "design-files") {
      setDesignFilePath(params.get("file") || undefined);
      setDesignFileOpenKey((key) => key + 1);
      setWorkspaceView("files");
    } else if (view === "brand-system") {
      setShowDesignSystem(true);
    }
  }, []);

  useEffect(() => {
    if (!showDesignSystem) return;
    requestAnimationFrame(() => document.getElementById("brand-design-system-panel")?.focus());
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || retuning || designSystemSaving) return;
      setShowDesignSystem(false);
      designSystemTriggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [designSystemSaving, retuning, showDesignSystem]);

  const say = (m: ChatMsg) => setChat((c) => [...c, m]);

  function updateChatMessage(id: string, update: (message: ChatMsg) => ChatMsg) {
    setChat((messages) => messages.map((message) => (message.id === id ? update(message) : message)));
  }

  function locateChatSlide(index: number) {
    setWorkspaceView("deck");
    setFocusSlideIndex(index);
    setFocusSlideKey((key) => key + 1);
  }

  function openDesignFile(id: string) {
    const pathByArtifact: Record<string, string> = {
      questions: "generated/brief.md",
      outline: "generated/outline.md",
      inspiration: "generated/inspiration.json",
    };
    setDesignFilePath(pathByArtifact[id] ?? id);
    setDesignFileOpenKey((key) => key + 1);
    setWorkspaceView("files");
  }

  /** Route a chat turn to the right handler for the current stage. */
  function runRequest(request: ChatRequest) {
    if (stage === "outline") handleOutlineChat(request);
    else handleChat(request);
  }

  /** Queue follow-ups typed while work is in flight; run when idle. */
  function enqueueOrRun(request: ChatRequest) {
    if (busy || running) setQueue((q) => [...q, request]);
    else runRequest(request);
  }

  // Drain one queued follow-up whenever the workspace goes idle.
  useEffect(() => {
    if (busy || running || !queue.length) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    runRequest(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, running, queue]);

  // Persist every conversation (debounced) so switching/reloading never loses a turn.
  useEffect(() => {
    if (!conversationState.conversations.length) return;
    const t = setTimeout(() => saveConversations(
      projectId,
      conversationState.conversations,
      conversationState.activeConversationId,
    ), 600);
    return () => clearTimeout(t);
  }, [conversationState.activeConversationId, conversationState.conversations, projectId]);

  useEffect(() => {
    const patch = {
      config: project.config,
      title: project.title,
      researchDoc: project.researchDoc ?? "",
      workflow: {
        stage: running ? "rendering" as const : stage,
        workspaceMode: workspaceView === "files" ? "files" as const : "canvas" as const,
        inspirationSkipped,
      },
    };
    latestCheckpointRef.current = patch;
    cacheProjectCheckpoint(projectId, patch);
    if (checkpointTimer.current) clearTimeout(checkpointTimer.current);
    checkpointTimer.current = setTimeout(() => {
      checkpointTimer.current = null;
      void saveProjectCheckpoint(projectId, patch).catch(() => {});
    }, 450);
    return () => {
      if (checkpointTimer.current) clearTimeout(checkpointTimer.current);
    };
  }, [inspirationSkipped, project.config, project.researchDoc, project.title, projectId, running, stage, workspaceView]);

  useEffect(() => {
    const flush = () => {
      const patch = latestCheckpointRef.current;
      if (patch) void saveProjectCheckpoint(projectId, patch).catch(() => {});
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [projectId]);

  useEffect(() => {
    if (initialProject.workflow?.stage !== "rendering" || resumeRenderRef.current) return;
    resumeRenderRef.current = true;
    void renderNow();
    // A rendering checkpoint means the previous browser request ended. The
    // pipeline skips completed pages and resumes only pending/error pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- draft outline stage (编辑大纲 → 确认 → 渲染) ---

  function onOutlineChange(pages: OutlinePage[]) {
    setOutline(pages);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveOutline(projectId, pages).catch(() => {});
    }, 700);
  }

  async function handleOutlineChat(request: ChatRequest) {
    const designFiles = request.designFiles ?? [];
    say({
      role: "user",
      content: request.message,
      attachment: request.context,
      contextItems: request.attachments,
      designFiles,
    });
    const runId = createAgentRunId("outline-edit");
    const startedAt = Date.now();
    say({
      id: runId,
      role: "assistant",
      content: "",
      process: {
        state: "running",
        title: t("agent.revisingOutline"),
        notes: [t("agent.revisingOutlineNote")],
        tools: [
          ...designFiles.map((file, index) => ({
            id: `read-${index}`,
            name: "read",
            kind: "read" as const,
            label: t("agent.readDesignFile"),
            detail: file.relativePath,
            path: file.path,
            relativePath: file.relativePath,
            state: "running" as const,
          })),
          {
            id: "revise-outline",
            name: "revise_outline",
            kind: "edit" as const,
            label: t("agent.reviseOutline"),
            detail: t("agent.reviseOutlineDetail"),
            state: "running" as const,
          },
        ],
      },
    });
    setBusy(true);
    try {
      const { pages, reply } = await reviseOutlineChat(projectId, request.message, designFiles);
      setOutline(pages);
      updateChatMessage(runId, (current) => {
        const withReads = patchAgentTools(current.process!, (tool) => tool.kind === "read", { state: "complete" });
        return {
          ...current,
          content: reply || t("flow.outlineUpdated"),
          ran: elapsedRunLabel(startedAt, locale),
          process: {
            ...patchAgentTool(withReads, "revise-outline", { state: "complete", detail: t("agent.outlineRevised", { count: pages.length }) }),
            state: "complete",
            title: t("agent.outlineComplete"),
          },
        };
      });
    } catch (e: any) {
      updateChatMessage(runId, (current) => ({
        ...current,
        content: `⚠ ${e?.message ?? e}`,
        ran: elapsedRunLabel(startedAt, locale),
        process: {
          ...stopRunningTools(current.process!, String(e?.message ?? e)),
          state: "error",
          title: t("agent.outlineFailed"),
        },
      }));
    } finally {
      setBusy(false);
    }
  }

  function handleRenderEvent(ev: ProgressEvent) {
    switch (ev.type) {
      case "page_start":
        setSlides((s) => s.map((x) => (x.index === ev.index ? { ...x, status: "working" } : x)));
        break;
      case "page_rendered":
        setSlides((s) =>
          s.map((x) => (x.index === ev.index ? { ...x, status: "rendered", image: ev.image, bust: Date.now() } : x)),
        );
        break;
      case "page_error":
        setSlides((s) => s.map((x) => (x.index === ev.index ? { ...x, status: "error", error: ev.error } : x)));
        break;
      case "done":
        setRunning(false);
        setProject((current) => ({
          ...current,
          status: "ready",
          workflow: { ...(current.workflow ?? {}), stage: "deck" },
        }));
        break;
      case "error":
        say({ role: "assistant", content: `⚠ ${ev.error}` });
        break;
    }
  }

  /** Outline confirmed. Detour to the inspiration step if no style is chosen. */
  async function confirmOutline() {
    if (running || busy || !outline.length) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await saveOutline(projectId, outline);
    } catch (e: any) {
      say({ role: "assistant", content: `⚠ ${e?.message ?? e}` });
      return;
    }
    say(outlineSnapshotMessage(project.title, outline));
    if (!project?.config.template && !project?.config.designSystem) {
      // Detour to the inspiration step: pending skeleton deck + an in-chat card
      // whose Browse button opens the style popup. Render waits for pick/skip.
      setSlides(outline.map((o, i) => ({ index: i + 1, title: o.title, status: "pending" })));
      setStage("inspire");
      void saveProjectCheckpoint(projectId, {
        config: project.config,
        title: project.title,
        researchDoc: project.researchDoc ?? "",
        workflow: {
          stage: "inspire",
          workspaceMode: "canvas",
          selectedDesignFileId: "inspiration",
          inspirationSkipped: false,
        },
      }).catch(() => {});
      const matchQuery = [project?.config.requirement ?? "", ...outline.map((o) => o.title)]
        .filter(Boolean)
        .join(" ");
      const msgId = createAgentRunId("inspire");
      setInspireMsgId(msgId);
      say({
        id: msgId,
        role: "assistant",
        content: t("flow.stylePrompt"),
        inspiration: {
          query: inspireQueryFor(project?.config.requirement ?? "", outline[0]?.title),
          coverIds: matchCommunityTemplates(matchQuery, 4).map((t) => t.id),
          total: COMMUNITY_TEMPLATES.length,
        },
      });
      return;
    }
    setInspirationSkipped(false);
    if (project.config.designSystem) {
      say({ role: "assistant", content: t("brandSystem.renderContext") });
    } else if (project.config.template) {
      say(styleSnapshotMessage(project.config.template, project.config.requirement));
    }
    renderNow();
  }

  /** Browse opens the popup; skip resolves the step with the default style. */
  function onInspire(action: "browse" | "skip") {
    if (action === "browse") setInspireOpen(true);
    else void handleInspireGenerate(undefined);
  }

  /** Apply an inspiration pick (or skip) then render. */
  async function handleInspireGenerate(templateId?: string) {
    if (running || busy) return;
    setInspireOpen(false);
    if (templateId) {
      setInspirationSkipped(false);
      const tpl = getCommunityTemplate(templateId);
      say({ role: "user", content: t("flow.styleSelected", { name: tpl?.name ?? templateId }) });
      try {
        await patchProjectStyle(projectId, { template: templateId });
        setProject((p) => ({ ...p, config: { ...p.config, template: templateId } }));
      } catch (e: any) {
        say({ role: "assistant", content: `⚠ ${t("flow.styleFailed", { error: e?.message ?? String(e) })}` });
      }
    } else {
      const useBrandSystem = Boolean(project.config.designSystem);
      setInspirationSkipped(!useBrandSystem);
      say({
        role: "user",
        content: useBrandSystem ? t("brandSystem.useSaved") : t("flow.styleSkipped"),
      });
    }
    if (inspireMsgId) {
      updateChatMessage(inspireMsgId, (m) => ({
        ...m,
        inspiration: m.inspiration
          ? { ...m.inspiration, chosen: templateId, resolved: true }
          : undefined,
      }));
    }
    renderNow();
  }

  async function renderNow() {
    const runId = createAgentRunId("render-deck");
    const startedAt = Date.now();
    const startContent = project.config.fast
      ? t("flow.fastRender", { count: outline.length })
      : t("flow.render", { count: outline.length });
    setRunning(true);
    setWorkspaceView("deck");
    say({
      id: runId,
      role: "assistant",
      content: startContent,
      process: {
        state: "running",
        title: t("flow.renderingTitle"),
        notes: [t("flow.renderingNote")],
        tools: [{
          id: "render",
          name: "render_deck",
          label: t("flow.renderTool"),
          detail: `0 / ${outline.length}`,
          state: "running",
        }],
      },
    });
    try {
      setSlides(outline.map((o, i) => ({ index: i + 1, title: o.title, status: "pending" })));
      setStage("deck");
      let rendered = 0;
      let failed = 0;
      await streamRender(projectId, (ev) => {
        if (ev.type === "page_rendered") rendered++;
        if (ev.type === "page_error") failed++;
        if (ev.type === "page_rendered" || ev.type === "page_error" || ev.type === "page_start") {
          updateChatMessage(runId, (current) => ({
            ...current,
            process: patchAgentTool(current.process!, "render", {
              state: "running",
              detail: ev.type === "page_start"
                ? `${rendered} / ${outline.length} · ${t("flow.renderingSlide", { index: ev.index })}`
                : `${rendered} / ${outline.length}${failed ? ` · ${t("flow.failedCount", { count: failed })}` : ""}`,
            }),
          }));
        }
        handleRenderEvent(ev);
      });
      updateChatMessage(runId, (current) => ({
        ...current,
        content: `${current.content}\n\n${t("flow.renderDone", { count: rendered })}`,
        ran: elapsedRunLabel(startedAt, locale),
        suggestions: rendered > 0 ? [
          t("flow.suggestionSummary"),
          t("flow.suggestionBusiness"),
          t("flow.suggestionCover"),
          t("flow.suggestionSpecific"),
        ] : undefined,
        process: {
          ...patchAgentTool(current.process!, "render", {
            state: failed ? "error" : "complete",
            detail: `${rendered} / ${outline.length}${failed ? ` · ${t("flow.failedCount", { count: failed })}` : ""}`,
          }),
          state: failed ? "error" : "complete",
          title: failed ? t("flow.renderFinishedWithErrors") : t("flow.renderFinished"),
        },
      }));
    } catch (e: any) {
      updateChatMessage(runId, (current) => ({
        ...current,
        content: `${current.content}\n\n⚠ ${e?.message ?? e}`,
        ran: elapsedRunLabel(startedAt, locale),
        process: {
          ...patchAgentTool(current.process!, "render", { state: "error", detail: String(e?.message ?? e) }),
          state: "error",
          title: t("flow.renderStopped"),
        },
      }));
    } finally {
      setRunning(false);
    }
  }

  /** Conversational edit: plan → apply to targeted slides in order. */
  async function handleChat(request: ChatRequest) {
    const { message, context, attachments } = request;
    const designFiles = request.designFiles ?? [];
    say({ role: "user", content: message, attachment: context, contextItems: attachments, designFiles });
    const runId = createAgentRunId("deck-edit");
    const startedAt = Date.now();
    say({
      id: runId,
      role: "assistant",
      content: "",
      process: {
        state: "running",
        title: t("agent.understanding"),
        notes: [
          t("agent.understandingNote"),
        ],
        tools: [
          ...designFiles.map((file, index) => ({
            id: `read-${index}`,
            name: "read",
            kind: "read" as const,
            label: t("agent.readDesignFile"),
            detail: file.relativePath,
            path: file.path,
            relativePath: file.relativePath,
            state: "running" as const,
          })),
          {
            id: "plan",
            name: "plan_deck_edit",
            kind: "tool",
            label: t("agent.plan"),
            detail: t("agent.planDetail"),
            state: "running",
          },
        ],
      },
    });
    setBusy(true);
    try {
      const plan = await planChatEdit(projectId, message, context, attachments, designFiles);
      const capturedActivities = (plan.activities ?? []).map((tool, index) => ({
        ...tool,
        id: `cli-${tool.id || index}`,
        label: tool.kind === "bash"
          ? t("agent.runCommand")
          : tool.kind === "read"
            ? t("agent.readFile")
            : tool.kind === "write" || tool.kind === "edit"
              ? t("agent.editFiles")
              : tool.kind === "search"
                ? t("agent.search")
                : tool.kind === "todo"
                  ? t("agent.taskList")
                  : t("agent.useTool"),
      }));
      const planDetail = plan.action === "edit"
        ? t(plan.targets.length === 1 ? "agent.targetOne" : "agent.targetMany", { targets: plan.targets.join(", ") })
        : plan.action === "add"
          ? t("agent.addRender")
          : t("agent.replyOnly");
      updateChatMessage(runId, (current) => ({
        ...current,
        process: {
          ...patchAgentTool(
            patchAgentTools(
              capturedActivities.length
                ? { ...current.process!, tools: [...current.process!.tools, ...capturedActivities] }
                : current.process!,
              (tool) => tool.kind === "read",
              { state: "complete" },
            ),
            "plan",
            { state: "complete", detail: planDetail },
          ),
          title: plan.action === "add" ? t("agent.adding") : plan.action === "edit" ? t("agent.applying") : t("agent.reviewed"),
          notes: plan.instruction
            ? [t("agent.plannedChange", { instruction: plan.instruction })]
            : [t("agent.noChange")],
        },
      }));
      if (plan.action === "add") {
        const afterIndex = plan.afterIndex ?? slides.length;
        updateChatMessage(runId, (current) => ({
          ...current,
          process: {
            ...current.process!,
            tools: [
              ...current.process!.tools,
              { id: "add", name: "add_slide", kind: "write", label: t("agent.insert"), detail: t("agent.after", { index: afterIndex }), state: "running" },
              { id: "generate", name: "generate_slide", kind: "edit", label: t("agent.renderSlide"), detail: t("agent.matchStyle"), state: "pending" },
            ],
          },
        }));
        const next = await addProjectSlide(projectId, afterIndex, plan.title);
        const insertedIndex = Math.min(Math.max(afterIndex + 1, 1), next.length);
        setSlides(next.map((slide) => (slide.index === insertedIndex ? { ...slide, status: "working" } : slide)));
        updateChatMessage(runId, (current) => ({
          ...current,
          process: patchAgentTool(
            patchAgentTool(current.process!, "add", { state: "complete", detail: t("agent.inserted", { index: insertedIndex }) }),
            "generate",
            { state: "running", detail: t("agent.renderingSlide", { index: insertedIndex }) },
          ),
        }));
        try {
          const generated = await generateSingleSlide(
            projectId,
            insertedIndex,
            plan.instruction || message,
            plan.title,
          );
          setSlides((items) => items.map((slide) => (slide.index === insertedIndex ? generated : slide)));
          updateChatMessage(runId, (current) => ({
            ...current,
            content: t("agent.addedReply", { reply: plan.reply, index: insertedIndex }),
            ran: elapsedRunLabel(startedAt, locale),
            attachment: {
              slideIndex: insertedIndex,
              title: generated.title || t("chat.slide", { index: insertedIndex }),
              imageUrl: fileUrl(projectId, generated.image, generated.bust),
            },
            process: {
              ...patchAgentTool(current.process!, "generate", { state: "complete", detail: t("agent.renderedSlide", { index: insertedIndex }) }),
              state: "complete",
              title: t("agent.addedSlide", { index: insertedIndex }),
            },
          }));
        } catch (error: any) {
          setSlides((items) =>
            items.map((slide) =>
              slide.index === insertedIndex
                ? { ...slide, status: "error", error: String(error?.message ?? error) }
                : slide,
            ),
          );
          throw error;
        }
        return;
      }
      if (plan.action !== "edit" || !plan.targets?.length) {
        updateChatMessage(runId, (current) => ({
          ...current,
          content: plan.reply,
          ran: elapsedRunLabel(startedAt, locale),
          process: { ...current.process!, state: "complete", title: t("agent.reviewed") },
        }));
        return;
      }
      updateChatMessage(runId, (current) => ({
        ...current,
        process: {
          ...current.process!,
          tools: [
            ...current.process!.tools,
            {
              id: "edit-todos",
              name: "todo_write",
              kind: "todo",
              label: t("agent.editChecklist"),
              detail: t("agent.editChecklistDetail", { count: plan.targets.length }),
              state: "running" as const,
              todos: plan.targets.map((target) => ({
                id: `slide-${target}`,
                content: t("agent.updateSlide", { index: target }),
                status: "pending" as const,
              })),
            },
            ...plan.targets.map((target) => ({
              id: `regenerate-${target}`,
              name: "regenerate_slide",
              kind: "edit" as const,
              label: t("agent.updateSlide", { index: target }),
              detail: t("agent.waitPrevious"),
              state: "pending" as const,
            })),
          ],
        },
      }));
      const failedTargets: number[] = [];
      let lastAttachment: SlideChatContext | undefined;
      for (const target of plan.targets) {
        updateChatMessage(runId, (current) => {
          const nextProcess = patchAgentTool(current.process!, `regenerate-${target}`, {
            state: "running",
            detail: t("agent.redrawing"),
          });
          const todoTool = nextProcess.tools.find((tool) => tool.id === "edit-todos");
          return {
            ...current,
            process: patchAgentTool(nextProcess, "edit-todos", {
              todos: todoTool?.todos?.map((todo) => todo.id === `slide-${target}`
                ? { ...todo, status: "in_progress" as const }
                : todo),
            }),
          };
        });
        setSlides((s) => s.map((x) => (x.index === target ? { ...x, status: "working" } : x)));
        try {
          const image = await regenerateSlide(
            projectId,
            target,
            plan.instruction,
            plan.targets.length === 1 ? plan.title : undefined,
          );
          const bust = Date.now();
          setSlides((s) =>
            s.map((x) =>
              x.index === target
                ? {
                    ...x,
                    title: plan.targets.length === 1 && plan.title ? plan.title : x.title,
                    status: "rendered",
                    image,
                    bust,
                  }
                : x,
            ),
          );
          lastAttachment = {
            slideIndex: target,
            title: (plan.targets.length === 1 ? plan.title : undefined)
              || slides.find((slide) => slide.index === target)?.title
              || t("chat.slide", { index: target }),
            imageUrl: fileUrl(projectId, image, bust),
          };
          updateChatMessage(runId, (current) => {
            const nextProcess = patchAgentTool(current.process!, `regenerate-${target}`, {
              state: "complete",
              detail: t("agent.updatedSlide", { index: target }),
            });
            const todoTool = nextProcess.tools.find((tool) => tool.id === "edit-todos");
            return {
              ...current,
              process: patchAgentTool(nextProcess, "edit-todos", {
                todos: todoTool?.todos?.map((todo) => todo.id === `slide-${target}`
                  ? { ...todo, status: "complete" as const }
                  : todo),
              }),
            };
          });
        } catch (e: any) {
          failedTargets.push(target);
          setSlides((s) =>
            s.map((x) => (x.index === target ? { ...x, status: "error", error: String(e?.message ?? e) } : x)),
          );
          updateChatMessage(runId, (current) => {
            const nextProcess = patchAgentTool(current.process!, `regenerate-${target}`, {
              state: "error",
              detail: String(e?.message ?? e),
            });
            const todoTool = nextProcess.tools.find((tool) => tool.id === "edit-todos");
            return {
              ...current,
              process: patchAgentTool(nextProcess, "edit-todos", {
                todos: todoTool?.todos?.map((todo) => todo.id === `slide-${target}`
                  ? { ...todo, status: "error" as const }
                  : todo),
              }),
            };
          });
        }
      }
      updateChatMessage(runId, (current) => ({
        ...current,
        content: failedTargets.length
          ? t("agent.partialFailure", { reply: plan.reply, targets: failedTargets.join(", ") })
          : t("agent.updatedReply", { reply: plan.reply, targets: plan.targets.join(", ") }),
        ran: elapsedRunLabel(startedAt, locale),
        attachment: lastAttachment,
        process: {
          ...patchAgentTool(current.process!, "edit-todos", {
            state: failedTargets.length ? "error" : "complete",
          }),
          state: failedTargets.length ? "error" : "complete",
          title: failedTargets.length ? t("agent.editErrors") : t("agent.editComplete"),
        },
      }));
    } catch (e: any) {
      updateChatMessage(runId, (current) => ({
        ...current,
        content: `⚠ ${e?.message ?? e}`,
        ran: elapsedRunLabel(startedAt, locale),
        process: {
          ...stopRunningTools(current.process!, String(e?.message ?? e)),
          state: "error",
          title: t("agent.editFailed"),
        },
      }));
    } finally {
      setBusy(false);
    }
  }

  function askAboutSlide(slide: UiSlide) {
    setChatContext({
      slideIndex: slide.index,
      title: slide.title || t("chat.slide", { index: slide.index }),
      imageUrl: fileUrl(projectId, slide.image, slide.bust),
    });
    setChatFocusKey((key) => key + 1);
  }

  function mirrorMarkToChat(event: MarkAgentEvent) {
    if (event.type === "request") {
      say({
        role: "user",
        content: event.note || t("agent.markRequest", { index: event.slide.index }),
        attachment: {
          slideIndex: event.slide.index,
          title: `${event.slide.title} · ${t("agent.visualMark")}`,
          imageUrl: fileUrl(projectId, event.markedImage),
        },
      });
      const runId = createAgentRunId("visual-mark");
      markRunRef.current = { id: runId, startedAt: Date.now(), slideIndex: event.slide.index };
      say({
        id: runId,
        role: "assistant",
        content: "",
        process: {
          state: "running",
          title: t("agent.editingSlide", { index: event.slide.index }),
          notes: [
            t("agent.markNoteOne"),
            t("agent.markNoteTwo"),
          ],
          tools: [
            {
              id: "mark-edit",
              name: "mark_edit_page",
              label: t("agent.applyVisual"),
              detail: t("agent.processMark", { index: event.slide.index }),
              state: "running",
            },
          ],
        },
      });
    } else if (event.type === "complete") {
      const run = markRunRef.current;
      if (!run) return;
      updateChatMessage(run.id, (current) => ({
        ...current,
        content: t("agent.markApplied", { index: event.slide.index }),
        ran: elapsedRunLabel(run.startedAt, locale),
        attachment: {
          slideIndex: event.slide.index,
          title: `${event.slide.title} · ${t("agent.updated")}`,
          imageUrl: fileUrl(projectId, event.image, Date.now()),
        },
        process: {
          ...patchAgentTool(current.process!, "mark-edit", { state: "complete", detail: t("agent.updatedSaved") }),
          state: "complete",
          title: t("agent.updatedSlide", { index: event.slide.index }),
        },
      }));
      markRunRef.current = null;
    } else if (event.type === "error") {
      const run = markRunRef.current;
      if (!run) return;
      updateChatMessage(run.id, (current) => ({
        ...current,
        content: `⚠ ${event.error}`,
        ran: elapsedRunLabel(run.startedAt, locale),
        process: {
          ...patchAgentTool(current.process!, "mark-edit", { state: "error", detail: event.error }),
          state: "error",
          title: t("agent.notUpdated", { index: event.slide.index }),
        },
      }));
      markRunRef.current = null;
    }
  }

  function closeBrandDesignSystem() {
    if (retuning || designSystemSaving) return;
    setShowDesignSystem(false);
    designSystemTriggerRef.current?.focus();
  }

  /** Persist always-on brand context; optionally apply it to every existing slide. */
  async function saveBrandDesignSystem(input: BrandDesignSystemSubmit) {
    if (retuning || designSystemSaving || busy || running) return;
    const redraw = input.redraw && stage === "deck";
    setDesignSystemError("");
    setDesignSystemSaving(true);
    if (redraw) {
      setRetuning(true);
      setDesignSystemProgress(1);
      setBusy(true);
      say({ role: "assistant", content: t("restyle.started", { count: slides.length }) });
    }
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: input.template ?? "",
          style: [input.designSystem.style.direction, input.designSystem.style.keywords].filter(Boolean).join(". "),
          materialIds: input.materialIds,
          designSystem: input.designSystem,
        }),
      });
      const saved = await response.json().catch(() => null);
      if (!response.ok || !saved) throw new Error(saved?.error || t("brandSystem.saveFailed"));
      setProject(saved as Project);
      setInspirationSkipped(false);

      if (redraw) {
        for (const [position, slide] of slides.entries()) {
          setDesignSystemProgress(position + 1);
          setSlides((items) => items.map((item) => (item.index === slide.index ? { ...item, status: "working" } : item)));
          try {
            const image = await regenerateSlide(projectId, slide.index);
            setSlides((items) =>
              items.map((item) =>
                item.index === slide.index ? { ...item, status: "rendered", image, bust: Date.now() } : item,
              ),
            );
          } catch {
            /* Keep applying the shared system to the remaining slides. */
          }
        }
      }

      setShowDesignSystem(false);
      requestAnimationFrame(() => designSystemTriggerRef.current?.focus());
      say({
        role: "assistant",
        content: redraw
          ? t("restyle.done", { count: slides.length })
          : t("brandSystem.saved"),
      });
    } catch (error: any) {
      const message = String(error?.message ?? error);
      setDesignSystemError(message);
      if (redraw) say({ role: "assistant", content: `⚠ ${message}` });
    } finally {
      setDesignSystemProgress(0);
      setDesignSystemSaving(false);
      setRetuning(false);
      if (redraw) setBusy(false);
    }
  }

  const status: GenStatus | null =
    stage === "outline"
      ? running
        ? { phase: "outlining", total: 0, done: 0 }
        : null
      : deriveStatus(slides, {
          streaming: running,
          editing: busy,
          note: retuning ? t("brandSystem.redrawProgress", { current: designSystemProgress, total: slides.length }) : undefined,
        });
  const renderedSlides = slides.filter((slide) => slide.status === "rendered").length;
  const templateLabel = project.config.template
    ? getTemplate(project.config.template)?.name
      ?? getCommunityTemplate(project.config.template)?.name
      ?? project.config.template
    : project.config.designSystem?.brand.name
      || project.config.designSystem?.style.direction
      || undefined;
  const workflow = buildWorkflowProgress({
    stage,
    outlineCount: outline.length,
    templateLabel,
    inspirationSkipped,
    running: stage === "deck" && running,
    rendered: renderedSlides,
    total: slides.length || outline.length,
      renderDetail: status?.phase === "rendering"
      ? status.note
        || (status.current
            ? t("status.renderingNamed", { index: status.current, title: status.currentTitle ? ` · ${status.currentTitle}` : "" })
            : t("status.renderingCount", { done: status.done, total: status.total }))
        : undefined,
      locale,
    });
  const workspaceTabs = (
    <WorkspaceModeTabs
      mode={workspaceView === "files" ? "files" : "canvas"}
      onChange={(mode) => setWorkspaceView(mode === "files" ? "files" : "deck")}
    />
  );
  const designSystem = normalizeDeckDesignSystem(project.config.designSystem, {
    template: project.config.template,
    style: project.config.style,
  });
  const activeBrandMaterialIds = new Set(designSystem.brand.assetMaterialIds);
  const designSystemMaterials: MaterialTrayItem[] = (project.materials ?? [])
    .filter((item) => activeBrandMaterialIds.has(item.id) && item.kind !== "file")
    .map((item) => ({
      id: item.id,
      name: item.name,
      url: `/api/projects/${encodeURIComponent(projectId)}/materials/${encodeURIComponent(item.file)}`,
    }));
  const brandSystemTrigger = (
    <button
      ref={designSystemTriggerRef}
      type="button"
      className={`iconbtn brand-system-trigger${showDesignSystem ? " active" : ""}`}
      onClick={() => {
        setDesignSystemError("");
        setShowDesignSystem((visible) => !visible);
      }}
      aria-expanded={showDesignSystem}
      aria-controls="brand-design-system-panel"
      aria-haspopup="dialog"
      disabled={busy || running || retuning || designSystemSaving}
      title={t("brandSystem.open")}
    >
      <Palette size={16} weight="regular" aria-hidden="true" />
      <span className="brand-system-trigger-label">{t("brandSystem.button")}</span>
      <span className="brand-system-trigger-swatches" aria-hidden="true">
        {[designSystem.colors.primary, designSystem.colors.accent, designSystem.colors.ink, designSystem.colors.surface]
          .map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}
      </span>
    </button>
  );

  return (
    <div className="ws project-ws">
      <ChatColumn
        projectId={projectId}
        workspaceTitle={project.title}
        homeHref="/"
        messages={chat}
        busy={busy || running}
        onSend={enqueueOrRun}
        status={status}
        queued={queue}
        context={chatContext}
        onClearContext={() => setChatContext(null)}
        focusKey={chatFocusKey}
        onSelectSlide={locateChatSlide}
        onInspire={onInspire}
        onOpenDesignFile={openDesignFile}
        workflow={workflow}
        conversations={conversationState.summaries}
        activeConversationId={conversationState.activeConversationId}
        onSelectConversation={(id) => {
          if (busy || running) return;
          setQueue([]);
          setChatContext(null);
          conversationState.selectConversation(id);
        }}
        onCreateConversation={() => {
          if (busy || running) return;
          setQueue([]);
          setChatContext(null);
          conversationState.createConversation();
        }}
        onRenameConversation={conversationState.renameConversation}
        onDeleteConversation={conversationState.deleteConversation}
        conversationManagementDisabled={busy || running}
        placeholder={
          stage === "outline"
            ? t("flow.placeholderOutline")
            : stage === "inspire"
              ? t("flow.placeholderInspire")
              : t("flow.placeholderDeck")
        }
      />
      <div className="deckpane">
        {workspaceView === "files" ? (
          <DesignFiles
            projectId={projectId}
            title={project.title}
            showProjectTitle={false}
            initialPath={designFilePath}
            selectionRequestKey={designFileOpenKey}
            headerPrefix={workspaceTabs}
            onClose={() => setWorkspaceView("deck")}
          />
        ) : stage === "outline" ? (
          <OutlineBoard
            title={project.title}
            showTitle={false}
            aspect={project.config.aspect}
            outline={outline}
            onChange={onOutlineChange}
            onConfirm={confirmOutline}
            busy={running && outline.length > 0}
            streaming={false}
            researchDoc={project.researchDoc}
            headerPrefix={workspaceTabs}
            headerExtra={brandSystemTrigger}
          />
        ) : (
          // Both "inspire" (pending skeleton deck while picking a style) and
          // "deck" render the SlideStage; the in-chat card + popup drive the pick.
          <SlideStage
            projectId={projectId}
            aspect={project.config.aspect}
            title={project.title}
            showTitle={false}
            slides={slides}
            onSlides={(u) => setSlides(u)}
            busy={busy}
            setBusy={setBusy}
            streaming={stage === "inspire" || running}
            headerPrefix={workspaceTabs}
            onAskSlide={askAboutSlide}
            onMarkAgentEvent={mirrorMarkToChat}
            focusSlideIndex={focusSlideIndex}
            focusSlideKey={focusSlideKey}
            headerExtra={<div className="deck-header-extras">{brandSystemTrigger}</div>}
          />
        )}
        {showDesignSystem && (
          <>
            <button
              className="retune-scrim"
              aria-label={t("brandSystem.close")}
              onClick={closeBrandDesignSystem}
            />
            <BrandDesignSystemPanel
              value={designSystem}
              initialTemplate={project.config.template}
              initialMaterials={designSystemMaterials}
              slideCount={stage === "deck" ? slides.length : 0}
              saving={designSystemSaving}
              redrawing={retuning}
              progress={designSystemProgress}
              error={designSystemError}
              onClose={closeBrandDesignSystem}
              onSubmit={(input) => void saveBrandDesignSystem(input)}
            />
          </>
        )}
      </div>
      {inspireOpen && (
        <InspireDialog
          requirement={project.config.requirement}
          outlineTitles={outline.map((o) => o.title).filter(Boolean)}
          selected={project.config.template}
          onClose={() => setInspireOpen(false)}
          onSkip={() => handleInspireGenerate(undefined)}
          onSubmit={(id) => handleInspireGenerate(id)}
        />
      )}
    </div>
  );
}
