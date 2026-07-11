"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChatColumn, { type ChatMsg } from "@/components/ChatColumn";
import Composer from "@/components/Composer";
import Community from "@/components/Community";
import DesignFilesPanel from "@/components/DesignFilesPanel";
import OnboardForm from "@/components/OnboardForm";
import OutlineBoard from "@/components/OutlineBoard";
import InspireDialog from "@/components/InspireDialog";
import RecentProjects from "@/components/RecentProjects";
import ScenarioPicker from "@/components/ScenarioPicker";
import SlideStage, { type MarkAgentEvent } from "@/components/SlideStage";
import TopBar from "@/components/TopBar";
import WorkspaceModeTabs from "@/components/WorkspaceModeTabs";
import {
  addProjectSlide,
  deriveStatus,
  fileUrl,
  generateSingleSlide,
  planChatEdit,
  regenerateSlide,
  patchProjectStyle,
  reviseOutlineChat,
  saveConversations,
  saveOutline,
  streamOutline,
  streamRender,
  type ChatRequest,
  type GenStatus,
  type SlideChatContext,
  type UiSlide,
} from "@/lib/deckEdit";
import { mergeContextItems, type ContextItem } from "@/lib/contextItems";
import {
  getScenario,
  isScenarioStarter,
  scenarioText,
  type PresentationScenario,
} from "@/lib/scenarios";
import type { QuestionSpec } from "@/lib/onboard";
import { getTemplate } from "@/lib/templates";
import {
  COMMUNITY_TEMPLATES,
  getCommunityTemplate,
  inspireQueryFor,
  matchCommunityTemplates,
} from "@/lib/community";
import {
  DEFAULT_CONFIG,
  type ContextOptionItem,
  type OutlinePage,
  type PptConfig,
  type ProgressEvent,
} from "@/lib/types";
import {
  createAgentRunId,
  elapsedRunLabel,
  patchAgentTool,
  stopRunningTools,
} from "@/lib/agentActivity";
import { outlineSnapshotMessage, styleSnapshotMessage } from "@/lib/chatArtifacts";
import { useChatConversations } from "@/lib/useChatConversations";
import { buildWorkflowProgress } from "@/lib/workflowProgress";
import type { DesignFile, WorkspaceMode } from "@/lib/designFiles";
import { useI18n } from "@/i18n/I18nProvider";

interface EngineInfo {
  engine: string;
  label: string;
  available: boolean;
}

/** Full chain: idle (launcher) → work. Within work the right pane walks
 *  clarify → outline → deck, so there is no separate full-page step. */
type Phase = "idle" | "work";
type Stage = "clarify" | "outline" | "inspire" | "deck";

