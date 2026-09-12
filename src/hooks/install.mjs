#!/usr/bin/env node
/**
 * Install (or remove) the planrails hooks and the /plan skill in a project.
 *
 *   npx planrails hooks install [--with-never-delete] [--dry-run]
 *   npx planrails hooks status
 *   npx planrails hooks uninstall
 *
 * What it writes: the hook entries in <project>/.claude/settings.json, keeping
 * every other setting exactly as it was (a backup goes to .planrails/backups/
 * first), and the /plan skill at <project>/.claude/skills/plan/SKILL.md.
 *
 * Hook commands use `$CLAUDE_PROJECT_DIR`, which Claude Code sets for every hook
 * command (measured on 2.1.269), so settings.json is portable: commit it once
 * and every teammate's machine runs the copy in THEIR node_modules. If planrails
 * is not installed under the project's node_modules (a checkout, a global
 * install), the command falls back to the absolute path of this copy and
 * `doctor` says so. Paths are always quoted: an unquoted path with a space runs
 * `node /Users/x/My` and silently disables every hook.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, realpathSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { projectRoot, packageRoot, claudeSettingsPath, backupRoot, cliName } from "../plan/lib/paths.mjs";
import { nowIso } from "../plan/lib/time.mjs";

const HOOKS_DIR = dirname(fileURLToPath(import.meta.url));

/** The managed set. Order within an event is the order Claude Code runs them. */
export const MANAGED = [
  { event: "SessionStart", file: "plan-session-start.mjs", runner: "node", timeout: 20, statusMessage: "Loading active plan briefs" },
  { event: "PreToolUse", matcher: "Edit|Write|MultiEdit|NotebookEdit|Bash|Read|Agent|Workflow|WebSearch|WebFetch|Skill", file: "plan-pre-tool.mjs", runner: "node", timeout: 10 },
  { event: "SubagentStart", file: "plan-subagent-start.mjs", runner: "node", timeout: 10 },
  { event: "Stop", file: "plan-stop.mjs", runner: "node", timeout: 15 },
  { event: "PreCompact", file: "precompact-journal.mjs", runner: "node", timeout: 60, statusMessage: "Writing progress journal before compaction" },
  { event: "PostCompact", file: "postcompact-journal.mjs", runner: "node", timeout: 15 },
];
/** Opt-in: blocks rm/rmdir/unlink/shred in Bash so an unattended run never stalls on a delete prompt, and nothing is lost by mistake. Needs jq. */
export const OPTIONAL = {
  "never-delete": { event: "PreToolUse", matcher: "Bash", file: "guard-never-delete.sh", runner: "bash", timeout: 10 },
};
const ALL_FILES = new Set([...MANAGED, ...Object.values(OPTIONAL)].map((m) => m.file));
const SKILL_SRC = join(HOOKS_DIR, "..", "plan", "skill", "SKILL.md");

function same(a, b) { try { return realpathSync(a) === realpathSync(b); } catch { return false; } }
/** Portable when the package sits in the project's node_modules; absolute otherwise. */
export function commandFor(m) {
  const viaNodeModules = same(packageRoot(), join(projectRoot(), "node_modules", "planrails"));
  const path = viaNodeModules ? `$CLAUDE_PROJECT_DIR/node_modules/planrails/src/hooks/${m.file}` : join(HOOKS_DIR, m.file);
  return `${m.runner} "${path}"`;
}
function entryFor(m) {
  const hook = { type: "command", command: commandFor(m), timeout: m.timeout };
  if (m.statusMessage) hook.statusMessage = m.statusMessage;
  return m.matcher ? { matcher: m.matcher, hooks: [hook] } : { hooks: [hook] };
}
/** Is this command one of ours? Also matches the pre-package layouts (scripts/hooks, .claude/hooks) so an upgrade replaces them. */
function isManaged(cmd) {
  const m = /(?:\/src\/hooks\/|\/scripts\/hooks\/|\/\.claude\/hooks\/)([A-Za-z0-9_.-]+)/.exec(String(cmd || ""));
  return Boolean(m && ALL_FILES.has(m[1]));
}
function readSettings() {
  const p = claudeSettingsPath();
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8"));
}
export function skillDest() { return join(projectRoot(), ".claude", "skills", "plan", "SKILL.md"); }
function skillText() { return readFileSync(SKILL_SRC, "utf8").replace(/npx planrails/g, cliName()); }
/** Expand $CLAUDE_PROJECT_DIR the way the shell will, for existence checks. */
function namedPath(cmd) {
  const q = String(cmd).match(/"([^"]+)"/)?.[1] || String(cmd).split(/\s+/)[1] || "";
  return q.replace(/^\$CLAUDE_PROJECT_DIR/, projectRoot());
}

