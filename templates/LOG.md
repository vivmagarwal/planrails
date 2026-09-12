# <Feature> — log

Append-only. One entry per landed piece of work, newest at the bottom. This is
where a fresh session learns what the last one actually did, not just what the
plan said to do. Write it as you go, not from memory at the end.

<!-- Copy this block for each entry:

## <YYYY-MM-DD HH:MM> — <task id>: <short title>
- did: <what landed, 1–2 sentences>
- files: <repo-relative paths touched>
- proof: <the command, and its result — e.g. `npx vitest run tests/digest.test.ts` → exit 0, "6 passed">
- next: <what comes next; where you stopped if you paused>
- learned / decided: <anything a second reader needs; omit if nothing>
-->
