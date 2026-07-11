"use client";

import { useEffect, useRef, useState } from "react";
import { PencilSimple, Sparkle } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import type { UiSlide } from "@/lib/deckEdit";

export default function SpeakerNotesPanel({
  slide,
  disabled,
  onSave,
  onGenerate,
}: {
  slide?: UiSlide;
  disabled: boolean;
  onSave: (index: number, note: string) => Promise<string>;
  onGenerate: (index: number, overwrite: boolean) => Promise<string>;
}) {
  const { t } = useI18n();
  const note = slide?.speakerNotes ?? "";
  const [draft, setDraft] = useState(note);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<"saved" | "generated" | "error" | null>(null);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(note);
  }, [note]);

  useEffect(() => {
    setEditing(false);
    setStatus(null);
    setError("");
  }, [slide?.index]);

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const end = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(end, end);
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  useEffect(() => {
    if (status !== "saved" && status !== "generated") return;
    const timer = window.setTimeout(() => setStatus(null), 2600);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function save(close = true) {
    if (!slide || saving || generating) return;
    if (draft === note) {
      if (close) setEditing(false);
      return;
    }
    setSaving(true);
    setStatus(null);
    setError("");
    try {
      const saved = await onSave(slide.index, draft);
      setDraft(saved);
      setStatus("saved");
      if (close) setEditing(false);
    } catch (reason: any) {
      setStatus("error");
      setError(String(reason?.message ?? reason));
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    if (!slide || disabled || saving || generating) return;
    setGenerating(true);
    setStatus(null);
    setError("");
    try {
      const generated = await onGenerate(slide.index, Boolean(note.trim()));
      setDraft(generated);
      setEditing(false);
      setStatus("generated");
    } catch (reason: any) {
      setStatus("error");
      setError(String(reason?.message ?? reason));
    } finally {
      setGenerating(false);
    }
  }

  if (!slide) return null;

  return (
    <section className="speaker-notes-panel" aria-label={t("speakerNotes.title")}>
      <header className="speaker-notes-head">
        <div>
          <strong>{t("speakerNotes.title")}</strong>
          <span>{t("speakerNotes.slide", { current: slide.index })}</span>
        </div>
        <div className="speaker-notes-actions">
          {status && (
            <span className={`speaker-notes-status ${status}`} role="status">
              {status === "saved"
                ? t("speakerNotes.saved")
                : status === "generated"
                  ? t("speakerNotes.generated")
                  : t("speakerNotes.failed")}
            </span>
          )}
          {!editing && note.trim() && (
            <button type="button" onClick={() => setEditing(true)} disabled={disabled || generating}>
              <PencilSimple size={14} /> {t("speakerNotes.edit")}
            </button>
          )}
          {!editing && note.trim() && (
            <button type="button" onClick={generate} disabled={disabled || generating}>
              {generating ? <span className="spinner sm" /> : <Sparkle size={14} />}
              {t("speakerNotes.regenerate")}
            </button>
          )}
        </div>
      </header>

      {editing ? (
        <div className="speaker-notes-editor">
          <textarea
            ref={textareaRef}
            value={draft}
            rows={4}
            maxLength={20_000}
            placeholder={t("speakerNotes.placeholder")}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={() => void save(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setDraft(note);
                setEditing(false);
              } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void save(true);
              }
            }}
          />
          {saving && <span className="speaker-notes-saving"><span className="spinner sm" />{t("speakerNotes.saving")}</span>}
        </div>
      ) : note.trim() ? (
        <button
          type="button"
          className="speaker-notes-preview"
          onClick={() => !disabled && setEditing(true)}
          disabled={disabled}
        >
          {note}
        </button>
      ) : (
        <div className="speaker-notes-empty">
          <span>{t("speakerNotes.empty")}</span>
          <button type="button" className="primary" onClick={generate} disabled={disabled || generating}>
            {generating ? <span className="spinner sm" /> : <Sparkle size={15} />}
            {generating ? t("speakerNotes.generating") : t("speakerNotes.generate")}
          </button>
        </div>
      )}
      {error && <div className="speaker-notes-error" role="alert">{error}</div>}
    </section>
  );
}
