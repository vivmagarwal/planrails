# planrails

**Plans that survive a lost session, and "done" that means done.** A planner
prompt your AI agent reads, and one small checker. Set it up in one command.

Long tasks lose their thread. A coding session compacts or ends, and the next one
starts blind: it repeats work, or it trusts a status line that says "done" over
work that is not. planrails fixes that with three plain rules and almost no code.

1. **The plan reloads itself.** One line in your project's root `CLAUDE.md`
   re-opens the plan after every compaction, and the plan carries its own
   operating loop and the name of the session working it, so a session that
   never saw the planner prompt still works it correctly — and a second session
   in the same checkout checks for the first before it touches the plan. (Claude
   Code reloads it for you; another agent opens it by hand.)
2. **Every task names its proof before the work starts** — the command that will
   show it is done. No command, no way to fake it later.
3. **A task is done only when its proof was run and its exit code pasted in.** An
   empty evidence cell, a bare word, or a recorded `exit 1` is not done, whatever
   the status says. A small, dependency-free checker enforces this in your build,
   and also checks that every active plan has its reload line and that NOW points
   at a task that is still open.

It works in any project — Node, Python, Go, a monorepo, Windows — because it adds
two files and changes nothing else.

## Getting started

### One command, any project

From the root of your project:

```bash
npx planrails init
```

That copies two files into `.project-management/planrails/` and makes the
`plans/` folder. It writes **nothing else** — no `package.json`, no `npm install`,
no hooks, no edits to your `CLAUDE.md`. Run it again any time to update: it brings
the two planner files up to the package version and tells you what it replaced,
keeps a same-version copy you edited unless you pass `--force`, and never touches
your plans. What lands:

```
.project-management/
  planrails/
    PLANNER.md        the prompt your agent follows to plan and execute
    check-plans.mjs   the checker (the one machine-enforced rail)
  plans/              your plans live here, one folder each (a .gitkeep holds the folder)
```

Then, two steps:

1. **Tell your agent to plan with you.** In any coding agent:

   > Follow `.project-management/planrails/PLANNER.md` and tell me when you are
   > ready to plan the next feature with me.

   It reads your repo, reports what it found in eight lines, and waits. Then you
   plan together, and it writes the plan and wires the reload line.

2. **Wire the checker into your build.** Add this to the command you run before
   every commit (your `check` / `lint` / CI script):

   ```bash
   node .project-management/planrails/check-plans.mjs
   ```

   Now the build fails if any task is marked done without pasted evidence.

That is the whole setup.

### New project vs existing project

The command is the same; the difference is what your agent sees.

- **New project:** there is nothing to read yet, so the agent asks you a few
  questions (goal, done-when, what it must not change) and writes the first plan.
- **Existing project:** the agent first reads your `CLAUDE.md`/`README`, your
  `docs/`, and recent commits, and reports what it found before planning — so the
  plan fits how your code already works. `init` is safe to run in a project that
  already has files or its own `.project-management/`: it only writes its two
  planner files, updating an older copy, and never touches a plan.

### Without npm, or a non-Node project

No npm? Copy the two files by hand from this repo:
[`PLANNER.md`](PLANNER.md) → `.project-management/planrails/PLANNER.md`, and
[`tools/check-plans.mjs`](tools/check-plans.mjs) →
`.project-management/planrails/check-plans.mjs`. Make a `.project-management/plans/`
folder. Done.

The checker needs Node to run. If your project has no Node at all, skip it — the
plan still works, and your agent enforces the gate the way `PLANNER.md` says. The
planner method does not depend on any language.

### As a `/planrails` command in Claude Code

