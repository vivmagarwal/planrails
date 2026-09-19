# Checker notes — log

Append-only. One entry per landed piece of work, newest at the bottom.

## 2026-09-19 10:57 — plan opened
- did: researched Claude Code hooks for advisory reminders and rejected them (Decisions); the owner's app_starterkit session showed the real shape — the check command advises, and blocks only what is checkable. Tested two candidate notes on four real plans: the LOG reminder never fired; the word line was broken by all four, and the line itself was stale.
- next: T1

## 2026-09-19 10:57 — T1: notes in the checker
- did: `checkPlans` returns `notes`; `planNotes` holds the one note (an active PLAN.md over `WORD_LINE` = 3,000 words); `formatNotes` prints them to stdout before the final line, on passing and failing runs. Seven tests: over, under, not active, no status line, exit 0 with the ok line last, exit 1 with the note, byte-exact quiet output.
- files: tools/check-plans.mjs, tools/check-plans.test.mjs
- proof: `node --test tools/check-plans.test.mjs` → exit 0, 69 pass
- next: T2
- learned: the first run was piped through `tail`, so its `$?` was tail's; re-ran unpiped for the evidence. The plan's opening stamps were typed, not read from `date`; corrected.

## 2026-09-19 10:57 — T2: the CLI prints the notes
- did: `planrails check` writes `formatNotes(notes)` before its own lines, the same function the checker uses; one spawned-command test.
- files: bin/planrails.mjs, bin/planrails.test.mjs
- proof: `node --test bin/planrails.test.mjs` → exit 0, 15 pass
- next: T3

## 2026-09-19 10:58 — T3: docs and 0.6.0
- did: PLANNER.md's word line is ~3,000 and names the note; a "Why it is shaped this way" entry for notes; CONTRIBUTING.md sets the bar for a new note; README's checker section shows one; the checker's header comment; 0.6.0 in package.json, PLANNER.md, check-plans.mjs; CHANGELOG.md.
- files: PLANNER.md, CONTRIBUTING.md, README.md, CHANGELOG.md, package.json, tools/check-plans.mjs
- proof: `npm run check` → exit 0, 84 pass
- next: T4

## 2026-09-19 10:58 — T4: field check
- did: ran the source checker on two real projects. edodo-video/local-video-studio: the note (3,588 words, equal to `wc -w`), then the ok line, exit 0. karma_sakha/mula-accuracy: the note (9,304 words), exit 0. This repo: the ok line only.
- proof: `node tools/check-plans.mjs --root ../../edodo-video` → exit 0
- next: fresh-context review, then T5 (owner)

## 2026-09-19 11:00 — fresh-context review, three fixes
- did: a sub-agent with only the plan compared the new checker with 0.5.2's on twelve scratch cases (no plans, missing root, 200 / 3,000 / 3,001 words, done, paused, no status line, CRLF, `--verify`, problems plus a note, a million words): exit codes and final lines unchanged, quiet output byte-identical, `planrails check` identical to the checker. Five mutations each broke a test. It found three gaps, all fixed: no test at the exact line (added 3,000 quiet / 3,001 noted); the CLI test matched a pattern, not the checker's own stdout (now compares them); `toLocaleString` would drop the comma on a Node built without Intl (replaced by a one-line formatter).
- files: tools/check-plans.mjs, tools/check-plans.test.mjs, bin/planrails.test.mjs
- proof: `npm run check` → exit 0, 85 pass; `node tools/check-plans.mjs --verify` → exit 0, every done proof re-run
- next: T5, the owner: commit, tag v0.6.0, publish; then retire the plan

## 2026-09-19 11:32 — T5: 0.6.0 published, plan closed
- did: on the owner's word ("commit and publish"), committed by path (2260300), tagged v0.6.0, pushed main and the tag by name; the publish workflow succeeded. Smoke test in a scratch project: `npx planrails@0.6.0 init` exit 0, the copied checker is stamped 0.6.0, a 3,131-word active plan gets the note with exit 0, and `npx planrails check` prints the same bytes. The first two smoke runs failed with ETARGET: the registry took about a minute, then npm's local metadata cache was stale; `npm_config_prefer_online=true` fixed it. Plan retired: `status: done`, `session: none`, reload line in backticks.
- learned: graduated two learnings to CLAUDE.md (a piped proof reports the pipe's exit code; the post-publish smoke test needs fresh registry metadata).
- next: the owner's other projects pick the note up with `npx planrails@latest init` (edodo-video 3,588 words, karma_sakha 9,304).
