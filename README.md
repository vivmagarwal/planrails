# planrails

**Plans that survive a lost session, and "done" that means done.** A planner
prompt your AI agent reads, and one small checker. Set it up in one command.

Long tasks lose their thread. A coding session compacts or ends, and the next one
starts blind: it repeats work, or it trusts a status line that says "done" over
work that is not. planrails fixes that with three plain rules and almost no code.

1. **The plan reloads itself.** One line in the file your agent always reads
   re-opens the plan after every compaction. The state is never lost.
2. **Every task names its proof before the work starts** — the command that will
   show it is done. No command, no way to fake it later.
3. **A task is done only when its proof was run and pasted in.** An empty evidence
   cell is not done, whatever the status says. A small, dependency-free checker
   enforces this in your build.

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
no hooks, no edits to your `CLAUDE.md`. Run it again any time; it skips files that
already exist. What lands:

```
.project-management/
  planrails/
    PLANNER.md        the prompt your agent follows to plan and execute
    check-plans.mjs   the checker (the one machine-enforced rail)
  plans/              your plans will live here, one folder each
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
  already has files or its own `.project-management/`; it only adds, never
  overwrites (without `--force`).

### Without npm, or a non-Node project

No npm? Copy the two files by hand from this repo:
[`PLANNER.md`](PLANNER.md) → `.project-management/planrails/PLANNER.md`, and
[`tools/check-plans.mjs`](tools/check-plans.mjs) →
`.project-management/planrails/check-plans.mjs`. Make a `.project-management/plans/`
folder. Done.

The checker needs Node to run. If your project has no Node at all, skip it — the
plan still works, and your agent enforces the gate the way `PLANNER.md` says. The
planner method does not depend on any language.

### As a `/plan` command in Claude Code

Copy [`skill/`](skill) to `~/.claude/skills/plan/`, and put a copy of `PLANNER.md`
beside it in the same folder. Then `/plan` starts the same flow in any project.

## How a plan works

Each plan is two files: `PLAN.md` (the map and tracker) and `LOG.md` (append-only
history). `PLAN.md` also carries the plan's memory — the rules to keep, the
decisions made, and the **learnings** (a mistake, written as the rule that avoids
it). Because the reload line brings `PLAN.md` back at the start of every session, a
lesson from one chat is read by the next one before it repeats the struggle. The
top of `PLAN.md` is what a fresh session reads first:

```
## NOW
RESUME: T2 — render the digest through lib/email (lib/digest/render.ts)
NEXT: T3 schedule · T4 docs
updated: 2026-09-12 14:20

## Tasks
| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
| T1 | the digest query (lib/digest/query.ts) | done  | `npx vitest run tests/digest.test.ts` | 2026-09-12 14:05 · exit 0 · "6 passed" |
| T2 | render through the email seam       | doing | `npx vitest run tests/render.test.ts` | |
```

The full method — how the agent gets ready, interviews you, writes the plan, and
runs one task at a time — is in [`PLANNER.md`](PLANNER.md). A complete worked plan
is in [`examples/weekly-digest/`](examples/weekly-digest).

## The checker

```bash
node .project-management/planrails/check-plans.mjs          # done tasks must name a proof and carry evidence
node .project-management/planrails/check-plans.mjs --verify # also re-run each done task's proof, expect exit 0
npx planrails check                                         # the same, using the latest published checker
```

No dependencies. Node 20+, any OS (Windows included). The default is a fast
structural check: every task that claims to be finished must name a proof and
carry pasted evidence, and no spelling of "done" can slip past it.

`--verify` goes further and **runs** each proof again. Because it executes the
commands written in the plan, use it only on plans you trust — run the default
structural check in CI that builds untrusted pull requests, and keep `--verify`
for your own branch or a trusted pipeline.

## On a team

- **It will not break teammates' builds.** The checker has no dependencies and
  exits 0 when there are no plans, so a teammate who never uses planrails is
  unaffected.
- **The reload line is a plain file include.** `@.project-management/plans/…` in
  `CLAUDE.md` just tells Claude Code to load that file; it commits like any doc.
- **Decide whether to commit `.project-management/`.** Committing it shares plans
  and lets CI run the checker. If your repo gitignores it, the checker still runs
  locally and the plan still reloads for whoever has the files.

## History

Version 0.1.x was a heavier npm package with a full CLI and installed hooks. A
review found ten data-loss and silent-failure paths in that surface, and the
"works with any project" promise broke on pnpm, bun, non-Node projects,
monorepos and Windows. 0.2.0 keeps the idea and drops the weight: the same three
rails, as a prompt plus one checker, with a two-command CLI that only copies
files. 0.3.0 makes learnings a reloaded part of every plan and groups the two
installed files under `.project-management/planrails/`. See
[`CHANGELOG.md`](CHANGELOG.md).

MIT.
