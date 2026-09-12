#!/usr/bin/env node
/**
 * BLACK-BOX TRIAL of the planning system — three fresh `claude -p` sessions in
 * a separate project that holds a COPY of src/plan + scripts/hooks.
 *
 * Why separate: Claude Code loads CLAUDE.md from parent directories, so a trial
 * under this repo's .tmp/ would inherit this repo's doctrine and its plans
 * block. The trial project is a sibling directory (see the plan's log).
 *
 *   node scripts/trial/run.mjs /Users/vivmagarwal/Work/plan-system-trial [--model sonnet]
 *
 * Run 1 plans (the /plan skill). Run 2 executes ONE task. Run 3 is a fresh
 * session that must resume from the brief and do ONE more task without
 * redoing the first. Snapshots after each run go to <trial>/.tmp/trial/, and
 * check.mjs turns them into a verdict. Each session sees none of the others —
 * that is the point.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const trial = process.argv[2];
if (!trial || !existsSync(join(trial, "src/plan/plan.mjs"))) { console.error("usage: run.mjs <trial-dir with src/plan installed>"); process.exit(2); }
const model = process.argv.includes("--model") ? process.argv[process.argv.indexOf("--model") + 1] : "sonnet";
if (!existsSync(join(trial, ".claude", "settings.json"))) { console.error("the trial has no .claude/settings.json — run npx planrails hooks install there first"); process.exit(2); }
const out = join(trial, ".tmp", "trial");
mkdirSync(out, { recursive: true });
const report = { trial, model, runs: [], idempotency: {} };

function claude(name, prompt, maxTurns) {
  const t0 = Date.now();
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "json", "--model", model, "--max-turns", String(maxTurns), "--dangerously-skip-permissions"],
    { cwd: trial, encoding: "utf8", timeout: 900_000, maxBuffer: 64 * 1024 * 1024 });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch { /* keep raw */ }
  const rec = { name, exit: r.status, ms: Date.now() - t0, session_id: parsed?.session_id || null, num_turns: parsed?.num_turns ?? null, is_error: Boolean(parsed?.is_error), subtype: parsed?.subtype || null, result: String(parsed?.result ?? r.stdout).slice(0, 4000), stderr: (r.stderr || "").slice(0, 2000) };
  writeFileSync(join(out, `${name}.json`), JSON.stringify({ ...rec, raw: parsed }, null, 2));
  report.runs.push(rec);
  console.log(`${name}: exit ${rec.exit}, ${rec.num_turns} turns, ${Math.round(rec.ms / 1000)} s`);
  return rec;
}
function planIds() { const d = join(trial, ".project-management", "plans"); return existsSync(d) ? readdirSync(d).filter((x) => existsSync(join(d, x, "state.json"))) : []; }
function snapshot(name) {
  const ids = planIds();
  const snap = { name, plans: {} };
  for (const id of ids) {
    const d = join(trial, ".project-management", "plans", id);
    const state = JSON.parse(readFileSync(join(d, "state.json"), "utf8"));
    const lines = (f) => existsSync(join(d, f)) ? readFileSync(join(d, f), "utf8").split("\n").filter(Boolean) : [];
    snap.plans[id] = {
      status: state.status,
      tasks: state.tasks.map((t) => ({ id: t.id, status: t.status, evidence: t.evidence })),
      log: lines("log.jsonl").length,
      lastNext: lines("log.jsonl").length ? JSON.parse(lines("log.jsonl").at(-1)).next : null,
      gateRuns: lines("gate-runs.jsonl").map((l) => JSON.parse(l)).filter((r) => r.kind === "run" && r.result === "pass").length,
      learnings: lines("learnings.jsonl").length,
    };
  }
  snap.claudeMd = existsSync(join(trial, "CLAUDE.md")) ? readFileSync(join(trial, "CLAUDE.md"), "utf8") : "";
  writeFileSync(join(out, `snapshot-${name}.json`), JSON.stringify(snap, null, 2));
  return snap;
}
const RAW_PLAN = "Build a tiny command-line greeter in this project: greet.mjs prints \"Hello, <name>!\" for its first argument and \"Hello, world!\" with none; test.mjs runs both cases with node:child_process and exits 1 on any mismatch; README.md documents usage. Done means `node test.mjs` exits 0 and README.md exists. Keep it to 3–4 tasks. Do not ask me any questions — decide everything yourself and record each choice with `plan decide`.";

claude("run1-plan", `Use the /plan skill (Skill tool, name "plan") with this raw plan, and do NOT do the engineering — only produce and activate the plan: ${RAW_PLAN}`, 60);
snapshot("after-run1");
claude("run2-execute", "Continue the active plan in this project (its brief is in your context; if not, run `npx planrails brief`). Start the first todo task, do it, log it with `plan log`, then close it with `npx planrails task done <id> <T> --answer \"C4: …\" …` — it runs the gate and needs every manual condition answered (see `plan task check`). Stop after ONE task.", 60);
const s2 = snapshot("after-run2");
claude("run3-resume", "This is a fresh session. First, quote verbatim the RESUME line of the plan brief that was injected into your context (if none was injected, say NONE). Then continue the active plan for exactly ONE more task, as the plan says: task start, do the work, plan log, task done with every condition answered (--answer). Do not redo any task that is already done.", 60);
snapshot("after-run3");

// Idempotency: install twice, activate again, validate.
const settingsPath = join(trial, ".claude", "settings.json");
const before = readFileSync(settingsPath, "utf8");
spawnSync("node", ["src/hooks/install.mjs"], { cwd: trial, encoding: "utf8" });
report.idempotency.installUnchanged = readFileSync(settingsPath, "utf8") === before;
const md0 = readFileSync(join(trial, "CLAUDE.md"), "utf8");
for (const id of planIds()) {
  const st = JSON.parse(readFileSync(join(trial, ".project-management/plans", id, "state.json"), "utf8"));
  if (st.status === "active") {
    const r = spawnSync("node", ["src/plan/plan.mjs", "activate", id], { cwd: trial, encoding: "utf8" });
    report.idempotency.activateAgain = { id, exit: r.status, saidAlready: /already active/.test(r.stdout) };
  }
}
report.idempotency.claudeMdUnchangedAfterReactivate = readFileSync(join(trial, "CLAUDE.md"), "utf8") === md0;
const v = spawnSync("node", ["src/plan/plan.mjs", "validate", "--all"], { cwd: trial, encoding: "utf8" });
report.idempotency.validateExit = v.status;
report.idempotency.validateOut = (v.stdout + v.stderr).slice(0, 1500);
report.finishedAt = new Date().toISOString();
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(`report → ${join(out, "report.json")}`);
void s2;
