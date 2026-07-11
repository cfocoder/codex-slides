// Shared request → PptConfig coercion, used by /api/generate and /api/outline so
// the one-shot and staged flows validate the incoming config identically.

import { DEFAULT_CONFIG, type PptConfig } from "./types";
import { normalizeDeckDesignSystem } from "./designSystem";
import { getScenario } from "./scenarios";

export function coerceConfig(body: any): PptConfig {
  const scenario = getScenario(String(body?.scenarioId ?? ""));
  const effectiveStyle = typeof body?.style === "string"
    ? body.style
    : scenario?.defaults.style ?? DEFAULT_CONFIG.style;
  const designSystem = body?.designSystem && typeof body.designSystem === "object"
    ? normalizeDeckDesignSystem(body.designSystem, {
        template: body?.template,
        style: effectiveStyle,
      })
    : undefined;
  const materialContexts = Array.isArray(body?.materialContexts)
    ? body.materialContexts.slice(0, 24).flatMap((item: any) => {
        const id = String(item?.id ?? "").slice(0, 220);
        const name = String(item?.name ?? "").slice(0, 180);
        const role = String(item?.role ?? "").slice(0, 120);
        return id && name && role ? [{ id, name, role }] : [];
      })
    : undefined;
  return {
    ...DEFAULT_CONFIG,
    ...body,
    requirement: String(body?.requirement ?? "").trim(),
    pages: Math.max(1, Math.min(30, Number(body?.pages ?? scenario?.defaults.pages) || DEFAULT_CONFIG.pages)),
    aspect: body?.aspect ?? scenario?.defaults.aspect ?? DEFAULT_CONFIG.aspect,
    style: effectiveStyle,
    mode: body?.mode ?? (scenario?.defaults.research ? "research" : undefined),
    designSystem,
    scenarioId: scenario?.id,
    materialContexts,
  };
}
