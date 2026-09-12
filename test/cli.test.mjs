/**
 * Drives the real CLI against a throwaway project root. The promises under test:
 * a task is `done` only with a recorded gate run made for THIS close (or the
 * owner's word) and every condition of done answered; an active plan is listed
 * in CLAUDE.md's generated block; a gate edited after verification cannot close
 * a task; a hand-typed done fails validation whoever wrote it.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { box, plan, planTry } from "./_helpers.mjs";

let root;
const stateFile = () => join(root, ".project-management/plans/demo/state.json");
const readState = () => JSON.parse(readFileSync(stateFile(), "utf8"));
const ANSWERS = ["--answer", "C4: no docs describe a flag file; none were needed", "--answer", "C5: the log entry carries no numbers", "--answer", "C6: nothing was learned or decided while doing this",
  "--answer", "C7: read src/x.ts and ok.flag whole; looked for a flag written by something else, which the gate cannot tell apart; it was written by this test"];

describe("plan system: done needs evidence and answered conditions", () => {
  before(() => {
    root = box();
    writeFileSync(join(root, "CLAUDE.md"), "# t\n\n## Project management\n\nold\n");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "x.ts"), "export const x = 1;\n");
    plan(root, "new", "demo", "--title", "Demo plan under test", "--paths", "src/**");
    plan(root, "gate", "add", "demo", "--question", "does the flag file exist when the gate runs", "--not", "whether anything works for a user",
      "--command", `test -f ${join(root, "ok.flag")}`, "--wrong", "the flag exists for another reason",
      "--known-fail", `test -f ${join(root, "never.flag")}`, "--known-fail-why", "a missing flag must fail");
    plan(root, "task", "add", "demo", "--title", "Create the flag file", "--gate", "G1", "--files", "src/x.ts", "--done-when", "the flag file holds the single character 1");
    plan(root, "task", "add", "demo", "--title", "Owner reads the docs page", "--manual", "the owner opens docs/DEMO.md and says it reads well", "--after", "T1");
  });

  it("a fresh plan validates and activates, and CLAUDE.md gains the generated block", () => {
    assert.match(plan(root, "validate", "demo"), /valid/);
    assert.match(plan(root, "activate", "demo"), /demo → active/);
    const md = readFileSync(join(root, "CLAUDE.md"), "utf8");
    assert.ok(md.includes("<!-- plans:begin"));
    assert.ok(md.includes("**demo**"));
    assert.ok(md.indexOf("plans:begin") < md.indexOf("## Project management"));
  });

  it("gate verify proves the gate can fail, with the expected exit code", () => {
    assert.match(plan(root, "gate", "verify", "demo", "--all"), /VERIFIED/);
  });

  it("task check lists every condition with the gate's blind spots; task done refuses before the log entry and before the answers", () => {
    plan(root, "task", "start", "demo", "T1");
    const check = plan(root, "task", "check", "demo", "T1");
    for (const s of ["C1", "C8", "the flag file holds the single character 1", "it could pass while wrong if: the flag exists for another reason", "JUDGMENT OUTRANKS THE GATE"]) assert.ok(check.includes(s), `task check should mention: ${s}`);
    let r = planTry(root, "task", "done", "demo", "T1");
    assert.equal(r.status, 1);
    assert.ok(r.out.includes("C4"));
    r = planTry(root, "task", "done", "demo", "T1", ...ANSWERS, "--answer", "C8: checked with cat, it holds 1");
    assert.equal(r.status, 1);
    assert.match(r.out, /C2|log entry/);
    assert.equal(readState().tasks[0].status, "doing");
  });

  it("task done refuses while the gate fails, says never to bend the gate, and the task stays as it was", () => {
    plan(root, "log", "demo", "--task", "T1", "--what", "flag not created yet; the first done attempt was refused as designed", "--next", "create the flag, then task done T1");
    const r = planTry(root, "task", "done", "demo", "T1", ...ANSWERS, "--answer", "C8: checked with cat, it holds 1");
    assert.equal(r.status, 1);
    assert.ok(r.out.includes("NOT done"));
    assert.ok(r.out.includes("Never edit the gate, the test or the data"));
    assert.ok(r.out.includes("--needs owner"));
    assert.equal(readState().tasks[0].status, "doing");
    assert.equal(readState().tasks[0].evidence, null);
    assert.deepEqual(readState().tasks[0].doneChecklist, []);
  });

  it("task done records the passing run as evidence and stores every answered condition", () => {
    writeFileSync(join(root, "ok.flag"), "1");
    const out = plan(root, "task", "done", "demo", "T1", ...ANSWERS, "--answer", "C8: checked with cat, it holds 1");
    assert.match(out, /T1 → done/);
    const t = readState().tasks[0];
    assert.equal(t.status, "done");
    assert.equal(t.evidence.kind, "gate");
    assert.deepEqual(t.doneChecklist.map((c) => c.id), ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]);
    assert.ok(t.doneChecklist.find((c) => c.id === "C2").answer.includes("log entry"));
    const runs = readFileSync(join(root, ".project-management/plans/demo/gate-runs.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(runs.some((r) => r.runId === t.evidence.runId && r.result === "pass" && r.at === t.evidence.at));
    assert.ok(plan(root, "review", "demo", "T1").includes("checked with cat, it holds 1"));
  });

  it("a gate edited after it was verified cannot close a task until it is verified again", () => {
    plan(root, "gate", "add", "demo", "--question", "does the second flag file exist", "--not", "whether the first one does",
      "--command", `test -f ${join(root, "two.flag")}`, "--wrong", "the flag was written by something else",
      "--known-fail", `test -f ${join(root, "never2.flag")}`, "--known-fail-why", "a missing flag must fail");
    plan(root, "gate", "verify", "demo", "G2");
    plan(root, "task", "add", "demo", "--title", "Create the second flag file", "--gate", "G2", "--files", "src/x.ts");
    writeFileSync(join(root, "two.flag"), "1");
    plan(root, "task", "start", "demo", "T3");
    plan(root, "log", "demo", "--task", "T3", "--what", "probing the stale-gate rail with an edited G2", "--next", "restore gates.json and re-verify");
    const gatesFile = join(root, ".project-management/plans/demo/gates.json");
    const before = readFileSync(gatesFile, "utf8");
    const g = JSON.parse(before); g.gates[1].command = "true"; writeFileSync(gatesFile, JSON.stringify(g, null, 2));
    try {
      const r = planTry(root, "task", "done", "demo", "T3", ...ANSWERS);
      assert.notEqual(r.status, 0);
      assert.ok(r.out.includes("changed after it was last verified"));
      assert.ok(planTry(root, "validate", "demo").out.includes("changed after it was last verified"));
    } finally { writeFileSync(gatesFile, before); }
    assert.match(plan(root, "validate", "demo"), /valid/);
    assert.match(plan(root, "task", "done", "demo", "T3", ...ANSWERS), /T3 → done/);
  });

  it("a hand-typed done fails validation whoever wrote it: fabricated run, borrowed run, agent's manual word on a gated task", () => {
    const before = JSON.stringify(readState());
    const fake = (mutate, expectMsg) => {
      const s = readState(); mutate(s); writeFileSync(stateFile(), JSON.stringify(s, null, 2));
      const r = planTry(root, "validate", "demo");
      assert.equal(r.status, 1);
      assert.match(r.out, expectMsg);
      writeFileSync(stateFile(), before);
    };
    const t1 = readState().tasks[0];
    fake((s) => { s.tasks[1].status = "done"; s.tasks[1].doneAt = t1.doneAt; s.tasks[1].evidence = { kind: "gate", gate: "G1", runId: "fabricated-1", at: t1.doneAt }; s.tasks[1].doneChecklist = t1.doneChecklist; }, /no passing run/);
    fake((s) => { s.tasks[1].status = "done"; s.tasks[1].doneAt = t1.doneAt; s.tasks[1].evidence = { ...t1.evidence }; s.tasks[1].doneChecklist = t1.doneChecklist; }, /cited by both/);
    fake((s) => { s.tasks[1].gate = "G1"; s.tasks[1].status = "done"; s.tasks[1].doneAt = t1.doneAt; s.tasks[1].evidence = { kind: "manual", by: "agent", at: t1.doneAt, reason: "I looked and it seemed fine to me, honestly" }; s.tasks[1].doneChecklist = t1.doneChecklist; }, /only the owner/);
  });

  it("a manual close needs a real reason, the owner's word for a gated task needs both flags, and answers are still required", () => {
    assert.notEqual(planTry(root, "task", "done", "demo", "T2", "--manual", "fine", "--by", "owner", ...ANSWERS).status, 0);
    plan(root, "log", "demo", "--task", "T2", "--what", "the owner read docs/DEMO.md in chat", "--next", "close T2 by the owner's word");
    plan(root, "task", "done", "demo", "T2", "--manual", "the owner read docs/DEMO.md in chat on 2026-09-12 and said it reads well", "--by", "owner", ...ANSWERS);
    assert.equal(readState().tasks[1].evidence.kind, "manual");
    assert.equal(readState().tasks[1].evidence.by, "owner");
    assert.equal(readState().tasks[1].doneChecklist.length, 7);
  });

  it("agent-brief hands a subagent its slice: files, done-means, report path, do-nots — never the plan's RESUME", () => {
    const ab = plan(root, "agent-brief", "demo", "T1", "--what", "create the flag file", "--label", "flag");
    for (const s of ["AGENT BRIEF", "src/x.ts", "G1", "reports/T1-flag.md", "NEVER:"]) assert.ok(ab.includes(s), `agent brief should mention: ${s}`);
    assert.ok(!ab.includes("RESUME:"));
    assert.ok(ab.length <= 3000);
  });

  it("log writes the RESUME line the brief shows; learn and decide append and cross-check; condition add gets the next free id", () => {
    plan(root, "log", "demo", "--task", "T1", "--what", "flag created after the first refusal", "--next", "RESUME-MARKER close the plan");
    assert.ok(plan(root, "brief", "demo").includes("RESUME: RESUME-MARKER close the plan"));
    plan(root, "learn", "demo", "--what", "the gate refused T1 before the flag existed, as designed", "--rule", "run the gate, do not assert", "--when", "closing any task");
    assert.notEqual(planTry(root, "learn", "demo", "--what", "a learning that claims a gate enforces it", "--rule", "rule text here", "--when", "always", "--enforcement", "gate", "--ref", "G9").status, 0);
    plan(root, "decide", "demo", "--what", "use a flag file as the demo gate", "--why", "the cheapest observable thing", "--rejected", "echo: cannot fail", "--by", "agent");
    assert.ok(plan(root, "learnings", "--search", "refused").includes("L1"));
    assert.match(plan(root, "condition", "add", "demo", "--statement", "the README names every new flag"), /C9 added/);
    assert.ok(plan(root, "condition", "list", "demo").includes("C9 [manual] the README names every new flag"));
    assert.ok(plan(root, "run", "demo", "--dry-run").includes("no task is ready"));
  });

  it("close needs the owner, runs every gate fresh, and removes the CLAUDE.md line; drift is then detected", () => {
    assert.ok(plan(root, "close", "demo").includes("ASK THE OWNER"));
    assert.equal(readState().status, "active");
    plan(root, "close", "demo", "--confirmed-by-owner");
    assert.equal(readState().status, "done");
    let md = readFileSync(join(root, "CLAUDE.md"), "utf8");
    assert.ok(!md.includes("**demo**"));
    assert.ok(md.includes("No active plans"));
    md = md.replace("<!-- plans:end -->", "- **demo** — sneaked back — `x`\n<!-- plans:end -->");
    writeFileSync(join(root, "CLAUDE.md"), md);
    const r = planTry(root, "validate", "--all");
    assert.equal(r.status, 1);
    assert.ok(r.out.includes("lists demo, which is not an active plan"));
  });
});
