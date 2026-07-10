import { NextResponse } from "next/server";
import { detectAgents } from "@/lib/agents";
import { hasCodexToken } from "@/lib/codex-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const agents = detectAgents();
  const codexReady = hasCodexToken();
  return NextResponse.json({
    codexReady,
    agents,
    // "codex" engine = the zero-config Responses backend; available iff token present.
    engines: [
      { engine: "codex", label: "Codex (zero-config backend)", available: codexReady },
      ...agents.map((a) => ({
        engine: `${a.id}-cli`,
        label: `${a.label} (local CLI)`,
        available: a.available,
      })),
    ],
  });
}
