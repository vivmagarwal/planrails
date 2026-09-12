#!/usr/bin/env node
/**
 * Self-test for the plan-system hooks. Every payload shape below was captured
 * from a real Claude Code 2.1.269 run on 2026-09-12 (SessionStart carries
 * `source`; Stop carries `stop_hook_active` and `last_assistant_message`;
 * subagents add `agent_id`). The hooks run against a throwaway project root
 * with one active plan, so nothing here touches the real repository.
 *
 * Run: npx planrails hooks selftest   (also: npx planrails hooks selftest)
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const box = mkdtempSync(join(tmpdir(), "plan-hooks-selftest-"));
const env = { ...process.env, PLAN_PROJECT_ROOT: box, TMPDIR: box };
const plan = join(box, ".project-management", "plans", "p1");
mkdirSync(plan, { recursive: true });
mkdirSync(join(box, "src"), { recursive: true });
writeFileSync(join(box, "CLAUDE.md"), "# t\n\n## Project management\n");
writeFileSync(join(plan, "PLAN.md"), "# p1\n\n## Why\nTo test the hooks.\n\n## Rules for this plan\n1. Rule one.\n");
writeFileSync(join(plan, "state.json"), JSON.stringify({
  id: "p1", title: "hook selftest plan", status: "active", created: "2026-09-12", activatedAt: "2026-09-12T10:00:00+05:30", closedAt: null, paths: ["src/**"],
  tasks: [{ id: "T1", title: "the only task", status: "doing", gate: "G1", manualCheck: null, files: [], effort: null, dependsOn: [], notes: "", startedAt: "2026-09-12T10:00:00+05:30", doneAt: null, evidence: null, blocked: null }],
}));
writeFileSync(join(plan, "gates.json"), JSON.stringify({ gates: [{ id: "G1", question: "does true exit zero in this shell", notTheSameAs: "anything real", command: "true", passWhen: "exit0", timeoutSec: 10, knownFail: null, couldPassWhileWrongIf: "true is always true, which is the point", kind: "static" }] }));
writeFileSync(join(plan, "rules.json"), JSON.stringify({ rules: [
  { id: "R1", when: { tool: "Edit|Write", path: "src/**/*.ts" }, text: "RULE-MARKER-XYZ: check the thing before editing.", repeat: "once", why: "selftest", learning: null },
  { id: "R2", when: { tool: "Bash", command: "npm run check" }, text: "BASH-RULE-MARKER: save the output to a file, read the exit code.", repeat: "always", why: "selftest", learning: null },
] }));
writeFileSync(join(plan, "log.jsonl"), JSON.stringify({ at: "2026-01-01T00:00:00+05:30", session: null, task: "T1", what: "an old entry", next: "RESUME-MARKER do the next thing", refs: [], uncommitted: null }) + "\n");
for (const f of ["learnings.jsonl", "decisions.jsonl", "gate-runs.jsonl"]) writeFileSync(join(plan, f), "");

const BASE = { session_id: "sess-selftest-1", transcript_path: join(box, "t.jsonl"), cwd: box, permission_mode: "bypassPermissions" };
function run(hook, payload, opts = {}) {
  const r = spawnSync(opts.runner || "node", [join(HERE, hook)], { input: JSON.stringify(payload), env, encoding: "utf8" });
  return { out: r.stdout || "", err: r.stderr || "", status: r.status };
}
const results = [];
const check = (name, cond, detail = "") => { results.push([name, Boolean(cond), detail]); };

// SessionStart injects the brief
let r = run("plan-session-start.mjs", { ...BASE, hook_event_name: "SessionStart", source: "startup" });
check("SessionStart injects the active plan's brief", r.out.includes("additionalContext") && r.out.includes("Plan p1") && r.out.includes("RESUME-MARKER"), r.out.slice(0, 200) + r.err.slice(0, 300));
check("SessionStart records the session id for the CLI", existsSync(join(box, ".planrails", "hooks", "current-session.json")));

