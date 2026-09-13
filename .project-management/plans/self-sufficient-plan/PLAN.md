# Self-sufficient plans — plan

status: active · opened 2026-09-13 · id: self-sufficient-plan

## NOW
RESUME: the owner's word on T4 · T5 · T6 · T10 · T11, then the T12 tag push; then §5: set status done, backtick the reload line in CLAUDE.md
NEXT: nothing after that; the plan retires
updated: 2026-09-13 15:06 (field test done; the tag waits for the owner)

## How to work this plan
Read NOW, then Rules and Learnings; do not re-read Context. One task at a time:
1. Set it `doing`; point NOW at it.
2. Do the work: fix causes, not symptoms; the simplest change that works end to end.
3. Run the proof now. Paste `YYYY-MM-DD HH:MM · exit N · "last line"` into evidence. Every stamp comes from `date` run at that moment, never typed from memory.
4. `done` only if N is 0. Point NOW at the next task; append an entry to LOG.md: did, files, proof, next, learned.
5. If it fought back, add a Learning: the trap, then the rule. A verified fact goes in Context, a choice in Decisions.

NOW is three lines for a stranger; on a long task note the sub-step, and update it before any turn ends. Blocked: say so in NOW, reason in the evidence cell. After a compaction, `git status --short` shows the in-flight work. Edit this file with the editor or a quoted heredoc; an unquoted shell string eats backticks. A self-contained task may go to a sub-agent briefed with its row, Rules, Decisions, Learnings and Context; it writes to a named file and reports a few lines, which are leads; you run the proof before pasting evidence. `node tools/check-plans.mjs` must pass. Full method: `PLANNER.md` §4.

## Goal
planrails promises a plan that survives a lost session and a "done" that means done. A review on 2026-09-13 found where that leaks: the reloaded PLAN.md carries the state but not the loop, and the checker accepts evidence the method rejects, such as `exit 1`, a bare word, a row broken by a stray backtick, or prose as a proof. This plan closes both, checks that the reload line is wired and NOW is current, and has the executor brief sub-agents from the plan so the main context stays small. Ships as 0.4.0, still a prompt plus one script.

## Done when
- `npm run check` exits 0: this repo's plans and the worked example pass the checker, both suites pass
- each case below has a test in `tools/check-plans.test.mjs` that fails without its fix:
  1. done with evidence `exit 1`: fails
  2. evidence a bare word (`done`, `✅`, `passed`): fails, no exit code
  3. a stray backtick in a task cell: split by the CommonMark rule; a row whose cell count differs from the header's fails closed
  4. proof is prose, or a code span inside prose: fails; a proof cell is exactly one backticked command or `owner`
  5. a task table inside a code fence: ignored
  6. a Decisions table right after Tasks, no heading between: not read as tasks
  7. `**id**` bold header: read
  8. `--verify`: a failing proof reports its last output line; a hanging proof times out
  9. active plan, CLAUDE.md present, no reload line: fails; reload line for a missing plan: fails; no CLAUDE.md: skipped
  10. NOW's RESUME line names only `done` tasks: fails, NOW is stale
  11. the PLAN.md template inside PLANNER.md passes the checker
- a fresh Claude Code session in a scratch project, given only a CLAUDE.md with the reload line and a two-task PLAN.md from the new template, completes one task by the loop: doing, proof run, exit code pasted, done, NOW updated, LOG appended (T10)
- `npx planrails@0.4.0 init` in an empty folder writes the two stamped files and nothing else

## Must not change
- the shape: one prompt, one dependency-free script, a CLI that copies two files and writes nothing else
- no config file, no required hook, no JSON state, no second script, no dependency
- the reload line `@.project-management/plans/<id>/PLAN.md` and the 0.3.0 folder layout
- the checker's scope: a claim needs a proof and evidence the proof ran, the reload line is wired, NOW names a live task
- `npm test` green on Node 20, 22, 24 across Linux, macOS, Windows

