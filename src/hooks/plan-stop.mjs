#!/usr/bin/env node
/**
 * Stop — "you changed files under a plan and logged nothing."
 *
 * The rule it enforces: update the plan after every landed piece of work, not
 * at the end of the session, because the chat is lost and the plan is not.
 * This hook makes that a check. If this session (main thread or its subagents)
 * edited files under an active plan's `paths` after that plan's last log entry,
 * the stop is blocked ONCE with the exact command to run. `stop_hook_active`
 * guards against a loop: the second stop of the same turn always passes.
 *
 * It reminds once per unlogged stretch (keyed on the plan's last log time), and
 * again only if the stretch has grown by five or more files — a nag on every
 * turn would train everyone to ignore it, which is worse than no hook.
 */
import { join } from "node:path";
import { readInput, sessionDir, readJsonSafe, writeJsonSafe, emit } from "./_lib.mjs";
import { activePlanIds, loadPlan } from "../plan/lib/store.mjs";
import { shortStamp } from "../plan/lib/time.mjs";
import { cliName } from "../plan/lib/paths.mjs";
import { readFileSync, existsSync } from "node:fs";

const input = readInput();
if (input.stop_hook_active) process.exit(0);

const dir = sessionDir(input);
const editsPath = join(dir, "edits.jsonl");
if (!existsSync(editsPath)) process.exit(0);
let edits = [];
try { edits = readFileSync(editsPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { process.exit(0); }
if (!edits.length) process.exit(0);

let ids = [];
try { ids = activePlanIds(); } catch { process.exit(0); }
const remindedPath = join(dir, "reminded.json");
const reminded = readJsonSafe(remindedPath, {});
const reasons = [];

for (const id of ids) {
  let plan;
  try { plan = loadPlan(id); } catch { continue; }
  const last = plan.log.at(-1);
  const lastAt = last ? Date.parse(last.at) : 0;
  const unlogged = edits.filter((e) => e.plan === id && Date.parse(e.at) > lastAt);
  if (!unlogged.length) continue;
  const files = [...new Set(unlogged.map((e) => e.file))];
  const prev = reminded[id];
  if (prev && prev.lastAt === lastAt && files.length < prev.files + 5) continue;
  reminded[id] = { lastAt, files: files.length };
  const doing = plan.state.tasks.find((t) => t.status === "doing");
  reasons.push(
    `PLAN ${id}: ${files.length} file(s) under its paths changed since its last log entry (${last ? shortStamp(last.at) : "never"}): ` +
    `${files.slice(0, 6).join(", ")}${files.length > 6 ? `, +${files.length - 6} more` : ""}.\n` +
    `Record what landed and the exact next step BEFORE stopping — a compaction or a fresh session reads the log, not this chat:\n` +
    `  ${cliName()} log ${id}${doing ? ` --task ${doing.id}` : ""} --what "<what changed, with numbers/paths>" --next "<the next action, executable by a stranger>"\n` +
    `Anything learned → plan learn; any choice → plan decide; a task that landed → plan task done (it runs the gate). Then stop.`
  );
}
writeJsonSafe(remindedPath, reminded);
if (reasons.length) emit({ decision: "block", reason: reasons.join("\n\n") });
