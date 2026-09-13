# planrails

A planner prompt (`PLANNER.md`) and one dependency-free checker (`tools/check-plans.mjs`), shipped by a two-command CLI (`bin/planrails.mjs`). Node 20+, no dependencies, tested on Linux, macOS and Windows.

Check: `npm run check` (this repo's own plans through the checker, the worked example, both test suites). Test: `npm test`.

Rules for changes are in `CONTRIBUTING.md`: no config file, no hook, no second script, no dependency; every checker change ships with a test that fails without it.

## Active plans

@.project-management/plans/self-sufficient-plan/PLAN.md
