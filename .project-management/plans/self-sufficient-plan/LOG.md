# Self-sufficient plans — log

Append-only. One entry per landed piece of work, newest at the bottom.

## 2026-09-13 13:23 — plan opened
- did: reviewed the whole repo, probed the checker with ten cases, confirmed the Claude Code import behaviour rail 1 depends on, and read a real 0.3.0 plan in the edodo-video repo. Wrote this plan from the findings. The "How to work this plan" block in PLAN.md is the first instance of what T4 puts in the template.
- files: .project-management/plans/self-sufficient-plan/PLAN.md, .project-management/plans/self-sufficient-plan/LOG.md, CLAUDE.md (new, with the reload line), package.json (`check` runs the checker on this repo)
- proof: `node tools/check-plans.mjs` → exit 0, "1 plan(s) ok"; the T1 prototype run on the same file → exit 1 until T1's row was reworded (see Learnings), then exit 0
- next: T1 — the gate matches the method
- learned / decided: a patched checker that passes all 27 existing tests and the ten probes exists in this machine's Claude Code scratchpad for session 089565f3; a lead, not a fact — T1 rebuilds it from the tests, one case at a time

## 2026-09-13 13:39 — plan re-reviewed against the owner's earlier planning prompt
- did: compared this plan and PLANNER.md with the planning prompt and template the owner used before planrails. Adopted four things: a check-the-plan step before the first task, the engineering standards as an executor rule, a phase-end end-to-end task, docs as the last task before release. Declined three, each recorded in Decisions: absolute paths, research by the executor, a progress log inside the plan. Fixed two gaps in this plan itself: the ten acceptance cases lived only in chat and are now under Done when; T1's backtick fix was a symptom fix and is now the CommonMark rule plus a cell-count safety net. Split the PLANNER.md prose work into T5 and T6; docs moved to T11, just before release.
- files: .project-management/plans/self-sufficient-plan/PLAN.md, .project-management/plans/self-sufficient-plan/LOG.md
- proof: `node tools/check-plans.mjs` → exit 0, "1 plan(s) ok"
- next: T1 — the gate matches the method
- learned / decided: two Learnings and four Decisions added; the word budget question is a Decision the owner can reverse

