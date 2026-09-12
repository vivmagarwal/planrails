/**
 * ONE FRESH SESSION PER TASK — the honest answer to "clear the context after
 * every task".
 *
 * Claude Code offers no way for the model, a hook or a skill to run /compact
 * or /clear (measured against the docs, 2026-09-12; decision D6 of the
 * planning-system plan). What it does offer is `claude -p`: a session that
 * starts empty, gets the plan's brief from the SessionStart hook, and ends.
 * This driver starts one such session per task. The session's only memory of
 * the work is the plan's files — exactly what a /clear would leave.
 *
 * Each session is told to: task start → work → plan log → task check →
 * task done with every condition answered. The driver then reads state.json
 * (never the session's words) to decide what happened:
 *   done      → next task
 *   blocked   → stop and say why (a person decides)
 *   not done  → ONE retry with the RESUME line, then stop
 * A task with no gate (a manualCheck) is a person's to close; the driver stops.
 *
 * Sessions run with --dangerously-skip-permissions, as unattended work must;
 * the project's hooks (rules, guards) still apply inside
 * them. Use --max-tasks to bound a run and --dry-run to see the prompt.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoot, runsRoot, cliName } from "./lib/paths.mjs";
import { loadPlan } from "./lib/store.mjs";
import { nowIso } from "./lib/time.mjs";
import { JUDGMENT } from "./lib/judgment.mjs";

const CLI = cliName();

export function nextTask(plan) {
  const t = plan.state.tasks;
  const doneOrDropped = (id) => ["done", "dropped"].includes(t.find((x) => x.id === id)?.status);
  return t.find((x) => x.status === "doing") || t.find((x) => x.status === "todo" && x.dependsOn.every(doneOrDropped)) || null;
}

export function promptFor(plan, task, { retry = false } = {}) {
  const id = plan.state.id;
  const last = plan.log.at(-1);
  return [
    `You are executing ONE task of plan "${id}" in a fresh session. The plan's brief was injected at session start; if you do not see it, run: ${CLI} brief ${id}`,
    retry ? `A previous session started this task and did not finish. Its RESUME line: "${last?.next || "(none)"}". Check git status and the files before redoing anything.` : "",
    `TASK ${task.id}: ${task.title}${task.effort ? ` (think at effort ${task.effort})` : ""}${task.notes ? `\nNotes: ${task.notes}` : ""}`,
    `Steps, in order:`,
    `1. ${CLI} task start ${id} ${task.id}`,
    `2. Read .project-management/plans/${id}/PLAN.md § Method and § Rules for this plan. Rules for specific files arrive automatically when you touch them.`,
    `3. Do the work — only this task. Files it lists: ${task.files.join(", ") || "(see PLAN.md § Map)"}.`,
    `4. ${CLI} log ${id} --task ${task.id} --what "<what landed, with numbers and paths>" --next "<the exact next action for a stranger>"`,
    `5. ${CLI} task check ${id} ${task.id}   (shows every condition of done)`,
    `6. ${CLI} task done ${id} ${task.id} --answer "C4: …" … --answer "C7: …"   (one --answer per manual condition that step 5 lists, saying what you checked; it runs the gate)`,
    `If the gate fails: fix the CAUSE and run step 6 again. Never edit the gate, the test or the data so that it passes. If you believe the gate is wrong, or you cannot fix the cause: ${CLI} task block ${id} ${task.id} --reason "<what the gate computed, and what is true>" --needs owner — then stop.`,
    ...JUDGMENT,
    `Record anything learned with ${CLI} learn, any choice with ${CLI} decide. Do not start any other task. Stop when ${task.id} is done or blocked.`,
  ].filter(Boolean).join("\n");
}

export async function runPlan({ id, maxTasks = 1, model = "sonnet", maxTurns = 60, dryRun = false, log = console.log }) {
  const journal = runsRoot();
  mkdirSync(journal, { recursive: true });
  for (let n = 0; n < maxTasks; n++) {
    let plan = loadPlan(id);
    if (plan.state.status !== "active") { log(`${id} is ${plan.state.status}; nothing to run`); return 0; }
    const task = nextTask(plan);
    if (!task) { log(`${id}: no task is ready (all done, dropped, blocked, or waiting on a dependency)`); return 0; }
    if (!task.gate) { log(`${id}: ${task.id} has no gate — "${task.manualCheck}" — a person closes it; stopping`); return 0; }
    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt = promptFor(plan, task, { retry: attempt > 0 || task.status === "doing" });
      if (dryRun) { log(`--- would run (task ${task.id}, attempt ${attempt + 1}) ---\n${prompt}`); return 0; }
      log(`▶ ${task.id} ${task.title} — session ${attempt + 1} (${model}, ≤ ${maxTurns} turns)`);
      const t0 = Date.now();
      const r = spawnSync("claude", ["-p", prompt, "--output-format", "json", "--model", model, "--max-turns", String(maxTurns), "--dangerously-skip-permissions"],
        { cwd: projectRoot(), encoding: "utf8", timeout: 3_600_000, maxBuffer: 64 * 1024 * 1024 });
      let parsed = null; try { parsed = JSON.parse(r.stdout); } catch { /* raw */ }
      plan = loadPlan(id);
      const after = plan.state.tasks.find((x) => x.id === task.id);
      const rec = { at: nowIso(), plan: id, task: task.id, attempt: attempt + 1, session_id: parsed?.session_id || null, exit: r.status, is_error: Boolean(parsed?.is_error), turns: parsed?.num_turns ?? null, ms: Date.now() - t0, statusAfter: after?.status || null };
      appendFileSync(join(journal, `${id}.jsonl`), JSON.stringify(rec) + "\n");
      log(`  session ${rec.session_id || "?"}: exit ${rec.exit}${rec.is_error ? " (error)" : ""}, ${rec.turns} turns, ${Math.round(rec.ms / 1000)} s → ${task.id} is ${rec.statusAfter}`);
      if (rec.statusAfter === "done") break;
      if (rec.statusAfter === "blocked") { log(`  ${task.id} is blocked: ${after.blocked?.reason} (needs ${after.blocked?.needs}) — stopping`); return 2; }
      if (attempt === 1) { log(`  ${task.id} still ${rec.statusAfter} after two sessions — stopping; read the log and .planrails/runs/${id}.jsonl`); return 1; }
    }
  }
  return 0;
}
