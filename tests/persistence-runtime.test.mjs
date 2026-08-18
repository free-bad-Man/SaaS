import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLocalUploadStorage } from "../platform/local-storage.mjs";

test("stores uploads atomically and removes raw input after processing", async () => {
  const root = await mkdtemp(join(tmpdir(), "verdict-uploads-"));
  try {
    const storage = createLocalUploadStorage(root);
    await storage.put("uploads/project/job/source.json", "{\"event\":true}");
    const object = await storage.get("uploads/project/job/source.json");
    assert.equal(await object?.text(), "{\"event\":true}");
    await storage.delete("uploads/project/job/source.json");
    assert.equal(await storage.get("uploads/project/job/source.json"), null);
    await assert.rejects(storage.put("../outside.txt", "blocked"), /Invalid upload storage key/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
