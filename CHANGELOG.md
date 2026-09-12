# Changelog

## 0.1.2 — 2026-09-12

- `npx planrails update` now also rewrites the plans block in CLAUDE.md from the plans on disk, so a marker or wording written by an older version is replaced on upgrade. `test/claude-md.test.mjs`.
- Release checks around `npm publish` (`scripts/release-check.mjs`, wired as `prepublishOnly` and `postpublish`): before uploading, refuse a version the registry already has, a missing CHANGELOG entry, a dirty tree or an unpushed HEAD; after uploading, wait until the registry serves the version. Why: a web-authenticated publish is staged and finalizes about a minute later; in that window a second publish fails with E409 and an install with ETARGET, which is how 0.1.1's release went. CONTRIBUTING.md § Release. `test/release-check.test.mjs`.

## 0.1.1 — 2026-09-12

Fixed, found while moving a real project from a vendored copy to the package:

- `npx planrails init` on a project that did not yet hold the package wrote the npx cache's absolute path into every hook command (machine-local, and evicted by npm). Hook commands now name `$CLAUDE_PROJECT_DIR/node_modules/planrails/…` whenever the project holds its own copy, whichever copy runs the installer. `test/hooks-path.test.mjs` reproduces it with a copied package.
- A CLAUDE.md plans block written by an older copy of the system (a different generator name in its marker) was not recognised, so `init` and `activate` added a second block beside it. Any `<!-- plans:begin` marker now counts as the block. `test/claude-md.test.mjs`.
- Internal: `npm test` lists the test files by name (`scripts/run-tests.mjs`); Node 20 does not expand the glob the 0.1.0 script used, so its CI jobs failed.

## 0.1.0 — 2026-09-12

First release, extracted from the project it was built in after a day of use.

- `planrails init` sets a new or an existing project up, idempotently; `update`, `uninstall`, `doctor`.
- Plans as files: PLAN.md, state.json, gates.json, rules.json, append-only log / learnings / decisions / gate-runs.
- A task is done only through `task done`: it runs the gate, records the run, and needs every condition of done answered (C1–C7 by default, more per plan or per task).
- Gates declare what they do not check and a known-fail case; `gate verify` proves each can fail; a gate edited after verification cannot close a task.
- Hooks for Claude Code: brief at SessionStart (also after compaction), rules at the tool call, a Stop reminder to log, a subagent brief, a pre-compaction journal. Portable settings via `$CLAUDE_PROJECT_DIR`.
- `run`: one fresh `claude -p` session per task.
- `issue`: a prefilled GitHub issue with the environment.