## Tasks
| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
| T1 | the gate matches the method (tools/check-plans.mjs): the cell splitter follows the CommonMark backtick rule, a run opens a code span only when an equal run closes it, else it is literal; a row whose cell count differs from the header's is a problem; a claim's proof is a backticked command or `owner`; a command proof's evidence must record `exit 0`, any other exit fails; lines inside code fences are never rows; a row followed by a separator starts a new table; markup in header cells is ignored | done | `node --test tools/check-plans.test.mjs` | 2026-09-13 14:08 · exit 0 · "ℹ pass 36 ℹ fail 0" |
| T2 | rail 1 and a current NOW (tools/check-plans.mjs): when CLAUDE.md exists, an active plan with no reload line on its own line outside a fence is a problem, and a reload line for a missing plan is a problem, skipped when there is no CLAUDE.md; a RESUME line whose task ids are all `done` is a problem | done | `node --test tools/check-plans.test.mjs` | 2026-09-13 14:09 · exit 0 · "ℹ pass 44 ℹ fail 0" |
| T3 | `--verify` gets a timeout (10 min default) and reports the failing proof's last output line (tools/check-plans.mjs) | done | `node --test tools/check-plans.test.mjs` | 2026-09-13 14:09 · exit 0 · "ℹ pass 47 ℹ fail 0" |
| T4 | the PLAN.md template carries its own loop (PLANNER.md § Template): a "How to work this plan" block, as in this file, replaces the HTML comments; NOW is three lines written for a stranger; Context holds verified facts and marks leads; task ids are never renumbered and a dropped row stays | review | owner | 2026-09-13 14:13 written; awaiting the owner's word on the wording |
| T5 | PLANNER.md §1 and §3: name the root CLAUDE.md; §1 reads the active plan in full and lists the rest by id; §3 gains "Check the plan before the first task", by you or a fresh sub-agent: open every path named, start every proof, confirm the reload line loads and the checker passes, log what changed; write for a senior engineer, decisions and context, not obvious steps; a task longer than one sitting is two tasks; a phased plan ends each phase with an end-to-end task; budget ~2,000 words, prose trimmed before Learnings or Decisions | review | owner | 2026-09-13 14:13 written; awaiting the owner's word |
| T6 | PLANNER.md §4 and §5: §4 gains "Delegate a self-contained task" with the brief as in this file's How-to block plus the output file to write, one writer per file, validate one unit before scaling, reconcile a report against the files not the reply, and bulk work goes to sub-agents so the main session never holds bulk output; the standards: fix the cause, a red test starts an investigation before anything changes, never weaken an assertion to get green; NOW sub-steps, `git status --short` after a compaction, edit the plan through the editor; step 6 says "an entry"; §5 closes with a fresh-context review against Done when, turns a learning a check could enforce into a test, and retires a plan by backticking or deleting its line; one active plan per repo, others paused by backticks | review | owner | 2026-09-13 14:13 written; awaiting the owner's word |
| T7 | a test extracts the PLAN.md template from PLANNER.md and runs it through the checker, so template and parser cannot drift (tools/check-plans.test.mjs) | done | `node --test tools/check-plans.test.mjs` | 2026-09-13 14:13 · exit 0 · "ℹ pass 49 ℹ fail 0" |
| T8 | `init` updates the tool and never the plans (bin/planrails.mjs, PLANNER.md, tools/check-plans.mjs): a version stamp in both copied files, pinned to package.json by a test; a re-run replaces an older or unstamped copy under `.project-management/planrails/` and says so, leaves a same-version copy alone unless `--force`, never writes into `plans/`, and points out 0.2.x files left at the `.project-management/` root; `--root` and `--dir` accepted everywhere | done | `node --test bin/planrails.test.mjs` | 2026-09-13 14:15 · exit 0 · "ℹ pass 13 ℹ fail 0" |
| T9 | dogfood: `node tools/check-plans.mjs` runs on this repo in `npm run check` and in ci.yml | done | `npm run check` | 2026-09-13 14:15 · exit 0 · "ℹ pass 62 ℹ fail 0" |
| T10 | fresh-session dry run as described under Done when; paste the transcript's key lines as evidence; if the session skips a step, fix the template block and rerun | review | owner | 2026-09-13 14:20 run: fresh `claude -p` session, 14 turns, both tasks done by the loop with exit 0 evidence, NOW moved, LOG appended, plan retired; checker exit 0. Awaiting the owner's word |
| T11 | docs, last before release: the skill reads the project copy of PLANNER.md only and says to run init if missing (skill/SKILL.md); README says automatic reload is Claude Code, other agents open the plan by hand; the example's LOG and Learnings agree on the ordering; CHANGELOG 0.4.0 names every behaviour change, the exit-0 rule first | review | owner | 2026-09-13 14:22 written; `npm run check` exit 0. Awaiting the owner's word |
| T12 | release 0.4.0: bump `package.json`, tag by name, confirm `npx planrails@0.4.0 init` in an empty folder; only on the owner's explicit go | review | owner | 2026-09-13 14:37 bumped, committed 4bfa4ff on main, CI green on 9 jobs (run 34748926329); the tag push waits for the owner's go: `git tag v0.4.0 && git push origin v0.4.0`, then `npx planrails@0.4.0 init` in an empty folder |

