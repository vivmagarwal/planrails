/**
 * `planrails init` — set a project up, new or existing, without breaking anything
 * that is already there. Idempotent: run it twice and the second run changes
 * nothing and says so.
 *
 * What it does, in order:
 *   1. finds the project root (the cwd, or --dir)
 *   2. writes a minimal package.json if there is none
 *   3. installs planrails as a devDependency, unless it already is (or --no-install)
 *   4. copies docs/PLANNING_GUIDE.md into the project (kept if it already exists; --force overwrites)
 *   5. creates .project-management/plans/
 *   6. creates CLAUDE.md, or adds a "## Project management" section to the existing one,
 *      and puts the generated plans block above it
 *   7. adds npm scripts: plan, plan:doctor, plan:brief, plan:validate — and appends
 *      the validator to an existing "check" script
 *   8. adds .planrails/ to .gitignore
 *   9. installs the hooks into .claude/settings.json and the /plan skill
 *  10. runs doctor
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, appendFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { projectRoot, packageRoot, claudeMdPath, plansRoot, cliName } from "./plan/lib/paths.mjs";
import { writeBlock, readBlock } from "./plan/lib/claude-md.mjs";

const PM_SECTION = `## Project management

Multi-session work is tracked as **plans** under \`.project-management/plans/<id>/\`
(planrails). Create one with \`/plan <raw plan>\`. A SessionStart hook injects every
active plan's brief at the start of a session and after every compaction;
\`npx planrails brief\` prints it. A task is done only when \`npx planrails task done\`
has run its gate and every condition of done is answered. Judgment outranks the
gate: never make a red gate pass, never trust a green one blind. Guide:
\`docs/PLANNING_GUIDE.md\`.
`;

function pkgVersion() { return JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")).version; }
function readJson(p, fallback) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; } }

export async function init({ dir = null, force = false, noInstall = false, withNeverDelete = false, dryRun = false, log = console.log } = {}) {
  if (dir) process.env.PLAN_PROJECT_ROOT = resolve(dir);
  const root = projectRoot();
  const cli = cliName();
  const did = []; const kept = [];
  const note = (changed, text) => (changed ? did : kept).push(text);
  const write = (p, text) => { if (!dryRun) writeFileSync(p, text); };
  log(`planrails ${pkgVersion()} → ${root}${dryRun ? "  (dry run: nothing is written)" : ""}`);
  mkdirSync(root, { recursive: true });

  // 2. package.json
  const pkgPath = join(root, "package.json");
  let pkg = readJson(pkgPath, null);
  if (!pkg) { pkg = { name: basename(root).toLowerCase().replace(/[^a-z0-9._-]+/g, "-") || "project", version: "0.0.0", private: true }; write(pkgPath, JSON.stringify(pkg, null, 2) + "\n"); note(true, "wrote a minimal package.json"); }
  else note(false, "package.json exists");

  // 3. the devDependency
  const installed = existsSync(join(root, "node_modules", "planrails", "package.json"));
  const declared = Boolean(pkg.devDependencies?.planrails || pkg.dependencies?.planrails);
  if (installed && declared) note(false, `planrails is a dependency (${readJson(join(root, "node_modules", "planrails", "package.json"), {}).version || "?"})`);
  else if (noInstall || dryRun) note(false, `planrails not installed as a dependency (${noInstall ? "--no-install" : "dry run"}); hooks will use this copy's absolute path`);
  else {
    log(`installing planrails@${pkgVersion()} as a devDependency…`);
    const r = spawnSync("npm", ["install", "--save-dev", `planrails@${pkgVersion()}`], { cwd: root, stdio: "inherit" });
    if (r.status !== 0) { log(`npm install failed (exit ${r.status}). Fix that, or run with --no-install to continue with absolute hook paths.`); return 1; }
    note(true, `installed planrails@${pkgVersion()} as a devDependency`);
    pkg = readJson(pkgPath, pkg);
  }

  // 4. the guide
  const guideSrc = join(packageRoot(), "docs", "PLANNING_GUIDE.md");
  const guideDest = join(root, "docs", "PLANNING_GUIDE.md");
  if (!existsSync(guideDest)) { if (!dryRun) { mkdirSync(join(root, "docs"), { recursive: true }); copyFileSync(guideSrc, guideDest); } note(true, "copied docs/PLANNING_GUIDE.md"); }
  else if (readFileSync(guideDest, "utf8") === readFileSync(guideSrc, "utf8")) note(false, "docs/PLANNING_GUIDE.md is current");
  else if (force) { if (!dryRun) copyFileSync(guideSrc, guideDest); note(true, "overwrote docs/PLANNING_GUIDE.md (--force)"); }
  else note(false, `docs/PLANNING_GUIDE.md differs from this version's copy — keep yours, or refresh it with: ${cli} update`);

  // 5. plans directory
  const plans = plansRoot();
  if (!existsSync(plans)) { if (!dryRun) { mkdirSync(plans, { recursive: true }); writeFileSync(join(plans, ".gitkeep"), ""); } note(true, "created .project-management/plans/"); }
  else note(false, ".project-management/plans/ exists");

  // 6. CLAUDE.md
  const md = claudeMdPath();
  if (!existsSync(md)) { write(md, `# CLAUDE.md\n\nInstructions for AI agents working in this repository. Keep this file short; put depth in docs/.\n\n${PM_SECTION}`); note(true, "created CLAUDE.md with a Project management section"); }
  else {
    const text = readFileSync(md, "utf8");
    if (!/^## Project management\s*$/m.test(text)) { write(md, `${text.replace(/\s*$/, "")}\n\n${PM_SECTION}`); note(true, "added a Project management section to CLAUDE.md"); }
    else note(false, "CLAUDE.md has a Project management section");
  }
  if (!dryRun) {
    const before = existsSync(md) ? readFileSync(md, "utf8") : "";
    if (!readBlock(before)) {
      // Reflect the plans that already exist (an existing project may have some).
      const active = [];
      try { const { activePlanIds, loadPlanCheap } = await import("./plan/lib/store.mjs"); for (const id of activePlanIds()) { const p = loadPlanCheap(id); active.push({ id, title: p.state?.title || id }); } } catch { /* none */ }
      writeBlock(md, active);
      note(true, "added the generated plans block to CLAUDE.md");
    } else note(false, "CLAUDE.md has the plans block");
  }

  // 7. npm scripts
  pkg = readJson(pkgPath, pkg);
  pkg.scripts = pkg.scripts || {};
  const want = { plan: "planrails", "plan:doctor": "planrails doctor", "plan:brief": "planrails brief", "plan:validate": "planrails validate --all --quiet" };
  let scriptsChanged = false;
  for (const [k, v] of Object.entries(want)) if (!pkg.scripts[k]) { pkg.scripts[k] = v; scriptsChanged = true; }
  if (pkg.scripts.check && !/planrails validate/.test(pkg.scripts.check)) { pkg.scripts.check = `${pkg.scripts.check} && planrails validate --all --quiet`; scriptsChanged = true; }
  if (scriptsChanged) { write(pkgPath, JSON.stringify(pkg, null, 2) + "\n"); note(true, `added npm scripts (plan, plan:doctor, plan:brief, plan:validate${pkg.scripts.check ? "; validator appended to check" : ""})`); }
  else note(false, "npm scripts present");

  // 8. .gitignore
  const gi = join(root, ".gitignore");
  const giText = existsSync(gi) ? readFileSync(gi, "utf8") : "";
  if (!/^\.planrails\/?\s*$/m.test(giText)) { if (!dryRun) appendFileSync(gi, `${giText && !giText.endsWith("\n") ? "\n" : ""}.planrails/\n`); note(true, "added .planrails/ to .gitignore"); }
  else note(false, ".gitignore ignores .planrails/");

  // 9. hooks + skill
  const { install, status } = await import("./hooks/install.mjs");
  const r = install({ dryRun, withNeverDelete });
  note(r.changed, r.changed ? "wrote the hooks into .claude/settings.json" : "hooks already installed");

  log("");
  for (const d of did) log(`  + ${d}`);
  for (const k of kept) log(`  = ${k}`);
  if (dryRun) { log("\n(dry run) nothing was written."); return 0; }
  // 10. doctor
  const { problems } = status({ print: false });
  log(problems ? `\ndoctor: ${problems} problem(s) — run: ${cli} doctor` : "\ndoctor: healthy");
  log(`\nNext: restart Claude Code (or run /hooks), then type:  /plan <your raw plan>\nGuide: docs/PLANNING_GUIDE.md · commands: ${cli} --help`);
  return problems ? 1 : 0;
}

