# Session-aware plans — plan

status: done · opened 2026-09-13 · closed 2026-09-13 · id: session-claim

## NOW
RESUME: nothing; plan closed 2026-09-13. 0.5.1 is published; every command proof re-run green at close; T3, T4, T6, T11 closed on the owner's word; T8 and T9 dropped on it — the edodo-video rollout waits until its running task is done (steps in LOG.md)
NEXT: none
updated: 2026-09-13 19:22
session: none

## How to work this plan
Read NOW, then Rules and Learnings; do not re-read Context. One task at a time:
1. Set it `doing`; point NOW at it.
2. Do the work: fix causes, not symptoms; the simplest change that works end to end.
3. Run the proof now. Paste `YYYY-MM-DD HH:MM · exit N · "last line"` into evidence. Every stamp comes from `date` run at that moment, never typed from memory.
4. `done` only if N is 0. Point NOW at the next task; append an entry to LOG.md: did, files, proof, next, learned.
5. If it fought back, add a Learning: the trap, then the rule. A verified fact goes in Context, a choice in Decisions.

NOW is four lines for a stranger; on a long task note the sub-step, and update it before any turn ends. Blocked: say so in NOW, reason in the evidence cell. A task you will not do is `dropped`; its row stays. After a compaction, `git status --short` shows the in-flight work. Edit this file with the editor or a quoted heredoc; an unquoted shell string eats backticks. A self-contained task may go to a sub-agent briefed with its row, Rules, Decisions, Learnings and Context; it writes to a named file and reports a few lines, which are leads; you run the proof before pasting evidence. `node tools/check-plans.mjs` must pass. Full method: `PLANNER.md` §4.

The `session:` line names the one session working this plan. Before any task goes `doing`, even when asked to continue: re-read NOW from disk, run `claude agents --json` (in Claude Code, `ListAgents` names you) and `git status --short`. If the line names a live session that is not you, or says `none` while another session in this checkout is busy or plan files are dirty: stop, report what you found, and ask before writing to the plan, its files, or a commit. A named session the listing lacks is stale: say so, take over. Other reloaded plans are context; work only the one assigned in this session, and say which.

## Goal
The reload line puts an active plan into every Claude Code session opened in a checkout, not only the one working it. On 2026-09-13 in edodo-video a second session, opened for a planrails upgrade, read the reloaded plan, was told "continue with T5", committed, and was starting T5b while the first session was mid-edit on the same files and the same PLAN.md. This plan makes a plan name the session working it, and makes every session check for a live holder before it touches a plan — even when the person asked, because the person can forget which window holds it. One plan per session replaces one active plan per repo. Ships as 0.5.0: still a prompt plus one script; the checker changes only its stamp.

## Done when
- `npm run check` exits 0: both suites, this repo's plans and the worked example through the checker
- the checker passes a plan with a `session:` claim, with `session: none`, and with no line at all, and still reports a stale RESUME beside the line (T1)
- the template block tells a session to check who holds the plan before `doing`, even when asked; the pin test demands it (T2)
- field test on the shipped files (T3, T11): a headless session told to continue stops, reports, asks and writes nothing while the holder is live — by id, whatever its name; takes over a stale claim with a correct line; given the second of two plans, claims and touches only that one; the same in edodo-video with a real second session (T9)
- `npx planrails@0.5.0 init` in an empty folder writes the two stamped files and `plans/.gitkeep`, nothing else (T7)

## Must not change
- one prompt, one dependency-free script; `init` writes only its two files; no hook, no config, no dependency
- the checker's scope: evidence with exit 0, the reload line, a live NOW — the `session:` line is method, ignored by the gate
- existing plans pass unchanged; the reload line format and the 0.3.0 layout
- nothing outward-facing (a tag, a publish) without the owner's explicit go; nothing in edodo-video until the owner says its session `edodo-video-9a` is stopped or idle

