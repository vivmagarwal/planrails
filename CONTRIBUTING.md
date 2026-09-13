# Contributing

planrails is a prompt and one small script. Contributions are welcome.

## Report something

Open an issue: https://github.com/vivmagarwal/planrails/issues/new/choose — a bug,
a case the planner handles badly, or something you wish it did.

## Run the tests

```bash
git clone https://github.com/vivmagarwal/planrails && cd planrails
npm test     # the checker's rules: a done task must name a proof and carry evidence
npm run check   # the tests, plus the checker run on this repo's own plan and on examples/weekly-digest
```

No dependencies. Node 20+, any OS.

## Change something

- **`PLANNER.md` is the product.** It is read by a model that will not see this
  file. Keep it plain: short sentences, active voice, a worked example, and no new
  rail beyond the three it already has (reload, proof, evidence). The Rules,
  Decisions and Learnings sections of a plan are plain prose, not new machinery —
  add to them freely. If a change makes a plan easier to fake done, it will not be
  merged.
- **`tools/check-plans.mjs` enforces one rule** — a done task needs a proof and
  evidence that records `exit 0` — plus two integrity checks that keep the reload
  honest: an active plan has its reload line, and its NOW keeps a RESUME line
  that names an open task. Keep it
  to that, and fail closed: a row the parser cannot read is a problem, never a
  pass. NOW's `session:` line is method: the checker ignores it (a test pins
  that), because liveness is a runtime fact, not a commit-time one. Every
  behaviour has a case in `tools/check-plans.test.mjs`; add one for anything you
  change.
- **Keep it copy-simple.** The CLI (`bin/planrails.mjs`) only copies two files
  into a project's `.project-management/planrails/`, updates those two on a
  re-run, never touches a plan, and runs the checker — no `package.json` edits,
  no `npm install`, no hooks. Do not add a build step, a config file, or a
  runtime dependency. Both copied files carry `planrails X.Y.Z` near the top; a
  test pins it to `package.json`, so bump all three together.
  `PLANNER.md` must stay self-contained: an agent that has only that file must be
  able to do everything it says.
