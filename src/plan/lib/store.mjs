/**
 * Reading, validating and writing plan directories.
 *
 * Two rules live here and nowhere else:
 *   1. A task is `done` only with evidence — a gate run this CLI recorded, or a
 *      person's word with a reason. `validatePlan` refuses anything else, whoever
 *      wrote the file. (CLAUDE.md: "NEVER TAKE A COMPLETION CLAIM FROM A DOCUMENT.
 *      RUN THE GATE." — this makes that a check instead of a sentence.)
 *   2. Every cross-reference resolves: task→gate, learning→rule/gate, rule→file,
 *      evidence→gate run. A dangling id is how a claim goes unverified.
 */
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync,
  openSync, closeSync, unlinkSync, statSync, renameSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { FILES, planDir, plansRoot, projectRoot } from "./paths.mjs";
import { SCHEMAS, formatIssues, PLAN_ID, DEFAULT_DONE_WHEN } from "./schema.mjs";
import { hoursSince } from "./time.mjs";

// ---------- low-level ---------------------------------------------------------

export function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}
export function readJsonl(path) {
  if (!existsSync(path)) return [];
  const out = [];
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    try { out.push(JSON.parse(l)); } catch { throw new Error(`${path}:${i + 1} is not JSON`); }
  }
  return out;
}
export function appendJsonl(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(obj) + "\n");
}
/** Atomic: write a temp file, then rename over the target. A crash mid-write leaves the old file intact. */
export function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  renameSync(tmp, path);
}

function sleepSync(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

/**
 * A lock around read-modify-write of state.json. Two sessions logging at once
 * would otherwise lose one of the writes. Stale locks (> 30 s) are broken —
 * a crashed process must not wedge every later one.
 */
export function withLock(path, fn) {
  const lock = `${path}.lock`;
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  for (let i = 0; i < 60; i++) {
    try {
      const fd = openSync(lock, "wx");
      writeFileSync(fd, token); closeSync(fd);
      // Release ONLY a lock that still carries our token: after a stale-break by another process, the file is theirs.
      try { return fn(); } finally { try { if (readFileSync(lock, "utf8") === token) unlinkSync(lock); } catch { /* already gone */ } }
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - statSync(lock).mtimeMs > 30_000) { unlinkSync(lock); continue; } } catch { /* raced */ }
      sleepSync(50);
    }
  }
  throw new Error(`could not lock ${path} after 3 s — another process holds ${lock}`);
}

// ---------- loading -----------------------------------------------------------

export function listPlanIds() {
  const root = plansRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, FILES.state)))
    .map((d) => d.name)
    .sort();
}

/** Everything about one plan, parsed but NOT yet validated. Missing optional files read as empty. */
/**
 * A state.json written before the conditions of done existed (or by an older copy of this
 * system in another project) has no doneWhen / doneChecklist keys. They get their defaults
 * here, on read, so no migration script is needed; the next write stores them. The schema
 * declares the same defaults, but validation reads the raw file, so this is the place that
 * every command actually goes through. (The trial session crashed on this on 2026-09-12.)
 */
export function withStateDefaults(state) {
  if (!state || typeof state !== "object") return state;
  if (!Array.isArray(state.doneWhen)) state.doneWhen = structuredClone(DEFAULT_DONE_WHEN);
  for (const t of state.tasks || []) { if (!Array.isArray(t.doneWhen)) t.doneWhen = []; if (!Array.isArray(t.doneChecklist)) t.doneChecklist = []; }
  return state;
}

export function loadPlan(id) {
  const dir = planDir(id);
  if (!existsSync(join(dir, FILES.state))) throw new Error(`no plan "${id}" at ${dir}`);
  const p = (f) => join(dir, f);
  return {
    id, dir,
    state: withStateDefaults(readJson(p(FILES.state), null)),
    gates: readJson(p(FILES.gates), { gates: [] }),
    rules: readJson(p(FILES.rules), { rules: [] }),
    log: readJsonl(p(FILES.log)),
    learnings: readJsonl(p(FILES.learnings)),
    decisions: readJsonl(p(FILES.decisions)),
    gateRuns: readJsonl(p(FILES.gateRuns)),
    planMd: existsSync(p(FILES.planMd)) ? readFileSync(p(FILES.planMd), "utf8") : "",
  };
}

