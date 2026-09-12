#!/usr/bin/env node
/**
 * The verdict on a black-box trial produced by run.mjs. Reads the snapshots and
 * asserts the RAILS held — not that the model made good choices.
 *
 *   node scripts/trial/check.mjs <trial-dir>      # exit 0 = every assertion holds
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const trial = process.argv[2];
const fail = (m) => { console.log(`FAIL ${m}`); process.exitCode = 1; };
const ok = (m) => console.log(`ok   ${m}`);
if (!trial || !existsSync(trial)) { console.log(`FAIL trial directory not found: ${trial}`); process.exit(1); }
const out = join(trial, ".tmp", "trial");
const rd = (f) => JSON.parse(readFileSync(join(out, f), "utf8"));
for (const f of ["report.json", "snapshot-after-run1.json", "snapshot-after-run2.json", "snapshot-after-run3.json"]) if (!existsSync(join(out, f))) { console.log(`FAIL missing ${f} — run scripts/trial/run.mjs first`); process.exit(1); }
const report = rd("report.json"), s1 = rd("snapshot-after-run1.json"), s2 = rd("snapshot-after-run2.json"), s3 = rd("snapshot-after-run3.json");

const ids = Object.keys(s1.plans);
ids.length === 1 ? ok(`run 1 created exactly one plan: ${ids[0]}`) : fail(`run 1 created ${ids.length} plans`);
const id = ids[0];
if (!id) process.exit(1);
s1.plans[id].status === "active" ? ok("run 1 activated it") : fail(`plan status after run 1 is ${s1.plans[id].status}`);
s1.claudeMd.includes(`**${id}**`) ? ok("CLAUDE.md block lists it") : fail("CLAUDE.md block does not list the plan");
s1.plans[id].tasks.length >= 2 ? ok(`${s1.plans[id].tasks.length} tasks`) : fail("fewer than 2 tasks");

const done2 = s2.plans[id].tasks.filter((t) => t.status === "done");
done2.length >= 1 ? ok(`run 2 closed ${done2.length} task(s): ${done2.map((t) => t.id).join(", ")}`) : fail("run 2 closed no task");
done2.every((t) => t.evidence && (t.evidence.kind === "gate" || t.evidence.kind === "manual")) ? ok("every done task carries evidence") : fail("a done task has no evidence");
done2.some((t) => t.evidence?.kind === "gate") ? ok("at least one task was closed by a GATE run, not by hand") : fail("no task was closed by a gate run — every close was manual");
s2.plans[id].gateRuns >= 1 ? ok(`${s2.plans[id].gateRuns} passing gate run(s) recorded`) : fail("no passing gate run recorded");
s2.plans[id].log > s1.plans[id].log ? ok("run 2 logged progress") : fail("run 2 did not log");

// Run 3 must resume, not redo: evidence of run-2's done tasks is byte-identical afterwards.
for (const t of done2) {
  const t3 = s3.plans[id].tasks.find((x) => x.id === t.id);
  JSON.stringify(t3?.evidence) === JSON.stringify(t.evidence) && t3?.status === "done"
    ? ok(`${t.id}'s evidence from run 2 is unchanged after run 3 (${t.evidence.kind === "gate" ? t.evidence.runId : "manual"})`)
    : fail(`${t.id} changed in run 3: ${JSON.stringify(t3)}`);
}
const done3 = s3.plans[id].tasks.filter((t) => t.status === "done");
done3.length > done2.length ? ok(`run 3 closed ${done3.length - done2.length} more task(s)`) : fail("run 3 closed no further task");
s3.plans[id].log > s2.plans[id].log ? ok("run 3 logged progress") : fail("run 3 did not log");
// Did run 3 RESUME from the brief rather than start over? Two checks, one behavioural
// and one textual. Behavioural: the task run 3 closed is the task run 2's RESUME line
// named. Textual: the session transcript (not the JSON `result`, which holds only the
// FINAL message — the first version of this check read that and called a correct resume
// a failure) contains the RESUME line's opening words.
const run3 = report.runs.find((r) => r.name === "run3-resume");
const lastNext2 = String(s2.plans[id].lastNext || "");
const named = lastNext2.match(/\bT\d+\b/)?.[0] || null;
const newlyDone = done3.filter((t) => !done2.some((d) => d.id === t.id)).map((t) => t.id);
named && newlyDone.includes(named)
  ? ok(`run 3 did the task run 2's RESUME line named (${named}), not a redo`)
  : fail(`run 2's RESUME line named ${named}; run 3 closed ${newlyDone.join(", ") || "nothing"}`);
const key = lastNext2.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 5).join(" ");
const slug = "-" + trial.replace(/^\//, "").replace(/[^A-Za-z0-9]/g, "-");
const transcript = run3?.session_id ? join(process.env.HOME || "", ".claude", "projects", slug, `${run3.session_id}.jsonl`) : null;
if (transcript && existsSync(transcript)) {
  const text = readFileSync(transcript, "utf8").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  key && text.includes(key) ? ok(`run 3's transcript quotes the RESUME line ("${key}…")`) : fail(`run 3's transcript never quotes "${key}"`);
} else ok(`(transcript not found at ${transcript} — textual check skipped; the behavioural check above stands)`);

report.idempotency.installUnchanged ? ok("installing the hooks a second time changed nothing") : fail("second install changed settings.json");
report.idempotency.activateAgain?.saidAlready ? ok("activating again says 'already active'") : fail(`activate again: ${JSON.stringify(report.idempotency.activateAgain)}`);
report.idempotency.claudeMdUnchangedAfterReactivate ? ok("CLAUDE.md unchanged by re-activation") : fail("re-activation changed CLAUDE.md");
report.idempotency.validateExit === 0 ? ok("validate --all passes at the end") : fail(`validate --all exit ${report.idempotency.validateExit}: ${report.idempotency.validateOut}`);
const v = spawnSync("node", ["src/plan/plan.mjs", "validate", "--all", "--quiet"], { cwd: trial, encoding: "utf8" });
v.status === 0 ? ok("validate --all passes NOW") : fail(`validate --all fails now: ${v.stdout}${v.stderr}`);
for (const r of report.runs) r.exit === 0 && !r.is_error ? ok(`${r.name}: exit 0, ${r.num_turns} turns, ${Math.round(r.ms / 1000)} s`) : fail(`${r.name}: exit ${r.exit}${r.is_error ? ` is_error (${r.subtype})` : ""} — ${r.stderr.slice(0, 200)}`);
console.log(process.exitCode ? "\ntrial: FAILED" : "\ntrial: every rail held");
