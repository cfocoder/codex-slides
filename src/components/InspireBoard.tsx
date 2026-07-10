"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COMMUNITY_GROUPS,
  COMMUNITY_TEMPLATES,
  getCommunityTemplate,
  matchCommunityTemplates,
  type CommunityTemplate,
} from "@/lib/community";
import { rankInspire } from "@/lib/deckEdit";

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Inspiration step (参考灵感): shown after the outline is confirmed ONLY when no
 * template was picked. Community styles are ranked against the topic + outline
 * (codex, with an instant offline keyword fallback); the user picks one to render
 * with, or skips to use the default style.
 */
export default function InspireBoard({
  requirement,
  outlineTitles,
  pages,
  aspect,
  busy,
  onGenerate,
}: {
  requirement: string;
  outlineTitles: string[];
  pages: number;
  aspect: string;
  busy: boolean;
  onGenerate: (templateId?: string) => void;
}) {
  const matchQuery = useMemo(
    () => [requirement, ...outlineTitles].join(" "),
    [requirement, outlineTitles],
  );
  // Instant offline order first; codex re-ranks it when it returns.
  const [order, setOrder] = useState<string[]>(() =>
    matchCommunityTemplates(matchQuery).map((t) => t.id),
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [ranking, setRanking] = useState(true);
  const [group, setGroup] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const ranReq = useRef(false);

  useEffect(() => {
    if (ranReq.current) return;
    ranReq.current = true;
    let alive = true;
    rankInspire(requirement, outlineTitles)
      .then((res) => {
        if (!alive) return;
        if (res.ranked?.length) setOrder(res.ranked);
        if (res.reasons) setReasons(res.reasons);
      })
      .catch(() => {
        /* keep the offline order */
      })
      .finally(() => {
        if (alive) setRanking(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ordered = useMemo(() => {
    const byId = new Map(COMMUNITY_TEMPLATES.map((t) => [t.id, t]));
    const list = order.map((id) => byId.get(id)).filter(Boolean) as CommunityTemplate[];
    // include any not present in `order` (defensive)
    for (const t of COMMUNITY_TEMPLATES) if (!order.includes(t.id)) list.push(t);
    return list;
  }, [order]);

  const q = search.trim().toLowerCase();
  const visible = ordered.filter((t) => {
    if (group !== "all" && t.group !== group) return false;
    if (!q) return true;
    return [t.name, t.group, t.description, t.tags.join(" ")].join(" ").toLowerCase().includes(q);
  });

  const pickedTpl = getCommunityTemplate(picked);

  return (
    <section className="stage inspire-stage">
      <div className="stage-head">
        <span className="title">挑一个视觉风格</span>
        <span className="count">第 3 步 · 参考灵感 · {aspect}</span>
        <div className="stage-actions">
          <button className="iconbtn ghost" disabled={busy} onClick={() => onGenerate(undefined)} title="用默认风格直接生成">
            跳过
          </button>
          <button
            className="iconbtn primary"
            disabled={busy || !picked}
            onClick={() => picked && onGenerate(picked)}
            title={picked ? "按所选风格逐页生成" : "先选一个风格"}
          >
            {busy ? "…" : picked ? `用「${pickedTpl?.name}」生成 ${pages} 页 →` : `选一个风格生成 ${pages} 页`}
          </button>
        </div>
      </div>

      <div className="inspire-board">
        <p className="inspire-hint">
          大纲已定。挑一个视觉方向，我就按它逐页出图——已根据你的主题和大纲
          {ranking ? <span className="inspire-ranking"> 智能匹配中<span className="spinner sm" /></span> : " 排好序"}。
          也可以「跳过」用默认风格。
        </p>

        <div className="inspire-controls">
          <div className="community-groups" role="tablist" aria-label="Filter by style group">
            <button className={`group-chip ${group === "all" ? "on" : ""}`} role="tab" aria-selected={group === "all"} onClick={() => setGroup("all")}>
              全部
            </button>
            {COMMUNITY_GROUPS.map((g) => (
              <button key={g} className={`group-chip ${group === g ? "on" : ""}`} role="tab" aria-selected={group === g} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
          </div>
          <input
            className="inspire-search"
            placeholder="搜索风格…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search styles"
          />
        </div>

        <div className="inspire-grid">
          {visible.map((t, i) => {
            const ground = [...t.palette].sort((a, b) => lum(a) - lum(b))[0];
            const reason = reasons[t.id];
            const recommended = !ranking && group === "all" && !q && i < 3;
            return (
              <button
                key={t.id}
                className={`tpl-card inspire-card ${picked === t.id ? "on" : ""}`}
                onClick={() => setPicked(picked === t.id ? null : t.id)}
                title={t.description}
                aria-pressed={picked === t.id}
              >
                <div className="tpl-cover" style={{ background: ground }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.cover} alt="" loading="lazy" />
                  {recommended && <span className="inspire-badge">✦ 推荐</span>}
                  <span className="tpl-selected" aria-hidden="true">✓</span>
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
                {reason && <div className="inspire-reason">{reason}</div>}
              </button>
            );
          })}
          {!visible.length && <div className="inspire-empty">没有匹配的风格，换个筛选或搜索词。</div>}
        </div>
      </div>
    </section>
  );
}
