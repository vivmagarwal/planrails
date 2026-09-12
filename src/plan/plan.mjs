#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PLAN CLI — the one writer of a plan's state
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A plan is a directory under .project-management/plans/<id>/ (see
 * docs/PLANNING_GUIDE.md). This tool creates it, records progress into it, runs
 * its gates, and keeps the pointer block in CLAUDE.md in step with it.
 *
 * Why a CLI and not hand edits: every write here is schema-checked, and a task
 * reaches `done` only through `task done`, which RUNS the gate and records the
 * run. A hand edit can still be made — and `validate` (inside `npm run check`)
 * refuses a done task that no recorded run backs. The convenience is the CLI;
 * the rail is the validator.
 *
 *   npx planrails init [--with-never-delete] [--no-install] [--force] [--dry-run]   # set a project up (new or existing)
 *   npx planrails update | uninstall | version | issue [bug|wish|edge] [--title "…"] [--print|--gh]
 *   npx planrails new <id> --title "…" [--paths "a/**,b/**"]
 *   npx planrails list | brief [id] | status <id> | validate [--all] | doctor
 *   npx planrails task add|check|start|done|block|unblock|drop <id> [<T>] …
 *       task add … [--done-when "a task-specific condition"]   task done … --answer "C4: …" … --answer "C7: …"  (one per manual condition; task check lists them)
 *   npx planrails condition list|add|drop <id> [--statement "…"] [<C>]   # plan-level conditions of done
 *   npx planrails review <id> [<T>]      # every done task: evidence + each condition with its answer
 *   npx planrails log <id> --task T --what "…" --next "…" [--refs a,b] [--uncommitted "…"]
 *   npx planrails learn <id> --what "…" --rule "…" --when "…" [--lead] [--enforcement prose|rule|gate|docs --ref X]
 *   npx planrails decide <id> --what "…" --why "…" [--rejected "opt: why; opt: why"] [--by owner|agent]
 *   npx planrails gate list|run|verify|add <id> [<G>|--all] …
 *   npx planrails activate|pause|close|abandon <id> [--confirmed-by-owner]
 *   npx planrails agent-brief <id> <T> [--what "the unit"] [--label x]   # what a subagent gets instead of the plan
 *   npx planrails run <id> [--max-tasks 1] [--model sonnet] [--max-turns 60] [--dry-run]   # one FRESH session per task
 *   npx planrails learnings --search <term> [--plan id]
 *   npx planrails hooks install [--with-never-delete] | uninstall | status | selftest
 *   npx planrails selftest   # prove the validator can fail (runs inside npm run check)
 */
import { parseArgs } from "node:util";
import { existsSync, mkdirSync, writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { FILES, planDir, plansRoot, projectRoot, claudeMdPath, hookStateRoot, claudeSettingsPath, cliName, packageRoot } from "./lib/paths.mjs";
import { SCHEMAS, DEFAULT_DONE_WHEN } from "./lib/schema.mjs";
import {
  loadPlan, listPlanIds, activePlanIds, validatePlan, validatePlanId, withLock, writeJsonAtomic, appendJsonl,
  readJson, nextId, lastRunFor, verifiedFor, taskCounts, evaluateAuto, verifyStatus,
} from "./lib/store.mjs";
import { renderBrief, renderAgentBrief, sectionOf } from "./lib/brief.mjs";
import { JUDGMENT } from "./lib/judgment.mjs";
import { writeBlock, idsInBlock, blockCount, readBlock } from "./lib/claude-md.mjs";
import { nowIso, today, shortStamp, hoursSince } from "./lib/time.mjs";
import { pathMatches, toRepoRelative, ruleMatches } from "./lib/glob.mjs";

const CLI = cliName();

const { values: opt, positionals: pos } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: "string" }, paths: { type: "string" }, all: { type: "boolean" }, quiet: { type: "boolean" },
    task: { type: "string" }, what: { type: "string" }, next: { type: "string" }, refs: { type: "string" },
    uncommitted: { type: "string" }, rule: { type: "string" }, when: { type: "string" }, lead: { type: "boolean" },
    enforcement: { type: "string" }, ref: { type: "string" }, why: { type: "string" }, rejected: { type: "string" },
    by: { type: "string" }, supersedes: { type: "string" }, gate: { type: "string" }, manual: { type: "string" },
    files: { type: "string" }, effort: { type: "string" }, after: { type: "string" }, notes: { type: "string" },
    reason: { type: "string" }, needs: { type: "string" }, question: { type: "string" }, not: { type: "string" },
    command: { type: "string" }, wrong: { type: "string" }, "known-fail": { type: "string" }, "known-fail-why": { type: "string" },
    kind: { type: "string" }, timeout: { type: "string" }, "confirmed-by-owner": { type: "boolean" }, search: { type: "string" },
    plan: { type: "string" }, label: { type: "string" }, session: { type: "string" }, answer: { type: "string", multiple: true }, "done-when": { type: "string", multiple: true },
    "max-tasks": { type: "string" }, "max-turns": { type: "string" }, model: { type: "string" }, statement: { type: "string" }, write: { type: "boolean" }, "dry-run": { type: "boolean" },
    json: { type: "boolean" }, help: { type: "boolean", short: "h" },
    "with-never-delete": { type: "boolean" }, force: { type: "boolean" }, "no-install": { type: "boolean" }, dir: { type: "string" },
    print: { type: "boolean" }, gh: { type: "boolean" }, version: { type: "boolean", short: "v" },
  },
});

const out = (s = "") => process.stdout.write(s + "\n");
const err = (s) => process.stderr.write(s + "\n");
/** Abort with a message. THROWS so that withLock's finally releases the lock — a process.exit here left a stale lock behind (found by tests/plan-system.test.ts). */
class CliExit extends Error { constructor(msg, code) { super(msg); this.code = code; } }
function die(msg, code = 2) { throw new CliExit(msg, code); }
function need(name, v) { if (v === undefined || v === "") die(`--${name} is required`); return v; }
const list = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

/** The session id the SessionStart hook wrote, so log entries can say which session made them. Best effort. */
function sessionId() {
  if (opt.session) return opt.session;
  try { return readJson(join(hookStateRoot(), "current-session.json"), {}).session_id || null; } catch { return null; }
}
function runId() { return `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`; }

function loadOrDie(id) {
  validatePlanId(id);
  try { return loadPlan(id); } catch (e) { die(e.message); }
}
/** Validate, then write state. Refuses to write an invalid state — the file never holds a lie this tool made. */
function saveState(plan, mutate) {
  const path = join(plan.dir, FILES.state);
  return withLock(path, () => {
    const fresh = loadPlan(plan.id);
    mutate(fresh.state, fresh);
    const { errors } = validatePlan(fresh);
    if (errors.length) die(`refusing to write an invalid state:\n  ${errors.join("\n  ")}`, 1);
    writeJsonAtomic(path, fresh.state);
    return fresh;
  });
}
function findTask(state, tid) {
  const t = state.tasks.find((x) => x.id === tid);
  if (!t) die(`no task ${tid} in ${state.id}`);
  return t;
}
function syncClaudeMd() {
  const active = activePlanIds().map((id) => { const s = readJson(join(planDir(id), FILES.state), {}); return { id, title: s.title }; });
  return writeBlock(claudeMdPath(), active);
}

// ---------- gates -------------------------------------------------------------

