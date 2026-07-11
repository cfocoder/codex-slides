// Step 2 of the staged flow (搜索 + 写大纲): optional deep research, then write the
// outline and persist a DRAFT project. Streams progress as SSE ProgressEvents; no
// slides are rendered here — the client lets the user edit + confirm first.

import { coerceConfig } from "@/lib/config";
import { planOutline } from "@/lib/pipeline";
import { runResearch } from "@/lib/research";
import { type ProgressEvent } from "@/lib/types";
import { scenarioPromptContext } from "@/lib/scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const config = coerceConfig(body);
  if (!config.requirement) {
    return new Response(JSON.stringify({ error: "requirement is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal?.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* controller closed */
        }
      };
      try {
        // 2a — optional deep research grounds the outline in a cited brief.
        if (config.mode === "research" && !config.researchDoc?.trim()) {
          const doc = await runResearch(
            config.requirement,
            (ev) => {
              if (ev.type === "search") send({ type: "research", phase: "searching", detail: ev.query });
              else if (ev.type === "synth") send({ type: "research", phase: "synthesizing", detail: `round ${ev.round}` });
              else if (ev.type === "doc") send({ type: "research", phase: "brief", markdown: ev.markdown });
            },
            { signal: abort.signal, workflowContext: scenarioPromptContext(config.scenarioId) },
          );
          if (doc.trim()) config.researchDoc = doc;
        }
        // 2b — write the outline and save the draft project.
        await planOutline(config, send, { signal: abort.signal });
      } catch (e: any) {
        send({ type: "error", error: String(e?.message ?? e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
