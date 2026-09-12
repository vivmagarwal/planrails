import { test } from "node:test";
import assert from "node:assert/strict";
import { box, plan, planTry } from "./_helpers.mjs";

test("planrails issue builds a prefilled GitHub issue URL with the environment, and refuses an unknown kind", () => {
  const root = box("planrails-issue-");
  const out = plan(root, "issue", "bug", "--print", "--title", "task done crashed on an old state.json");
  const url = out.trim().split("\n").pop();
  assert.ok(url.startsWith("https://github.com/vivmagarwal/planrails/issues/new?"), url);
  const q = new URL(url).searchParams;
  assert.equal(q.get("template"), "bug.yml");
  assert.equal(q.get("title"), "task done crashed on an old state.json");
  assert.match(q.get("environment"), /planrails \d+\.\d+\.\d+\nnode v/);
  assert.match(q.get("environment"), /plans: 0/);
  assert.equal(planTry(root, "issue", "nope", "--print").status, 2);
});