## 2026-09-13 13:54 — plan reviewed against karma_sakha's older plans and hooks
- did: read the five project hooks myself and had one sub-agent read the five 0.1.x plan folders, the two planning docs and the planning rules of CLAUDE.md there; its numbers with a file path were kept, the rest marked as leads. Adopted into the task specs: a NOW-consistency check in the checker (RESUME must name a live task), NOW as three lines written for a stranger, stable task ids, the delegation brief's tested shape (named output file, one writer per file, validate one unit, reconcile against files), a fresh-context review at close, `git status --short` after a compaction, editing the plan through the editor. Declined, with reasons in Decisions: hooks of every kind, a compaction journal, a word-count rail, timestamp-based staleness.
- files: .project-management/plans/self-sufficient-plan/PLAN.md, .project-management/plans/self-sufficient-plan/LOG.md
- proof: `node tools/check-plans.mjs` → exit 0, "1 plan(s) ok"
- next: T1 — the gate matches the method
- learned / decided: one Decision added (stable ids), two reworded with the karma_sakha evidence (no hooks; the checker's two integrity checks)

## 2026-09-13 14:08 — T1: the gate matches the method
- did: the cell splitter follows the CommonMark backtick rule; a row whose cell count differs from the header's is a problem; a claim's proof must be a backticked command or owner; a command proof's evidence must record exit 0; fenced lines are never rows; a row followed by a separator starts a new table; header markup is ignored. One test per acceptance case, each red on the 0.3.0 checker.
- files: tools/check-plans.mjs, tools/check-plans.test.mjs
- proof: `node --test tools/check-plans.test.mjs` → exit 0, "ℹ pass 36 ℹ fail 0"
- next: T2 — the reload line and a current NOW
- learned / decided: the owner asked that a re-run of `init` update the planner folder and never the plans; T8's spec and a Decision now say so. My test pinned a line number the fixture helper shifts; assert the message, not the line.

## 2026-09-13 14:09 — T2: the reload line and a current NOW
- did: when CLAUDE.md exists, an active plan must be reloaded by a bare `@.project-management/plans/<id>/PLAN.md` line outside fences and backticks, and no such line may point at a missing plan; a RESUME line naming only done tasks is stale. Both skipped for a retired plan. `isActive` and `reloadLines` exported.
- files: tools/check-plans.mjs, tools/check-plans.test.mjs
- proof: `node --test tools/check-plans.test.mjs` → exit 0, "ℹ pass 44 ℹ fail 0"
- next: T3 — `--verify` timeout and last output line

## 2026-09-13 14:09 — T3: `--verify` gets a timeout and shows why a proof failed
- did: `runProof` runs a proof with a timeout (10 min by default) and returns its exit code and last output line; a hang is reported as "timeout after Ns"; a failure shows its last line in the problem.
- files: tools/check-plans.mjs, tools/check-plans.test.mjs
- proof: `node --test tools/check-plans.test.mjs` → exit 0, "ℹ pass 47 ℹ fail 0"
- next: T4 — the template carries its own loop

## 2026-09-13 14:13 — T4, T5, T6: PLANNER.md carries the loop, checks the plan, delegates
- did: rewrote PLANNER.md in one pass. The template's HTML comments became a "How to work this plan" block; NOW is written for a stranger with the time from `date`; task ids are permanent and a dropped row stays; §1 reads only the active plan in full; §3 names the root CLAUDE.md, adds "Check the plan before the first task", a task per sitting, phase-end end-to-end tasks, one active plan per repo, and the ~2,000-word budget; §4 adds the standards, `git status --short` after a compaction, NOW sub-steps, editing through the editor, and "Delegate a self-contained task" with the brief; §5 adds the fresh-context review, learnings that become tests, and retiring by backticks. "Why it is shaped this way" records the karma_sakha evidence.
- files: PLANNER.md
- proof: owner — the wording is the owner's to approve; T7's test proves the template parses and passes the gate
- next: T7 landed with it; T8 — init updates the tool
- learned / decided: PLANNER.md grew from 2,341 to 3,163 words; it is read at plan time only, not reloaded, so the cost is once per plan

## 2026-09-13 14:13 — T7: the template in PLANNER.md is a plan the checker accepts
- did: a test extracts the ````markdown block under "## Template — PLAN.md", parses it, asserts three placeholder rows with every column, no problems, and the presence of the How-to block, NOW, `date`, LOG.md, Learnings and the checker.
- files: tools/check-plans.test.mjs
- proof: `node --test tools/check-plans.test.mjs` → exit 0, "ℹ pass 49 ℹ fail 0"
- next: T8

## 2026-09-13 14:15 — T8: init updates the tool and never the plans
- did: both copied files carry `planrails X.Y.Z` near the top, pinned to package.json by a test. A re-run of `init` replaces an older or unstamped copy and says which version it replaced, keeps a same-version edited copy unless `--force`, keeps a copy newer than the package, never writes into plans/ (byte-identical PLAN.md, LOG.md and CLAUDE.md asserted), and points out 0.2.x files left at the .project-management/ root without deleting them. `--root` and `--dir` are aliases in both CLIs.
- files: bin/planrails.mjs, bin/planrails.test.mjs, PLANNER.md (stamp line), tools/check-plans.mjs (stamp line, --dir)
- proof: `node --test bin/planrails.test.mjs` → exit 0, "ℹ pass 13 ℹ fail 0"
- next: T9
- learned / decided: my first main-module guard compared paths textually; npm installs the bin as a symlink, so `npx planrails` would have imported and done nothing → compare real paths, and a symlink test now fails without it (skipped on Windows, where symlinks need privileges)

## 2026-09-13 14:15 — T9: this repo's own plan is gated in CI
- did: ci.yml runs `node tools/check-plans.mjs` after the suites, so the plan for planrails passes the checker planrails ships. `npm run check` already did.
- files: .github/workflows/ci.yml
- proof: `npm run check` → exit 0, "ℹ pass 62 ℹ fail 0"
- next: T10 — the fresh-session dry run

## 2026-09-13 14:20 — T10: the fresh-session dry run
- did: built a scratch project from the new template (CLAUDE.md with the reload line, the two planrails files, a two-task plan with real proofs), then ran a fresh headless session with the Claude Code environment of this session unset and the single prompt "Continue the active plan." It did T1 and T2 by the loop, pasted `date · exit 0 · ""` evidence, moved NOW, appended LOG entries, re-ran both proofs at close, ran a fresh-context review, set the plan's status to shipped and wrapped the reload line in backticks. 14 turns, 191 seconds. The checker passes the result; `node count.mjs` prints 1.
- files: none in this repo; the scratch project lives in this session's scratchpad under dryrun/
- proof: owner — the transcript's key lines are in the evidence cell; the owner judges
- next: T11 — docs
- learned / decided: the session wrote one-line LOG entries because the LOG template lives in PLANNER.md, not in the plan → the template's How-to block now names the entry's shape (did, files, proof, next, learned)

## 2026-09-13 14:22 — T11: docs, last before release
- did: README describes the 0.4.0 checker (exit 0, fail-closed rows, reload line, NOW), the init update rule, the "How to work this plan" block, and says automatic reload is Claude Code's; CHANGELOG 0.4.0 names every behaviour change with the exit-0 rule first; CONTRIBUTING states the checker's scope and the stamp rule; the skill reads the project's copy and says to run init if missing; the worked example carries the block and its LOG agrees with its Learnings.
- files: README.md, CHANGELOG.md, CONTRIBUTING.md, skill/SKILL.md, examples/weekly-digest/README.md, examples/weekly-digest/.project-management/plans/weekly-digest/PLAN.md, examples/weekly-digest/.project-management/plans/weekly-digest/LOG.md
- proof: owner — `npm run check` → exit 0, "ℹ pass 62 ℹ fail 0" as the sanity check
- next: T12 — release

## 2026-09-13 14:33 — §5 close, step 2: fresh-context review, findings fixed
- did: a sub-agent with no chat context checked the work against Done when and Must not change. It confirmed all 11 cases have a test and found one blocker and several should-fixes; all are fixed with a test each: the checker's entry guard compared paths textually and could silently exit 0 through a symlink or /tmp (now real paths, spawned tests, symlink test); a proof cell must be exactly one code span, so `see \`README.md\`` is not a proof and `--verify` cannot execute it; every `exit N` in an evidence cell counts, and `exit status 1` is read; an owner-closed task needs the date with the owner's words; a ```` fence may hold a ``` example; RESUME matches an id written `**T1**`. Retiring a plan now sets `status: done` first, in PLANNER.md, the skill and the changelog. README no longer says init never overwrites; CONTRIBUTING's check description names this repo's plan.
- files: tools/check-plans.mjs, tools/check-plans.test.mjs, PLANNER.md, skill/SKILL.md, README.md, CONTRIBUTING.md, CHANGELOG.md
- proof: `npm run check` → exit 0, "ℹ pass 70 ℹ fail 0"
- next: commit 0.4.0, push main, watch CI; the tag push waits for the owner's go
- learned / decided: two Learnings added; the review's other nits (RESUME naming an unknown id, `--dir` with no value) are left as is: both fail in the closed direction or are documented

## 2026-09-13 14:37 — T12: 0.4.0 committed and green in CI; the tag waits for the owner
- did: bumped package.json and both stamps to 0.4.0 together, committed everything as 4bfa4ff on main and pushed. CI run 34748926329 passed all nine jobs: ubuntu, macos and windows on Node 20, 22 and 24, including the repo's own plan through the checker and the spawned-checker tests.
- files: package.json, PLANNER.md, tools/check-plans.mjs (stamps), and the whole release
- proof: owner — CI: `gh run view 34748926329` → conclusion success; the publish is the owner's explicit go: `git tag v0.4.0 && git push origin v0.4.0`
- next: the owner reads PLANNER.md, README.md and CHANGELOG.md (T4, T5, T6, T11), judges T10's run, pushes the tag; then `npx planrails@0.4.0 init` in an empty folder; then set this plan's status to done and backtick its line in CLAUDE.md

## 2026-09-13 15:06 — field test: three demo projects, seven fresh sessions, three npx paths
- did: under ~/Work/temporary_tests built notes-api (Node, the 0.4.0 tarball as a devDependency, `npx planrails init` through npm's bin symlink), py-tally (Python, no package.json, `npx --package=<tarball> planrails init`) and legacy-0-3 (the published `npx planrails@0.3.0 init`, a hand-written 0.3.0-era plan, the checker in a git pre-commit hook, then updated from the tarball). Seven headless `claude -p` sessions with no context of this chat: two READY steps (one through the installed /plan skill) stopped after the eight-line report; two planning sessions wrote plans of 1,270 and 1,358 words with proofs, the reload line, the checker wired into `npm run check` and `make check`, and ran the check-the-plan step, one finding a real environment trap; two brand-new execution sessions completed the plans by the loop with exit 0 evidence, ran the fresh-context review at close, which found real gaps in both projects, fixed them with tests, and left owner-proof tasks blocked with the reason; one retired its plan correctly. The legacy session spotted that a hand-written "done" had no work behind it, reopened the task, and finished the plan under the stricter checker. The pre-commit gate refused a faked done. `npx planrails check` and `--verify` passed through both npx paths. Seven sessions, 84 turns, about 15 dollars. No defect in planrails; one wording change to the template's timestamp line.
- files: PLANNER.md, examples/weekly-digest/.project-management/plans/weekly-digest/PLAN.md, .project-management/plans/self-sufficient-plan/PLAN.md
- proof: `npm run check` → exit 0, "ℹ pass 70 ℹ fail 0"
- next: the owner's word on T4, T5, T6, T10, T11 and the tag push
