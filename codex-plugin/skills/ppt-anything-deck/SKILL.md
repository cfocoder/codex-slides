---
name: ppt-anything-deck
description: Build a slide deck by image generation from Codex — create, preview (in-editor browser), edit, and export to PDF/PPTX. Zero-config.
version: 0.1.0
---

# PPT Anything — Make a Deck (inside Codex)

Turn a prompt into a slide deck where **every slide is an image drawn by Codex** — no API key.
This skill drives the `ppt_anything` MCP tools so the whole flow happens inside Codex; the live
preview opens in the **in-editor browser**.

## Tools

- **create_deck**`{topic, pages?, aspect?, language?, style?, research?}` — generate a deck.
  Returns a project id + a preview URL. Set `research: true` to deep-research first and ground the deck.
- **deep_research**`{topic, rounds?}` — get a cited markdown brief (web_search) without building a deck.
- **open_preview**`{projectId}` — returns the `/project/<id>` URL; open it in the in-editor browser.
- **regenerate_slide**`{projectId, index, instruction?}` — edit/redraw one slide.
- **export_deck**`{projectId, format?}` — get the PDF/PPTX download URL.
- **list_projects** — existing decks with preview URLs.

## Typical flow

1. `create_deck({ topic: "Q3 product roadmap", pages: 8, style: "swiss international" })`
2. Open the returned preview URL in the in-editor browser to view/play the deck.
3. Refine: `regenerate_slide({ projectId, index: 3, instruction: "make it warmer, add the KPI" })`
   or use the web preview's chat/mark tools.
4. `export_deck({ projectId, format: "pptx" })`.

For research-backed decks: `create_deck({ topic, research: true })`, or run `deep_research` first,
review the brief, then create the deck.

## Notes

- Zero-config: text, images, and web search all run through the Codex responses backend using the
  token from `~/.codex/auth.json`.
- The MCP server auto-starts the local web app (`npm run start`, port 4311) if it isn't already
  running, so tools work without a separate terminal. Build it once with `npm run build`.
- Fully usable standalone too: open http://localhost:4311 in a browser.
