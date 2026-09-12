/** The checker's one rule: a done task must name a proof and carry pasted evidence. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTasks, proofCommand, checkPlan } from "./check-plans.mjs";

const table = (rows, sep = "\n") =>
  `## Tasks${sep}${sep}| id | task | status | proof | evidence |${sep}|----|------|--------|-------|----------|${sep}${rows.join(sep)}${sep}`;

describe("parseTasks", () => {
  it("reads the four named columns and skips the separator row", () => {
    const { found, tasks } = parseTasks(table(["| T1 | query | done | `npm test` | exit 0 |", "| T2 | render | doing | `npm test` | |"]));
    assert.equal(found, true);
    assert.equal(tasks.length, 2);
    assert.deepEqual({ id: tasks[0].id, status: tasks[0].status, proof: tasks[0].proof, evidence: tasks[0].evidence }, { id: "T1", status: "done", proof: "`npm test`", evidence: "exit 0" });
    assert.equal(tasks[1].status, "doing");
  });
  it("matches columns by name, in any order, ignoring extra columns", () => {
    const text = "## Tasks\n\n| status | id | note | evidence | proof |\n|--|--|--|--|--|\n| done | T1 | hi | 2026 exit 0 | `npm test` |\n";
    const { found, tasks } = parseTasks(text);
    assert.equal(found, true);
    assert.deepEqual({ id: tasks[0].id, status: tasks[0].status, proof: tasks[0].proof, evidence: tasks[0].evidence }, { id: "T1", status: "done", proof: "`npm test`", evidence: "2026 exit 0" });
  });
  it("reads CRLF line endings", () => {
    const { found, tasks } = parseTasks(table(["| T1 | x | done | `c` | exit 0 |"], "\r\n"));
    assert.equal(found, true);
    assert.equal(tasks[0].evidence, "exit 0");
  });
  it("finds the table but returns no rows for a new, empty plan", () => {
    const { found, tasks } = parseTasks("## Tasks\n\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n");
    assert.equal(found, true);
    assert.equal(tasks.length, 0);
  });
  it("is not found when a required column is missing", () => {
    assert.equal(parseTasks("## Tasks\n\n| id | task | status |\n|--|--|--|\n| T1 | x | done |\n").found, false);
  });
  it("is not found when there is no Tasks heading", () => {
    assert.equal(parseTasks("# Plan\n\nno tasks here").found, false);
  });
  it("stops at the first line after the table", () => {
    const { tasks } = parseTasks(table(["| T1 | x | todo | `c` | |"]) + "\n## Rules\n- a rule\n");
    assert.equal(tasks.length, 1);
  });
});

describe("proofCommand", () => {
  it("extracts a backticked command", () => assert.equal(proofCommand("`npx vitest run x`"), "npx vitest run x"));
  it("returns null for owner and for empty", () => { assert.equal(proofCommand("owner"), null); assert.equal(proofCommand(""), null); });
});

describe("checkPlan", () => {
  it("passes a done task with proof and evidence", () => {
    assert.deepEqual(checkPlan({ id: "p", text: table(["| T1 | x | done | `npm test` | 2026-09-12 exit 0 |"]) }), []);
  });
  it("passes a new plan whose table has no rows yet", () => {
    assert.deepEqual(checkPlan({ id: "p", text: "## Tasks\n\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n" }), []);
  });
  it("fails a done task whose evidence cell is empty", () => {
    const p = checkPlan({ id: "p", text: table(["| T1 | x | done | `npm test` | |"]) });
    assert.equal(p.length, 1);
    assert.match(p[0], /T1: marked done but the evidence cell is empty/);
  });
  it("treats a lone dash or whitespace as empty evidence", () => {
    assert.match(checkPlan({ id: "p", text: table(["| T1 | x | ✅ | `npm test` | — |"]) })[0], /evidence cell is empty/);
    assert.match(checkPlan({ id: "p", text: table(["| T1 | x | done | `npm test` |    |"]) })[0], /evidence cell is empty/);
  });
  it("catches done spelled Done / DONE / with a trailing space", () => {
    for (const s of ["Done", "DONE", "done "]) {
      const p = checkPlan({ id: "p", text: table([`| T1 | x | ${s} | \`c\` | |`]) });
      assert.equal(p.length, 1, `status ${JSON.stringify(s)} should be treated as done`);
    }
  });
  it("fails a done task that names no proof", () => {
    assert.match(checkPlan({ id: "p", text: table(["| T1 | x | done | | done it |"]) })[0], /names no proof/);
  });
  it("accepts an owner-closed task with a recorded word", () => {
    assert.deepEqual(checkPlan({ id: "p", text: table(["| T1 | ship | done | owner | 2026-09-12 owner said ship |"]) }), []);
  });
  it("ignores todo, doing and blocked tasks", () => {
    assert.deepEqual(checkPlan({ id: "p", text: table(["| T1 | a | todo | `c` | |", "| T2 | b | doing | `c` | |", "| T3 | c | blocked | `c` | waiting |"]) }), []);
  });
  it("flags a plan with no Tasks table", () => {
    assert.match(checkPlan({ id: "p", text: "# Plan\n\nno table" })[0], /no readable Tasks table/);
  });
  it("--verify re-runs a done task's proof and reports a non-zero exit", () => {
    const text = table(["| T1 | x | done | `false` | exit 0 claimed |"]);
    assert.deepEqual(checkPlan({ id: "p", text, verify: true, run: () => 0 }), []);
    const fail = checkPlan({ id: "p", text, verify: true, run: () => 1 });
    assert.equal(fail.length, 1);
    assert.match(fail[0], /proof re-run failed — `false` exited 1/);
  });
});
