# Weekly digest email — plan

status: active · opened 2026-09-12 · id: weekly-digest

## NOW
RESUME: T2 — render the digest through the email seam (lib/digest/render.ts)
NEXT: T3 schedule the Monday send · T4 docs
updated: 2026-09-12 14:20

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

## Context (read during planning — do not re-read)
- lib/email/index.ts — the send seam; `sendEmail({to, subject, body})`, logs to the comms ledger
- lib/jobs/README.md — how a scheduled job is registered and how it claims its run
- docs/EMAIL_GUIDE.md — templates and the plain-text rule for emails
