# Session-aware plans — plan

status: active · opened 2026-09-13 · id: session-claim

## NOW
RESUME: T7 — commit 0.5.0 and push main; the tag waits for the owner's go; T3, T4, T6 close on the owner's word
NEXT: T8 (edodo-video, only after the owner says 9a is stopped) · T9
updated: 2026-09-13 18:33
session: edodo-video-6c · b4c97545 · since 2026-09-13 18:16

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
- field test: a headless session told "Continue the active plan." while another live session holds it stops, reports and asks, and PLAN.md and `git status --short` are unchanged; a stale claim is taken over; a plan with no line and a dirty PLAN.md stops it; told "continue plan two" of two, it names and touches only that one (T3)
- the same in edodo-video with a real second session (T9)
- `npx planrails@0.5.0 init` in an empty folder writes the two stamped files and nothing else (T7)

## Must not change
- one prompt, one dependency-free script; `init` writes only its two files; no hook, no config, no dependency
- the checker's scope: evidence with exit 0, the reload line, a live NOW — the `session:` line is method, ignored by the gate
- existing plans pass unchanged; the reload line format and the 0.3.0 layout
- nothing outward-facing (a tag, a publish) without the owner's explicit go; nothing in edodo-video until the owner says its session `edodo-video-9a` is stopped or idle

## Tasks
| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
| T1 | the `session:` line is inert to the gate: a claim or `none` in NOW passes, and a stale RESUME beside it is still reported (tools/check-plans.test.mjs) | done | `node --test tools/check-plans.test.mjs` | 2026-09-13 18:16 · exit 0 · "ℹ pass 60 ℹ fail 0" |
| T2 | the template carries the claim and the check: NOW's `session:` line, "four lines", the appended paragraph; the pin test demands `session:` and `claude agents`, red on the 0.4.1 template (PLANNER.md § Template) | done | `node --test tools/check-plans.test.mjs` | 2026-09-13 18:17 · exit 0 · "ℹ pass 60 ℹ fail 0" |
| T3 | field test in a scratch project: a plan claimed by a live session A; B is `claude -p` told "Continue the active plan." — (i) live claim: stop, report, ask, write nothing; (ii) stale claim: say so, take over, work; (iii) no line and a dirty PLAN.md from A: stop; (iv) two plans, told "continue plan two": names it, touches only it; (v) A waiting for input: reports it. A gap fixes T2's wording; whether a `-p` run is listed goes in Context | review | owner | 2026-09-13 18:31 · ran 18:19–18:29 in ~/Work/temporary_tests/two-sessions — (i) live idle A: stop, ask, nothing written; (ii) stale claim: took over, both tasks by the loop, plan retired; (iii) no line, dirty PLAN.md, busy A: stop, nothing written; (iv) two plans: claim and work on farewell only, greeting byte-identical; (v) not reproducible headless (no session waiting; a -p session cannot ask). Gap fixed: the id is the session id, not the ListAgents ref. Details in LOG.md. Awaiting the owner's word |
| T4 | PLANNER.md prose: §3 the one-plan-per-session rule, the CLAUDE.md line, "name the session"; §4 the check, the listing, the decision rules, loop step 1; §5 `session: none`; "Why" bullet with the incident; "three lines" becomes four | review | owner | 2026-09-13 18:33 · prose written; npm run check exit 0 · "ℹ pass 73 ℹ fail 0"; awaiting the owner's word |
| T5 | the worked example, README (excerpt, "On a team", "Several sessions in one checkout", History) and CONTRIBUTING carry the line, the paragraph and the rule | done | `npm run check` | 2026-09-13 18:33 · exit 0 · "ℹ pass 73 ℹ fail 0" |
| T6 | docs last: skill/SKILL.md step 4; CHANGELOG 0.5.0 with the by-hand update of existing plans and T3's result | review | owner | 2026-09-13 18:33 · skill and CHANGELOG written; awaiting the owner's word |
| T7 | release 0.5.0: package.json and both stamps together; commit and push main; the tag by name only on the owner's go; then `npx planrails@0.5.0 init` in an empty folder writes two stamped files and nothing else | doing | `node --test bin/planrails.test.mjs` | 2026-09-13 18:33 · bump and stamps: `node --test bin/planrails.test.mjs` exit 0 · "ℹ pass 13 ℹ fail 0"; commit, push and the tag still to come |
| T8 | rollout into edodo-video, only after the owner says `edodo-video-9a` is stopped or idle: `node bin/planrails.mjs init --dir ../../edodo-video`; the active plan's NOW `session:` line and block by hand; CLAUDE.md gets the "Active plans" line and a hard-won rule; a LOG.md entry; commit by path | todo | `(cd ../../edodo-video && node .project-management/planrails/check-plans.mjs)` | |
| T9 | the real case: with `edodo-video-9a` live and holding `composition-to-document`, a fresh session in edodo-video told "continue the plan" stops, reports, asks and writes nothing | todo | owner | |

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
- "id" in the claim was read two ways by two sessions: one wrote the first eight characters of the session id, one the bracketed ref `ListAgents` prints → the template and §4 say which: the session id (`sessionId` in `claude agents --json`, `$CLAUDE_CODE_SESSION_ID` inside the session), never the ref (field test case iv)
- A reloaded plan reads as a work order to a session opened for something else → the block says a plan in context is not a work order, and the check for a live holder runs before any `doing`, even when asked (edodo-video, 2026-09-13: a second session committed and was starting T5b while the first was mid-edit)

## Context (read during planning — do not re-read)
- PLANNER.md — §3 reload-line bullet 120-131 ("One active plan per repo" at 128); §4 opens 150-155, loop step 1 at 159; §5 step 4 at 228-232; "Why" 244-273 ("NOW is three lines" at 264); template NOW 294-297, block 299-307
- tools/check-plans.mjs — `resumeIds` reads only `RESUME:` (253) and `isActive` only `status:` (248): a `session:` line is inert to the gate
- tools/check-plans.test.mjs — NOW tests 188-215 (the `plan()` helper at 189); template pin test 243-260, must-include list at 258
- examples/weekly-digest/.project-management/plans/weekly-digest/PLAN.md — the worked example; the README excerpt mirrors its top
- bin/planrails.test.mjs — both stamps pinned to package.json
- Claude Code 2.1.270, verified 2026-09-13: `claude agents --json [--cwd DIR]` lists live sessions with pid, cwd, kind, startedAt, sessionId, name, status (busy, idle, waiting + waitingFor); interactive sessions in other terminals included. `ListAgents` prints "This session is <name>" and the peers without cwd. `~/.claude/sessions/<pid>.json` holds the same data plus `nameSource` (derived or auto). An entry changes on status, not on edits. Whether a `claude -p` run is listed: a lead, T3 settles it
- the sessions: this one is `edodo-video-6c`, id b4c97545, registry cwd /Users/vivmagarwal/Work/edodo-video; edodo-video's `composition-to-document` is held by `edodo-video-9a`, id e999d3be, busy since 10:17
- the incident's commit: edodo-video 4f4f6ea by this session — the 0.4.1 upgrade plus the active plan's block, while 9a was mid-edit on that PLAN.md
