---
name: plan
description: Plan a feature with the user, then execute it, so the work survives a compaction and "done" always means a proof was run. Use when the user asks to plan work, start a plan, or set up a tracker. Writes a PLAN.md the session reloads after compaction, gates each task on pasted evidence, and copies in a checker.
---

# Plan

Follow the planner method in **`PLANNER.md`**. Read it and do exactly what it
says. Do not summarise it from memory — open it. Find it in this skill's folder,
or at `.project-management/PLANNER.md` in a project set up with `npx planrails
init`.

The short version, so you know where you are going:

1. **Get ready.** Read the always-loaded file (CLAUDE.md / AGENTS.md / README),
   `docs/`, `.project-management/`, and the last ~20 commits. Report ready in
   eight lines and stop.
2. **Interview.** Ask only what the repo did not answer: goal, done-when (as
   commands), must-not-change, what it touches.
3. **Write the plan** from the templates into `.project-management/plans/<id>/`.
   Name each task's proof before the work. Add
   `@.project-management/plans/<id>/PLAN.md` to the always-loaded file so the plan
   reloads after every compaction. If the project runs Node, copy in
   `tools/check-plans.mjs` and wire it into the check command.
4. **Execute** one task at a time: do it, run the proof now, paste the exit code
   and last line into the evidence cell, then mark it done and update NOW.
5. **Close** by re-running every proof and retiring the plan.

**Your judgement outranks the gate.** Never make a red gate pass; never trust a
green one blind. A task is done only when its proof was run and pasted in.

When the user says something like "familiarise yourself and tell me when you are
ready to plan," do step 1 and wait for them.
