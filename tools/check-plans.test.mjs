/** The checker's rule: a completion claim must name a proof and carry pasted evidence. */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseTasks, proofCommand, checkPlan, findPlans, checkPlans, reloadLines, isActive, runProof, planNotes, WORD_LINE } from "./check-plans.mjs";

const table = (rows, sep = "\n") =>
  `## Tasks${sep}${sep}| id | task | status | proof | evidence |${sep}|----|------|--------|-------|----------|${sep}${rows.join(sep)}${sep}`;
const one = (status, proof = "`npm test`", evidence = "") => table([`| T1 | x | ${status} | ${proof} | ${evidence} |`]);

describe("parseTasks", () => {
  it("reads the columns by name in any order and skips the separator", () => {
    const { found, tasks } = parseTasks("## Tasks\n\n| status | id | note | evidence | proof |\n|--|--|--|--|--|\n| done | T1 | hi | 2026 exit 0 | `npm test` |\n");
    assert.equal(found, true);
    assert.deepEqual({ id: tasks[0].id, status: tasks[0].status, proof: tasks[0].proof, evidence: tasks[0].evidence }, { id: "T1", status: "done", proof: "`npm test`", evidence: "2026 exit 0" });
  });
  it("keeps a pipe that is inside a backticked proof command", () => {
    const { tasks } = parseTasks(table(["| T1 | x | done | `npm test | tail -1` | exit 0 |"]));
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].proof, "`npm test | tail -1`");
    assert.equal(tasks[0].evidence, "exit 0");
  });
  it("reads CRLF, and does not stop at a blank line inside the table", () => {
    const { tasks } = parseTasks(table(["| T1 | x | todo | `c` | |", "", "| T2 | y | done | `c` | |"], "\r\n"));
    assert.equal(tasks.length, 2);
    assert.equal(tasks[1].id, "T2");
  });
  it("reads a SECOND ## Tasks section too", () => {
    const text = table(["| T1 | x | todo | `c` | |"]) + "\n## Notes\nprose\n\n" + table(["| T2 | y | done | `c` | |"]);
    const { tasks } = parseTasks(text);
    assert.equal(tasks.length, 2);
    assert.equal(tasks[1].id, "T2");
  });
  it("finds the table but returns no rows for a new, empty plan", () => {
    const { found, tasks } = parseTasks("## Tasks\n\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n");
    assert.equal(found, true);
    assert.equal(tasks.length, 0);
  });
  it("reports the missing column names", () => {
    const r = parseTasks("## Tasks\n\n| id | task | status |\n|--|--|--|\n| T1 | x | done |\n");
    assert.equal(r.found, false);
    assert.deepEqual(r.missingCols.sort(), ["evidence", "proof"]);
  });
});

describe("parseTasks — finds tables by their columns, not the heading", () => {
  const done = (heading) => `# Plan\n\n${heading}\n\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n| T1 | x | done | \`c\` | |\n`;
  it("catches a done+empty task under a phased heading", () => {
    assert.match(checkPlan({ id: "b", text: done("## Phase 2 Tasks") })[0], /T1: status "done" but the evidence cell is empty/);
  });
  it("catches one under a non-tasks heading (## Backlog)", () => {
    assert.match(checkPlan({ id: "c", text: done("## Backlog") })[0], /T1/);
  });
  it("catches one under no heading at all", () => {
    assert.match(checkPlan({ id: "d", text: "| id | task | status | proof | evidence |\n|--|--|--|--|--|\n| T1 | x | done | `c` | |\n" })[0], /T1/);
  });
  it("still reports a missing column under a ## Tasks heading, not a generic error", () => {
    assert.match(checkPlan({ id: "e", text: "## Tasks\n\n| id | task | status | proof |\n|--|--|--|--|\n| T1 | x | done | `c` |\n" })[0], /missing the "evidence" column/);
  });
});

