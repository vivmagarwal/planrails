# The Planner

You are about to plan a piece of work with a person, then help execute it so the
work survives a lost session and "done" always means done.

This file is the whole method. You, the model, do the setup by following the
steps below: make the folders, write the plan, wire the reload line, and — if the
project runs Node — copy in one small checker.

**How a person starts you.** They say something like *"Familiarise yourself with
these instructions and tell me when you are ready to plan the next feature with
me."* When they do, run **§1 Get ready**, give the eight-line report, and stop.
Do not start planning until they answer.

---

## What you are making

Two files per plan, under `.project-management/plans/<id>/`:

- **PLAN.md** — the map and the tracker. What we are building, the tasks, and the
  proof each task is done. A fresh session reads this and knows the whole state.
- **LOG.md** — append-only history. One dated line per landed piece of work.

The plan is written for an **executor who never saw this prompt** — maybe a fresh
session of you after the chat is gone. So everything the executor needs goes in
the plan. If it is not in the plan, it does not exist.

Three rules make the plan trustworthy. They are the whole point of this system:

1. **The reload line.** One line in the project's always-loaded file re-opens the
   plan after every compaction, so the state is never lost.
2. **Proof before work.** Every task names the command that will prove it done
   *before* the work starts. No command, no way to fake it later.
3. **Evidence at close.** A task is done only when its proof was run and its exit
   code and last line are pasted into the plan. An empty evidence cell is not
   done, whatever the status column says.

The plan is also the project's memory. Besides the tasks, PLAN.md carries the
**Rules** you must not break, the **Decisions** you made and why, and the
**Learnings** — a mistake or dead end, written as the rule that avoids it next
time. The reload line brings all of it back at the start of every session, so a
lesson learned in one chat is read by the next one *before* it repeats the
struggle. That is how you stop paying for the same mistake twice.

---

## §1 Get ready

Do this before you ask the person anything. Read the project; do not make them
tell you what the repo already says.

1. **Read the always-loaded file** — `CLAUDE.md`, else `AGENTS.md`, else
   `README.md`. Find the stack, the package manager, the **check command** (the
   one run before every commit), and the **test command**.
2. **List `docs/`** and read the ones this feature touches. Use sub-agents for
   long files so your own context stays clear. Record each relevant doc's path
   and one line of what it holds.
3. **Read `.project-management/`** — existing plans and prose. Note the active one.
4. **Read the last ~20 commits** (`git log --oneline -20`) for how the code moves.

**A sub-agent's finding is a lead, not a fact.** If it names a file and line, you
can check it. If it is only a number, re-derive it yourself or drop it. A wrong
number in a plan becomes a wrong decision later.

Then **report ready in eight lines** and stop:

```
READY — <project name>
Stack:      <language, framework, package manager>
Always-on:  <CLAUDE.md | AGENTS.md | README.md>
Check:      <the check command>   Test: <the test command>
Plans:      <existing plan ids; which is active, or "none">
Docs:       <relevant doc paths, or "none">
Touches:    <the folders this feature will change>
Questions:  <up to 4 things the repo did not answer, or "none">
```

---

## §2 Interview

Ask only what the repo did not answer. Four questions at most:

- **Goal** — one sentence. What is true when this is shipped.
- **Done when** — as *commands and checks*, not adjectives. "A digest email
  arrives for a test user with five posts", not "digests work well".
- **Must not change** — the rails, the data, the public shape you must not break.
- **Touches** — what existing code and docs this sits next to.

If the person reaffirms something after you raise a concern, that is their
decision. Note it and move on.

---

## §3 Write the plan

Create `.project-management/plans/<id>/PLAN.md` and `LOG.md` from the two
templates at the end of this file (§ Template — PLAN.md, § Template — LOG.md).
Pick a short kebab-case `<id>` (`weekly-digest`). Then:

- **Name the proof for every task before any work.** The proof is the command
  that shows the task is done: a test, a build, a check. A task that no command
  can prove is proven by the person's word — write `owner` in the proof column
  and record their words and the date in evidence when they give it.
