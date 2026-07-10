"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SlideTransition } from "@/lib/types";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={direction === "left" ? "m12.5 4.5-5 5.5 5 5.5" : "m7.5 4.5 5 5.5-5 5.5"} />
    </svg>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {active ? (
        <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />
      ) : (
        <path d="M8 3H3v5M12 3h5v5M8 17H3v-5M12 17h5v-5" />
      )}
    </svg>
  );
}

/** Focused slideshow with keyboard navigation and auto-hiding presenter controls. */
export default function PlayMode({
  slides,
  onClose,
}: {
  slides: { index: number; url: string; title: string; transition?: SlideTransition }[];
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setControlsVisible(false), 2600);
  }, []);

  const move = useCallback(
    (delta: number) => setI((current) => Math.max(0, Math.min(slides.length - 1, current + delta))),
    [slides.length],
  );

  const close = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    onClose();
  }, [onClose]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        move(1);
        revealControls();
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        move(-1);
        revealControls();
      } else if (event.key === "Home") {
        event.preventDefault();
        setI(0);
        revealControls();
      } else if (event.key === "End") {
        event.preventDefault();
        setI(Math.max(0, slides.length - 1));
        revealControls();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, move, revealControls, slides.length]);

  if (!slides.length) return null;
  const currentIndex = Math.min(i, slides.length - 1);
  const slide = slides[currentIndex];
  const progress = ((currentIndex + 1) / slides.length) * 100;

  return (
    <div
      className={`playmode${controlsVisible ? " controls-visible" : " controls-hidden"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Presentation mode"
      onMouseMove={revealControls}
      onMouseDown={revealControls}
      onTouchStart={revealControls}
      onMouseLeave={() => setControlsVisible(false)}
    >
      <div className="playmode-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${slide.index}-${currentIndex}`}
          className={`playmode-slide playmode-transition-${slide.transition ?? "none"}`}
          src={slide.url}
          alt={slide.title}
        />
      </div>

      <div className="playmode-top playmode-chrome">
        <div className="playmode-keyhint" aria-hidden="true">
          <kbd>←</kbd>
          <kbd>→</kbd>
          <span>Navigate</span>
        </div>
        <button className="playmode-exit" onClick={close} aria-label="Exit presentation">
          <span>Exit</span>
          <kbd>Esc</kbd>
        </button>
      </div>

      <button
        className="playmode-nav playmode-nav-prev playmode-chrome"
        onClick={() => move(-1)}
        disabled={currentIndex === 0}
        aria-label="Previous slide"
      >
        <Chevron direction="left" />
      </button>
      <button
        className="playmode-nav playmode-nav-next playmode-chrome"
        onClick={() => move(1)}
        disabled={currentIndex === slides.length - 1}
        aria-label="Next slide"
      >
        <Chevron direction="right" />
      </button>

      <div className="playmode-dock playmode-chrome">
        <button onClick={() => move(-1)} disabled={currentIndex === 0} aria-label="Previous slide">
          <Chevron direction="left" />
        </button>
        <div className="playmode-meta" aria-live="polite">
          <div className="playmode-meta-line">
            <strong>{currentIndex + 1} / {slides.length}</strong>
            <span>{slide.title}</span>
          </div>
          <div className="playmode-progress" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button
          onClick={() => move(1)}
          disabled={currentIndex === slides.length - 1}
          aria-label="Next slide"
        >
          <Chevron direction="right" />
        </button>
        <span className="playmode-dock-sep" aria-hidden="true" />
        <button onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
          <FullscreenIcon active={fullscreen} />
        </button>
      </div>
    </div>
  );
}
