# Plan-system fixtures

`broken-root/` is a project root whose one plan LIES: task T1 is `done` citing a
gate run that is not in `gate-runs.jsonl`. It is the known-fail case for the
validator gate — `PLAN_PROJECT_ROOT=node_modules/planrails/src/plan/fixtures/broken-root node
src/plan/plan.mjs validate --all --quiet` must exit 1. If it ever exits 0,
the validator has stopped seeing fabricated evidence.
