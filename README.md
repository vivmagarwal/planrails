# planrails

**Plans that survive compaction, for Claude Code.** A plan lives in files, not in the chat. A task is done only when a gate ran and every condition of done was answered. Hooks put the plan in front of the agent at the moments it matters: session start, after a compaction, at the tool call, before it stops.

```bash
npx planrails init        # in a new directory or an existing project
# restart Claude Code, then type:  /plan <your raw plan>
```

Built and used on a real project for a day before it was extracted, with the reviews, the black-box trial and the measurements that shaped it recorded in the guide it ships with.

## The problem it solves

A Claude Code session forgets. Compaction keeps your messages and drops every tool result, so the agent loses the record of what it already did. A new session starts blind. The usual fixes make things worse: progress notes written from memory at the end of a session go stale, and every rule learned gets pasted into CLAUDE.md until the file is huge and re-read on every call.

Three habits break under that pressure, and planrails is built against each:

| the habit | what planrails does instead |
|---|---|
| Progress is remembered, then written down late. | Progress is written **as it happens**, through a CLI, into small append-only files. A hook renders a short brief from those files at every session start and after every compaction. |
| Every rule goes into the always-loaded file. | A rule is attached to the step it applies to. A hook injects it at that tool call, once. The brief stays under 6,000 characters. |
| "Done" is a word an agent types. | A task is done only through `task done`, which runs the task's gate, records the run, and needs every condition of done answered in words. The validator refuses a done task that no recorded run backs, whoever wrote the file. |

## Requirements

- Node 20.10 or newer.
- Claude Code (hooks measured on 2.1.269).
- `jq` on the PATH only if you turn on the optional never-delete guard.

## Getting started

### A new repository

You have an empty directory and an idea.

```bash
mkdir my-app && cd my-app
git init
npx planrails init
```

What you will see:

```
planrails 0.1.0 → /Users/you/my-app
installing planrails@0.1.0 as a devDependency…

  + wrote a minimal package.json
  + installed planrails@0.1.0 as a devDependency
  + copied docs/PLANNING_GUIDE.md
  + created .project-management/plans/
  + created CLAUDE.md with a Project management section
  + added the generated plans block to CLAUDE.md
  + added npm scripts (plan, plan:doctor, plan:brief, plan:validate)
  + added .planrails/ to .gitignore
  + wrote the hooks into .claude/settings.json

doctor: healthy

Next: restart Claude Code (or run /hooks), then type:  /plan <your raw plan>
```

Then:

1. Start Claude Code in the directory (or run `/hooks` if it was already open) so the hooks load.
2. Type `/plan` followed by what you want to build, in your own words. For example: `/plan A CLI that greets people: greet.mjs prints "Hello, <name>!" from the first argument, or "Hello, world!" with none. A test file proves both. A README explains both.`
3. The planner asks the questions your text did not answer, in one message. Answer them.
4. It writes the plan, proves every gate can fail, activates the plan, and shows you its brief.

Commit everything, including `.claude/settings.json`: the hook commands use `$CLAUDE_PROJECT_DIR`, which Claude Code sets on every machine, so teammates get the hooks after `npm install`.

### An existing repository

You have a project with its own CLAUDE.md, its own hooks, its own check script. `init` adds and never replaces.

```bash
cd my-existing-project
npx planrails init --dry-run     # shows what would change, writes nothing
npx planrails init
```

What changes, and what does not:

| it | what init does |
|---|---|
| `package.json` | adds planrails as a devDependency and four `plan:*` scripts; appends `planrails validate --all --quiet` to an existing `check` script |
| `CLAUDE.md` | appends a "Project management" section if there is none, and a small generated block that lists the active plans. Your text is untouched. |
| `.claude/settings.json` | adds the six planrails hooks next to the hooks you already have. Other settings are untouched. A backup goes to `.planrails/backups/` first. |
| `docs/PLANNING_GUIDE.md` | copied in, unless a file by that name exists |
| `.project-management/plans/` | created, empty |
| `.gitignore` | gains `.planrails/` |

