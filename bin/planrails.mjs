#!/usr/bin/env node
/**
 * planrails — a planner prompt and one checker. Two commands, both safe:
 *
 *   npx planrails init [--dir DIR] [--force]
 *       Copies PLANNER.md and the checker into <project>/.project-management/planrails/
 *       and makes the plans/ folder. It writes nothing else — no package.json, no npm
 *       install, no hooks, no edits to your CLAUDE.md. Idempotent: it skips files
 *       that already exist unless you pass --force.
 *
 *   npx planrails check [--dir DIR] [--verify]
 *       Runs the checker over the project's plans. --verify re-runs each done
 *       task's proof. Same as running the copied .project-management/planrails/check-plans.mjs.
 *
 *   planrails --version | --help
 */
import { readFileSync, copyFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPlans } from "../tools/check-plans.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = () => JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

const HELP = `planrails ${version()} — a planner prompt and one checker.

  npx planrails init [--dir DIR] [--force]   set a project up (copies 2 files, writes nothing else)
  npx planrails check [--dir DIR] [--verify] check the project's plans
  planrails --version | --help

After init, tell your agent:  Follow .project-management/planrails/PLANNER.md and plan <the feature> with me.
Add to the command you run before every commit:  node .project-management/planrails/check-plans.mjs
Full guide: https://github.com/vivmagarwal/planrails#readme`;

function flag(args, name) {
  const eq = args.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
}

function init(args) {
  const target = resolve(flag(args, "--dir") || ".");
  const force = args.includes("--force");
  const pm = join(target, ".project-management");
  const sys = join(pm, "planrails");
  const plans = join(pm, "plans");
  mkdirSync(sys, { recursive: true });
  mkdirSync(plans, { recursive: true });

  const copy = (from, to, label) => {
    if (existsSync(to) && !force) { console.log(`  · ${label} already present (use --force to overwrite)`); return; }
    copyFileSync(from, to);
    console.log(`  + ${label}`);
  };
  console.log(`planrails ${version()} → ${target}`);
  copy(join(ROOT, "PLANNER.md"), join(sys, "PLANNER.md"), ".project-management/planrails/PLANNER.md");
  copy(join(ROOT, "tools", "check-plans.mjs"), join(sys, "check-plans.mjs"), ".project-management/planrails/check-plans.mjs");
  const keep = join(plans, ".gitkeep");
  if (!existsSync(keep)) { writeFileSync(keep, ""); console.log("  + .project-management/plans/"); }
  else console.log("  · .project-management/plans/ already present");

  console.log(`
Next:
  1. Tell your agent:  Follow .project-management/planrails/PLANNER.md and plan <the feature> with me.
     (Or, in Claude Code, use /plan if you installed the skill.)
  2. Add to the command you run before every commit:
       node .project-management/planrails/check-plans.mjs
  3. When the agent writes a plan, it adds one line to your CLAUDE.md so the plan
     reloads after every compaction:  @.project-management/plans/<id>/PLAN.md`);
  return 0;
}

function check(args) {
  const root = resolve(flag(args, "--dir") || ".");
  if (!existsSync(root)) { console.error(`planrails check: --dir path does not exist: ${root}`); return 2; }
  const verify = args.includes("--verify");
  const { plans, problems } = checkPlans({ root, verify });
  if (!plans.length && !problems.length) { console.log("check-plans: no plans under .project-management/plans/ — nothing to check"); return 0; }
  if (problems.length) {
    console.error(`check-plans: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    return 1;
  }
  console.log(`check-plans: ${plans.length} plan(s) ok — every completion claim has a proof and pasted evidence${verify ? " (proofs re-run)" : ""}`);
  return 0;
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "--version" || cmd === "-v") { console.log(version()); process.exit(0); }
if (!cmd || cmd === "--help" || cmd === "-h") { console.log(HELP); process.exit(cmd ? 0 : 1); }
if (cmd === "init") process.exit(init(args));
if (cmd === "check") process.exit(check(args));
console.error(`planrails: unknown command "${cmd}"\n\n${HELP}`);
process.exit(2);