export function install({ dryRun = false, withNeverDelete = false, remove = false } = {}) {
  const cli = cliName();
  const p = claudeSettingsPath();
  const before = readSettings();
  const settings = JSON.parse(JSON.stringify(before));
  settings.hooks = settings.hooks || {};
  const replaced = [];
  const wanted = remove ? [] : [...MANAGED, ...(withNeverDelete ? [OPTIONAL["never-delete"]] : [])];
  // Keep an optional guard that was installed earlier, even if this run did not ask for it.
  const hadNeverDelete = Object.values(settings.hooks).some((es) => (es || []).some((e) => (e.hooks || []).some((h) => String(h.command).includes("guard-never-delete.sh"))));
  if (!remove && hadNeverDelete && !withNeverDelete) wanted.push(OPTIONAL["never-delete"]);
  for (const [event, entries] of Object.entries(settings.hooks)) {
    const kept = [];
    for (const e of entries || []) {
      const ours = (e.hooks || []).filter((h) => isManaged(h.command));
      const theirs = (e.hooks || []).filter((h) => !isManaged(h.command));
      for (const h of ours) if (!String(h.command).includes("/src/hooks/")) replaced.push(`${event}: ${h.command}`);
      if (theirs.length) kept.push({ ...e, hooks: theirs });
    }
    settings.hooks[event] = kept;
  }
  for (const m of wanted) (settings.hooks[m.event] = settings.hooks[m.event] || []).push(entryFor(m));
  for (const k of Object.keys(settings.hooks)) if (!settings.hooks[k].length) delete settings.hooks[k];
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  const changed = JSON.stringify(before) !== JSON.stringify(settings);
  const lines = [];
  if (replaced.length) lines.push(`replacing ${replaced.length} older entr${replaced.length === 1 ? "y" : "ies"}:\n  ${replaced.join("\n  ")}`);
  lines.push(`${changed ? (dryRun ? "would write" : "writing") : "no change to"} ${p}`);
  if (!dryRun) {
    if (changed) {
      if (existsSync(p)) {
        const bk = join(backupRoot(), `claude-settings-${nowIso().replace(/[:+]/g, "-")}.json`);
        mkdirSync(dirname(bk), { recursive: true });
        copyFileSync(p, bk);
        lines.push(`previous settings backed up to ${bk}`);
      }
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(settings, null, 2) + "\n");
    }
    const dest = skillDest();
    if (remove) {
      if (existsSync(dest)) { unlinkSync(dest); lines.push(`removed /plan skill at ${dest}`); }
    } else {
      const current = existsSync(dest) && readFileSync(dest, "utf8") === skillText();
      if (!current) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, skillText()); lines.push(`installed /plan skill → ${dest}`); }
      else lines.push(`/plan skill already current at ${dest}`);
    }
  } else if (!remove) lines.push(`(dry run) would install /plan skill → ${skillDest()}`);
  if (wanted.some((m) => m.file === "guard-never-delete.sh") && spawnSync("which", ["jq"]).status !== 0) lines.push("warn: jq not found — the never-delete guard needs it (brew install jq / apt install jq)");
  if (!remove && !same(packageRoot(), join(projectRoot(), "node_modules", "planrails"))) lines.push(`note: planrails is not installed under ${join(projectRoot(), "node_modules")} — hook commands use the absolute path of this copy (${packageRoot()}), which only works on this machine. Run: npm install --save-dev planrails, then ${cli} hooks install`);
  lines.push(remove ? "Restart Claude Code (or run /hooks) so the removal takes effect." : "Restart Claude Code (or run /hooks) so the new hooks load.");
  process.stdout.write(lines.join("\n") + "\n");
  return { changed, replaced };
}

