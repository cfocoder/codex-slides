"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  FilmStrip,
  Image,
  PencilSimple,
  Plus,
  Sparkle,
  Trash,
} from "@phosphor-icons/react";
import MarkCanvas from "@/components/MarkCanvas";
import PlayMode from "@/components/PlayMode";
import TransitionPicker from "@/components/TransitionPicker";
import {
  addProjectSlide,
  deleteProjectSlide,
  duplicateProjectSlide,
  fileUrl,
  markSlide,
  saveMarkSource,
  setProjectSlideTransition,
  uploadProjectSlide,
  type UiSlide,
} from "@/lib/deckEdit";
import type { SlideTransition } from "@/lib/types";

export type MarkAgentEvent =
  | { type: "request"; slide: UiSlide; note: string; markedImage: string }
  | { type: "complete"; slide: UiSlide; note: string; image: string }
  | { type: "error"; slide: UiSlide; note: string; error: string };

/** A slide-shaped shimmer placeholder used while a page is queued or drawing. */
function SlideSkeleton({ caption }: { caption?: string }) {
  return (
    <div className="skel-slide">
      <div className="skel-row">
        <span className="skeleton skel-badge" />
        <span className="skeleton skel-line w30" />
      </div>
      <span className="skeleton skel-line w70 tall" />
      <span className="skeleton skel-line w45" />
      <div className="skel-cols">
        <span className="skeleton skel-block" />
        <div className="skel-lines">
          <span className="skeleton skel-line w90" />
          <span className="skeleton skel-line w80" />
          <span className="skeleton skel-line w85" />
          <span className="skeleton skel-line w60" />
        </div>
      </div>
      {caption && (
        <div className="skel-caption">
          <span className="spinner sm" /> {caption}
        </div>
      )}
    </div>
  );
}

async function normalizeSlideImage(file: File, aspect: string): Promise<Blob> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Please choose an image under 20 MB");
  const bitmap = await createImageBitmap(file);
  const [rawW, rawH] = aspect.split(":").map(Number);
  const ratio = rawW > 0 && rawH > 0 ? rawW / rawH : 16 / 9;
  const width = ratio >= 1 ? 1920 : Math.round(1920 * ratio);
  const height = ratio >= 1 ? Math.round(1920 / ratio) : 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to prepare this image");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Unable to convert this image"))), "image/png");
  });
}

