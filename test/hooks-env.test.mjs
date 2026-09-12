/** A hook finds the project through $CLAUDE_PROJECT_DIR, which Claude Code sets for every hook command (measured on 2.1.269). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { box, plan, ROOT } from "./_helpers.mjs";

const hook = (file, root, payload) => {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: root }; delete env.PLAN_PROJECT_ROOT;
  return spawnSync("node", [join(ROOT, "src", "hooks", file)], { input: JSON.stringify(payload), env, encoding: "utf8", cwd: root });
};

test("SessionStart injects the brief of the active plan found via CLAUDE_PROJECT_DIR, and nothing when there is none", () => {
  const root = box("planrails-hookenv-");
  writeFileSync(join(root, "CLAUDE.md"), "# t\n\n## Project management\n");
  const payload = { session_id: "sess-env-1", transcript_path: "/nowhere.jsonl", cwd: root, hook_event_name: "SessionStart", source: "startup" };
  let r = hook("plan-session-start.mjs", root, payload);
  assert.equal(r.status, 0); assert.equal(r.stdout, "");
  plan(root, "new", "envdemo", "--title", "Env demo plan", "--paths", "src/**");
  plan(root, "gate", "add", "envdemo", "--question", "does the shell builtin true exit with zero", "--not", "whether anything real works at all", "--command", "true", "--wrong", "the command is a no-op that always passes", "--known-fail", "false", "--known-fail-why", "false must fail");
  plan(root, "task", "add", "envdemo", "--title", "A task with a proper title", "--gate", "G1");
  plan(root, "activate", "envdemo");
  r = hook("plan-session-start.mjs", root, payload);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.ok(out.hookSpecificOutput.additionalContext.includes("PLAN SYSTEM") && out.hookSpecificOutput.additionalContext.includes("envdemo"));
  assert.ok(out.hookSpecificOutput.additionalContext.includes("JUDGMENT OUTRANKS THE GATE"));
});
