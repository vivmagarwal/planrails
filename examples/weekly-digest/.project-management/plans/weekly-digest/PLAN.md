# Weekly digest email — plan

status: active · opened 2026-09-12 · id: weekly-digest

## NOW
RESUME: T2 — render the digest through the email seam (lib/digest/render.ts)
NEXT: T3 schedule the Monday send · T4 docs
updated: 2026-09-12 14:20
session: app-3f · 7c1d2e9a · since 2026-09-12 14:05

## How to work this plan
Read NOW, then Rules and Learnings; do not re-read Context. One task at a time:
1. Check who holds the plan (below); set it `doing`; point NOW at it; put your session on its `session:` line.
2. Do the work: fix causes, not symptoms; the simplest change that works end to end.
3. Run the proof now. Paste `YYYY-MM-DD HH:MM · exit N · "last line"` into evidence. Every stamp comes from the shell clock (`date`; on Windows `Get-Date`), never typed from memory.
4. `done` only if N is 0. A proof of `owner` is closed only by the person's words with the date, never by you: until then the row is `blocked`, the reason in its evidence cell, and RESUME says so. Point NOW at the next task; append an entry to LOG.md: did, files, proof, next, learned.
5. If it fought back, add a Learning: the trap, then the rule. A verified fact goes in Context, a choice in Decisions.

NOW is exactly these four lines, RESUME, NEXT, updated and session, written for a stranger; on a long task note the sub-step in RESUME, and update NOW before any turn ends. Blocked: say so in RESUME, reason in the evidence cell. A task you will not do is `dropped`; its row stays. After a compaction, `git status --short` shows the in-flight work. Edit this file with the editor tool; an unquoted shell string eats backticks. A self-contained task may go to a sub-agent briefed with its row, Rules, Decisions, Learnings and Context; it writes to a named file and reports a few lines, which are leads; you run the proof before pasting evidence. If the project runs Node, `node .project-management/planrails/check-plans.mjs` must pass. When no row is left open, done or dropped, close by PLANNER.md §5: proofs re-run, a fresh-context review, `status: done`, `session: none`, the reload line in CLAUDE.md wrapped in backticks. Full method: `.project-management/planrails/PLANNER.md` §4.

Who holds the plan. `session:` names the one session working it: `name · first 8 characters of its session id · since YYYY-MM-DD HH:MM`. Match by id, never by name: the line's 8 characters start a `sessionId` in the listing. Before any task goes `doing`, even when asked to continue: re-read NOW from disk, run `claude agents --json` (your own id is `$CLAUDE_CODE_SESSION_ID`) and `git status --short`, then:
- the id is yours: go on.
- the id is live and not yours: stop, report what you found, ask; write nothing.
- the id is not listed: stale if no other session in this checkout is live; say so, take over, write your line. Else stop and ask.
- `none`, or no line: write your line and go on, unless this plan's PLAN.md, LOG.md or the files its tasks name are dirty, or a busy session in this checkout has its id on no plan's `session:` line; then stop and ask.
Work only the plan assigned in this session; other reloaded plans are context. Without a `claude` command, git is the record: pull first, and ask about a fresh `doing` row.

## Goal
Every user gets one email each Monday with the five most-read posts of the past
seven days. It sends through the existing email seam, so it lands in the same
communications log as every other message. A user with no reads that week gets no
email. This is the first scheduled email in the app, so it also proves the
Monday-morning job path.

## Done when
- `npm run check` exits 0
- `npx vitest run tests/digest` passes
- a test user with five posts receives one digest with those five, newest first

## Must not change
- email goes through `lib/email` only, never a bare provider call
- the digest is a read; it must not write to the posts tables

## Tasks
| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
| T1 | the digest query: top 5 posts by reads over 7 days (lib/digest/query.ts) | done  | `npx vitest run tests/digest/query.test.ts` | 2026-09-12 14:05 · exit 0 · "6 passed" |
| T2 | render the digest through the email seam (lib/digest/render.ts) | doing | `npx vitest run tests/digest/render.test.ts` | |
| T3 | schedule the Monday 08:00 send (lib/jobs/digest.ts) | todo  | `npx vitest run tests/digest/schedule.test.ts` | |
| T4 | update EMAIL_GUIDE.md and ARCHITECTURE.md for the digest | todo | owner | |

## Rules for this plan
- every send is `sendEmail()` from `lib/email`; the digest never touches a provider directly
- the query is read-only; assert no write in its test
- an empty digest sends nothing, it does not send a blank email

## Decisions
| date | decision | why |
|------|----------|-----|
| 2026-09-12 | five posts, not ten | ten made the email long in the mock; five fits one screen and covers the week's real traffic |

## Learnings
- ordering by `reads` alone shuffled the five posts between runs when two had the same count → order by `reads DESC, created_at DESC`, and the test asserts the exact order (flaky T1 test until the tiebreak was added)

## Context (read during planning — do not re-read)
- lib/email/index.ts — the send seam; `sendEmail({to, subject, body})`, logs to the comms ledger
- lib/jobs/README.md — how a scheduled job is registered and how it claims its run
- docs/EMAIL_GUIDE.md — templates and the plain-text rule for emails
