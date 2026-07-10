// On-disk project store: web/data/projects/<id>/{project.json, NN.png}
import fs from "node:fs";
import path from "node:path";
import type { Project, SlidePage } from "./types";

export const DATA_DIR = path.join(process.cwd(), "data", "projects");

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function projectDir(id: string): string {
  return path.join(DATA_DIR, id);
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9一-龥]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "deck"
  );
}

export function newProjectId(title: string): string {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${slugify(title)}-${rand}`;
}

export function saveProject(project: Project): void {
  const dir = projectDir(project.id);
  ensureDir(dir);
  project.updatedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(dir, "project.json"),
    JSON.stringify(project, null, 2),
    "utf8",
  );
}

export function loadProject(id: string): Project | null {
  const f = path.join(projectDir(id), "project.json");
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as Project;
  } catch {
    return null;
  }
}

export function listProjects(): Project[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .map((id) => loadProject(id))
    .filter((p): p is Project => Boolean(p))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function imageFileName(index: number): string {
  return `${String(index).padStart(2, "0")}.png`;
}

/** Persist a slide image; returns the file name stored on the page. */
export function saveSlideImage(id: string, index: number, bytes: Buffer): string {
  const dir = projectDir(id);
  ensureDir(dir);
  const name = imageFileName(index);
  fs.writeFileSync(path.join(dir, name), bytes);
  return name;
}

/**
 * Persist the exact annotated image that was sent to the mark editor.
 *
 * Unlike a rendered slide (`04.png`), mark snapshots deliberately use unique
 * filenames. Chat history can therefore keep showing the user's red marks even
 * after the canonical slide image is replaced by the generated result.
 */
export function saveMarkSnapshot(id: string, index: number, bytes: Buffer): string {
  const dir = projectDir(id);
  ensureDir(dir);
  const page = String(index).padStart(2, "0");
  const token = Math.random().toString(36).slice(2, 8);
  const name = `mark-${page}-${Date.now()}-${token}.png`;
  fs.writeFileSync(path.join(dir, name), bytes);
  return name;
}

export function readSlideImage(id: string, name: string): Buffer | null {
  // guard against path traversal
  if (!/^[\w.-]+$/.test(name)) return null;
  const f = path.join(projectDir(id), name);
  if (!fs.existsSync(f)) return null;
  return fs.readFileSync(f);
}

/** Persist an ordered page array and compact both indexes and on-disk PNG names. */
export function replaceProjectPages(project: Project, pages: SlidePage[]): void {
  const dir = projectDir(project.id);
  ensureDir(dir);
  const snapshots = pages.map((page, position) => {
    const source = page.image && /^[\w.-]+$/.test(page.image) && fs.existsSync(path.join(dir, page.image))
      ? page.image
      : undefined;
    return {
      page: { ...page, points: [...page.points] } as SlidePage,
      source,
      target: imageFileName(position + 1),
      staged: undefined as string | undefined,
    };
  });

  // Structural edits used to read every 2K/4K PNG into memory, delete it, then
  // write it back synchronously. Adding one blank page could therefore stall
  // behind hundreds of MB of avoidable I/O. Stage only filenames that actually
  // move; unchanged pages stay in place, and duplication copies just its source.
  const bySource = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    if (!snapshot.source) continue;
    const group = bySource.get(snapshot.source) ?? [];
    group.push(snapshot);
    bySource.set(snapshot.source, group);
  }

  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let stagedIndex = 0;
  for (const [source, group] of bySource) {
    if (group.length === 1 && group[0].target === source) continue;
    const staged = `.slide-reindex-${token}-${stagedIndex++}.png`;
    fs.renameSync(path.join(dir, source), path.join(dir, staged));
    group[0].staged = staged;
    for (const snapshot of group.slice(1)) {
      const duplicate = `.slide-reindex-${token}-${stagedIndex++}.png`;
      fs.copyFileSync(path.join(dir, staged), path.join(dir, duplicate));
      snapshot.staged = duplicate;
    }
  }

  const unchanged = new Set(
    snapshots
      .filter((snapshot) => snapshot.source && !snapshot.staged && snapshot.source === snapshot.target)
      .map((snapshot) => snapshot.target),
  );
  for (const name of fs.readdirSync(dir)) {
    if (/^\d+\.png$/i.test(name) && !unchanged.has(name)) fs.unlinkSync(path.join(dir, name));
  }

  project.pages = snapshots.map(({ page, source, target, staged }, position) => {
    const next = { ...page, index: position + 1 };
    if (staged) {
      fs.renameSync(path.join(dir, staged), path.join(dir, target));
      next.image = target;
    } else if (source === target) {
      next.image = target;
    } else {
      next.image = undefined;
    }
    return next;
  });
  project.outline = project.pages.map((page) => ({ title: page.title, points: [...page.points] }));
  project.config.pages = project.pages.length;
  saveProject(project);
}

/** Delete a page and compact both page indexes and their on-disk PNG names. */
export function removeProjectPage(project: Project, index: number): void {
  const remaining = project.pages.filter((page) => page.index !== index);
  if (remaining.length === project.pages.length) throw new Error("page not found");
  replaceProjectPages(project, remaining);
}
