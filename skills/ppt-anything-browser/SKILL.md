---
name: ppt-anything-browser
description: Compatibility entry point for opening and operating PPT Anything in Codex's in-editor Browser, including scenario selection, Design Files, brand systems, decks, and Play mode. Use when the user asks to open, launch, preview, view, play, inspect, or directly manipulate PPT Anything or a deck without leaving Codex.
---

# PPT Anything Browser

This specialized skill remains for compatibility. The canonical
`ppt-anything` sibling skill owns the full workflow and portable CLI.

1. Call `open_ppt_anything` when the MCP tool is available. Otherwise run
   `node ../ppt-anything/scripts/ppt-anything.mjs open --json '<input>'` from
   this skill directory. Pass `projectId` when the user named a deck;
   otherwise omit it for the create workspace.
   Use `view:"scenarios"` for the 24-workflow catalog,
   `view:"design-files"` plus `projectId` and optional `filePath` for project
   files, or `view:"brand-system"` plus `projectId` for the brand editor.
2. Navigate the returned resource link in the Codex in-editor Browser. Do not
   stop after printing the URL and do not ask the user to open it manually.
3. For a new deck, always open and verify the home/create screen before any
   research, outline, or rendering call. Submit the topic in that UI so it
   creates a durable project and opens the guided workspace. Use
   `start_project` / CLI `start-project` only if UI submission needs a
   deterministic fallback, then navigate its project resource immediately.
4. Keep the Browser visible and operate the checkpoints in order: clarify,
   outline review, inspiration/style selection, render, deck review. Do not run
   the entire workflow invisibly in the Codex conversation.
5. Use direct MCP tools or the canonical skill CLI for deterministic recovery
   and mutations, then reload or inspect the Browser result.
6. Verify the visible outcome before reporting completion.

Use the Browser for scenario/slot selection, `@` Design File references, brand
system editing, Play from the current slide or the beginning, dual-window
presenter mode, speaker notes editing/AI generation, slide navigation, direct on-canvas
marking, layout inspection, and other visual interactions. If the Browser
capability is unavailable in the current Codex surface, return the resource
link and explain that limitation rather than claiming it opened.
