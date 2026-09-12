/** The checker's rule: a completion claim must name a proof and carry pasted evidence. */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseTasks, proofCommand, checkPlan, findPlans, checkPlans } from "./check-plans.mjs";

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
    const text = table(["| T1 | x | done | `c` | ok |"]) + "\n## More\n\n" + table(["| T2 | y | done | `c` | |"]);
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
