import { NextResponse } from "next/server";
import { generateOnboardQuestions } from "@/lib/onboard";
import { isUiLocale } from "@/i18n/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const requirement = String(body?.requirement ?? "").trim();
  const uiLocale = isUiLocale(body?.uiLocale) ? body.uiLocale : "zh-CN";
  if (!requirement) {
    return NextResponse.json({ error: "requirement is required" }, { status: 400 });
  }
  try {
    const questions = await generateOnboardQuestions(requirement, undefined, uiLocale);
    return NextResponse.json({ questions });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