/** Cheap view for hooks: state + rules only (they run on every tool call). */
export function loadPlanCheap(id) {
  const dir = planDir(id);
  return { id, dir, state: withStateDefaults(readJson(join(dir, FILES.state), null)), rules: readJson(join(dir, FILES.rules), { rules: [] }) };
}

export function activePlanIds() {
  return listPlanIds().filter((id) => { try { return readJson(join(planDir(id), FILES.state), {}).status === "active"; } catch { return false; } });
}

// ---------- validation --------------------------------------------------------

function parseOrIssues(schema, value, file, errors) {
  const r = schema.safeParse(value);
  if (!r.success) { errors.push(...formatIssues(file, r.error)); return null; }
  return r.data;
}

/**
 * Returns { errors, warnings }. Errors fail `npm run check`; warnings are printed
 * by `status` and `doctor`. The split matters: a failing gate is a normal state
 * mid-work (warning), a task marked done with no evidence is a lie (error).
 */
export function validatePlan(plan) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(`${plan.id}: ${m}`);
  const W = (m) => warnings.push(`${plan.id}: ${m}`);

  if (!plan.state) { E("state.json missing or empty"); return { errors, warnings }; }
  const state = parseOrIssues(SCHEMAS.State, plan.state, "state.json", errors);
  const gates = parseOrIssues(SCHEMAS.Gates, plan.gates, "gates.json", errors);
  const rules = parseOrIssues(SCHEMAS.Rules, plan.rules, "rules.json", errors);
  plan.log.forEach((e, i) => parseOrIssues(SCHEMAS.LogEntry, e, `log.jsonl:${i + 1}`, errors));
  plan.learnings.forEach((e, i) => parseOrIssues(SCHEMAS.Learning, e, `learnings.jsonl:${i + 1}`, errors));
  plan.decisions.forEach((e, i) => parseOrIssues(SCHEMAS.Decision, e, `decisions.jsonl:${i + 1}`, errors));
  plan.gateRuns.forEach((e, i) => parseOrIssues(SCHEMAS.GateRun, e, `gate-runs.jsonl:${i + 1}`, errors));
  if (!state || !gates || !rules) return { errors, warnings };

  if (state.id !== plan.id) E(`state.json id "${state.id}" does not match directory name`);
  if (!plan.planMd.trim()) E("PLAN.md is empty");

  const dup = (arr, what) => {
    const seen = new Set();
    for (const x of arr) { if (seen.has(x.id)) E(`duplicate ${what} id ${x.id}`); seen.add(x.id); }
  };
  dup(state.tasks, "task"); dup(gates.gates, "gate"); dup(rules.rules, "rule");
  dup(plan.learnings, "learning"); dup(plan.decisions, "decision");

  const gateIds = new Set(gates.gates.map((g) => g.id));
  const taskIds = new Set(state.tasks.map((t) => t.id));
  const ruleIds = new Set(rules.rules.map((r) => r.id));
  const learningIds = new Set(plan.learnings.map((l) => l.id));
  const passRuns = new Map(); // runId → run (kind run, pass)
  for (const r of plan.gateRuns) if (r.kind === "run" && r.result === "pass") passRuns.set(r.runId, r);
  const gateById = new Map(gates.gates.map((g) => [g.id, g]));
  const citedRuns = new Map(); // runId → task that cites it (a run proves ONE task)

  for (const t of state.tasks) {
    if (t.gate && !gateIds.has(t.gate)) E(`${t.id} names gate ${t.gate}, which gates.json does not define`);
    if (t.gate && gateById.get(t.gate)?.kind === "report") E(`${t.id} names ${t.gate}, a report gate — a report informs, it never proves a task done`);
    if (!t.gate && !t.manualCheck) E(`${t.id} has neither a gate nor a manualCheck — nothing can prove it done`);
    for (const d of t.dependsOn) if (!taskIds.has(d)) E(`${t.id} depends on ${d}, which does not exist`);
    if (t.dependsOn.includes(t.id)) E(`${t.id} depends on itself — a shifted task numbering usually causes this`);
    if (t.status === "done") {
      if (!t.evidence) E(`${t.id} is done with no evidence — run the gate (plan task done) or record a manual check`);
      else if (t.evidence.kind === "gate") {
        const run = passRuns.get(t.evidence.runId);
        if (!run) E(`${t.id} cites gate run ${t.evidence.runId}, but gate-runs.jsonl has no passing run with that id`);
        else {
          if (run.gate !== t.evidence.gate) E(`${t.id} evidence names ${t.evidence.gate} but run ${t.evidence.runId} was ${run.gate}`);
          // The run must be THIS close's run: same timestamp, after the task started, cited by no other task.
          if (run.at !== t.evidence.at) E(`${t.id} evidence time ${t.evidence.at} does not match run ${run.runId} (${run.at})`);
          if (t.startedAt && Date.parse(run.at) < Date.parse(t.startedAt)) E(`${t.id} cites run ${run.runId} made at ${run.at}, before the task started (${t.startedAt})`);
          if (citedRuns.has(run.runId)) E(`run ${run.runId} is cited by both ${citedRuns.get(run.runId)} and ${t.id} — one run proves one task`);
          citedRuns.set(run.runId, t.id);
        }
        if (t.gate && t.evidence.gate !== t.gate) E(`${t.id} was proved by ${t.evidence.gate} but its declared gate is ${t.gate}`);
        const g = gateById.get(t.evidence.gate);
        if (g?.knownFail && !verifyStatus(plan, g).verified) E(`${t.id} cites ${g.id}, which declares a known-fail case that was never verified — nothing showed the gate CAN fail; run: gate verify`);
      } else if (t.evidence.kind === "manual" && t.gate) {
        if (t.evidence.by !== "owner") E(`${t.id} has gate ${t.gate} but was closed by hand by the agent — only the owner may close a gated task without its gate`);
        else W(`${t.id} has gate ${t.gate} but was closed by the owner's word (${t.evidence.reason.slice(0, 60)}…)`);
      }
      if (!t.doneAt) E(`${t.id} is done but doneAt is null`);
      // The done checklist: every task-level statement must be answered; plan-level ones may have been added later (warn).
      const answered = new Set(t.doneChecklist.map((c) => c.id));
      if (!t.doneChecklist.length) W(`${t.id} was closed without a checklist (before doneWhen existed, or by hand) — plan review shows it`);
      else {
        for (const s of t.doneWhen) if (!answered.has(s.id)) E(`${t.id} is done but its own condition ${s.id} ("${s.statement.slice(0, 50)}…") was never answered`);
        for (const s of state.doneWhen) {
          if (answered.has(s.id)) continue;
          if (s.since && t.doneAt && Date.parse(s.since) > Date.parse(t.doneAt)) continue; // added after this task closed: not held to it
          W(`${t.id} was closed before plan condition ${s.id} existed`);
        }
      }
    } else if (t.evidence) E(`${t.id} carries evidence but is ${t.status}`);
    else if (t.doneChecklist.length) E(`${t.id} carries done-checklist answers but is ${t.status}`);
    for (const s of t.doneWhen) if (state.doneWhen.some((p) => p.id === s.id)) E(`${t.id} redefines plan condition ${s.id}; task conditions need their own ids`);
    if (t.status === "blocked" && !t.blocked) E(`${t.id} is blocked with no blocked.reason`);
    if (t.status === "doing" && t.startedAt && hoursSince(t.startedAt) > 48) W(`${t.id} has been "doing" for ${Math.round(hoursSince(t.startedAt))} h — split it or log where it stands`);
  }

  // One writer per file: two tasks in flight that both list a file is how parallel agents clobber each other
  // (CLAUDE.md: an agent reading leaves 99–112 overwrote every other leaf's layoutRule).
  const doingTasks = state.tasks.filter((t) => t.status === "doing");
  for (let i = 0; i < doingTasks.length; i++) for (let j = i + 1; j < doingTasks.length; j++) {
    const shared = doingTasks[i].files.filter((f) => doingTasks[j].files.includes(f));
    if (shared.length) W(`${doingTasks[i].id} and ${doingTasks[j].id} are both in flight and both list ${shared[0]} — one writer per file; split the files or serialise the tasks`);
  }
  for (const r of rules.rules) {
    if (r.file && !plan.dir) continue;
    if (r.file && !existsSyncSafe(join(plan.dir, r.file))) E(`rule ${r.id} points at ${r.file}, which does not exist`);
    if (r.learning && !learningIds.has(r.learning)) E(`rule ${r.id} cites learning ${r.learning}, which does not exist`);
  }
  for (const l of plan.learnings) {
    if (l.enforcement === "rule" && !(l.ref && ruleIds.has(l.ref))) E(`learning ${l.id} says it is enforced by a rule but ref "${l.ref}" is not in rules.json`);
    if (l.enforcement === "gate" && !(l.ref && gateIds.has(l.ref))) E(`learning ${l.id} says it is enforced by a gate but ref "${l.ref}" is not in gates.json`);
    if (l.enforcement === "docs" && !(l.ref && existsSyncSafe(join(projectRoot(), l.ref.split("#")[0])))) E(`learning ${l.id} says it is in docs but ref "${l.ref}" is not a file`);
    if (l.task && !taskIds.has(l.task)) E(`learning ${l.id} names task ${l.task}, which does not exist`);
  }
  for (const d of plan.decisions) {
    if (d.task && !taskIds.has(d.task)) E(`decision ${d.id} names task ${d.task}, which does not exist`);
    if (d.supersedes && !plan.decisions.some((x) => x.id === d.supersedes)) E(`decision ${d.id} supersedes ${d.supersedes}, which does not exist`);
  }
  for (const e of plan.log) if (e.task && !taskIds.has(e.task)) E(`a log entry names task ${e.task}, which does not exist`);
  for (const r of plan.gateRuns) if (!gateIds.has(r.gate)) W(`gate-runs.jsonl records ${r.gate}, which gates.json no longer defines`);

  if (state.status === "active") {
    if (!state.tasks.length) E("an active plan needs at least one task");
    if (!gates.gates.length) E("an active plan needs at least one gate");
    if (!state.paths.length) W("paths is empty — the Stop hook cannot watch this plan's work");
    if (!state.activatedAt) E("active plan has activatedAt null");
    const last = plan.log.at(-1);
    if (!last) W("no log entry yet — the brief has no RESUME line");
    else if (hoursSince(last.at) > 24 * 7) W(`last log entry is ${Math.round(hoursSince(last.at) / 24)} days old`);
    for (const g of gates.gates) {
      if (g.knownFail && !plan.gateRuns.some((r) => r.gate === g.id && r.kind === "verify" && r.result === "pass"))
        W(`gate ${g.id} has a knownFail case that has never been verified — run: plan gate verify ${plan.id} ${g.id}`);
      if (!g.knownFail && g.kind !== "report") W(`gate ${g.id} has no knownFail case — nothing shows it CAN fail`);
      else if (g.knownFail && verifyStatus(plan, g).stale) E(`gate ${g.id}'s command changed after it was last verified — a gate edited to pass must fail its known-fail case again; run: gate verify ${g.id}`);
    }
  }
  if (state.status === "done") {
    for (const t of state.tasks) if (t.status !== "done" && t.status !== "dropped") E(`plan is done but ${t.id} is ${t.status}`);
    if (!state.closedAt) E("done plan has closedAt null");
  }
  return { errors, warnings };
}

