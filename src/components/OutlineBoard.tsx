"use client";

import { Fragment, useState } from "react";
import type { OutlinePage } from "@/lib/types";

/**
 * Step 3-4 of the staged flow (编辑大纲 → 确认): an editable outline shown in the
 * right stage while the deck is still a draft. Titles/points are editable, pages
 * can be reordered/added/removed, and a prominent bar confirms → per-page render.
 */
export default function OutlineBoard({
  title,
  aspect,
  outline,
  onChange,
  onConfirm,
  busy = false,
  streaming = false,
  researchDoc,
}: {
  title: string;
  aspect: string;
  outline: OutlinePage[];
  onChange: (pages: OutlinePage[]) => void;
  onConfirm: () => void;
  /** true while the render is being kicked off (locks editing). */
  busy?: boolean;
  /** true while the outline is still being written by the agent. */
  streaming?: boolean;
  researchDoc?: string;
}) {
  const [showBrief, setShowBrief] = useState(false);
  const editable = !busy && !streaming;
  const count = outline.length;

  function setTitle(i: number, value: string) {
    onChange(outline.map((p, idx) => (idx === i ? { ...p, title: value } : p)));
  }
  function setPoints(i: number, text: string) {
    onChange(outline.map((p, idx) => (idx === i ? { ...p, points: text.split("\n") } : p)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= count) return;
    const next = [...outline];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    if (count <= 1) return;
    onChange(outline.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...outline, { title: "", points: [] }]);
  }
  function insertAt(i: number) {
    const next = [...outline];
    next.splice(i, 0, { title: "", points: [] });
    onChange(next);
  }

  return (
    <section className="stage outline-stage">
      <div className="stage-head">
        <span className="title">{title || "Draft outline"}</span>
        <span className="count">{count} 页 · {aspect}</span>
        <div className="stage-actions">
          <button
            className="iconbtn primary"
            disabled={!editable || count === 0}
            onClick={onConfirm}
            title="按大纲逐页生成幻灯片"
          >
            ✓ 生成 {count} 页
          </button>
        </div>
      </div>

      <div className="outline-board">
        <p className="outline-hint">
          先确认大纲：可改标题、增删要点、调整顺序，也可让左侧 agent 直接修改。满意后点「生成」开始逐页出图。
        </p>

        {researchDoc && (
          <div className="outline-brief">
            <button className="outline-brief-toggle" onClick={() => setShowBrief((v) => !v)}>
              📄 研究简报 <span className="caret">{showBrief ? "▴" : "▾"}</span>
            </button>
            {showBrief && <pre className="outline-brief-body">{researchDoc}</pre>}
          </div>
        )}

        {streaming && count === 0 ? (
          <div className="outline-skeleton">
            {[0, 1, 2, 3].map((k) => (
              <span className="skeleton skel-line" key={k} />
            ))}
          </div>
        ) : (
          <ol className="outline-list">
            {outline.map((p, i) => (
              <Fragment key={i}>
                <li className="outline-card">
                  <div className="outline-card-head">
                    <span className="outline-idx">{i + 1}</span>
                    <input
                      className="outline-title"
                      value={p.title}
                      placeholder={`第 ${i + 1} 页标题`}
                      disabled={!editable}
                      onChange={(e) => setTitle(i, e.target.value)}
                    />
                    <div className="outline-card-actions">
                      <button disabled={!editable || i === 0} onClick={() => move(i, -1)} title="上移" aria-label="上移">↑</button>
                      <button disabled={!editable || i === count - 1} onClick={() => move(i, 1)} title="下移" aria-label="下移">↓</button>
                      <button className="danger" disabled={!editable || count <= 1} onClick={() => remove(i)} title="删除" aria-label="删除">✕</button>
                    </div>
                  </div>
                  <textarea
                    className="outline-points"
                    rows={Math.max(2, p.points.length)}
                    value={p.points.join("\n")}
                    placeholder="这一页讲什么？每行写一个要点…"
                    disabled={!editable}
                    onChange={(e) => setPoints(i, e.target.value)}
                  />
                </li>
                {i < count - 1 && (
                  <li className="outline-insert-row">
                    <button
                      className="outline-insert"
                      disabled={!editable}
                      onClick={() => insertAt(i + 1)}
                      title="在此插入一页"
                      aria-label={`在第 ${i + 1} 页后插入一页`}
                    >
                      ＋
                    </button>
                  </li>
                )}
              </Fragment>
            ))}
          </ol>
        )}

        {!streaming && (
          <button className="outline-add" disabled={!editable} onClick={add}>
            ＋ 添加一页
          </button>
        )}
      </div>

      <div className="outline-confirm">
        <div className="outline-confirm-info">
          <span className="outline-confirm-count">共 <b>{count}</b> 页大纲已就绪</span>
          <small>确认后逐页生成，每页约 30s</small>
        </div>
        <button className="outline-confirm-btn" disabled={!editable || count === 0} onClick={onConfirm}>
          {busy ? "生成中…" : `✓ 生成 ${count} 页幻灯片`}
        </button>
      </div>
    </section>
  );
}