## Rules for this plan
- Every checker change ships with a test that fails without it. Prose changes are proven by the owner.
- Fix the cause, not the symptom. A red test starts an investigation, product, test or environment, before anything changes; never weaken an assertion to get green.
- Fail closed. A row the parser cannot read is a problem, never a pass.
- Nothing new in a project: no flag beyond the `--dir` alias, no file beyond the two copied; `init` may replace those two, never anything else.
- PLANNER.md prose stays plain, per CONTRIBUTING.md: short sentences, active voice, a worked example, no fourth rail.
- Keep the worked example passing unchanged.
- Nothing outward-facing, a tag or a publish, without the owner's explicit go.

## Decisions
| date | decision | why |
|------|----------|-----|
| 2026-09-13 | no JSON tracker; PLAN.md is the single source of truth | 0.1.x kept state in JSON and grew ten data-loss paths; one comma breaks JSON, a bad row fails one row closed; the plan must also read as guidance. A derived `--json` view can come later |
| 2026-09-13 | no hooks; the reload line is the mechanism | the root CLAUDE.md is re-read after compaction. karma_sakha's hooks misfired four recorded ways: a crashing PreToolUse blocked the call, the read guard was wrong twice, the bash guard blocked its own selftest, the journal was mostly command stubs |
| 2026-09-13 | a command proof's evidence must record `exit 0` | the format the method prescribes; the one change that can fail an old plan, and only one the method already calls not done |
| 2026-09-13 | the checker also checks the reload line and that NOW names a live task | both failures are silent and defeat the reload; about twenty lines; no timestamps compared |
| 2026-09-13 | sub-agent delegation is method, not machinery | the row plus Rules, Decisions, Learnings and Context is the brief; a one-unit brief worked in karma_sakha; the main session runs the proof |
| 2026-09-13 | no word-count rail | a prose rule; a 19,451-word karma_sakha plan, 16,707 of it progress, is what a three-line NOW and a separate LOG prevent by shape |
| 2026-09-13 | repo-relative paths, not absolute | absolute paths break on the next machine; relative ones are clickable and survive a clone |
| 2026-09-13 | research lands in Context at plan time, history in LOG.md | re-research by the executor, or a log that reloads and grows, re-spends the context the plan saves |
| 2026-09-13 | no compaction journal hook; `git status --short` plus NOW is the in-flight record | compaction loses progress state, not doctrine; git holds the files changed; a transcript-parsing hook rests on an undocumented format |
| 2026-09-13 | word budget ~2,000, prose trimmed first | the two real 0.3.0 plans landed near 2,000 with nothing to cut but Learnings; a limit every plan breaks gets ignored |
| 2026-09-13 | task ids are stable; a dropped task keeps its row | karma_sakha renumbered T1 to T14 and T2 to T15 and lost the thread |
| 2026-09-13 | a re-run of `init` updates the planner folder to the package version and never touches a plan | the owner's call: the planner is the tool, the plans are the data; a stale copy of the tool silently keeps old bugs, and git holds the previous copy where the folder is committed |

