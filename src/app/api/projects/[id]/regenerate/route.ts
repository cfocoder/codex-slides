import { NextResponse } from "next/server";
import { regeneratePage } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const index = Number(body?.index);
  const instruction = body?.instruction ? String(body.instruction) : undefined;
  if (!Number.isInteger(index)) {
    return NextResponse.json({ error: "index required" }, { status: 400 });
  }
  try {
    const page = await regeneratePage(params.id, index, instruction);
    return NextResponse.json({ page });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
