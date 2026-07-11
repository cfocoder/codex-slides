# GitHub repository metadata

Use this copy when preparing the public GitHub repository.

## Identity

| Field | Recommended value |
|---|---|
| Repository name | `ppt-anything` |
| Display title | **PPT Anything — Browser-first presentations inside Codex** |
| Owner | `nexu-io` |
| Primary category | **Productivity** |
| Secondary categories | AI, Design Tools, Developer Tools, Presentations |
| License | MIT |
| Default branch | `master` |

## GitHub description

Recommended short description:

> Browser-first AI presentation workspace for Codex. Create persistent projects, review research, outlines and styles, generate image-native slides, edit by chat or annotation, present, and export PDF/PPTX.

Short alternative:

> Create, review, edit, present, and export visual slide decks without leaving Codex.

## Topics

GitHub supports up to 20 repository topics. Recommended set:

```text
codex
codex-plugin
agent-skills
mcp
presentations
slides
powerpoint
pptx
ai-presentation
image-generation
deep-research
design-system
browser-automation
generative-ai
nextjs
typescript
productivity
open-design
```

## Marketplace copy

**Display name**

> PPT Anything

**Short description**

> Build decks step by step in a live Codex Browser workspace.

**Long description**

> PPT Anything gives Codex a Browser-first presentation workflow. Open the product before generation, create a durable project, and keep requirements, research, outline approval, visual direction, rendering, editing, presenting, and export visible and steerable in one workspace. Headless CLI and MCP automation remain available when explicitly requested.

**Category**

> Productivity

## Social preview

- Canvas: 1280 × 640 px.
- Headline: **Make every slide visible and steerable in Codex.**
- Supporting line: **Research → outline → style → render → edit → present → export.**
- Show the Codex conversation on the left and a completed PPT Anything canvas
  on the right.
- Use the PPT Anything mark and the product's blue-violet accent.
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
