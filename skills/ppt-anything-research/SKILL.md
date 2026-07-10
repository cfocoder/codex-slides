---
name: ppt-anything-research
description: Compatibility entry point for researching a current topic into a source-backed Markdown brief and turning it into a PPT Anything outline or rendered deck. Use for market, competitive, policy, technical, academic, or other presentation requests that need current facts, figures, comparisons, or citations.
---

# PPT Anything Research

The canonical `ppt-anything` sibling skill owns the complete workflow. Use
`deep_research` when MCP is available; otherwise run CLI command `research` at
`../ppt-anything/scripts/ppt-anything.mjs`. Preserve its Markdown and citations
so the user can review or edit the evidence before slide generation.

For the staged workflow:

1. Call `deep_research` / CLI `research` with one to four rounds.
2. Call `create_outline` / CLI `outline` with `researchDoc` set to the reviewed brief.
3. Revise the draft with `revise_outline` / CLI `revise-outline` when needed.
4. Call `render_deck` / CLI `render` only after the outline is accepted.
5. Call `open_ppt_anything` / CLI `open` and navigate the returned project
   resource or URL in the in-editor Browser for visual verification.

For a fast path, call `create_deck` with `research: true`. Do not claim a brief
is source-backed when its returned Markdown has no source links.
