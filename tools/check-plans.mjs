#!/usr/bin/env node
// planrails 0.5.2
/**
 * check-plans — the machine-checked rails of the planner.
 *
 * It reads every PLAN.md under .project-management/plans/<id>/ and enforces:
 *  - a task that claims to be finished must name a proof — a `command` in
 *    backticks, or the word owner — and carry evidence that the proof was run.
 *    For a command that means its exit code, pasted, and the code must be 0. An
 *    empty evidence cell, a bare word, or a recorded failure is not done.
 *  - an active plan must reload: when the project has a CLAUDE.md, it must carry
 *    `@.project-management/plans/<id>/PLAN.md` on its own line, and no such line
 *    may point at a plan that does not exist. (Skipped when there is no CLAUDE.md.)
 *  - NOW must be current: an active plan with a NOW section keeps its RESUME
 *    line, and that line may not name only finished tasks. A retired plan says `status: done` (or paused) and is exempt
 *    from both; a plan with no status line counts as active.
 *
 * The rule is biased toward catching a faked "done": a task counts as a
 * completion claim UNLESS its status is blank or an explicit not-done word
 * (todo, doing, blocked, …). So no spelling of "done" — done, completed, ✅,
 * shipped, a typo — can slip through unchecked. A row the parser cannot read
 * (its cell count differs from the header's) is a problem, never a pass.
 *
 * `npx planrails init` copies this file into a project's .project-management/planrails/;
 * add `node .project-management/planrails/check-plans.mjs` to the command you run before
 * every commit. No dependencies. Runs on Node 20+ on any OS.
 *
 *   node check-plans.mjs            # structural: completion claims need proof + exit 0 evidence
 *   node check-plans.mjs --verify   # ALSO re-runs each claim's proof, expects exit 0; a proof that
 *                                    #   fails shows its last output line, one that hangs times out.
 *                                    #   ⚠ --verify executes the proof commands. Only run it
 *                                    #   on plans you trust — never on an untrusted pull request.
 *   node check-plans.mjs --root DIR # check a project other than the current directory (--dir works too)
 *
 * The functions are pure over their inputs, so check-plans.test.mjs exercises
 * them without a real project.
 */
import { readdirSync, readFileSync, existsSync, statSync, realpathSync } from "node:fs";
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
// The exit codes inside an evidence cell: "exit 0", "exit code 1", "exit status 1", "exited 3", "exit=0".
// Every occurrence counts, so "exit 0 … then exit 1" is a failure, not a pass.
const EXIT_CODE = /\bexit(?:ed|[\s-]*(?:code|status))?\s*[:=]?\s*(-?\d+)/gi;
const DATE = /\b\d{4}-\d{2}-\d{2}\b/;

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
 * Split one markdown table row `| a | b |` into trimmed cells. A `|` inside a
 * code span does not split (so `npm test | tail -1` stays one cell) and `\|` is
 * a literal pipe. Code spans follow the CommonMark rule: a run of N backticks
 * opens a span only if a run of exactly N closes it later in the row; otherwise
 * the run is literal text. So a stray backtick, or three backticks written in
 * prose, shifts nothing — and a row that still comes out short is reported.
 */
