"use client";

import { useEffect, useRef, useState } from "react";
import ChatColumn, { type ChatMsg } from "@/components/ChatColumn";
import Composer from "@/components/Composer";
import ForYou from "@/components/ForYou";
import Community from "@/components/Community";
import OnboardForm from "@/components/OnboardForm";
import OutlineBoard from "@/components/OutlineBoard";
import InspireDialog from "@/components/InspireDialog";
import RecentProjects from "@/components/RecentProjects";
import SlideStage, { type MarkAgentEvent } from "@/components/SlideStage";
import TopBar from "@/components/TopBar";
import {
  addProjectSlide,
  deriveStatus,
  fileUrl,
  generateSingleSlide,
  planChatEdit,
  regenerateSlide,
  patchProjectStyle,
  reviseOutlineChat,
  saveChat,
  saveOutline,
  streamOutline,
  streamRender,
  type ChatRequest,
  type GenStatus,
  type SlideChatContext,
  type UiSlide,
} from "@/lib/deckEdit";
import { mergeContextItems, type ContextItem } from "@/lib/contextItems";
import type { QuestionSpec } from "@/lib/onboard";
import { getTemplate } from "@/lib/templates";
import {
  COMMUNITY_TEMPLATES,
  getCommunityTemplate,
  inspireQueryFor,
  matchCommunityTemplates,
} from "@/lib/community";
import { DEFAULT_CONFIG, type OutlinePage, type PptConfig, type ProgressEvent } from "@/lib/types";
import {
  createAgentRunId,
  elapsedRunLabel,
  patchAgentTool,
  stopRunningTools,
} from "@/lib/agentActivity";

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

  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [outline, setOutline] = useState<OutlinePage[]>([]);
  const [researchDoc, setResearchDoc] = useState("");
  const [researchNote, setResearchNote] = useState("");
  const [slides, setSlides] = useState<UiSlide[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [queue, setQueue] = useState<ChatRequest[]>([]);
  const [chatContext, setChatContext] = useState<SlideChatContext | null>(null);
  const [chatFocusKey, setChatFocusKey] = useState(0);
  const [focusSlideIndex, setFocusSlideIndex] = useState<number | null>(null);
  const [focusSlideKey, setFocusSlideKey] = useState(0);
  const [inspireOpen, setInspireOpen] = useState(false);
  const [inspireMsgId, setInspireMsgId] = useState<string | null>(null);
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
    setStage("deck");
    setFocusSlideIndex(index);
    setFocusSlideKey((key) => key + 1);
  }

  function onAddItems(next: ContextItem[]) {
    setMaterials(next);
    patchConfig({ materialIds: next.map((item) => item.id) });
  }
  function onRemoveMaterial(id: string) {
    const next = materials.filter((m) => m.id !== id);
    setMaterials(next);
    patchConfig({ materialIds: next.map((m) => m.id) });
  }
  /** Reference images attached to a clarify question join the shared materials. */
  function attachClarifyImages(items: ContextItem[]) {
    onAddItems(mergeContextItems(materials, items));
  }

  // ---------------- step 1: clarify ----------------

  function submit() {
    if (running || busy || clarifyBusy) return;
    if (!config.requirement.trim() && !materials.length) return;
    const cfg = config.requirement.trim()
      ? config
      : { ...config, requirement: "Create a presentation from the attached context." };
    beginClarify(cfg);
  }

  async function beginClarify(cfg: PptConfig) {
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
    setChatContext(null);
    setQueue([]);
    setQuestions([]);

    const tplName = getTemplate(cfg.template)?.name ?? getCommunityTemplate(cfg.template)?.name;
    const note: string[] = [];
    if (tplName) note.push(`模板：${tplName}`);
    if (researchMode) note.push("深度研究");
    if (cfg.materialIds?.length) note.push(`${cfg.materialIds.length} 项资料`);
    setChat([
      {
        role: "user",
        content: cfg.requirement + (note.length ? `\n\n· ${note.join(" · ")}` : ""),
        contextItems: materials,
      },
      { role: "assistant", content: "先在右侧确认几个问题，我就开始写大纲。" },
    ]);

    setClarifyBusy(true);
    try {
      const r = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement: cfg.requirement }),
      });
      const d = await r.json();
      if (r.ok && Array.isArray(d.questions) && d.questions.length) {
        setQuestions(d.questions);
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
    if (summary.trim()) say({ role: "user", content: `已确认：\n${summary}` });
    proceedToOutline(cfg);
  }

  function skipClarify() {
    say({ role: "user", content: "跳过确认，直接写大纲。" });
    proceedToOutline(config);
  }

  // ---------------- step 2: search + outline ----------------

  async function proceedToOutline(base: PptConfig) {
    const cfg: PptConfig = { ...base, mode: researchMode ? "research" : "direct" };
    setConfig(cfg);
    setStage("outline");
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
        if (ev.phase === "searching") setResearchNote(`联网检索：${ev.detail ?? ""}`);
        else if (ev.phase === "synthesizing") setResearchNote(`整理研究简报（${ev.detail ?? ""}）`);
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
          content: `我整理了一个 ${ev.outline.length} 页的大纲——「${ev.title}」。你可以在右侧改标题、要点和顺序，或直接告诉我怎么改；满意后点「生成」我再逐页出图。`,
          doc: { title: ev.title, subtitle: `大纲 · ${ev.outline.length} 页`, icon: "▤" },
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
      say({ role: "assistant", content: reply || "已更新大纲。" });
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
        content: "出图前，先挑一个视觉参考风格吧——我按你的主题和大纲排好了。点「浏览」挑一个，或跳过用默认风格。",
        inspiration: {
          query: inspireQueryFor(config.requirement, title),
          coverIds: matchCommunityTemplates(matchQuery, 4).map((t) => t.id),
          total: COMMUNITY_TEMPLATES.length,
        },
      });
      return;
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
    if (!projectId || running || busy) return;
    setInspireOpen(false);
    if (templateId) {
      const tpl = getCommunityTemplate(templateId);
      patchConfig({ template: templateId });
      say({ role: "user", content: `选定风格：${tpl?.name ?? templateId}` });
      try {
        await patchProjectStyle(projectId, { template: templateId });
      } catch (e: any) {
        say({ role: "assistant", content: `⚠ 应用风格失败：${e?.message ?? e}` });
      }
    } else {
      say({ role: "user", content: "跳过风格，用默认风格生成。" });
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
    setRunning(true);
    try {
      setSlides(outline.map((o, i) => ({ index: i + 1, title: o.title, status: "pending" })));
      setStage("deck");
      say({ role: "assistant", content: `开始逐页生成 ${outline.length} 页幻灯片，每页约 30s…` });
      let rendered = 0;
      await streamRender(projectId, (ev) => {
        if (ev.type === "page_rendered") rendered++;
        handleEvent(ev);
      });
      if (rendered > 0) {
        say({
          role: "assistant",
          content: `完成！已生成 ${rendered} 页。下一步你可以直接告诉我怎么优化，或用右上角导出：`,
          suggestions: ["加一页总结收尾", "整体换个更商务的风格", "重画封面更醒目", "把要点讲得更具体"],
        });
      }
    } catch (e: any) {
      say({ role: "assistant", content: `⚠ ${e?.message ?? e}` });
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
        title: "Understanding your edit",
        notes: ["I’m checking the instruction, slide context, and attached references before changing the deck."],
        tools: [{
          id: "plan",
          name: "plan_deck_edit",
          label: "Plan the edit",
          detail: "Identify the action and affected slides",
          state: "running",
        }],
      },
    });
    setBusy(true);
    try {
      const plan = await planChatEdit(projectId, message, context, attachments);
      const planDetail = plan.action === "edit"
        ? `Target slide${plan.targets.length === 1 ? "" : "s"}: ${plan.targets.join(", ")}`
        : plan.action === "add"
          ? "Add and render a new slide"
          : "Reply without changing the deck";
      updateChatMessage(runId, (current) => ({
        ...current,
        process: {
          ...patchAgentTool(current.process!, "plan", { state: "complete", detail: planDetail }),
          title: plan.action === "add" ? "Adding a new slide" : plan.action === "edit" ? "Applying the deck edit" : "Request reviewed",
          notes: plan.instruction ? [`Planned change: ${plan.instruction}`] : ["The request does not require a slide change."],
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
              { id: "add", name: "add_slide", label: "Insert slide", detail: `After slide ${afterIndex}`, state: "running" },
              { id: "generate", name: "generate_slide", label: "Render slide", detail: "Match the current visual system", state: "pending" },
            ],
          },
        }));
        const next = await addProjectSlide(projectId, afterIndex);
        const insertedIndex = Math.min(Math.max(afterIndex + 1, 1), next.length);
        setSlides(next.map((slide) => (slide.index === insertedIndex ? { ...slide, status: "working" } : slide)));
        updateChatMessage(runId, (current) => ({
          ...current,
          process: patchAgentTool(
            patchAgentTool(current.process!, "add", { state: "complete", detail: `Inserted slide ${insertedIndex}` }),
            "generate",
            { state: "running", detail: `Rendering slide ${insertedIndex}` },
          ),
        }));
        try {
          const generated = await generateSingleSlide(projectId, insertedIndex, plan.instruction || message);
          setSlides((items) => items.map((slide) => (slide.index === insertedIndex ? generated : slide)));
          updateChatMessage(runId, (current) => ({
            ...current,
            content: `${plan.reply} (added slide ${insertedIndex})`,
            ran: elapsedRunLabel(startedAt),
            attachment: {
              slideIndex: insertedIndex,
              title: generated.title || `Slide ${insertedIndex}`,
              imageUrl: fileUrl(projectId, generated.image, generated.bust),
            },
            process: {
              ...patchAgentTool(current.process!, "generate", { state: "complete", detail: `Slide ${insertedIndex} rendered` }),
              state: "complete",
              title: `Slide ${insertedIndex} added`,
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
          ran: elapsedRunLabel(startedAt),
          process: { ...current.process!, state: "complete", title: "Request reviewed" },
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
              label: `Update slide ${target}`,
              detail: "Waiting for the previous edit",
              state: "pending" as const,
            })),
          ],
        },
      }));
      const failedTargets: number[] = [];
      let lastAttachment: SlideChatContext | undefined;
      for (const t of plan.targets) {
        updateChatMessage(runId, (current) => ({
          ...current,
          process: patchAgentTool(current.process!, `regenerate-${t}`, {
            state: "running",
            detail: "Redrawing with the current deck style",
          }),
        }));
        setSlides((s) => s.map((x) => (x.index === t ? { ...x, status: "working" } : x)));
        try {
          const image = await regenerateSlide(projectId, t, plan.instruction);
          const bust = Date.now();
          setSlides((s) =>
            s.map((x) => (x.index === t ? { ...x, status: "rendered", image, bust } : x)),
          );
          lastAttachment = {
            slideIndex: t,
            title: slides.find((slide) => slide.index === t)?.title || `Slide ${t}`,
            imageUrl: fileUrl(projectId, image, bust),
          };
          updateChatMessage(runId, (current) => ({
            ...current,
            process: patchAgentTool(current.process!, `regenerate-${t}`, {
              state: "complete",
              detail: `Slide ${t} updated`,
            }),
          }));
        } catch (e: any) {
          failedTargets.push(t);
          setSlides((s) =>
            s.map((x) => (x.index === t ? { ...x, status: "error", error: String(e?.message ?? e) } : x)),
          );
          updateChatMessage(runId, (current) => ({
            ...current,
            process: patchAgentTool(current.process!, `regenerate-${t}`, {
              state: "error",
              detail: String(e?.message ?? e),
            }),
          }));
        }
      }
      updateChatMessage(runId, (current) => ({
        ...current,
        content: failedTargets.length
          ? `${plan.reply} Updated the remaining slides, but slide ${failedTargets.join(", ")} failed.`
          : `${plan.reply} (updated slide ${plan.targets.join(", ")})`,
        ran: elapsedRunLabel(startedAt),
        attachment: lastAttachment,
        process: {
          ...current.process!,
          state: failedTargets.length ? "error" : "complete",
          title: failedTargets.length ? "Edit completed with errors" : "Deck edit complete",
        },
      }));
    } catch (e: any) {
      updateChatMessage(runId, (current) => ({
        ...current,
        content: `⚠ ${e?.message ?? e}`,
        ran: elapsedRunLabel(startedAt),
        process: {
          ...stopRunningTools(current.process!, String(e?.message ?? e)),
          state: "error",
          title: "Edit could not be completed",
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

  // Persist the conversation (debounced) once the project exists, so reopening
  // /project/[id] restores the full dialogue (questions, choices, edits, artifacts).
  useEffect(() => {
    if (!projectId || !chat.length) return;
    const t = setTimeout(() => saveChat(projectId, chat), 600);
    return () => clearTimeout(t);
  }, [chat, projectId]);

  function askAboutSlide(slide: UiSlide) {
    if (!projectId) return;
    setChatContext({
      slideIndex: slide.index,
      title: slide.title || `Slide ${slide.index}`,
      imageUrl: fileUrl(projectId, slide.image, slide.bust),
    });
    setChatFocusKey((key) => key + 1);
  }

  function mirrorMarkToChat(event: MarkAgentEvent) {
    if (!projectId) return;
    if (event.type === "request") {
      say({
        role: "user",
        content: event.note || `Please edit the marked area on slide ${event.slide.index}.`,
        attachment: {
          slideIndex: event.slide.index,
          title: `${event.slide.title} · visual mark`,
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
          title: `Editing slide ${event.slide.index}`,
          notes: [
            "I’m reading the marked region and your instruction.",
            "The surrounding layout and the deck’s visual system will stay intact.",
          ],
          tools: [{
            id: "mark-edit",
            name: "mark_edit_page",
            label: "Apply visual edit",
            detail: `Process the marked region on slide ${event.slide.index}`,
            state: "running",
          }],
        },
      });
    } else if (event.type === "complete") {
      const run = markRunRef.current;
      if (!run) return;
      updateChatMessage(run.id, (current) => ({
        ...current,
        content: `Applied the visual annotation to slide ${event.slide.index}.`,
        ran: elapsedRunLabel(run.startedAt),
        attachment: {
          slideIndex: event.slide.index,
          title: `${event.slide.title} · updated`,
          imageUrl: fileUrl(projectId, event.image, Date.now()),
        },
        process: {
          ...patchAgentTool(current.process!, "mark-edit", { state: "complete", detail: "Updated slide saved" }),
          state: "complete",
          title: `Slide ${event.slide.index} updated`,
        },
      }));
      markRunRef.current = null;
    } else if (event.type === "error") {
      const run = markRunRef.current;
      if (!run) return;
      updateChatMessage(run.id, (current) => ({
        ...current,
        content: `⚠ ${event.error}`,
        ran: elapsedRunLabel(run.startedAt),
        process: {
          ...patchAgentTool(current.process!, "mark-edit", { state: "error", detail: event.error }),
          state: "error",
          title: `Slide ${event.slide.index} was not updated`,
        },
      }));
      markRunRef.current = null;
    }
  }

  // ---------------- WORK VIEW (clarify → outline → deck) ----------------
  if (phase === "work") {
    const status: GenStatus | null =
      stage === "deck"
        ? deriveStatus(slides, { streaming: running, editing: busy })
        : stage === "outline" && running
          ? { phase: "outlining", total: 0, done: 0, note: researchNote || undefined }
          : null;
    const placeholder =
      stage === "clarify"
        ? "有其它要求可以先告诉我，确认问题后开始写大纲…"
        : stage === "outline"
          ? "告诉 agent 怎么改大纲，或直接在右侧编辑…"
          : stage === "inspire"
            ? "点「浏览」挑个视觉风格，或跳过用默认风格…"
            : "让 agent 增删、改写、换风格或优化…";
    return (
      <div className="ws project-ws">
        <ChatColumn
          label="Deck Agent"
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
          placeholder={placeholder}
        />
        {stage === "clarify" ? (
          <section className="stage clarify-stage">
            <div className="stage-head">
              <span className="title">先确认几个问题</span>
              <span className="count">第 1 步 · 明确需求</span>
            </div>
            <div className="clarify-pane">
              <p className="clarify-topic">{config.requirement}</p>
              {clarifyBusy || !questions.length ? (
                <div className="clarify-loading">
                  <div className="clarify-loading-head">
                    <span className="spinner sm" />
                    <span>正在根据你的主题准备问题…</span>
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
                  submitLabel="确认，开始写大纲 →"
                  skipLabel="跳过"
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
  return (
    <>
      <TopBar codexReady={codexReady} agentLabel={agentLabel} />
      <main className="launch">
        <div className="launch-hero">
          <div className="plan-pill">
            <span>✧ Zero-config</span>
            <span className="divider" />
            <span style={{ color: "var(--muted)" }}>your local Codex writes the copy and draws the slides</span>
          </div>
          <h1>What do you want to present?</h1>
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
            onSubmit={submit}
          />
        </div>
        <RecentProjects />
        <ForYou selected={config.template} onPick={(id) => patchConfig({ template: config.template === id ? undefined : id })} />
        <Community selected={config.template} onPick={(id) => patchConfig({ template: config.template === id ? undefined : id })} />
      </main>
    </>
  );
}
