import { NextResponse } from "next/server";
import { loadProject, removeProjectPage, replaceProjectPages, saveProject } from "@/lib/store";
import type { SlidePage, SlideTransition } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const project = loadProject(params.id);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "add");
  const index = Number(body?.index);

  if (action === "add") {
    const requestedAfter = Number(body?.afterIndex);
    const insertAt = Number.isInteger(requestedAfter)
      ? Math.max(0, Math.min(project.pages.length, requestedAfter))
      : project.pages.length;
    const page: SlidePage = {
      index: insertAt + 1,
      title: `Slide ${insertAt + 1}`,
      points: [],
      status: "pending",
    };
    const pages = [...project.pages];
    pages.splice(insertAt, 0, page);
    replaceProjectPages(project, pages);
    return NextResponse.json({ page: project.pages[insertAt], pages: project.pages });
  }

  if (action === "duplicate") {
    if (!Number.isInteger(index)) return NextResponse.json({ error: "index required" }, { status: 400 });
    const source = project.pages.find((page) => page.index === index);
    if (!source) return NextResponse.json({ error: "page not found" }, { status: 404 });
    const page: SlidePage = {
      ...source,
      index: index + 1,
      title: `${source.title} copy`,
      points: [...source.points],
    };
    const pages = [...project.pages];
    pages.splice(index, 0, page);
    replaceProjectPages(project, pages);
    return NextResponse.json({ page: project.pages[index], pages: project.pages });
  }

  if (action === "transition") {
    if (!Number.isInteger(index)) return NextResponse.json({ error: "index required" }, { status: 400 });
    const page = project.pages.find((item) => item.index === index);
    if (!page) return NextResponse.json({ error: "page not found" }, { status: 404 });
    const transition = String(body?.transition ?? "none") as SlideTransition;
    const allowed: SlideTransition[] = ["none", "fade", "push", "wipe", "zoom", "flip"];
    if (!allowed.includes(transition)) {
      return NextResponse.json({ error: "unsupported transition" }, { status: 400 });
    }
    page.transition = transition;
    saveProject(project);
    return NextResponse.json({ page, pages: project.pages });
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const project = loadProject(params.id);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const index = Number(body?.index);
  if (!Number.isInteger(index)) return NextResponse.json({ error: "index required" }, { status: 400 });
  try {
    removeProjectPage(project, index);
    return NextResponse.json({ pages: project.pages });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? error) }, { status: 404 });
  }
}