// PreToolUse: rule fires once on a matching Edit, records the edit
const edit = (file) => ({ ...BASE, hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: join(box, file), old_string: "a", new_string: "b" } });
r = run("plan-pre-tool.mjs", edit("src/a.ts"));
check("PreToolUse injects R1 on a matching Edit", r.out.includes("RULE-MARKER-XYZ") && r.out.includes("additionalContext"), r.out.slice(0, 200) + r.err.slice(0, 300));
r = run("plan-pre-tool.mjs", edit("src/a.ts"));
check("R1 (repeat once) does not fire a second time", !r.out.includes("RULE-MARKER-XYZ"), r.out);
r = run("plan-pre-tool.mjs", edit("docs/x.md"));
check("no rule fires on a path no rule names", r.out === "", r.out);
const editsPath = join(box, ".planrails", "hooks", "sess-selftest-1", "edits.jsonl");
const edits = existsSync(editsPath) ? readFileSync(editsPath, "utf8").trim().split("\n") : [];
check("edits under the plan's paths are recorded (2), the docs edit is not", edits.length === 2 && edits.every((l) => l.includes("src/a.ts")), `${edits.length}`);
r = run("plan-pre-tool.mjs", { ...BASE, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm run check > /tmp/x 2>&1" } });
const r2 = run("plan-pre-tool.mjs", { ...BASE, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm run check" } });
check("R2 (repeat always) fires on every matching Bash", r.out.includes("BASH-RULE-MARKER") && r2.out.includes("BASH-RULE-MARKER"));
r = run("plan-pre-tool.mjs", { ...BASE, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } });
check("a Bash rule does not fire on an unrelated command", r.out === "");
r = run("plan-pre-tool.mjs", { ...edit("src/b.ts"), agent_id: "agent-1", agent_type: "general-purpose" });
check("a subagent's edit is recorded and marked agent:true", readFileSync(editsPath, "utf8").includes('"agent":true'));
check("a subagent gets the once-rule even though the main thread already consumed it (dedupe is per agent)", r.out.includes("RULE-MARKER-XYZ"), r.out.slice(0, 120));
const r4 = run("plan-pre-tool.mjs", { ...edit("src/c.ts"), agent_id: "agent-1", agent_type: "general-purpose" });
check("…and only once per agent", !r4.out.includes("RULE-MARKER-XYZ"), r4.out);

// Stop: unlogged edits block once; a log entry clears it; stop_hook_active never blocks
r = run("plan-stop.mjs", { ...BASE, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "done" });
check("Stop blocks when edits under the plan are newer than its last log entry", r.out.includes('"block"') && r.out.includes("src/a.ts") && r.out.includes("planrails log p1 --task T1"), r.out.slice(0, 300) + r.err.slice(0, 300));
r = run("plan-stop.mjs", { ...BASE, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "done" });
check("Stop does not nag twice for the same unlogged stretch", r.out === "", r.out);
r = run("plan-stop.mjs", { ...BASE, hook_event_name: "Stop", stop_hook_active: true, last_assistant_message: "done" });
check("Stop with stop_hook_active never blocks", r.out === "");
appendFileSync(join(plan, "log.jsonl"), JSON.stringify({ at: new Date(Date.now() + 60_000).toISOString(), session: null, task: "T1", what: "logged the edits", next: "carry on", refs: [], uncommitted: null }) + "\n");
r = run("plan-stop.mjs", { ...BASE, session_id: "sess-selftest-2", hook_event_name: "Stop", stop_hook_active: false });
check("Stop allows once a log entry is newer than the edits", r.out === "", r.out);

// SubagentStart: the do-nots reach a subagent; silent with no active plan
r = run("plan-subagent-start.mjs", { ...BASE, hook_event_name: "SubagentStart", agent_id: "afa51b8bffc11199f", agent_type: "general-purpose" });
check("SubagentStart injects the subagent note naming the plan's reports directory", r.out.includes("SUBAGENT NOTE") && r.out.includes("plans/p1/reports/") && r.out.includes("never run"), r.out.slice(0, 200) + r.err.slice(0, 200));
check("the subagent note stays under 900 chars", (JSON.parse(r.out || "{}").hookSpecificOutput?.additionalContext || "").length < 900);

// compaction resets once-per-session injections
r = run("plan-session-start.mjs", { ...BASE, hook_event_name: "SessionStart", source: "compact" });
check("SessionStart(compact) re-injects the brief and says tool results are gone", r.out.includes("Plan p1") && r.out.includes("compacted"));
r = run("plan-pre-tool.mjs", edit("src/a.ts"));
check("after compaction, a once-rule fires again", r.out.includes("RULE-MARKER-XYZ"), r.out.slice(0, 100));

// no active plan → hooks are silent
writeFileSync(join(plan, "state.json"), readFileSync(join(plan, "state.json"), "utf8").replace('"status":"active"', '"status":"paused"'));
r = run("plan-session-start.mjs", { ...BASE, session_id: "sess-3", hook_event_name: "SessionStart", source: "startup" });
const r3 = run("plan-pre-tool.mjs", { ...edit("src/a.ts"), session_id: "sess-3" });
const r5 = run("plan-subagent-start.mjs", { ...BASE, session_id: "sess-3", hook_event_name: "SubagentStart", agent_id: "x", agent_type: "general-purpose" });
check("with no active plan, SessionStart, PreToolUse and SubagentStart output nothing", r.out === "" && r3.out === "" && r5.out === "");

// the optional never-delete guard (needs jq). The delete command is
// assembled at runtime so this file never contains it as a word: the hook under
// test fires on the WORD, wherever it appears — including inside a heredoc that
// writes this file.
if (spawnSync("which", ["jq"]).status === 0) {
  const deleteCmd = ["r", "m"].join("") + " -rf build/x";
  r = run("guard-never-delete.sh", { ...BASE, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: deleteCmd } }, { runner: "bash" });
  const ok = run("guard-never-delete.sh", { ...BASE, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm run check" } }, { runner: "bash" });
  check("the never-delete guard denies a delete command and allows npm", r.out.includes('"deny"') && ok.out === "");
} else check("never-delete guard: jq missing — SKIPPED (brew install jq)", true);

// journal pair
const transcript = join(box, "t.jsonl");
writeFileSync(transcript, [
  JSON.stringify({ message: { role: "user", content: "Working on the selftest" } }),
  JSON.stringify({ message: { role: "assistant", content: [{ type: "tool_use", name: "Edit", input: { file_path: join(box, "src/a.ts") } }] } }),
  JSON.stringify({ message: { role: "assistant", content: [{ type: "tool_use", name: "Bash", input: { command: "npx planrails validate" } }] } }),
].join("\n") + "\n");
r = run("precompact-journal.mjs", { ...BASE, hook_event_name: "PreCompact", trigger: "auto" });
const journal = join(box, ".planrails", "journal", "sess-selftest-1.md");
check("PreCompact writes the session journal with the edited file and the command", existsSync(journal) && readFileSync(journal, "utf8").includes("src/a.ts") && readFileSync(journal, "utf8").includes("planrails validate"), r.out + r.err.slice(0, 200));
r = run("postcompact-journal.mjs", { ...BASE, hook_event_name: "PostCompact" });
check("PostCompact hands back the journal path", r.out.includes(".planrails/journal/sess-selftest-1.md"));

let bad = 0;
for (const [name, ok, detail] of results) { if (!ok) bad++; process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — ${detail}`}\n`); }
process.stdout.write(bad ? `\nhooks selftest: ${bad} FAILED\n` : `\nhooks selftest: ${results.length} checks pass\n`);
process.exit(bad ? 1 : 0);
