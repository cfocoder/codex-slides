import { NextResponse } from "next/server";
import { coerceConfig } from "@/lib/config";
import { attachMaterialsToProject } from "@/lib/materials";
import { listProjects, newProjectId, saveProject } from "@/lib/store";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List projects (slim summaries for the home "recent projects" strip). */
export async function GET() {
  const projects = listProjects().map((p) => {
    const rendered = p.pages.filter((s) => s.status === "rendered");
    return {
      id: p.id,
      title: p.title,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      aspect: p.config.aspect,
      total: p.pages.length,
      rendered: rendered.length,
      cover: rendered[0]?.image ?? null,
      workflowStage: p.workflow?.stage,
    };
  });
  return NextResponse.json({ projects });
}

/** Create the durable project shell before clarification begins. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const config = coerceConfig(body.config ?? body);
  if (!config.requirement.trim()) {
    return NextResponse.json({ error: "requirement is required" }, { status: 400 });
  }

  const title = String(body.title ?? config.requirement.split("\n")[0])
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Untitled deck";
  const id = newProjectId(title);
  const now = new Date().toISOString();
  const project: Project = {
    id,
    createdAt: now,
    updatedAt: now,
    config,
    agent: config.engine,
    title,
    outline: [],
    pages: [],
    status: "draft",
    workflow: {
      stage: "clarify",
      workspaceMode: "canvas",
      selectedDesignFileId: "questions",
    },
  };

  if (config.materialIds?.length) {
    project.materials = attachMaterialsToProject(id, config.materialIds);
    const attachedIds = new Set(project.materials.map((material) => material.id));
    project.config.materialIds = config.materialIds.filter((materialId) => attachedIds.has(materialId));
  }
  saveProject(project);
  return NextResponse.json(project, { status: 201 });
}
