---
name: ppt-anything
description: Create, research, revise, restyle, present, inspect, and export PPT Anything slide decks from Codex. Use when the user asks for a presentation, PPT/PPTX, slide deck, research brief converted into slides, an existing deck edit, a marked-up slide revision, or to open and operate PPT Anything in the Codex in-editor Browser.
---

# PPT Anything

Run the complete presentation workflow from Codex. This skill is self-contained:
its bundled CLI talks to the local PPT Anything HTTP API and does not require
MCP. When the `ppt_anything` MCP tools are available, they provide the same
operations as typed tool calls.

## Choose a transport

1. Use the `ppt_anything` MCP tools when they are exposed in the current
   session and a structured tool call is convenient.
2. Otherwise run `scripts/ppt-anything.mjs`. Pass inputs with `--json`,
   `--input-file`, or command flags. It installs, builds, and starts the local
   app when necessary.
3. Do not treat MCP as a prerequisite. Both transports use the same API and
   return the same project URLs.

Run this to discover the portable command surface:

```bash
node <skill-dir>/scripts/ppt-anything.mjs capabilities
```

Read [references/COMMANDS.md](references/COMMANDS.md) when selecting commands,
constructing JSON inputs, or mapping a CLI command to an MCP tool.

## Build a deck

- Use `create` / `create_deck` for the fast path from topic to rendered deck.
- Use the staged path when review matters: `onboard`, optional `research`,
  `outline`, optional `revise-outline` and `inspiration`, then `render`.
- Preserve the Markdown research brief and its source links. Do not call a
  brief source-backed when it contains no source links.
- Upload logos, screenshots, PDFs, or other references with `upload-material`
  before creation, editing, or restyling, then pass the returned material ids.

## Edit an existing deck

- Inspect with `list` and `get` before changing an unknown project.
- Use `edit` for natural-language add/rewrite/redraw/optimize requests.
- Use `slide` for deterministic add, duplicate, delete, or transition changes.
- Use `regenerate` for one slide and `restyle` for the whole deck.
- Use `upload-slide` for a finished local PNG.
- Use `mark-edit` when the user supplies an annotated PNG and wants a clean
  regenerated slide.

Keep durable edits scoped to the project the user named. If no project was
named and multiple projects exist, inspect the recent list before choosing.

## Open and verify in Codex Browser

After creation or any visual mutation, run `open` / `open_ppt_anything` with the
project id. Navigate the returned `url` or resource link in Codex's in-editor
Browser and inspect the visible result. Do not stop after printing the URL when
the Browser capability is available.

Use the Browser for Play mode, slide navigation, direct on-canvas marking, and
layout inspection. If the current Codex surface has no in-app Browser session,
return the local URL and state that limitation instead of claiming it opened.

## Export only after review

Use `export` / `export_deck` with `pdf` or `pptx` after the requested visual
result is ready. Return the download URL and keep the project preview URL
available for follow-up edits.

## Runtime

Use Node.js 20 or newer. Override the default app URL with
`PPT_ANYTHING_URL`; override the source checkout with `PPT_ANYTHING_HOME`.
