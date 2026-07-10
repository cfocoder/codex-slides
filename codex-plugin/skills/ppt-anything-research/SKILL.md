---
name: ppt-anything-research
description: Deep-research a topic into a cited markdown brief, then turn it into a slide-deck outline. Zero-config, uses DuckDuckGo + Codex synthesis.
version: 0.1.0
---

# PPT Anything — Deep Research

Turn a topic into a **source-backed markdown research brief**, then a slide-deck outline.
Out-of-the-box: no API key. Uses free DuckDuckGo HTML search + Codex synthesis, with a
Codex-knowledge fallback when live search is unavailable.

## When to use

- The user asks for a deck on a topic that benefits from current facts, figures, comparisons,
  or citations (market analysis, competitive landscape, technical survey, policy briefing).
- "Deep research mode" is toggled in the PPT Anything web app.

## The loop (mirror of `web/src/lib/research.ts`)

1. **Search + synthesize** — call the zero-config Codex responses endpoint with the built-in
   **`web_search`** tool enabled (`tools: [{ "type": "web_search" }]`). Prompt it to search several
   angles (context, market size/trends, key players, recent developments, risks) and write a clean
   markdown brief: short intro, 4–8 thematic sections with concrete current facts/figures (no filler),
   and a `## Sources` list of `[title](url)` it actually found. Cite inline `[n]`.
2. **Gap-fill** — feed the draft back: "what's missing/outdated?", let it web_search again and extend.
   Repeat ~2 rounds.
3. **Fallback** — DuckDuckGo HTML/Lite endpoints bot-block server requests (HTTP 202 anomaly), so
   `web_search` is primary. `ddgSearch()` remains as a utility; if no search path works at all, synthesize
   from model knowledge and clearly mark the brief as **not source-backed**.

## Output

A markdown document. Hand it to the outline stage as `<research_document>` context
(see `buildOutlinePrompt` in `web/src/lib/prompts.ts`): the outline and every slide's copy
are grounded in the brief's facts and structure instead of generic filler.

## In the web app

- `POST /api/research` (SSE) runs the loop and streams `queries` / `search` / `synth` / `doc` events.
- The user edits the brief in `ResearchPanel`, then "Generate deck from this research" sets
  `config.mode = "research"` and `config.researchDoc`, and the normal pipeline outlines from it.

## Running it natively inside Codex

You can execute this loop directly (no web app): search with the DuckDuckGo endpoint above (or
your own web tools), keep an evolving markdown brief on disk, iterate until the topic is covered,
then produce the outline JSON. This is the same flow the app automates — it just runs in the
Codex session, which is how PPT Anything stays "fully doable inside Codex".