describe("checkPlan — what counts as a completion claim", () => {
  it("passes a done task with proof and evidence", () => {
    assert.deepEqual(checkPlan({ id: "p", text: one("done", "`npm test`", "2026-09-12 exit 0") }), []);
  });
  it("catches EVERY spelling of finished with empty evidence", () => {
    for (const s of ["done", "Done", "DONE", "done ", "done.", "**done**", "completed", "complete", "finished", "shipped", "delivered", "✅", "✔️", "done ✅", "x"]) {
      const p = checkPlan({ id: "p", text: one(s) });
      assert.equal(p.length, 1, `status ${JSON.stringify(s)} must be treated as a completion claim`);
      assert.match(p[0], /evidence cell is empty/);
    }
  });
  it("keeps a pipe-in-proof task honest (the classic bypass)", () => {
    const bypass = table(["| T1 | x | done | `npm test | tail -1` | |"]);
    const p = checkPlan({ id: "p", text: bypass });
    assert.equal(p.length, 1);
    assert.match(p[0], /evidence cell is empty/);
  });
  it("catches a done task hidden after a blank line", () => {
    const p = checkPlan({ id: "p", text: table(["| T1 | x | todo | `c` | |", "", "| T2 | y | done | `c` | |"]) });
    assert.equal(p.length, 1);
    assert.match(p[0], /T2/);
  });
  it("catches a done task in a second Tasks table", () => {
    const text = table(["| T1 | x | done | `c` | exit 0 |"]) + "\n## More\n\n" + table(["| T2 | y | done | `c` | |"]);
    const p = checkPlan({ id: "p", text });
    assert.equal(p.length, 1);
    assert.match(p[0], /T2/);
  });
  it("ignores a Learnings section and still gates the task", () => {
    const text = table(["| T1 | x | done | `c` | |"]) + "\n## Learnings\n- mocking the seam hid a real break → assert against the comms log (40 min on T1)\n- keep evidence a pasted exit line, not a word\n";
    const p = checkPlan({ id: "p", text });
    assert.equal(p.length, 1);
    assert.match(p[0], /T1: status "done" but the evidence cell is empty/);
  });
  it("skips not-done statuses (todo, doing, blocked, wip, in progress, pending, cancelled)", () => {
    for (const s of ["todo", "doing", "blocked", "wip", "in progress", "in-progress", "pending", "cancelled", "n/a"]) {
      assert.deepEqual(checkPlan({ id: "p", text: one(s) }), [], `status ${JSON.stringify(s)} should be skipped`);
    }
  });
  it("treats a blank status as not a claim", () => {
    assert.deepEqual(checkPlan({ id: "p", text: one("") }), []);
  });
  it("rejects a placeholder in the evidence cell", () => {
    for (const ev of ["", "—", "   ", "TBD", "pending", "?", "n/a"]) {
      assert.match(checkPlan({ id: "p", text: one("done", "`c`", ev) })[0], /evidence cell is empty/, `evidence ${JSON.stringify(ev)} should not count`);
    }
  });
  it("fails a completion claim that names no proof", () => {
    assert.match(checkPlan({ id: "p", text: one("done", "", "did it") })[0], /names no proof/);
  });
  it("accepts an owner-closed task with a recorded word", () => {
    assert.deepEqual(checkPlan({ id: "p", text: one("done", "owner", "2026-09-12 owner said ship") }), []);
  });
  it("reports a missing column clearly, not 'no table'", () => {
    assert.match(checkPlan({ id: "p", text: "## Tasks\n\n| id | task | status | proof |\n|--|--|--|--|\n| T1 | x | done | `c` |\n" })[0], /missing the "evidence" column/);
  });
  it("--verify re-runs the proof (pipe intact) and reports a non-zero exit", () => {
    const text = table(["| T1 | x | done | `npm test | tail` | exit 0 claimed |"]);
    let got;
    const fail = checkPlan({ id: "p", text, verify: true, run: (cmd) => { got = cmd; return 1; } });
    assert.equal(got, "npm test | tail");
    assert.match(fail[0], /proof re-run failed/);
  });
});