## Learnings
- The checker tested the method's word (`done`) but not its format (`exit N`), so `exit 1` passed → when the method prescribes a format, the gate checks the format (probe 2026-09-13; T1)
- A bare `@` line under a "Finished" heading still imports → retire a plan by backticking or deleting its line, never by moving it (Claude Code docs)
- Three backticks in a task cell swallowed the status and 0.3.0 passed the row as a non-claim → never write a backtick run inside a table cell (this plan's own T1 row)
- "Fail if the status column is unreachable" was a symptom fix and still misses a stray backtick that legally pairs with a later one → the CommonMark rule plus a cell-count safety net (T1, re-review)
- Acceptance cases that live only in chat do not exist for the executor → every case the plan is judged by is under Done when (second review)
- The checker's entry guard compared paths textually, so through a symlink or `/tmp` on macOS the gate printed nothing and exited 0, since 0.2.0 → a gate's own entry point is tested as a spawned command, through a symlink too; compare real paths (fresh-context review, 2026-09-13)
- Backticking a plan's reload line while its header still says `status: active` makes the new reload check fail the build → retire by setting `status: done` first, then backtick; the method and the skill now say so (fresh-context review)
- Two field sessions typed a timestamp from memory and had to restamp, although the block said "time from `date`" → the block now says every stamp comes from `date` run at that moment, never typed from memory (field test, 2026-09-13)

## Context (read during planning — do not re-read)
- PLANNER.md — §4 loop 128-165; template 215-290; HTML comments T4 replaces at 233, 243-245, 253, 262-266
- tools/check-plans.mjs — cell splitter 64-78; parser 98-132; rule 141-161; `--verify` runner 183
- tools/check-plans.test.mjs — 27 cases; fixture helpers 9-11
- bin/planrails.mjs — init 42-72; check 74-86
- CONTRIBUTING.md — no config, no dependency, no second script; a test per checker change; PLANNER.md plain and self-contained
- https://code.claude.com/docs/en/memory — root CLAUDE.md re-read after compaction; imports heading-blind, depth 4; backticks and fences not imported. Lead: sub-agents inherit CLAUDE.md and its imports (karma_sakha docs/PLANNING_GUIDE.md:495)
- https://spec.commonmark.org/0.31.2/#code-spans — a backtick string opens a code span only if an equal one closes it
- examples/weekly-digest/.project-management/plans/weekly-digest/PLAN.md — the worked example; must keep passing
- edodo-video repo on this machine, `.project-management/plans/video-document-model/` — a real 0.3.0 plan, 1,914 words; survived a compaction; restated the method in its Rules; hand-wrote timestamps until it switched to `date`
- karma_sakha repo on this machine — 0.1.x plans under `.project-management/plans/` (five-books/PLAN.md: 19,451 words, NOW two hours behind its log); `docs/PLANNING_GUIDE.md:493-572` sub-agent rules and incidents; `.claude/hooks/precompact-journal.mjs:5-16` and `guard-read.mjs:60-132`, what compaction loses and what bulk reads cost
- the owner's pre-planrails planning prompt, in chat 2026-09-13; adopted: check the plan first, standards as an executor rule, phase-end end-to-end tasks, docs last; declined: absolute paths, research by the executor, a progress log in the plan
