#!/usr/bin/env node
/**
 * check-plans — the one machine-checked rail of the planner.
 *
 * It reads every PLAN.md under .project-management/plans/<id>/ and enforces a
 * single rule: a task that claims to be finished must name a proof and carry
 * evidence that the proof was run. An empty evidence cell fails the build.
 *
 * The rule is biased toward catching a faked "done": a task counts as a
 * completion claim UNLESS its status is blank or an explicit not-done word
 * (todo, doing, blocked, …). So no spelling of "done" — done, completed, ✅,
 * shipped, a typo — can slip through unchecked.
 *
 * `npx planrails init` copies this file into a project's .project-management/;
 * add `node .project-management/check-plans.mjs` to the command you run before
 * every commit. No dependencies. Runs on Node 20+ on any OS.
 *
 *   node check-plans.mjs            # structural: completion claims need proof + evidence
 *   node check-plans.mjs --verify   # ALSO re-runs each claim's proof, expects exit 0.
 *                                    #   ⚠ --verify executes the proof commands. Only run it
 *                                    #   on plans you trust — never on an untrusted pull request.
 *   node check-plans.mjs --root DIR # check a project other than the current directory
 *
 * The functions are pure over their inputs, so check-plans.test.mjs exercises
 * them without a real project.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const EMPTY = /^[\s\-—–·]*$/; // blank, or a dash/dot someone wrote for "nothing"

// A task is a completion claim unless its status is one of these. Kept generous
// so a normal not-done status is never mistaken for a claim; anything unknown is
// treated AS a claim (needs evidence), which is the safe direction for a gate.
const NOT_DONE = new Set([
  "todo", "todos", "doing", "wip", "inprogress", "started", "starting", "blocked", "block",
  "pending", "review", "inreview", "needsreview", "qa", "testing", "test", "backlog",
  "paused", "onhold", "hold", "waiting", "new", "open", "deferred", "planned", "notstarted",
  "cancelled", "canceled", "wontfix", "wontdo", "dropped", "abandoned", "skip", "skipped", "na",
]);
// A lone one of these in the evidence cell is a placeholder, not evidence.
const NON_EVIDENCE = new Set(["tbd", "tba", "tbc", "todo", "pending", "later", "wip", "none", "na"]);

/** Normalise a status or a short token for matching: drop markup, spaces, hyphens, trailing punctuation. */
function norm(s) {
  return s.replace(/[`*_[\]()'"’/]/g, "").replace(/[.!?]+$/, "").replace(/[\s-]+/g, "").replace(/️/g, "").toLowerCase();
}
function isCompletionClaim(status) {
  if (EMPTY.test(status)) return false; // blank = not filled in = not a claim
  return !NOT_DONE.has(norm(status));
}
function evidenceMissing(ev) {
  const n = norm(ev);
  return EMPTY.test(ev) || n === "" || NON_EVIDENCE.has(n);
}

/**
 * Split one markdown table row `| a | b |` into trimmed cells, respecting
 * backtick code spans and \| escapes — so a pipe inside a proof command
 * (`npm test | tail -1`) does not shift the columns.
 */
function cells(line) {
  const s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out = [];
  let cur = "";
  let inCode = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (ch === "`") { inCode = !inCode; cur += ch; continue; }
    if (ch === "|" && !inCode) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}
const isRow = (l) => l.trim().startsWith("|");
const isHeading = (l) => /^#{1,6}\s/.test(l.trim());
const isSeparator = (l) => /^\|[\s:|-]+\|?\s*$/.test(l.trim());

const REQUIRED = ["id", "status", "proof", "evidence"];
/** The column indices of a row, and which required columns it is missing. */
function headerCols(rowText) {
  const h = cells(rowText).map((c) => c.toLowerCase());
  const ci = { id: h.indexOf("id"), task: h.indexOf("task"), status: h.indexOf("status"), proof: h.indexOf("proof"), evidence: h.indexOf("evidence") };
  return { ci, missing: REQUIRED.filter((k) => ci[k] === -1) };
}

/**
 * Parse the task rows of a plan. A "task table" is any markdown table whose
 * header carries the four columns id, status, proof, evidence — found by its
 * columns, not by a heading, so tasks under "## Tasks", "## Phase 2 Tasks",
 * "## Backlog", or a second table are all read; blank lines inside a table are
 * tolerated. Returns { found, tasks, missingCols }.
 */
export function parseTasks(text) {
  const lines = text.split(/\r?\n/);
  const tasks = [];
  let found = false;
  let i = 0;
  while (i < lines.length) {
    if (!isRow(lines[i]) || isSeparator(lines[i]) || headerCols(lines[i]).missing.length) { i++; continue; }
    found = true; // lines[i] is a task-table header (a | row naming all four columns)
    const { ci } = headerCols(lines[i]);
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (isHeading(l)) break; // a heading ends the table
      if (l.trim() === "") continue; // a blank line inside the table does not
      if (!isRow(l)) break; // prose ends the table
      if (isSeparator(l)) continue;
      if (headerCols(l).missing.length === 0) break; // the next table's header — reprocess it
      const c = cells(l);
      const at = (idx) => (idx >= 0 && idx < c.length ? c[idx] : "");
      tasks.push({ id: at(ci.id), task: at(ci.task), status: at(ci.status), proof: at(ci.proof), evidence: at(ci.evidence), line: j + 1 });
    }
    i = j;
  }
  // A helpful message for the common slip: a "## Tasks" table missing one column.
  let missingCols = [];
  if (!found) {
    for (let k = 0; k < lines.length && !missingCols.length; k++) {
      if (!/^#{1,6}\s+tasks\b/i.test(lines[k].trim())) continue;
      for (let m = k + 1; m < lines.length && !isHeading(lines[m]); m++) {
        if (isRow(lines[m]) && !isSeparator(lines[m])) { const miss = headerCols(lines[m]).missing; if (miss.length && miss.length < REQUIRED.length) missingCols = miss; break; }
      }
    }
  }
  return { found, tasks, missingCols };
}

/** The command inside a proof cell (backticks stripped), or null for `owner`/prose/empty. */
export function proofCommand(proof) {
  const m = proof.match(/`([^`]+)`/);
  return m ? m[1].trim() : null;
}

/** Problems with one plan's tasks. `run` (optional) executes a proof and returns its exit code. */
export function checkPlan({ id, text, verify = false, run = null }) {
  const problems = [];
  const { found, tasks, missingCols } = parseTasks(text);
  if (!found) {
    if (missingCols.length) problems.push(`${id}: the Tasks table is missing the ${missingCols.map((c) => `"${c}"`).join(", ")} column(s)`);
    else problems.push(`${id}: no readable Tasks table (needs a | id | task | status | proof | evidence | table)`);
    return problems;
  }
  for (const t of tasks) {
    if (!isCompletionClaim(t.status)) continue;
    const noProof = EMPTY.test(t.proof);
    const noEvidence = evidenceMissing(t.evidence);
    if (noProof) problems.push(`${id} ${t.id}: status "${t.status}" names no proof (line ${t.line})`);
    if (noEvidence) problems.push(`${id} ${t.id}: status "${t.status}" but the evidence cell is empty — run the proof and paste its result (line ${t.line})`);
    if (verify && !noProof && !noEvidence && run) {
      const cmd = proofCommand(t.proof);
      if (cmd) { const code = run(cmd); if (code !== 0) problems.push(`${id} ${t.id}: proof re-run failed — \`${cmd}\` exited ${code}`); }
    }
  }
  return problems;
}

