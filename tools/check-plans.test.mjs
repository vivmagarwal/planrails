/** The checker's one rule: a done task must name a proof and carry pasted evidence. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTasks, proofCommand, checkPlan } from "./check-plans.mjs";

const table = (rows) => `## Tasks

| id | task | status | proof | evidence |
|----|------|--------|-------|----------|
${rows.join("\n")}
`;

describe("parseTasks", () => {
  it("reads id, status, proof and evidence, and skips the separator row", () => {
    const t = parseTasks(table(["| T1 | query | done | `npm test` | exit 0 |", "| T2 | render | doing | `npm test` | |"]));
    assert.equal(t.length, 2);
    assert.deepEqual({ id: t[0].id, status: t[0].status, proof: t[0].proof, evidence: t[0].evidence }, { id: "T1", status: "done", proof: "`npm test`", evidence: "exit 0" });
    assert.equal(t[1].status, "doing");
  });
  it("returns [] when there is no Tasks table", () => {
    assert.deepEqual(parseTasks("# Plan\n\nno tasks here"), []);
  });
  it("stops at the first line after the table", () => {
    const t = parseTasks(table(["| T1 | x | todo | `c` | |"]) + "\n## Rules\n- a rule\n");
    assert.equal(t.length, 1);
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
  it("fails a done task whose evidence cell is empty", () => {
    const p = checkPlan({ id: "p", text: table(["| T1 | x | done | `npm test` | |"]) });
    assert.equal(p.length, 1);
    assert.match(p[0], /T1: marked done but the evidence cell is empty/);
  });
  it("treats a lone dash as empty evidence", () => {
    const p = checkPlan({ id: "p", text: table(["| T1 | x | ✅ | `npm test` | — |"]) });
    assert.equal(p.length, 1);
    assert.match(p[0], /evidence cell is empty/);
  });
  it("fails a done task that names no proof", () => {
    const p = checkPlan({ id: "p", text: table(["| T1 | x | done | | done it |"]) });
    assert.equal(p.length, 1);
    assert.match(p[0], /names no proof/);
  });
  it("accepts an owner-closed task with a recorded word", () => {
    assert.deepEqual(checkPlan({ id: "p", text: table(["| T1 | ship | done | owner | 2026-09-12 owner said ship |"]) }), []);
  });
  it("ignores todo, doing and blocked tasks", () => {
    assert.deepEqual(checkPlan({ id: "p", text: table(["| T1 | a | todo | `c` | |", "| T2 | b | doing | `c` | |", "| T3 | c | blocked | `c` | waiting |"]) }), []);
  });
  it("flags a plan with no Tasks table", () => {
    const p = checkPlan({ id: "p", text: "# Plan\n\nno table" });
    assert.equal(p.length, 1);
    assert.match(p[0], /no readable Tasks table/);
  });
  it("--verify re-runs a done task's proof and reports a non-zero exit", () => {
    const text = table(["| T1 | x | done | `false` | exit 0 claimed |"]);
    const pass = checkPlan({ id: "p", text, verify: true, run: () => 0 });
    assert.deepEqual(pass, []);
    const fail = checkPlan({ id: "p", text, verify: true, run: () => 1 });
    assert.equal(fail.length, 1);
    assert.match(fail[0], /proof re-run failed — `false` exited 1/);
  });
});
