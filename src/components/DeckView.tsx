"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowsClockwise, Palette, WarningCircle, X } from "@phosphor-icons/react";
import ChatColumn, { type ChatMsg } from "@/components/ChatColumn";
import MaterialTray from "@/components/MaterialTray";
import OutlineBoard from "@/components/OutlineBoard";
import SlideStage, { type MarkAgentEvent } from "@/components/SlideStage";
import TemplatePicker from "@/components/TemplatePicker";
import {
  addProjectSlide,
  deriveStatus,
  fileUrl,
  generateSingleSlide,
  planChatEdit,
  regenerateSlide,
  reviseOutlineChat,
  saveChat,
  saveOutline,
  streamRender,
  type ChatRequest,
  type GenStatus,
  type SlideChatContext,
  type UiSlide,
} from "@/lib/deckEdit";
import type { OutlinePage, ProgressEvent, Project } from "@/lib/types";
import {
  createAgentRunId,
  elapsedRunLabel,
  patchAgentTool,
  stopRunningTools,
} from "@/lib/agentActivity";

/** Loads a persisted project and shows the agent-native workspace (chat + stage). */
export default function DeckView({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [slides, setSlides] = useState<UiSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<"outline" | "deck">("deck");
  const [outline, setOutline] = useState<OutlinePage[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [queue, setQueue] = useState<ChatRequest[]>([]);
  const [chatContext, setChatContext] = useState<SlideChatContext | null>(null);
  const [chatFocusKey, setChatFocusKey] = useState(0);
  const [focusSlideIndex, setFocusSlideIndex] = useState<number | null>(null);
  const [focusSlideKey, setFocusSlideKey] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markRunRef = useRef<{ id: string; startedAt: number; slideIndex: number } | null>(null);

  const [showTune, setShowTune] = useState(false);
  const [retuneTemplate, setRetuneTemplate] = useState<string | undefined>(undefined);
  const [retuneMaterialIds, setRetuneMaterialIds] = useState<string[]>([]);
  const [retuning, setRetuning] = useState(false);
  const [retuneProgress, setRetuneProgress] = useState(0);
  const retunePanelRef = useRef<HTMLElement>(null);
  const retuneTriggerRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (!r.ok) {
      setLoading(false);
      return;
    }
    const p: Project = await r.json();
    setProject(p);
    setRetuneTemplate(p.config.template);
    setSlides(
      p.pages.map((s) => ({
        index: s.index,
        title: s.title,
        status: (s.status as UiSlide["status"]) ?? "pending",
        image: s.image,
        error: s.error,
        bust: Date.now(),
        transition: s.transition ?? "none",
      })),
    );
    const draft = p.status === "draft";
    setStage(draft ? "outline" : "deck");
    setOutline(
      (p.outline?.length ? p.outline : p.pages).map((o) => ({
        title: o.title,
        points: [...(o.points ?? [])],
      })),
    );
    const rendered = p.pages.filter((s) => s.status === "rendered").length;
    // Restore the saved conversation if we have one; otherwise seed a stage-appropriate intro.
    if (Array.isArray(p.chat) && p.chat.length) {
      setChat(p.chat as unknown as ChatMsg[]);
    } else {
      setChat([
        draft
          ? {
              role: "assistant",
              content: `这个演示还是草稿——「${p.title}」有 ${p.pages.length} 页大纲，还没出图。你可以在右侧编辑大纲或让我修改，满意后点「生成」逐页出图。`,
              doc: { title: p.title, subtitle: `大纲 · ${p.pages.length} 页`, icon: "▤" },
            }
          : {
              role: "assistant",
              content: `I’m the agent for this presentation. “${p.title}” has ${p.pages.length} slides (${rendered} rendered). I can add pages, rewrite content, redraw a selected slide, or optimize the whole deck.`,
              doc: { title: p.title, subtitle: `${p.config.aspect} · ${p.agent}`, icon: "▤" },
            },
      ]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

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
    setFocusSlideIndex(index);
    setFocusSlideKey((key) => key + 1);
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

  // Persist the conversation (debounced) so it survives reloads.
  useEffect(() => {
    if (loading || !chat.length) return;
    const t = setTimeout(() => saveChat(projectId, chat), 600);
    return () => clearTimeout(t);
  }, [chat, projectId, loading]);

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
      say({ role: "assistant", content: reply || "已更新大纲。" });
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

  async function confirmAndRender() {
    if (running || busy || !outline.length) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setRunning(true);
    try {
      await saveOutline(projectId, outline);
      setSlides(outline.map((o, i) => ({ index: i + 1, title: o.title, status: "pending" })));
      setStage("deck");
      say({ role: "assistant", content: `开始逐页生成 ${outline.length} 页幻灯片，每页约 30s…` });
      let rendered = 0;
      await streamRender(projectId, (ev) => {
        if (ev.type === "page_rendered") rendered++;
        handleRenderEvent(ev);
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
        title: "Understanding your edit",
        notes: [
          "I’m checking the instruction, slide context, and attached references before changing the deck.",
        ],
        tools: [
          {
            id: "plan",
            name: "plan_deck_edit",
            label: "Plan the edit",
            detail: "Identify the action and affected slides",
            state: "running",
          },
        ],
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
          notes: plan.instruction
            ? [`Planned change: ${plan.instruction}`]
            : ["The request does not require a slide change."],
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
          const generated = await generateSingleSlide(
            projectId,
            insertedIndex,
            plan.instruction || message,
          );
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

  function askAboutSlide(slide: UiSlide) {
    setChatContext({
      slideIndex: slide.index,
      title: slide.title || `Slide ${slide.index}`,
      imageUrl: fileUrl(projectId, slide.image, slide.bust),
    });
    setChatFocusKey((key) => key + 1);
  }

  function mirrorMarkToChat(event: MarkAgentEvent) {
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
          tools: [
            {
              id: "mark-edit",
              name: "mark_edit_page",
              label: "Apply visual edit",
              detail: `Process the marked region on slide ${event.slide.index}`,
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
    say({ role: "assistant", content: `Restyling all ${slides.length} slides…` });
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: retuneTemplate ?? "", materialIds: retuneMaterialIds }),
      });
      if (!response.ok) throw new Error("Could not save the new deck style");
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
      say({ role: "assistant", content: `Done — all ${slides.length} slides now use the new visual style.` });
    } catch (error: any) {
      say({ role: "assistant", content: `⚠ ${error?.message ?? error}` });
    } finally {
      setRetuneProgress(0);
      setRetuning(false);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
        <div className="ph">
          <div className="spinner" />
        </div>
      </div>
    );
  }
  if (!project) return <div className="empty">Project not found.</div>;

  const status: GenStatus | null =
    stage === "outline"
      ? running
        ? { phase: "outlining", total: 0, done: 0 }
        : null
      : deriveStatus(slides, {
          streaming: running,
          editing: busy,
          note: retuning ? `Restyling slide ${retuneProgress} of ${slides.length}` : undefined,
        });

  return (
    <div className="ws project-ws">
      <ChatColumn
        label="Deck Agent"
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
        placeholder={
          stage === "outline"
            ? "告诉 agent 怎么改大纲，或直接在右侧编辑…"
            : "Ask the deck agent to add, rewrite, restyle, or optimize…"
        }
      />
      {stage === "outline" ? (
        <OutlineBoard
          title={project.title}
          aspect={project.config.aspect}
          outline={outline}
          onChange={onOutlineChange}
          onConfirm={confirmAndRender}
          busy={running && outline.length > 0}
          streaming={false}
          researchDoc={project.researchDoc}
        />
      ) : (
        <div className="deckpane">
          <SlideStage
            projectId={projectId}
            aspect={project.config.aspect}
            title={project.title}
            slides={slides}
            onSlides={(u) => setSlides(u)}
            busy={busy}
            setBusy={setBusy}
            streaming={running}
            onAskSlide={askAboutSlide}
            onMarkAgentEvent={mirrorMarkToChat}
            focusSlideIndex={focusSlideIndex}
            focusSlideKey={focusSlideKey}
            headerExtra={
              <button
                ref={retuneTriggerRef}
                className={`iconbtn restyle-trigger${showTune ? " active" : ""}`}
                onClick={() => setShowTune((visible) => !visible)}
                aria-expanded={showTune}
                aria-controls="restyle-deck-panel"
                disabled={retuning}
                title="Apply a new visual style to every slide"
              >
                <Palette size={16} weight="regular" aria-hidden="true" />
                Restyle deck
              </button>
            }
          />
          {showTune && (
            <>
              <button className="retune-scrim" aria-label="Close restyle panel" onClick={closeRestylePanel} />
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
                      <h2 id="restyle-deck-title">Restyle the entire deck</h2>
                      <p>Choose a visual system and optional brand references.</p>
                    </div>
                  </div>
                  <button type="button" className="retune-close" onClick={closeRestylePanel} aria-label="Close restyle panel">
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
                      <strong>All slide visuals will be replaced.</strong>
                      <small>Your outline, copy, and slide order stay the same.</small>
                    </span>
                  </div>
                  <button className="retune-apply" onClick={applyRetune} disabled={retuning || busy}>
                    <ArrowsClockwise size={17} weight="bold" aria-hidden="true" />
                    {retuning
                      ? `Restyling slide ${retuneProgress} of ${slides.length}…`
                      : `Restyle all ${slides.length} slide${slides.length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </aside>
            </>
          )}
        </div>
      )}
    </div>
  );
}
