# Changelog

## 0.2.0 — 2026-09-12

Rebuilt as a planner prompt and one checker. No install, no CLI, no hooks.
Backward compatibility with 0.1.x is intentionally dropped.

Why: 0.1.x was an npm package, and being an installed package is what made it
fragile. It assumed npm and wrote a `package.json`, so it could not fit pnpm, bun,
non-Node or monorepo projects; it ran every gate through `bash -c`, so Windows
could not work; it resolved the project root by a rule the CLI and the hooks could
disagree on; and it carried ~2,500 lines and an 8,842-word guide to plan a
feature. A review found ten data-loss and silent-failure paths in that surface.
The planning idea never broke — the machinery around it did. So the machinery is
gone.

What replaces it, same three rails:

- **`PLANNER.md`** — the prompt a model reads to plan with you and then execute.
  The reload line, proof-before-work, and evidence-at-close are its whole method.
- **`templates/PLAN.md` and `templates/LOG.md`** — the plan and its append-only
  history.
- **`tools/check-plans.mjs`** — ~120 lines, no dependencies, runs on any OS. It
  enforces the one machine-checkable rule: a task marked done must name a proof
  and carry pasted evidence. `--verify` re-runs each proof. `tools/check-plans.test.mjs`.
- **`skill/SKILL.md`** — copy to `~/.claude/skills/plan/` for `/plan`.
- **`examples/weekly-digest/`** — a worked plan the checker validates in CI.

Removed: the `bin/planrails.mjs` CLI, `src/plan/*` (the 843-line `plan.mjs`,
`store`, `schema`, `paths`, …), `src/hooks/*` (SessionStart/PreToolUse/Stop/
journal hooks, replaced by the reload line), `src/init.mjs`, `src/issue.mjs`, the
`run` fresh-session runner, the release/trial/acceptance tooling, the shipped
fixtures, and `.github/workflows/publish.yml`. The plan format changed from
JSON (`state.json`, `gates.json`, `rules.json`) to one markdown table a person
can read and fix.

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