/** Per-page editor with page creation, upload, AI generation, navigation and export. */
export default function SlideStage({
  projectId,
  aspect,
  title,
  slides,
  onSlides,
  busy,
  setBusy,
  streaming = false,
  headerExtra,
  onAskSlide,
  onMarkAgentEvent,
  focusSlideIndex,
  focusSlideKey = 0,
}: {
  projectId: string | null;
  aspect: string;
  title: string;
  slides: UiSlide[];
  onSlides: (updater: (s: UiSlide[]) => UiSlide[]) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  streaming?: boolean;
  headerExtra?: React.ReactNode;
  /** Attach a page to the deck-agent conversation for a scoped follow-up. */
  onAskSlide?: (slide: UiSlide) => void;
  /** Mirror visual-mark editing into the persistent deck conversation. */
  onMarkAgentEvent?: (event: MarkAgentEvent) => void;
  /** External navigation request originating from a chat attachment. */
  focusSlideIndex?: number | null;
  /** Increment to repeat navigation to the same externally requested slide. */
  focusSlideKey?: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [markTarget, setMarkTarget] = useState<number | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<number | null>(null);
  const [transitionSaving, setTransitionSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [structureBusy, setStructureBusy] = useState(false);
  const [addingAfter, setAddingAfter] = useState<number | null>(null);
  const [enteringSlide, setEnteringSlide] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<number | null>(null);
  const userPicked = useRef(false);
  const stageRef = useRef<HTMLElement>(null);

  const arCss = useMemo(() => aspect.replace(":", " / "), [aspect]);
  const current = slides.find((slide) => slide.index === selected) ?? slides[0];
  const currentPosition = current ? slides.findIndex((slide) => slide.index === current.index) : -1;
  const rendered = slides.filter((slide) => slide.status === "rendered").length;
  const canEdit = Boolean(projectId) && !busy && !streaming && !structureBusy;
  const canExport = Boolean(rendered) && Boolean(projectId);

  useEffect(() => {
    if (userPicked.current) return;
    const last = [...slides].reverse().find((slide) => slide.image) ?? slides.find((slide) => slide.status === "working");
    if (last) setSelected(last.index);
    else if (slides.length && selected == null) setSelected(slides[0].index);
  }, [slides, selected]);

  useEffect(() => {
    if (!exportOpen) return;
    const close = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) setExportOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [exportOpen]);

  useEffect(() => {
    if (selected == null) return;
    const frame = stripRef.current?.querySelector<HTMLElement>(`[data-slide-index="${selected}"]`);
    frame?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selected]);

  useEffect(() => {
    if (enteringSlide == null) return;
    const timer = window.setTimeout(() => setEnteringSlide(null), 520);
    return () => window.clearTimeout(timer);
  }, [enteringSlide]);

  useEffect(() => {
    if (focusSlideIndex == null || !slides.some((slide) => slide.index === focusSlideIndex)) return;
    pick(focusSlideIndex);
    requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    // focusSlideKey intentionally allows repeated requests for the same slide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSlideIndex, focusSlideKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (playing || markTarget != null || transitionTarget != null) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft" && currentPosition > 0) {
        event.preventDefault();
        pick(slides[currentPosition - 1].index);
      }
      if (event.key === "ArrowRight" && currentPosition >= 0 && currentPosition < slides.length - 1) {
        event.preventDefault();
        pick(slides[currentPosition + 1].index);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // pick intentionally closes per-page UI alongside navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, markTarget, playing, slides, transitionTarget]);

  function replaceSlides(next: UiSlide[]) {
    onSlides(() => next);
  }

  function update(index: number, patch: Partial<UiSlide>) {
    onSlides((items) => items.map((slide) => (slide.index === index ? { ...slide, ...patch } : slide)));
  }

  /**
   * Keep already-loaded image URLs stable across page-list mutations. Pages
   * whose filenames really changed are decoded before React swaps the list, so
   * inserting a blank page does not make the deck and thumbnails flash white.
   */
  async function prepareStructuralSlides(
    next: UiSlide[],
    previousFor: (slide: UiSlide) => UiSlide | undefined,
  ) {
    const prepared = next.map((slide) => {
      const previous = previousFor(slide);
      return previous && previous.image === slide.image ? { ...slide, bust: previous.bust } : slide;
    });

    await Promise.all(
      prepared.map((slide) => {
        const previous = previousFor(slide);
        const nextUrl = fileUrl(projectId!, slide.image, slide.bust);
        const previousUrl = fileUrl(projectId!, previous?.image, previous?.bust);
        if (!nextUrl || nextUrl === previousUrl) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const image = new window.Image();
          const done = () => resolve();
          image.onload = done;
          image.onerror = done;
          image.src = nextUrl;
          if (image.complete) done();
        });
      }),
    );

    return prepared;
  }

  function pick(index: number) {
    userPicked.current = true;
    setSelected(index);
    setMarkTarget(null);
    setActionError("");
  }

  function movePage(delta: number) {
    const next = slides[currentPosition + delta];
    if (next) pick(next.index);
  }

  async function addBlankSlide(afterIndex = slides.length) {
    if (!projectId || busy || streaming || structureBusy) return;
    const insertAfter = Math.max(0, Math.min(slides.length, afterIndex));
    setStructureBusy(true);
    setAddingAfter(insertAfter);
    setActionError("");
    try {
      const next = await addProjectSlide(projectId, afterIndex);
      const prepared = await prepareStructuralSlides(next, (slide) => {
        if (slide.index <= insertAfter) return slides.find((item) => item.index === slide.index);
        if (slide.index > insertAfter + 1) return slides.find((item) => item.index === slide.index - 1);
        return undefined;
      });
      replaceSlides(prepared);
      const added = prepared[insertAfter];
      if (added) {
        pick(added.index);
        setEnteringSlide(added.index);
      }
    } catch (error: any) {
      setActionError(String(error?.message ?? error));
    } finally {
      setAddingAfter(null);
      setStructureBusy(false);
    }
  }

  async function duplicatePage(index: number) {
    if (!projectId || busy || structureBusy) return;
    setStructureBusy(true);
    try {
      const next = await duplicateProjectSlide(projectId, index);
      const prepared = await prepareStructuralSlides(next, (slide) => {
        if (slide.index <= index) return slides.find((item) => item.index === slide.index);
        if (slide.index > index + 1) return slides.find((item) => item.index === slide.index - 1);
        return undefined;
      });
      replaceSlides(prepared);
      const added = prepared[index];
      if (added) pick(added.index);
    } catch (error: any) {
      setActionError(String(error?.message ?? error));
    } finally {
      setStructureBusy(false);
    }
  }

  async function deletePage(index: number) {
    if (!projectId || busy || structureBusy) return;
    setStructureBusy(true);
    try {
      const next = await deleteProjectSlide(projectId, index);
      const prepared = await prepareStructuralSlides(next, (slide) => {
        const previousIndex = slide.index < index ? slide.index : slide.index + 1;
        return slides.find((item) => item.index === previousIndex);
      });
      replaceSlides(prepared);
      const fallback = prepared[Math.min(index - 1, prepared.length - 1)];
      if (fallback) pick(fallback.index);
      else setSelected(null);
    } catch (error: any) {
      setActionError(String(error?.message ?? error));
    } finally {
      setStructureBusy(false);
    }
  }

  function askAgent(index: number) {
    const slide = slides.find((item) => item.index === index);
    if (!slide) return;
    pick(index);
    if (onAskSlide) onAskSlide(slide);
    else setActionError("The deck agent is not available for this slide.");
  }

  function chooseUpload(index: number) {
    uploadTarget.current = index;
    uploadRef.current?.click();
  }

  async function handleUpload(file?: File) {
    const index = uploadTarget.current;
    if (!file || index == null || !projectId || busy) return;
    const before = slides.find((slide) => slide.index === index);
    setBusy(true);
    setActionError("");
    update(index, { status: "working" });
    try {
      const png = await normalizeSlideImage(file, aspect);
      const title = file.name.replace(/\.[^.]+$/, "") || before?.title || `Slide ${index}`;
      const uploaded = await uploadProjectSlide(projectId, index, png, title);
      onSlides((items) => items.map((slide) => (slide.index === index ? uploaded : slide)));
      setSelected(index);
    } catch (error: any) {
      update(index, {
        status: before?.image ? "rendered" : "pending",
        error: undefined,
      });
      setActionError(String(error?.message ?? error));
    } finally {
      setBusy(false);
      uploadTarget.current = null;
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  function openTransition(index: number) {
    pick(index);
    setTransitionTarget(index);
  }

  async function chooseTransition(transition: SlideTransition) {
    if (!projectId || transitionTarget == null || transitionSaving) return;
    const target = transitionTarget;
    const previous = slides.find((slide) => slide.index === target)?.transition ?? "none";
    if (previous === transition) return;
    setTransitionSaving(true);
    setActionError("");
    update(target, { transition });
    try {
      await setProjectSlideTransition(projectId, target, transition);
      // The optimistic patch above is already canonical. Replacing the whole
      // deck here would change every slide's image cache key and make it flash.
    } catch (error: any) {
      update(target, { transition: previous });
      setActionError(String(error?.message ?? error));
    } finally {
      setTransitionSaving(false);
    }
  }

  function startMark(index: number) {
    const slide = slides.find((item) => item.index === index);
    if (!slide?.image) return;
    pick(index);
    setActionError("");
    setMarkTarget(index);
  }

  async function submitMark(blob: Blob, note: string) {
    if (!projectId || markTarget == null) return;
    const index = markTarget;
    const slide = slides.find((item) => item.index === index);
    if (!slide) return;
    setActionError("");
    setBusy(true);
    let requestMirrored = false;
    try {
      // Keep the live canvas mounted until its immutable snapshot is safely on
      // disk. If this quick upload fails, the user's marks remain available for
      // the Retry button instead of disappearing.
      const markedImage = await saveMarkSource(projectId, index, blob);
      setMarkTarget(null);
      update(index, { status: "working" });
      onMarkAgentEvent?.({ type: "request", slide, note, markedImage });
      requestMirrored = true;
      const image = await markSlide(projectId, index, markedImage, note);
      update(index, { status: "rendered", image, bust: Date.now() });
      onMarkAgentEvent?.({ type: "complete", slide, note, image });
    } catch (error: any) {
      const message = String(error?.message ?? error);
      if (requestMirrored) {
        update(index, { status: "rendered", error: undefined });
        onMarkAgentEvent?.({ type: "error", slide, note, error: message });
      } else {
        setActionError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  const playSlides = slides
    .filter((slide) => slide.image)
    .map((slide) => ({
      index: slide.index,
      url: fileUrl(projectId!, slide.image, slide.bust),
      title: slide.title,
      transition: slide.transition ?? "none",
    }));

  return (
    <section className="stage" ref={stageRef}>
      <div className="stage-head">
        <span className="title">{title || "Untitled deck"}</span>
        <span className="count">
          {currentPosition >= 0 ? currentPosition + 1 : 0}/{slides.length || "…"} · {aspect}
        </span>

        <div className="stage-actions">
          <button className="iconbtn primary" disabled={!rendered} onClick={() => setPlaying(true)} title="Present fullscreen">
            ▶ Play
          </button>

          <div ref={exportRef} className="export-wrap">
            <button className="iconbtn" disabled={!canExport} onClick={() => setExportOpen((open) => !open)} title="Export the deck">
              ⬇ Export <span className="caret">▾</span>
            </button>
            {exportOpen && canExport && (
              <div className="pop down export-pop">
                <div className="pop-title">Download deck</div>
                <a className="pop-item" href={`/api/projects/${projectId}/export?format=pdf`} target="_blank" rel="noreferrer" onClick={() => setExportOpen(false)}>
                  <span className="ic">📄</span>
                  <span className="grow"><b>PDF</b><em>Print-ready, one image per page</em></span>
                </a>
                <a className="pop-item" href={`/api/projects/${projectId}/export?format=pptx`} target="_blank" rel="noreferrer" onClick={() => setExportOpen(false)}>
                  <span className="ic">📊</span>
                  <span className="grow"><b>PowerPoint</b><em>Editable .pptx, slide per image</em></span>
                </a>
              </div>
            )}
          </div>

          {headerExtra && <span className="stage-actions-sep" />}
          {headerExtra}
        </div>
      </div>

      <div className="stage-main">
        {current && (
          <>
            <button className="stage-page-nav prev" onClick={() => movePage(-1)} disabled={currentPosition <= 0} aria-label="Previous slide">‹</button>
            <button className="stage-page-nav next" onClick={() => movePage(1)} disabled={currentPosition < 0 || currentPosition >= slides.length - 1} aria-label="Next slide">›</button>
          </>
        )}

        {current && (
          <div className="slide-toolbar" role="toolbar" aria-label={`Slide ${current.index} editing tools`}>
            <span className="slide-toolbar-page">Slide {current.index}</span>
            <span className="slide-toolbar-sep" aria-hidden="true" />
            <button type="button" onClick={() => askAgent(current.index)} disabled={!canEdit} title="Ask AI about this slide">
              <Sparkle size={16} />
              <span>Ask AI</span>
            </button>
            <button type="button" onClick={() => startMark(current.index)} disabled={!canEdit || !current.image} title="Mark an area and leave a comment">
              <PencilSimple size={16} />
              <span>Mark &amp; comment</span>
            </button>
            <button type="button" onClick={() => openTransition(current.index)} disabled={!canEdit} title="Set slide transition">
              <FilmStrip size={16} />
              <span>Transition</span>
            </button>
            <button
              type="button"
              onClick={() => chooseUpload(current.index)}
              disabled={!canEdit}
              title={current.image ? "Replace with an uploaded image" : "Upload a slide image"}
            >
              <Image size={16} />
              <span>{current.image ? "Replace image" : "Upload image"}</span>
            </button>
            <button type="button" onClick={() => duplicatePage(current.index)} disabled={!canEdit} title="Duplicate this slide">
              <Copy size={16} />
              <span>Duplicate</span>
            </button>
            <span className="slide-toolbar-sep" aria-hidden="true" />
            <button type="button" className="danger" onClick={() => deletePage(current.index)} disabled={!canEdit} title="Delete this slide">
              <Trash size={16} />
              <span>Delete</span>
            </button>
          </div>
        )}

        <div
          className={`preview${current?.index === enteringSlide ? " slide-enter" : ""}`}
          style={{ ["--ar" as any]: arCss }}
        >
          {current?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(projectId!, current.image, current.bust)} alt={current.title} />
          ) : current?.status === "working" ? (
            <SlideSkeleton caption={`Drawing slide ${current.index}${current.title ? ` — ${current.title}` : ""}…`} />
          ) : current?.status === "error" ? (
            <div className="ph err"><span style={{ fontSize: 22 }}>⚠</span>{current.error || "render failed"}</div>
          ) : current && !streaming ? (
            <div className="slide-empty-state">
              <span className="slide-empty-icon">＋</span>
              <h3>Slide {current.index} is ready</h3>
              <p>Create one visual with AI or upload a finished slide image.</p>
              <div className="slide-empty-actions">
                <button onClick={() => askAgent(current.index)} disabled={!canEdit}>
                  <span>✦</span><b>Ask Deck Agent</b><small>Continue in the agent chat</small>
                </button>
                <button onClick={() => chooseUpload(current.index)} disabled={!canEdit}>
                  <span>↥</span><b>Upload image</b><small>PNG, JPG or WebP</small>
                </button>
              </div>
              {actionError && <div className="slide-action-error">{actionError}</div>}
            </div>
          ) : slides.length ? (
            <SlideSkeleton caption={streaming ? "Queued — waiting to draw…" : undefined} />
          ) : (
            <div className="slide-empty-state">
              <span className="slide-empty-icon">＋</span>
              <h3>Add your first slide</h3>
              <p>Start with a blank page, then generate or upload its visual.</p>
              <button className="add-first-slide" onClick={() => addBlankSlide()} disabled={!canEdit}>Add slide</button>
              {actionError && <div className="slide-action-error">{actionError}</div>}
            </div>
          )}

          {addingAfter != null && (
            <div className="slide-structure-progress" role="status" aria-live="polite">
              <span className="spinner sm" />
              <span>Adding slide {addingAfter + 1}…</span>
            </div>
          )}

          {current?.image && markTarget === current.index && (
            <MarkCanvas
              imageUrl={fileUrl(projectId!, current.image, current.bust)}
              slideIndex={current.index}
              busy={busy}
              error={actionError}
              onCancel={() => setMarkTarget(null)}
              onSubmit={submitMark}
            />
          )}
        </div>
      </div>

      <div className="filmstrip" ref={stripRef}>
        {slides.map((slide, position) => (
          <Fragment key={slide.index}>
            <div
              className={`frame-shell${slide.index === selected ? " selected" : ""}${slide.index === enteringSlide ? " frame-enter" : ""}`}
              data-slide-index={slide.index}
            >
              <button
                className={`frame ${slide.index === selected ? "on" : ""} ${slide.status}`}
                onClick={() => pick(slide.index)}
                title={`${slide.title || `Slide ${slide.index}`} — select slide`}
              >
                <div className="thumb" style={{ ["--ar" as any]: arCss }}>
                  {slide.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(projectId!, slide.image, slide.bust)} alt={slide.title} />
                  ) : slide.status === "error" ? (
                    <span className="mini-ph">⚠</span>
                  ) : slide.status === "working" ? (
                    <span className="skeleton skel-thumb"><span className="spinner sm" /></span>
                  ) : (
                    <span className="frame-blank-mark">＋</span>
                  )}
                </div>
                <span className="idx"><span className={`fdot ${slide.status}`} />{slide.index} / {slides.length}</span>
              </button>
              <button
                className={`frame-transition${slide.transition && slide.transition !== "none" ? " active" : ""}`}
                aria-label={`Slide ${slide.index} transition: ${slide.transition ?? "none"}`}
                title={`Transition: ${slide.transition ?? "none"}`}
                onClick={() => openTransition(slide.index)}
                disabled={!canEdit}
              >
                <FilmStrip size={13} />
              </button>
            </div>
            {position < slides.length - 1 && (
              <button className="frame-insert" onClick={() => addBlankSlide(slide.index)} disabled={!canEdit} aria-label={`Add slide after ${slide.index}`}><Plus size={15} /></button>
            )}
            {addingAfter === slide.index && (
              <div className="frame-shell frame-shell-adding" aria-hidden="true">
                <div className="frame frame-pending-add">
                  <div className="thumb" style={{ ["--ar" as any]: arCss }}>
                    <span className="spinner sm" />
                  </div>
                </div>
              </div>
            )}
          </Fragment>
        ))}
        {addingAfter === 0 && slides.length === 0 && (
          <div className="frame-shell frame-shell-adding" aria-hidden="true">
            <div className="frame frame-pending-add">
              <div className="thumb" style={{ ["--ar" as any]: arCss }}>
                <span className="spinner sm" />
              </div>
            </div>
          </div>
        )}
        <button className="frame-add" onClick={() => addBlankSlide()} disabled={!canEdit} aria-label="Add slide">
          <Plus size={22} /><small>Add slide</small>
        </button>
      </div>

      {transitionTarget != null && (
        <TransitionPicker
          slideIndex={transitionTarget}
          value={slides.find((slide) => slide.index === transitionTarget)?.transition ?? "none"}
          saving={transitionSaving}
          error={actionError}
          onSelect={chooseTransition}
          onClose={() => setTransitionTarget(null)}
        />
      )}

      <input
        ref={uploadRef}
        className="slide-upload-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => handleUpload(event.target.files?.[0])}
      />

      {playing && <PlayMode slides={playSlides} onClose={() => setPlaying(false)} />}
    </section>
  );
}
