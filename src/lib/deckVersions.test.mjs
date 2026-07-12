import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("deck versions keep independent slide assets and restore as a new current version", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ppt-anything-versions-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  process.env.PPT_ANYTHING_DATA_DIR = root;

  const [{ saveProject, saveSlideImage, loadProject }, versions] = await Promise.all([
    import(`./store.ts?deck-version-test=${Date.now()}`),
    import(`./deckVersions.ts?deck-version-test=${Date.now()}`),
  ]);
  const project = {
    id: "version-test-project",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      requirement: "Build the first deck",
      aspect: "16:9",
      pages: 1,
      language: "en",
      resolution: "2K",
      engine: "codex",
    },
    agent: "codex",
    title: "First deck",
    outline: [{ title: "First slide", points: ["One"] }],
    pages: [{
      index: 1,
      title: "First slide",
      points: ["One"],
      image: "01.png",
      imageUpdatedAt: 1,
      status: "rendered",
      transition: "fade",
      speakerNotes: "First notes",
    }],
    status: "ready",
    workflow: { stage: "deck" },
  };
  saveSlideImage(project.id, 1, Buffer.from("version-one"));
  saveProject(project);

  const first = await versions.captureDeckVersion(project.id, {
    prompt: "Build the first deck",
    promptSource: "project",
    source: "ai",
  });
  assert.equal(first.version, 1);

  const changed = loadProject(project.id);
  changed.title = "Second deck";
  changed.pages[0].title = "Second slide";
  changed.pages[0].speakerNotes = "Second notes";
  changed.pages[0].imageUpdatedAt = 2;
  saveSlideImage(project.id, 1, Buffer.from("version-two"));
  saveProject(changed);
  const second = await versions.captureDeckVersion(project.id, {
    prompt: "Make a second version",
    promptSource: "message",
    source: "ai",
  });
  assert.equal(second.version, 2);
  assert.equal(versions.readDeckVersion(project.id, first.id).project.title, "First deck");
  assert.equal(
    versions.readDeckVersionImage(project.id, first.id, "01.png").toString(),
    "version-one",
  );

  const restored = await versions.restoreDeckVersion(project.id, first.id);
  assert.equal(restored.project.title, "First deck");
  assert.equal(restored.project.pages[0].transition, "fade");
  assert.equal(restored.project.pages[0].speakerNotes, "First notes");
  assert.equal(fs.readFileSync(path.join(root, "projects", project.id, "01.png"), "utf8"), "version-one");
  assert.equal(restored.version.version, 3);
  assert.equal(restored.version.source, "restore");
  assert.equal(restored.version.restoreFromVersionId, first.id);
  assert.deepEqual(
    versions.listDeckVersions(project.id).map((version) => version.current),
    [false, false, true],
  );
});