/** Plan folders under .project-management/plans/. A folder with no PLAN.md is a problem. */
export function findPlans(root) {
  const dir = join(root, ".project-management", "plans");
  const plans = [];
  const problems = [];
  if (!existsSync(dir)) return { plans, problems };
  for (const name of readdirSync(dir)) {
    let isDir = false;
    try { isDir = statSync(join(dir, name)).isDirectory(); } catch { /* ignore */ }
    if (!isDir) continue;
    const p = join(dir, name, "PLAN.md");
    if (existsSync(p)) plans.push({ id: name, path: p });
    else problems.push(`${name}: plan folder has no PLAN.md`);
  }
  return { plans, problems };
}

/** Check every plan under root. Returns { plans, problems }. */
export function checkPlans({ root = ".", verify = false } = {}) {
  const { plans, problems } = findPlans(root);
  const run = verify ? (cmd) => { const r = spawnSync(cmd, { cwd: root, shell: true, stdio: "ignore" }); return r.status ?? 1; } : null;
  for (const { id, path } of plans) {
    let text = "";
    try { text = readFileSync(path, "utf8"); } catch (e) { problems.push(`${id}: cannot read ${path} (${e.code || e.message})`); continue; }
    problems.push(...checkPlan({ id, text, verify, run }));
  }
  return { plans, problems };
}

// --- CLI ----------------------------------------------------------------------
function flagValue(args, name) {
  const eq = args.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const verify = args.includes("--verify");
  const root = flagValue(args, "--root") || ".";
  if (!existsSync(root)) { process.stderr.write(`check-plans: --root path does not exist: ${root}\n`); process.exit(2); }
  const { plans, problems } = checkPlans({ root, verify });
  if (!plans.length && !problems.length) { process.stdout.write("check-plans: no plans under .project-management/plans/ — nothing to check\n"); process.exit(0); }
  if (problems.length) {
    process.stderr.write(`check-plans: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`check-plans: ${plans.length} plan(s) ok — every completion claim has a proof and pasted evidence${verify ? " (proofs re-run)" : ""}\n`);
  process.exit(0);
}
