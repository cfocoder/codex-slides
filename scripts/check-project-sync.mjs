#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const deckView = read("src/components/DeckView.tsx");
assert.match(deckView, /\/api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/runs/);
assert.match(deckView, /setInterval\(refresh, 1500\)/);
assert.match(deckView, /window\.addEventListener\("focus", refresh\)/);
assert.match(deckView, /document\.addEventListener\("visibilitychange", onVisibility\)/);
assert.match(deckView, /setSlides\([\s\S]*reconcileProjectSlides/);
assert.match(deckView, /latest\.conversations/);

const runRoute = read("src/app/api/projects/[id]/runs/route.ts");
assert.match(runRoute, /ensureProjectRun\(params\.id\)/);
assert.match(runRoute, /activeRun: project\.activeRun \?\? null/);

const projectRuns = read("src/lib/projectRuns.ts");
assert.match(projectRuns, /__pptAnythingProjectRuns/);
assert.match(projectRuns, /project\.activeRun = run/);
assert.match(projectRuns, /saveProject\(project\)/);

const live = process.argv.includes("--live");
if (live) {
  const base = (process.env.PPT_ANYTHING_URL || "http://127.0.0.1:4311").replace(/\/$/, "");
  const projectsResponse = await fetch(`${base}/api/projects`);
  assert.equal(projectsResponse.ok, true, `Project list returned HTTP ${projectsResponse.status}`);
  const projects = (await projectsResponse.json()).projects ?? [];
  const requestedProjectId = process.env.PPT_ANYTHING_PROJECT_ID;
  const candidate = requestedProjectId
    ? projects.find((project) => project.id === requestedProjectId)
    : projects.find((project) => project.rendered > 0);
  assert.ok(candidate, requestedProjectId
    ? `Live sync check could not find project ${requestedProjectId}`
    : "Live sync check needs at least one rendered project");

  const runResponse = await fetch(`${base}/api/projects/${encodeURIComponent(candidate.id)}/runs`, {
    headers: { Accept: "application/json" },
  });
  assert.equal(runResponse.ok, true, `Project run snapshot returned HTTP ${runResponse.status}`);
  const payload = await runResponse.json();
  const project = payload.project;
  assert.equal(project.id, candidate.id);
  const rendered = (project.pages ?? []).filter((page) => page.status === "rendered" && page.image);
  assert.equal(rendered.length, candidate.rendered, "Project list and canonical run snapshot disagree");

  for (const page of rendered) {
    const imageResponse = await fetch(`${base}/api/files/${encodeURIComponent(project.id)}/${encodeURIComponent(page.image)}`);
    assert.equal(imageResponse.ok, true, `Missing persisted image for slide ${page.index}`);
    assert.match(imageResponse.headers.get("content-type") || "", /^image\//);
  }
  process.stdout.write(`Project sync live check passed: ${project.title}, ${rendered.length} persisted slide image(s).\n`);
} else {
  process.stdout.write("Project sync contract passed.\n");
}
