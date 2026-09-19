# planrails

A planner prompt (`PLANNER.md`) and one dependency-free checker (`tools/check-plans.mjs`), shipped by a two-command CLI (`bin/planrails.mjs`). Node 20+, no dependencies, tested on Linux, macOS and Windows.

Check: `npm run check` (this repo's own plans through the checker, the worked example, both test suites). Test: `npm test`.

Rules for changes are in `CONTRIBUTING.md`: no config file, no hook, no second script, no dependency; every checker change ships with a test that fails without it.

## Learned the hard way

- A gate reads absence as the risky case: no status line means active, a row it cannot read is a problem, a proof that is prose is no proof.
- A gate's own entry point is tested as a spawned command, through a symlink too; a textual path comparison once made it silently exit 0.
- Never write a run of backticks inside a table cell; say "code fence".
- Evidence is pasted from a command's output after it returns; a script that writes the cell it expects once recorded a passed check that had exited 1.
- A proof piped through `tail` reports tail's exit code; run it unpiped or to a file and read `$?` straight after.
- Right after a publish, `npx planrails@X.Y.Z` fails with ETARGET: the registry lags a minute and npm's cached metadata longer. Poll the registry, then smoke-test with `npm_config_prefer_online=true`.
- Advice to the model rides the checker's notes, not hooks; a new note needs a recorded failure behind it and stays silent on a healthy plan.
- A reloaded plan is in every session's context, not only its holder's; the plan's `session:` line plus the live listing (`claude agents --json`) says who holds it — matched by session id, because a session's name can change within the hour.

## Active plans

Each plan below is held by one session — see its NOW `session:` line. Work one only when asked in this session, after the check in its block.

none

## Finished plans

`@.project-management/plans/self-sufficient-plan/PLAN.md` — 0.4.0, closed 2026-09-13
`@.project-management/plans/session-claim/PLAN.md` — 0.5.0 and 0.5.1, closed 2026-09-13
`@.project-management/plans/checker-notes/PLAN.md` — 0.6.0, closed 2026-09-19
