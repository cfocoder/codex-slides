---
name: ppt-anything-research
description: Research a current topic into a source-backed Markdown brief and turn it into a PPT Anything outline or rendered deck. Use for market, competitive, policy, technical, academic, or other presentation requests that need current facts, figures, comparisons, or citations.
---

# PPT Anything Research

Use `deep_research` to produce the source-backed brief. Preserve its Markdown
and citations so the user can review or edit the evidence before slide
generation.

For the staged workflow:

1. Call `deep_research` with one to four rounds.
2. Call `create_outline` with `researchDoc` set to the reviewed brief.
3. Revise the draft with `revise_outline` when needed.
4. Call `render_deck` only after the outline is accepted.
5. Call `open_ppt_anything` and navigate the returned project resource in the
   in-editor Browser for visual verification.

For a fast path, call `create_deck` with `research: true`. Do not claim a brief
is source-backed when its returned Markdown has no source links.