Run it twice and the second run reports nothing added. `npx planrails uninstall` removes the hooks and the skill and leaves your plans alone.

### Planning your first feature, step by step

Say the project is a web app and you want a weekly digest email.

**1. Ask for a plan.** In a Claude Code session in the project:

```
/plan Weekly digest email: every Monday 07:00, send each subscriber the five most-read posts of the week. Reuse the existing email seam. A subscriber can turn it off from their settings page.
```

**2. Answer the questions.** The planner asks only what your text left open, in one message. For example: what proves done, which files may change, who approves the first real send.

**3. Read what it wrote.** A plan is one folder, `.project-management/plans/weekly-digest/`:

| file | what it holds |
|---|---|
| `PLAN.md` | why, the method, the rules, the map of files |
| `state.json` | every task with its status, its gate, its evidence, its answered conditions. Written only by the CLI. |
| `gates.json` | what proves each task done: a command, what it does not check, a case that must fail |
| `rules.json` | rules a hook shows the agent when it touches a matching file or runs a matching command |
| `log.jsonl`, `learnings.jsonl`, `decisions.jsonl`, `gate-runs.jsonl` | append-only history |

The gates are the project's own commands: the test runner on the digest module, the lint, a script that enqueues one digest against a throwaway database. Each one declares a known-fail case, and the planner ran `gate verify --all` before activating, so you know each gate can actually fail.

**4. Execute, one task at a time.** Open a new session, or continue. The brief is already in the agent's context:

```
## Plan weekly-digest — Weekly digest email
active · 0/4 tasks done · 0 doing · 0 blocked
RESUME: start T1: the digest query, lib/digest/query.ts
NOW T1: … — proves done by G1 · effort high
RULES FOR THIS PLAN: …
JUDGMENT OUTRANKS THE GATE: a red gate is never made to pass, a green gate is never trusted blind …
```

The loop for each task:

```bash
npx planrails task start weekly-digest T1
# … the work …
npx planrails log weekly-digest --task T1 --what "query returns the top 5 posts by reads over 7 days (lib/digest/query.ts)" --next "T2: render with the email seam"
npx planrails task check weekly-digest T1     # every condition of done, plus the gate's blind spots
npx planrails task done weekly-digest T1 --answer "C4: docs/EMAIL_GUIDE.md § Digest updated" --answer "C5: the 5 is the LIMIT in query.ts:12" --answer "C6: nothing new" --answer "C7: read query.ts whole; the gate cannot see a wrong week boundary, I checked Monday 00:00 by hand"
```

`task done` runs the gate. If the gate fails, the task stays open and the tool says so. If a condition is unanswered, the tool prints the whole checklist and refuses. That refusal is on purpose: it is the reminder, at the moment it matters, of what "done" means here.

**5. Or let fresh sessions do it.** `npx planrails run weekly-digest --max-tasks 4` starts one `claude -p` session per task. Each starts empty, gets the brief from the hook, does one task, and exits. The driver reads `state.json` to decide what happens next, never the session's words.

**6. Review and close.** `npx planrails review weekly-digest` shows every done task with its gate run and each answered condition. When the plan is done, `npx planrails close weekly-digest --confirmed-by-owner` runs every gate fresh and removes the plan's line from CLAUDE.md. Without the flag it stops and asks you.

## The commands

| command | what it does |
|---|---|
| `init`, `update`, `uninstall`, `doctor` | set up, refresh, remove, check |
| `new <id> --title "…" --paths "src/**"` | scaffold a plan (the `/plan` skill does this for you) |
| `gate add\|verify\|run\|list <id>` | gates; `verify` proves each can fail |
| `task add\|check\|start\|done\|block\|unblock\|drop <id> [T]` | the task lifecycle; `done … --answer "C4: …"` runs the gate |
| `condition list\|add\|drop <id>` | the plan-level conditions of done |
| `log`, `learn`, `decide` | record progress, a learning, a choice |
| `brief [id]`, `status <id>`, `review <id> [T]`, `learnings --search x` | read |
| `validate [--all]` | fail on any plan whose state lies (put it in CI) |
| `agent-brief <id> <T>` | what a subagent gets instead of the whole plan |
| `run <id> [--max-tasks N] [--dry-run]` | one fresh session per task |
| `activate`, `pause`, `close`, `abandon` | plan lifecycle; the last two need `--confirmed-by-owner` |
| `hooks install\|status\|uninstall\|selftest` | the hooks |
| `issue [bug\|wish\|edge]` | open a prefilled GitHub issue |
| `selftest` | prove the validator's refusals can fire |

