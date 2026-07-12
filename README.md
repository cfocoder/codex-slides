<p align="center">
  <img src="public/brand/ppt-anything-mark.png" width="88" height="88" alt="PPT Anything logo" />
</p>

<h1 align="center">PPT Anything</h1>

<p align="center">
  <strong>Create, review, edit, present, and export image-native slide decks without leaving Codex.</strong>
</p>

<p align="center">
  Browser-first · zero separate API keys · reusable project templates · web and desktop · PDF/PPTX export
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-111827.svg" /></a>
  <img alt="Next.js 14" src="https://img.shields.io/badge/Next.js-14-000000.svg" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6.svg" />
  <img alt="Codex plugin" src="https://img.shields.io/badge/Codex-plugin-6D5EF8.svg" />
  <img alt="Browser first" src="https://img.shields.io/badge/workflow-Browser--first-2563EB.svg" />
</p>

PPT Anything turns Codex into a visual presentation workspace. Codex opens the
product first, creates a durable project, and keeps every important checkpoint
visible: requirements, research, outline, visual direction, rendering, edits,
presentation, and export.

The default experience is deliberately not a hidden six-minute background
task. You see the deck being made and can steer it at every step.

```text
Open PPT Anything in the Codex Browser and keep it visible.
Create a 12-slide Chinese market deck about 2026 humanoid robotics.
Let me confirm the questions, outline, and visual direction before rendering.
```

## Contents

