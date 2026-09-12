# Changelog

## 0.1.0 — 2026-09-12

First release, extracted from the project it was built in after a day of use.

- `planrails init` sets a new or an existing project up, idempotently; `update`, `uninstall`, `doctor`.
- Plans as files: PLAN.md, state.json, gates.json, rules.json, append-only log / learnings / decisions / gate-runs.
- A task is done only through `task done`: it runs the gate, records the run, and needs every condition of done answered (C1–C7 by default, more per plan or per task).
- Gates declare what they do not check and a known-fail case; `gate verify` proves each can fail; a gate edited after verification cannot close a task.
- Hooks for Claude Code: brief at SessionStart (also after compaction), rules at the tool call, a Stop reminder to log, a subagent brief, a pre-compaction journal. Portable settings via `$CLAUDE_PROJECT_DIR`.
- `run`: one fresh `claude -p` session per task.
- `issue`: a prefilled GitHub issue with the environment.
