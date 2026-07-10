// Deep research mode (M5). Zero-config, out-of-the-box:
//   topic -> Codex researches with its BUILT-IN web_search tool (multi-angle) ->
//   cited markdown brief -> gap-fill round -> brief seeds the outline.
//
// Ref patterns: dzhng/deep-research, Alibaba-NLP/DeepResearch,
// langchain-ai/open_deep_research — search fan-out + read + synthesize + gap-check.
//
// Why codex web_search and not DuckDuckGo: the DDG HTML/Lite endpoints bot-block
// server requests (HTTP 202 anomaly page). Codex's own web_search tool works
// through the same zero-config responses endpoint and returns real, cited results.
// ddgSearch() is kept as a documented fallback utility.

import {
  CODEX_RESPONSES_MODEL,
  postCodexResponses,
  sseEvents,
} from "./codex-sse";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type ResearchEvent =
  | { type: "queries"; queries: string[]; round: number }
  | { type: "search"; query: string; count: number }
  | { type: "synth"; round: number }
  | { type: "log"; message: string }
  | { type: "doc"; markdown: string }
  | { type: "done" }
  | { type: "error"; error: string };

// --- primary path: Codex built-in web_search --------------------------------

function researchPrompt(topic: string, priorDoc: string): string {
  if (priorDoc) {
    return [
      `You are extending a research brief about: ${topic}.`,
      "Identify what is missing, thin, or outdated in the draft below, then USE WEB SEARCH to fill those gaps.",
      "Return an improved, extended markdown brief in the same format (more/updated facts and sources).",
      "",
      "DRAFT:",
      priorDoc,
    ].join("\n");
  }
  return [
    `Research this topic for a slide deck using web search: ${topic}.`,
    "Search several angles (definition/context, market size & trends, key players/examples, recent developments, risks/open questions).",
    "Then write a clean markdown research brief: a short intro, 4-8 thematic sections with concrete, current facts and figures",
    "(not filler), and a final '## Sources' list of [title](url) you actually found. Cite inline as [n].",
    "Return ONLY the markdown.",
  ].join("\n");
}

async function codexSearchSynthesize(
  topic: string,
  priorDoc: string,
  emit: (e: ResearchEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  const payload = {
    model: CODEX_RESPONSES_MODEL,
    instructions:
      "You are a research analyst. Use the web_search tool to gather current, cited facts, then write a clean markdown brief.",
    input: [{ role: "user", content: [{ type: "input_text", text: researchPrompt(topic, priorDoc) }] }],
    tools: [{ type: "web_search" }],
    store: false,
    stream: true,
  };
  const resp = await postCodexResponses(payload, { signal, timeoutMs: 300_000 });

  let text = "";
  let completedText = "";
  const seenQueries: string[] = [];
  for await (const ev of sseEvents(resp)) {
    const t = ev.type as string;
    if (t === "response.web_search_call.searching" || t === "response.web_search_call.in_progress") {
      const q = ev.action?.query ?? ev.query ?? "web";
      if (!seenQueries.includes(q)) {
        seenQueries.push(q);
        emit({ type: "search", query: q, count: 1 });
      }
    }
    if (t === "response.output_text.done" && typeof ev.text === "string") text = ev.text;
    if (t === "response.completed" && ev.response?.output) {
      for (const item of ev.response.output) {
        if (item?.type === "message" && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c?.type === "output_text" && typeof c.text === "string") completedText = c.text;
          }
        }
      }
    }
  }
  return (text || completedText).trim();
}

export interface RunResearchOptions {
  rounds?: number; // synthesis rounds (default 2)
  signal?: AbortSignal;
}

/** Run the deep-research loop, emitting progress. Returns the final markdown doc. */
export async function runResearch(
  topic: string,
  emit: (e: ResearchEvent) => void,
  opts: RunResearchOptions = {},
): Promise<string> {
  const { rounds = 2, signal } = opts;
  let doc = "";
  try {
    for (let round = 1; round <= rounds; round++) {
      if (signal?.aborted) break;
      emit({ type: "synth", round });
      const next = await codexSearchSynthesize(topic, doc, emit, signal);
      if (next) doc = next;
      emit({ type: "doc", markdown: doc });
    }
    emit({ type: "done" });
    return doc;
  } catch (e: any) {
    emit({ type: "error", error: String(e?.message ?? e) });
    return doc;
  }
}

// --- fallback utility: DuckDuckGo HTML (currently bot-blocked on servers) ----

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").trim();
}

/** DuckDuckGo HTML search (no key). Returns [] when DDG serves its anomaly page. */
export async function ddgSearch(query: string, limit = 6): Promise<SearchResult[]> {
  try {
    const resp = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: `q=${encodeURIComponent(query)}`,
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const results: SearchResult[] = [];
    const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(html)) && results.length < limit) {
      results.push({ url: lm[1], title: stripTags(lm[2]), snippet: "" });
    }
    return results;
  } catch {
    return [];
  }
}
