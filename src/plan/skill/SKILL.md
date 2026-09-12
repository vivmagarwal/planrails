---
name: plan
description: Create a self-sufficient plan for work that spans sessions — gates that prove "done", schema-checked tracking JSON, rules injected by hooks at the step they apply to, and one pointer in CLAUDE.md. Use when the user gives a raw plan or asks to plan a feature, a programme, a migration or a research task.
argument-hint: <raw plan text, or a path to a file holding it>
---
You are creating a plan with this project's planning system. You are NOT doing the engineering. The session that executes the plan will not see this conversation, so everything it needs must be in the plan's files.

1. Read `docs/PLANNING_GUIDE.md` in full. § Creating a plan is the procedure; follow its steps in order and do not skip the research step.
2. The raw plan is below. If it is a path, read that file first.
3. Ask the user only the questions in the guide's list that the raw plan does not answer, in ONE message. Then proceed.
4. Produce the plan directory, run `npx planrails validate <id>` until it is clean, verify every gate can fail (`gate verify <id> --all`), activate it, and end your reply with the brief and one line saying what changed in CLAUDE.md.

Raw plan:

$ARGUMENTS