`npx planrails --help` prints the full list with flags.

## How it survives compaction

Four layers, cheapest first:

| when | what the agent gets | size |
|---|---|---|
| always | one generated block in CLAUDE.md naming the active plans | a few lines |
| session start, and after every compaction | a brief rendered from the plan's files: status, the RESUME line, the last log entries, the rules | ≤ 6,000 chars |
| at a tool call | the rules that match this file or command, once per session | ≤ 1,200 chars each |
| on demand | everything else, queried with the CLI | not loaded |

Before every compaction a hook writes a journal of what the session did (files written, commands run) to `.planrails/journal/`, and after the compaction another hook hands the path back.

## Done needs evidence, and judgment outranks the gate

Every task has conditions of done. Three are checked by the tool: the gate passed in this very command, a log entry names the task, the listed files exist. Four are answered in words: the docs shipped, every number has a locator, what was learned is recorded, and you read the result whole and judged it right yourself. A plan can add its own; a task can add its own.

A gate is a script. It cannot read, cannot see, and answers only the question it was written for. So the agent sees the same three lines at every closing moment:

- gate red, work right: never make the gate pass. Write what it computed and what is true. Fix the gate and re-verify it, or block the task for the owner.
- gate green, work wrong: refuse to close. Say what the gate cannot see.
- anything crashed: never edit a plan file by hand. Log it, block, stop.

The agent gets no "force pass with a reason" of its own. The override is `task block --needs owner`; the owner's word closes the task. Two rails back this: a gate edited after it was verified cannot close a task until it is verified again, and a gate that was never verified cannot close a task at all.

## Subagents and fresh sessions

`agent-brief <id> <T>` renders what a subagent needs and nothing else: what to do, which files, what done means, where to write its report, what never to do. A subagent never closes a task; the main session verifies the report and closes it. A SubagentStart hook puts the same note in front of every subagent.

`run <id>` is the answer to "clear the context after every task". Claude Code cannot compact or clear on command, so planrails starts a new session per task instead. Each session's only memory of the work is the plan's files.

## Updating, disabling, removing

- `npm install planrails@latest && npx planrails update` refreshes the guide, the skill and the hook entries. Plans are never touched.
- To turn one hook off, delete its entry from `.claude/settings.json`. `npx planrails doctor` will say it is missing; that is fine.
- `npx planrails uninstall` removes the hooks and the skill. `npm uninstall planrails` removes the package. The plans, the guide and the CLAUDE.md section stay, so nothing you wrote is lost.

## Reporting a problem, an edge case, or a wish

From any project that uses planrails:

```bash
npx planrails issue bug     # something broke or refused wrongly
npx planrails issue edge    # a gate, rule or condition was wrong in a case we did not think of
npx planrails issue wish    # something you wish it did
```

It opens a GitHub issue with the environment filled in: versions, platform, what `doctor` and `validate` say. No file contents and no plan text leave your machine. Add `--print` to get the URL instead, or `--gh` to file it with the GitHub CLI.

## Development

```bash
git clone https://github.com/vivmagarwal/planrails && cd planrails && npm install
npm test            # the CLI, init, the hooks, the issue command — all against throwaway directories
npm run selftest    # every refusal in the validator can fire; the hooks on payloads captured from a real run
npm run acceptance  # needs the claude CLI: a real session must quote the injected brief
```

See CONTRIBUTING.md. MIT licensed.
