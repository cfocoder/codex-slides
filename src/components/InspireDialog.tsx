"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import {
  COMMUNITY_GROUPS,
  COMMUNITY_TEMPLATES,
  getCommunityTemplate,
  inspireChips,
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
 * Inspiration browser (参考灵感) — the "Browse" popup opened from the in-chat
 * inspiration card. Community styles are pre-filtered against the deck topic +
 * outline (instant offline keyword rank, upgraded by a codex re-rank when it
 * returns), filterable by group, and freely searchable. Pick one (max 1) to
 * render with, or skip to use the default style.
 */
export default function InspireDialog({
  requirement,
  outlineTitles,
  selected,
  onClose,
  onSkip,
  onSubmit,
}: {
  requirement: string;
  outlineTitles: string[];
  selected?: string;
  onClose: () => void;
  onSkip: () => void;
  onSubmit: (templateId: string) => void;
}) {
  const matchQuery = useMemo(
    () => [requirement, ...outlineTitles].filter(Boolean).join(" "),
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
  const [picked, setPicked] = useState<string | undefined>(selected);
  const chips = useMemo(() => inspireChips(matchQuery), [matchQuery]);
  const ranReq = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc closes; focus the close button on open.
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Codex re-rank (best effort — the offline order stays if it fails).
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="inspire-dialog-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="inspire-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspire-dialog-title"
      >
        <header className="inspire-dialog-head">
          <div className="inspire-search-wrap">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              className="inspire-dialog-search"
              placeholder="搜索视觉风格，如 数据可视化 / 杂志排版 / 手绘…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search styles"
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="inspire-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="inspire-dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} weight="bold" />
          </button>
        </header>

        <div className="inspire-dialog-filters">
          <div className="inspire-try">
            <span className="inspire-try-label">Try:</span>
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                className="inspire-try-chip"
                onClick={() => setSearch(c)}
              >
                {c}
              </button>
            ))}
            <span id="inspire-dialog-title" className="inspire-rank-note">
              {ranking ? (
                <>
                  智能匹配中<span className="spinner sm" />
                </>
              ) : (
                "已按你的主题排序"
              )}
            </span>
          </div>
          <div className="community-groups" role="tablist" aria-label="Filter by style group">
            <button
              type="button"
              className={`group-chip ${group === "all" ? "on" : ""}`}
              role="tab"
              aria-selected={group === "all"}
              onClick={() => setGroup("all")}
            >
              全部
            </button>
            {COMMUNITY_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                className={`group-chip ${group === g ? "on" : ""}`}
                role="tab"
                aria-selected={group === g}
                onClick={() => setGroup(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="inspire-dialog-grid">
          {visible.map((t, i) => {
            const ground = [...t.palette].sort((a, b) => lum(a) - lum(b))[0];
            const reason = reasons[t.id];
            const recommended = !ranking && group === "all" && !q && i < 3;
            return (
              <button
                key={t.id}
                type="button"
                className={`tpl-card inspire-card ${picked === t.id ? "on" : ""}`}
                onClick={() => setPicked(picked === t.id ? undefined : t.id)}
                title={t.description}
                aria-pressed={picked === t.id}
              >
                <div className="tpl-cover" style={{ background: ground }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.cover} alt="" loading="lazy" />
                  {recommended && <span className="inspire-badge">✦ 推荐</span>}
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
                {reason && <div className="inspire-reason">{reason}</div>}
              </button>
            );
          })}
          {!visible.length && (
            <div className="inspire-empty">没有匹配的风格，换个筛选或搜索词。</div>
          )}
        </div>

        <footer className="inspire-dialog-foot">
          <span className="inspire-foot-hint">点选一个风格（最多 1 个）</span>
          <div className="inspire-foot-actions">
            <button type="button" className="iconbtn ghost" onClick={onSkip}>
              跳过，用默认风格
            </button>
            <button
              type="button"
              className="iconbtn primary"
              disabled={!picked}
              onClick={() => picked && onSubmit(picked)}
            >
              {pickedTpl ? `用「${pickedTpl.name}」生成 →` : "选一个风格"}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
