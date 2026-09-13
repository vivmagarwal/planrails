# planrails

A planner prompt (`PLANNER.md`) and one dependency-free checker (`tools/check-plans.mjs`), shipped by a two-command CLI (`bin/planrails.mjs`). Node 20+, no dependencies, tested on Linux, macOS and Windows.

Check: `npm run check` (this repo's own plans through the checker, the worked example, both test suites). Test: `npm test`.

Rules for changes are in `CONTRIBUTING.md`: no config file, no hook, no second script, no dependency; every checker change ships with a test that fails without it.

## Learned the hard way

- A gate reads absence as the risky case: no status line means active, a row it cannot read is a problem, a proof that is prose is no proof.
- A gate's own entry point is tested as a spawned command, through a symlink too; a textual path comparison once made it silently exit 0.
- Never write a run of backticks inside a table cell; say "code fence".

## Active plans

Each plan below is held by one session — see its NOW `session:` line. Work one only when asked in this session, after the check in its block.

@.project-management/plans/session-claim/PLAN.md

## Finished plans

`@.project-management/plans/self-sufficient-plan/PLAN.md` — 0.4.0, closed 2026-09-13
