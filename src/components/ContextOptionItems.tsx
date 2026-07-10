"use client";

import { MagnifyingGlass, Palette, SlidersHorizontal, X } from "@phosphor-icons/react";
import type { ContextOptionItem } from "@/lib/types";

function OptionIcon({ kind }: { kind: ContextOptionItem["kind"] }) {
  if (kind === "research") return <MagnifyingGlass size={13} />;
  if (kind === "style") return <Palette size={13} />;
  return <SlidersHorizontal size={13} />;
}

/** Non-file inputs (research, design, and generation settings) shown as context chips. */
export default function ContextOptionItems({
  items,
  onRemove,
  compact = false,
}: {
  items: ContextOptionItem[];
  onRemove?: (id: string) => void;
  compact?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className={`context-option-items${compact ? " compact" : ""}`}>
      {items.map((item) => (
        <div
          className="context-option-item"
          key={item.id}
          title={item.value ? `${item.label}: ${item.value}` : item.label}
        >
          <span className="context-option-icon" aria-hidden="true">
            <OptionIcon kind={item.kind} />
          </span>
          <span className="context-option-label">{item.label}</span>
          {item.value && <span className="context-option-value">{item.value}</span>}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.label}${item.value ? ` ${item.value}` : ""}`}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