Copy [`skill/`](https://github.com/vivmagarwal/planrails/tree/main/skill) to `~/.claude/skills/planrails/`. Then `/planrails` starts
the same flow in any project that has run `npx planrails init` — the skill reads
the project's own copy of `PLANNER.md`, so every project follows the version it
has. (It is not called `/plan`, because Claude Code has a `/plan` of its own.)

## How a plan works

Each plan is two files: `PLAN.md` (the map and tracker) and `LOG.md` (append-only
history). `PLAN.md` carries a short "How to work this plan" block — the loop a
session follows even if it never saw the planner prompt — and the plan's memory:
the rules to keep, the decisions made, and the **learnings** (a mistake, written
as the rule that avoids it). Because the reload line brings `PLAN.md` back at the
start of every session, a lesson from one chat is read by the next one before it
repeats the struggle. The top of `PLAN.md` is what a fresh session reads first. Abridged from
[`examples/weekly-digest/`](examples/weekly-digest), which also shows the
`CLAUDE.md` line that reloads it:

```
# Weekly digest email — plan

status: active · opened 2026-09-12 · id: weekly-digest

## NOW
RESUME: T2 — render the digest through the email seam (lib/digest/render.ts)
NEXT: T3 schedule the Monday send · T4 docs
updated: 2026-09-12 14:20
session: app-3f · 7c1d2e9a · since 2026-09-12 14:05

## How to work this plan
(the loop a session follows: set doing, run the proof, paste exit N, done on 0, update NOW, log it — and, before any doing, the check that no other live session holds the plan)

## Tasks
| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
| T1 | the digest query (lib/digest/query.ts) | done  | `npx vitest run tests/digest/query.test.ts` | 2026-09-12 14:05 · exit 0 · "6 passed" |
| T2 | render through the email seam       | doing | `npx vitest run tests/digest/render.test.ts` | |
```

The full method — how the agent gets ready, interviews you, writes the plan,
checks it before the first task, runs one task at a time, briefs a sub-agent with
just a task's row and the plan's rules, and closes with a fresh-context review —
is in [`PLANNER.md`](PLANNER.md). A complete worked plan is in
[`examples/weekly-digest/`](examples/weekly-digest).

## The checker

```bash
node .project-management/planrails/check-plans.mjs            # done needs a proof and exit 0 evidence; the plan reloads; NOW is current
node .project-management/planrails/check-plans.mjs --verify   # also re-run each done task's proof, expect exit 0
node .project-management/planrails/check-plans.mjs --root DIR # check another folder (--dir works too)
npx planrails check                                           # the same, with the published package's checker, which may be newer than your copy
```

No dependencies. Node 20+, any OS (Windows included). The default is a fast
structural check, biased toward catching a faked "done":

- every task that claims to be finished must name a proof — exactly one
  `command` in backticks, or the word `owner` — and its evidence must record the
  command's exit code, which must be 0; a bare word, an empty cell, or `exit 1`
  fails. An owner-closed task records the owner's words with the date
- no spelling of "done" slips past it, and a table row it cannot read (a stray
  pipe or backtick) fails closed instead of passing
- when the project has a `CLAUDE.md`, every active plan must be reloaded by
  `@.project-management/plans/<id>/PLAN.md` on its own line, and no such line may
  point at a plan that does not exist
- an active plan keeps its `RESUME` line, and that line must name a task that
  is still open

`--verify` goes further and **runs** each proof again, with a timeout, and shows
the last line a failing proof printed. Because it executes the commands written in
the plan, use it only on plans you trust — run the default structural check in CI
that builds untrusted pull requests, and keep `--verify` for your own branch or a
trusted pipeline.

## On a team

- **It will not break teammates' builds.** The checker has no dependencies and
  exits 0 when there are no plans, so a teammate who never uses planrails is
  unaffected.
- **The reload line is a plain file include.** `@.project-management/plans/…` in
  the root `CLAUDE.md` just tells Claude Code to load that file; it commits like
  any doc. Other agents do not import it: open the plan by hand at session start.
- **Decide whether to commit `.project-management/`.** Committing it shares plans
  and lets CI run the checker. If your repo gitignores it, the checker still runs
  locally and the plan still reloads for whoever has the files.
- **Two machines, one plan.** The `session:` line names a session on the machine
  that wrote it; another machine cannot list it. There, git is the record: pull
  before you take a task, and read a `doing` row with a fresh `updated:` stamp as
  someone's in-flight work.

## Several sessions in one checkout

The reload line puts an active plan into every Claude Code session opened in that
directory, so a second session can read the plan and start the task the first one
is on. A plan's NOW names the session working it
(`session: app-3f · 7c1d2e9a · since 2026-09-12 14:05`), and the plan's block tells
every session, before it sets a task `doing`, to re-read that line, list the live
sessions (`claude agents --json`, matching the line's id; `ListAgents` inside
Claude Code names sessions but shows no id) and run `git status --short`, and to
stop and ask when another live session holds the plan — even when you asked it to
continue, because you can forget which window owns it. One plan per session, one
session per plan; the other reloaded plans are context. A session assigned an
unheld plan claims it and goes on, unless that plan's files are dirty or a busy
peer in this checkout holds no plan, so two sessions can work two plans side by
side. A plan
written before 0.5 has no `session:` line; `init` points it out, and the
changelog says what to add by hand. The claim is a lead, not a lock: a line left by a closed terminal blocks
nobody, and the checker ignores the line. Field-tested with headless sessions: a
second session told "Continue the active plan." stopped and asked while the first
was live — by its id, after the first had been renamed — took over when it was
gone, and touched only the plan it was given when two were active.

## History

Version 0.1.x was a heavier npm package with a full CLI and installed hooks. A
review found ten data-loss and silent-failure paths in that surface, and the
"works with any project" promise broke on pnpm, bun, non-Node projects,
monorepos and Windows. 0.2.0 keeps the idea and drops the weight: the same three
rails, as a prompt plus one checker, with a two-command CLI that only copies
files. 0.3.0 makes learnings a reloaded part of every plan and groups the two
installed files under `.project-management/planrails/`. 0.4.0 makes the plan
carry its own loop, makes the checker demand `exit 0` and check the reload line,
and teaches the executor to brief sub-agents from the plan. 0.5.0 names the
session working a plan and has every session check for a live holder before it
touches the plan. See [`CHANGELOG.md`](CHANGELOG.md).

MIT.