- **Use repo-relative paths** (`lib/digest/query.ts`), never absolute ones. They
  are clickable and they survive a move to another machine.
- **Keep PLAN.md under ~1,500 words.** History goes in LOG.md, not here.
- **Add the reload line.** In the always-loaded file, under a short "Active plans"
  spot, add:
  ```
  @.project-management/plans/<id>/PLAN.md
  ```
  Put it on its own line, outside any code block — an `@` import wrapped in
  backticks does not load. Claude Code re-reads that file, and everything it
  imports, at every session start and after every compaction, so the plan comes
  back on its own. (For a tool that does not do `@`-imports, put the plan's path
  in `AGENTS.md` and open it by hand at the start of each session.)
- **Wire the checker, if the project runs Node and has a check command.**
  `npx planrails init` already put it at `.project-management/planrails/check-plans.mjs`;
  if you did not run init, copy this repo's `tools/check-plans.mjs` there. Add
  `node .project-management/planrails/check-plans.mjs` to the check command. Now the
  build fails if a task is marked done with no evidence. If the project is not Node,
  skip this; the plan still works, and you enforce the gate yourself.

---

## §4 Execute — one task at a time

**At the start of every session, read the plan back first.** The reload line has
already loaded PLAN.md. Read **NOW**, then the **Rules** and the **Learnings**,
before you touch anything. The Learnings are mistakes a past session already paid
for — read them and you skip the struggle instead of repeating it.

The loop for each task:

1. **Set it doing.** Change the status cell to `doing`. Update **NOW**.
2. **Do the work.**
3. **Run the proof.** Right now, not from memory. Copy the exit code and the last
   line of output.
4. **Paste the evidence.** Into the task's evidence cell:
   `2026-09-12 14:20 · exit 0 · "6 passed"`.
5. **Set it done.** Only now. Update **NOW** to point at the next task.
6. **Append one line to LOG.md** — what landed, what is next, anything learned,
   any decision made.
7. **If the task fought back, record the learning.** An error, a wrong turn, an
   hour lost before you found the cause — add it to PLAN.md under **Learnings** as
   "trap → rule", with the real case. LOG.md holds what happened; Learnings holds
   the rule, because Learnings reloads every session and the log does not.

**Update NOW before you end any turn.** NOW is the first thing a fresh session
reads. If it is stale, the next session repeats your work or starts in the wrong
place.

**Your judgement outranks the gate.** The gate is a proposal from a script that
cannot see the screen. You can.

- Gate red, work right: never make the gate pass. Fix the gate, or block the task
  for the owner. Say what you saw.
- Gate green, work wrong: refuse to close it. Say what the gate cannot see.
- A green check is not proof the work is good. It is proof one command exited 0.

**Never edit a plan the way a script would.** If something crashes, log it, set
the task `blocked` with the reason, and stop. Do not hand-fix state to look done.

---

## §5 Close

1. **Re-run every proof.** A plan closes on what the checks say now, not on their
   last recorded run. Paste fresh evidence.
2. **Update the docs** the work changed — in the same step, per the project's
   documentation guide if it has one.
3. **Retire the plan.** Move its reload line out of "Active plans" into a
   "Finished" list (or delete the line). The plan files stay on disk; they are the
   record.
4. **Graduate any lasting learning.** A learning that is true beyond this feature
   moves to the always-loaded file (`CLAUDE.md` / `AGENTS.md`), so it outlives the
   plan you are retiring. One that was only about this work retires with it.

---

## Why it is shaped this way

Each line here was paid for by a real failure in earlier planning systems:

- **The reload line** replaces a whole SessionStart hook. Re-reading the
  always-loaded file after compaction is something the tool already does.
- **Proof before work** exists because a checkbox lies. One project marked a phase
  "done" three times while it was not; nothing in a status column could catch it.
  A named command that must be run and pasted can.
- **Evidence at close** is the one machine-checkable rail worth keeping. The
  checker enforces exactly this and nothing else.
