# PPT Anything command reference

The portable CLI is:

```bash
node <skill-dir>/scripts/ppt-anything.mjs <command> --json '<object>'
```

Use `--json -` to read JSON from stdin, `--input-file input.json` for a file,
or flags such as `--project-id abc --index 2`. Every invocation prints one JSON
object. Success responses contain `"ok": true`; failures contain
`"ok": false` and exit non-zero.

## Command map

| CLI command | MCP tool | Important input |
|---|---|---|
| `capabilities` | `get_capabilities` | none |
| `open` | `open_ppt_anything` | optional `projectId` |
| `onboard` | `get_onboarding_questions` | `topic` |
| `research` | `deep_research` | `topic`, optional `rounds` |
| `create` | `create_deck` | `topic`; optional `pages`, `aspect`, `language`, `style`, `template`, `resolution`, `materialIds`, `fast`, `research`, `researchDoc`, `rounds` |
| `outline` | `create_outline` | same planning inputs as `create` |
| `revise-outline` | `revise_outline` | `projectId` plus `instruction` or `pages` |
| `inspiration` | `rank_inspiration` | `topic` or `outlineTitles` |
| `render` | `render_deck` | `projectId` |
| `list` | `list_projects` | none |
| `get` | `get_project` | `projectId`, optional `includeChat` |
| `templates` | `list_templates` | optional `categoryId` |
| `edit` | `edit_deck` | `projectId`, `instruction`; optional `slideIndex`, `materialIds` |
| `restyle` | `restyle_deck` | `projectId`; optional `template`, `style`, `materialIds`, `redraw` |
| `slide` | `manage_slide` | `projectId`, `action`; index fields depend on action |
| `regenerate` | `regenerate_slide` | `projectId`, `index`, optional `instruction` |
| `upload-material` | `upload_material` | absolute or workspace-relative `filePath` |
| `upload-slide` | `upload_slide_image` | `projectId`, `index`, PNG `imagePath`, optional `title` |
| `mark-edit` | `mark_edit_slide` | `projectId`, `index`, annotated PNG `annotatedImagePath`, optional `note` |
| `export` | `export_deck` | `projectId`, `format` (`pdf` or `pptx`) |

## Examples

Create a researched six-slide deck:

```bash
node <skill-dir>/scripts/ppt-anything.mjs create --json '{
  "topic": "2026 humanoid robot market",
  "pages": 6,
  "research": true,
  "language": "zh-CN"
}'
```

Create and review an outline before rendering:

```bash
node <skill-dir>/scripts/ppt-anything.mjs outline --json '{
  "topic": "Product launch plan",
  "pages": 8,
  "aspect": "16:9"
}'

node <skill-dir>/scripts/ppt-anything.mjs revise-outline --json '{
  "projectId": "PROJECT_ID",
  "instruction": "Move the market proof before the product roadmap"
}'

node <skill-dir>/scripts/ppt-anything.mjs render \
  --json '{"projectId":"PROJECT_ID"}'
```

Open the project in the in-editor Browser:

```bash
node <skill-dir>/scripts/ppt-anything.mjs open \
  --json '{"projectId":"PROJECT_ID"}'
```

Use the returned `url` as the Browser navigation target. The `open` command
starts the app but intentionally does not control a particular browser client;
the Codex in-app Browser capability performs that final navigation.

Edit, mark-edit, then export:

```bash
node <skill-dir>/scripts/ppt-anything.mjs edit --json '{
  "projectId": "PROJECT_ID",
  "instruction": "Make slide 2 warmer and simplify its comparison chart",
  "slideIndex": 2
}'

node <skill-dir>/scripts/ppt-anything.mjs mark-edit --json '{
  "projectId": "PROJECT_ID",
  "index": 2,
  "annotatedImagePath": "/absolute/path/slide-2-marked.png",
  "note": "Follow the red annotations"
}'

node <skill-dir>/scripts/ppt-anything.mjs export \
  --json '{"projectId":"PROJECT_ID","format":"pptx"}'
```

## Environment

- `PPT_ANYTHING_URL`: API and Browser base URL; default
  `http://127.0.0.1:4311`.
- `PPT_ANYTHING_HOME`: source checkout. Resolution also checks
  `~/plugins/ppt-anything`, the skill's containing repo, and the current
  directory.
- `PPT_ANYTHING_LOG`: auto-start log; default is the operating system temp
  directory.

The CLI uses only Node built-ins plus platform `fetch`, `FormData`, and `Blob`.
It does not import the MCP SDK.
