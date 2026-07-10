"use client";

import { useState } from "react";
import { File, ImageSquare, X } from "@phosphor-icons/react";
import ImagePreviewDialog from "@/components/ImagePreviewDialog";
import type { ContextItem } from "@/lib/contextItems";

export default function ContextItems({
  items,
  onRemove,
  compact = false,
  scrollable = false,
}: {
  items: ContextItem[];
  onRemove?: (id: string) => void;
  compact?: boolean;
  scrollable?: boolean;
}) {
  const [preview, setPreview] = useState<ContextItem | null>(null);
  if (!items.length) return null;
  return (
    <>
      <div className={`context-items${compact ? " compact" : ""}${scrollable ? " scrollable" : ""}`}>
        {items.map((item) => (
          <div className="context-item" key={item.id} title={item.name}>
            {item.kind === "image" ? (
              <button
                type="button"
                className="context-item-open"
                onClick={() => setPreview(item)}
                aria-label={`Preview ${item.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" />
                <span className="context-item-name">{item.name}</span>
                <span className="context-item-kind" aria-hidden="true"><ImageSquare size={13} /></span>
              </button>
            ) : (
              <a href={item.url} target="_blank" rel="noreferrer" tabIndex={onRemove ? -1 : 0}>
                <span className="context-item-file" aria-hidden="true"><File size={16} /></span>
                <span className="context-item-name">{item.name}</span>
              </a>
            )}
            {onRemove && (
              <button className="context-item-remove" type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
      {preview && (
        <ImagePreviewDialog
          src={preview.url}
          title={preview.name}
          subtitle="Attached image"
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
