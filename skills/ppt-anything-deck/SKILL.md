---
name: ppt-anything-deck
description: Create, inspect, revise, restyle, and export PPT Anything slide decks through its MCP tools. Use when a user asks Codex to make a presentation, turn research into slides, edit an existing deck, manage slide structure, apply a template, or export PDF/PPTX.
---

# PPT Anything Deck

Drive the presentation through the `ppt_anything` MCP tools. Keep the live
workspace available in the in-editor Browser whenever visual review helps.

## Choose the flow

- For a fast one-call result, call `create_deck`.
- For a reviewable workflow, call `create_outline`, optionally
  `revise_outline` and `rank_inspiration`, then `render_deck`.
- For an existing deck, use `list_projects` or `get_project`, then choose the
  smallest mutation tool.

## Edit with the right tool

- Use `edit_deck` for natural-language add/rewrite/redraw/optimize requests.
- Use `manage_slide` for deterministic add, duplicate, delete, or transition.
- Use `regenerate_slide` for one slide.
- Use `restyle_deck` for a whole-deck template/style change.
- Use `upload_material` before creation, editing, or restyling when a local
  reference file matters.
- Use `upload_slide_image` for a finished PNG.
- Use `mark_edit_slide` when the user supplies an annotated PNG and wants a
  clean revised slide.

## Show and verify

After a creation or visual mutation, call `open_ppt_anything` with the project
id and navigate its resource link in the Codex in-editor Browser. Inspect the
changed slide or flow there; do not make the user open the URL manually.

Use `export_deck` only after the requested visual result is ready. Browser-only
controls such as fullscreen Play, slide navigation, and direct on-canvas
marking remain available through the live workspace.
