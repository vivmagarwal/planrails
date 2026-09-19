# Checker notes — plan

status: active · opened 2026-09-19 · id: checker-notes

## NOW
RESUME: T5 — blocked on the owner: commit, tag v0.6.0, publish. T1–T4 are done, the fresh-context review is done and its three findings fixed (LOG.md), every proof re-run green. Nothing is committed yet; `git status --short` lists the work
NEXT: after T5, close by PLANNER.md §5: `status: done`, `session: none`, the reload line in backticks
updated: 2026-09-19 11:00
session: planrails-db · afd849cf · since 2026-09-19 10:57

## How to work this plan
Read NOW, then Rules and Learnings; do not re-read Context. One task at a time:
1. Check who holds the plan (below); set it `doing`; point NOW at it; put your session on its `session:` line.
2. Do the work: fix causes, not symptoms; the simplest change that works end to end.
3. Run the proof now. Paste `YYYY-MM-DD HH:MM · exit N · "last line"` into evidence. Every stamp comes from the shell clock (`date`; on Windows `Get-Date`), never typed from memory.
4. `done` only if N is 0. A proof of `owner` is closed only by the person's words with the date, never by you: until then the row is `blocked`, the reason in its evidence cell, and RESUME says so. Point NOW at the next task; append an entry to LOG.md: did, files, proof, next, learned.
5. If it fought back, add a Learning: the trap, then the rule. A verified fact goes in Context, a choice in Decisions.

NOW is exactly these four lines, RESUME, NEXT, updated and session, written for a stranger; on a long task note the sub-step in RESUME, and update NOW before any turn ends. Blocked: say so in RESUME, reason in the evidence cell. A task you will not do is `dropped`; its row stays. After a compaction, `git status --short` shows the in-flight work. Edit this file with the editor tool; an unquoted shell string eats backticks. A self-contained task may go to a sub-agent briefed with its row, Rules, Decisions, Learnings and Context; it writes to a named file and reports a few lines, which are leads; you run the proof before pasting evidence. If the project runs Node, `node tools/check-plans.mjs` must pass (this repo runs the checker from its source). When no row is left open, done or dropped, close by PLANNER.md §5: proofs re-run, a fresh-context review, `status: done`, `session: none`, the reload line in CLAUDE.md wrapped in backticks. Full method: `PLANNER.md` §4.

Who holds the plan. `session:` names the one session working it: `name · first 8 characters of its session id · since YYYY-MM-DD HH:MM`. Match by id, never by name: the line's 8 characters start a `sessionId` in the listing. Before any task goes `doing`, even when asked to continue: re-read NOW from disk, run `claude agents --json` (your own id is `$CLAUDE_CODE_SESSION_ID`) and `git status --short`, then:
- the id is yours: go on.
- the id is live and not yours: stop, report what you found, ask; write nothing.
- the id is not listed: stale if no other session in this checkout is live; say so, take over, write your line. Else stop and ask.
- `none`, or no line: write your line and go on, unless this plan's PLAN.md, LOG.md or the files its tasks name are dirty, or a busy session in this checkout has its id on no plan's `session:` line; then stop and ask.
Work only the plan assigned in this session; other reloaded plans are context. Without a `claude` command, git is the record: pull first, and ask about a fresh `doing` row.

