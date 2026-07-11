import fs from "node:fs";
import path from "node:path";
import { projectDir } from "./store";
import type { ProjectFileRecord } from "./types";

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".csv", ".tsv", ".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".yaml", ".yml", ".xml"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export function filesDir(projectId: string) { return path.join(projectDir(projectId), "files"); }

export function safeProjectFile(projectId: string, relativePath: string): string | null {
  const root = path.resolve(filesDir(projectId));
  const resolved = path.resolve(root, relativePath.replace(/^[/\\]+/, ""));
  return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

function kindFor(name: string): ProjectFileRecord["kind"] {
  const ext = path.extname(name).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if ([".md", ".txt", ".pdf", ".doc", ".docx", ".ppt", ".pptx"].includes(ext)) return "document";
  if ([".json", ".csv", ".tsv", ".yaml", ".yml", ".xml"].includes(ext)) return "data";
  if ([".html", ".css", ".js", ".jsx", ".ts", ".tsx"].includes(ext)) return "code";
  return "other";
}

export function listProjectFiles(projectId: string): ProjectFileRecord[] {
  const root = filesDir(projectId);
  if (!fs.existsSync(root)) return [];
  const records: ProjectFileRecord[] = [];
  function visit(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        const stat = fs.statSync(absolute);
        const relative = path.relative(root, absolute).split(path.sep).join("/");
        records.push({
          path: relative,
          name: entry.name,
          kind: kindFor(entry.name),
          source: relative.startsWith("uploaded/") ? "uploaded" : "generated",
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
          editable: TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && stat.size <= 2 * 1024 * 1024,
        });
      }
    }
  }
  visit(root);
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function uniqueUploadPath(projectId: string, originalName: string) {
  const clean = path.basename(originalName).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180) || "upload";
  const dir = path.join(filesDir(projectId), "uploaded");
  fs.mkdirSync(dir, { recursive: true });
  let candidate = path.join(dir, clean);
  const ext = path.extname(clean); const stem = path.basename(clean, ext); let i = 2;
  while (fs.existsSync(candidate)) candidate = path.join(dir, `${stem}-${i++}${ext}`);
  return candidate;
}