export default function Home() {
  const { locale, t } = useI18n();
  const [config, setConfig] = useState<PptConfig>({ ...DEFAULT_CONFIG, requirement: "" });
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [codexReady, setCodexReady] = useState<boolean | null>(null);
  const [agentLabel, setAgentLabel] = useState<string>("");

  const [materials, setMaterials] = useState<ContextItem[]>([]);
  const [researchMode, setResearchMode] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState<Stage>("clarify");
  const [questions, setQuestions] = useState<QuestionSpec[]>([]);
  const [clarifyBusy, setClarifyBusy] = useState(false);
  const [clarifyAnswerSummary, setClarifyAnswerSummary] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("canvas");
  const [selectedDesignFileId, setSelectedDesignFileId] = useState<string>("questions");

  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [outline, setOutline] = useState<OutlinePage[]>([]);
  const [researchDoc, setResearchDoc] = useState("");
  const [researchNote, setResearchNote] = useState("");
  const [slides, setSlides] = useState<UiSlide[]>([]);
  const conversationState = useChatConversations({
    initialMessages: [],
    initialTitle: t("chat.newConversationTitle"),
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
  const [inspirationSkipped, setInspirationSkipped] = useState(false);
  const [scenarioOpenRequestKey, setScenarioOpenRequestKey] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markRunRef = useRef<{ id: string; startedAt: number; slideIndex: number } | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => {
        setCodexReady(!!d.codexReady);
        setEngines(d.engines ?? []);
        const found = (d.agents ?? []).filter((a: any) => a.available).map((a: any) => a.label);
        setAgentLabel(found.length ? `local agents: ${found.join(", ")}` : "no local agent CLI");
      })
      .catch(() => setCodexReady(false));
  }, []);

  const patchConfig = (patch: Partial<PptConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const say = (m: ChatMsg) => setChat((c) => [...c, m]);

  function updateChatMessage(id: string, update: (message: ChatMsg) => ChatMsg) {
    setChat((messages) => messages.map((message) => (message.id === id ? update(message) : message)));
  }

  function locateChatSlide(index: number) {
    setWorkspaceMode("canvas");
    setStage("deck");
    setFocusSlideIndex(index);
    setFocusSlideKey((key) => key + 1);
  }

  function openDesignFile(id: string) {
    setSelectedDesignFileId(id);
    setWorkspaceMode("files");
  }

  function onAddItems(next: ContextItem[]) {
    setMaterials(next);
    patchConfig({ materialIds: next.map((item) => item.id) });
  }
  function onRemoveMaterial(id: string) {
    const next = materials.filter((m) => m.id !== id);
    setMaterials(next);
    patchConfig({
      materialIds: next.map((m) => m.id),
      materialContexts: config.materialContexts?.filter((item) => item.id !== id),
    });
  }
  function selectScenario(scenario: PresentationScenario) {
    const current = config.requirement.trim();
    patchConfig({
      scenarioId: scenario.id,
      requirement: !current || isScenarioStarter(current)
        ? scenarioText(scenario.starter, locale)
        : config.requirement,
      pages: scenario.defaults.pages,
      aspect: scenario.defaults.aspect,
      style: scenario.defaults.style,
    });
    setResearchMode(Boolean(scenario.defaults.research));
  }
  function clearScenario() {
    patchConfig({ scenarioId: undefined });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedScenario = getScenario(params.get("scenario"));
    if (requestedScenario) selectScenario(requestedScenario);
    if (params.get("view") === "scenarios") setScenarioOpenRequestKey((key) => key + 1);
    // Browser deep links are consumed once on mount; subsequent UI state stays local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Reference images attached to a clarify question join the shared materials. */
  function attachClarifyImages(items: ContextItem[]) {
    onAddItems(mergeContextItems(materials, items));
  }

  // ---------------- step 1: clarify ----------------

  function submit(
    contextOptions: ContextOptionItem[],
    materialContexts: Array<{ id: string; name: string; role: string }> = [],
  ) {
    if (running || busy || clarifyBusy) return;
    if (!config.requirement.trim() && !materials.length) return;
    const cfg = config.requirement.trim()
      ? { ...config, materialContexts }
      : { ...config, requirement: t("flow.attachedRequirement"), materialContexts };
    beginClarify(cfg, contextOptions);
  }

  async function beginClarify(cfg: PptConfig, contextOptions: ContextOptionItem[]) {
    setConfig(cfg);
    setPhase("work");
    setStage("clarify");
    setRunning(false);
    setBusy(false);
    setProjectId(null);
    setTitle("");
    setSlides([]);
    setOutline([]);
    setResearchDoc("");
    setResearchNote("");
    setInspirationSkipped(false);
    setClarifyAnswerSummary("");
    setWorkspaceMode("canvas");
    setSelectedDesignFileId("questions");
    setChatContext(null);
    setQueue([]);
    setQuestions([]);

    conversationState.resetConversations([
      {
        role: "user",
        content: cfg.requirement,
        contextItems: materials,
        contextOptions,
      },
      { role: "assistant", content: t("flow.clarifyIntro") },
    ], cfg.requirement);

    setClarifyBusy(true);
    try {
      const r = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement: cfg.requirement, scenarioId: cfg.scenarioId, uiLocale: locale }),
      });
      const d = await r.json();
      if (r.ok && Array.isArray(d.questions) && d.questions.length) {
        const nextQuestions = d.questions as QuestionSpec[];
        setQuestions(nextQuestions);
        say({
          role: "assistant",
          content: t("designFiles.questionsPrepared", { count: nextQuestions.length }),
          artifact: {
            id: "questions",
            kind: "questions",
            title: t("designFiles.questionsTitle"),
            subtitle: t("designFiles.questionsPending", { count: nextQuestions.length }),
          },
        });
      } else {
        proceedToOutline(cfg);
      }
    } catch {
      proceedToOutline(cfg);
    } finally {
      setClarifyBusy(false);
    }
  }

  function applyClarify(patch: Partial<PptConfig>, suffix: string, summary: string) {
    const cfg: PptConfig = { ...config, ...patch, requirement: config.requirement + suffix };
    setClarifyAnswerSummary(summary.trim());
    setWorkspaceMode("canvas");
    if (summary.trim()) say({ role: "user", content: t("flow.confirmed", { summary }) });
    proceedToOutline(cfg);
  }

  function skipClarify() {
    setClarifyAnswerSummary(t("designFiles.questionsSkipped"));
    setWorkspaceMode("canvas");
    say({ role: "user", content: t("flow.skipClarify") });
    proceedToOutline(config);
  }

  // ---------------- step 2: search + outline ----------------

  async function proceedToOutline(base: PptConfig) {
    const cfg: PptConfig = { ...base, mode: researchMode ? "research" : "direct" };
    setConfig(cfg);
    setStage("outline");
    setWorkspaceMode("canvas");
    setRunning(true);
    setProjectId(null);
    setTitle("");
    setSlides([]);
    setOutline([]);
    setResearchDoc("");
    setResearchNote("");
    try {
      await streamOutline(cfg, handleOutlineEvent);
    } catch (e: any) {
      say({ role: "assistant", content: `⚠ ${e?.message ?? e}` });
    } finally {
      setRunning(false);
    }
  }

  function handleOutlineEvent(ev: ProgressEvent) {
    switch (ev.type) {
      case "agent":
        setAgentLabel(`using ${ev.agent}`);
        break;
      case "research":
        if (ev.phase === "searching") setResearchNote(t("flow.searching", { detail: ev.detail ?? "" }));
        else if (ev.phase === "synthesizing") setResearchNote(t("flow.synthesizing", { detail: ev.detail ?? "" }));
        else if (ev.phase === "brief" && ev.markdown) setResearchDoc(ev.markdown);
        break;
      case "project":
        setProjectId(ev.id);
        break;
      case "outline":
        setTitle(ev.title);
        setOutline(ev.outline.map((o) => ({ title: o.title, points: [...o.points] })));
        setResearchNote("");
        say({
          role: "assistant",
          content: t("flow.outlineReady", { count: ev.outline.length, title: ev.title }),
          doc: {
            title: ev.title,
            subtitle: t("flow.outlineDoc", { count: ev.outline.length }),
            pages: ev.outline.map((page) => ({ title: page.title, points: [...page.points] })),
            artifactId: "outline",
          },
        });
        break;
      case "error":
        say({ role: "assistant", content: `⚠ ${ev.error}` });
        break;
    }
  }

  // ---------------- step 3: edit outline ----------------

  function onOutlineChange(pages: OutlinePage[]) {
    setOutline(pages);
    setTitle(pages[0]?.title || "");
    if (!projectId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveOutline(projectId, pages).catch(() => {});
    }, 700);
  }

  async function handleOutlineChat(request: ChatRequest) {
    if (!projectId) return;
    say({ role: "user", content: request.message, attachment: request.context, contextItems: request.attachments });
    setBusy(true);
    try {
      const { pages, reply } = await reviseOutlineChat(projectId, request.message);
      setOutline(pages);
      setTitle(pages[0]?.title || title);
      say({ role: "assistant", content: reply || t("flow.outlineUpdated") });
    } catch (e: any) {
      say({ role: "assistant", content: `⚠ ${e?.message ?? e}` });
    } finally {
      setBusy(false);
    }
  }

  // ---------------- step 4: confirm → (inspire) → render ----------------

  /** Outline confirmed. If no style is chosen yet, detour to the inspiration
   *  step; otherwise render straight away. */
  async function confirmOutline() {
    if (!projectId || running || busy || !outline.length) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await saveOutline(projectId, outline);
    } catch (e: any) {
      say({ role: "assistant", content: `⚠ ${e?.message ?? e}` });
      return;
    }
    say(outlineSnapshotMessage(title, outline));
    if (!config.template) {
      // Detour to the inspiration step: show the pending deck + an in-chat card
      // whose Browse button opens the style popup. Render waits for the pick/skip.
      setSlides(outline.map((o, i) => ({ index: i + 1, title: o.title, status: "pending" })));
      setStage("inspire");
      const matchQuery = [config.requirement, ...outline.map((o) => o.title)]
        .filter(Boolean)
        .join(" ");
      const msgId = createAgentRunId("inspire");
      setInspireMsgId(msgId);
      say({
        id: msgId,
        role: "assistant",
        content: t("flow.stylePrompt"),
        inspiration: {
          query: inspireQueryFor(config.requirement, title),
          coverIds: matchCommunityTemplates(matchQuery, 4).map((t) => t.id),
          total: COMMUNITY_TEMPLATES.length,
        },
      });
      return;
    }
    setInspirationSkipped(false);
    say(styleSnapshotMessage(config.template, config.requirement));
    renderNow();
  }

  /** Browse opens the popup; skip resolves the step with the default style. */
  function onInspire(action: "browse" | "skip") {
    if (action === "browse") setInspireOpen(true);
    else void handleInspireGenerate(undefined);
  }

  /** Apply an inspiration pick (or skip) then render. */
  async function handleInspireGenerate(templateId?: string) {
    if (!projectId || running || busy) return;
    setInspireOpen(false);
    if (templateId) {
      setInspirationSkipped(false);
      const tpl = getCommunityTemplate(templateId);
      patchConfig({ template: templateId });
      say({ role: "user", content: t("flow.styleSelected", { name: tpl?.name ?? templateId }) });
      try {
        await patchProjectStyle(projectId, { template: templateId });
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

  // ---------------- step 5: render ----------------

  async function renderNow() {
    if (!projectId) return;
    const runId = createAgentRunId("render-deck");
    const startedAt = Date.now();
    const startContent = config.fast
      ? t("flow.fastRender", { count: outline.length })
      : t("flow.render", { count: outline.length });
    setRunning(true);
    setWorkspaceMode("canvas");
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
        handleEvent(ev);
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

  function handleEvent(ev: ProgressEvent) {
    switch (ev.type) {
      case "project":
        setProjectId(ev.id);
        break;
      case "page_start":
        setSlides((s) => s.map((x) => (x.index === ev.index ? { ...x, status: "working" } : x)));
        break;
      case "page_rendered":
        setSlides((s) =>
          s.map((x) =>
            x.index === ev.index ? { ...x, status: "rendered", image: ev.image, bust: Date.now() } : x,
          ),
        );
        break;
      case "page_error":
        setSlides((s) =>
          s.map((x) => (x.index === ev.index ? { ...x, status: "error", error: ev.error } : x)),
        );
        break;
      case "error":
        say({ role: "assistant", content: `⚠ ${ev.error}` });
        break;
    }
  }

  // ---------------- step 6: follow-up edits (deck stage) ----------------

  async function handleChat(request: ChatRequest) {
    if (!projectId) return;
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
        notes: [t("agent.understandingNote")],
        tools: [{
          id: "plan",
          name: "plan_deck_edit",
          label: t("agent.plan"),
          detail: t("agent.planDetail"),
          state: "running",
        }],
      },
    });
    setBusy(true);
    try {
      const plan = await planChatEdit(projectId, message, context, attachments);
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
            capturedActivities.length
              ? { ...current.process!, tools: [...current.process!.tools, ...capturedActivities] }
              : current.process!,
            "plan",
            { state: "complete", detail: planDetail },
          ),
          title: plan.action === "add" ? t("agent.adding") : plan.action === "edit" ? t("agent.applying") : t("agent.reviewed"),
          notes: plan.instruction ? [t("agent.plannedChange", { instruction: plan.instruction })] : [t("agent.noChange")],
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

  /** Route a chat turn to the right handler for the current stage. */
  function runRequest(request: ChatRequest) {
    if (stage === "outline") handleOutlineChat(request);
    else handleChat(request);
  }

  /** Queue follow-ups typed while work is in flight; run immediately when idle. */
  function enqueueOrRun(request: ChatRequest) {
    if (running || busy || !projectId) setQueue((q) => [...q, request]);
    else runRequest(request);
  }

  // Drain one queued follow-up whenever the pipeline goes idle.
  useEffect(() => {
    if (running || busy || !projectId || !queue.length) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    runRequest(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, busy, projectId, queue]);

  // Persist all conversations once the project exists, including the active selection.
  useEffect(() => {
    if (!projectId || !conversationState.conversations.length) return;
    const t = setTimeout(() => saveConversations(
      projectId,
      conversationState.conversations,
      conversationState.activeConversationId,
    ), 600);
    return () => clearTimeout(t);
  }, [conversationState.activeConversationId, conversationState.conversations, projectId]);

  function askAboutSlide(slide: UiSlide) {
    if (!projectId) return;
    setChatContext({
      slideIndex: slide.index,
      title: slide.title || t("chat.slide", { index: slide.index }),
      imageUrl: fileUrl(projectId, slide.image, slide.bust),
    });
    setChatFocusKey((key) => key + 1);
  }

  function mirrorMarkToChat(event: MarkAgentEvent) {
    if (!projectId) return;
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
          tools: [{
            id: "mark-edit",
            name: "mark_edit_page",
            label: t("agent.applyVisual"),
            detail: t("agent.processMark", { index: event.slide.index }),
            state: "running",
          }],
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

  const designFiles = useMemo<DesignFile[]>(() => {
    const files: DesignFile[] = [];
    if (questions.length) {
      files.push({
        id: "questions",
        kind: "questions",
        title: t("designFiles.questionsTitle"),
        subtitle: clarifyAnswerSummary
          ? t("designFiles.questionsConfirmed", { count: questions.length })
          : t("designFiles.questionsPending", { count: questions.length }),
        questions,
        answerSummary: clarifyAnswerSummary || undefined,
      });
    }
    if (outline.length) {
      files.push({
        id: "outline",
        kind: "outline",
        title: title || t("designFiles.outlineTitle"),
        subtitle: stage === "outline"
          ? t("designFiles.outlineEditing", { count: outline.length })
          : t("designFiles.outlineConfirmed", { count: outline.length }),
        pages: outline.map((page) => ({ title: page.title, points: [...page.points] })),
      });
    }
    if (stage === "inspire" || config.template || inspirationSkipped) {
      const matchQuery = [config.requirement, ...outline.map((page) => page.title)].filter(Boolean).join(" ");
      files.push({
        id: "inspiration",
        kind: "inspiration",
        title: t("designFiles.inspirationTitle"),
        subtitle: inspirationSkipped
          ? t("designFiles.inspirationSkipped")
          : config.template
            ? t("designFiles.inspirationSelected")
            : t("designFiles.inspirationPending"),
        selectedTemplateId: config.template,
        candidateTemplateIds: matchCommunityTemplates(matchQuery, 4).map((template) => template.id),
        skipped: inspirationSkipped,
      });
    }
    return files;
  }, [clarifyAnswerSummary, config.requirement, config.template, inspirationSkipped, outline, questions, stage, t, title]);

  // ---------------- WORK VIEW (clarify → outline → deck) ----------------
  if (phase === "work") {
    const status: GenStatus | null =
      stage === "deck"
        ? deriveStatus(slides, { streaming: running, editing: busy })
        : stage === "outline" && running
          ? { phase: "outlining", total: 0, done: 0, note: researchNote || undefined }
          : null;
    const renderedSlides = slides.filter((slide) => slide.status === "rendered").length;
    const templateLabel = config.template
      ? getCommunityTemplate(config.template)?.name ?? config.template
      : undefined;
    const workflow = buildWorkflowProgress({
      stage,
      clarifyBusy,
      questionCount: questions.length,
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
      <WorkspaceModeTabs mode={workspaceMode} fileCount={designFiles.length} onChange={setWorkspaceMode} />
    );
    const placeholder =
      stage === "clarify"
        ? t("flow.placeholderClarify")
        : stage === "outline"
          ? t("flow.placeholderOutline")
          : stage === "inspire"
            ? t("flow.placeholderInspire")
            : t("flow.placeholderDeck");
    return (
      <div className="ws project-ws">
        <ChatColumn
          label={t("chat.deckAgent")}
          homeHref="/"
          messages={chat}
          busy={running || busy || clarifyBusy}
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
          conversations={projectId ? conversationState.summaries : undefined}
          activeConversationId={projectId ? conversationState.activeConversationId : undefined}
          onSelectConversation={projectId ? (id) => {
            if (running || busy || clarifyBusy) return;
            setQueue([]);
            setChatContext(null);
            conversationState.selectConversation(id);
          } : undefined}
          onCreateConversation={projectId ? () => {
            if (running || busy || clarifyBusy) return;
            setQueue([]);
            setChatContext(null);
            conversationState.createConversation();
          } : undefined}
          onRenameConversation={projectId ? conversationState.renameConversation : undefined}
          onDeleteConversation={projectId ? conversationState.deleteConversation : undefined}
          conversationManagementDisabled={running || busy || clarifyBusy}
          placeholder={placeholder}
        />
        {workspaceMode === "files" ? (
          <DesignFilesPanel
            files={designFiles}
            selectedId={selectedDesignFileId}
            onSelect={setSelectedDesignFileId}
            headerPrefix={workspaceTabs}
          />
        ) : stage === "clarify" ? (
          <section className="stage clarify-stage">
            <div className="stage-head">
              {workspaceTabs}
              <span className="title">{t("onboard.stageTitle")}</span>
              <span className="count">{t("onboard.step")}</span>
            </div>
            <div className="clarify-pane">
              <p className="clarify-topic">{config.requirement}</p>
              {clarifyBusy || !questions.length ? (
                <div className="clarify-loading">
                  <div className="clarify-loading-head">
                    <span className="spinner sm" />
                    <span>{t("onboard.preparing")}</span>
                  </div>
                  <div className="clarify-skeleton">
                    {[0, 1, 2, 3].map((k) => (
                      <div className="clarify-skeleton-q" key={k}>
                        <span className="skeleton skel-line" style={{ width: `${44 + k * 12}%` }} />
                        <div className="clarify-skeleton-opts">
                          <span className="skeleton" />
                          <span className="skeleton" />
                          <span className="skeleton" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <OnboardForm
                  questions={questions}
                  busy={false}
                  onCancel={skipClarify}
                  onComplete={applyClarify}
                  onAttachImages={attachClarifyImages}
                  onRemoveImage={onRemoveMaterial}
                  submitLabel={t("onboard.confirmOutline")}
                  skipLabel={t("onboard.skip")}
                />
              )}
            </div>
          </section>
        ) : stage === "outline" ? (
          <OutlineBoard
            title={title}
            aspect={config.aspect}
            outline={outline}
            onChange={onOutlineChange}
            onConfirm={confirmOutline}
            busy={running && outline.length > 0}
            streaming={running && outline.length === 0}
            researchDoc={researchDoc}
            headerPrefix={workspaceTabs}
          />
        ) : (
          // Both "inspire" (pending skeleton deck while picking a style) and
          // "deck" render the SlideStage. During inspire, streaming keeps the
          // pages as skeletons; the in-chat card + popup drive the style pick.
          <SlideStage
            projectId={projectId}
            aspect={config.aspect}
            title={title}
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
          />
        )}
        {inspireOpen && (
          <InspireDialog
            requirement={config.requirement}
            outlineTitles={outline.map((o) => o.title).filter(Boolean)}
            selected={config.template}
            onClose={() => setInspireOpen(false)}
            onSkip={() => handleInspireGenerate(undefined)}
            onSubmit={(id) => handleInspireGenerate(id)}
          />
        )}
      </div>
    );
  }

  // ---------------- LAUNCHER ----------------
  const communityStyle = getCommunityTemplate(config.template);
  const curatedStyle = communityStyle ? undefined : getTemplate(config.template);
  const selectedStyle = communityStyle
    ? { id: communityStyle.id, name: communityStyle.name, cover: communityStyle.cover, sub: communityStyle.group }
    : curatedStyle
      ? { id: curatedStyle.id, name: curatedStyle.name, palette: curatedStyle.palette, sub: t("template.preset") }
      : null;
  const selectedScenario = getScenario(config.scenarioId);
  return (
    <>
      <TopBar codexReady={codexReady} agentLabel={agentLabel} />
      <main className="launch">
        <div className="launch-hero">
          <div className="plan-pill">
            <span>{t("home.badge")}</span>
            <span className="divider" />
            <span style={{ color: "var(--muted)" }}>{t("home.tagline")}</span>
          </div>
          <h1>{t("home.title")}</h1>
          <ScenarioPicker
            selected={config.scenarioId}
            onSelect={selectScenario}
            openRequestKey={scenarioOpenRequestKey}
          />
          <Composer
            config={config}
            setConfig={patchConfig}
            engines={engines}
            running={running || clarifyBusy}
            researchMode={researchMode}
            setResearchMode={setResearchMode}
            materials={materials}
            onAddItems={onAddItems}
            onRemoveMaterial={onRemoveMaterial}
            styleTemplate={selectedStyle}
            onClearStyle={() => patchConfig({ template: undefined })}
            scenario={selectedScenario}
            onClearScenario={clearScenario}
            onSubmit={submit}
          />
        </div>
        <Community selected={config.template} onPick={(id) => patchConfig({ template: config.template === id ? undefined : id })} />
        <RecentProjects />
      </main>
    </>
  );
}
