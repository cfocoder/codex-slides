---
name: ppt-anything
description: Create, research, revise, restyle, present, inspect, and export PPT Anything slide decks from Codex, including scenario workflows, project Design Files, and always-on brand design systems. Use when the user asks for a presentation, PPT/PPTX, slide deck, research brief converted into slides, an existing deck edit, a marked-up slide revision, brand/style controls, project files, or to open and operate PPT Anything in the Codex in-editor Browser.
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
Read [references/CAPABILITY_MATRIX.md](references/CAPABILITY_MATRIX.md) when
auditing a newly added product feature or changing the Browser/CLI/MCP contract.

## Build a deck

- Discover workflow presets with `scenarios` / `list_scenarios`. A scenario owns
  its default page count, aspect, research behavior, model instruction, and
  required/optional source slots. Pass its `scenarioId` to `onboard`,
  `research`, `create`, or `outline`; do not re-create the scenario prompt by
  hand.
- Upload slot files with `upload-material` / `upload_material`, then pass both
  `materialIds` and `materialContexts` (`id`, `name`, `role`). Required slots
  must be satisfied before creation. Keep content sources, datasets, brand
  assets, templates, and visual references in their declared roles.
- Use `create` / `create_deck` for the fast path from topic to rendered deck.
- Use the staged path when review matters: `onboard`, optional `research`,
  `outline`, optional `revise-outline` and `inspiration`, then `render`.
- Preserve the Markdown research brief and its source links. Do not call a
  brief source-backed when it contains no source links.
- Upload logos, screenshots, PDFs, or other references with `upload-material`
  before creation, editing, or restyling, then pass the returned material ids.

## Operate Design Files

- Use `design-files` / `list_design_files` to inspect the generated and uploaded
  project file inventory. Use `read-design-file` / `read_design_file` for text
  and the returned Browser deep link for visual or binary files.
- Use `write-design-file` / `write_design_file` only when the user asked to
  replace an existing editable file. Use `upload-design-file` /
  `upload_design_file` to add a local file to the project workspace.
- When an outline or deck edit should use project files as evidence, pass their
  returned paths as `designFilePaths` to `revise-outline` / `revise_outline` or
  `edit` / `edit_deck`. This is the Codex equivalent of selecting a Design File
  with `@` in the Browser composer.

## Maintain the brand design system

- Call `get-brand-system` / `get_brand_design_system` before changing an
  existing project's always-on rules. It returns normalized brand identity,
  style, colors, typography, effects, spacing, radii, and brand assets.
- Stage new logos or product images with `upload-material`, then merge a partial
  update with `set-brand-system` / `update_brand_design_system`. Brand updates
  preserve untouched sections. Redrawing existing slides is explicit; default
  to saving without redraw unless the user requested application to the current
  deck.
- A brand design system is project-wide context for outline generation, slide
  generation, chat planning, and later edits. Do not replace it with a one-off
  free-text style when the project already has one.

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

Use Browser view `scenarios` for the workflow catalog, `design-files` for the
file workspace, and `brand-system` for the visual-system editor. Use the normal
workspace for Play mode, slide navigation, direct on-canvas marking, and layout
inspection. If the current Codex surface has no in-app Browser session, return
the local URL and state that limitation instead of claiming it opened.

## Export only after review

Use `export` / `export_deck` with `pdf` or `pptx` after the requested visual
result is ready. Return the download URL and keep the project preview URL
available for follow-up edits.

## Runtime

Use Node.js 20 or newer. Override the default app URL with
`PPT_ANYTHING_URL`; override the source checkout with `PPT_ANYTHING_HOME`.
