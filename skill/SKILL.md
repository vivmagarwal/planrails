---
name: planrails
description: Plan a feature with the user, then execute it, so the work survives a compaction and "done" always means a proof was run. Use when the user asks to plan work, start a plan, or set up a tracker. Writes a PLAN.md the session reloads after compaction, gates each task on pasted evidence, and runs init if the project has no copy of the planner.
---

# planrails

Follow the planner method in **`.project-management/planrails/PLANNER.md`**, the
project's own copy. Read it and do exactly what it says; do not summarise it from
memory — open it. If the file is missing, run `npx planrails init` first (it
copies two files and writes nothing else), then open it.

The short version, so you know where you are going:

1. **Get ready.** Read the always-loaded file (CLAUDE.md / AGENTS.md / README),
   `docs/`, `.project-management/`, and the last ~20 commits. Report ready in
   eight lines and stop.
2. **Interview.** Ask only what the repo did not answer: goal, done-when (as
   commands), must-not-change, what it touches.
3. **Write the plan** from the templates into `.project-management/plans/<id>/`.
   Name each task's proof before the work. Add
   `@.project-management/plans/<id>/PLAN.md` to the root `CLAUDE.md` so the plan
   reloads after every compaction. If the project runs Node, wire
   `node .project-management/planrails/check-plans.mjs` into the check command.
   Then check the plan before the first task: open every path it names, start
   every proof.
4. **Execute** one task at a time: do it, run the proof now, paste the exit code
   and last line into the evidence cell (exit 0, or it is not done), then mark it
   done and update NOW. A self-contained task can go to a sub-agent briefed with
   its row and the plan's Rules, Decisions, Learnings and Context; run the proof
   yourself before pasting evidence. When a task fights back and you find the
   fix, record it in PLAN.md § Learnings so the next session does not repeat the
   struggle.
5. **Close** by re-running every proof, a fresh-context review against Done when,
   and retiring the plan: set `status: done`, then wrap its reload line in backticks.

**Your judgement outranks the gate.** Never make a red gate pass; never trust a
green one blind. A task is done only when its proof was run and pasted in.

When the user says something like "familiarise yourself and tell me when you are
ready to plan," do step 1 and wait for them.