function execGate(command, timeoutSec) {
  const t0 = Date.now();
  const r = spawnSync("bash", ["-c", command], {
    cwd: projectRoot(), encoding: "utf8", timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PLAN_GATE: "1" },
  });
  const text = `${r.stdout || ""}${r.stderr ? `\n[stderr]\n${r.stderr}` : ""}`;
  const lines = text.trim().split("\n");
  const tail = lines.slice(-25).join("\n").slice(-4000);
  return { exit: r.status, signal: r.signal, error: r.error, durationMs: Date.now() - t0, stdout: r.stdout || "", tail };
}
function gateResult(gate, run) {
  if (run.error || run.signal) return "error";
  if (gate.passWhen === "exit0") return run.exit === 0 ? "pass" : "fail";
  try { return new RegExp(gate.passWhen.stdoutMatches, "m").test(run.stdout) ? "pass" : "fail"; } catch { return "error"; }
}
function recordRun(plan, gate, kind, command, run, result) {
  const entry = {
    runId: runId(), gate: gate.id, kind, at: nowIso(), session: sessionId(), command,
    exit: run.exit ?? null, durationMs: run.durationMs, result, tail: run.tail || (run.error ? String(run.error.message) : ""),
    ...(kind === "verify" ? { gateCommand: gate.command } : {}),
  };
  SCHEMAS.GateRun.parse(entry);
  appendJsonl(join(plan.dir, FILES.gateRuns), entry);
  return entry;
}
/** Run a gate and record it. Returns the run entry. */
function runGate(plan, gid) {
  const gate = plan.gates.gates.find((g) => g.id === gid);
  if (!gate) die(`no gate ${gid} in ${plan.id}`);
  out(`▶ ${gate.id}: ${gate.question}\n  $ ${gate.command}`);
  const run = execGate(gate.command, gate.timeoutSec);
  const result = gateResult(gate, run);
  const entry = recordRun(plan, gate, "run", gate.command, run, result);
  out(`  ${result.toUpperCase()} (exit ${run.exit ?? "—"}, ${run.durationMs} ms, run ${entry.runId})`);
  if (result !== "pass") out(indent(run.tail || String(run.error?.message || "")));
  return entry;
}
/** Run the knownFail case. It PASSES the verification only if the command FAILS — that is the whole point. */
function verifyGate(plan, gid) {
  const gate = plan.gates.gates.find((g) => g.id === gid);
  if (!gate) die(`no gate ${gid} in ${plan.id}`);
  if (!gate.knownFail) { out(`${gid}: no knownFail case declared — nothing shows this gate can fail`); return null; }
  out(`▶ verify ${gate.id}: ${gate.knownFail.description}\n  $ ${gate.knownFail.command}`);
  const run = execGate(gate.knownFail.command, gate.timeoutSec);
  const gateSaysPass = gateResult(gate, run) === "pass";
  const want = gate.knownFail.expectExit ?? null;
  const wrongExit = want !== null && run.exit !== want;
  const result = run.error ? "error" : gateSaysPass || wrongExit ? "fail" : "pass";
  const entry = recordRun(plan, gate, "verify", gate.knownFail.command, run, result);
  if (result === "pass") out(`  VERIFIED — the gate fails on a case that must fail (exit ${run.exit}${want !== null ? `, as expected` : ""}). Last lines:\n${indent(run.tail.split("\n").slice(-3).join("\n"))}`);
  else if (wrongExit) out(`  ⛔ NOT VERIFIED — the case exited ${run.exit}, not ${want}. That is a broken command, not the failure the gate exists for.\n${indent(run.tail)}`);
  else out(`  ⛔ NOT VERIFIED — the known-fail case PASSED the gate. The gate cannot see the failure it exists for.\n${indent(run.tail)}`);
  return entry;
}
const indent = (s) => String(s || "").split("\n").map((l) => `    ${l}`).join("\n");

// ---------- commands ----------------------------------------------------------

const PLAN_MD_TEMPLATE = (title) => `# ${title}

<!-- The stable narrative. Status, tasks and history live in the JSON files beside this file — never here.
     Everything under a heading is read by people and by the brief; keep it short, keep it true. -->

## Why
<!-- 2–4 sentences: the user's real goal, and what would make the result useless to them. -->

## Done means
<!-- Statements someone can observe, each ending with the gate that proves it: "… — G1". -->

## Non-goals
<!-- What this plan deliberately does not do, and where a deferred item would go if it returns. -->

## Method
<!-- The recipe for each kind of task, with real commands and ONE worked example with real numbers,
     so the next session does not rediscover it. Point at guides; do not restate them. -->

## Rules for this plan
<!-- Only rules that cannot be a gate (gates.json) or a hook rule (rules.json). Numbered.
     Each: the rule in one sentence, then the case that taught it. The brief shows the first 14 lines. -->

## Owner decides
<!-- Irreversible or outward-facing steps. The executor stops and asks before each one. "none" if none. -->

## Map
| path | role |
|---|---|

## Sources
| what | path | what applies here |
|---|---|---|
`;

function cmdNew() {
  const id = validatePlanId(need("id", pos[1]));
  const title = need("title", opt.title);
  const dir = planDir(id);
  if (existsSync(join(dir, FILES.state))) die(`plan ${id} already exists at ${dir}`);
  mkdirSync(dir, { recursive: true });
  const state = { id, title, status: "draft", created: today(), activatedAt: null, closedAt: null, paths: list(opt.paths), doneWhen: DEFAULT_DONE_WHEN, tasks: [] };
  SCHEMAS.State.parse(state);
  writeJsonAtomic(join(dir, FILES.state), state);
  writeJsonAtomic(join(dir, FILES.gates), { gates: [] });
  writeJsonAtomic(join(dir, FILES.rules), { rules: [] });
  for (const f of [FILES.log, FILES.learnings, FILES.decisions, FILES.gateRuns]) writeFileSync(join(dir, f), "");
  writeFileSync(join(dir, FILES.planMd), PLAN_MD_TEMPLATE(title));
  out(`created ${dir} (status draft). Fill PLAN.md, add tasks and gates, then: ${CLI} validate ${id} && ${CLI} activate ${id}`);
}

function cmdList() {
  const ids = listPlanIds();
  if (!ids.length) { out(`no plans under ${plansRoot()}`); return; }
  for (const id of ids) {
    const p = loadPlan(id); const c = taskCounts(p.state); const last = p.log.at(-1);
    out(`${p.state.status.padEnd(9)} ${id.padEnd(28)} ${String(c.done).padStart(3)}/${String(p.state.tasks.length).padEnd(3)} done  last log ${last ? shortStamp(last.at) : "never"}  ${p.state.title}`);
  }
}

