export type ContextItemKind = "image" | "file";

/** A staged user attachment shown in a composer and consumed by the model. */
export interface ContextItem {
  id: string;
  name: string;
  url: string;
  kind: ContextItemKind;
  mimeType: string;
  size: number;
}

export const CONTEXT_ITEM_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  ".pdf",
  ".txt",
  ".md",
  ".json",
  ".html",
  ".xml",
  ".doc",
  ".docx",
  ".rtf",
  ".odt",
  ".ppt",
  ".pptx",
  ".csv",
  ".tsv",
  ".xls",
  ".xlsx",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".css",
  ".yaml",
  ".yml",
  ".toml",
  ".sql",
  ".sh",
].join(",");

export interface ContextUploadResult {
  items: ContextItem[];
  errors: string[];
}

/** Upload files one at a time so one rejected item does not discard the rest. */
export async function uploadContextItems(files: Iterable<File>): Promise<ContextUploadResult> {
  const items: ContextItem[] = [];
  const errors: string[] = [];
  for (const file of Array.from(files)) {
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/materials", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      items.push(data as ContextItem);
    } catch (error: any) {
      errors.push(`${file.name}: ${String(error?.message ?? error)}`);
    }
  }
  return { items, errors };
}

export function mergeContextItems(current: ContextItem[], incoming: ContextItem[]): ContextItem[] {
  const next = [...current];
  for (const item of incoming) {
    if (!next.some((existing) => existing.id === item.id)) next.push(item);
  }
  return next;
}
