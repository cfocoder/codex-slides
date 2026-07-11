"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon } from "@phosphor-icons/react";
import type { QuestionSpec } from "@/lib/onboard";
import { uploadContextItems, type ContextItem } from "@/lib/contextItems";
import type { PptConfig } from "@/lib/types";

/** Renders the agent-generated clarifying questions as a dynamic form (M2 / step 1).
 *  Every question accepts a free-text custom answer AND reference images, which are
 *  attached as materials the pipeline consumes (image → PPT reference). */
export default function OnboardForm({
  questions,
  busy,
  onCancel,
  onComplete,
  onAttachImages,
  onRemoveImage,
  submitLabel,
  skipLabel = "Skip",
}: {
  questions: QuestionSpec[];
  busy: boolean;
  onCancel: () => void;
  onComplete: (patch: Partial<PptConfig>, requirementSuffix: string, summary: string) => void;
  /** Push newly attached reference images up to the shared materials list. */
  onAttachImages?: (items: ContextItem[]) => void;
  /** Remove a previously attached reference image from the shared materials list. */
  onRemoveImage?: (id: string) => void;
  /** Override the primary button copy (staged flow continues to the outline, not straight to generate). */
  submitLabel?: string;
  skipLabel?: string;
}) {
  const initial = useMemo(() => {
    const a: Record<string, string | string[]> = {};
    for (const q of questions) {
      if (q.type === "multi") a[q.id] = [];
      else a[q.id] = q.recommended ?? "";
    }
    return a;
  }, [questions]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(initial);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [images, setImages] = useState<Record<string, ContextItem[]>>({});
  const [uploadingQ, setUploadingQ] = useState<string | null>(null);
  const [attachError, setAttachError] = useState("");

  function setOne(id: string, v: string | string[]) {
    setAnswers((a) => ({ ...a, [id]: v }));
  }
  function toggleMulti(id: string, v: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      return { ...a, [id]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
  }
  /** Picking a preset clears any custom text so the choice is unambiguous. */
  function pickOption(id: string, v: string) {
    setOne(id, v);
    setCustom((c) => ({ ...c, [id]: "" }));
  }
  function setCustomText(id: string, text: string, type: QuestionSpec["type"]) {
    setCustom((c) => ({ ...c, [id]: text }));
    if (type === "single") setOne(id, text); // single answer follows the custom box live
  }

  async function addImages(qid: string, fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setUploadingQ(qid);
    setAttachError("");
    const result = await uploadContextItems(files);
    if (result.items.length) {
      setImages((m) => ({ ...m, [qid]: [...(m[qid] ?? []), ...result.items] }));
      onAttachImages?.(result.items);
    }
    if (result.errors.length) setAttachError(result.errors.join(" · "));
    setUploadingQ(null);
  }
  function removeImage(qid: string, id: string) {
    setImages((m) => ({ ...m, [qid]: (m[qid] ?? []).filter((it) => it.id !== id) }));
    onRemoveImage?.(id);
  }

  /** Effective answer for a question, folding in any custom free-text. */
  function effective(q: QuestionSpec): string | string[] {
    const c = (custom[q.id] ?? "").trim();
    if (q.type === "multi") {
      const arr = Array.isArray(answers[q.id]) ? [...(answers[q.id] as string[])] : [];
      if (c) arr.push(c);
      return arr;
    }
    if (q.type === "single") return c || String(answers[q.id] ?? "");
    return String(answers[q.id] ?? "");
  }

  function submit() {
    const patch: Partial<PptConfig> = {};
    const prefs: string[] = [];
    const summaryParts: string[] = [];
    for (const q of questions) {
      const val = effective(q);
      const asStr = Array.isArray(val) ? val.join(", ") : String(val ?? "");
      const imgs = images[q.id] ?? [];
      const label = q.question.replace(/[?？]\s*$/, "");
      if (!asStr && !imgs.length) continue;
      const chosen = (Array.isArray(val) ? val : [val])
        .filter(Boolean)
        .map((v) => (q.options ?? []).find((o) => o.value === v)?.label ?? String(v));
      const summaryBits = [...chosen];
      if (imgs.length) summaryBits.push(`📎 ${imgs.length} 张参考图`);
      if (summaryBits.length) summaryParts.push(`${label}：${summaryBits.join("、")}`);
      if (imgs.length) prefs.push(`${label}: user attached ${imgs.length} reference image(s) — honor them.`);
      if (!asStr) continue;
      switch (q.field) {
        case "pages":
          patch.pages = Math.max(1, Math.min(30, Number(asStr) || 6));
          break;
        case "aspect":
          patch.aspect = asStr as PptConfig["aspect"];
          break;
        case "language":
          patch.language = asStr as PptConfig["language"];
          break;
        case "style":
          patch.style = asStr;
          break;
        case "category": {
          // Capture the scenario as CONTENT context only — do NOT auto-assign a
          // visual template here. Leaving config.template unset is what lets the
          // post-outline style-selection (inspiration) step surface community
          // styles when the user hasn't already picked one at the launcher.
          prefs.push(`Deck scenario: ${asStr}`);
          break;
        }
        default: // free content preference
          prefs.push(`${label}: ${asStr}`);
      }
    }
    const suffix = prefs.length ? `\n\nAdditional preferences:\n- ${prefs.join("\n- ")}` : "";
    onComplete(patch, suffix, summaryParts.join("\n"));
  }

  function AttachControl({ q, inline }: { q: QuestionSpec; inline?: boolean }) {
    const imgs = images[q.id] ?? [];
    return (
      <>
        <label className={`onb-attach-btn${inline ? " inline" : ""}`} title="附参考图（作为生成参考）">
          <ImageIcon size={15} weight="regular" />
          {inline ? "" : <span>参考图</span>}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => {
              void addImages(q.id, e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </label>
        {uploadingQ === q.id && <span className="onb-attach-hint">上传中…</span>}
        {imgs.length > 0 && (
          <div className="onb-thumbs">
            {imgs.map((it) => (
              <span className="onb-thumb" key={it.id} title={it.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={it.name} />
                <button type="button" aria-label={`移除 ${it.name}`} onClick={() => removeImage(q.id, it.id)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="panel onb-panel">
      <h2>✦ A few quick questions</h2>
      {questions.map((q) => (
        <div className="field onb-field" key={q.id}>
          <span className="onb-q">{q.question}</span>
          {q.type === "number" && (
            <div className="onb-options">
              <input
                type="number"
                min={1}
                max={30}
                value={String(answers[q.id] ?? "")}
                onChange={(e) => setOne(q.id, e.target.value)}
              />
              <AttachControl q={q} inline />
            </div>
          )}
          {q.type === "text" && (
            <div className="onb-options">
              <input
                className="onb-custom"
                placeholder={q.placeholder ?? "随意输入…"}
                value={String(answers[q.id] ?? "")}
                onChange={(e) => setOne(q.id, e.target.value)}
              />
              <AttachControl q={q} inline />
            </div>
          )}
          {q.type === "single" && (
            <div className="onb-options">
              {(q.options ?? []).map((o) => {
                const active = !(custom[q.id] ?? "").trim() && answers[q.id] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`onb-opt ${active ? "primary" : "ghost"}`}
                    onClick={() => pickOption(q.id, o.value)}
                  >
                    {o.label}
                    {q.recommended === o.value ? " ★" : ""}
                  </button>
                );
              })}
              <input
                className="onb-custom"
                placeholder="随意输入…"
                value={custom[q.id] ?? ""}
                onChange={(e) => setCustomText(q.id, e.target.value, "single")}
              />
              <AttachControl q={q} inline />
            </div>
          )}
          {q.type === "multi" && (
            <div className="onb-options">
              {(q.options ?? []).map((o) => {
                const active = Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`onb-opt ${active ? "primary" : "ghost"}`}
                    onClick={() => toggleMulti(q.id, o.value)}
                  >
                    {o.label}
                  </button>
                );
              })}
              <input
                className="onb-custom"
                placeholder="随意输入…"
                value={custom[q.id] ?? ""}
                onChange={(e) => setCustomText(q.id, e.target.value, "multi")}
              />
              <AttachControl q={q} inline />
            </div>
          )}
        </div>
      ))}
      {attachError && <div className="onb-attach-error" role="alert">{attachError}</div>}
      <div className="onb-actions">
        <button className="ghost" onClick={onCancel} disabled={busy}>
          {skipLabel}
        </button>
        <button className="primary" style={{ width: "auto", flex: 1 }} onClick={submit} disabled={busy || !!uploadingQ}>
          {busy ? "…" : submitLabel ?? "Apply & generate deck"}
        </button>
      </div>
    </div>
  );
}