function cells(line) {
  const s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (ch === "`") {
      let n = 1;
      while (s[i + n] === "`") n++;
      const close = closingRun(s, i + n, n);
      if (close === -1) { cur += s.slice(i, i + n); i += n - 1; continue; } // unmatched: literal backticks
      cur += s.slice(i, close + n).replace(/\\\|/g, "|");
      i = close + n - 1;
      continue;
    }
    if (ch === "|") { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}
/** The index of the next backtick run of exactly n characters in s at or after `from`, or -1. */
function closingRun(s, from, n) {
  for (let j = from; j < s.length;) {
    if (s[j] !== "`") { j++; continue; }
    let m = 1;
    while (s[j + m] === "`") m++;
    if (m === n) return j;
    j += m;
  }
  return -1;
}
const isRow = (l) => l.trim().startsWith("|");
const isHeading = (l) => /^#{1,6}\s/.test(l.trim());
const isSeparator = (l) => /^\|[\s:|-]+\|?\s*$/.test(l.trim());
/**
 * True for every line inside a ``` or ~~~ fence, and for the fence lines themselves:
 * never a table row. A fence closes only with a fence of the same character and at
 * least the same length (CommonMark), so a ```` block can hold a ``` example.
 */
function fenceMask(lines) {
  const m = new Array(lines.length);
  let open = null; // { ch, len } of the fence we are inside
  for (let k = 0; k < lines.length; k++) {
    const f = lines[k].match(/^\s*(`{3,}|~{3,})/);
    if (f && !open) { open = { ch: f[1][0], len: f[1].length }; m[k] = true; continue; }
    if (f && open && f[1][0] === open.ch && f[1].length >= open.len && lines[k].trim() === f[1]) { open = null; m[k] = true; continue; }
    m[k] = open !== null;
  }
  return m;
}

const REQUIRED = ["id", "status", "proof", "evidence"];
/** The column indices of a header row (markup like **id** ignored), which required columns it is missing, and its cell count. */
function headerCols(rowText) {
  const h = cells(rowText).map((c) => c.replace(/[*_`]/g, "").trim().toLowerCase());
  const ci = { id: h.indexOf("id"), task: h.indexOf("task"), status: h.indexOf("status"), proof: h.indexOf("proof"), evidence: h.indexOf("evidence") };
  return { ci, missing: REQUIRED.filter((k) => ci[k] === -1), count: h.length };
}

/**
 * Parse the task rows of a plan. A "task table" is any markdown table whose
 * header carries the four columns id, status, proof, evidence — found by its
 * columns, not by a heading, so tasks under "## Tasks", "## Phase 2 Tasks",
 * "## Backlog", or a second table are all read. Blank lines inside a table are
 * tolerated; a heading, prose, a code fence, or another table's header ends it.
 * Returns { found, tasks, missingCols }. Each task carries its cell count and
 * the header's, so a row the splitter could not read is visible to the gate.
 */
export function parseTasks(text) {
  const lines = text.split(/\r?\n/);
  const fenced = fenceMask(lines);
  const tasks = [];
  let found = false;
  let i = 0;
  while (i < lines.length) {
    if (fenced[i] || !isRow(lines[i]) || isSeparator(lines[i]) || headerCols(lines[i]).missing.length) { i++; continue; }
    found = true; // lines[i] is a task-table header (a | row naming all four columns)
    const { ci, count } = headerCols(lines[i]);
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (fenced[j] || isHeading(l)) break; // a fence or a heading ends the table
      if (l.trim() === "") continue; // a blank line inside the table does not
      if (!isRow(l)) break; // prose ends the table
      if (isSeparator(l)) continue;
      if (headerCols(l).missing.length === 0) break; // the next task table's header — reprocess it
      if (j + 1 < lines.length && isRow(lines[j + 1]) && isSeparator(lines[j + 1])) break; // any other table's header
      const c = cells(l);
      const at = (idx) => (idx >= 0 && idx < c.length ? c[idx] : "");
      tasks.push({ id: at(ci.id), task: at(ci.task), status: at(ci.status), proof: at(ci.proof), evidence: at(ci.evidence), line: j + 1, cellCount: c.length, headerCount: count });
    }
    i = j;
  }
  // A helpful message for the common slip: a "## Tasks" table missing one column.
  let missingCols = [];
  if (!found) {
    for (let k = 0; k < lines.length && !missingCols.length; k++) {
      if (fenced[k] || !/^#{1,6}\s+tasks\b/i.test(lines[k].trim())) continue;
      for (let m = k + 1; m < lines.length && !isHeading(lines[m]); m++) {
        if (isRow(lines[m]) && !isSeparator(lines[m])) { const miss = headerCols(lines[m]).missing; if (miss.length && miss.length < REQUIRED.length) missingCols = miss; break; }
      }
    }
  }
  return { found, tasks, missingCols };
}

/** The command in a proof cell that is exactly one `code span` (backticks stripped), or null for `owner`, prose, a span inside prose, or empty. */
export function proofCommand(proof) {
  const m = proof.trim().match(/^`([^`]+)`$/);
  return m ? m[1].trim() : null;
}

/** Problems with one plan's tasks. `run` (optional) executes a proof and returns its exit code, or { code, last }. */
export function checkPlan({ id, text, verify = false, run = null }) {
  const problems = [];
  const { found, tasks, missingCols } = parseTasks(text);
  if (!found) {
    if (missingCols.length) problems.push(`${id}: the Tasks table is missing the ${missingCols.map((c) => `"${c}"`).join(", ")} column(s)`);
    else problems.push(`${id}: no readable Tasks table (needs a | id | task | status | proof | evidence | table)`);
    return problems;
  }
  for (const t of tasks) {
    if (t.cellCount !== t.headerCount) {
      problems.push(`${id} line ${t.line}: row has ${t.cellCount} cell(s) but the header has ${t.headerCount} — a stray | or backtick? A row the gate cannot read fails closed`);
      continue;
    }
    if (!isCompletionClaim(t.status)) continue;
    const noProof = EMPTY.test(t.proof);
    const cmd = proofCommand(t.proof);
    const owner = norm(t.proof) === "owner";
    const noEvidence = evidenceMissing(t.evidence);
    if (noProof) problems.push(`${id} ${t.id}: status "${t.status}" names no proof (line ${t.line})`);
    else if (!cmd && !owner) problems.push(`${id} ${t.id}: the proof must be a \`command\` in backticks or the word owner, not "${t.proof}" (line ${t.line})`);
    if (noEvidence) problems.push(`${id} ${t.id}: status "${t.status}" but the evidence cell is empty — run the proof and paste its result (line ${t.line})`);
    else if (cmd) {
      const codes = [...t.evidence.matchAll(EXIT_CODE)].map((m) => m[1]);
      const bad = codes.find((x) => x !== "0");
      if (!codes.length) problems.push(`${id} ${t.id}: evidence does not record the proof's exit code — run it and paste "exit 0" with the last line (line ${t.line})`);
      else if (bad !== undefined) problems.push(`${id} ${t.id}: evidence records exit ${bad} — the proof failed, so the task is not done (line ${t.line})`);
    } else if (owner && !DATE.test(t.evidence)) {
      problems.push(`${id} ${t.id}: an owner-closed task records the owner's words with the date, e.g. "2026-09-13 owner: ship it" (line ${t.line})`);
    }
    if (verify && cmd && !noEvidence && run) {
      const r = run(cmd);
      const code = typeof r === "number" ? r : r.code;
      if (code !== 0) problems.push(`${id} ${t.id}: proof re-run failed — \`${cmd}\` exited ${code}${r.last ? ` — ${r.last}` : ""}`);
    }
  }
  // NOW must point somewhere live: an active plan keeps its RESUME line, and a
  // RESUME line that names only finished tasks is stale.
  if (isActive(text)) {
    const ls = text.split(/\r?\n/), fm = fenceMask(ls);
    if (ls.some((l, k) => !fm[k] && /^#{1,6}\s+NOW\b/.test(l)) && !ls.some((l, k) => !fm[k] && /^\s*RESUME:/.test(l))) problems.push(`${id}: NOW has no RESUME line — an active plan keeps RESUME, NEXT, updated and session; a finished plan says status: done`);
    const named = resumeIds(text, tasks.map((t) => t.id).filter(Boolean));
    if (named.length && named.every((n) => tasks.some((t) => t.id === n && isCompletionClaim(t.status))))
      problems.push(`${id}: NOW is stale — RESUME names ${named.map((n) => n.replace(/[`*_]/g, "")).join(", ")}, which ${named.length === 1 ? "is" : "are all"} done; point it at the next open task, or set the plan's status to done`);
  }
  return problems;
}

