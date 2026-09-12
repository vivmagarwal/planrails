# Contributing

Thank you. Three ways to help, easiest first.

## 1. Tell us what went wrong, or what you wish for

From any project that uses planrails:

```bash
npx planrails issue bug    # something broke
npx planrails issue edge   # a gate, a rule or a condition was wrong in a case we did not think of
npx planrails issue wish   # something you wish it did
```

That opens a prefilled issue with your versions and what `doctor` and `validate`
say. No file contents and no plan text are sent. You can also open an issue by
hand: https://github.com/vivmagarwal/planrails/issues/new/choose

## 2. Run the tests

```bash
git clone https://github.com/vivmagarwal/planrails && cd planrails
npm install
npm test            # node --test: the CLI, init, the hooks, the issue command
npm run selftest    # the validator's own refusals, and the hooks on captured payloads
npm run acceptance  # needs the claude CLI: a real session must quote the injected brief
```

Every test drives the real CLI against a throwaway directory. Nothing touches
a real project.

## 3. Change something

- Every rail has a test that proves it can fail. If you add a refusal to the
  validator, add a case to `planrails selftest` (in `src/plan/plan.mjs`) that
  trips it. If you add a hook behaviour, add a case to `src/hooks/selftest.mjs`
  built from a payload a real Claude Code run produced, not from the docs.
- Write for a beginner. Short sentences, plain words, one concrete example.
- `docs/PLANNING_GUIDE.md` ships with the package and is copied into every
  project by `init`, so a change to behaviour changes the guide in the same
  commit.
- Never let the agent bend a gate. If a change makes it easier to mark a task
  done without evidence, it will not be merged.
