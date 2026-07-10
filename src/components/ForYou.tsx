"use client";

import { useRef } from "react";
import { CATEGORIES, TEMPLATES } from "@/lib/templates";

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.labelEn ?? id;

const PREVIEWS: Record<string, { project: string; image: string }> = {
  "pitch-clean-daylight": {
    project: "20260710035532-agent-native-design-zora",
    image: "01.png",
  },
  "craft-editorial-ink": {
    project: "20260709203131-urban-mobility-report-fcv1",
    image: "01.png",
  },
  "data-answer-first": {
    project: "20260709213727-state-of-ev-charging-infrastructure-in-2-jp1b",
    image: "01.png",
  },
  "pitch-midnight-traction": {
    project: "20260709180111-our-company-hvlz",
    image: "01.png",
  },
};

const RECOMMENDED = Object.keys(PREVIEWS);
const RECOMMENDED_CARDS = RECOMMENDED.map((id) => TEMPLATES.find((t) => t.id === id))
  .filter((t): t is (typeof TEMPLATES)[number] => Boolean(t))
  .map((t) => {
    const bg = [...t.palette].sort((a, b) => lum(b) - lum(a))[0];
    const ink = [...t.palette].sort((a, b) => contrast(b, bg) - contrast(a, bg))[0];
    return { t, bg, ink, preview: PREVIEWS[t.id] };
  });

/** "For you" gallery, using finished generated slides as the visual preview. */
export default function ForYou({
  selected,
  onPick,
}: {
  selected?: string;
  onPick: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function nudge(dir: number) {
    scrollRef.current?.scrollBy({ left: dir * 440, behavior: "smooth" });
  }

  return (
    <section className="foryou" aria-labelledby="foryou-heading">
      <div className="section-head foryou-head">
        <div>
          <h2 id="foryou-heading">For you</h2>
          <p>Start with a finished visual direction</p>
        </div>
        <div className="foryou-nav">
          <button className="round-btn" onClick={() => nudge(-1)} aria-label="Scroll left">
            ‹
          </button>
          <button className="round-btn" onClick={() => nudge(1)} aria-label="Scroll right">
            ›
          </button>
        </div>
      </div>
      <div className="foryou-scroll" ref={scrollRef}>
        {RECOMMENDED_CARDS.map(({ t, bg, ink, preview }) => (
          <button
            key={t.id}
            className={`tpl-card ${selected === t.id ? "on" : ""}`}
            onClick={() => onPick(t.id)}
            title={t.description}
            aria-pressed={selected === t.id}
          >
            <div className="tpl-cover" style={{ background: bg, color: ink }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${preview.project}/${preview.image}`} alt="" />
              <span className="tpl-selected" aria-hidden="true">
                ✓
              </span>
            </div>
            <div className="tpl-info">
              <div>
                <div className="tpl-meta">{t.name}</div>
                <div className="tpl-cat">{catLabel(t.categoryId)}</div>
              </div>
              <span className="tpl-arrow" aria-hidden="true">↗</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
