"use client";

import { Paperclip, Plus } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import ContextItems from "@/components/ContextItems";
import ContextOptionItems from "@/components/ContextOptionItems";
import {
  CONTEXT_ITEM_ACCEPT,
  mergeContextItems,
  uploadContextItems,
  type ContextItem,
} from "@/lib/contextItems";
import { shouldSubmitTextarea } from "@/lib/keyboard";
import type { ContextOptionItem, PptConfig } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

interface EngineInfo {
  engine: string;
  label: string;
  available: boolean;
}
export type Material = ContextItem;

const QUALITY = [
  { id: "auto", res: "2K" },
  { id: "high", res: "4K" },
  { id: "medium", res: "2K" },
  { id: "low", res: "1K" },
] as const satisfies readonly { id: string; res: PptConfig["resolution"] }[];
type QualityId = (typeof QUALITY)[number]["id"];
const QUALITY_KEYS = {
  auto: "composer.auto",
  high: "composer.high",
  medium: "composer.medium",
  low: "composer.low",
} as const;
const ASPECTS: { label: string; value: PptConfig["aspect"]; w: number; h: number }[] = [
  { label: "16:9", value: "16:9", w: 22, h: 13 },
  { label: "9:16", value: "9:16", w: 12, h: 20 },
  { label: "4:3", value: "4:3", w: 20, h: 15 },
  { label: "3:4", value: "3:4", w: 15, h: 20 },
  { label: "1:1", value: "1:1", w: 17, h: 17 },
];

function useOutside(ref: React.RefObject<HTMLElement>, close: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [ref, close, active]);
}