## Tasks
| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
| T1 | the `session:` line is inert to the gate: a claim or `none` in NOW passes, and a stale RESUME beside it is still reported (tools/check-plans.test.mjs) | done | `node --test tools/check-plans.test.mjs` | 2026-09-13 19:22 · exit 0 · "ℹ pass 74 ℹ fail 0" (re-run at close; first pass in LOG.md) |
| T2 | the template carries the claim and the check: NOW's `session:` line, "four lines", the appended paragraph; the pin test demands `session:` and `claude agents`, red on the 0.4.1 template (PLANNER.md § Template) | done | `node --test tools/check-plans.test.mjs` | 2026-09-13 19:22 · exit 0 · "ℹ pass 74 ℹ fail 0" (re-run at close; first pass in LOG.md) |
| T3 | field test in a scratch project: a plan claimed by a live session A; B is `claude -p` told "Continue the active plan." — (i) live claim: stop, report, ask, write nothing; (ii) stale claim: say so, take over, work; (iii) no line and a dirty PLAN.md from A: stop; (iv) two plans, told "continue plan two": names it, touches only it; (v) A waiting for input: reports it. A gap fixes T2's wording; whether a `-p` run is listed goes in Context | done | owner | 2026-09-13 owner: "Ship it — tag v0.5.0", after the field-test results and the prose were reported; cases (i)–(iv) passed, (v) not reproducible headless — details in LOG.md |
| T4 | PLANNER.md prose: §3 the one-plan-per-session rule, the CLAUDE.md line, "name the session"; §4 the check, the listing, the decision rules, loop step 1; §5 `session: none`; "Why" bullet with the incident; "three lines" becomes four | done | owner | 2026-09-13 owner: "Ship it — tag v0.5.0", after the field-test results and the prose were reported |
| T5 | the worked example, README (excerpt, "On a team", "Several sessions in one checkout", History) and CONTRIBUTING carry the line, the paragraph and the rule | done | `npm run check` | 2026-09-13 19:22 · exit 0 · "ℹ pass 74 ℹ fail 0" (re-run at close) |
| T6 | docs last: skill/SKILL.md step 4; CHANGELOG 0.5.0 with the by-hand update of existing plans and T3's result | done | owner | 2026-09-13 owner: "Ship it — tag v0.5.0", after the field-test results and the prose were reported |
| T7 | release 0.5.0: package.json and both stamps together; commit and push main; the tag by name only on the owner's go; then `npx planrails@0.5.0 init` in an empty folder writes two stamped files and nothing else | done | `node --test bin/planrails.test.mjs` | 2026-09-13 18:42 · `node --test bin/planrails.test.mjs` exit 0 · "ℹ pass 13 ℹ fail 0"; 6b9b210 on main, CI 34758824914 success ×9, tag v0.5.0 pushed 18:40, publish 34759071945 success, `npm view planrails version` = 0.5.0, `npx planrails@0.5.0 init` in an empty folder wrote the two 0.5.0-stamped files and .gitkeep, nothing else |
| T8 | rollout into edodo-video, only after the owner says `edodo-video-9a` is stopped or idle: `node bin/planrails.mjs init --dir ../../edodo-video`; the active plan's NOW `session:` line and block by hand; CLAUDE.md gets the "Active plans" line and a hard-won rule; a LOG.md entry; commit by path | dropped | `(cd ../../edodo-video && node .project-management/planrails/check-plans.mjs)` | 2026-09-13 owner: "don't change anything with this project yet! i will just run 1 session for this project until the task that's running in the other session is 100% done" — dropped from this plan; the steps are in LOG.md for when that work is done |
| T9 | the real case: with `edodo-video-9a` live and holding `composition-to-document`, a fresh session in edodo-video told "continue the plan" stops, reports, asks and writes nothing | dropped | owner | dropped with T8; run it when the rollout happens |
| T10 | 0.5.1 after the fresh-context review: the block matches the holder by session id, says what the line holds, when a claim is stale (id not listed and no other live session in the checkout), what to write on `doing` and a takeover, and what to do without a listing; §4 aligned (no `--cwd` before the id match, no last-activity internals); §1 plural; the Why bullet names no private repo; skill lists first and drops "plausibly"; the example CLAUDE.md carries the held-by sentence; the pin fails when the NOW line is lost or the paragraph leaves the block | done | `node --test tools/check-plans.test.mjs` | 2026-09-13 19:22 · exit 0 · "ℹ pass 74 ℹ fail 0" (re-run at close; first pass in LOG.md) |
| T11 | field test on the 0.5.1 files, PLAN.md hashes recorded before and after, case states committed: (vi) holder renamed after the claim, same id → held, stop; (ii) stale id, no peer → takeover writes name · id · since correctly, checked against B's own session id; (iii) isolated: no committed line, dirty PLAN.md, busy peer → stop; (iv) two plans → the assigned one claimed with the right id, the other byte-identical | done | owner | 2026-09-13 owner: "please continue and get it all done" · on the 0.5.1 bytes: (vi) renamed holder, same id → held, stop, nothing written; (iii) isolated → stop, nothing written; (iv) → farewell claimed and done, greeting byte-identical; (ii) → stale id taken over, both tasks done, plan retired; the written line captured by a file watcher in a second (ii) run: `session: probe-b · 4991e782 · since 2026-09-13 19:16` — B's real id — held through the work, `none` at close. Details and corrections in LOG.md |
| T12 | release 0.5.1: CHANGELOG (honest about what 0.5.0's field test covered), package.json and both stamps; commit and push main; the tag only on the owner's go; `npx planrails@0.5.1 init` writes the two stamped files and .gitkeep | done | `npm run check` | 2026-09-13 19:22 · `npm run check` exit 0 · "ℹ pass 74 ℹ fail 0"; tag v0.5.1 pushed on the owner's "get it all done", publish run 34761006157 succeeded, `npm view` = 0.5.1; `npx planrails@0.5.1 init` in an empty folder: the first attempt at 19:22, seconds after the version appeared, failed and wrote nothing (LOG.md has the codes); the re-run at 19:23 passed and wrote the two 0.5.1-stamped files and .gitkeep, nothing else |

## Rules for this plan
- Every checker change ships with a test that fails without it; prose is proven by the owner. No checker change is planned: only its stamp moves with the version.
- PLANNER.md prose stays plain, per CONTRIBUTING.md; the template block stays terse — it is fixed overhead in every plan.
- The template and PLANNER.md name only the documented surface, `claude agents --json`; the registry files under `~/.claude/sessions/` are an internal and stay out of the method.
- Stage commits by path. Another session's in-flight edits are never swept into a commit.
- Fix the cause. A red test starts an investigation; never weaken an assertion to get green.
- The worked example keeps passing; `init` keeps writing only its two files.

## Decisions
| date | decision | why |
|------|----------|-----|
| 2026-09-13 | the claim is a `session:` line in NOW, not a lock file | NOW reloads into every session; a lock file would not, and it goes stale with no one to say so. The claim is a lead; the live listing decides |
| 2026-09-13 | the claim carries the name and the first eight characters of the session id | a derived name such as `edodo-video-9a` can change on a resume; the id does not |
| 2026-09-13 | the checker does not change | liveness is a runtime fact a commit-time gate cannot see; demanding the line would fail every existing plan, which `init` never touches |
| 2026-09-13 | the check runs even when the person asked to continue | the incident: the owner asked the second session to continue; a person can forget which window holds the plan |
| 2026-09-13 | one plan per session, one session per plan, replaces one active plan per repo | the owner runs several sessions per checkout on different features; every session reloads every active plan, so keep them few |
| 2026-09-13 | `claude agents --json` is the listing the template names; `ListAgents` the in-session convenience; the registry files a lead | the command is documented and works from any shell, sub-agent or `-p` run; `ListAgents` shows no cwd; the files are an internal |
| 2026-09-13 | no hook, no global CLAUDE.md rule | the owner: planrails plus the project's CLAUDE.md is enough; CONTRIBUTING forbids hooks, and a hook cannot know a session's assignment |
| 2026-09-13 | 0.5.0 | the template's block and NOW shape change and every existing plan needs a hand edit; a minor version is that signal |
| 2026-09-13 | executed from a session whose cwd is edodo-video (`edodo-video-6c`) | the owner asked there; the claim's id identifies it, since its registry `cwd` is not this repo |

## Learnings
- The block matched a holder by name, and a name changes (plan mode retitles the session on accept; `claude -n` and a resume rename it): this plan's own claim `edodo-video-6c` stopped matching its live holder within the hour → the block matches by session id, and names are for people (fresh-context review, 2026-09-13)
- A field test of the block is not a test of §4: the scratch planner was the 0.4.1 file with the new template pasted in → copy the files the release will ship, and re-run after every wording change (review)
- "id" in the claim was read two ways by two sessions: one wrote the first eight characters of the session id, one the bracketed ref `ListAgents` prints → the template and §4 say which: the session id (`sessionId` in `claude agents --json`, `$CLAUDE_CODE_SESSION_ID` inside the session), never the ref (field test case iv)
- The gate counts every `exit N` in an evidence cell, so narrating a side-check's failure as "exited 1" fails the task → in the cell say it failed in words and keep the codes in LOG.md; the cell's numbers are the proof's (this close)
- A script that runs a proof and also writes its evidence will write the evidence it expected: T12's cell said the npx check passed while the command had exited 1 → evidence is pasted from the output after reading it, never composed before the command returns (caught at close, corrected)
- A probe's reply is a lead, the file it wrote is the fact; a closed plan leaves `session: none` → to verify what a session writes while it works, snapshot the file during the run (T11: a watcher caught the line, the end state could not)
- A reloaded plan reads as a work order to a session opened for something else → the block says a plan in context is not a work order, and the check for a live holder runs before any `doing`, even when asked (edodo-video, 2026-09-13: a second session committed and was starting T5b while the first was mid-edit)

## Context (read during planning — do not re-read)
- PLANNER.md — §3 the reload-line bullet and the two session bullets; §4 "Find out who holds the plan"; §5 step 4; "Why"; the template's NOW and block
- tools/check-plans.mjs — `resumeIds` reads only `RESUME:`, `isActive` only `status:`: a `session:` line is inert to the gate
- tools/check-plans.test.mjs — the NOW tests, the session-line describe, the template pin; bin/planrails.test.mjs pins both stamps to package.json
- examples/weekly-digest/… — the worked example; the README excerpt mirrors its top
- Claude Code 2.1.270, 2026-09-13: `claude agents --json` lists live sessions with pid, cwd, kind, startedAt, sessionId, name, status; a `-p` run is listed within 3 s as kind interactive and has `ListAgents`; `ListAgents` prints a bracketed ref that is not the session id; accepting a plan in plan mode retitles the session
- sessions: this one is id b4c97545 (named `edodo-video-6c`, then retitled), registry cwd edodo-video; edodo-video's `composition-to-document` is held by `edodo-video-9a`, id e999d3be; the incident's commit there is 4f4f6ea, by this session
- field-test artefacts: ~/Work/temporary_tests/two-sessions (branches base2, case-*-start, case-*-end) and this session's scratchpad (b*.json, t11-hashes.txt, review-0.5.0.md)
