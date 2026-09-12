/** The CLI: init copies two files and nothing else; check runs the gate. */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("./planrails.mjs", import.meta.url));
const run = (args, opts = {}) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", ...opts });

let dir;
before(() => { dir = mkdtempSync(join(tmpdir(), "planrails-cli-")); });
after(() => { rmSync(dir, { recursive: true, force: true }); });

describe("planrails init", () => {
  it("copies PLANNER.md and the checker into .project-management/ and makes plans/", () => {
    const r = run(["init", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, ".project-management", "PLANNER.md")), "PLANNER.md");
    assert.ok(existsSync(join(dir, ".project-management", "check-plans.mjs")), "check-plans.mjs");
    assert.ok(existsSync(join(dir, ".project-management", "plans", ".gitkeep")), "plans/.gitkeep");
  });
  it("writes NO package.json and does NOT touch CLAUDE.md", () => {
    // dir was set up by the previous test; init must not have created these
    assert.equal(existsSync(join(dir, "package.json")), false, "no package.json written");
    assert.equal(existsSync(join(dir, "CLAUDE.md")), false, "no CLAUDE.md written");
  });
  it("is idempotent: a second run keeps the existing files and reports them", () => {
    const marker = "-- edited by the user --";
    const planner = join(dir, ".project-management", "PLANNER.md");
    writeFileSync(planner, marker);
    const r = run(["init", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(planner, "utf8"), marker, "must not overwrite without --force");
    assert.match(r.stdout, /already present/);
  });
  it("--force overwrites", () => {
    const planner = join(dir, ".project-management", "PLANNER.md");
    writeFileSync(planner, "stale");
    const r = run(["init", "--dir", dir, "--force"]);
    assert.equal(r.status, 0, r.stderr);
    assert.notEqual(readFileSync(planner, "utf8"), "stale");
  });
});

describe("planrails check", () => {
  it("passes a good plan and fails a done task with no evidence", () => {
    const plans = join(dir, ".project-management", "plans", "x");
    mkdirSync(plans, { recursive: true });
    const table = (ev) => `## Tasks\n\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n| T1 | x | done | \`npm test\` | ${ev} |\n`;
    writeFileSync(join(plans, "PLAN.md"), table("2026-09-12 exit 0"));
    assert.equal(run(["check", "--dir", dir]).status, 0);
    writeFileSync(join(plans, "PLAN.md"), table(""));
    const bad = run(["check", "--dir", dir]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /evidence cell is empty/);
  });
});

describe("planrails misc", () => {
  it("--version prints the version", () => {
    const r = run(["--version"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
  });
  it("an unknown command exits 2", () => {
    assert.equal(run(["frobnicate"]).status, 2);
  });
});
