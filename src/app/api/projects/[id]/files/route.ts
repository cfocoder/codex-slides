import fs from "node:fs";
import { NextResponse } from "next/server";
import { loadProject } from "@/lib/store";
import { listProjectFiles, uniqueUploadPath } from "@/lib/projectFiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!loadProject(params.id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ files: listProjectFiles(params.id) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!loadProject(params.id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const uploads = form?.getAll("files") ?? [];
  if (!uploads.length || uploads.some((file) => !(file instanceof File))) {
    return NextResponse.json({ error: "files required" }, { status: 400 });
  }
  for (const upload of uploads as File[]) {
    if (upload.size > 20 * 1024 * 1024) return NextResponse.json({ error: `${upload.name} exceeds 20 MB` }, { status: 413 });
    fs.writeFileSync(uniqueUploadPath(params.id, upload.name), Buffer.from(await upload.arrayBuffer()));
  }
  return NextResponse.json({ files: listProjectFiles(params.id) });
}
