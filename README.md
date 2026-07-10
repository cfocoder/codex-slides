# PPT Anything (web)

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
cd web
npm install          # or pnpm install
npm run build        # once
npm run start        # http://localhost:4311   (or: npm run dev)
# prerequisite: `codex login` (Sign in with ChatGPT) once
```

## Use inside Codex (plugin)

```bash
# from web/codex-plugin — register + install per the Codex plugin flow, then in Codex:
#   "Make a 6-slide deck about X and open the preview"
#   "Deep-research the 2026 humanoid robot market, then build a deck from it"
```

Tools: `create_deck` · `deep_research` · `list_projects` · `open_preview` · `regenerate_slide` · `export_deck`.
The MCP server auto-starts the web app if it isn't running (`ensureServer` daemon).

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
src/app/          home · /project/[id] · api/{agents,generate,research,onboard,materials,projects/*}
src/components/   OnboardForm · ResearchPanel · TemplatePicker · MaterialTray · DeckView · ChatEditPanel · PlayMode · MarkCanvas
codex-plugin/     .codex-plugin/plugin.json · .mcp.json · mcp/server.mjs · skills/{ppt-anything-deck,ppt-anything-research}
SPEC.md           living plan/spec + requirement matrix (source of truth)
```

## Provenance

Image mechanism from `Anionex/banana-slides` (`codex_provider.py`); agent detect/invoke from `nexu-io/html-anything`;
per-unit + mark-edit from `nexu-io/html-video` + `zhongerxin/cowart`; template taxonomy from the genspark
commercialization spec + banana-slides.