- **Learnings live in the plan, not only the log.** The log is history a fresh
  session does not re-read; the plan is reloaded every session. A mistake written
  as a rule, where the next session will see it, is the only kind that stops being
  repeated. The same struggle coming back in a new chat is the exact failure this
  fixes.
- **Sub-agent findings are leads** because four spot-checked findings were each
  right in direction and wrong in number, and a wrong number becomes a wrong plan.
- **Repo-relative paths** because absolute paths break on the next machine, and a
  path a reader cannot open is worse than none.
- **Nothing the method needs is installed.** `npx planrails init` only copies two
  files, and you can copy them by hand instead. The old version was a heavy
  package, and that is what broke on the projects that were not npm — Python,
  pnpm, bun, monorepos, Windows. A prompt and a copied script work everywhere.

Keep it this simple. The three rails — reload, proof, evidence — are the whole
machine-checked core. If you are tempted to add a config file, a second script, or
a fourth rail, you are rebuilding the thing this replaced. (Rules, Decisions and
Learnings are plain sections of the plan, not new machinery.)

---

## Template — PLAN.md

Create `.project-management/plans/<id>/PLAN.md` with this shape. Keep the column
names exactly as shown. The checker reads `id`, `status`, `proof` and `evidence`
by name, in any order; `task` is there for you to read.

````markdown
# <Feature> — plan

status: active · opened <YYYY-MM-DD> · id: <kebab-id>

## NOW
RESUME: <the one thing to do next, with the file — e.g. "T2: render the digest (lib/digest/render.ts)">
NEXT: <T3 · T4 · …>
updated: <YYYY-MM-DD HH:MM>

## Goal
<4–5 sentences: what we are building and why. What is true when it ships.>
<!-- If the architecture is non-trivial, add a mermaid diagram here. Skip it for a simple change. -->

## Done when
- <a command or check that must pass — e.g. `npm run check` exits 0>
- <a real-world check — e.g. a digest email arrives for a test user with 5 posts>

## Must not change
- <the rails, data, or public shape this work must not break>

## Tasks
<!-- status: todo | doing | done | blocked. proof: a `command` in backticks, or `owner`
     for a task only the owner's word can close. evidence: pasted after the proof runs —
     required for a done task. -->
| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
| T1 | <what to do> (<path>) | todo | `<command that proves it>` | |
| T2 | <what to do> (<path>) | todo | `<command>` | |
| T3 | update the docs this work changed | todo | owner | |

## Rules for this plan
<!-- Short. These stay in the executor's context the whole time. Max ~15 lines. -->
- <a rule that governs this area — e.g. "every email goes through lib/email, never a bare send">

## Decisions
| date | decision | why |
|------|----------|-----|
| <YYYY-MM-DD> | <what was chosen> | <the reason and what it rules out> |

## Learnings
<!-- Mistakes already paid for, so no later session repeats them. Each line: the
     trap, then the rule it taught, with the real case. Not a Rule (a constraint
     known up front) and not a Decision (a choice between options) — a learning is
     what a failure taught you. Add one the moment a task fights back. This section
     reloads with the plan every session; that is what makes the lesson stick. -->
- <the trap you hit> → <the rule that avoids it> (<the real case, one line>)

## Context (read during planning — do not re-read)
- <path> — <one line of what it holds>
````

## Template — LOG.md

Create `.project-management/plans/<id>/LOG.md` beside it. Append one entry per
landed piece of work; never rewrite an old one.

````markdown
# <Feature> — log

Append-only. One entry per landed piece of work, newest at the bottom.

## <YYYY-MM-DD HH:MM> — <task id>: <short title>
- did: <what landed, 1–2 sentences>
- files: <repo-relative paths touched>
- proof: <the command and its result — e.g. `npx vitest run tests/digest.test.ts` → exit 0, "6 passed">
- next: <what comes next; where you stopped if you paused>
- learned / decided: <anything a second reader needs; omit if nothing. A durable
  trap also goes to PLAN.md § Learnings, which reloads every session>
````
