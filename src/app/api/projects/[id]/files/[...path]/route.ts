import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { safeProjectFile } from "@/lib/projectFiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolve(id: string, parts: string[]) { return safeProjectFile(id, parts.join("/")); }

export async function GET(_req: Request, { params }: { params: { id: string; path: string[] } }) {
  const file = resolve(params.id, params.path);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ext = path.extname(file).toLowerCase();
  const mime: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".md": "text/markdown; charset=utf-8", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8" };
  return new NextResponse(fs.readFileSync(file), { headers: { "Content-Type": mime[ext] ?? "application/octet-stream", "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, { params }: { params: { id: string; path: string[] } }) {
  const file = resolve(params.id, params.path);
  if (!file || !fs.existsSync(file)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.content !== "string" || Buffer.byteLength(body.content) > 2 * 1024 * 1024) return NextResponse.json({ error: "invalid content" }, { status: 400 });
  fs.writeFileSync(file, body.content, "utf8");
  return NextResponse.json({ ok: true });
}
