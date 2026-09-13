# Weekly digest email — log

Append-only. One entry per landed piece of work, newest at the bottom.

## 2026-09-12 14:05 — T1: the digest query
- did: wrote the query for the five most-read posts over the last seven days, ordered by reads and then by date, read-only.
- files: lib/digest/query.ts, tests/digest/query.test.ts
- proof: `npx vitest run tests/digest/query.test.ts` → exit 0, "6 passed"
- next: T2 — render the result through lib/email so it logs to the comms ledger.
- learned: the reads table has no index on (post_id, created_at); the query is fine at current volume but note it for later if digests slow down.
