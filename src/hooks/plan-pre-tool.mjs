#!/usr/bin/env node
/**
 * PreToolUse (Edit · Write · MultiEdit · NotebookEdit · Bash · Read · Agent ·
 * Workflow · WebSearch · WebFetch · Skill) — two jobs, one process:
 *
 *  1. JUST-IN-TIME RULES. Each active plan's rules.json attaches a short rule
 *     to a trigger (tool + path / command / prompt). When the call matches, the
 *     rule text is added to Claude's context — at the moment it applies, and
 *     otherwise never. This is what lets a rule leave CLAUDE.md without being
 *     forgotten: the hook cannot forget. Default policy `once` per session
 *     (reset on compaction by plan-session-start.mjs).
 *
 *  2. UNLOGGED-WORK LEDGER. An Edit/Write under a plan's `paths` is noted in
 *     .planrails/hooks/<session>/edits.jsonl. plan-stop.mjs compares that with
 *     the plan's last log entry.
 *
 * Never blocks. Never throws out. Subagents get rules too (they edit files);
 * their edits are marked agent:true.
 */
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { readInput, sessionDir, readJsonSafe, writeJsonSafe, appendSafe, addContext } from "./_lib.mjs";
import { projectRoot } from "../plan/lib/paths.mjs";
import { activePlanIds, loadPlanCheap } from "../plan/lib/store.mjs";
import { ruleMatches, toRepoRelative, anyPathMatches } from "../plan/lib/glob.mjs";
import { nowIso } from "../plan/lib/time.mjs";

const input = readInput();
const toolName = String(input.tool_name || "");
const toolInput = input.tool_input || {};
if (!toolName) process.exit(0);

let ids = [];
try { ids = activePlanIds(); } catch { ids = []; }
if (!ids.length) process.exit(0);

const root = projectRoot();
const dir = sessionDir(input);
const injectedPath = join(dir, "injected.json");
const injected = readJsonSafe(injectedPath, {});
const EDIT_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit)$/;
const fired = [];

for (const id of ids) {
  let plan;
  try { plan = loadPlanCheap(id); } catch { continue; }
  if (!plan.state) continue;
  for (const rule of plan.rules?.rules || []) {
    let hit = false;
    try { hit = ruleMatches(rule, { toolName, toolInput, root, cwd: input.cwd || null }); } catch { hit = false; }
    if (!hit) continue;
    // Keyed per agent: subagents share the parent's session_id, so a session-wide key would starve them of once-rules.
    const key = `${input.agent_id ? `agent:${input.agent_id}` : "main"}:${id}/${rule.id}`;
    const n = injected[key] || 0;
    const policy = rule.repeat || "once";
    const fire = policy === "always" ? true : policy === "once" ? n === 0 : n % Math.max(1, Number(policy.split(":")[1] || 1)) === 0;
    injected[key] = n + 1;
    if (!fire) continue;
    let text = rule.text || "";
    if (rule.file) { try { text = readFileSync(join(plan.dir, rule.file), "utf8").trim(); } catch { text = `(rule ${rule.id}: file ${rule.file} could not be read)`; } }
    fired.push(`RULE ${rule.id} (plan ${id}, fires ${policy} — from ${id}/rules.json):\n${text}`);
  }
  if (EDIT_TOOLS.test(toolName)) {
    const rel = toRepoRelative(toolInput.file_path || toolInput.notebook_path || "", root, input.cwd || null);
    if (rel && anyPathMatches(rel, plan.state.paths)) {
      appendSafe(join(dir, "edits.jsonl"), JSON.stringify({ at: nowIso(), plan: id, file: rel, agent: Boolean(input.agent_id) }));
    }
  }
}
writeJsonSafe(injectedPath, injected);
if (fired.length) addContext("PreToolUse", fired.join("\n\n"));