export function status({ print = true } = {}) {
  const cli = cliName();
  const p = claudeSettingsPath();
  const lines = [];
  let problems = 0;
  const settings = existsSync(p) ? readSettings() : null;
  if (!settings) { lines.push({ ok: false, text: `no ${p} — run: ${cli} hooks install` }); problems++; }
  else {
    const all = Object.entries(settings.hooks || {}).flatMap(([event, es]) => (es || []).flatMap((e) => (e.hooks || []).map((h) => ({ event, matcher: e.matcher, command: h.command }))));
    const expected = [...MANAGED, ...(all.some((h) => String(h.command).includes("guard-never-delete.sh")) ? [OPTIONAL["never-delete"]] : [])];
    for (const m of expected) {
      const hit = all.find((h) => h.event === m.event && String(h.command).includes(`/src/hooks/${m.file}`) && (m.matcher ? h.matcher === m.matcher : true));
      const old = all.find((h) => h.event === m.event && /\/(scripts|\.claude)\/hooks\//.test(String(h.command)) && String(h.command).includes(m.file));
      // The path the command names must exist: a settings.json copied from another machine can point at files that are not there,
      // and Claude Code runs the command anyway — exit 1 on every event, every rail silently off.
      const named = hit ? namedPath(hit.command) : null;
      if (hit && named && !existsSync(named)) { lines.push({ ok: false, text: `hook ${m.event} → ${named} does NOT exist on disk — run: npm install, then ${cli} hooks install` }); problems++; }
      else if (hit) lines.push({ ok: true, text: `hook ${m.event}${m.matcher ? `(${m.matcher.length > 24 ? m.matcher.slice(0, 21) + "…" : m.matcher})` : ""} → ${m.file}${String(hit.command).includes("$CLAUDE_PROJECT_DIR") ? "" : " (absolute path: this machine only)"}` });
      else if (old) lines.push({ ok: false, warn: true, text: `hook ${m.event} still points at an older copy of ${m.file} — run: ${cli} hooks install` });
      else { lines.push({ ok: false, text: `hook ${m.event} → ${m.file} NOT installed — run: ${cli} hooks install` }); problems++; }
    }
    if (settings.disableAllHooks) { lines.push({ ok: false, text: "disableAllHooks is true — every hook is off" }); problems++; }
    if (expected.some((m) => m.file === "guard-never-delete.sh") && spawnSync("which", ["jq"]).status !== 0) lines.push({ ok: false, warn: true, text: "jq not on PATH — the never-delete guard cannot run (brew install jq)" });
  }
  const dest = skillDest();
  if (!existsSync(dest)) lines.push({ ok: false, warn: true, text: `/plan skill not installed at ${dest} — run: ${cli} hooks install` });
  else if (readFileSync(dest, "utf8") !== skillText()) lines.push({ ok: false, warn: true, text: `/plan skill is stale — run: ${cli} hooks install` });
  else lines.push({ ok: true, text: "/plan skill installed and current" });
  if (print) for (const l of lines) process.stdout.write(`${l.ok ? "ok   " : l.warn ? "warn " : "FAIL "} ${l.text}\n`);
  return { lines, problems };
}

export function selftest() {
  const r = spawnSync("node", [join(HOOKS_DIR, "selftest.mjs")], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--status")) { const { problems } = status(); process.exit(problems ? 1 : 0); }
  else if (process.argv.includes("--selftest")) selftest();
  else if (process.argv.includes("--uninstall")) install({ remove: true });
  else install({ dryRun: process.argv.includes("--dry-run"), withNeverDelete: process.argv.includes("--with-never-delete") });
}
