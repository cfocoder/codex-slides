import { NextResponse } from "next/server";
import { attachMaterialsToProject } from "@/lib/materials";
import { loadProject, saveProject } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const project = loadProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(project);
}

/** Re-tune an existing deck: change template / style, add materials. Then the
 *  caller regenerates slides (which read the updated project.config). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const project = loadProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  if (typeof body.template !== "undefined") project.config.template = body.template || undefined;
  if (typeof body.style === "string") project.config.style = body.style;
  if (Array.isArray(body.materialIds) && body.materialIds.length) {
    const recs = attachMaterialsToProject(project.id, body.materialIds);
    project.materials = [...(project.materials ?? []), ...recs];
    project.config.materialIds = [...(project.config.materialIds ?? []), ...body.materialIds];
  }
  saveProject(project);
  return NextResponse.json(project);
}
