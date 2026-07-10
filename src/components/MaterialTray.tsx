"use client";

import { useRef, useState } from "react";
import { ImageSquare, UploadSimple, X } from "@phosphor-icons/react";

interface Item {
  id: string;
  name: string;
  url: string;
}

/** Upload brand references (logo / product shot / visual sample) to guide the restyle. */
export default function MaterialTray({ onChange }: { onChange: (ids: string[]) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const next = [...items];
    for (const file of Array.from(files)) {
      try {
        const body = new FormData();
        body.append("image", file);
        const response = await fetch("/api/materials", { method: "POST", body });
        const data = await response.json();
        if (response.ok) next.push({ id: data.id, name: data.name, url: data.url });
      } catch {
        /* Let the remaining files continue uploading. */
      }
    }
    setItems(next);
    onChange(next.map((item) => item.id));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(id: string) {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    onChange(next.map((item) => item.id));
  }

  return (
    <section className="material-field" aria-labelledby="brand-reference-label">
      <div className="restyle-field-head">
        <label id="brand-reference-label">Brand references</label>
        <span>Optional</span>
      </div>
      <p className="material-help">Add a logo, product image, or visual sample to guide every slide.</p>
      <div className="material-list">
        {items.map((item) => (
          <div className="material-item" key={item.id} title={item.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.name} />
            <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`}>
              <X size={12} weight="bold" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className={`material-add${items.length ? " compact" : ""}`}
          disabled={busy}
          aria-label={items.length ? "Add more brand images" : undefined}
          onClick={() => inputRef.current?.click()}
        >
          {items.length ? <UploadSimple size={20} /> : <ImageSquare size={22} />}
          <span>
            <strong>{busy ? "Uploading…" : items.length ? "Add more" : "Add brand images"}</strong>
            {!items.length && <small>Images are used as visual guidance</small>}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => upload(event.target.files)}
        />
      </div>
    </section>
  );
}
