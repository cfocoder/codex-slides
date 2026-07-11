import { NextResponse } from "next/server";
import { normalizeDeckDesignSystem } from "@/lib/designSystem";
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
  const body = await req.json().catch(() => ({}));
  const project = loadProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (typeof body.template !== "undefined") project.config.template = body.template || undefined;
  if (typeof body.style === "string") project.config.style = body.style;

  const requestedMaterialIds = Array.isArray(body.materialIds)
    ? Array.from(new Set(body.materialIds.map((id: unknown) => String(id)))).slice(0, 16)
    : [];
  if (requestedMaterialIds.length) {
    const existingIds = new Set((project.materials ?? []).map((item) => item.id));
    const records = attachMaterialsToProject(
      project.id,
      requestedMaterialIds.filter((id) => !existingIds.has(id)),
    );
    if (records.length) project.materials = [...(project.materials ?? []), ...records];
    const availableIds = new Set((project.materials ?? []).map((item) => item.id));
    project.config.materialIds = Array.from(new Set([
      ...(project.config.materialIds ?? []),
      ...requestedMaterialIds.filter((id) => availableIds.has(id)),
    ]));
  }

  if (body.designSystem === null) {
    project.config.designSystem = undefined;
  } else if (body.designSystem && typeof body.designSystem === "object") {
    const designSystem = normalizeDeckDesignSystem(body.designSystem, {
      template: project.config.template,
      style: project.config.style,
    });
    const availableIds = new Set((project.materials ?? []).map((item) => item.id));
    designSystem.brand.assetMaterialIds = designSystem.brand.assetMaterialIds.filter((id) => availableIds.has(id));
    project.config.designSystem = designSystem;
  }
  saveProject(project);
  return NextResponse.json(project);
}
