import test from "node:test";
import assert from "node:assert/strict";
import { validateSubmitPayload } from "../src/validate";

test("rejects malformed payload with diagnostics", () => {
  const r = validateSubmitPayload({ type: "bogus", context: {}, channel: "ftp" } as any);
  assert.equal(r.ok, false);
  if (!r.ok) {
    const fields = r.errors.map((e) => e.field);
    assert.ok(fields.includes("type"));
    assert.ok(fields.includes("context.summary"));
    assert.ok(fields.includes("channel"));
    assert.ok(fields.includes("channelTarget"));
  }
});

test("rejects invalid callback URL", () => {
  const r = validateSubmitPayload({
    type: "question",
    context: { summary: "hi" },
    channel: "callback",
    channelTarget: "not-a-url",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.field === "channelTarget"));
});

test("accepts valid file payload", () => {
  const r = validateSubmitPayload({
    type: "approval",
    context: { summary: "Approve?", agent: "a", session: "s", links: [{ label: "x", url: "file://x" }] },
    channel: "file",
    channelTarget: "/tmp/out.json",
    priority: 5,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.type, "approval");
    assert.equal(r.value.channel, "file");
  }
});