function cmdValidate() {
  const ids = opt.all || !pos[1] ? listPlanIds() : [pos[1]];
  let errors = [], warnings = [];
  for (const id of ids) {
    const r = validatePlan(loadOrDie(id));
    errors.push(...r.errors); warnings.push(...r.warnings);
  }
  // CLAUDE.md drift: the block must list exactly the active plans.
  const md = existsSync(claudeMdPath()) ? readFileSync(claudeMdPath(), "utf8") : "";
  const inBlock = idsInBlock(md);
  if (blockCount(md) > 1) errors.push(`CLAUDE.md holds ${blockCount(md)} plans blocks — a merge left a duplicate; run: ${CLI} activate <any active id> to collapse them`);
  const active = ids.filter((id) => readJson(join(planDir(id), FILES.state), {}).status === "active");
  if (active.length && inBlock === null) errors.push(`CLAUDE.md has no plans block but ${active.length} plan(s) are active — run: ${CLI} activate <id>`);
  else if (inBlock) {
    for (const id of active) if (!inBlock.includes(id)) errors.push(`CLAUDE.md plans block does not list active plan ${id}`);
    for (const id of inBlock) if (!active.includes(id) && (opt.all || !pos[1] || id === pos[1])) errors.push(`CLAUDE.md plans block lists ${id}, which is not an active plan`);
  }
  if (!opt.quiet) for (const w of warnings) out(`warn  ${w}`);
  for (const e of errors) err(`ERROR ${e}`);
  if (errors.length) { err(`plan: ${errors.length} error(s) across ${ids.length} plan(s)`); process.exit(1); }
  if (!opt.quiet || !ids.length) out(`plan: ${ids.length} plan(s) valid${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
}

function cmdBrief() {
  const ids = opt.all || !pos[1] ? activePlanIds() : [pos[1]];
  if (!ids.length) { out("no active plans"); return; }
  out(ids.map((id) => renderBrief(loadOrDie(id))).join("\n\n"));
}

/** Print the brief a subagent gets for one task. Creates the plan's reports/ directory so the agent's report has a home. */
function cmdAgentBrief() {
  const plan = loadOrDie(need("id", pos[1]));
  const task = findTask(plan.state, need("task id", pos[2]));
  mkdirSync(join(plan.dir, "reports"), { recursive: true });
  out(renderAgentBrief(plan, task, { unit: opt.what || null, label: opt.label || null }));
}

function cmdStatus() {
  const plan = loadOrDie(need("id", pos[1]));
  out(renderBrief(plan)); out("");
  out("TASKS");
  for (const t of plan.state.tasks) {
    const ev = t.evidence ? (t.evidence.kind === "gate" ? `${t.evidence.gate}@${t.evidence.runId}` : `manual/${t.evidence.by}`) : "";
    const total = plan.state.doneWhen.length + t.doneWhen.length;
    out(`  ${t.id.padEnd(4)} ${t.status.padEnd(8)} ${t.title}${t.gate ? `  [${t.gate}]` : "  [manual]"}${ev ? `  ✓ ${ev}` : ""}${t.status === "done" ? `  checklist ${t.doneChecklist.length}/${total}` : ""}${t.blocked ? `  ⛔ ${t.blocked.reason}` : ""}`);
  }
  out("GATES");
  for (const g of plan.gates.gates) {
    const r = lastRunFor(plan, g.id);
    out(`  ${g.id.padEnd(4)} ${r ? `${r.result.toUpperCase().padEnd(5)} ${shortStamp(r.at)}` : "never run       "}  ${g.knownFail ? (verifiedFor(plan, g.id) ? "verified" : "UNVERIFIED") : "no knownFail"}  ${g.question}`);
  }
  const { errors, warnings } = validatePlan(plan);
  for (const w of warnings) out(`warn  ${w}`);
  for (const e of errors) out(`ERROR ${e}`);
  if (plan.decisions.length) { out("DECISIONS"); for (const d of plan.decisions.slice(-5)) out(`  ${d.id} (${d.by}) ${d.decision}`); }
}

function cmdTask() {
  const sub = need("subcommand (add|start|done|block|unblock|drop)", pos[1]);
  const plan = loadOrDie(need("id", pos[2]));
  const at = nowIso();
  if (sub === "add") {
    let added = null;
    saveState(plan, (state) => {
      added = nextId("T", state.tasks);
      let n = Math.max(0, ...state.doneWhen.map((s) => Number(s.id.slice(1))), ...state.tasks.flatMap((t) => t.doneWhen.map((s) => Number(s.id.slice(1)))));
      const doneWhen = (opt["done-when"] || []).map((statement) => ({ id: `C${++n}`, statement, kind: "manual" }));
      state.tasks.push({
        id: added, title: need("title", opt.title), status: "todo", gate: opt.gate || null, manualCheck: opt.manual || null,
        files: list(opt.files), effort: opt.effort || null, dependsOn: list(opt.after), notes: opt.notes || "",
        startedAt: null, doneAt: null, evidence: null, blocked: null, doneWhen, doneChecklist: [],
      });
    });
    // Only after the validated write. Printing inside the callback once announced a task the validator then refused.
    out(`added ${added}: ${opt.title}`);
    return;
  }
  const tid = need("task id", pos[3]);
  if (sub === "check") {
    const t = findTask(plan.state, tid);
    const statements = [...plan.state.doneWhen, ...t.doneWhen];
    const { entries, failures } = evaluateAuto(plan, t, statements, { kind: "pending" });
    out(`${tid} — ${t.title}\nBefore "done", each of these must hold:`);
    for (const s of statements) {
      const e = entries.find((x) => x.id === s.id);
      if (s.kind === "manual") out(`  ${s.id} [manual] ${s.statement}\n       → answer with: --answer "${s.id}: <what you checked>"`);
      else if (s.kind === "auto:gate") out(`  ${s.id} [auto:gate] ${s.statement}\n       → ${t.gate ? `${t.gate} runs when you call task done` : `no gate; close with --manual "<what was checked and how>"`}`);
      else out(`  ${s.id} [${s.kind}] ${s.statement}\n       → ${failures.some((f) => f.startsWith(s.id + ":")) ? "✗" : "✓"} ${e?.answer || ""}`);
    }
    // The context refill. After a compaction the agent does not know what it forgot, so the tool brings it back:
    // why the plan exists, what this task is, which files to re-read whole, and what the gate does and does not see.
    const clipTo = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
    const gate = t.gate ? plan.gates.gates.find((g) => g.id === t.gate) : null;
    const why = sectionOf(plan.planMd, "Why");
    out(`\nCONTEXT TO HOLD WHILE YOU ANSWER — re-read it now; after a compaction you do not know what you forgot:`);
    if (why) out(`  WHY THIS PLAN: ${clipTo(why, 400)}`);
    out(`  TASK: ${t.title}${t.notes ? ` — ${clipTo(t.notes, 200)}` : ""}\n  FILES TO RE-READ WHOLE: ${t.files.join(", ") || "(none listed — see PLAN.md § Map)"}`);
    if (gate) out(`  GATE ${gate.id} answers: ${gate.question}\n    it does NOT answer: ${gate.notTheSameAs}\n    it could pass while wrong if: ${gate.couldPassWhileWrongIf}`);
    else out(`  NO GATE — a person checks: ${t.manualCheck}`);
    out("");
    for (const l of JUDGMENT) out(`  ${l}`);
    return;
  }
  if (sub === "start") {
    saveState(plan, (state) => {
      const t = findTask(state, tid);
      if (t.status === "done") die(`${tid} is already done`);
      for (const d of t.dependsOn) { const dep = findTask(state, d); if (dep.status !== "done" && dep.status !== "dropped") err(`warn: ${tid} depends on ${d}, which is ${dep.status}`); }
      t.status = "doing"; t.startedAt = t.startedAt || at; t.blocked = null;
    });
    out(`${tid} → doing. When it lands: ${CLI} task done ${plan.id} ${tid}`);
    return;
  }
  if (sub === "done") {
    const t = findTask(plan.state, tid);
    if (t.status === "done") die(`${tid} is already done`);
    if (t.status === "dropped") die(`${tid} is dropped; unblock/re-add it first`);
    if (t.gate && plan.gates.gates.find((g) => g.id === t.gate)?.kind === "report") die(`${tid} names ${t.gate}, a report gate — a report never proves a task done; give the task a real gate or a manualCheck`);
    const statements = [...plan.state.doneWhen, ...t.doneWhen];
    // Manual statements need an answer BEFORE the gate runs: a gate run that is then thrown away is waste, and an executor who cannot answer C4 should not be running gates.
    const answers = new Map();
    for (const a of opt.answer || []) {
      const m = /^\s*(C\d+)\s*[:=]\s*(.+)$/s.exec(a);
      if (!m) die(`--answer must look like "C4: what you checked" (got: ${a.slice(0, 40)})`);
      answers.set(m[1], m[2].trim());
    }
    const manual = statements.filter((s) => s.kind === "manual");
    const unanswered = manual.filter((s) => !answers.has(s.id) || answers.get(s.id).length < 10);
    if (unanswered.length) {
      // This refusal is a REMINDER, not only an error: the executor sees every condition of done, so a session
      // that lost its context after a compaction still learns what "done" means here before it can claim it.
      const lines = statements.map((s) => {
        const missing = unanswered.some((u) => u.id === s.id);
        const how = s.kind === "manual" ? (missing ? `✗ answer with --answer "${s.id}: <what you checked>"` : "✓ answered") : `checked by the tool when the answers are in (${s.kind})`;
        return `  ${s.id} ${s.statement}\n       ${how}`;
      });
      die(`${tid} is NOT done yet. Before a task is done here, every condition below must hold. Read each one, do what it says, then run this command again with one --answer per manual condition:\n${lines.join("\n")}\nAn answer says what you checked and how (10+ characters), never just "yes". Context for the answers: ${CLI} task check ${plan.id} ${tid}\n\n${JUDGMENT.map((l) => "  " + l).join("\n")}`, 1);
    }
    for (const id of answers.keys()) if (!statements.some((s) => s.id === id)) die(`--answer names ${id}, which is not a condition of ${tid}`);
    // The cheap conditions (a log entry, the files on disk) are checked BEFORE the gate runs: a gate can take
    // minutes, and an executor who has not logged should hear that now, together with everything else unmet.
    const pre = evaluateAuto(plan, t, statements.filter((s) => s.kind !== "auto:gate"), { kind: "none" });
    if (pre.failures.length) die(`${tid} is NOT done — before the gate runs, these conditions already fail:\n  ${pre.failures.join("\n  ")}`, 1);
    let evidence;
    if (opt.manual) {
      const by = opt.by || "agent";
      if (!["owner", "agent"].includes(by)) die("--by must be owner or agent");
      if (t.gate && !(opt["confirmed-by-owner"] && by === "owner")) die(`${tid} has gate ${t.gate}. Run it (omit --manual), or record the owner's word with BOTH --by owner AND --confirmed-by-owner.`);
      evidence = { kind: "manual", by, at, reason: opt.manual };
    } else {
      if (!t.gate) die(`${tid} has no gate; its manualCheck says: "${t.manualCheck}". Record it with --manual "<what you checked and how>" [--by owner]`);
      const gate = plan.gates.gates.find((g) => g.id === t.gate);
      if (gate?.knownFail) {
        const vs = verifyStatus(plan, gate);
        if (!vs.verified) die(`${t.gate} declares a known-fail case but was never verified — nothing has shown it CAN fail. Run: ${CLI} gate verify ${plan.id} ${t.gate}`);
        if (vs.stale) die(`${t.gate}'s command changed after it was last verified. A gate edited to pass must still fail its known-fail case: ${CLI} gate verify ${plan.id} ${t.gate} — then run this command again.`);
      }
      const run = runGate(plan, t.gate);
      if (run.result !== "pass") die(`${tid} is NOT done — ${t.gate} ${run.result}.\nFix the CAUSE, then run this command again. Never edit the gate, the test or the data so that it passes.\nIf you believe the GATE is wrong, or you cannot fix the cause: ${CLI} task block ${plan.id} ${tid} --reason "<what the gate computed, and what is true>" --needs owner — then stop.\nLog where it stands: ${CLI} log ${plan.id} --task ${tid} --what "…" --next "…"`, 1);
      evidence = { kind: "gate", gate: t.gate, runId: run.runId, at: run.at };
    }
    // Auto conditions, evaluated NOW against the run just made and the plan's files.
    const gateOutcome = evidence.kind === "gate" ? { kind: "gate", run: loadPlan(plan.id).gateRuns.find((r) => r.runId === evidence.runId) } : { kind: "manual", reason: evidence.reason, by: evidence.by };
    const { entries, failures } = evaluateAuto(loadPlan(plan.id), t, statements, gateOutcome);
    if (failures.length) die(`${tid} is NOT done — a condition fails:\n  ${failures.join("\n  ")}`, 1);
    const checklist = statements.map((s) => {
      const auto = entries.find((e) => e.id === s.id);
      return { id: s.id, statement: s.statement, kind: s.kind, answer: auto ? auto.answer : answers.get(s.id), at };
    });
    saveState(plan, (state) => { const x = findTask(state, tid); x.status = "done"; x.doneAt = at; x.evidence = evidence; x.blocked = null; x.doneChecklist = checklist; });
    out(`${tid} → done (${evidence.kind === "gate" ? `${evidence.gate} run ${evidence.runId}` : `manual, by ${evidence.by}`}); ${checklist.length} conditions answered. Review: ${CLI} review ${plan.id} ${tid}`);
    return;
  }
  if (sub === "block") {
    const needs = opt.needs || "self";
    saveState(plan, (state) => { const t = findTask(state, tid); t.status = "blocked"; t.blocked = { reason: need("reason", opt.reason), since: at, needs }; });
    out(`${tid} → blocked (needs ${needs})`);
    return;
  }
  if (sub === "unblock") { saveState(plan, (state) => { const t = findTask(state, tid); t.status = "todo"; t.blocked = null; }); out(`${tid} → todo`); return; }
  if (sub === "drop") {
    saveState(plan, (state) => { const t = findTask(state, tid); t.status = "dropped"; t.notes = `${t.notes ? t.notes + "\n" : ""}dropped ${at}: ${need("reason", opt.reason)}`; t.blocked = null; });
    out(`${tid} → dropped`);
    return;
  }
  die(`unknown task subcommand ${sub}`);
}

