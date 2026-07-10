// Shared request → PptConfig coercion, used by /api/generate and /api/outline so
// the one-shot and staged flows validate the incoming config identically.

import { DEFAULT_CONFIG, type PptConfig } from "./types";

export function coerceConfig(body: any): PptConfig {
  return {
    ...DEFAULT_CONFIG,
    ...body,
    requirement: String(body?.requirement ?? "").trim(),
    pages: Math.max(1, Math.min(30, Number(body?.pages) || DEFAULT_CONFIG.pages)),
  };
}
