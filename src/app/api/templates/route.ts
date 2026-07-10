import { NextResponse } from "next/server";
import { CATEGORIES, TEMPLATES } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Machine-readable template catalog for Codex/MCP clients. */
export async function GET() {
  return NextResponse.json({ categories: CATEGORIES, templates: TEMPLATES });
}
