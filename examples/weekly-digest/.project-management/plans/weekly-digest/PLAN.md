# Weekly digest email — plan

status: active · opened 2026-09-12 · id: weekly-digest

## NOW
RESUME: T2 — render the digest through the email seam (lib/digest/render.ts)
NEXT: T3 schedule the Monday send · T4 docs
updated: 2026-09-12 14:20

## How to work this plan
Read NOW, then Rules and Learnings; do not re-read Context. One task at a time:
1. Set it `doing`; point NOW at it.
2. Do the work: fix causes, not symptoms; the simplest change that works end to end.
3. Run the proof now. Paste `YYYY-MM-DD HH:MM · exit N · "last line"` into evidence. Every stamp comes from `date` run at that moment, never typed from memory.
4. `done` only if N is 0. Point NOW at the next task; append an entry to LOG.md: did, files, proof, next, learned.
5. If it fought back, add a Learning: the trap, then the rule. A verified fact goes in Context, a choice in Decisions.

NOW is three lines for a stranger; on a long task note the sub-step, and update it before any turn ends. Blocked: say so in NOW, reason in the evidence cell. A task you will not do is `dropped`; its row stays. After a compaction, `git status --short` shows the in-flight work. Edit this file with the editor or a quoted heredoc; an unquoted shell string eats backticks. A self-contained task may go to a sub-agent briefed with its row, Rules, Decisions, Learnings and Context; it writes to a named file and reports a few lines, which are leads; you run the proof before pasting evidence. `node .project-management/planrails/check-plans.mjs` must pass. Full method: `.project-management/planrails/PLANNER.md` §4.

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
