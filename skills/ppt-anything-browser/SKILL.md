---
name: ppt-anything-browser
description: Compatibility entry point for opening and operating PPT Anything in Codex's in-editor Browser. Use when the user asks to open, launch, preview, view, play, inspect, or directly manipulate PPT Anything or a deck without leaving Codex.
---

# PPT Anything Browser

This specialized skill remains for compatibility. The canonical
`ppt-anything` sibling skill owns the full workflow and portable CLI.

1. Call `open_ppt_anything` when the MCP tool is available. Otherwise run
   `node ../ppt-anything/scripts/ppt-anything.mjs open --json '<input>'` from
   this skill directory. Pass `projectId` when the user named a deck;
   otherwise omit it for the create workspace.
2. Navigate the returned resource link in the Codex in-editor Browser. Do not
   stop after printing the URL and do not ask the user to open it manually.
3. Keep the Browser visible and operate the requested UI flow. Use direct MCP
   MCP tools or the canonical skill CLI for deterministic data mutations, then
   reload or inspect the Browser result.
4. Verify the visible outcome before reporting completion.

Use the Browser for Play/presentation mode, slide navigation, direct on-canvas
marking, layout inspection, and other visual interactions. If the Browser
capability is unavailable in the current Codex surface, return the resource
link and explain that limitation rather than claiming it opened.