function existsSyncSafe(p) { try { return existsSync(p); } catch { return false; } }

export function validatePlanId(id) {
  const r = PLAN_ID.safeParse(id);
  if (!r.success) throw new Error(`plan id "${id}": ${r.error.issues[0].message}`);
  return id;
}

// ---------- derived views -----------------------------------------------------

export function lastRunFor(plan, gateId) {
  for (let i = plan.gateRuns.length - 1; i >= 0; i--) {
    const r = plan.gateRuns[i];
    if (r.gate === gateId && r.kind === "run") return r;
  }
  return null;
}
export function verifiedFor(plan, gateId) {
  return plan.gateRuns.some((r) => r.gate === gateId && r.kind === "verify" && r.result === "pass");
}
/**
 * Is this gate proven able to fail, for the command it has NOW? A verify run records the
 * gate's main command (gateCommand); if the command changed since, the gate is stale and
 * must be verified again. That makes "edit the gate so it passes" a visible act: the
 * edited gate cannot close a task until its known-fail case fails again. Verify runs
 * written before gateCommand existed are accepted as they are.
 */
export function verifyStatus(plan, gate) {
  let last = null;
  for (let i = plan.gateRuns.length - 1; i >= 0; i--) { const r = plan.gateRuns[i]; if (r.gate === gate.id && r.kind === "verify" && r.result === "pass") { last = r; break; } }
  const stale = Boolean(last && last.gateCommand != null && last.gateCommand !== gate.command);
  return { verified: Boolean(last), stale, last };
}
export function nextId(prefix, existing) {
  let max = 0;
  for (const x of existing) { const n = Number(String(x.id).slice(prefix.length)); if (n > max) max = n; }
  return `${prefix}${max + 1}`;
}
/**
 * Evaluate the auto:* statements of a task's checklist. `gateOutcome` is
 * { kind: "gate", run } for a run made in this same command, or { kind: "manual", reason, by }.
 * Returns entries for the auto statements and the list of failures.
 */
