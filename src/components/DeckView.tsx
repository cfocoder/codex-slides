"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowsClockwise, Palette, WarningCircle, X } from "@phosphor-icons/react";
import DesignFiles from "@/components/DesignFiles";
import ChatColumn, { type ChatMsg } from "@/components/ChatColumn";
import MaterialTray from "@/components/MaterialTray";
import OutlineBoard from "@/components/OutlineBoard";
import InspireDialog from "@/components/InspireDialog";
import SlideStage, { type MarkAgentEvent } from "@/components/SlideStage";
import TemplatePicker from "@/components/TemplatePicker";
import WorkspaceModeTabs from "@/components/WorkspaceModeTabs";
import {
  COMMUNITY_TEMPLATES,
  getCommunityTemplate,
  inspireQueryFor,
  matchCommunityTemplates,
} from "@/lib/community";
import {
  addProjectSlide,
  deriveStatus,
  fileUrl,
  generateSingleSlide,
  patchProjectStyle,
  planChatEdit,
  regenerateSlide,
  reviseOutlineChat,
  saveConversations,
  saveOutline,
  streamRender,
  type ChatRequest,
  type GenStatus,
  type SlideChatContext,
  type UiSlide,
} from "@/lib/deckEdit";
import type { OutlinePage, ProgressEvent, Project } from "@/lib/types";
import { outlineSnapshotMessage, styleSnapshotMessage } from "@/lib/chatArtifacts";
import { useChatConversations } from "@/lib/useChatConversations";
import { buildWorkflowProgress } from "@/lib/workflowProgress";
import { useI18n } from "@/i18n/I18nProvider";
import { translate, type UiLocale } from "@/i18n/messages";
import {
  createAgentRunId,
  elapsedRunLabel,
  patchAgentTool,
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

function projectChat(project: Project, locale: UiLocale): ChatMsg[] {
  if (Array.isArray(project.chat) && project.chat.length) {
    return project.chat as unknown as ChatMsg[];
  }
  const rendered = project.pages.filter((slide) => slide.status === "rendered").length;
  return [
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
}

/** Shows a persisted project immediately from server-provided data. */
export default function DeckView({ projectId, initialProject }: { projectId: string; initialProject: Project }) {
  const { locale, t } = useI18n();
  const [project, setProject] = useState<Project>(initialProject);
  const [workspaceView, setWorkspaceView] = useState<"deck" | "files">("deck");
  const [designFilePath, setDesignFilePath] = useState<string | undefined>();
  const [slides, setSlides] = useState<UiSlide[]>(() => projectSlides(initialProject));
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<"outline" | "inspire" | "deck">(
    initialProject.status === "draft" ? "outline" : "deck",
  );
  const [outline, setOutline] = useState<OutlinePage[]>(() => projectOutline(initialProject));
  const conversationState = useChatConversations({
    initialConversations: initialProject.conversations,
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
    initialProject.status !== "draft" && !initialProject.config.template,
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markRunRef = useRef<{ id: string; startedAt: number; slideIndex: number } | null>(null);

  const [showTune, setShowTune] = useState(false);
  const [retuneTemplate, setRetuneTemplate] = useState<string | undefined>(initialProject.config.template);
  const [retuneMaterialIds, setRetuneMaterialIds] = useState<string[]>([]);
  const [retuning, setRetuning] = useState(false);
  const [retuneProgress, setRetuneProgress] = useState(0);
  const retunePanelRef = useRef<HTMLElement>(null);
  const retuneTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showTune) return;
    requestAnimationFrame(() => retunePanelRef.current?.focus());
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || retuning) return;
      setShowTune(false);
      retuneTriggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showTune, retuning]);

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

  // --- draft outline stage (编辑大纲 → 确认 → 渲染) ---

  function onOutlineChange(pages: OutlinePage[]) {
    setOutline(pages);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveOutline(projectId, pages).catch(() => {});
    }, 700);
  }

  async function handleOutlineChat(request: ChatRequest) {
    say({ role: "user", content: request.message, attachment: request.context, contextItems: request.attachments });
    setBusy(true);
    try {
      const { pages, reply } = await reviseOutlineChat(projectId, request.message);
      setOutline(pages);
      say({ role: "assistant", content: reply || t("flow.outlineUpdated") });
    } catch (e: any) {
      say({ role: "assistant", content: `⚠ ${e?.message ?? e}` });
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
    if (!project?.config.template) {
      // Detour to the inspiration step: pending skeleton deck + an in-chat card
      // whose Browse button opens the style popup. Render waits for pick/skip.
      setSlides(outline.map((o, i) => ({ index: i + 1, title: o.title, status: "pending" })));
      setStage("inspire");
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
    say(styleSnapshotMessage(project.config.template, project.config.requirement));
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
      setInspirationSkipped(true);
      say({ role: "user", content: t("flow.styleSkipped") });
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
        title: locale === "zh-CN" ? "正在生成页面" : "Generating slides",
        notes: [locale === "zh-CN" ? "大纲与视觉参考已锁定，正在逐页绘制。" : "The outline and visual reference are locked while pages render."],
        tools: [{
          id: "render",
          name: "render_deck",
          label: locale === "zh-CN" ? "生成演示页面" : "Render presentation pages",
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
                ? `${rendered} / ${outline.length} · ${locale === "zh-CN" ? `正在生成第 ${ev.index} 页` : `Rendering slide ${ev.index}`}`
                : `${rendered} / ${outline.length}${failed ? ` · ${failed} failed` : ""}`,
            }),
          }));
        }
        handleRenderEvent(ev);
      });
      updateChatMessage(runId, (current) => ({
        ...current,
        content: `${current.content}\n\n${t("flow.renderDone", { count: rendered })}`,
        ran: elapsedRunLabel(startedAt),
        suggestions: rendered > 0 ? [
          t("flow.suggestionSummary"),
          t("flow.suggestionBusiness"),
          t("flow.suggestionCover"),
          t("flow.suggestionSpecific"),
        ] : undefined,
        process: {
          ...patchAgentTool(current.process!, "render", {
            state: failed ? "error" : "complete",
            detail: `${rendered} / ${outline.length}${failed ? ` · ${failed} failed` : ""}`,
          }),
          state: failed ? "error" : "complete",
          title: failed
            ? locale === "zh-CN" ? "页面生成完成，部分失败" : "Generation finished with errors"
            : locale === "zh-CN" ? "页面生成完成" : "Slides generated",
        },
      }));
    } catch (e: any) {
      updateChatMessage(runId, (current) => ({
        ...current,
        content: `${current.content}\n\n⚠ ${e?.message ?? e}`,
        ran: elapsedRunLabel(startedAt),
        process: {
          ...patchAgentTool(current.process!, "render", { state: "error", detail: String(e?.message ?? e) }),
          state: "error",
          title: locale === "zh-CN" ? "页面生成中断" : "Slide generation stopped",
        },
      }));
    } finally {
      setRunning(false);
    }
  }

  /** Conversational edit: plan → apply to targeted slides in order. */
  async function handleChat(request: ChatRequest) {
    const { message, context, attachments } = request;
    say({ role: "user", content: message, attachment: context, contextItems: attachments });
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
          {
            id: "plan",
            name: "plan_deck_edit",
            label: t("agent.plan"),
            detail: t("agent.planDetail"),
            state: "running",
          },
        ],
      },
    });
    setBusy(true);
    try {
      const plan = await planChatEdit(projectId, message, context, attachments);
      const planDetail = plan.action === "edit"
        ? t(plan.targets.length === 1 ? "agent.targetOne" : "agent.targetMany", { targets: plan.targets.join(", ") })
        : plan.action === "add"
          ? t("agent.addRender")
          : t("agent.replyOnly");
      updateChatMessage(runId, (current) => ({
        ...current,
        process: {
          ...patchAgentTool(current.process!, "plan", { state: "complete", detail: planDetail }),
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
              { id: "add", name: "add_slide", label: t("agent.insert"), detail: t("agent.after", { index: afterIndex }), state: "running" },
              { id: "generate", name: "generate_slide", label: t("agent.renderSlide"), detail: t("agent.matchStyle"), state: "pending" },
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
            ...plan.targets.map((target) => ({
              id: `regenerate-${target}`,
              name: "regenerate_slide",
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
        updateChatMessage(runId, (current) => ({
          ...current,
          process: patchAgentTool(current.process!, `regenerate-${target}`, {
            state: "running",
            detail: t("agent.redrawing"),
          }),
        }));
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
          updateChatMessage(runId, (current) => ({
            ...current,
            process: patchAgentTool(current.process!, `regenerate-${target}`, {
              state: "complete",
              detail: t("agent.updatedSlide", { index: target }),
            }),
          }));
        } catch (e: any) {
          failedTargets.push(target);
          setSlides((s) =>
            s.map((x) => (x.index === target ? { ...x, status: "error", error: String(e?.message ?? e) } : x)),
          );
          updateChatMessage(runId, (current) => ({
            ...current,
            process: patchAgentTool(current.process!, `regenerate-${target}`, {
              state: "error",
              detail: String(e?.message ?? e),
            }),
          }));
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
          ...current.process!,
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

  function closeRestylePanel() {
    if (retuning) return;
    setShowTune(false);
    retuneTriggerRef.current?.focus();
  }

  /** Apply a visual system / brand references, then redraw every slide. */
  async function applyRetune() {
    if (retuning || busy) return;
    setRetuning(true);
    setRetuneProgress(1);
    setBusy(true);
    say({ role: "assistant", content: t("restyle.started", { count: slides.length }) });
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: retuneTemplate ?? "", materialIds: retuneMaterialIds }),
      });
      if (!response.ok) throw new Error(t("restyle.saveFailed"));
      for (const [position, slide] of slides.entries()) {
        setRetuneProgress(position + 1);
        setSlides((items) => items.map((item) => (item.index === slide.index ? { ...item, status: "working" } : item)));
        try {
          const image = await regenerateSlide(projectId, slide.index);
          setSlides((items) =>
            items.map((item) =>
              item.index === slide.index ? { ...item, status: "rendered", image, bust: Date.now() } : item,
            ),
          );
        } catch {
          /* keep going */
        }
      }
      setShowTune(false);
      requestAnimationFrame(() => retuneTriggerRef.current?.focus());
      say({ role: "assistant", content: t("restyle.done", { count: slides.length }) });
    } catch (error: any) {
      say({ role: "assistant", content: `⚠ ${error?.message ?? error}` });
    } finally {
      setRetuneProgress(0);
      setRetuning(false);
      setBusy(false);
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
          note: retuning ? t("restyle.progress", { current: retuneProgress, total: slides.length }) : undefined,
        });
  const renderedSlides = slides.filter((slide) => slide.status === "rendered").length;
  const templateLabel = project.config.template
    ? getCommunityTemplate(project.config.template)?.name ?? project.config.template
    : undefined;
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

  return (
    <div className="ws project-ws">
      <ChatColumn
        label={t("chat.deckAgent")}
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
      {workspaceView === "files" ? (
        <div className="deckpane">
          <DesignFiles
            projectId={projectId}
            title={project.title}
            initialPath={designFilePath}
            headerPrefix={workspaceTabs}
            onClose={() => setWorkspaceView("deck")}
          />
        </div>
      ) : stage === "outline" ? (
        <OutlineBoard
          title={project.title}
          aspect={project.config.aspect}
          outline={outline}
          onChange={onOutlineChange}
          onConfirm={confirmOutline}
          busy={running && outline.length > 0}
          streaming={false}
          researchDoc={project.researchDoc}
          headerPrefix={workspaceTabs}
        />
      ) : (
        // Both "inspire" (pending skeleton deck while picking a style) and
        // "deck" render the SlideStage; the in-chat card + popup drive the pick.
        <div className="deckpane">
          <SlideStage
            projectId={projectId}
            aspect={project.config.aspect}
            title={project.title}
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
            headerExtra={
              stage !== "inspire" ? (
              <div className="deck-header-extras">
              <button
                ref={retuneTriggerRef}
                className={`iconbtn restyle-trigger${showTune ? " active" : ""}`}
                onClick={() => setShowTune((visible) => !visible)}
                aria-expanded={showTune}
                aria-controls="restyle-deck-panel"
                disabled={retuning}
                title={t("restyle.open")}
              >
                <Palette size={16} weight="regular" aria-hidden="true" />
                {t("restyle.button")}
              </button>
              </div>
              ) : undefined
            }
          />
          {showTune && (
            <>
              <button className="retune-scrim" aria-label={t("restyle.close")} onClick={closeRestylePanel} />
              <aside
                id="restyle-deck-panel"
                className="retune-panel"
                ref={retunePanelRef}
                role="dialog"
                aria-labelledby="restyle-deck-title"
                tabIndex={-1}
              >
                <div className="retune-panel-head">
                  <div className="retune-heading">
                    <span className="retune-heading-icon" aria-hidden="true">
                      <Palette size={19} weight="regular" />
                    </span>
                    <div>
                      <h2 id="restyle-deck-title">{t("restyle.title")}</h2>
                      <p>{t("restyle.subtitle")}</p>
                    </div>
                  </div>
                  <button type="button" className="retune-close" onClick={closeRestylePanel} aria-label={t("restyle.close")}>
                    <X size={17} weight="bold" aria-hidden="true" />
                  </button>
                </div>
                <div className="retune-panel-body">
                  <TemplatePicker value={retuneTemplate} onChange={setRetuneTemplate} />
                  <MaterialTray onChange={setRetuneMaterialIds} />
                </div>
                <div className="retune-panel-footer">
                  <div className="retune-impact">
                    <WarningCircle size={18} weight="regular" aria-hidden="true" />
                    <span>
                      <strong>{t("restyle.warning")}</strong>
                      <small>{t("restyle.warningHelp")}</small>
                    </span>
                  </div>
                  <button className="retune-apply" onClick={applyRetune} disabled={retuning || busy}>
                    <ArrowsClockwise size={17} weight="bold" aria-hidden="true" />
                    {retuning
                      ? t("restyle.progress", { current: retuneProgress, total: slides.length })
                      : t(slides.length === 1 ? "restyle.allOne" : "restyle.allMany", { count: slides.length })}
                  </button>
                </div>
              </aside>
            </>
          )}
        </div>
      )}
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
