import { NextResponse } from "next/server";
import { listProjects } from "@/lib/store";

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
    };
  });
  return NextResponse.json({ projects });
}
