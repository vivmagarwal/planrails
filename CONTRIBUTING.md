# Contributing

planrails is a prompt and one small script. Contributions are welcome.

## Report something

Open an issue: https://github.com/vivmagarwal/planrails/issues/new/choose — a bug,
a case the planner handles badly, or something you wish it did.

## Run the tests

```bash
git clone https://github.com/vivmagarwal/planrails && cd planrails
npm test     # the checker's rules: a done task must name a proof and carry evidence
npm run check   # the tests, plus the checker run against examples/weekly-digest
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
  pasted evidence. Keep it to that. Every behaviour has a case in
  `tools/check-plans.test.mjs`; add one for anything you change.
- **Keep it copy-simple.** The CLI (`bin/planrails.mjs`) only copies two files
  into a project's `.project-management/planrails/` and runs the checker — no
  `package.json` edits, no `npm install`, no hooks. Do not add a build step, a
  config file, or a runtime dependency.
  `PLANNER.md` must stay self-contained: an agent that has only that file must be
  able to do everything it says.
