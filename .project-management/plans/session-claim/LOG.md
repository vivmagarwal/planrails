# Session-aware plans — log

Append-only. One entry per landed piece of work, newest at the bottom.

## 2026-09-13 18:16 — plan opened
- did: read the whole repo and the Claude Code docs, verified `claude agents --json` on this machine, designed the claim and the check with a planning sub-agent, and got the owner's four answers (one plan per session; planrails plus the project CLAUDE.md; edodo-video only after its session is stopped; 0.5.0 with the tag on the owner's go). Wrote this plan; its NOW carries the first `session:` line ever written, and its block the first copy of the new paragraph.
- files: .project-management/plans/session-claim/PLAN.md, .project-management/plans/session-claim/LOG.md, CLAUDE.md (the reload line and the "Active plans" sentence)
- proof: `npm run check` before any change → exit 0 (0.4.1 baseline)
- next: T1 — pin that the `session:` line is inert to the gate

## 2026-09-13 18:16 — T1: the session line is inert to the gate
- did: a test pins that a `session:` claim in NOW, `session: none`, or no line at all changes nothing for the checker, and that a stale RESUME beside the line is still reported. No checker change was needed: `resumeIds` reads only `RESUME:` and `isActive` only `status:`.
- files: tools/check-plans.test.mjs
- proof: `node --test tools/check-plans.test.mjs` → exit 0, "ℹ pass 60 ℹ fail 0"
- next: T2 — the template carries the claim and the check

## 2026-09-13 18:17 — T2: the template carries the claim and the check
- did: NOW's template gains `session: <none, or the session working this plan: name · id · since …>`; "NOW is three lines" is four; the block ends with the paragraph that tells a session to re-read NOW from disk, run `claude agents --json` and `git status --short` before any `doing` — even when asked to continue — and to stop, report and ask when another live session holds the plan. The pin test now demands `session:`, `claude agents` and `git status --short`; it was red on the 0.4.1 template (exit 1, "carries the block a fresh session works from" failed on `session:`) before the edit.
- files: PLANNER.md (§ Template), tools/check-plans.test.mjs
- proof: `node --test tools/check-plans.test.mjs` → exit 0, "ℹ pass 60 ℹ fail 0"
- next: T3 — the field test; its findings may reword this paragraph

## 2026-09-13 18:31 — T3: field test, four of five cases, one wording gap
- did: a scratch project with the 0.5.0 template; session A = a headless `claude -p` kept alive on a stream-json stdin with a fixed session id, named on the plan's `session:` line; session B = a fresh `claude -p` told only "Continue the active plan." Judged by reading B's replies and the files it touched, with PLAN.md hashes and `git status --short` as the cross-check. (i) live idle A: B stopped, reported A's name, status, start, NOW and a clean tree, asked, wrote nothing (4 turns, 17 s). (iii) no `session:` line, T1 flipped to `doing` uncommitted, A busy — today's shape: B stopped, described the uncommitted diff and the busy peer, wrote nothing. (iv) two plans, A idle holding the first, B told "Continue the farewell plan.": B named farewell, wrote its claim there, did its task by the loop with exit 0 evidence, left the held plan byte-identical. (ii) A killed, claim stale: B said neither `ListAgents` nor `claude agents` listed probe-a, took over, recorded it in NOW and the log, did both tasks, retired the plan (status done, line backticked, `session: none`). (v) not reproducible: no session on the machine was `waiting`, and a headless session cannot open a question. Four B runs cost $3.78.
- files: none in this repo; ~/Work/temporary_tests/two-sessions/ holds the project; outputs in this session's scratchpad (b1, b3, b4, b2 .json)
- proof: owner — the evidence cell carries each case's outcome
- next: T4 — the prose; the id wording fixed in the template first
- learned / decided: a `-p` session is listed by `claude agents --json` within 3 s, as kind interactive, and has `ListAgents`; one B wrote the six-character ref `ListAgents` prints as the id, another the eight-character session id → the template's NOW line and §4 define the id (Learnings). The registry files stay out of the method: the documented command is enough (Rules amended).

## 2026-09-13 18:33 — T4 written, T5: the example, README and CONTRIBUTING carry the change
- did: T4 — PLANNER.md §3 replaces "one active plan per repo" with one plan per session, names the CLAUDE.md line and adds "Name the session" (the id is the session id, not the ref `ListAgents` prints); §4 gains "Find out who holds the plan before you touch it" with `claude agents --json`, the decision rules and how to stop and ask; loop step 1 checks first; §5 clears the line; "Why" records the incident; the template's NOW placeholder says what the id is. T5 — the worked example's NOW and block, the README (rule 1, the excerpt, "Two machines, one plan", "Several sessions in one checkout", History) and CONTRIBUTING.
- files: PLANNER.md, examples/weekly-digest/.project-management/plans/weekly-digest/PLAN.md, README.md, CONTRIBUTING.md
- proof: `npm run check` → exit 0, "ℹ pass 73 ℹ fail 0"
- next: T6 — the skill and the changelog

## 2026-09-13 18:33 — T6 written; T7: version and stamps
- did: T6 — skill/SKILL.md names the session in step 3, checks who holds the plan in step 4 and clears the line in step 5 (the copy at ~/.claude/skills/planrails/ updated); CHANGELOG 0.5.0 names every change, the by-hand update of existing plans, and the field test. T7 — package.json and both stamps moved to 0.5.0 together.
- files: skill/SKILL.md, CHANGELOG.md, package.json, PLANNER.md (stamp), tools/check-plans.mjs (stamp)
- proof: `node --test bin/planrails.test.mjs` → exit 0, "ℹ pass 13 ℹ fail 0"
- next: commit and push main; the tag on the owner's go; then `npx planrails@0.5.0 init` in an empty folder