/** Agent-native launcher input: textarea + toolbar (add / model / settings / send). */
export default function Composer({
  config,
  setConfig,
  engines,
  running,
  researchMode,
  setResearchMode,
  materials,
  onAddItems,
  onRemoveMaterial,
  styleTemplate,
  onClearStyle,
  onSubmit,
}: {
  config: PptConfig;
  setConfig: (patch: Partial<PptConfig>) => void;
  engines: EngineInfo[];
  running: boolean;
  researchMode: boolean;
  setResearchMode: (v: boolean) => void;
  materials: ContextItem[];
  onAddItems: (items: ContextItem[]) => void;
  onRemoveMaterial: (id: string) => void;
  /** Currently chosen deck style (from Community / For you), shown as a chip. */
  styleTemplate?: { id: string; name: string; cover?: string; palette?: string[]; sub?: string } | null;
  onClearStyle?: () => void;
  onSubmit: (contextOptions: ContextOptionItem[]) => void;
}) {
  const { t } = useI18n();
  const [focus, setFocus] = useState(false);
  const [menu, setMenu] = useState<null | "add" | "model" | "settings">(null);
  const [quality, setQuality] = useState<QualityId>("auto");
  const [aspectSel, setAspectSel] = useState<PptConfig["aspect"] | "auto">("auto");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);

  useOutside(addRef, () => setMenu((m) => (m === "add" ? null : m)), menu === "add");
  useOutside(modelRef, () => setMenu((m) => (m === "model" ? null : m)), menu === "model");
  useOutside(setRef, () => setMenu((m) => (m === "settings" ? null : m)), menu === "settings");

  const engine = engines.find((e) => e.engine === config.engine);
  const modelLabel = engine ? engine.label.replace(/\s*\(.*\)$/, "") : "Codex";
  const qualityLabel = t(QUALITY_KEYS[quality]);
  const aspectLabel = aspectSel === "auto" ? t("composer.auto") : aspectSel;

  async function addFiles(files: Iterable<File>) {
    const selected = Array.from(files);
    if (!selected.length) return;
    setUploading(true);
    setUploadError("");
    const result = await uploadContextItems(selected);
    if (result.items.length) onAddItems(mergeContextItems(materials, result.items));
    if (result.errors.length) setUploadError(result.errors.join(" · "));
    setUploading(false);
  }

  const contextOptions: ContextOptionItem[] = [
    ...(researchMode
      ? [{ id: "research", kind: "research" as const, label: t("composer.research") }]
      : []),
    ...(config.fast
      ? [{ id: "fast", kind: "speed" as const, label: t("composer.fast"), value: t("composer.fastValue") }]
      : []),
    ...(styleTemplate
      ? [{ id: "style", kind: "style" as const, label: t("composer.design"), value: styleTemplate.name }]
      : []),
    ...(quality !== "auto"
      ? [{ id: "quality", kind: "setting" as const, label: t("composer.quality"), value: qualityLabel }]
      : []),
    ...(aspectSel !== "auto"
      ? [{ id: "aspect", kind: "setting" as const, label: t("composer.aspect"), value: aspectSel }]
      : []),
  ];

  function removeContextOption(id: string) {
    if (id === "research") setResearchMode(false);
    else if (id === "fast") setConfig({ fast: false });
    else if (id === "style") onClearStyle?.();
    else if (id === "quality") {
      setQuality("auto");
      setConfig({ resolution: "2K" });
    } else if (id === "aspect") {
      setAspectSel("auto");
      setConfig({ aspect: "16:9" });
    }
  }

  return (
    <div className={`composer${focus ? " focus" : ""}`}>
      <ContextOptionItems items={contextOptions} onRemove={removeContextOption} />
      {materials.length > 0 && (
        <ContextItems items={materials} onRemove={onRemoveMaterial} scrollable />
      )}
      {uploadError && <div className="context-upload-error" role="alert">{uploadError}</div>}

      <textarea
        rows={1}
        placeholder={t("composer.placeholder")}
        value={config.requirement}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => {
          setConfig({ requirement: e.target.value });
          const el = e.target;
          el.style.height = "auto";
          el.style.height = Math.min(el.scrollHeight, 260) + "px";
        }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files);
          if (!files.length) return;
          event.preventDefault();
          void addFiles(files);
        }}
        onKeyDown={(e) => {
          if (shouldSubmitTextarea({
            key: e.key,
            shiftKey: e.shiftKey,
            isComposing: e.nativeEvent.isComposing,
            keyCode: e.nativeEvent.keyCode,
          })) {
            e.preventDefault();
            onSubmit(contextOptions);
          }
        }}
      />

      <div className="composer-bar">
        {/* + add menu */}
        <div ref={addRef} style={{ position: "relative" }}>
          <button
            className="cbtn icononly"
            title={t("composer.addOptions")}
            aria-label={t("composer.addFiles")}
            onClick={() => setMenu(menu === "add" ? null : "add")}
          >
            <Plus size={18} />
          </button>
          {menu === "add" && (
            <div className="pop up">
              <button
                className="pop-item"
                onClick={() => {
                  fileRef.current?.click();
                  setMenu(null);
                }}
              >
                <span className="ic"><Paperclip size={17} /></span> {t("composer.addFiles")}
              </button>
              <div className="pop-sep" />
              <button className="pop-item" onClick={() => setResearchMode(!researchMode)}>
                <span className="ic">🔍</span>
                <span className="grow">{t("composer.research")}</span>
                <span className={`toggle ${researchMode ? "on" : ""}`} />
              </button>
              <button
                className="pop-item"
                onClick={() => setConfig({ fast: !config.fast })}
                title={t("composer.fastHelp")}
              >
                <span className="ic">⚡</span>
                <span className="grow">
                  {t("composer.fast")}
                  <span className="pop-sub">
                    {config.fast
                      ? t("composer.fastOn")
                      : t("composer.fastOff")}
                  </span>
                </span>
                <span className={`toggle ${config.fast ? "on" : ""}`} />
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={CONTEXT_ITEM_ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
        </div>

        {/* mode (Slides) */}
        <button className="cbtn active" title={t("composer.outputType")}>
          ▦ {t("composer.slides")}
        </button>

        {/* model */}
        <div ref={modelRef} style={{ position: "relative" }}>
          <button className="cbtn" onClick={() => setMenu(menu === "model" ? null : "model")}>
            ◍ {modelLabel} <span className="caret">▾</span>
          </button>
          {menu === "model" && (
            <div className="pop up">
              <div className="pop-title">{t("composer.engine")}</div>
              {engines.map((e) => (
                <button
                  key={e.engine}
                  className="pop-item"
                  disabled={!e.available}
                  onClick={() => {
                    if (!e.available) return;
                    setConfig({ engine: e.engine as PptConfig["engine"] });
                    setMenu(null);
                  }}
                >
                  <span className="ic">{config.engine === e.engine ? "●" : "○"}</span>
                  <span className="grow">{e.label.replace(/\s*\(.*\)$/, "")}</span>
                  {!e.available && <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("composer.unavailable")}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* settings: quality · aspect */}
        <div ref={setRef} style={{ position: "relative" }}>
          <button className="cbtn" onClick={() => setMenu(menu === "settings" ? null : "settings")}>
            {qualityLabel} · {aspectLabel} <span className="caret">▾</span>
          </button>
          {menu === "settings" && (
            <div className="pop up" style={{ minWidth: 288, padding: 14 }}>
              <div className="pop-section" style={{ padding: "0 0 8px" }}>
                {t("composer.quality")}
              </div>
              <div className="seg">
                {QUALITY.map((q) => (
                  <button
                    key={q.id}
                    className={quality === q.id ? "on" : ""}
                    onClick={() => {
                      setQuality(q.id);
                      setConfig({ resolution: q.res });
                    }}
                  >
                    {t(QUALITY_KEYS[q.id])}
                  </button>
                ))}
              </div>
              <div className="pop-section" style={{ padding: "14px 0 0" }}>
                {t("composer.aspect")}
              </div>
              <div className="aspect-grid">
                <button
                  className={`aspect-cell ${aspectSel === "auto" ? "on" : ""}`}
                  onClick={() => {
                    setAspectSel("auto");
                    setConfig({ aspect: "16:9" });
                  }}
                >
                  <span className="aspect-icon" style={{ width: 20, height: 14 }} />
                  {t("composer.auto")}
                </button>
                {ASPECTS.map((a) => (
                  <button
                    key={a.value}
                    className={`aspect-cell ${aspectSel === a.value ? "on" : ""}`}
                    onClick={() => {
                      setAspectSel(a.value);
                      setConfig({ aspect: a.value });
                    }}
                  >
                    <span className="aspect-icon" style={{ width: a.w, height: a.h }} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <span className="spacer" />

        <button className="cbtn icononly" title={t("composer.voiceSoon")} disabled>
          🎙
        </button>
        <button
          className="send-btn"
          title={t("composer.generateHint")}
          disabled={running || uploading || (!config.requirement.trim() && !materials.length)}
          onClick={() => onSubmit(contextOptions)}
        >
          {running || uploading ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}