## Goal
The checker gains a second kind of output: a **note**. A problem is a fact a script can verify, and it fails the build. A note is a heuristic the script can only suspect; it prints, the run still exits 0, and the model that ran the check decides. This is the kit's answer to "guide the LLM at the right moment without blocking it": the check command already runs before every commit and its output is already read, so it needs no hook, no config file and no second script. It ships with one note, the only one a recorded failure backs: an active PLAN.md over 3,000 words. The plan reloads into every session, and four of four real plans on the owner's machine had outgrown the stated ~2,000-word line with nothing saying so. That line is itself stale (the block alone is ~480 words; this repo's two careful plans are ~2,800), so it moves to ~3,000.

## Done when
- `npm run check` exits 0
- on a project whose active plan is over 3,000 words, the checker prints a `note:` naming the plan, its word count and what to trim, keeps its final `ok` line last, and exits 0
- on a plan under the line, or a plan that is not active, the output is byte-for-byte what 0.5.2 printed
- `npx planrails check` prints the same notes as the copied checker

## Must not change
- exit codes: 0 ok, 1 problems, 2 bad `--root`; a note never changes one
- the last line of a passing run (it is what agents paste as evidence)
- every existing problem message and every existing test
- no hook, no config file, no second script, no dependency; `init` writes only its two files

## Tasks
| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
| T1 | `checkPlans` returns `notes` beside `problems`; one note — an active PLAN.md over 3,000 words; the checker's CLI prints notes before its final line, on a passing and on a failing run; tests for over, under, not active, exit code, last line (tools/check-plans.mjs, tools/check-plans.test.mjs) | done | `node --test tools/check-plans.test.mjs` | 2026-09-19 10:57 · exit 0 · "pass 69, fail 0"; after the review fixes, re-run by `--verify` 2026-09-19 11:00 · exit 0 |
| T2 | `planrails check` prints the same notes; a spawned-command test (bin/planrails.mjs, bin/planrails.test.mjs) | done | `node --test bin/planrails.test.mjs` | 2026-09-19 10:57 · exit 0 · "pass 15, fail 0"; after the review fixes, re-run by `--verify` 2026-09-19 11:00 · exit 0 |
| T3 | docs and release prep: PLANNER.md's word line becomes ~3,000 and says the checker notes it; CONTRIBUTING.md gains the rule for notes; README's checker section; the checker's header comment; 0.6.0 in package.json, PLANNER.md, check-plans.mjs; CHANGELOG.md | done | `npm run check` | 2026-09-19 10:58 · exit 0 · "pass 84, fail 0"; after the review fixes 2026-09-19 11:00 · exit 0 · "pass 85, fail 0" |
| T4 | field check on a real over-line plan: the note fires on edodo-video's active plan (3,588 words), exit 0, final line unchanged; this repo stays silent | done | `node tools/check-plans.mjs --root ../../edodo-video` | 2026-09-19 10:58 · exit 0 · "check-plans: 1 plan(s) ok — every completion claim has a proof and exit 0 evidence, active plans reload, NOW is current"; the line before it was the note, 3,588 words; this repo printed the ok line only |
| T5 | commit, tag v0.6.0 and publish | blocked | owner | waits on the owner: a commit and a publish were not asked for in this session |

## Rules for this plan
- A note needs a recorded failure behind it, the same bar as every line in the kit. This plan ships one note. A LOG-entry reminder was tested against four real plans and never fired; it is not built.
- A note is for what a script can only suspect. Anything a script can verify stays a problem.
- A note says what to do, not only what is wrong.
- A note never fires on a healthy plan: a note that always prints teaches the reader to skip the checker's output.

## Decisions
| date | decision | why |
|------|----------|-----|
| 2026-09-19 | no Claude Code hooks for reminders | checked against the hooks reference: PreCompact cannot add context (only block, which can fail the request), no event fires at a context threshold, hook input carries no token count; Stop's `additionalContext` forces another turn; no event knows a planrails task closed. A mapping file plus a dispatcher plus `init` editing settings.json is three things CONTRIBUTING forbids, and works in one agent only |
| 2026-09-19 | the check command's output is the advisory channel | it already runs before every commit and is already read; the owner's app_starterkit session reached the same shape (`kit:check` advisory, blocking only what is checkable) |
| 2026-09-19 | the word line moves from ~2,000 to ~3,000 | measured: self-sufficient-plan 2,758, session-claim 2,831, both well kept; the block grew to ~480 words after the line was written. The doc was stale, not the plans |
| 2026-09-19 | notes go to stdout before the final line, on passing and failing runs | the last line is pasted as evidence and must not move; a failing run's reader is already reading |
| 2026-09-19 | only active plans get notes | a retired plan does not reload, so its size costs nothing |
| 2026-09-19 | 0.6.0 | new checker output is a feature, not a fix |

## Learnings
- a proof piped through `tail` reports tail's exit code → run the proof unpiped, or to a file, and read `$?` straight after it (T1's first run)
- a test that only straddles a boundary from far away does not pin it → assert at the line and one past it (the review moved `>` to `>=` and 84 tests still passed)

## Context (read during planning — do not re-read)
- tools/check-plans.mjs:299-341 — `checkPlans` and the CLI's three exits; bin/planrails.mjs:102-113 repeats the printing, so both change
- PLANNER.md:119 — the ~2,000-word line; CONTRIBUTING.md:28-36 — what the checker may enforce
- word counts are `wc -w` of PLAN.md, 2026-09-19: edodo-video/local-video-studio 3,588 (active), karma_sakha/mula-accuracy 9,123 (active)
- https://code.claude.com/docs/en/hooks.md — PreCompact, Stop decision control, the `if` field (read 2026-09-19)
