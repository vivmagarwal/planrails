/**
 * Where planrails keeps things, and how it finds the project.
 *
 * One root, everything hangs off it. The root is, in order:
 *   1. PLAN_PROJECT_ROOT   — set by tests, which point it at a throwaway directory
 *   2. CLAUDE_PROJECT_DIR  — set by Claude Code for every hook command (measured on 2.1.269)
 *   3. the nearest directory above the cwd holding .project-management/ or CLAUDE.md
 *   4. the nearest directory above the cwd holding package.json or .git
 *   5. the cwd
 * So `npx planrails …` works from any subdirectory of a project, and a hook
 * always sees the project the session was started in.
 */
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The installed package itself: src/plan/lib → ../../.. */
export function packageRoot() { return resolve(HERE, "..", "..", ".."); }

function findUp(start, markers) {
  let d = resolve(start);
  for (;;) {
    if (markers.some((m) => existsSync(join(d, m)))) return d;
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

export function projectRoot() {
  if (process.env.PLAN_PROJECT_ROOT) return resolve(process.env.PLAN_PROJECT_ROOT);
  if (process.env.CLAUDE_PROJECT_DIR) return resolve(process.env.CLAUDE_PROJECT_DIR);
  return findUp(process.cwd(), [".project-management", "CLAUDE.md"]) || findUp(process.cwd(), ["package.json", ".git"]) || process.cwd();
}
/** How the CLI is invoked in messages the tool prints for the agent. */
export function cliName() { return process.env.PLAN_CLI_NAME || "npx planrails"; }

export function plansRoot() { return join(projectRoot(), ".project-management", "plans"); }
export function planDir(id) { return join(plansRoot(), id); }
export function claudeMdPath() { return join(projectRoot(), "CLAUDE.md"); }
export function claudeSettingsPath() { return join(projectRoot(), ".claude", "settings.json"); }
/** Everything planrails writes that is NOT the plan itself lives under .planrails/ (gitignored by init). */
export function stateRoot() { return join(projectRoot(), ".planrails"); }
/** Per-session scratch for the hooks: injected rules, unlogged edits, reminders. */
export function hookStateRoot() { return join(stateRoot(), "hooks"); }
/** The pre-compaction progress journals, one file per session. */
export function journalRoot() { return join(stateRoot(), "journal"); }
/** Backups of .claude/settings.json taken before the installer writes it. */
export function backupRoot() { return join(stateRoot(), "backups"); }
/** What `planrails run` recorded about each fresh session. */
export function runsRoot() { return join(stateRoot(), "runs"); }

/** The files of one plan. Each has ONE job and ONE writer (see docs/PLANNING_GUIDE.md § The files). */
export const FILES = {
  planMd: "PLAN.md",            // narrative — hand-written, stable
  state: "state.json",          // manifest + tasks — CLI-written after creation
  gates: "gates.json",          // gate definitions — planner-written, validated
  rules: "rules.json",          // just-in-time rules — planner-written, validated
  log: "log.jsonl",             // progress — CLI append
  learnings: "learnings.jsonl", // CLI append
  decisions: "decisions.jsonl", // CLI append
  gateRuns: "gate-runs.jsonl",  // CLI append — every gate execution
};
