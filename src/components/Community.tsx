"use client";

import { useMemo, useState } from "react";
import { COMMUNITY_GROUPS, COMMUNITY_TEMPLATES } from "@/lib/community";

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Home "Community" gallery — reusable slide styles distilled from the Nano
 *  Banana Pro community, shown as a scrolling multi-row grid. Picking one seeds
 *  config.template (styleBlock). */
export default function Community({
  selected,
  onPick,
}: {
  selected?: string;
  onPick: (id: string) => void;
}) {
  const [group, setGroup] = useState<string>("all");

  const cards = useMemo(() => {
    const list = group === "all" ? COMMUNITY_TEMPLATES : COMMUNITY_TEMPLATES.filter((t) => t.group === group);
    return list.map((t) => ({ t, ground: [...t.palette].sort((a, b) => lum(a) - lum(b))[0] }));
  }, [group]);

  return (
    <section className="foryou community" aria-labelledby="community-heading">
      <div className="section-head foryou-head">
        <div>
          <h2 id="community-heading">✦ Community</h2>
          <p>Reusable visual styles from the Nano Banana Pro community · {COMMUNITY_TEMPLATES.length} styles</p>
        </div>
      </div>
      <div className="community-groups" role="tablist" aria-label="Filter by style group">
        <button
          className={`group-chip ${group === "all" ? "on" : ""}`}
          role="tab"
          aria-selected={group === "all"}
          onClick={() => setGroup("all")}
        >
          All <span className="group-count">{COMMUNITY_TEMPLATES.length}</span>
        </button>
        {COMMUNITY_GROUPS.map((g) => {
          const n = COMMUNITY_TEMPLATES.filter((t) => t.group === g).length;
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
      <div className="community-grid">
        {cards.map(({ t, ground }) => (
          <button
            key={t.id}
            className={`tpl-card ${selected === t.id ? "on" : ""}`}
            onClick={() => onPick(t.id)}
            title={t.description}
            aria-pressed={selected === t.id}
          >
            <div className="tpl-cover" style={{ background: ground }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.cover} alt="" loading="lazy" />
              <span className="tpl-selected" aria-hidden="true">
                ✓
              </span>
            </div>
            <div className="tpl-info">
              <div>
                <div className="tpl-meta">{t.name}</div>
                <div className="tpl-cat">{t.group}</div>
              </div>
              <span className="inspire-palette" aria-hidden="true">
                {t.palette.slice(0, 4).map((c) => (
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