/** The reviewable record: for each done task, its evidence and every condition with its answer. */
function cmdReview() {
  const plan = loadOrDie(need("id", pos[1]));
  const tasks = pos[2] ? [findTask(plan.state, pos[2])] : plan.state.tasks.filter((t) => t.status === "done");
  if (!tasks.length) { out("no done tasks yet"); return; }
  for (const t of tasks) {
    out(`${t.id} ${t.status.toUpperCase()} — ${t.title}`);
    if (t.evidence) out(`  evidence: ${t.evidence.kind === "gate" ? `${t.evidence.gate} run ${t.evidence.runId} at ${shortStamp(t.evidence.at)}` : `manual by ${t.evidence.by}: ${t.evidence.reason}`}`);
    if (!t.doneChecklist.length) out(t.status === "done" ? "  checklist: NONE — closed before doneWhen existed, or by hand" : "  checklist: (not done yet)");
    for (const c of t.doneChecklist) out(`  ${c.id} ${c.kind === "manual" ? "      " : "[auto]"} ${c.statement}\n       ↳ ${c.answer}`);
    out("");
  }
}

function cmdLog() {
  const plan = loadOrDie(need("id", pos[1]));
  if (opt.task) findTask(plan.state, opt.task);
  const entry = { at: nowIso(), session: sessionId(), task: opt.task || null, what: need("what", opt.what), next: need("next", opt.next), refs: list(opt.refs), uncommitted: opt.uncommitted || null };
  const r = SCHEMAS.LogEntry.safeParse(entry);
  if (!r.success) die(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  appendJsonl(join(plan.dir, FILES.log), entry);
  out(`logged. RESUME now reads: ${entry.next}`);
}

function cmdLearn() {
  const plan0 = loadOrDie(need("id", pos[1]));
  withLock(join(plan0.dir, FILES.state), () => { const plan = loadPlan(plan0.id);
  const id = nextId("L", plan.learnings);
  const entry = {
    id, at: nowIso(), session: sessionId(), task: opt.task || null, what: need("what", opt.what), rule: need("rule", opt.rule),
    appliesWhen: need("when", opt.when), enforcement: opt.enforcement || "prose", ref: opt.ref || null, status: opt.lead ? "lead" : "confirmed",
  };
  const r = SCHEMAS.Learning.safeParse(entry);
  if (!r.success) die(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const test = loadPlan(plan.id); test.learnings.push(entry);
  const { errors } = validatePlan(test);
  if (errors.length) die(`refusing: ${errors.join("; ")}`, 1);
  appendJsonl(join(plan.dir, FILES.learnings), entry);
  out(`${id} recorded (${entry.status}, enforcement ${entry.enforcement}).${entry.enforcement === "prose" ? ` Can it be a gate or a rules.json rule instead? If yes, promote it and set --enforcement.` : ""}`);
  });
}

function cmdDecide() {
  const plan0 = loadOrDie(need("id", pos[1]));
  withLock(join(plan0.dir, FILES.state), () => { const plan = loadPlan(plan0.id);
  const id = nextId("D", plan.decisions);
  const rejected = list(opt.rejected?.replace(/;/g, ",")).map((s) => { const [option, ...why] = s.split(":"); return { option: option.trim(), why: why.join(":").trim() || "not stated" }; });
  const entry = { id, at: nowIso(), session: sessionId(), task: opt.task || null, decision: need("what", opt.what), why: need("why", opt.why), rejected, by: opt.by || "agent", supersedes: opt.supersedes || null };
  const r = SCHEMAS.Decision.safeParse(entry);
  if (!r.success) die(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const test = loadPlan(plan.id); test.decisions.push(entry);
  const { errors } = validatePlan(test);
  if (errors.length) die(`refusing: ${errors.join("; ")}`, 1);
  appendJsonl(join(plan.dir, FILES.decisions), entry);
  out(`${id} recorded (by ${entry.by}).`);
  });
}

function cmdGate() {
  const sub = need("subcommand (list|run|verify|add)", pos[1]);
  const plan = loadOrDie(need("id", pos[2]));
  if (sub === "list") {
    for (const g of plan.gates.gates) {
      const r = lastRunFor(plan, g.id);
      out(`${g.id} [${g.kind}] ${g.question}\n   answers NOT: ${g.notTheSameAs}\n   $ ${g.command}\n   could pass while wrong if: ${g.couldPassWhileWrongIf}\n   last run: ${r ? `${r.result} ${shortStamp(r.at)}` : "never"} · knownFail: ${g.knownFail ? (verifiedFor(plan, g.id) ? "verified" : "declared, UNVERIFIED") : "none"}`);
    }
    return;
  }
  if (sub === "run") {
    const ids = opt.all ? plan.gates.gates.map((g) => g.id) : [need("gate id", pos[3])];
    let bad = 0;
    for (const g of ids) if (runGate(plan, g).result !== "pass") bad++;
    if (bad) process.exit(1);
    return;
  }
  if (sub === "verify") {
    const ids = opt.all ? plan.gates.gates.map((g) => g.id) : [need("gate id", pos[3])];
    let bad = 0;
    for (const g of ids) { const e = verifyGate(plan, g); if (e && e.result !== "pass") bad++; }
    if (bad) process.exit(1);
    return;
  }
  if (sub === "add") {
    withLock(join(plan.dir, FILES.state), () => {
      const fresh = loadPlan(plan.id);
      const gate = {
        id: nextId("G", fresh.gates.gates), question: need("question", opt.question), notTheSameAs: need("not", opt.not), command: need("command", opt.command),
        passWhen: "exit0", timeoutSec: Number(opt.timeout || 600),
        knownFail: opt["known-fail"] ? { command: opt["known-fail"], description: need("known-fail-why", opt["known-fail-why"]), expectExit: 1 } : null,
        couldPassWhileWrongIf: need("wrong", opt.wrong), kind: opt.kind || "static",
      };
      const r = SCHEMAS.Gate.safeParse(gate);
      if (!r.success) die(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      fresh.gates.gates.push(gate);
      writeJsonAtomic(join(fresh.dir, FILES.gates), fresh.gates);
      out(`added ${gate.id}. Prove it can fail: ${CLI} gate verify ${plan.id} ${gate.id}`);
    });
    return;
  }
  die(`unknown gate subcommand ${sub}`);
}

function cmdActivate() {
  const plan = loadOrDie(need("id", pos[1]));
  if (plan.state.status === "active") { out(`${plan.id} is already active`); syncClaudeMd(); return; }
  if (["done", "abandoned"].includes(plan.state.status)) die(`${plan.id} is ${plan.state.status}; create a new plan instead of reviving it`);
  const trial = loadPlan(plan.id); trial.state.status = "active"; trial.state.activatedAt = trial.state.activatedAt || nowIso();
  const { errors, warnings } = validatePlan(trial);
  if (errors.length) die(`cannot activate:\n  ${errors.join("\n  ")}`, 1);
  const touchesDocs = trial.state.tasks.some((t) => /\bdocs?\b/i.test(t.title) || t.files.some((f) => f.startsWith("docs/")));
  if (!touchesDocs) warnings.push(`${plan.id}: no task mentions docs — docs ship in the same change as the code they describe (CLAUDE.md rule 9)`);
  saveState(plan, (state) => { state.status = "active"; state.activatedAt = state.activatedAt || nowIso(); });
  const changed = syncClaudeMd();
  for (const w of warnings) out(`warn  ${w}`);
  out(`${plan.id} → active. CLAUDE.md plans block ${changed ? "updated" : "already current"}.`);
  out(`Tell the owner the block changed. Then verify each gate can fail: ${CLI} gate verify ${plan.id} --all`);
  out(""); out(renderBrief(loadPlan(plan.id)));
}

function cmdPause() {
  const plan = loadOrDie(need("id", pos[1]));
  saveState(plan, (state) => { state.status = "paused"; });
  syncClaudeMd();
  out(`${plan.id} → paused; removed from CLAUDE.md. Re-activate with: ${CLI} activate ${plan.id}`);
}

function cmdClose() {
  const plan = loadOrDie(need("id", pos[1]));
  const open = plan.state.tasks.filter((t) => !["done", "dropped"].includes(t.status));
  if (open.length) die(`cannot close: ${open.map((t) => `${t.id} (${t.status})`).join(", ")} still open`, 1);
  out("Running every gate fresh (kind ≠ report) — a plan closes on what the gates say NOW, not on their last recorded run.");
  let bad = 0;
  for (const g of plan.gates.gates) if (g.kind !== "report" && runGate(plan, g.id).result !== "pass") bad++;
  if (bad) die(`cannot close: ${bad} gate(s) fail`, 1);
  const prose = plan.learnings.filter((l) => l.enforcement === "prose" && l.status !== "retracted");
  if (prose.length) {
    out(`\n${prose.length} learning(s) are still prose-only. Before closing, ask of each: can it be a gate, a rules.json rule in a later plan, or a line in a docs guide?`);
    for (const l of prose) out(`  ${l.id}: ${l.rule}`);
  }
  if (!opt["confirmed-by-owner"]) {
    out(`\nAll gates pass. Closing removes ${plan.id} from CLAUDE.md. ASK THE OWNER in chat, then run:\n  ${CLI} close ${plan.id} --confirmed-by-owner`);
    return;
  }
  saveState(plan, (state) => { state.status = "done"; state.closedAt = nowIso(); });
  appendJsonl(join(plan.dir, FILES.log), { at: nowIso(), session: sessionId(), task: null, what: "plan closed: every task done or dropped, every gate passing, owner confirmed", next: "nothing — this plan is closed", refs: [], uncommitted: null });
  syncClaudeMd();
  out(`${plan.id} → done. Removed from CLAUDE.md. Its learnings stay searchable: ${CLI} learnings --plan ${plan.id}`);
}

function cmdAbandon() {
  const plan = loadOrDie(need("id", pos[1]));
  if (!opt["confirmed-by-owner"]) die(`abandoning a plan is the owner's call. Ask, then re-run with --confirmed-by-owner --reason "…"`);
  const reason = need("reason", opt.reason);
  saveState(plan, (state) => { state.status = "abandoned"; state.closedAt = nowIso(); });
  appendJsonl(join(plan.dir, FILES.log), { at: nowIso(), session: sessionId(), task: null, what: `plan abandoned: ${reason}`, next: "nothing — this plan is abandoned", refs: [], uncommitted: null });
  syncClaudeMd();
  out(`${plan.id} → abandoned. Removed from CLAUDE.md.`);
}

function cmdLearnings() {
  const ids = opt.plan ? [opt.plan] : listPlanIds();
  const term = (opt.search || "").toLowerCase();
  let n = 0;
  for (const id of ids) {
    const p = loadOrDie(id);
    for (const l of p.learnings) {
      const hay = `${l.what} ${l.rule} ${l.appliesWhen}`.toLowerCase();
      if (term && !hay.includes(term)) continue;
      n++;
      out(`${id} ${l.id} [${l.status}, ${l.enforcement}${l.ref ? ` → ${l.ref}` : ""}] ${l.rule}\n    case: ${l.what}\n    when: ${l.appliesWhen}`);
    }
  }
  if (!n) out(term ? `no learning mentions "${term}"` : "no learnings recorded");
}

/** Plan-level conditions of done: list, add, drop. Ids never collide with a task's own conditions; `since` exempts tasks closed earlier. */
function cmdCondition() {
  const sub = need("subcommand (list|add|drop)", pos[1]);
  const plan = loadOrDie(need("id", pos[2]));
  if (sub === "list") {
    for (const s of plan.state.doneWhen) out(`  ${s.id} [${s.kind}] ${s.statement}${s.since ? `  (since ${s.since})` : ""}`);
    out(`${plan.state.doneWhen.length} plan-level condition(s); tasks may add their own with task add --done-when`);
    return;
  }
  withLock(join(plan.dir, FILES.state), () => {
    const fresh = loadPlan(plan.id);
    if (sub === "add") {
      const statement = need("statement", opt.statement);
      const kind = opt.kind || "manual";
      if (kind !== "manual") die("only manual conditions can be added here; the auto:* kinds need code in store.mjs evaluateAuto");
      const used = [...fresh.state.doneWhen, ...fresh.state.tasks.flatMap((t) => t.doneWhen)].map((s) => Number(s.id.slice(1)));
      const s = { id: `C${Math.max(0, ...used) + 1}`, statement, kind, since: nowIso() };
      const r = SCHEMAS.Statement.safeParse(s);
      if (!r.success) die(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      fresh.state.doneWhen.push(s);
      writeJsonAtomic(join(fresh.dir, FILES.state), fresh.state);
      out(`${s.id} added to ${plan.id}: every task closed from now on must answer it (tasks already done are not held to it).`);
      return;
    }
    if (sub === "drop") {
      const cid = need("condition id", pos[3]);
      const s = fresh.state.doneWhen.find((x) => x.id === cid);
      if (!s) die(`${plan.id} has no plan-level condition ${cid}`);
      if (s.kind !== "manual") die(`${cid} is checked by the tool (${s.kind}); it stays`);
      fresh.state.doneWhen = fresh.state.doneWhen.filter((x) => x.id !== cid);
      writeJsonAtomic(join(fresh.dir, FILES.state), fresh.state);
      out(`${cid} dropped from ${plan.id}. Answers already stored on done tasks are kept.`);
      return;
    }
    die("condition list|add|drop");
  });
}

/** One fresh claude -p session per task, until the plan is done, blocked, or needs a person. The answer to "clear the context after each task". */
async function cmdRun() {
  const { runPlan } = await import("./run.mjs");
  const code = await runPlan({ id: need("id", pos[1]), maxTasks: Number(opt["max-tasks"] || 1), model: opt.model || "sonnet", maxTurns: Number(opt["max-turns"] || 60), dryRun: Boolean(opt["dry-run"]), log: out });
  process.exit(code);
}

async function cmdInit() { const { init } = await import("../init.mjs"); process.exit(await init({ dir: opt.dir, force: Boolean(opt.force), noInstall: Boolean(opt["no-install"]), withNeverDelete: Boolean(opt["with-never-delete"]), dryRun: Boolean(opt["dry-run"]), log: out })); }
async function cmdUpdate() { const { update } = await import("../init.mjs"); process.exit(await update({ dir: opt.dir, log: out })); }
async function cmdUninstall() { const { uninstall } = await import("../init.mjs"); process.exit(await uninstall({ dir: opt.dir, log: out })); }
async function cmdIssue() { const { issue } = await import("../issue.mjs"); process.exit(await issue({ kind: pos[1] || "bug", title: opt.title || "", print: Boolean(opt.print), gh: Boolean(opt.gh), log: out })); }
function cmdVersion() { out(JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")).version); }

async function cmdHooks() {
  const { install, status, selftest } = await import("../hooks/install.mjs");
  const sub = pos[1] || "status";
  if (sub === "install") install({ dryRun: Boolean(opt["dry-run"]), withNeverDelete: Boolean(opt["with-never-delete"]) });
  else if (sub === "uninstall") install({ remove: true });
  else if (sub === "status") { const { problems } = status(); process.exit(problems ? 1 : 0); }
  else if (sub === "selftest") selftest();
  else die("hooks install|uninstall|status|selftest");
}

async function cmdDoctor() {
  let problems = 0;
  const ok = (m) => out(`ok    ${m}`); const bad = (m) => { problems++; out(`FAIL  ${m}`); }; const warn = (m) => out(`warn  ${m}`);
  const [maj, min] = process.versions.node.split(".").map(Number);
  (maj > 20 || (maj === 20 && min >= 10)) ? ok(`node ${process.versions.node}`) : bad(`node ${process.versions.node} — need ≥ 20.10 (util.parseArgs, structuredClone)`);
  const ids = listPlanIds();
  ok(`${ids.length} plan(s) under ${plansRoot()}; ${activePlanIds().length} active`);
  for (const id of ids) {
    const p = loadPlan(id); const { errors, warnings } = validatePlan(p);
    errors.length ? bad(`${id}: ${errors.length} error(s) — ${errors[0]}`) : ok(`${id}: valid`);
    for (const w of warnings) warn(w);
    if (p.state.status === "active") {
      const last = p.log.at(-1);
      if (last && hoursSince(last.at) > 24 * 3) warn(`${id}: no log entry for ${Math.round(hoursSince(last.at) / 24)} days`);
    }
  }
  const md = existsSync(claudeMdPath()) ? readFileSync(claudeMdPath(), "utf8") : "";
  const inBlock = idsInBlock(md); const active = activePlanIds();
  if (inBlock === null) (active.length ? bad : warn)(`CLAUDE.md has no plans block${active.length ? ` but ${active.length} plan(s) are active` : ""}`);
  else {
    const drift = [...active.filter((i) => !inBlock.includes(i)), ...inBlock.filter((i) => !active.includes(i))];
    drift.length ? bad(`CLAUDE.md plans block drift: ${drift.join(", ")}`) : ok(`CLAUDE.md plans block lists exactly the active plans`);
  }
  try { mkdirSync(hookStateRoot(), { recursive: true }); ok(`${hookStateRoot()} writable`); } catch { bad(`${hookStateRoot()} not writable`); }
  try { await import("zod"); ok("zod resolves (the hooks import it; without it every hook exits 1 and every rail is off)"); } catch { bad("zod does not resolve — npm install; until then every hook exits 1 silently"); }
  const { status } = await import("../hooks/install.mjs");
  const s = status({ print: false });
  for (const line of s.lines) (line.ok ? ok : line.warn ? warn : bad)(line.text);
  problems += s.problems;
  out(problems ? `\ndoctor: ${problems} problem(s)` : "\ndoctor: healthy");
  process.exit(problems ? 1 : 0);
}

function cmdSchema() {
  const dir = join(projectRoot(), "scripts", "plan", "schema");
  const outFiles = {};
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    try { outFiles[`${name}.schema.json`] = z.toJSONSchema(schema, { unrepresentable: "any" }); } catch (e) { err(`${name}: ${e.message}`); }
  }
  if (!opt.write) { out(Object.keys(outFiles).join("\n")); return; }
  mkdirSync(dir, { recursive: true });
  for (const [f, s] of Object.entries(outFiles)) writeFileSync(join(dir, f), JSON.stringify(s, null, 2) + "\n");
  out(`wrote ${Object.keys(outFiles).length} schema files to ${dir}`);
}

/** Prove each refusal can fire. Runs inside npm run check (project convention: every gate has a --selftest). */
function cmdSelftest() {
  const box = mkdtempSync(join(tmpdir(), "plan-selftest-"));
  process.env.PLAN_PROJECT_ROOT = box;
  mkdirSync(join(box, ".project-management", "plans"), { recursive: true });
  writeFileSync(join(box, "CLAUDE.md"), "# test\n\n## Project management\n\nx\n");
  const dir = join(box, ".project-management", "plans", "t1");
  mkdirSync(dir, { recursive: true });
  const base = () => ({
    state: { id: "t1", title: "selftest plan", status: "active", created: "2026-09-12", activatedAt: "2026-09-12T10:00:00+05:30", closedAt: null, paths: ["x/**"], doneWhen: [{ id: "C1", statement: "the gate ran and passed", kind: "auto:gate" }], tasks: [] },
    gates: { gates: [{ id: "G1", question: "does the selftest gate command exit zero", notTheSameAs: "whether anything real works", command: "true", passWhen: "exit0", timeoutSec: 10, knownFail: { command: "false", description: "false must fail" }, couldPassWhileWrongIf: "the command is a no-op, which it is", kind: "static" }] },
    rules: { rules: [] }, log: [], learnings: [], decisions: [],
    gateRuns: [{ runId: "verify01", gate: "G1", kind: "verify", at: "2026-09-12T10:30:00+05:30", session: null, command: "false", gateCommand: "true", exit: 1, durationMs: 1, result: "pass", tail: "" }],
    planMd: "# t\n\n## Why\nbecause.\n", dir, id: "t1",
  });
  const task = (o) => ({ id: "T1", title: "a selftest task", status: "todo", gate: "G1", manualCheck: null, files: [], effort: null, dependsOn: [], notes: "", startedAt: null, doneAt: null, evidence: null, blocked: null, doneWhen: [], doneChecklist: [], ...o });
  const DONE_AT = "2026-09-12T11:00:00+05:30";
  const answered = { id: "C1", statement: "the gate ran and passed", kind: "auto:gate", answer: "auto: G1 passed (run abc12345)", at: DONE_AT };
  const cases = [
    ["a valid active plan passes", (p) => { p.state.tasks.push(task({})); }, false],
    ["done with no evidence is refused", (p) => { p.state.tasks.push(task({ status: "done", doneAt: "2026-09-12T11:00:00+05:30" })); }, true],
    ["done citing a run that never happened is refused", (p) => { p.state.tasks.push(task({ status: "done", doneAt: "2026-09-12T11:00:00+05:30", evidence: { kind: "gate", gate: "G1", runId: "nope-000000", at: "2026-09-12T11:00:00+05:30" } })); }, true],
    ["done citing a recorded PASS run is accepted", (p) => { p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: "2026-09-12T11:00:00+05:30", session: null, command: "true", exit: 0, durationMs: 1, result: "pass", tail: "" }); p.state.tasks.push(task({ status: "done", doneAt: "2026-09-12T11:00:00+05:30", evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: "2026-09-12T11:00:00+05:30" } })); }, false],
    ["done citing a recorded FAIL run is refused", (p) => { p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: "2026-09-12T11:00:00+05:30", session: null, command: "true", exit: 1, durationMs: 1, result: "fail", tail: "" }); p.state.tasks.push(task({ status: "done", doneAt: "2026-09-12T11:00:00+05:30", evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: "2026-09-12T11:00:00+05:30" } })); }, true],
    ["a task with neither gate nor manualCheck is refused", (p) => { p.state.tasks.push(task({ gate: null })); }, true],
    ["a task naming an undefined gate is refused", (p) => { p.state.tasks.push(task({ gate: "G9" })); }, true],
    ["a task depending on itself is refused", (p) => { p.state.tasks.push(task({ dependsOn: ["T1"] })); }, true],
    ["a done task whose OWN condition was never answered is refused", (p) => { p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: DONE_AT, session: null, command: "true", exit: 0, durationMs: 1, result: "pass", tail: "" }); p.state.tasks.push(task({ status: "done", doneAt: DONE_AT, evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: DONE_AT }, doneWhen: [{ id: "C7", statement: "the verse count matches the plate", kind: "manual" }], doneChecklist: [answered] })); }, true],
    ["a done task with every condition answered is accepted", (p) => { p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: DONE_AT, session: null, command: "true", exit: 0, durationMs: 1, result: "pass", tail: "" }); p.state.tasks.push(task({ status: "done", doneAt: DONE_AT, evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: DONE_AT }, doneWhen: [{ id: "C7", statement: "the verse count matches the plate", kind: "manual" }], doneChecklist: [answered, { id: "C7", statement: "the verse count matches the plate", kind: "manual", answer: "counted 52 on plate 17 at 4x", at: DONE_AT }] })); }, false],
    ["a checklist answer under 10 characters is refused", (p) => { p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: DONE_AT, session: null, command: "true", exit: 0, durationMs: 1, result: "pass", tail: "" }); p.state.tasks.push(task({ status: "done", doneAt: DONE_AT, evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: DONE_AT }, doneChecklist: [{ ...answered, answer: "yes" }] })); }, true],
    ["checklist answers on a task that is not done are refused", (p) => { p.state.tasks.push(task({ doneChecklist: [answered] })); }, true],
    ["a task may not reuse a plan-level condition id", (p) => { p.state.tasks.push(task({ doneWhen: [{ id: "C1", statement: "something else entirely", kind: "manual" }] })); }, true],
    ["a done citing a gate whose command CHANGED after it was verified is refused (a gate edited to pass must be re-verified)", (p) => { p.gates.gates[0].command = "true # edited so it passes"; p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: DONE_AT, session: null, command: "true # edited so it passes", exit: 0, durationMs: 1, result: "pass", tail: "" }); p.state.tasks.push(task({ status: "done", doneAt: DONE_AT, evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: DONE_AT }, doneChecklist: [answered] })); }, true],
    ["a done citing a gate with a known-fail case that was NEVER verified is refused", (p) => { p.gateRuns = []; p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: DONE_AT, session: null, command: "true", exit: 0, durationMs: 1, result: "pass", tail: "" }); p.state.tasks.push(task({ status: "done", doneAt: DONE_AT, evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: DONE_AT }, doneChecklist: [answered] })); }, true],
    ["a plan condition added AFTER a task closed is not held against that task", (p) => { p.state.doneWhen.push({ id: "C9", statement: "a condition that arrived later", kind: "manual", since: "2026-09-12T12:00:00+05:30" }); p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: DONE_AT, session: null, command: "true", exit: 0, durationMs: 1, result: "pass", tail: "" }); p.state.tasks.push(task({ status: "done", doneAt: DONE_AT, evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: DONE_AT }, doneChecklist: [answered] })); }, false],
    ["a gated task closed by hand by the AGENT is refused (only the owner's word may replace a gate)", (p) => { p.state.tasks.push(task({ status: "done", doneAt: DONE_AT, evidence: { kind: "manual", by: "agent", at: DONE_AT, reason: "I looked at it and it seemed fine to me" }, doneChecklist: [{ ...answered, answer: "auto: manual reason by agent" }] })); }, true],
    ["a task whose gate is a report gate is refused", (p) => { p.gates.gates.push({ ...p.gates.gates[0], id: "G2", kind: "report" }); p.state.tasks.push(task({ gate: "G2" })); }, true],
    ["evidence citing a run made BEFORE the task started is refused", (p) => { p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: "2026-09-12T09:00:00+05:30", session: null, command: "true", exit: 0, durationMs: 1, result: "pass", tail: "" }); p.state.tasks.push(task({ status: "done", startedAt: "2026-09-12T10:00:00+05:30", doneAt: DONE_AT, evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: "2026-09-12T09:00:00+05:30" }, doneChecklist: [answered] })); }, true],
    ["evidence whose time differs from the run's is refused", (p) => { p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: DONE_AT, session: null, command: "true", exit: 0, durationMs: 1, result: "pass", tail: "" }); p.state.tasks.push(task({ status: "done", doneAt: DONE_AT, evidence: { kind: "gate", gate: "G1", runId: "abc12345", at: "2026-09-12T11:00:01+05:30" }, doneChecklist: [answered] })); }, true],
    ["one run cited by two tasks is refused", (p) => { p.gateRuns.push({ runId: "abc12345", gate: "G1", kind: "run", at: DONE_AT, session: null, command: "true", exit: 0, durationMs: 1, result: "pass", tail: "" }); const ev = { kind: "gate", gate: "G1", runId: "abc12345", at: DONE_AT }; p.state.tasks.push(task({ status: "done", doneAt: DONE_AT, evidence: ev, doneChecklist: [answered] }), task({ id: "T2", status: "done", doneAt: DONE_AT, evidence: ev, doneChecklist: [answered] })); }, true],
    ["an unregistered key is refused", (p) => { p.state.tasks.push(task({ proof: "trust me" })); }, true],
    ["a done plan with an open task is refused", (p) => { p.state.status = "done"; p.state.closedAt = "2026-09-12T12:00:00+05:30"; p.state.tasks.push(task({})); }, true],
    ["a manual close with a short reason is refused", (p) => { p.state.tasks.push(task({ gate: null, manualCheck: "owner looked at the page", status: "done", doneAt: "2026-09-12T11:00:00+05:30", evidence: { kind: "manual", by: "owner", at: "2026-09-12T11:00:00+05:30", reason: "looks fine" } })); }, true],
  ];
  let bad = 0;
  for (const [name, mutate, shouldFail] of cases) {
    const p = base(); mutate(p);
    const { errors } = validatePlan(p);
    const failed = errors.length > 0;
    const okk = failed === shouldFail;
    if (!okk) bad++;
    out(`${okk ? "ok  " : "FAIL"} ${name}${!okk ? ` — expected ${shouldFail ? "errors" : "no errors"}, got: ${errors.join("; ") || "none"}` : ""}`);
  }
  // CLAUDE.md block: write, detect, drift.
  const mdPath = join(box, "CLAUDE.md");
  writeBlock(mdPath, [{ id: "t1", title: "selftest plan" }]);
  const ids = idsInBlock(readFileSync(mdPath, "utf8"));
  const okBlock = Array.isArray(ids) && ids.length === 1 && ids[0] === "t1";
  if (!okBlock) bad++;
  out(`${okBlock ? "ok  " : "FAIL"} the CLAUDE.md block round-trips`);
  const unchanged = !writeBlock(mdPath, [{ id: "t1", title: "selftest plan" }]);
  if (!unchanged) bad++;
  out(`${unchanged ? "ok  " : "FAIL"} writing the same block twice changes nothing`);
  // a state.json from before the conditions of done existed loads with the defaults (the trial session crashed on this on 2026-09-12)
  {
    const oldBox = mkdtempSync(join(tmpdir(), "plan-old-"));
    const oldDir = join(oldBox, ".project-management", "plans", "old"); mkdirSync(oldDir, { recursive: true });
    const p0 = base(); p0.state.tasks.push(task({})); delete p0.state.doneWhen; for (const t of p0.state.tasks) { delete t.doneWhen; delete t.doneChecklist; }
    p0.state.id = "old"; writeFileSync(join(oldDir, FILES.state), JSON.stringify(p0.state)); writeFileSync(join(oldDir, FILES.gates), JSON.stringify(p0.gates)); writeFileSync(join(oldDir, FILES.rules), JSON.stringify(p0.rules)); writeFileSync(join(oldDir, "PLAN.md"), "# old\n");
    const self = new URL(import.meta.url).pathname; const envOld = { ...process.env, PLAN_PROJECT_ROOT: oldBox };
    const r = spawnSync("node", [self, "task", "check", "old", "T1"], { env: envOld, encoding: "utf8" });
    const okOld = r.status === 0 && r.stdout.includes("C7") && r.stdout.includes("could pass while wrong if") && r.stdout.includes("JUDGMENT OUTRANKS THE GATE");
    if (!okOld) bad++;
    out(`${okOld ? "ok  " : "FAIL"} a state.json written before the conditions existed loads with the seven defaults, and task check prints the gate's blind spots and the judgment text (exit ${r.status})`);
    // condition add picks an id above every id used anywhere, and task check shows it
    const r2 = spawnSync("node", [self, "condition", "add", "old", "--statement", "the verse count matches the plate, not the OCR"], { env: envOld, encoding: "utf8" });
    const r3 = spawnSync("node", [self, "task", "check", "old", "T1"], { env: envOld, encoding: "utf8" });
    const okCond = r2.status === 0 && r2.stdout.includes("C8 added") && r3.stdout.includes("C8 [manual] the verse count matches the plate");
    if (!okCond) bad++;
    out(`${okCond ? "ok  " : "FAIL"} condition add assigns the next free id (C8) and task check lists it (exit ${r2.status})`);
  }
  // globs: ** crosses dot-directories; * stays in a segment; relative paths resolve against cwd
  const globOk = pathMatches(".tmp/witness-full/x/ch01.json", "**/ch*.json") && pathMatches("research/translations/bphs/ch24.json", "research/translations/**/ch*.json")
    && !pathMatches("research/translations/bphs/notes/ch24.json", "research/translations/*/ch*.json") && pathMatches("a/b.ts", "a/{b,c}.ts") && !pathMatches("a/d.ts", "a/{b,c}.ts")
    && toRepoRelative("src/x.ts", "/root", "/root/sub") === "sub/src/x.ts" && toRepoRelative("/elsewhere/x.ts", "/root") === null
    && ruleMatches({ when: { tool: "Skill", prompt: "plan" } }, { toolName: "Skill", toolInput: { skill: "plan", args: "x" }, root: "/root" });
  if (!globOk) bad++;
  out(`${globOk ? "ok  " : "FAIL"} glob matching crosses dot-directories, keeps * in a segment, resolves relative paths against cwd, and sees Skill inputs`);
  // the CLAUDE.md writer never $-expands a title and collapses a duplicated block
  const mdPath2 = join(box, "CLAUDE2.md"); writeFileSync(mdPath2, "# t\n");
  writeBlock(mdPath2, [{ id: "t1", title: "costs $& and $1 dollars" }]);
  const md2 = readFileSync(mdPath2, "utf8");
  const dup = md2 + "\n" + readBlock(md2) + "\n"; writeFileSync(mdPath2, dup);
  writeBlock(mdPath2, [{ id: "t1", title: "costs $& and $1 dollars" }]);
  const md3 = readFileSync(mdPath2, "utf8");
  const okMd = md2.includes("costs $& and $1 dollars") && blockCount(md3) === 1;
  if (!okMd) bad++;
  out(`${okMd ? "ok  " : "FAIL"} the CLAUDE.md writer keeps '$&' in a title and collapses a duplicated block (${blockCount(md3)} block)`);
  // brief stays under the cap on a plan with a long log
  const p = base(); p.state.tasks.push(task({ status: "doing", startedAt: "2026-09-12T10:00:00+05:30" }));
  for (let i = 0; i < 50; i++) p.log.push({ at: "2026-09-12T10:00:00+05:30", session: null, task: "T1", what: "x".repeat(300), next: "y".repeat(300), refs: [], uncommitted: null });
  const b = renderBrief(p);
  const okBrief = b.length <= 6000 && b.includes("RESUME:") && b.includes("NOW T1");
  if (!okBrief) bad++;
  out(`${okBrief ? "ok  " : "FAIL"} the brief renders RESUME and NOW and stays under 6000 chars (${b.length})`);
  // agent brief: carries the task's files, the rule for those files, done-means, the report path and the do-nots; never the whole plan
  const pa = base(); pa.state.tasks.push(task({ files: ["x/one.ts"], effort: "max", notes: "watch the encoding" }));
  pa.rules.rules.push({ id: "R1", when: { tool: "Edit|Write", path: "x/**/*.ts" }, text: "AGENT-RULE-MARKER keep it pure", repeat: "once", why: "selftest", learning: null });
  pa.rules.rules.push({ id: "R2", when: { tool: "Edit|Write", path: "y/**" }, text: "OTHER-RULE-MARKER", repeat: "once", why: "selftest", learning: null });
  const ab = renderAgentBrief(pa, pa.state.tasks[0], { unit: "read leaf 12" });
  const okAgent = ab.length <= 3000 && ab.includes("AGENT-RULE-MARKER") && !ab.includes("OTHER-RULE-MARKER") && ab.includes("x/one.ts") && ab.includes("reports/T1-read-leaf-12.md") && ab.includes("NEVER:") && ab.includes("G1") && !ab.includes("RESUME:");
  if (!okAgent) bad++;
  out(`${okAgent ? "ok  " : "FAIL"} the agent brief carries only the task's files, its matching rule, done-means, report path and do-nots (${ab.length} chars)`);
  // two doing tasks writing the same file → warning
  const po = base(); po.state.tasks.push(task({ status: "doing", startedAt: "2026-09-12T10:00:00+05:30", files: ["x/shared.ts"] }), task({ id: "T2", status: "doing", startedAt: "2026-09-12T10:00:00+05:30", files: ["x/shared.ts"] }));
  const okOverlap = validatePlan(po).warnings.some((w) => w.includes("one writer per file"));
  if (!okOverlap) bad++;
  out(`${okOverlap ? "ok  " : "FAIL"} two tasks in flight on the same file draw a one-writer warning`);
  out(bad ? `\nselftest: ${bad} FAILED` : "\nselftest: every refusal can fire, and valid plans pass");
  process.exit(bad ? 1 : 0);
}