describe("checkPlan — the gate matches the method (0.4.0)", () => {
  it("case 1: done with evidence `exit 1` fails — the proof failed", () => {
    const p = checkPlan({ id: "p", text: one("done", "`npm test`", "2026-09-13 14:20 · exit 1 · \"2 failed\"") });
    assert.equal(p.length, 1);
    assert.match(p[0], /records exit 1 — the proof failed/);
  });
  it("case 2: a bare word is not evidence — the exit code must be recorded", () => {
    for (const ev of ["done", "✅", "passed", "ok", "yes, ran it"]) {
      const p = checkPlan({ id: "p", text: one("done", "`npm test`", ev) });
      assert.equal(p.length, 1, `evidence ${JSON.stringify(ev)} must not count`);
      assert.match(p[0], /does not record the proof's exit code/);
    }
    assert.deepEqual(checkPlan({ id: "p", text: one("done", "`npm test`", "exit code 0, 6 passed") }), []);
    assert.deepEqual(checkPlan({ id: "p", text: one("done", "`npm test`", "2026-09-13 · exited 0") }), []);
  });
  it("case 3a: three backticks in a task cell are literal (CommonMark), so the row still reads and is gated", () => {
    const { tasks } = parseTasks(table(["| T1 | lines inside ``` fences are never rows | done | `c` | |"]));
    assert.equal(tasks[0].status, "done");
    assert.equal(tasks[0].proof, "`c`");
    const p = checkPlan({ id: "p", text: table(["| T1 | lines inside ``` fences are never rows | done | `c` | |"]) });
    assert.equal(p.length, 1);
    assert.match(p[0], /T1: status "done" but the evidence cell is empty/);
  });
  it("case 3b: a stray backtick that pairs with a later one leaves a short row — reported, never passed", () => {
    const p = checkPlan({ id: "p", text: table(["| T1 | fix the `foo bug | done | `c` | |"]) });
    assert.equal(p.length, 1);
    assert.match(p[0], /row has 3 cell\(s\) but the header has 5/);
  });
  it("case 3c: an escaped pipe inside a code span is a literal pipe", () => {
    const { tasks } = parseTasks(table(["| T1 | x | done | `grep -c a \\| wc -l` | exit 0 |"]));
    assert.equal(tasks[0].proof, "`grep -c a | wc -l`");
    assert.equal(tasks[0].cellCount, 5);
  });
  it("case 4: a proof that is prose fails — it must be a `command` or owner", () => {
    const p = checkPlan({ id: "p", text: one("done", "ran the tests by hand", "exit 0") });
    assert.equal(p.length, 1);
    assert.match(p[0], /must be a `command` in backticks or the word owner/);
    assert.deepEqual(checkPlan({ id: "p", text: one("done", "Owner", "2026-09-13 owner said ship") }), []);
  });
  it("case 5: a task table inside a code fence is an example, not tasks", () => {
    const text = table(["| T1 | x | done | `c` | exit 0 |"]) + "\n## Learnings\n- keep tables like this:\n```\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n| T9 | y | done | `c` | |\n```\n";
    assert.equal(parseTasks(text).tasks.length, 1);
    assert.deepEqual(checkPlan({ id: "p", text }), []);
  });
  it("case 6: a Decisions table right after the Tasks table, no heading between, is not read as tasks", () => {
    const text = table(["| T1 | x | todo | `c` | |"]) + "\n| date | decision | why |\n|--|--|--|\n| 2026-09-13 | five posts | fits one screen |\n";
    assert.equal(parseTasks(text).tasks.length, 1);
    assert.deepEqual(checkPlan({ id: "p", text }), []);
  });
  it("case 7: markup in the header cells (**id**) is ignored", () => {
    const text = "## Tasks\n| **id** | **task** | **status** | **proof** | **evidence** |\n|--|--|--|--|--|\n| T1 | x | done | `c` | |\n";
    const p = checkPlan({ id: "p", text });
    assert.equal(p.length, 1);
    assert.match(p[0], /T1: status "done" but the evidence cell is empty/);
  });
});

describe("checkPlan — NOW is current (0.4.0)", () => {
  const plan = (resume, rows) => `# P — plan\n\nstatus: active · opened 2026-09-13 · id: p\n\n## NOW\nRESUME: ${resume}\nNEXT: —\nupdated: 2026-09-13 14:00\n\n` + table(rows);
  const T1done = "| T1 | x | done | `c` | 2026-09-13 · exit 0 · \"ok\" |";
  it("case 10: a RESUME line that names only done tasks is stale", () => {
    const p = checkPlan({ id: "p", text: plan("T1 — finish x", [T1done, "| T2 | y | todo | `c` | |"]) });
    assert.equal(p.length, 1);
    assert.match(p[0], /NOW is stale — RESUME names T1, which is done/);
  });
  it("passes when RESUME names an open task, or a done one beside an open one", () => {
    assert.deepEqual(checkPlan({ id: "p", text: plan("T2 — do y", [T1done, "| T2 | y | todo | `c` | |"]) }), []);
    assert.deepEqual(checkPlan({ id: "p", text: plan("T1 landed; T2 — do y", [T1done, "| T2 | y | todo | `c` | |"]) }), []);
    assert.deepEqual(checkPlan({ id: "p", text: plan("T12 — the last one", [T1done, "| T12 | z | doing | `c` | |"]) }), [], "T1 must not match inside T12");
  });
  it("a plan with NO status line counts as active, so the NOW rule applies (fail closed)", () => {
    const text = "# P — plan\n\n## NOW\nRESUME: T1 — x\n\n" + table([T1done, "| T2 | y | todo | `c` | |"]);
    assert.match(checkPlan({ id: "p", text })[0], /NOW is stale/);
    assert.equal(isActive(text), true);
    assert.equal(isActive("status: complete · opened 2026-09-13 · id: p\n"), false, "a finished word exempts");
    assert.equal(isActive("status: paused\n"), false);
    assert.equal(isActive("status: wip\n"), true, "an unknown word stays active");
  });
  it("skips the NOW rule for a retired plan; an ACTIVE plan without a RESUME line is a problem (0.5.2)", () => {
    const retired = plan("T1 — finish x", [T1done]).replace("status: active", "status: done");
    assert.deepEqual(checkPlan({ id: "p", text: retired }), []);
    assert.equal(isActive(retired), false);
    const noResume = checkPlan({ id: "p", text: "status: active\n\n## NOW\nDONE: everything\nNEXT: none\n\n" + table([T1done]) });
    assert.equal(noResume.length, 1);
    assert.match(noResume[0], /NOW has no RESUME line/);
    assert.deepEqual(checkPlan({ id: "p", text: retired.replace("RESUME:", "DONE:") }), [], "a retired plan may say what it likes");
  });
});

describe("the session line (0.5.0) is method, not gate", () => {
  const plan = (now, rows) => `# P — plan\n\nstatus: active · opened 2026-09-13 · id: p\n\n## NOW\n${now}\n\n` + table(rows);
  const T1done = "| T1 | x | done | `c` | 2026-09-13 · exit 0 · \"ok\" |";
  const open = "| T2 | y | todo | `c` | |";
  const claim = "session: edodo-video-9a · e999d3be · since 2026-09-13 16:38";
  it("a claim in NOW, or session: none, changes nothing for the checker", () => {
    const live = `RESUME: T2 — do y\nNEXT: —\nupdated: 2026-09-13 18:00\n${claim}`;
    assert.deepEqual(checkPlan({ id: "p", text: plan(live, [T1done, open]) }), []);
    assert.deepEqual(checkPlan({ id: "p", text: plan(live.replace(claim, "session: none"), [T1done, open]) }), []);
    assert.deepEqual(checkPlan({ id: "p", text: plan(live.replace(`\n${claim}`, ""), [T1done, open]) }), [], "a plan written before 0.5.0 has no line");
    assert.equal(isActive(plan(live, [T1done, open])), true);
  });
  it("the line masks nothing: a stale RESUME beside it is still reported", () => {
    const stale = `RESUME: T1 — finish x\nNEXT: T2\nupdated: 2026-09-13 18:00\n${claim}`;
    const p = checkPlan({ id: "p", text: plan(stale, [T1done, open]) });
    assert.equal(p.length, 1);
    assert.match(p[0], /NOW is stale — RESUME names T1, which is done/);
  });
});

describe("reloadLines — rail 1 (0.4.0)", () => {
  it("reads @ lines on their own line, outside fences and backticks", () => {
    const ids = reloadLines("# P\n\n## Active plans\n@.project-management/plans/alpha/PLAN.md\n\n## Finished\n`@.project-management/plans/beta/PLAN.md`\n\n```\n@.project-management/plans/gamma/PLAN.md\n```\nsee @.project-management/plans/delta/PLAN.md inline\n");
    assert.deepEqual([...ids], ["alpha"]);
  });
});

describe("--verify — case 8 (0.4.0): a failing proof shows its last line, a hanging one times out", () => {
  it("reports the last output line of a failing proof through checkPlan", () => {
    const text = table(["| T1 | x | done | `c` | exit 0 claimed |"]);
    const p = checkPlan({ id: "p", text, verify: true, run: () => ({ code: 2, last: "boom: 2 failed" }) });
    assert.equal(p.length, 1);
    assert.match(p[0], /proof re-run failed — `c` exited 2 — boom: 2 failed/);
  });
  it("runProof runs a real command and keeps its exit code and last line", () => {
    const r = runProof("node -e \"console.log(123);process.exit(3)\"", process.cwd(), 20000);
    assert.equal(r.code, 3);
    assert.equal(r.last, "123");
    assert.equal(runProof("node -e \"process.exit(0)\"", process.cwd(), 20000).code, 0);
  });
  it("runProof times out a hanging proof instead of hanging the build", () => {
    const r = runProof("node -e \"setTimeout(function(){},30000)\"", process.cwd(), 500);
    assert.equal(r.code, "timeout after 0.5s");
  });
});

describe("the PLAN.md template in PLANNER.md — case 11 (0.4.0): template and parser cannot drift apart", () => {
  const planner = readFileSync(new URL("../PLANNER.md", import.meta.url), "utf8");
  const start = planner.indexOf("## Template — PLAN.md");
  const open = planner.indexOf("````markdown", start);
  const close = planner.indexOf("````", open + 12);
  const template = planner.slice(open + "````markdown".length, close).trim();
  it("is found, has three placeholder rows, and passes the gate as written", () => {
    const { found, tasks } = parseTasks(template);
    assert.equal(found, true);
    assert.deepEqual(tasks.map((t) => t.id), ["T1", "T2", "T3"]);
    assert.ok(tasks.every((t) => t.cellCount === t.headerCount), "every template row has every column");
    assert.deepEqual(checkPlan({ id: "template", text: template }), []);
    assert.equal(isActive(template), true);
  });
  it("carries the block a fresh session works from", () => {
    for (const must of ["## How to work this plan", "## NOW", "RESUME:", "exit N", "`date`", "LOG.md", "Learnings", "check-plans.mjs"]) assert.ok(template.includes(must), must);
  });
  it("the worked example carries the template's block byte for byte (0.5.2)", () => {
    const ex = readFileSync(new URL("../examples/weekly-digest/.project-management/plans/weekly-digest/PLAN.md", import.meta.url), "utf8");
    const blockOf = (s) => s.slice(s.indexOf("## How to work this plan"), s.indexOf("## Goal")).trim();
    assert.equal(blockOf(ex), blockOf(template), "examples/weekly-digest must ship the template's block, not an older one");
  });
  it("the block covers owner proofs, the close, and the four NOW lines (0.5.2)", () => {
    const block = template.slice(template.indexOf("## How to work this plan"), template.indexOf("## Goal"));
    for (const must of ["proof of `owner`", "never by you", "§5", "`status: done`", "`session: none`", "exactly these four lines", "Get-Date", "no plan's `session:` line"]) assert.ok(block.includes(must), `the block says: ${must}`);
  });
  it("names the session in NOW, and the block itself carries the check (0.5.1)", () => {
    const now = template.slice(template.indexOf("## NOW"), template.indexOf("## How to work this plan"));
    assert.ok(now.includes("session: <none"), "NOW carries the session placeholder");
    const block = template.slice(template.indexOf("## How to work this plan"), template.indexOf("## Goal"));
    for (const must of ["session:", "session id", "claude agents --json", "git status --short", "not yours", "stale", "take over", "`date`", "git is the record"]) assert.ok(block.includes(must), `the block itself says: ${must}`);
  });
});

describe("fresh-context review fixes (0.4.0)", () => {
  it("case 4b: a code span inside prose is not a proof — the cell must be exactly one command", () => {
    const p = checkPlan({ id: "p", text: one("done", "see `README.md` for the check", "exit 0") });
    assert.equal(p.length, 1);
    assert.match(p[0], /must be a `command` in backticks or the word owner/);
    assert.equal(proofCommand("see `README.md` for the check"), null);
    assert.equal(proofCommand("  `npm test`  "), "npm test");
  });
  it("every exit code in the evidence counts, and 'exit status'/'exit-code' spellings are read", () => {
    assert.match(checkPlan({ id: "p", text: one("done", "`c`", "exit 0 on the first run, exit 1 on the rerun") })[0], /records exit 1/);
    assert.match(checkPlan({ id: "p", text: one("done", "`c`", "2026-09-13 · exit status 1") })[0], /records exit 1/);
    assert.match(checkPlan({ id: "p", text: one("done", "`c`", "exit-code 2") })[0], /records exit 2/);
  });
  it("an owner-closed task records the owner's words with a date, not a bare tick", () => {
    assert.match(checkPlan({ id: "p", text: one("done", "owner", "✅") })[0], /records the owner's words with the date/);
    assert.deepEqual(checkPlan({ id: "p", text: one("done", "owner", "2026-09-13 owner: ship it") }), []);
  });
  it("a ```` fence can hold a ``` example without exposing a table inside it", () => {
    const text = table(["| T1 | x | done | `c` | exit 0 |"]) + "\n## Notes\n````markdown\nexample:\n```\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n| T9 | y | done | `c` | |\n```\n````\n";
    assert.equal(parseTasks(text).tasks.length, 1);
    assert.deepEqual(checkPlan({ id: "p", text }), []);
  });
  it("NOW is stale even when the id cell carries markup", () => {
    const text = "status: active\n\n## NOW\nRESUME: T1 — x\n\n" + table(["| **T1** | x | done | `c` | exit 0 |", "| **T2** | y | todo | `c` | |"]);
    assert.match(checkPlan({ id: "p", text })[0], /NOW is stale — RESUME names T1/);
  });
});

describe("the checker as a command — it must never silently exit 0", () => {
  const CHECKER = fileURLToPath(new URL("./check-plans.mjs", import.meta.url));
  let root;
  before(() => {
    root = mkdtempSync(join(tmpdir(), "planrails-cli-"));
    mkdirSync(join(root, ".project-management", "plans", "bad"), { recursive: true });
    writeFileSync(join(root, ".project-management", "plans", "bad", "PLAN.md"), one("done", "`c`", ""));
  });
  after(() => { rmSync(root, { recursive: true, force: true }); });
  it("run by its path, it reports the problem and exits 1", () => {
    const r = spawnSync(process.execPath, [CHECKER, "--root", root], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /bad T1: status "done" but the evidence cell is empty/);
  });
  it("run through a symlink, the same", { skip: process.platform === "win32" ? "symlinks need privileges on Windows" : false }, () => {
    const link = join(root, "checker-link.mjs");
    symlinkSync(CHECKER, link);
    const r = spawnSync(process.execPath, [link, "--root", root], { encoding: "utf8" });
    assert.equal(r.status, 1, "a symlinked checker must still run: " + r.stdout + r.stderr);
    assert.match(r.stderr, /evidence cell is empty/);
  });
  it("accepts --dir as well as --root", () => {
    const r = spawnSync(process.execPath, [CHECKER, "--dir", root], { encoding: "utf8" });
    assert.equal(r.status, 1);
  });
});

describe("proofCommand", () => {
  it("extracts a backticked command including a pipe", () => assert.equal(proofCommand("`npm test | tail -1`"), "npm test | tail -1"));
  it("returns null for owner and for empty", () => { assert.equal(proofCommand("owner"), null); assert.equal(proofCommand(""), null); });
});

describe("findPlans / checkPlans (filesystem)", () => {
  let root;
  before(() => { root = mkdtempSync(join(tmpdir(), "planrails-fp-")); });
  after(() => { rmSync(root, { recursive: true, force: true }); });
  it("flags a plan folder that has no PLAN.md", () => {
    const d = join(root, ".project-management", "plans", "orphan");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "LOG.md"), "# log");
    const { problems } = checkPlans({ root });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /orphan: plan folder has no PLAN.md/);
  });
  it("checks a real plan on disk end to end", () => {
    const d = join(root, ".project-management", "plans", "real");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "PLAN.md"), one("done", "`c`", "exit 0"));
    const { plans, problems } = checkPlans({ root });
    assert.ok(plans.some((p) => p.id === "real"));
    assert.deepEqual(problems.filter((p) => p.startsWith("real ")), []);
  });
});

