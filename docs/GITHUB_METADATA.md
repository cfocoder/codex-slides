# GitHub repository metadata

Use this copy when preparing the public GitHub repository.

## Identity

| Field | Recommended value |
|---|---|
| Repository name | `codex-slides` |
| Display title | **Codex Slides — the open-source AI slide studio inside Codex** |
| Owner | `nexu-io` |
| Primary category | **Productivity** |
| Secondary categories | AI, Design Tools, Developer Tools, Presentations |
| License | MIT |
| Default branch | `master` |

## GitHub description

Recommended short description (About box):

> 🎨 The open-source AI slide studio that lives inside your coding agent. 🖼️ Image-native decks — every slide a full visual canvas. 🔍 Watch the whole chain live: research → outline → style → render → edit → present → export PDF/PPTX. 🖥️ Browser-first · zero API keys · durable projects. 🤖 Runs in Codex.

Plain-text alternative:

> The best way to make slides with a coding agent. Turn a prompt, a repo, or a pile of files into a beautiful, presentation-ready deck without leaving Codex.

Short alternative:

> Create, review, edit, present, and export image-native slide decks without leaving Codex.

## Topics

GitHub supports up to 20 repository topics. Recommended set:

```text
codex
codex-slides
codex-plugin
agent-skills
coding-agents
mcp
slides
ai-slides
ai-ppt
ai-presentation
presentation-generator
powerpoint
pptx
image-generation
deep-research
design-system
generative-ai
nextjs
typescript
open-design
```

## Marketplace copy

**Display name**

> Codex Slides

**Short description**

> Build decks step by step in a live Codex Browser workspace.

**Long description**

> Codex Slides gives Codex a Browser-first slide workflow plus a portable Agent Skill and 34 typed MCP tools. Open the product before generation, create a durable project, and keep requirements, research, outline approval, visual direction, rendering, editing, presenting, and export visible and steerable in one workspace. Headless CLI and MCP automation remain available when explicitly requested.

**Category**

> Productivity

## Social preview

A ready-to-use 1280 × 640 social card is generated at
[`docs/assets/readme/social-preview.png`](assets/readme/social-preview.png). Upload it under
**Settings → General → Social preview** so shared links on X, LinkedIn, and Slack render with a
branded card (GitHub has no CLI/API for this, so it is a one-time manual upload).

If regenerating:

- Canvas: 1280 × 640 px.
- Headline: **Make slides with your coding agent.**
- Supporting line: **Codex Slides — the open-source AI slide studio inside Codex.**
- Show a Codex / coding-agent terminal transforming into finished slides.
- Include `Open source` and `Runs in Codex` pills.
- Use the Codex Slides mark and the product's blue-violet accent (`#6D5EF8`).
- Avoid tiny UI screenshots or more than two lines of text.

## Release naming

Use semantic versions and outcome-oriented release titles:

```text
v0.4.0 — Visual Codex Workflow
v0.4.1 — Project Sync Fixes
v0.5.0 — Design Files and Brand Systems
```

Each release should include:

- user-visible changes;
- upgrade or plugin-cache steps;
- screenshots for visual changes;
- compatibility notes;
- commands used for verification;
- known limitations.

## Suggested repository settings

- Enable Issues and Discussions.
- Enable private vulnerability reporting.
- Require pull requests before merging to the default branch.
- Require typecheck, i18n, Skill, MCP, and production-build checks.
- Enable automatic deletion of merged branches.
- Add the social preview described above.