function help() {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n");
  const end = lines.findIndex((l) => l.trim() === "*/");
  out(lines.slice(2, end).map((l) => l.replace(/^ \* ?/, "")).join("\n"));
}

const cmd = pos[0];
const table = { init: cmdInit, update: cmdUpdate, uninstall: cmdUninstall, issue: cmdIssue, version: cmdVersion, new: cmdNew, list: cmdList, "agent-brief": cmdAgentBrief, review: cmdReview, run: cmdRun, condition: cmdCondition, validate: cmdValidate, brief: cmdBrief, status: cmdStatus, task: cmdTask, log: cmdLog, learn: cmdLearn, decide: cmdDecide, gate: cmdGate, activate: cmdActivate, pause: cmdPause, close: cmdClose, abandon: cmdAbandon, learnings: cmdLearnings, hooks: cmdHooks, doctor: cmdDoctor, schema: cmdSchema, selftest: cmdSelftest };
if (opt.version) { cmdVersion(); process.exit(0); }
if (!cmd || opt.help || !table[cmd]) { help(); process.exit(cmd && !table[cmd] ? 2 : 0); }
try { await table[cmd](); }
catch (e) {
  if (e instanceof CliExit) { err(`plan: ${e.message}`); process.exit(e.code); }
  throw e;
}
