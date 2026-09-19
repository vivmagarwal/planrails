#!/usr/bin/env node
/**
 * planrails — a planner prompt and one checker. Two commands, both safe:
 *
 *   npx planrails init [--dir DIR] [--force]
 *       Puts PLANNER.md and the checker in <project>/.project-management/planrails/
 *       and makes the plans/ folder. It writes nothing else — no package.json, no npm
 *       install, no hooks, no edits to your CLAUDE.md. Run it again to update: a copy
 *       older than this package (or unstamped, 0.3.x) is replaced and you are told;
 *       a copy of this version is left alone unless --force; plans/ is never touched.
 *
 *   npx planrails check [--dir DIR] [--verify]
 *       Runs the checker over the project's plans. --verify re-runs each done
 *       task's proof. Same as running the copied .project-management/planrails/check-plans.mjs.
 *
 *   planrails --version | --help
 */
import { readFileSync, copyFileSync, mkdirSync, existsSync, writeFileSync, realpathSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPlans, isActive, formatNotes } from "../tools/check-plans.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = () => JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

const HELP = `planrails ${version()} — a planner prompt and one checker.

  npx planrails init [--dir DIR] [--force]   set a project up, or update its copy of the planner (2 files, nothing else)
  npx planrails check [--dir DIR] [--verify] check the project's plans
  planrails --version | --help

After init, tell your agent:  Follow .project-management/planrails/PLANNER.md and tell me when you are ready to plan <the feature> with me.
Add to the command you run before every commit:  node .project-management/planrails/check-plans.mjs
Full guide: https://github.com/vivmagarwal/planrails#readme`;

function flag(args, name) {
  const eq = args.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
}
const dirArg = (args) => resolve(flag(args, "--dir") || flag(args, "--root") || ".");

/** The version a copied file carries near its top (`planrails X.Y.Z`), or null for a 0.3.x copy. */
export function stampOf(text) {
  const m = text.slice(0, 400).match(/planrails (\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}
const newer = (a, b) => { const [x, y] = [a, b].map((v) => v.split(".").map(Number)); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

function init(args) {
  const target = dirArg(args);
  const force = args.includes("--force");
  const ver = version();
  const pm = join(target, ".project-management");
  const sys = join(pm, "planrails");
  const plans = join(pm, "plans");
  mkdirSync(sys, { recursive: true });
  mkdirSync(plans, { recursive: true });
  console.log(`planrails ${ver} → ${target}`);

  // The two copied files are the tool. A re-run brings them up to this package's
  // version; it never writes into plans/, and never touches anything else.
  const place = (from, to, label) => {
    const src = readFileSync(from, "utf8");
    if (!existsSync(to)) { copyFileSync(from, to); console.log(`  + ${label}`); return; }
    const cur = readFileSync(to, "utf8");
    if (cur === src) { console.log(`  = ${label} up to date (${ver})`); return; }
    const have = stampOf(cur);
    if (!force && have && newer(have, ver)) { console.log(`  · ${label} is ${have}, newer than this package (${ver}) — kept; use --force to replace`); return; }
    if (!force && have === ver) { console.log(`  · ${label} is ${ver} but edited — kept; use --force to replace`); return; }
    copyFileSync(from, to);
    console.log(`  ↑ ${label} updated ${have || "unstamped (0.3.x or older)"} → ${ver}${force ? " (--force)" : ""}`);
  };
  place(join(ROOT, "PLANNER.md"), join(sys, "PLANNER.md"), ".project-management/planrails/PLANNER.md");
  place(join(ROOT, "tools", "check-plans.mjs"), join(sys, "check-plans.mjs"), ".project-management/planrails/check-plans.mjs");
  const keep = join(plans, ".gitkeep");
  if (!existsSync(keep)) { writeFileSync(keep, ""); console.log("  + .project-management/plans/"); }
  else console.log("  = .project-management/plans/ (your plans are never touched)");
  // A plan written before 0.5 has no session: line and an older block. init never
  // touches a plan, so say which ones need the by-hand update from CHANGELOG 0.5.0.
  for (const name of existsSync(plans) ? readdirSync(plans) : []) {
    const pf = join(plans, name, "PLAN.md");
    if (!existsSync(pf)) continue;
    const text = readFileSync(pf, "utf8");
    if (isActive(text) && !/^session:/m.test(text)) console.log(`  ! plan ${name} predates 0.5: add a session: line to its NOW and replace its "How to work this plan" block with the template's in .project-management/planrails/PLANNER.md; until then a second session cannot tell who holds it`);
  }
  const loose = ["PLANNER.md", "check-plans.mjs"].filter((f) => existsSync(join(pm, f)));
  if (loose.length) console.log(`  ! 0.2.x files at .project-management/ root: ${loose.join(", ")} — the copies now live in planrails/; delete the loose ones and point your check command at .project-management/planrails/check-plans.mjs`);

  console.log(`
Next:
  1. Tell your agent:  Follow .project-management/planrails/PLANNER.md and tell me when you are ready to plan <the feature> with me.
     (Or, in Claude Code, use /planrails if you installed the skill.)
  2. Add to the command you run before every commit:
       node .project-management/planrails/check-plans.mjs
  3. When the agent writes a plan, it adds one line to your CLAUDE.md so the plan
     reloads after every compaction:  @.project-management/plans/<id>/PLAN.md`);
  return 0;
}

function check(args) {
  const root = dirArg(args);
  if (!existsSync(root)) { console.error(`planrails check: --dir path does not exist: ${root}`); return 2; }
  const verify = args.includes("--verify");
  const { plans, problems, notes } = checkPlans({ root, verify });
  process.stdout.write(formatNotes(notes));
  if (!plans.length && !problems.length) { console.log("check-plans: no plans under .project-management/plans/ — nothing to check"); return 0; }
  if (problems.length) {
    console.error(`check-plans: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    return 1;
  }
  console.log(`check-plans: ${plans.length} plan(s) ok — every completion claim has a proof and exit 0 evidence, active plans reload, NOW is current${verify ? " (proofs re-run)" : ""}`);
  return 0;
}

// Run the CLI only when this file is the entry point. npm installs the bin as a
// symlink, so compare real paths, or `npx planrails` would import and do nothing.
const isMain = (() => { try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(version()); process.exit(0); }
  if (!cmd || cmd === "--help" || cmd === "-h") { console.log(HELP); process.exit(cmd ? 0 : 1); }
  if (cmd === "init") process.exit(init(args));
  if (cmd === "check") process.exit(check(args));
  console.error(`planrails: unknown command "${cmd}"\n\n${HELP}`);
  process.exit(2);
}
