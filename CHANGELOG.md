# Changelog

## 0.4.1 — 2026-09-13

- The Claude Code skill is `/planrails`, not `/plan`, because Claude Code has a
  `/plan` of its own. Install it at `~/.claude/skills/planrails/`; the README and
  the sentence `init` prints say so. Nothing else changed.

## 0.4.0 — 2026-09-13

A review of 0.3.0 against a real multi-session plan, the Claude Code docs, and
the planning systems that came before it found where the promise leaked, and this
release closes the leaks. Two of them are behaviour changes in the checker; the
rest is method. Everything stays a prompt plus one script, and `init` still writes
nothing but its two files.

- **Evidence must record the proof's exit code, and it must be 0.** A command
  proof's evidence cell now needs `exit 0` (or `exit code 0`, `exited 0`); a bare
  word such as "done" or "✅", or a pasted `exit 1`, fails the build. This is the
  format `PLANNER.md` always prescribed; the checker now checks it, and every
  `exit N` in the cell counts. A proof cell must be exactly one backticked command
  or the word `owner`, not prose with a span in it; an owner-closed task records
  the owner's words with the date. **This is the one change that can fail a plan
  that passed before** — and only a plan the method already called not done.
  Re-run the proof and paste its exit code.
- **The checker fails closed on a row it cannot read.** The cell splitter follows
  the CommonMark rule for backtick runs, so a stray backtick or three backticks in
  prose no longer shift the columns; a row whose cell count still differs from the
  header's is a problem instead of a silent pass. A task table inside a code fence
  is ignored, a table right after the task table with no heading between is no
  longer read as tasks, and `**id**` in a header is read.
- **Two integrity checks keep the reload honest.** When the project has a
  `CLAUDE.md`, every active plan must be reloaded by
  `@.project-management/plans/<id>/PLAN.md` on its own line, outside backticks and
  fences, and no such line may point at a plan that does not exist. An active
  plan's `RESUME` line must name a task that is still open, so a stale NOW is
  caught. Both are skipped for a retired plan, so retiring a plan now means
  setting `status: done` and then backticking its line; a plan with no status
  line counts as active, the safe direction; the reload check is skipped when
  there is no `CLAUDE.md`.
- **`--verify` has a timeout** (10 minutes per proof) and reports the last line a
  failing proof printed, instead of hanging or saying nothing.
- **The checker can no longer silently exit 0.** Its entry guard compared paths
  textually, so run through a symlink, or through `/tmp` on macOS, it printed
  nothing and passed. It now compares real paths, and a test runs it as a command,
  and through a symlink, on a plan with a known problem. The same fix went into
  the CLI, which npm installs as a symlink.
- **The plan carries its own loop.** The PLAN.md template's HTML comments became a
  "How to work this plan" block: set doing, run the proof now with the time from
  `date`, paste `exit N`, done only on 0, update NOW, append a LOG entry, record a
  learning, say where a blocked reason goes, run `git status --short` after a
  compaction, and how to brief a sub-agent. A fresh session with only `CLAUDE.md`
  and the plan completed a two-task plan by the loop and retired it correctly.
- **The method (PLANNER.md) gained:** the project-root `CLAUDE.md` named as the
  always-loaded file; "check the plan before the first task"; a task per sitting,
  permanent task ids and `dropped` rows; phase-end end-to-end tasks; one active
  plan per repo; a ~2,000-word budget that trims prose before Learnings; "delegate
  a self-contained task" with a five-line brief, one writer per file, output to a
  named file, and the main session running the proof; the engineering standards
  (fix the cause, a red test starts an investigation, never weaken an assertion);
  a fresh-context review at close; retiring a plan by backticking its line, never
  by moving it under a "Finished" heading, which still imports; and the evidence
  behind each rule. A test pins the template inside `PLANNER.md` to the checker,
  so the two cannot drift apart.
- **`init` updates the tool and never the plans.** Both copied files carry
  `planrails X.Y.Z` near the top. A re-run replaces an older or unstamped copy
  under `.project-management/planrails/` and says what it replaced, keeps a
  same-version copy you edited unless `--force`, never writes into `plans/`, and
  points out 0.2.x files left at the `.project-management/` root. `--root` and
  `--dir` are accepted everywhere. The CLI runs correctly through npm's bin
  symlink.
- The `/plan` skill reads the project's own copy of `PLANNER.md` and says to run
  `init` if it is missing, so there is one copy per project, not three. The README
  says plainly that automatic reload is Claude Code's; other agents open the plan
  by hand. The worked example carries the new block and a `CLAUDE.md` with the
  reload line, so it exercises all three rails, and its log agrees with its
  learnings. The README, the CLI's next steps and `PLANNER.md` use one start
  sentence, the one that makes the agent report ready and wait. This repo's own plan for this release lives in
  `.project-management/plans/self-sufficient-plan/` and is gated by the checker it
  ships, in CI. 70 tests.

## 0.3.0 — 2026-09-12

Two changes, both asked for by a user planning a long, multi-session feature:
carry learnings forward so a mistake is not re-paid in the next chat, and tidy the
installed files into one folder.

- **Learnings are now a first-class, reloaded part of a plan.** `PLAN.md` gains a
  `## Learnings` section: each line is the trap and the rule it taught. It reloads
  with the plan at the start of every session — and after every compaction —
  through the same reload line, so the next session reads the lesson before it
  repeats the struggle. A learning is distinct from a `Rule` (a constraint known
  up front) and a `Decision` (a choice and why). `PLANNER.md` makes capturing a
  learning a step of the execute loop, written the moment a task fights back; tells
  a resuming session to read the Learnings first; and graduates a learning that
  outlives the plan to the always-loaded file. Until now the only place for a
  lesson was a `LOG.md` line, and the log is neither reloaded nor re-read — which
  is exactly why the same struggle returned in each new session.
- **The two installed files move into `.project-management/planrails/`.** `init`
  now writes `.project-management/planrails/PLANNER.md` and
  `.project-management/planrails/check-plans.mjs`, leaving `.project-management/`
  holding just two folders: `planrails/` (the tool) and `plans/` (your plans). The
  reload line is unchanged — `@.project-management/plans/<id>/PLAN.md`. If you ran
  an older `init`, point your check command at the new path
  (`node .project-management/planrails/check-plans.mjs`) and remove the two loose
  files left at the `.project-management/` root.
- The checker's behaviour is unchanged: learnings are prose, enforced by the
  method, not the gate, and a plan with no `Learnings` section still validates. A
  test pins that a `Learnings` section does not confuse the parser. 34 tests.

## 0.2.1 — 2026-09-12

A careful post-release review, including an end-to-end test of the published
package, found one robustness gap in the checker and fixed it.

- The checker finds a task table by its columns (`id`, `status`, `proof`,
  `evidence`), not by a `## Tasks` heading. So tasks under `## Phase 2 Tasks`,
  `## Backlog`, any heading, or none at all are all gated — a phased plan is no
  longer rejected with a confusing "no readable Tasks table". A table under a
  literal `## Tasks` heading that is missing a column still names which one.
- Verified against the live 0.2.0 package: `npx planrails init` copies only into
  `.project-management/`, leaves `package.json` and a pnpm lockfile untouched,
  writes no `node_modules` and no `CLAUDE.md`, and the checker catches every
  faked-"done" bypass. 33 tests.

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
