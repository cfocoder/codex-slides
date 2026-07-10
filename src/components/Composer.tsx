"use client";

import { Paperclip, Plus } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import ContextItems from "@/components/ContextItems";
import {
  CONTEXT_ITEM_ACCEPT,
  mergeContextItems,
  uploadContextItems,
  type ContextItem,
} from "@/lib/contextItems";
import type { PptConfig } from "@/lib/types";

interface EngineInfo {
  engine: string;
  label: string;
  available: boolean;
}
export type Material = ContextItem;

const QUALITY: { label: string; res: PptConfig["resolution"] }[] = [
  { label: "Auto", res: "2K" },
  { label: "High", res: "4K" },
  { label: "Medium", res: "2K" },
  { label: "Low", res: "1K" },
];
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
  onSubmit: () => void;
}) {
  const [focus, setFocus] = useState(false);
  const [menu, setMenu] = useState<null | "add" | "model" | "settings">(null);
  const [quality, setQuality] = useState("Auto");
  const [aspectSel, setAspectSel] = useState<string>("Auto");
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

  return (
    <div className={`composer${focus ? " focus" : ""}`}>
      {materials.length > 0 && (
        <ContextItems items={materials} onRemove={onRemoveMaterial} scrollable />
      )}
      {uploadError && <div className="context-upload-error" role="alert">{uploadError}</div>}

      <textarea
        rows={1}
        placeholder="Describe a presentation"
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
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />

      <div className="composer-bar">
        {/* + add menu */}
        <div ref={addRef} style={{ position: "relative" }}>
          <button
            className="cbtn icononly"
            title="Add material / options"
            aria-label="Add images or files"
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
                <span className="ic"><Paperclip size={17} /></span> Add images or files
              </button>
              <div className="pop-sep" />
              <button className="pop-item" onClick={() => setResearchMode(!researchMode)}>
                <span className="ic">🔍</span>
                <span className="grow">Deep research</span>
                <span className={`toggle ${researchMode ? "on" : ""}`} />
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
        <button className="cbtn active" title="Output type">
          ▦ Slides
        </button>

        {/* model */}
        <div ref={modelRef} style={{ position: "relative" }}>
          <button className="cbtn" onClick={() => setMenu(menu === "model" ? null : "model")}>
            ◍ {modelLabel} <span className="caret">▾</span>
          </button>
          {menu === "model" && (
            <div className="pop up">
              <div className="pop-title">Orchestrating engine</div>
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
                  {!e.available && <span style={{ fontSize: 11, color: "var(--muted)" }}>n/a</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* settings: quality · aspect */}
        <div ref={setRef} style={{ position: "relative" }}>
          <button className="cbtn" onClick={() => setMenu(menu === "settings" ? null : "settings")}>
            {quality} · {aspectSel} <span className="caret">▾</span>
          </button>
          {menu === "settings" && (
            <div className="pop up" style={{ minWidth: 288, padding: 14 }}>
              <div className="pop-section" style={{ padding: "0 0 8px" }}>
                Quality
              </div>
              <div className="seg">
                {QUALITY.map((q) => (
                  <button
                    key={q.label}
                    className={quality === q.label ? "on" : ""}
                    onClick={() => {
                      setQuality(q.label);
                      setConfig({ resolution: q.res });
                    }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="pop-section" style={{ padding: "14px 0 0" }}>
                Aspect ratio
              </div>
              <div className="aspect-grid">
                <button
                  className={`aspect-cell ${aspectSel === "Auto" ? "on" : ""}`}
                  onClick={() => {
                    setAspectSel("Auto");
                    setConfig({ aspect: "16:9" });
                  }}
                >
                  <span className="aspect-icon" style={{ width: 20, height: 14 }} />
                  Auto
                </button>
                {ASPECTS.map((a) => (
                  <button
                    key={a.value}
                    className={`aspect-cell ${aspectSel === a.label ? "on" : ""}`}
                    onClick={() => {
                      setAspectSel(a.label);
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

        <button className="cbtn icononly" title="Voice input (coming soon)" disabled>
          🎙
        </button>
        <button
          className="send-btn"
          title="Generate (⌘↵)"
          disabled={running || uploading || (!config.requirement.trim() && !materials.length)}
          onClick={onSubmit}
        >
          {running || uploading ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}