describe("checkPlans — the reload line, case 9 (0.4.0)", () => {
  let root;
  const active = "# A — plan\n\nstatus: active · opened 2026-09-13 · id: alpha\n\n## NOW\nRESUME: T1 — x\n\n" + one("todo", "`c`", "");
  before(() => {
    root = mkdtempSync(join(tmpdir(), "planrails-rl-"));
    mkdirSync(join(root, ".project-management", "plans", "alpha"), { recursive: true });
    writeFileSync(join(root, ".project-management", "plans", "alpha", "PLAN.md"), active);
  });
  after(() => { rmSync(root, { recursive: true, force: true }); });
  it("is skipped when the project has no CLAUDE.md", () => {
    assert.deepEqual(checkPlans({ root }).problems, []);
  });
  it("fails an active plan that CLAUDE.md does not reload — including one only mentioned in backticks", () => {
    writeFileSync(join(root, "CLAUDE.md"), "# P\n\n## Finished\n`@.project-management/plans/alpha/PLAN.md`\n");
    const { problems } = checkPlans({ root });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /alpha: the plan is active but CLAUDE.md has no reload line/);
  });
  it("passes once the line is there, and fails a line that points at a plan that does not exist", () => {
    writeFileSync(join(root, "CLAUDE.md"), "# P\n\n## Active plans\n@.project-management/plans/alpha/PLAN.md\n");
    assert.deepEqual(checkPlans({ root }).problems, []);
    writeFileSync(join(root, "CLAUDE.md"), "# P\n\n@.project-management/plans/alpha/PLAN.md\n@.project-management/plans/gone/PLAN.md\n");
    const { problems } = checkPlans({ root });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /CLAUDE.md reloads "gone" but .*gone.*PLAN.md does not exist/);
  });
  it("does not require a reload line for a retired plan", () => {
    writeFileSync(join(root, ".project-management", "plans", "alpha", "PLAN.md"), active.replace("status: active", "status: done"));
    writeFileSync(join(root, "CLAUDE.md"), "# P\n");
    assert.deepEqual(checkPlans({ root }).problems, []);
    writeFileSync(join(root, ".project-management", "plans", "alpha", "PLAN.md"), active);
  });
});

