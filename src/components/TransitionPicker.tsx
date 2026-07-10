"use client";

import {
  ArrowClockwise,
  ArrowLineLeft,
  ArrowRight,
  ArrowsOut,
  CircleHalf,
  Minus,
  X,
} from "@phosphor-icons/react";
import { useEffect } from "react";
import type { SlideTransition } from "@/lib/types";

const OPTIONS = [
  { id: "none", label: "None", Icon: Minus },
  { id: "fade", label: "Fade", Icon: CircleHalf },
  { id: "push", label: "Push", Icon: ArrowRight },
  { id: "wipe", label: "Wipe", Icon: ArrowLineLeft },
  { id: "zoom", label: "Zoom", Icon: ArrowsOut },
  { id: "flip", label: "Flip", Icon: ArrowClockwise },
] as const;

export default function TransitionPicker({
  slideIndex,
  value,
  saving,
  error,
  onSelect,
  onClose,
}: {
  slideIndex: number;
  value: SlideTransition;
  saving: boolean;
  error?: string;
  onSelect: (transition: SlideTransition) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-bg transition-modal-bg" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="transition-modal" role="dialog" aria-modal="true" aria-labelledby="transition-title">
        <div className="transition-modal-head">
          <div>
            <h3 id="transition-title">Slide {slideIndex} transition</h3>
            <p>Plays when this slide enters presentation mode.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close transition picker"><X size={18} /></button>
        </div>
        <div className="transition-grid">
          {OPTIONS.map(({ id, label, Icon }) => {
            const selected = value === id;
            return (
              <button
                key={id}
                type="button"
                className={`transition-option${selected ? " selected" : ""}`}
                onClick={() => onSelect(id)}
                disabled={saving}
                aria-pressed={selected}
                autoFocus={selected}
              >
                <span className={`transition-option-demo transition-demo-${id}`} aria-hidden="true">
                  <Icon size={44} weight="regular" />
                </span>
                <b>{label}</b>
              </button>
            );
          })}
        </div>
        <div className="transition-modal-foot">
          <span className={error ? "transition-error" : ""} role={error ? "alert" : undefined}>
            {error
              ? `Couldn’t save: ${error}`
              : saving
                ? "Saving transition…"
                : `${OPTIONS.find((option) => option.id === value)?.label ?? "None"} selected`}
          </span>
          <button type="button" className="primary" onClick={onClose} disabled={saving}>Done</button>
        </div>
      </div>
    </div>
  );
}
