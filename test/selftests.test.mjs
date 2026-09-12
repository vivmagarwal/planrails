import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, BIN } from "./_helpers.mjs";

test("the CLI selftest passes: every refusal can fire, and valid plans pass", () => {
  assert.match(execFileSync("node", [BIN, "selftest"], { cwd: ROOT, encoding: "utf8" }), /every refusal can fire/);
});
test("the hooks selftest passes on payloads captured from a real Claude Code run", () => {
  assert.match(execFileSync("node", [join(ROOT, "src", "hooks", "selftest.mjs")], { cwd: ROOT, encoding: "utf8" }), /checks pass/);
});
