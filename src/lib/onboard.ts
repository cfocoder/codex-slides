// Gen-UI onboarding (M2, open-design style): after the user types a topic, Codex
// generates a small set of tailored clarifying questions. The home page renders
// them as a dynamic form; answers seed the PptConfig and augment the requirement.

import { codexJson } from "./codex-text";
import { CATEGORIES } from "./templates";

export type QuestionType = "single" | "multi" | "text" | "number";
export type ConfigField = "pages" | "aspect" | "language" | "style" | "category" | null;

export interface QuestionOption {
  value: string;
  label: string;
}
export interface QuestionSpec {
  id: string;
  question: string;
  type: QuestionType;
  options?: QuestionOption[];
  placeholder?: string;
  recommended?: string; // recommended option value / default
  field?: ConfigField; // maps to a config field, or null = content preference
}

export function buildOnboardPrompt(requirement: string): string {
  const cats = CATEGORIES.map((c) => `${c.id} (${c.labelEn})`).join(", ");
  return [
    "You are an onboarding assistant for an AI slide-deck generator.",
    "Given the user's topic, produce 4-6 SHORT clarifying questions that will make the deck much better.",
    "",
    "Return ONLY a JSON array of question objects with this shape:",
    `{"id": "kebab-id", "question": "...", "type": "single|multi|text|number", "options": [{"value":"...","label":"..."}], "recommended": "optionValue", "field": "pages|aspect|language|style|category|null"}`,
    "",
    "Rules:",
    "- ALWAYS include: a page-count question (field:\"pages\", type:\"number\", recommended a sensible number);",
    "  an aspect question (field:\"aspect\", type:\"single\", options 16:9,4:3,1:1,9:16, recommended \"16:9\");",
    "  a language question (field:\"language\", type:\"single\", options auto,zh,en,ja, recommended \"auto\");",
    "  a visual-style question (field:\"style\", type:\"single\", 3-4 style options TAILORED to the topic, each label a vivid short phrase, value = a concise style descriptor).",
    `- Include ONE category question (field:\"category\", type:\"single\") choosing among: ${cats}. Pick the 3-4 most relevant as options, recommended the best fit.`,
    "- Add 1-2 topic-specific CONTENT questions (field:null) that clarify audience, goal, or emphasis; type single or text.",
    "- Keep questions crisp. Options must be mutually exclusive. Every single-type question needs a recommended value.",
    "",
    "User topic:",
    requirement,
    "",
    "Output ONLY the JSON array.",
  ].join("\n");
}

function coerceType(t: any): QuestionType {
  return t === "multi" || t === "text" || t === "number" ? t : "single";
}

export function normalizeQuestions(raw: any): QuestionSpec[] {
  const arr = Array.isArray(raw) ? raw : raw?.questions ?? [];
  const out: QuestionSpec[] = [];
  for (const q of arr as any[]) {
    if (!q?.question) continue;
    const type = coerceType(q.type);
    const options: QuestionOption[] | undefined = Array.isArray(q.options)
      ? q.options
          .map((o: any) =>
            typeof o === "string"
              ? { value: o, label: o }
              : { value: String(o?.value ?? o?.label ?? ""), label: String(o?.label ?? o?.value ?? "") },
          )
          .filter((o: QuestionOption) => o.value)
      : undefined;
    const fieldRaw = q.field;
    const field: ConfigField =
      fieldRaw === "pages" || fieldRaw === "aspect" || fieldRaw === "language" ||
      fieldRaw === "style" || fieldRaw === "category"
        ? fieldRaw
        : null;
    out.push({
      id: String(q.id ?? `q${out.length + 1}`),
      question: String(q.question),
      type,
      options: type === "single" || type === "multi" ? options : undefined,
      placeholder: q.placeholder ? String(q.placeholder) : undefined,
      recommended: q.recommended != null ? String(q.recommended) : undefined,
      field,
    });
  }
  return out.slice(0, 6);
}

export async function generateOnboardQuestions(
  requirement: string,
  signal?: AbortSignal,
): Promise<QuestionSpec[]> {
  const raw = await codexJson<any>(buildOnboardPrompt(requirement), { signal });
  return normalizeQuestions(raw);
}
