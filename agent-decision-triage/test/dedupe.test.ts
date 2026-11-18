import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { TriageDb } from "../src/db";
import { submitItem, listQueue } from "../src/inbox";
import type { SubmitItem } from "../src/types";

function tmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-"));
  return { dir, db: new TriageDb({ dbPath: path.join(dir, "t.db") }) };
}

test("dedupes/links duplicate clarification questions across sessions", () => {
  const { db } = tmpDb();
  const base = (session: string): SubmitItem => ({
    type: "question",
    context: { summary: "Should I use Redis or in-memory cache for the session store?", session, agent: session },
    channel: "file",
    channelTarget: `/tmp/${session}.json`,
  });
  const a = submitItem(db, base("s1"));
  const b = submitItem(db, base("s2"));
  assert.equal(a.deduped, false);
  assert.equal(b.deduped, true);
  assert.equal(b.item.linkedTo, a.item.id);
  const queue = listQueue(db);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, a.item.id);
  assert.equal(queue[0].duplicates.length, 1);
  assert.equal(queue[0].duplicates[0].id, b.item.id);
  db.close();
});