export function evaluateAuto(plan, task, statements, gateOutcome, { existsSyncFn = existsSync, root = projectRoot() } = {}) {
  const entries = []; const failures = [];
  for (const s of statements) {
    if (s.kind === "manual") continue;
    let ok = false, answer = "";
    if (s.kind === "auto:gate") {
      if (gateOutcome.kind === "gate" && gateOutcome.run?.result === "pass") { ok = true; answer = `auto: ${gateOutcome.run.gate} passed in this command (run ${gateOutcome.run.runId})`; }
      else if (gateOutcome.kind === "manual") { ok = true; answer = `auto: no gate run — manual reason by ${gateOutcome.by}: ${gateOutcome.reason.slice(0, 120)}`; }
      else answer = `auto: gate ${gateOutcome.run?.gate || task.gate} did not pass`;
    } else if (s.kind === "auto:logged") {
      const since = task.startedAt ? Date.parse(task.startedAt) : 0;
      const hit = [...plan.log].reverse().find((e) => e.task === task.id && Date.parse(e.at) >= since);
      ok = Boolean(hit); answer = hit ? `auto: log entry at ${hit.at}: ${hit.what.slice(0, 100)}` : `auto: no log entry names ${task.id} since it started — run: plan log <id> --task ${task.id} --what "…" --next "…"`;
    } else if (s.kind === "auto:files") {
      const missing = task.files.filter((f) => !existsSyncFn(join(root, f)));
      ok = missing.length === 0; answer = ok ? `auto: ${task.files.length} file(s) present` : `auto: missing on disk: ${missing.join(", ")}`;
    }
    entries.push({ id: s.id, statement: s.statement, kind: s.kind, answer, at: null });
    if (!ok) failures.push(`${s.id}: ${answer}`);
  }
  return { entries, failures };
}

export function taskCounts(state) {
  const c = { todo: 0, doing: 0, done: 0, blocked: 0, dropped: 0 };
  for (const t of state.tasks) c[t.status]++;
  return c;
}
