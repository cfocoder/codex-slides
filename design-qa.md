# Design QA — persistent deck workflow and Design Files shell

## Visual sources

- Immersive collapsed workspace: `/var/folders/5j/fb63hyxj11nblszkmd3vfcjm0000gn/T/codex-clipboard-1c7vC9.png` (3024 × 1896)
- Conversation manager and answer metadata reference: `/var/folders/5j/fb63hyxj11nblszkmd3vfcjm0000gn/T/codex-clipboard-H1XMNf.png` (846 × 1400)
- Workflow history during generation: `/var/folders/5j/fb63hyxj11nblszkmd3vfcjm0000gn/T/codex-clipboard-vf1RLL.png` (3024 × 1896)
- Reviewable outline and selected inspiration: `/var/folders/5j/fb63hyxj11nblszkmd3vfcjm0000gn/T/codex-clipboard-aZaO8L.png` (3024 × 1896)
- Shared right-side Design Files preview: `/var/folders/5j/fb63hyxj11nblszkmd3vfcjm0000gn/T/codex-clipboard-OTW23h.png` (3024 × 1896)
- Missing completion/process history: `/var/folders/5j/fb63hyxj11nblszkmd3vfcjm0000gn/T/codex-clipboard-XtikBU.png` (3024 × 1896)
- Persistent Todo reference: `/var/folders/5j/fb63hyxj11nblszkmd3vfcjm0000gn/T/codex-clipboard-qCN1Ky.png` (3024 × 1896)

## Implementation target

- URL: `http://localhost:4311/project/20260711093455-agent-native-design-b8xx`
- Intended viewport: 1920 × 1200 CSS pixels (desktop Chrome), matching the reference aspect and state as closely as possible.
- State: existing ready project with 10 generated pages, restored legacy workflow history, Canvas / Design Files tabs, expanded and collapsed chat states.
- Implementation screenshot path: unavailable — no authorized browser surface could create a rendered capture in this run.

## Comparison evidence and history

1. Source screenshots were captured and their exact dimensions were verified.
2. The implementation was checked against the source states at the component and CSS level: zero-width collapsed grid column, delayed restore control, conversation popover, answer footer, four-step workflow card, persistent process/tool cards, artifact cards, and shared Design Files preview routes.
3. The existing `Agent Native Design` project JSON was inspected. Legacy messages contained an outline card without pages/artifact identity, an unresolved inspiration prompt, and no completion process card. Runtime enrichment now restores those records without duplicating them on later opens.
4. Browser verification attempts:
   - in-app Browser runtime: no browser surface available;
   - `agent-browser`: daemon startup denied by the filesystem sandbox;
   - local Chrome headless: process terminated by the sandbox (exit 134), so no screenshot was written;
   - Computer Use for Google Chrome: not approved for this run.
5. Because there is no implementation screenshot, a combined source-versus-implementation visual comparison and console inspection could not be completed.

## Functional verification

- `pnpm typecheck`: passed.
- `pnpm check:i18n`: passed for both locales.
- `pnpm build`: passed; `/`, `/project/[id]`, chat, file, render, and project API routes compiled.
- `git diff --check`: passed during implementation.
- React review: timer cleanup, semantic buttons/nav/main, stable list identities, image alt text, and typed props were checked; the visible inspiration glyph uses the existing Phosphor icon set.

## Findings

- **[P1] Rendered visual sign-off is blocked.**
  - Location: full deck workspace, collapsed state, chat history cards, and Design Files preview.
  - Evidence: all available browser paths above failed before a screenshot could be captured.
  - Impact: exact spacing, overflow, focus treatment, and responsive fidelity cannot be certified from source/build checks alone.
  - Required follow-up: open the target URL in an authorized Chrome surface, capture expanded/collapsed and Design Files states at 1920 × 1200, compare them beside the supplied references, inspect the console, and correct any P0/P1/P2 mismatch.

## Follow-up polish

- Validate the 640 px and 820 px responsive breakpoints once a browser surface is available.
- Confirm clipboard permission behavior in the user's live Chrome profile.

final result: blocked
