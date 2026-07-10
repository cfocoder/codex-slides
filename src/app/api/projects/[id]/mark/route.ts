import { NextResponse } from "next/server";
import { markEditPage } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Mark-driven edit. Accepts multipart/form-data:
 *   index: number
 *   note:  string (optional)
 *   image: the annotated slide screenshot (PNG) — marks drawn on top.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const startedAt = Date.now();
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "expected multipart form" }, { status: 400 });

  const index = Number(form.get("index"));
  const note = String(form.get("note") ?? "");
  const file = form.get("image");
  if (!Number.isInteger(index) || !(file instanceof Blob)) {
    return NextResponse.json({ error: "index and image are required" }, { status: 400 });
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    console.info("[mark] edit started", { projectId: params.id, index, bytes: bytes.length });
    const page = await markEditPage(params.id, index, bytes, note);
    console.info("[mark] edit completed", {
      projectId: params.id,
      index,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ page });
  } catch (e: any) {
    console.error("[mark] edit failed", {
      projectId: params.id,
      index,
      durationMs: Date.now() - startedAt,
      error: String(e?.message ?? e),
      stack: e?.stack,
    });
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
