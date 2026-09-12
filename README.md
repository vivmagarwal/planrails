# planrails

**Plans that survive a lost session, and "done" that means done.** A planner
prompt and one small checker. Nothing to install.

Long tasks lose their thread. A session compacts or ends, and the next one starts
blind: it repeats work, or trusts a status line that says "done" over work that is
not. planrails fixes that with three plain rules, and almost no code.

1. **The plan reloads itself.** One line in the file your agent always reads
   re-opens the plan after every compaction. The state is never lost.
2. **Every task names its proof before the work starts** — the command that will
   show it is done. No command, no way to fake it later.
3. **A task is done only when its proof was run and pasted in.** An empty evidence
   cell is not done, whatever the status says. One ~120-line checker enforces this
   in the build.

That is the whole system. It is a markdown file the model reads, a template it
fills, and an optional checker. It works in any project — Node, Python, Go, a
monorepo, Windows — because there is nothing to install and no package to fit.

## Use it

**With an agent (Claude Code, or any coding agent):** point it at
[`PLANNER.md`](PLANNER.md). Say:

> Familiarise yourself with PLANNER.md and tell me when you are ready to plan the
> next feature with me.

It reads your repo, reports what it found in eight lines, and waits. Then you plan
together, and it writes the plan, wires the reload line, and copies in the checker.

**As a `/plan` command in Claude Code:** copy [`skill/`](skill) to
`~/.claude/skills/plan/` (keep `PLANNER.md` beside it). Then `/plan` starts the
same flow.

**By hand:** copy [`templates/PLAN.md`](templates/PLAN.md) and
[`templates/LOG.md`](templates/LOG.md) into
`.project-management/plans/<id>/`, fill them in, and add
`@.project-management/plans/<id>/PLAN.md` to your `CLAUDE.md`.

## The checker

Copy [`tools/check-plans.mjs`](tools/check-plans.mjs) into your project (say
`scripts/check-plans.mjs`) and add it to the command you run before every commit:

```bash
node scripts/check-plans.mjs            # done tasks must name a proof and carry evidence
node scripts/check-plans.mjs --verify   # also re-run each done task's proof, expect exit 0
```

No dependencies. Node 20+, any OS. If your project is not Node, skip it — the plan
still works; you enforce the gate yourself, the way the prompt tells you to.

## What a plan looks like

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

A full worked example is in [`examples/weekly-digest/`](examples/weekly-digest).

## History

Version 0.1.x was an npm package with a CLI and installed hooks (`npx planrails
…`). It worked, but being an installed package is what made it fragile: it
assumed npm, wrote a `package.json`, could not fit pnpm, bun, non-Node projects,
monorepos or Windows, and carried ~2,500 lines to plan a feature. 0.2.0 keeps the
idea and drops the package. The same three rails, as a prompt and one script.

MIT.
