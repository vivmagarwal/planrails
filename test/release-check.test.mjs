/** The release checks around `npm publish`: every refusal, and the wait for a staged publish to become visible. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reasonsNotToPublish, waitUntilVisible } from "../scripts/release-check.mjs";

const base = {
  name: "planrails", version: "0.1.2",
  changelog: "# Changelog\n\n## 0.1.2 — 2026-09-12\n\n- x\n\n## 0.1.1 — 2026-09-12\n",
  gitStatus: "## main...origin/main\n",
  registryVersionTime: null,
};

describe("release-check before", () => {
  it("lets a clean, pushed, documented, unpublished version through", () => {
    assert.deepEqual(reasonsNotToPublish(base), []);
  });
  it("refuses a version the registry already serves, and says how to bump", () => {
    const r = reasonsNotToPublish({ ...base, registryVersionTime: "2026-09-12T07:29:05.425Z" });
    assert.equal(r.length, 1);
    assert.match(r[0], /already on the registry \(published 2026-09-12T07:29:05\.425Z\).*npm version patch/);
  });
  it("refuses without a CHANGELOG entry for the version", () => {
    const r = reasonsNotToPublish({ ...base, version: "0.1.3" });
    assert.equal(r.length, 1);
    assert.match(r[0], /CHANGELOG\.md has no "## 0\.1\.3"/);
  });
  it("does not mistake a 0.1.10 entry for 0.1.1", () => {
    const r = reasonsNotToPublish({ ...base, version: "0.1.1", changelog: "## 0.1.10 — later\n" });
    assert.equal(r.length, 1);
    assert.match(r[0], /no "## 0\.1\.1"/);
  });
  it("refuses a dirty tree and an unpushed HEAD, each with its own sentence", () => {
    const r = reasonsNotToPublish({ ...base, gitStatus: "## main...origin/main [ahead 2]\n M src/x.mjs\n?? new.txt\n" });
    assert.equal(r.length, 2);
    assert.match(r[0], /2 uncommitted change\(s\)/);
    assert.match(r[1], /not pushed \(ahead 2\)/);
  });
  it("refuses a detached HEAD", () => {
    const r = reasonsNotToPublish({ ...base, gitStatus: "## HEAD (no branch)\n" });
    assert.equal(r.length, 1);
    assert.match(r[0], /detached/);
  });
});

describe("release-check after", () => {
  it("polls until the registry serves the version, sleeping the interval between tries", async () => {
    let calls = 0;
    const slept = [];
    const ms = await waitUntilVisible({ name: "planrails", version: "0.1.2", view: () => (++calls >= 3 ? "0.1.2" : null), sleep: async (m) => { slept.push(m); }, everyMs: 7 });
    assert.equal(calls, 3);
    assert.deepEqual(slept, [7, 7]);
    assert.ok(ms >= 0);
  });
  it("gives up after the timeout and says not to publish again", async () => {
    let now = 0;
    const realNow = Date.now;
    Date.now = () => now;
    try {
      await assert.rejects(
        waitUntilVisible({ name: "planrails", version: "0.1.2", view: () => null, sleep: async () => { now += 1000; }, timeoutMs: 3000, everyMs: 1000 }),
        /still not served by the registry after 3 s.*do NOT run npm publish again/,
      );
    } finally { Date.now = realNow; }
  });
});
