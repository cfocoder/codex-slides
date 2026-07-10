"use client";

import { useMemo, useRef, useState } from "react";
import { COMMUNITY_GROUPS, COMMUNITY_TEMPLATES } from "@/lib/community";
import { CATEGORIES, getTemplate } from "@/lib/templates";

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const FORYOU_GROUP = "For you";

// Curated "For you" picks (finished visual directions), previewed with real
// generated slides from existing projects. Merged into the Community gallery.
const FORYOU_PREVIEWS: Record<string, { project: string; image: string }> = {
  "pitch-clean-daylight": { project: "20260710035532-agent-native-design-zora", image: "01.png" },
  "craft-editorial-ink": { project: "20260709203131-urban-mobility-report-fcv1", image: "01.png" },
  "data-answer-first": { project: "20260709213727-state-of-ev-charging-infrastructure-in-2-jp1b", image: "01.png" },
  "pitch-midnight-traction": { project: "20260709180111-our-company-hvlz", image: "01.png" },
};
const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.labelEn ?? id;

interface GalleryItem {
  id: string;
  name: string;
  group: string;
  sub: string;
  img: string;
  palette: string[];
  desc?: string;
}

const FORYOU_ITEMS: GalleryItem[] = Object.entries(FORYOU_PREVIEWS)
  .map(([id, p]): GalleryItem | null => {
    const t = getTemplate(id);
    if (!t) return null;
    return {
      id,
      name: t.name,
      group: FORYOU_GROUP,
      sub: catLabel(t.categoryId),
      img: `/api/files/${p.project}/${p.image}`,
      palette: t.palette,
      desc: t.description,
    };
  })
  .filter((x): x is GalleryItem => Boolean(x));

const COMMUNITY_ITEMS: GalleryItem[] = COMMUNITY_TEMPLATES.map((t) => ({
  id: t.id,
  name: t.name,
  group: t.group,
  sub: t.group,
  img: t.cover,
  palette: t.palette,
  desc: t.description,
}));

const ALL_ITEMS: GalleryItem[] = [...FORYOU_ITEMS, ...COMMUNITY_ITEMS];
const GROUPS: string[] = [FORYOU_GROUP, ...COMMUNITY_GROUPS];

/** Home gallery — finished "For you" directions + reusable Nano Banana Pro
 *  community styles, unified into one "For you"-style strip under the composer.
 *  Picking one seeds config.template (styleBlock). */
export default function Community({
  selected,
  onPick,
}: {
  selected?: string;
  onPick: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [group, setGroup] = useState<string>("all");

  const cards = useMemo(() => {
    const list = group === "all" ? ALL_ITEMS : ALL_ITEMS.filter((i) => i.group === group);
    return list.map((i) => ({ i, ground: [...i.palette].sort((a, b) => lum(a) - lum(b))[0] }));
  }, [group]);

  function nudge(dir: number) {
    scrollRef.current?.scrollBy({ left: dir * 440, behavior: "smooth" });
  }

  return (
    <section className="foryou community" aria-labelledby="community-heading">
      <div className="section-head foryou-head">
        <div>
          <h2 id="community-heading">✦ Community</h2>
          <p>Start from a finished direction or a community style</p>
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
      <div className="community-groups" role="tablist" aria-label="Filter by style group">
        <button
          className={`group-chip ${group === "all" ? "on" : ""}`}
          role="tab"
          aria-selected={group === "all"}
          onClick={() => setGroup("all")}
        >
          All <span className="group-count">{ALL_ITEMS.length}</span>
        </button>
        {GROUPS.map((g) => {
          const n = ALL_ITEMS.filter((i) => i.group === g).length;
          if (!n) return null;
          return (
            <button
              key={g}
              className={`group-chip ${group === g ? "on" : ""}`}
              role="tab"
              aria-selected={group === g}
              onClick={() => setGroup(g)}
            >
              {g} <span className="group-count">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="foryou-scroll" ref={scrollRef}>
        {cards.map(({ i, ground }) => (
          <button
            key={i.id}
            className={`tpl-card ${selected === i.id ? "on" : ""}`}
            onClick={() => onPick(i.id)}
            title={i.desc}
            aria-pressed={selected === i.id}
          >
            <div className="tpl-cover" style={{ background: ground }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.img} alt="" loading="lazy" />
              <span className="tpl-selected" aria-hidden="true">
                ✓
              </span>
            </div>
            <div className="tpl-info">
              <div>
                <div className="tpl-meta">{i.name}</div>
                <div className="tpl-cat">{i.sub}</div>
              </div>
              <span className="inspire-palette" aria-hidden="true">
                {i.palette.slice(0, 4).map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
