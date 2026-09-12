# Changelog

## 0.2.0 — 2026-09-12

Rebuilt as a planner prompt and one checker, with a two-command CLI that only
copies files. Backward compatibility with 0.1.x is intentionally dropped.

Why: 0.1.x was a heavy npm package, and its weight is what made it fragile. It
wrote a `package.json` and ran `npm install`, so it could not fit pnpm, bun,
non-Node or monorepo projects; it ran every gate through `bash -c`, so Windows
could not work; it resolved the project root by a rule the CLI and the installed
hooks could disagree on; and it carried ~2,500 lines and an 8,842-word guide to
plan a feature. A review found ten data-loss and silent-failure paths in that
surface. The planning idea never broke — the machinery around it did.

What it is now, same three rails:

- **`PLANNER.md`** — the prompt an agent reads to plan with you and then execute.
  Self-contained: the reload line, proof-before-work, evidence-at-close, and the
  plan and log templates are all in this one file.
- **`tools/check-plans.mjs`** — a small, dependency-free checker (any OS; Windows
  in CI). It enforces the one machine-checkable rule: a task that claims to be
  finished must name a proof and carry pasted evidence. It is built to catch a
  faked "done": any status that is not an explicit not-done word counts as a
  claim, and a pipe inside a proof command, a second task table, and a blank line
  in the table are all handled. `--verify` re-runs each proof (trusted plans
  only). `tools/check-plans.test.mjs`.
- **`bin/planrails.mjs`** — a safe CLI. `init` copies `PLANNER.md` and the checker
  into a project's `.project-management/` and writes nothing else (no
  `package.json`, no `npm install`, no hooks, no `CLAUDE.md` edits); `check` runs
  the gate. `bin/planrails.test.mjs`.
- **`skill/SKILL.md`** — copy to `~/.claude/skills/plan/` for `/plan`.
- **`examples/weekly-digest/`** — a worked plan the checker validates in CI.

Removed: `src/plan/*` (the 843-line `plan.mjs`, `store`, `schema`, `paths`, …),
`src/hooks/*` (SessionStart/PreToolUse/Stop/journal hooks, replaced by the reload
line), the old `init` that wrote `package.json`, `src/issue.mjs`, the `run`
fresh-session runner, the release/trial/acceptance tooling, and the shipped
fixtures. The plan format changed from JSON (`state.json`, `gates.json`,
`rules.json`) to one markdown table a person can read and fix. Publishing stays on
GitHub Actions trusted publishing (`.github/workflows/publish.yml`).

## 0.1.3 — 2026-09-12

- Releases published by GitHub Actions through npm trusted publishing (OIDC) on a `v*` tag push. `.github/workflows/publish.yml`. (Removed in 0.2.0.)
- The release checks understand CI. `test/release-check.test.mjs`. (Removed in 0.2.0.)
- `package-lock.json` committed; both workflows install with `npm ci`.

## 0.1.2 — 2026-09-12

- `npx planrails update` also rewrote the plans block in CLAUDE.md from disk.
- Release checks around `npm publish` (`scripts/release-check.mjs`): refuse a staged/dirty/undocumented publish before, wait for the registry after.

## 0.1.1 — 2026-09-12

- `npx planrails init` wrote portable hook commands (`$CLAUDE_PROJECT_DIR/…`) whenever the project held its own copy.
- Any `<!-- plans:begin` marker counted as the CLAUDE.md block, so `init` and `activate` stopped adding a second one.
- `npm test` listed test files by name for Node 20.

## 0.1.0 — 2026-09-12

First release, extracted from the project it was built in. An `init`/`update`/
`uninstall`/`doctor` CLI, plans as JSON files, `task done` with gates and C1–C7
conditions, Claude Code hooks, a fresh-session `run`, and an `issue` command.
