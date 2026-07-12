import { NextResponse } from "next/server";
import {
  ensureProjectRun,
  sanitizeProjectRunInput,
  startProjectRun,
  stopProjectRun,
} from "@/lib/projectRuns";
import { projectResponseEtag } from "@/lib/projectSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Read the canonical project and revive a persisted run after a local server reload. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const project = ensureProjectRun(params.id);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const etag = projectResponseEtag(project);
  const headers = { "Cache-Control": "no-store", ETag: etag };
  if (req.headers.get("if-none-match")?.split(",").map((value) => value.trim()).includes(etag)) {
    return new Response(null, { status: 304, headers });
  }
  return NextResponse.json({ project, activeRun: project.activeRun ?? null }, { headers });
}

/** Start a detached project job. The response returns immediately; progress is
 * persisted in project.json and can be polled after leaving the workspace. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const input = sanitizeProjectRunInput(body);
  if (!input) return NextResponse.json({ error: "invalid project run" }, { status: 400 });
  try {
    const result = startProjectRun(params.id, input);
    if (!result.accepted) {
      return NextResponse.json({
        error: "another project run is active",
        project: result.project,
        activeRun: result.project.activeRun ?? null,
      }, { status: 409 });
    }
    return NextResponse.json({
      project: result.project,
      activeRun: result.project.activeRun ?? null,
      queued: result.queued,
      queue: result.project.workflow?.queuedRequests ?? [],
    }, { status: 202 });
  } catch (error: any) {
    const message = String(error?.message ?? error);
    return NextResponse.json({ error: message }, { status: message === "project not found" ? 404 : 500 });
  }
}

/** Manual termination is the only navigation-independent way to cancel a run. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const project = stopProjectRun(params.id);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  return NextResponse.json({ project, activeRun: project.activeRun ?? null });
}
