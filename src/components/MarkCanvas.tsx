"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  LineSegment,
  PaperPlaneRight,
  PencilSimple,
  Rectangle,
  TextT,
  Trash,
  X,
} from "@phosphor-icons/react";

type Pt = { x: number; y: number };
type MarkTool = "pen" | "line" | "rect" | "text";
type TextMark = { kind: "text"; point: Pt; text: string };
type Mark =
  | { kind: "pen"; points: Pt[] }
  | { kind: "line"; start: Pt; end: Pt }
  | { kind: "rect"; start: Pt; end: Pt }
  | TextMark;

const MARK_COLOR = "#ff3b30";

/** Inline slide annotation layer that composites precise marks + a comment for the editing agent. */
export default function MarkCanvas({
  imageUrl,
  slideIndex,
  onCancel,
  onSubmit,
  busy,
  error,
}: {
  imageUrl: string;
  slideIndex: number;
  onCancel: () => void;
  onSubmit: (blob: Blob, note: string) => void;
  busy: boolean;
  error?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const marksRef = useRef<Mark[]>([]);
  const redoRef = useRef<Mark[]>([]);
  const draftRef = useRef<Mark | null>(null);
  const drawingRef = useRef(false);
  const textDragRef = useRef<{ index: number; offset: Pt; origin: Pt } | null>(null);
  const [tool, setToolState] = useState<MarkTool>("pen");
  const [note, setNote] = useState("");
  const [ready, setReady] = useState(false);
  const [, setHistoryVersion] = useState(0);
  const [hoveredText, setHoveredText] = useState<number | null>(null);
  const [draggingText, setDraggingText] = useState(false);
  const [textDraft, setTextDraft] = useState<{ point: Pt; value: string } | null>(null);
  // Mirror the draft in a ref so commit always sees the latest value regardless of
  // React closure timing (needed for reliable multi-text placement).
  const textDraftRef = useRef<{ point: Pt; value: string } | null>(null);

  function setDraft(d: { point: Pt; value: string } | null) {
    textDraftRef.current = d;
    setTextDraft(d);
  }
  /** Push the open text draft into marks (if it has content) and close it. */
  function commitDraft() {
    const d = textDraftRef.current;
    if (d && d.value.trim()) {
      marksRef.current.push({ kind: "text", point: d.point, text: d.value.trim() });
      redoRef.current = [];
      setHistoryVersion((v) => v + 1);
    }
    if (d) setDraft(null);
    requestAnimationFrame(redraw);
  }
  /** Switch tools; committing any open text draft first. */
  function setTool(next: MarkTool) {
    if (tool === "text" && next !== "text") commitDraft();
    if (next !== "text") setHoveredText(null);
    setToolState(next);
  }

  function setTextStyle(context: CanvasRenderingContext2D, surfaceWidth: number) {
    const fontSize = Math.max(18, surfaceWidth / 34);
    context.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    context.textBaseline = "top";
    return fontSize;
  }

  function textBounds(context: CanvasRenderingContext2D, mark: TextMark, surfaceWidth: number) {
    context.save();
    const fontSize = setTextStyle(context, surfaceWidth);
    const width = context.measureText(mark.text).width;
    context.restore();
    const hitPadding = Math.max(8, fontSize * 0.22);
    return {
      left: mark.point.x - hitPadding,
      top: mark.point.y - hitPadding,
      right: mark.point.x + width + hitPadding,
      bottom: mark.point.y + fontSize + hitPadding,
      textWidth: width,
      fontSize,
    };
  }

  function textAtPoint(point: Pt): number | null {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return null;
    for (let index = marksRef.current.length - 1; index >= 0; index--) {
      const mark = marksRef.current[index];
      if (mark.kind !== "text") continue;
      const bounds = textBounds(context, mark, canvas.width);
      if (point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom) {
        return index;
      }
    }
    return null;
  }

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxWidth = 1920;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      redraw();
      setReady(true);
    };
    image.src = imageUrl;
    return () => {
      image.onload = null;
    };
    // redraw reads the newly loaded image through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (textDraft) setDraft(null);
        else onCancel();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, onCancel, textDraft]);

  function drawMark(context: CanvasRenderingContext2D, mark: Mark, surfaceWidth?: number) {
    const width = surfaceWidth ?? canvasRef.current?.width ?? 1000;
    const strokeWidth = Math.max(3, width / 300);
    context.save();
    context.strokeStyle = MARK_COLOR;
    context.fillStyle = MARK_COLOR;
    context.lineWidth = strokeWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    if (mark.kind === "pen") {
      const first = mark.points[0];
      if (first && mark.points.length > 1) {
        context.beginPath();
        context.moveTo(first.x, first.y);
        mark.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.stroke();
      }
    } else if (mark.kind === "line") {
      context.beginPath();
      context.moveTo(mark.start.x, mark.start.y);
      context.lineTo(mark.end.x, mark.end.y);
      context.stroke();
    } else if (mark.kind === "rect") {
      const left = Math.min(mark.start.x, mark.end.x);
      const top = Math.min(mark.start.y, mark.end.y);
      context.strokeRect(left, top, Math.abs(mark.end.x - mark.start.x), Math.abs(mark.end.y - mark.start.y));
    } else {
      setTextStyle(context, width);
      context.fillStyle = MARK_COLOR;
      context.fillText(mark.text, mark.point.x, mark.point.y);
    }
    context.restore();
  }

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    marksRef.current.forEach((mark) => drawMark(context, mark, canvas.width));
    if (draftRef.current) drawMark(context, draftRef.current, canvas.width);
  }

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): Pt {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (busy || !ready) return;
    const point = pointFromEvent(event);
    if (tool === "text") {
      if (textDraftRef.current) commitDraft();
      const textIndex = textAtPoint(point);
      if (textIndex != null) {
        const mark = marksRef.current[textIndex];
        if (mark.kind !== "text") return;
        textDragRef.current = {
          index: textIndex,
          offset: { x: point.x - mark.point.x, y: point.y - mark.point.y },
          origin: { ...mark.point },
        };
        redoRef.current = [];
        setHoveredText(textIndex);
        setDraggingText(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      // Defer opening the new draft to the next frame so any currently focused
      // draft input blurs + commits first (otherwise the two setStates race).
      requestAnimationFrame(() => setDraft({ point, value: "" }));
      return;
    }
    drawingRef.current = true;
    redoRef.current = [];
    draftRef.current =
      tool === "pen"
        ? { kind: "pen", points: [point] }
        : tool === "line"
          ? { kind: "line", start: point, end: point }
          : { kind: "rect", start: point, end: point };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const textDrag = textDragRef.current;
    if (textDrag) {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      const mark = marksRef.current[textDrag.index];
      if (!canvas || !context || mark?.kind !== "text") return;
      const point = pointFromEvent(event);
      const desired = {
        x: point.x - textDrag.offset.x,
        y: point.y - textDrag.offset.y,
      };
      const bounds = textBounds(context, { ...mark, point: desired }, canvas.width);
      mark.point = {
        x: Math.max(0, Math.min(canvas.width - bounds.textWidth, desired.x)),
        y: Math.max(0, Math.min(canvas.height - bounds.fontSize, desired.y)),
      };
      redraw();
      return;
    }
    if (!drawingRef.current || !draftRef.current) return;
    const point = pointFromEvent(event);
    if (draftRef.current.kind === "pen") draftRef.current.points.push(point);
    else if (draftRef.current.kind === "line" || draftRef.current.kind === "rect") draftRef.current.end = point;
    redraw();
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (textDragRef.current) {
      const index = textDragRef.current.index;
      textDragRef.current = null;
      setDraggingText(false);
      setHoveredText(index);
      setHistoryVersion((version) => version + 1);
      redraw();
      return;
    }
    const draft = draftRef.current;
    if (!drawingRef.current || !draft) return;
    drawingRef.current = false;
    if (draft.kind === "pen") draft.points.push(pointFromEvent(event));
    else if (draft.kind === "line" || draft.kind === "rect") draft.end = pointFromEvent(event);
    const valid = draft.kind === "pen"
      ? draft.points.length > 1
      : draft.kind === "line"
        ? Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) > 4
        : draft.kind === "rect"
          ? Math.abs(draft.end.x - draft.start.x) > 4 && Math.abs(draft.end.y - draft.start.y) > 4
          : false;
    if (valid) marksRef.current.push(draft);
    draftRef.current = null;
    setHistoryVersion((version) => version + 1);
    redraw();
  }

  function undo() {
    if (busy) return;
    if (textDraft) {
      setDraft(null);
      return;
    }
    const mark = marksRef.current.pop();
    if (!mark) return;
    redoRef.current.push(mark);
    setHistoryVersion((version) => version + 1);
    redraw();
  }

  function redo() {
    if (busy) return;
    const mark = redoRef.current.pop();
    if (!mark) return;
    marksRef.current.push(mark);
    setHistoryVersion((version) => version + 1);
    redraw();
  }

  function clear() {
    if (busy) return;
    marksRef.current = [];
    redoRef.current = [];
    draftRef.current = null;
    textDragRef.current = null;
    setDraft(null);
    setHoveredText(null);
    setDraggingText(false);
    setHistoryVersion((version) => version + 1);
    redraw();
  }

  function submit() {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !ready) return;
    // Fold any open text draft into the marks before compositing.
    const draft = textDraftRef.current;
    if (draft && draft.value.trim()) {
      marksRef.current.push({ kind: "text", point: draft.point, text: draft.value.trim() });
      redoRef.current = [];
      setDraft(null);
    }

    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const context = output.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(image, 0, 0, output.width, output.height);
    marksRef.current.forEach((mark) => drawMark(context, mark, output.width));
    output.toBlob((blob) => {
      if (blob) onSubmit(blob, note.trim());
    }, "image/png");
  }

  const canUndo = marksRef.current.length > 0 || Boolean(textDraft);
  const canRedo = redoRef.current.length > 0;
  const canvas = canvasRef.current;
  const draftLeft = textDraft && canvas ? `${(textDraft.point.x / canvas.width) * 100}%` : "0";
  const draftTop = textDraft && canvas ? `${(textDraft.point.y / canvas.height) * 100}%` : "0";
  return (
    <div className="mark-inline" role="region" aria-label={`Mark slide ${slideIndex}`}>
      <canvas
        ref={canvasRef}
        className={`mark-canvas-overlay tool-${tool}${hoveredText != null ? " over-text" : ""}${draggingText ? " dragging-text" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          if (tool === "text" && !textDragRef.current) setHoveredText(textAtPoint(pointFromEvent(event)));
          onPointerMove(event);
        }}
        onPointerLeave={() => {
          if (!textDragRef.current) setHoveredText(null);
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {textDraft && (
        <input
          className="mark-text-draft"
          style={{ left: draftLeft, top: draftTop }}
          autoFocus
          value={textDraft.value}
          placeholder="输入文字，回车确认"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => setDraft({ point: textDraft.point, value: event.target.value })}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
            if (event.key === "Escape") {
              event.stopPropagation();
              setDraft(null);
            }
          }}
        />
      )}

      <div className="mark-tools" aria-label="Mark tools" onPointerDown={(event) => event.stopPropagation()}>
        <span className="mark-slide-chip">{slideIndex}</span>
        <button type="button" className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")} aria-label="Freehand" aria-pressed={tool === "pen"} title="Freehand"><PencilSimple size={17} /></button>
        <button type="button" className={tool === "line" ? "active" : ""} onClick={() => setTool("line")} aria-label="Straight line" aria-pressed={tool === "line"} title="Straight line"><LineSegment size={17} /></button>
        <button type="button" className={tool === "rect" ? "active" : ""} onClick={() => setTool("rect")} aria-label="Rectangle" aria-pressed={tool === "rect"} title="Rectangle"><Rectangle size={17} /></button>
        <button type="button" className={tool === "text" ? "active" : ""} onClick={() => setTool("text")} aria-label="Text label" aria-pressed={tool === "text"} title="Text label · drag placed text to reposition"><TextT size={17} /></button>
            <span className="mark-tools-sep" />
        <button type="button" onClick={undo} disabled={busy || !canUndo} aria-label="Undo" title="Undo"><ArrowCounterClockwise size={17} /></button>
        <button type="button" onClick={redo} disabled={busy || !canRedo} aria-label="Redo" title="Redo"><ArrowClockwise size={17} /></button>
        <button type="button" onClick={clear} disabled={busy || !canUndo} aria-label="Clear marks" title="Clear marks"><Trash size={17} /></button>
        <span className="mark-tools-sep" />
        <button type="button" onClick={onCancel} disabled={busy} aria-label="Close mark tool" title="Close"><X size={17} /></button>
      </div>

      <div className="mark-comment-row" onPointerDown={(event) => event.stopPropagation()}>
        <div className="mark-comment-main">
          <textarea
            rows={1}
            placeholder="Comment for Deck Agent"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
          />
          {error && <span className="mark-submit-error" role="alert">{error} Your marks are still here—press Send to retry.</span>}
        </div>
        <button type="button" className="mark-send" onClick={submit} disabled={busy || !ready}>
          <PaperPlaneRight size={17} />
          <span>{busy ? "Editing" : error ? "Retry" : "Send"}</span>
        </button>
      </div>
    </div>
  );
}
