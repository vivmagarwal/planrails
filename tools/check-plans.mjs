#!/usr/bin/env node
/**
 * check-plans — the one machine-checked rail of the planner.
 *
 * It reads every PLAN.md under .project-management/plans/<id>/ and enforces a
 * single rule: a task marked done must name a proof and must carry evidence that
 * the proof was run. An empty evidence cell on a done task fails the build.
 *
 * Copy this file into a project (e.g. scripts/check-plans.mjs) and add
 *   node scripts/check-plans.mjs
 * to the check command. No dependencies. Runs on Node 20+ on any OS.
 *
 *   node check-plans.mjs            # structural: done tasks must have proof + evidence
 *   node check-plans.mjs --verify   # also re-runs each done task's proof, expects exit 0
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
const DONE = new Set(["done", "✅", "✔"]);

/** Split one markdown table row `| a | b |` into trimmed cells. */
function cells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}
const isRow = (l) => l.trim().startsWith("|");
const isSeparator = (l) => /^\|[\s:|-]+\|?\s*$/.test(l.trim());

/** Parse the task table under a `## Tasks` heading. Returns [] if there is none. */
export function parseTasks(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^#{1,6}\s+tasks\b/i.test(l.trim()));
  if (start === -1) return [];
  let i = start + 1;
  while (i < lines.length && !isRow(lines[i]) && !/^#{1,6}\s/.test(lines[i])) i++;
  if (i >= lines.length || !isRow(lines[i])) return [];
  const header = cells(lines[i]).map((h) => h.toLowerCase());
  const col = (name) => header.indexOf(name);
  const ci = { id: col("id"), status: col("status"), proof: col("proof"), evidence: col("evidence") };
  if (ci.id === -1 || ci.status === -1 || ci.proof === -1 || ci.evidence === -1) return [];
  const tasks = [];
  for (i = i + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!isRow(l)) break; // table ends at the first non-row line
    if (isSeparator(l)) continue;
    const c = cells(l);
    const at = (idx) => (idx < c.length ? c[idx] : "");
    tasks.push({ id: at(ci.id), task: at(header.indexOf("task")), status: at(ci.status).toLowerCase(), proof: at(ci.proof), evidence: at(ci.evidence), line: i + 1 });
  }
  return tasks;
}

/** The command inside a proof cell (backticks stripped), or null for `owner`/empty. */
export function proofCommand(proof) {
  const m = proof.match(/`([^`]+)`/);
  if (m) return m[1].trim();
  if (/^owner$/i.test(proof.trim())) return null; // owner's word — no command to run
  return null;
}

/** Problems with one plan's tasks. `run` (optional) executes a proof and returns its exit code. */
export function checkPlan({ id, text, verify = false, run = null }) {
  const problems = [];
  const tasks = parseTasks(text);
  if (!tasks.length) { problems.push(`${id}: no readable Tasks table (needs a | id | task | status | proof | evidence | table under "## Tasks")`); return problems; }
  for (const t of tasks) {
    if (!DONE.has(t.status)) continue;
    const proofEmpty = EMPTY.test(t.proof);
    const evidenceEmpty = EMPTY.test(t.evidence);
    if (proofEmpty) problems.push(`${id} ${t.id}: marked done but names no proof (line ${t.line})`);
    if (evidenceEmpty) problems.push(`${id} ${t.id}: marked done but the evidence cell is empty — run the proof and paste its result (line ${t.line})`);
    if (verify && !proofEmpty && !evidenceEmpty && run) {
      const cmd = proofCommand(t.proof);
      if (cmd) {
        const code = run(cmd);
        if (code !== 0) problems.push(`${id} ${t.id}: proof re-run failed — \`${cmd}\` exited ${code}`);
      }
    }
  }
  return problems;
}

/** Every plan directory under .project-management/plans/ that has a PLAN.md. */
export function findPlans(root) {
  const dir = join(root, ".project-management", "plans");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name, "PLAN.md");
    if (existsSync(p) && statSync(p).isFile()) out.push({ id: name, path: p });
  }
  return out;
}

/** Check every plan under root. Returns { plans, problems }. */
export function checkPlans({ root = ".", verify = false } = {}) {
  const plans = findPlans(root);
  const problems = [];
  const run = verify ? (cmd) => spawnSync(cmd, { cwd: root, shell: true, stdio: "ignore" }).status ?? 1 : null;
  for (const { id, path } of plans) {
    let text = "";
    try { text = readFileSync(path, "utf8"); } catch (e) { problems.push(`${id}: cannot read ${path} (${e.code || e.message})`); continue; }
    problems.push(...checkPlan({ id, text, verify, run }));
  }
  return { plans, problems };
}

// --- CLI ----------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const verify = args.includes("--verify");
  const rootFlag = args.indexOf("--root");
  const root = rootFlag !== -1 ? args[rootFlag + 1] : ".";
  const { plans, problems } = checkPlans({ root, verify });
  if (!plans.length) { process.stdout.write("check-plans: no plans under .project-management/plans/ — nothing to check\n"); process.exit(0); }
  if (problems.length) {
    process.stderr.write(`check-plans: ${problems.length} problem(s) in ${plans.length} plan(s):\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`check-plans: ${plans.length} plan(s) ok — every done task has a proof and pasted evidence${verify ? " (proofs re-run)" : ""}\n`);
  process.exit(0);
}