/**
 * Active unless the header says otherwise: `status: done`, `paused`, or another
 * finished word exempts a plan from the reload and NOW rules. A plan with no
 * status line counts as active — the safe direction for a gate.
 */
const NOT_ACTIVE = new Set(["done", "paused", "retired", "closed", "shipped", "finished", "complete", "completed", "archived", "dropped", "cancelled", "canceled", "abandoned", "superseded", "onhold", "hold"]);
export function isActive(text) {
  const m = text.match(/^status:\s*([^\s·|]+)/im);
  return !(m && NOT_ACTIVE.has(norm(m[1])));
}
/** The task ids the RESUME line names, out of the plan's own ids (T1 does not match inside T12). */
function resumeIds(text, ids) {
  const m = text.match(/^\s*RESUME:(.*)$/m);
  if (!m) return [];
  const plain = (id) => id.replace(/[`*_\s]/g, "");
  return ids.filter((id) => plain(id) && new RegExp(`(^|[^A-Za-z0-9])${plain(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`).test(m[1]));
}
/** The plan ids a CLAUDE.md reloads: `@.project-management/plans/<id>/PLAN.md` on its own line, outside a fence. */
export function reloadLines(text) {
  const lines = text.split(/\r?\n/);
  const fenced = fenceMask(lines);
  const ids = new Set();
  lines.forEach((l, k) => {
    const m = !fenced[k] && l.match(/^\s*@\.project-management\/plans\/([^/\s]+)\/PLAN\.md\s*$/);
    if (m) ids.add(m[1]);
  });
  return ids;
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

/** Run one proof command in root: its exit code (or "timeout after Ns") and the last line it printed. */
export function runProof(cmd, root, timeoutMs) {
  const r = spawnSync(cmd, { cwd: root, shell: true, encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
  const last = `${r.stdout || ""}\n${r.stderr || ""}`.trim().split(/\r?\n/).filter(Boolean).pop() || "";
  if (r.error && r.error.code === "ETIMEDOUT") return { code: `timeout after ${timeoutMs / 1000}s`, last };
  return { code: r.status ?? 1, last };
}

/** Check every plan under root. Returns { plans, problems }. `--verify` re-runs proofs, each with a timeout (10 min by default). */
export function checkPlans({ root = ".", verify = false, verifyTimeoutMs = 10 * 60 * 1000 } = {}) {
  const { plans, problems } = findPlans(root);
  const run = verify ? (cmd) => runProof(cmd, root, verifyTimeoutMs) : null;
  const claudeMd = join(root, "CLAUDE.md");
  const reloads = existsSync(claudeMd) ? reloadLines(readFileSync(claudeMd, "utf8")) : null;
  for (const { id, path } of plans) {
    let text = "";
    try { text = readFileSync(path, "utf8"); } catch (e) { problems.push(`${id}: cannot read ${path} (${e.code || e.message})`); continue; }
    problems.push(...checkPlan({ id, text, verify, run }));
    if (reloads && isActive(text) && !reloads.has(id))
      problems.push(`${id}: the plan is active but CLAUDE.md has no reload line — add "@.project-management/plans/${id}/PLAN.md" on its own line, outside backticks, or the plan will not survive a compaction`);
  }
  if (reloads) for (const id of reloads) if (!plans.some((p) => p.id === id)) problems.push(`CLAUDE.md reloads "${id}" but .project-management/plans/${id}/PLAN.md does not exist`);
  return { plans, problems };
}

// --- CLI ----------------------------------------------------------------------
function flagValue(args, name) {
  const eq = args.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
}

// Run the CLI only when this file is the entry point. Compare real paths: through a
// symlink, or /tmp vs /private/tmp on macOS, a textual comparison fails and a gate
// that silently does nothing exits 0 — the one thing a gate must never do.
const real = (p) => { try { return realpathSync.native(p); } catch { return realpathSync(p); } };
const isMain = (() => { try { return Boolean(process.argv[1]) && real(process.argv[1]) === real(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  const verify = args.includes("--verify");
  const root = flagValue(args, "--root") || flagValue(args, "--dir") || ".";
  if (!existsSync(root)) { process.stderr.write(`check-plans: --root path does not exist: ${root}\n`); process.exit(2); }
  const { plans, problems } = checkPlans({ root, verify });
  if (!plans.length && !problems.length) { process.stdout.write("check-plans: no plans under .project-management/plans/ — nothing to check\n"); process.exit(0); }
  if (problems.length) {
    process.stderr.write(`check-plans: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`check-plans: ${plans.length} plan(s) ok — every completion claim has a proof and exit 0 evidence, active plans reload, NOW is current${verify ? " (proofs re-run)" : ""}\n`);
  process.exit(0);
}