describe("notes (0.6.0) — what a script can only suspect prints, and never fails the run", () => {
  const CHECKER = fileURLToPath(new URL("./check-plans.mjs", import.meta.url));
  const filler = (n) => `${"word ".repeat(n)}\n`;
  const plan = (status, extra) => `# P\n\nstatus: ${status} · id: p\n\n## NOW\nRESUME: T1 — go\n\n${one("todo")}\n${filler(extra)}`;
  it("an active plan over the word line gets one note that names the count and what to trim", () => {
    const notes = planNotes({ id: "big", text: plan("active", WORD_LINE) });
    assert.equal(notes.length, 1);
    assert.match(notes[0], /^big: PLAN\.md is 3,0\d\d words, over the ~3,000 line/);
    assert.match(notes[0], /move history to LOG\.md/);
  });
  it("a plan under the line, and a plan that is not active, get none", () => {
    assert.deepEqual(planNotes({ id: "small", text: plan("active", 100) }), []);
    assert.deepEqual(planNotes({ id: "old", text: plan("done", WORD_LINE) }), []);
  });
  it("the line is exact: 3,000 words is quiet, 3,001 is noted", () => {
    assert.deepEqual(planNotes({ id: "at", text: "word ".repeat(WORD_LINE) }), []);
    assert.match(planNotes({ id: "past", text: "word ".repeat(WORD_LINE + 1) })[0], /is 3,001 words/);
  });
  it("a plan with no status line counts as active here too", () => {
    assert.equal(planNotes({ id: "x", text: filler(WORD_LINE + 1) }).length, 1);
  });
  describe("as a command", () => {
    let root;
    const write = (id, text) => { mkdirSync(join(root, ".project-management", "plans", id), { recursive: true }); writeFileSync(join(root, ".project-management", "plans", id, "PLAN.md"), text); };
    before(() => { root = mkdtempSync(join(tmpdir(), "planrails-notes-")); write("big", plan("active", WORD_LINE)); });
    after(() => { rmSync(root, { recursive: true, force: true }); });
    it("a note keeps exit 0 and leaves the ok line last", () => {
      const r = spawnSync(process.execPath, [CHECKER, "--root", root], { encoding: "utf8" });
      assert.equal(r.status, 0);
      const lines = r.stdout.trim().split(/\r?\n/);
      assert.match(lines[0], /^check-plans: note: big: PLAN\.md is/);
      assert.match(lines.at(-1), /^check-plans: 1 plan\(s\) ok/);
      assert.equal(r.stderr, "");
    });
    it("a failing run still exits 1, and prints the note too", () => {
      write("bad", one("done", "`c`", ""));
      const r = spawnSync(process.execPath, [CHECKER, "--root", root], { encoding: "utf8" });
      assert.equal(r.status, 1);
      assert.match(r.stdout, /note: big:/);
      assert.match(r.stderr, /1 problem\(s\)/);
    });
  });
  it("with no note, a passing run prints exactly the one ok line", () => {
    const root = mkdtempSync(join(tmpdir(), "planrails-quiet-"));
    try {
      mkdirSync(join(root, ".project-management", "plans", "p"), { recursive: true });
      writeFileSync(join(root, ".project-management", "plans", "p", "PLAN.md"), plan("active", 10));
      const r = spawnSync(process.execPath, [CHECKER, "--root", root], { encoding: "utf8" });
      assert.equal(r.status, 0);
      assert.equal(r.stdout, "check-plans: 1 plan(s) ok — every completion claim has a proof and exit 0 evidence, active plans reload, NOW is current\n");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