- [Why PPT Anything](#why-ppt-anything)
- [The Codex-first workflow](#the-codex-first-workflow)
- [Install in Codex](#install-in-codex)
- [Create your first deck](#create-your-first-deck)
- [Visual tutorial and prompt library](#visual-tutorial-and-prompt-library)
- [Generate from files](#generate-from-files)
- [Modify an existing deck](#modify-an-existing-deck)
- [Features](#features)
- [Community style library and licenses](#community-style-library-and-licenses)
- [Local development](#local-development)
- [Desktop development and releases](#desktop-development-and-releases)
- [CLI and MCP](#cli-and-mcp)
- [Architecture and data](#architecture-and-data)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Why PPT Anything

Most AI slide generators hide the process behind one request and return a file.
PPT Anything treats the presentation as a persistent, inspectable project.

| Typical one-shot generator | PPT Anything in Codex |
|---|---|
| Wait for a hidden end-to-end task | Open the live product before work begins |
| Discover problems after export | Confirm requirements, outline, and style first |
| Restart when the result is wrong | Continue editing the same saved project |
| Re-upload context every time | Keep Design Files and brand rules with the project |
| Rebuild a successful visual direction | Save a project as a reusable visual-system template |
| Describe visual bugs in prose | Mark directly on the slide |
| Separate app and agent histories | Codex and the Browser operate one shared project |

PPT Anything is image-native: each slide is composed as a full visual canvas.
That makes it strong for visual fidelity and rapid iteration. Exported PPTX files
contain full-slide images rather than individually editable PowerPoint shapes.

## The Codex-first workflow

```text
Codex conversation
      │
      ▼
Open PPT Anything home in the Codex Browser
      │
      ▼
Create a durable project
      │
      ├── Clarify the brief
      ├── Optional source-backed research
      ├── Review and revise the outline
      ├── Choose a visual direction
      ├── Watch slides render progressively
      └── Review the finished canvas
              │
              ├── Chat edits and queued follow-ups
              ├── Add / duplicate / move / delete / transition
              ├── Mark-based slide edits
              ├── Design Files and @ references
              ├── Save as a reusable project template
              ├── Brand & Design System
              ├── Play mode
              └── PDF / PPTX export
```

Projects are written to disk throughout the workflow. Opening the same project
from Codex and another browser stays synchronized; rendering pages are refreshed
from the canonical project state, and interrupted generation can resume safely.

## Install in Codex

### Requirements

- [Codex](https://developers.openai.com/codex/) with plugin support
- Node.js 20 or newer
- A ChatGPT account authenticated once with `codex login`
- Git

No separate OpenAI API key or `.env` file is required for the default Codex
workflow.

### Install from the GitHub marketplace

This repository includes a Codex marketplace manifest, so the repository itself
can be added as a plugin source:

```bash
codex plugin marketplace add nexu-io/ppt-anything
codex plugin add ppt-anything@ppt-anything
```

Restart Codex or the ChatGPT desktop app after installation, then start a new
task. You can also open `/plugins` in Codex to inspect installed plugins.

To update a Git-backed installation:

```bash
codex plugin marketplace upgrade ppt-anything
codex plugin remove ppt-anything@ppt-anything
codex plugin add ppt-anything@ppt-anything
```

Restart Codex after the update so the new Skill, MCP server, and interface
metadata are loaded. See OpenAI's
[local plugin installation documentation](https://learn.chatgpt.com/docs/build-plugins#install-a-local-plugin-manually)
for the marketplace layout and reload behavior.

### Install from a local checkout

```bash
git clone https://github.com/nexu-io/ppt-anything.git
cd ppt-anything
codex plugin marketplace add "$PWD"
codex plugin add ppt-anything@ppt-anything
```

After changing plugin files locally, reinstall the plugin and start a new Codex
task so cached Skills are refreshed.

## Create your first deck

Open a new Codex task and send:

```text
Open PPT Anything in the Codex Browser and keep the product visible.
From the home page, create a project for a six-slide product launch deck.
Guide me through the clarification questions, outline review, visual direction,
and rendering. Do not generate the complete deck in a hidden background call.
```

Codex should:

1. Open the PPT Anything home screen.
2. Submit the brief through the visible composer.
3. Enter the newly created project.
4. Help answer the requirements form.
5. Show the editable outline.
6. Show visual-direction choices.
7. Render inside the project canvas.
8. Inspect the completed slides before export.

For an explicitly unattended or headless job, say so. Only then should Codex
use the one-call `create_deck` / `create` fast path.

## Visual tutorial and prompt library

The home page contains **Use PPT Anything visually inside Codex** beneath the
main composer. It opens a localized tutorial covering the full creation and
editing workflow, with copy-ready prompts in English, Simplified Chinese, and
Japanese.

Open it directly after the local app starts:

```text
http://127.0.0.1:4311/?tutorial=codex
```

The tutorial covers:

- opening the product before generation;
- creating a recoverable project;
- clarifying the brief;
- reviewing outline and visual direction;
- watching progressive rendering;
- rewriting, restructuring, adding, duplicating, and deleting slides;
- mark-based editing;
- Design Files and `@` references;
- persistent brand rules;
- Play mode and export.

## Generate from files

Attach files to Codex or upload them from the PPT Anything composer. Give each
source a clear semantic role:

```text
Open PPT Anything in the Codex Browser.
Use the attached PDF as the content source, the spreadsheet as the dataset,
and the logo plus product screenshots as brand references.
Create the project through the visible UI and stop for outline approval before
rendering.
```

Supported project context includes images, PDFs, office documents,
spreadsheets, Markdown, text, data files, HTML/CSS, JavaScript, and TypeScript.
Scenario workflows can require or recommend specific source slots.

## Modify an existing deck

### Rewrite one slide

```text
Open my latest PPT Anything project. Rewrite slide 3 for an executive audience,
reduce the copy by 50%, preserve the conclusion, regenerate only that slide,
and show the result in the Browser.
```

### Change the structure

```text
Add an executive summary after slide 1, duplicate slide 5 as an international
market variant, and delete the final appendix. Preserve the visual system and
transitions.
```

### Restyle the complete deck

```text
Restyle this deck as a restrained Swiss editorial report with a strict grid,
high-contrast typography, warm photography, and one blue accent. Keep the
Browser visible and show the result before export.
```

### Edit from annotations

```text
Open slide 4 in Mark mode. Follow my arrows, labels, and comment exactly,
regenerate only that slide, and keep the marked source in project history.
```

### Apply a project-wide brand system

```text
Open Brand & Design System. Save the logo, color roles, typography, spacing,
imagery, and voice as always-on project context. Redraw the deck, review it in
Play mode, then export PPTX and PDF.
```

## Features

- **Browser-first Codex workflow** — open, operate, and verify the live product
  instead of waiting on an invisible task.
- **Durable projects** — every deck, checkpoint, conversation, queue, material,
  outline, and rendered image is persisted locally.
- **Cross-surface synchronization** — a project opened in another Browser tab
  follows externally generated or edited slide state.
- **Gen-UI clarification** — tailored questions for audience, purpose, length,
  language, format, and emphasis.
- **Deep research** — source-backed, editable Markdown briefs used as outline
  evidence.
- **24 workflow scenarios in six groups** — creation, transformation, data,
  research, optimization, and specialized delivery.
- **45 curated deck templates plus 73 community visual directions** across
  business reports, data, diagrams, UI, posters, products, brand systems,
  architecture, photography, editorial, and illustration.
- **Reusable project templates** — save any project as a visual-system snapshot,
  then reuse its brand rules, base style, format, brand assets, and up to six
  rendered-slide references from the home composer without copying its content.
- **Design Files** — inspect generated artifacts and uploads, edit text sources,
  reference project files in agent turns with `@`, copy an absolute file path,
  or download any individual file.
- **Brand & Design System** — persist identity, voice, palette, typography,
  imagery, effects, spacing, radii, and brand assets.
- **Conversational editing** — rewrite, add, remove, duplicate, reorder,
  transition, regenerate, or restyle through the Deck Agent.
- **Queued follow-ups** — keep prompting while generation or edits are in
  progress; requests run in order.
- **Mark editing** — draw arrows, shapes, labels, and comments directly on a
  slide, then regenerate from the annotated source.
- **Play mode** — full-screen presentation with keyboard navigation.
- **PDF and PPTX export** — export after visual review.
- **English, Simplified Chinese, and Japanese UI** with strict key parity.
- **Portable Skill and typed MCP server** — the complete workflow remains
  available when one transport is unavailable.

## Community style library and licenses

The Community styles Browser is a presentation-focused index distilled from the
open prompt galleries below. PPT Anything keeps one catalog for the home Browser,
the project inspiration checkpoint, Brand & Design System, prompt generation,
the portable CLI, and MCP. Selecting a community style injects its adapted
`<page_style>` rules and, when available, sends its preview as the first visual
reference image. The model is told to match art direction and layout grammar,
not to copy the preview's literal text, logos, subject, or composition.

| Reference | License noted by the source | How PPT Anything uses it |
|---|---|---|
| [YouMind Awesome GPT Image 2](https://github.com/YouMind-OpenLab/awesome-gpt-image-2) and [web gallery](https://youmind.com/gpt-image-2-prompts) | [CC BY 4.0](https://github.com/YouMind-OpenLab/awesome-gpt-image-2/blob/main/LICENSE) | Category research, prompt-language references, and source discovery |
| [freestylefly Awesome GPT Image 2](https://github.com/freestylefly/awesome-gpt-image-2) | [MIT](https://github.com/freestylefly/awesome-gpt-image-2/blob/main/LICENSE) | Adapted industrial template taxonomy and attributed remote previews |
| [JimmyLv Awesome Nano Banana](https://github.com/JimmyLv/awesome-nano-banana) | [CC BY 4.0](https://github.com/JimmyLv/awesome-nano-banana/blob/main/LICENSE), subject to per-case attribution overrides | Case discovery, prompt authorship, and presentation-suitable visual directions |
| [YouMind Awesome Nano Banana Pro Prompts](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts) | [CC BY 4.0](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/blob/main/LICENSE) | Curated local previews and adapted presentation style blocks |
| [muset-ai Awesome Nano Banana Pro](https://github.com/muset-ai/awesome-nano-banana-pro) | [CC BY 4.0](https://github.com/muset-ai/awesome-nano-banana-pro/blob/main/LICENSE), subject to per-case attribution overrides | Cross-checking Nano Banana Pro cases and visual coverage |
| [jamez-bondos Awesome GPT-4o Images](https://github.com/jamez-bondos/awesome-gpt4o-images) | [CC BY 4.0](https://github.com/jamez-bondos/awesome-gpt4o-images/blob/main/LICENSE), except separately noted OpenAI files and per-case overrides | Attributed preview images and reusable case-derived art directions |

Each catalog item keeps its source collection, original author when known, and
source URL in [`src/lib/community.ts`](src/lib/community.ts). The files under
[`public/community`](public/community) and remote community previews retain their
upstream terms and attribution requirements; PPT Anything's MIT license does not
relicense those assets. Before redistributing a specific preview, follow its
source link and check any case-level `ATTRIBUTION.yml` or notice.

## Local development

```bash
git clone https://github.com/nexu-io/ppt-anything.git
cd ppt-anything
npm install
codex login
npm run dev
```

Open <http://127.0.0.1:4311>.

Production build:

```bash
npm run build
npm run start
```

Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PPT_ANYTHING_URL` | `http://127.0.0.1:4311` | Browser and local API base URL |
| `PPT_ANYTHING_HOME` | auto-detected | Source checkout used by the portable Skill |
| `PPT_ANYTHING_APP_DIR` | plugin root | Source checkout used by the MCP server |
| `PPT_ANYTHING_LOG` | OS temp directory | Auto-start server log |
| `PPT_ANYTHING_NO_AUTO_START` | unset | Set to `1` to disable MCP auto-start |
| `PPT_ANYTHING_DATA_DIR` | `<repo>/data` | Project/template data root; desktop builds set this to the OS user-data directory |

Project data is stored under:

```text
data/projects/<project-id>/
├── project.json
├── 01.png
├── 02.png
├── ...
└── files/
    ├── generated/
    └── uploaded/

data/templates/<template-id>/
├── template.json
├── references/
└── brand-assets/
```

Do not commit personal project data or uploaded source material.

## Desktop development and releases

The same Next.js application can run in Electron on macOS, Windows, and Linux.
In packaged builds, Electron starts the bundled standalone server on an
available loopback port and stores durable data in the operating system's app
data directory.

```bash
pnpm electron:check       # validate the desktop/runtime contract
pnpm electron:dev         # Next.js dev server + Electron window
pnpm electron:pack        # unpacked app for the current platform
pnpm electron:dist        # installers for the current platform
```

Desktop builds use an isolated `.next-desktop` output so a concurrent web/dev
build cannot overwrite the runtime being packaged.

Pushing a `v*` tag runs
[`release-desktop.yml`](.github/workflows/release-desktop.yml), builds signed-off
artifacts on native macOS, Windows, and Linux runners, and publishes the `.dmg`,
`.zip`, `.exe`, `.AppImage`, and `.deb` files to a GitHub Release. Code signing
can be added through the standard electron-builder secrets without changing the
workflow shape.

## CLI and MCP

PPT Anything exposes two equivalent automation transports:

- `skills/ppt-anything/scripts/ppt-anything.mjs` — portable Node CLI using only
  built-in web APIs and the local HTTP service;
- `mcp/server.mjs` — 34 typed MCP tools for Codex.

Discover the CLI surface:

```bash
node skills/ppt-anything/scripts/ppt-anything.mjs capabilities
```

Browser-first interactive entry points:

```bash
node skills/ppt-anything/scripts/ppt-anything.mjs open
node skills/ppt-anything/scripts/ppt-anything.mjs start-project \
  --json '{"topic":"2026 humanoid robotics market","pages":6,"language":"en"}'
```

Explicit unattended path:

```bash
node skills/ppt-anything/scripts/ppt-anything.mjs create \
  --json '{"topic":"2026 humanoid robotics market","pages":6,"research":true}'
```

Important tool groups:

| Area | MCP tools |
|---|---|
| Open and discover | `open_ppt_anything`, `start_project`, `get_capabilities`, `list_projects`, `get_project` |
| Scenarios and sources | `list_scenarios`, `upload_material`, `list_design_files`, `read_design_file`, `write_design_file`, `upload_design_file` |
| Reusable templates | `list_templates`, `list_project_templates`, `save_project_as_template`, `delete_project_template` |
| Research and planning | `get_onboarding_questions`, `deep_research`, `create_outline`, `revise_outline`, `rank_inspiration` |
| Brand system | `get_brand_design_system`, `update_brand_design_system` |
| Create and edit | `create_deck`, `render_deck`, `edit_deck`, `restyle_deck`, `manage_slide`, `regenerate_slide` |
| Visual input and output | `upload_slide_image`, `mark_edit_slide`, `export_deck` |

The full Browser/CLI/MCP parity contract lives in
[CAPABILITY_MATRIX.md](skills/ppt-anything/references/CAPABILITY_MATRIX.md).

## Architecture and data

```text
Codex Skill / MCP server / Browser UI / Electron
                 │
                 ▼
        Next.js local HTTP API
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
    Codex text  web search  image generation
        │                   │
        └────────┬──────────┘
                 ▼
      on-disk project store
                 │
        ┌────────┴────────┐
        ▼                 ▼
      Browser          PDF / PPTX
```

Key directories:

```text
.codex-plugin/    installable Codex plugin manifest
.agents/          Git marketplace metadata
.mcp.json         MCP registration
mcp/              typed MCP server
skills/           canonical and compatibility Skills
src/app/          Next.js UI and API routes
src/components/   launcher, tutorial, project workspace, editing surfaces
src/lib/          agents, research, pipeline, project store, export
scripts/          contract, i18n, Skill, and MCP probes
data/projects/    local project state and generated assets
data/templates/   reusable project visual systems and reference assets
```

The local app uses the existing `codex login` authentication. Text generation,
web research, and image generation are invoked through the same authenticated
Codex environment; no separate application API key is stored by PPT Anything.

## Verification

Run the complete static contract:

```bash
npm run typecheck
npm test
npm run check:i18n
npm run check:project-sync
npm run check:skill
npm run check:mcp
npm run electron:check
npm run build
```

With the local app running:

```bash
npm run check:skill:live
npm run check:mcp:live
npm run check:project-sync:live
```

UI changes should also be checked at desktop, tablet, and phone widths. For
project workflow changes, verify both the Codex Browser and a second browser tab
using the same project URL.

## Troubleshooting

### Codex does not see the plugin

1. Run `codex plugin list` and confirm `ppt-anything` is enabled.
2. Reinstall the plugin after changing its version or Skill files.
3. Restart Codex or the ChatGPT desktop app.
4. Start a new task; existing tasks may retain the old Skill snapshot.

### The local app does not start

```bash
node --version       # must be 20+
npm install
npm run build
npm run start
```

Inspect the log at `PPT_ANYTHING_LOG` or the operating system temp directory.

### One browser tab shows stale slides

Every open project page polls the canonical project, including while it already
looks complete, and also refreshes on focus or visibility changes. This lets a
visible browser discover a new Codex, MCP, CLI, or second-tab mutation. If an
older build is still open, restart the local server and reload both tabs.
Confirm the API state:

```bash
curl http://127.0.0.1:4311/api/projects/<project-id>
```

### A project is stuck in rendering

PPT Anything waits for the active renderer and only resumes after the project
has no disk heartbeat for 90 seconds. Reopen the project; already rendered pages
are preserved and only pending or failed pages are retried.

### Exported PPTX text is not editable

This is expected. PPT Anything currently exports each completed slide as a
full-slide image for visual fidelity.

## GitHub repository metadata

Recommended repository title, description, categories, topics, social-preview
copy, and release naming are documented in
[docs/GITHUB_METADATA.md](docs/GITHUB_METADATA.md).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), which
covers setup, architecture boundaries, i18n, Skill/MCP parity, visual QA, tests,
and pull-request expectations.

- Use [GitHub Issues](https://github.com/nexu-io/ppt-anything/issues) for bugs
  and feature proposals.
- Use GitHub private vulnerability reporting for security issues; see
  [SECURITY.md](SECURITY.md).
- Be respectful and constructive; see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

PPT Anything source code is available under the [MIT License](LICENSE).
Community previews and adapted prompt references retain the upstream terms and
attribution documented in [Community style library and licenses](#community-style-library-and-licenses).

## Acknowledgements

PPT Anything builds on ideas and implementation patterns from:

- [`Anionex/banana-slides`](https://github.com/Anionex/banana-slides) for the
  original image-generation presentation mechanism;
- [`nexu-io/html-anything`](https://github.com/nexu-io/html-anything) for local
  agent detection and invocation patterns;
- [`nexu-io/html-video`](https://github.com/nexu-io/html-video) and
  [`zhongerxin/cowart`](https://github.com/zhongerxin/cowart) for per-unit and
  mark-edit interaction ideas;
- [Open Design](https://github.com/nexu-io/open-design) for the agent-native
  design workflow and product direction.

---

<p align="center">
  <strong>Open PPT Anything in Codex. Keep it visible. Make every slide steerable.</strong>
</p>
