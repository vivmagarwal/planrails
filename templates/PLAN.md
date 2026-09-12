# <Feature> — plan

status: active · opened <YYYY-MM-DD> · id: <kebab-id>

<!--
  This file is read by an executor who never saw the planning chat.
  Everything it needs is here. Keep it under ~1,500 words; history lives in LOG.md.
  A task is done only when its proof was run and pasted into the evidence cell.
-->

## NOW
RESUME: <the one thing to do next, with the file — e.g. "T2: render the digest through lib/email (lib/digest/render.ts)">
NEXT: <T3 · T4 · …>
updated: <YYYY-MM-DD HH:MM>

## Goal
<4–5 sentences: what we are building and why. What is true when it ships.>
<!-- If the architecture is non-trivial (several services, a data flow, a state
     machine), add a mermaid diagram here. Skip it for a simple change. -->

## Done when
- <a command or a check that must pass — e.g. `npm run check` exits 0>
- <a real-world check — e.g. a digest email arrives for a test user with 5 posts>

## Must not change
- <the rails, data, or public shape this work must not break>

## Tasks
<!-- status: todo | doing | done | blocked. proof: a `command` in backticks, or `owner`
     for a task only the owner's word can close. evidence: pasted after the proof runs —
     required for done. Keep the four column names exactly; the checker reads them. -->

| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
| T1 | <what to do> (<path>) | todo | `<command that proves it>` | |
| T2 | <what to do> (<path>) | todo | `<command>` | |
| T3 | update the docs this work changed | todo | `<docs check, or `owner`>` | |

## Rules for this plan
<!-- Short. These stay in the executor's context the whole time. Max ~15 lines. -->
- <a rule that governs this area — e.g. "every email goes through lib/email, never a bare send">

## Decisions
| date | decision | why |
|------|----------|-----|
| <YYYY-MM-DD> | <what was chosen> | <the reason and what it rules out> |

## Context (read during planning — do not re-read)
<!-- What the planner already read, so the executor does not repeat it. -->
- <path> — <one line of what it holds>
- <path> — <one line>
