# PPT Anything

Zero-config slide decks **by image generation**, driven entirely by your local **Codex** agent.
No API key, no `.env` — if you can run `codex`, you can make a deck. Full-TS: **Next.js 14 + React + TypeScript**.

## What it does

- **Gen-UI onboarding** — type a topic; Codex asks 4–6 tailored questions (pages, aspect, language, category,
  visual style, content emphasis) as a dynamic form. Answers seed the deck (and auto-pick a template).
- **Deep research mode** — toggle it and Codex web-searches the topic into a cited, **editable markdown brief**;
  the outline is grounded in it.
- **Projects** — every deck is a project: create from the home page, open `/project/<id>` to preview, edit, play,
  and export. Recent projects show on the home page.
- **Image→PPT** — upload logos / product shots / brand refs; they're passed as reference images so slides adopt them.
- **Templates** — 45 templates across 15 categories (genspark taxonomy); pick one and the whole deck adopts its
  grid, palette, and typography.
- **Conversational + mark editing** — chat ("make slide 2 warmer", "restyle the whole deck to swiss") routes to the
  right slides; or draw arrows/notes on a slide and send the screenshot back for an assisted edit (cowart-style).
- **Play** — fullscreen slideshow (←/→/Space/Esc).
- **Export** — PDF (pdf-lib) and PPTX (pptxgenjs).
- **Codex-native** — a Codex plugin (MCP + skills) lets you do all of the above *inside Codex*, previewing in the
  in-editor browser.

## Zero-config, how

`codex login` stores a ChatGPT OAuth token at `~/.codex/auth.json`. We reuse it to call the same backend the
Codex CLI uses (`POST https://chatgpt.com/backend-api/codex/responses`):

- **Text** (outline, per-slide copy, chat/onboard intent) — a plain Responses request.
- **Images** (each slide) — a Responses request with the built-in `image_generation` tool (gpt-image-1).
- **Web search** (deep research) — a Responses request with the built-in `web_search` tool.

No image/search code of our own, no key. (DuckDuckGo HTML/Lite bot-block servers, so `web_search` is the search path.)

## Run

```bash
npm install          # or pnpm install
npm run build        # once
npm run start        # http://127.0.0.1:4311   (or: npm run dev)
# prerequisite: `codex login` (Sign in with ChatGPT) once
```

## Use inside Codex (plugin)

This repository is itself the plugin root (`.codex-plugin/plugin.json`,
`.mcp.json`, `skills/`, and `mcp/`). Install it in the personal marketplace,
start a new Codex conversation, then ask:

```text
Open PPT Anything in the Codex Browser.
Research the 2026 humanoid robot market, build a 6-slide deck, and show me the preview.
Add a summary after slide 5, restyle the deck, and open the result.
```

The plugin exposes 20 MCP tools covering the complete product chain:

- open/discover: `open_ppt_anything`, `get_capabilities`, `list_projects`, `get_project`, `list_templates`
- plan/research: `get_onboarding_questions`, `deep_research`, `create_outline`, `revise_outline`, `rank_inspiration`
- create/edit: `create_deck`, `render_deck`, `edit_deck`, `restyle_deck`, `manage_slide`, `regenerate_slide`
- files/output: `upload_material`, `upload_slide_image`, `mark_edit_slide`, `export_deck`

`open_ppt_anything` starts the local app when needed and returns a Browser
resource link. The bundled browser skill tells Codex to navigate that link in
the in-editor Browser immediately, so the app is agent-operable as well as
manually usable. Personal-marketplace installs run against the stable
`~/plugins/ppt-anything` source checkout, so projects and builds survive Codex
plugin cache upgrades.

Validate the integration with `npm run check:mcp`; with the app running, use
`npm run check:mcp:live` to verify the API, template catalog, and Browser link.

## Layout

```
src/lib/
  codex-auth · codex-sse · codex-text · codex-image   zero-config codex text/image
  research.ts     deep-research loop (codex web_search) + markdown brief
  agents.ts       detect codex/claude/gemini CLIs; drive them headless
  prompts.ts      outline / page / image / edit / mark prompt builders
  onboard.ts      gen-UI clarifying questions
  chat.ts         NL edit → {targets, instruction}
  templates.ts    45 templates × 15 categories + styleBlockFor()
  pipeline.ts     the orchestrator + multi-round edits
  store.ts        on-disk projects (data/projects/<id>/)  ·  materials.ts  uploads
  assemble.ts     PNG → PDF / PPTX
src/app/          home · /project/[id] · api/{agents,generate,research,onboard,materials,templates,projects/*}
src/components/   OnboardForm · ResearchPanel · TemplatePicker · MaterialTray · DeckView · ChatEditPanel · PlayMode · MarkCanvas
.codex-plugin/    installable Codex plugin manifest
.mcp.json + mcp/  20-tool MCP server + auto-start bridge
skills/           browser · deck · research Codex workflows
scripts/          cache-safe MCP launcher + inventory/live integration probe
SPEC.md           living plan/spec + requirement matrix (source of truth)
```

## Provenance

Image mechanism from `Anionex/banana-slides` (`codex_provider.py`); agent detect/invoke from `nexu-io/html-anything`;
per-unit + mark-edit from `nexu-io/html-video` + `zhongerxin/cowart`; template taxonomy from the genspark
commercialization spec + banana-slides.