/** Refresh the guide, the skill and the hook entries to this version. Plans are never touched. */
export async function update({ dir = null, log = console.log } = {}) {
  if (dir) process.env.PLAN_PROJECT_ROOT = resolve(dir);
  const root = projectRoot();
  const guideSrc = join(packageRoot(), "docs", "PLANNING_GUIDE.md");
  const guideDest = join(root, "docs", "PLANNING_GUIDE.md");
  if (!existsSync(guideDest) || readFileSync(guideDest, "utf8") !== readFileSync(guideSrc, "utf8")) { mkdirSync(join(root, "docs"), { recursive: true }); copyFileSync(guideSrc, guideDest); log("refreshed docs/PLANNING_GUIDE.md"); }
  else log("docs/PLANNING_GUIDE.md is current");
  const { install, status } = await import("./hooks/install.mjs");
  install({});
  const { problems } = status({ print: false });
  log(problems ? `doctor: ${problems} problem(s) — run: ${cliName()} doctor` : "doctor: healthy");
  return problems ? 1 : 0;
}

/** Remove the hooks and the skill. Plans, the guide, CLAUDE.md and package.json are left as they are. */
export async function uninstall({ dir = null, log = console.log } = {}) {
  if (dir) process.env.PLAN_PROJECT_ROOT = resolve(dir);
  const { install } = await import("./hooks/install.mjs");
  install({ remove: true });
  log(`Left in place on purpose: .project-management/plans/, docs/PLANNING_GUIDE.md, the CLAUDE.md section and block, the npm scripts. Remove those by hand if you want them gone; npm uninstall planrails removes the package.`);
  return 0;
}
