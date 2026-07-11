# PPT Anything capability coverage

This is the release checklist for keeping the product UI, Codex in-editor
Browser, portable Agent Skill CLI, and typed MCP server aligned. A product
capability is not Codex-ready until its row has a Browser path and/or a direct
CLI + MCP operation.

| Product capability | Codex Browser entry | Skill CLI | MCP tool |
|---|---|---|---|
| Open create or project workspace | `open`, view `workspace` | `open` | `open_ppt_anything` |
| Start durable project before clarification | Home composer or `?resume=<id>` | `start-project` | `start_project` |
| Browse 24 scenarios in 6 groups | `open`, view `scenarios` | `scenarios` | `list_scenarios` |
| Preselect a scenario and apply its defaults | `scenarioId` deep link | `create` / `outline` with `scenarioId` | `create_deck` / `create_outline` with `scenarioId` |
| Generate scenario-aware onboarding | Scenario composer | `onboard` with `scenarioId` | `get_onboarding_questions` with `scenarioId` |
| Assign uploaded files to scenario slots | Scenario file-slot controls | `upload-material`, then `materialContexts` | `upload_material`, then `materialContexts` |
| Run scenario-aware sourced research | Research UI | `research` with `scenarioId` | `deep_research` with `scenarioId` |
| Create or revise an outline | Outline workspace | `outline`, `revise-outline` | `create_outline`, `revise_outline` |
| Rank and choose visual inspiration | Inspiration dialog | `inspiration` | `rank_inspiration` |
| Render a confirmed draft | Live project workspace | `render` | `render_deck` |
| Explicit unattended one-call deck | Open result after completion | `create` | `create_deck` |
| List and inspect projects | Home and project workspace | `list` / `get` | `list_projects` / `get_project` |
| Browse templates | Community/template UI | `templates` | `list_templates` |
| Open project Design Files | `open`, view `design-files` | `design-files` | `list_design_files` |
| Read a Design File | Focused `filePath` deep link | `read-design-file` | `read_design_file` |
| Edit an existing text Design File | Design Files editor | `write-design-file` | `write_design_file` |
| Upload into Design Files | Design Files upload | `upload-design-file` | `upload_design_file` |
| Reference Design Files in agent chat | Composer `@` picker | `designFilePaths` on `edit` / `revise-outline` | `designFilePaths` on `edit_deck` / `revise_outline` |
| Inspect structured tool/todo/file activity | Agent activity cards | `open` | `open_ppt_anything` |
| Inspect the brand design system | `open`, view `brand-system` | `get-brand-system` | `get_brand_design_system` |
| Merge brand, color, type, effects, spacing, radii | Brand & Design panel | `set-brand-system` | `update_brand_design_system` |
| Attach persistent logo/product references | Brand assets tray | `upload-material`, then `set-brand-system` | `upload_material`, then `update_brand_design_system` |
| Save brand rules without replacing slides | Brand panel Save | `set-brand-system`, `redraw:false` | `update_brand_design_system`, `redraw:false` |
| Apply brand rules to existing slides | Brand panel Save & redraw | `set-brand-system`, `redraw:true` | `update_brand_design_system`, `redraw:true` |
| Natural-language deck editing | Deck Agent | `edit` | `edit_deck` |
| Queue project-chat turns; edit text/images/files, reorder, delete, or prioritize before serial execution | Deck Agent queue | — interactive Browser session control | — interactive Browser session control |
| Whole-deck template/style restyle | Brand/template UI | `restyle` | `restyle_deck` |
| Add, duplicate, delete, or transition slides | Slide controls | `slide` | `manage_slide` |
| Generate or regenerate one slide | Slide/agent controls | `regenerate` | `regenerate_slide` |
| Upload a reference or finished slide | Material/slide controls | `upload-material` / `upload-slide` | `upload_material` / `upload_slide_image` |
| Apply a marked-up slide edit | Mark canvas | `mark-edit` | `mark_edit_slide` |
| Play, navigate, and inspect visually | Project Play mode | `open` | `open_ppt_anything` |
| Export PDF or PPTX | Export menu | `export` | `export_deck` |

Run `npm run check:skill`, `npm run check:mcp`, `npm run typecheck`,
`npm run check:i18n`, and `npm run build` after changing any row. When a live
Browser session is available, also open all four Browser views and verify their
visible state.
