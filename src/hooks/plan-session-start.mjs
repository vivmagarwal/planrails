#!/usr/bin/env node
/**
 * SessionStart (startup · resume · clear · compact) — inject the brief of every
 * active plan.
 *
 * This is the piece that makes "the plan is re-read, never remembered" true
 * without anyone remembering to do it. The brief is rendered from disk at this
 * moment (src/plan/lib/brief.mjs), so it cannot be stale. After a
 * compaction the tool results are gone; the log and the brief are the record.
 *
 * Also records the session id at .planrails/hooks/current-session.json so the
 * CLI can stamp log entries, and on `compact` resets the once-per-session rule
 * injections (the context they were injected into no longer exists).
 */
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";
import { readInput, sessionDir, writeJsonSafe, appendSafe, addContext } from "./_lib.mjs";
import { hookStateRoot, cliName } from "../plan/lib/paths.mjs";
import { activePlanIds, loadPlan } from "../plan/lib/store.mjs";
import { renderBrief } from "../plan/lib/brief.mjs";
import { nowIso } from "../plan/lib/time.mjs";

const input = readInput();
const source = String(input.source || input.matcher || "startup");
try {
  const dir = sessionDir(input);
  writeJsonSafe(join(hookStateRoot(), "current-session.json"), { session_id: input.session_id || null, startedAt: nowIso(), source, cwd: input.cwd || null });
  appendSafe(join(dir, "starts.jsonl"), JSON.stringify({ at: nowIso(), source }));
  if (source === "compact" || source === "clear") { const f = join(dir, "injected.json"); if (existsSync(f)) unlinkSync(f); }
} catch { /* never block a session start */ }

let ids = [];
try { ids = activePlanIds(); } catch { ids = []; }
if (!ids.length) process.exit(0);

const MAX = 3;
const parts = [];
parts.push(`PLAN SYSTEM — ${ids.length} active plan(s): ${ids.join(", ")}. The briefs below were rendered from disk just now; they outrank anything you remember about where the work stood.` +
  (source === "compact" ? " You have just compacted: every tool result is gone, and the log + brief are the record of what was already done." : "") +
  (source === "resume" ? " This is a resumed session: check the brief's RESUME line against git status before continuing." : ""));
for (const id of ids.slice(0, MAX)) {
  try { parts.push(renderBrief(loadPlan(id))); } catch (e) { parts.push(`## Plan ${id} — brief failed to render: ${e.message}. Run: ${cliName()} validate ${id}`); }
}
if (ids.length > MAX) parts.push(`(+${ids.length - MAX} more: ${cliName()} brief <id>)`);
parts.push("Before the first command on a plan this session: read its PLAN.md § Method and § Rules. Rules attached to specific steps arrive automatically when you take that step. Record as you go — the Stop hook will remind you if files under a plan's paths change and nothing is logged. Guide: docs/PLANNING_GUIDE.md § Executing a plan.");
addContext("SessionStart", parts.join("\n\n"));
