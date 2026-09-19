/** The CLI: init copies two files and nothing else, and a re-run updates the tool but never a plan; check runs the gate. */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { stampOf } from "./planrails.mjs";

const BIN = fileURLToPath(new URL("./planrails.mjs", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));
const VERSION = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).version;
const run = (args, opts = {}) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", ...opts });

let dir;
before(() => { dir = mkdtempSync(join(tmpdir(), "planrails-cli-")); });
after(() => { rmSync(dir, { recursive: true, force: true }); });

describe("the two copied files carry this package's version", () => {
  it("PLANNER.md and check-plans.mjs are stamped with package.json's version", () => {
    assert.equal(stampOf(readFileSync(join(REPO, "PLANNER.md"), "utf8")), VERSION, "PLANNER.md stamp");
    assert.equal(stampOf(readFileSync(join(REPO, "tools", "check-plans.mjs"), "utf8")), VERSION, "check-plans.mjs stamp");
  });
});

describe("planrails init", () => {
  it("copies PLANNER.md and the checker into .project-management/planrails/ and makes plans/", () => {
    const r = run(["init", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, ".project-management", "planrails", "PLANNER.md")), "PLANNER.md");
    assert.ok(existsSync(join(dir, ".project-management", "planrails", "check-plans.mjs")), "check-plans.mjs");
    assert.ok(existsSync(join(dir, ".project-management", "plans", ".gitkeep")), "plans/.gitkeep");
    assert.equal(existsSync(join(dir, ".project-management", "PLANNER.md")), false, "system files live under planrails/, not loose at the root");
  });
  it("writes NO package.json and does NOT touch CLAUDE.md", () => {
    assert.equal(existsSync(join(dir, "package.json")), false, "no package.json written");
    assert.equal(existsSync(join(dir, "CLAUDE.md")), false, "no CLAUDE.md written");
  });
  it("a second run with nothing changed reports up to date and writes nothing", () => {
    const r = run(["init", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /PLANNER.md up to date/);
    assert.match(r.stdout, /check-plans.mjs up to date/);
  });
  it("a re-run REPLACES an older or unstamped copy of the tool and says so", () => {
    const planner = join(dir, ".project-management", "planrails", "PLANNER.md");
    const checker = join(dir, ".project-management", "planrails", "check-plans.mjs");
    writeFileSync(planner, "# The Planner\n\nold 0.3.0 copy with no stamp\n");
    writeFileSync(checker, "#!/usr/bin/env node\n// planrails 0.0.1\nconsole.log('old');\n");
    const r = run(["init", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /PLANNER.md updated unstamped \(0\.3\.x or older\) → \d+\.\d+\.\d+/);
    assert.match(r.stdout, /check-plans.mjs updated 0\.0\.1 → \d+\.\d+\.\d+/);
    assert.equal(readFileSync(planner, "utf8"), readFileSync(join(REPO, "PLANNER.md"), "utf8"));
    assert.equal(readFileSync(checker, "utf8"), readFileSync(join(REPO, "tools", "check-plans.mjs"), "utf8"));
  });
  it("a same-version copy that was edited is kept, and --force replaces it", () => {
    const planner = join(dir, ".project-management", "planrails", "PLANNER.md");
    const edited = readFileSync(join(REPO, "PLANNER.md"), "utf8") + "\n<!-- a project note -->\n";
    writeFileSync(planner, edited);
    const kept = run(["init", "--dir", dir]);
    assert.equal(kept.status, 0, kept.stderr);
    assert.match(kept.stdout, /PLANNER.md is \d+\.\d+\.\d+ but edited — kept/);
    assert.equal(readFileSync(planner, "utf8"), edited, "must not overwrite an edited same-version copy without --force");
    const forced = run(["init", "--dir", dir, "--force"]);
    assert.equal(forced.status, 0, forced.stderr);
    assert.match(forced.stdout, /PLANNER.md updated .*\(--force\)/);
    assert.equal(readFileSync(planner, "utf8"), readFileSync(join(REPO, "PLANNER.md"), "utf8"));
  });
  it("a copy newer than this package is kept", () => {
    const checker = join(dir, ".project-management", "planrails", "check-plans.mjs");
    writeFileSync(checker, "#!/usr/bin/env node\n// planrails 99.0.0\nconsole.log('future');\n");
    const r = run(["init", "--dir", dir]);
    assert.match(r.stdout, /check-plans.mjs is 99\.0\.0, newer than this package/);
    assert.match(readFileSync(checker, "utf8"), /future/);
    run(["init", "--dir", dir, "--force"]);
  });
  it("never touches a plan, or CLAUDE.md, on a re-run", () => {
    const planDir = join(dir, ".project-management", "plans", "keep-me");
    mkdirSync(planDir, { recursive: true });
    const plan = "# Keep — plan\n\nstatus: active · opened 2026-09-13 · id: keep-me\n\n## NOW\nRESUME: T1\n\n## Tasks\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n| T1 | x | todo | `c` | |\n";
    writeFileSync(join(planDir, "PLAN.md"), plan);
    writeFileSync(join(planDir, "LOG.md"), "# log\n");
    writeFileSync(join(dir, "CLAUDE.md"), "# P\n\n@.project-management/plans/keep-me/PLAN.md\n");
    writeFileSync(join(dir, ".project-management", "planrails", "PLANNER.md"), "stale");
    const r = run(["init", "--dir", dir, "--force"]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(planDir, "PLAN.md"), "utf8"), plan, "PLAN.md byte-identical");
    assert.equal(readFileSync(join(planDir, "LOG.md"), "utf8"), "# log\n", "LOG.md byte-identical");
    assert.equal(readFileSync(join(dir, "CLAUDE.md"), "utf8"), "# P\n\n@.project-management/plans/keep-me/PLAN.md\n", "CLAUDE.md byte-identical");
    assert.match(r.stdout, /your plans are never touched/);
  });
  it("points out an active plan that predates 0.5 (no session: line), and stays quiet for one that has it (0.5.2)", () => {
    const mk = (name, sessionLine) => { const d = join(dir, ".project-management", "plans", name); mkdirSync(d, { recursive: true }); writeFileSync(join(d, "PLAN.md"), `# ${name} — plan\n\nstatus: active · opened 2026-09-01 · id: ${name}\n\n## NOW\nRESUME: T1\nNEXT: —\nupdated: 2026-09-01 10:00\n${sessionLine}\n## Tasks\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n| T1 | x | todo | \`c\` | |\n`); return d; };
    const old = mk("old-plan", ""), fresh = mk("fresh-plan", "session: none\n");
    const r = run(["init", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /! plan old-plan predates 0\.5: add a session: line to its NOW/);
    assert.doesNotMatch(r.stdout, /! plan fresh-plan/, "a plan with a session: line is not flagged");
    rmSync(old, { recursive: true, force: true }); rmSync(fresh, { recursive: true, force: true });
  });
  it("points out 0.2.x files left at the .project-management/ root, without deleting them", () => {
    writeFileSync(join(dir, ".project-management", "check-plans.mjs"), "// 0.2.x copy");
    const r = run(["init", "--dir", dir]);
    assert.match(r.stdout, /0\.2\.x files at \.project-management\/ root: check-plans\.mjs/);
    assert.ok(existsSync(join(dir, ".project-management", "check-plans.mjs")), "never deletes");
    rmSync(join(dir, ".project-management", "check-plans.mjs"));
  });
});

describe("planrails check", () => {
  it("passes a good plan and fails a done task with no evidence; --root is an alias of --dir", () => {
    const plans = join(dir, ".project-management", "plans", "x");
    mkdirSync(plans, { recursive: true });
    const table = (ev) => `status: active\n\n## NOW\nRESUME: T2\n\n## Tasks\n\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n| T1 | x | done | \`npm test\` | ${ev} |\n| T2 | y | todo | \`npm test\` | |\n`;
    writeFileSync(join(dir, "CLAUDE.md"), "# P\n\n@.project-management/plans/keep-me/PLAN.md\n@.project-management/plans/x/PLAN.md\n");
    writeFileSync(join(plans, "PLAN.md"), table("2026-09-12 exit 0"));
    assert.equal(run(["check", "--dir", dir]).status, 0, run(["check", "--dir", dir]).stderr);
    assert.equal(run(["check", "--root", dir]).status, 0);
    writeFileSync(join(plans, "PLAN.md"), table(""));
    const bad = run(["check", "--dir", dir]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /evidence cell is empty/);
  });
  it("prints the checker's notes, keeps exit 0 and the ok line last (0.6.0)", () => {
    const root = mkdtempSync(join(tmpdir(), "planrails-notes-cli-"));
    try {
      mkdirSync(join(root, ".project-management", "plans", "big"), { recursive: true });
      writeFileSync(join(root, ".project-management", "plans", "big", "PLAN.md"), `status: active\n\n## NOW\nRESUME: T1\n\n## Tasks\n\n| id | task | status | proof | evidence |\n|--|--|--|--|--|\n| T1 | x | todo | \`npm test\` | |\n\n${"word ".repeat(3001)}\n`);
      const r = run(["check", "--dir", root]);
      assert.equal(r.status, 0, r.stderr);
      const lines = r.stdout.trim().split(/\r?\n/);
      assert.match(lines[0], /^check-plans: note: big: PLAN\.md is 3,0\d\d words/);
      assert.match(lines.at(-1), /^check-plans: 1 plan\(s\) ok/);
      const copied = spawnSync(process.execPath, [join(REPO, "tools", "check-plans.mjs"), "--root", root], { encoding: "utf8" });
      assert.equal(r.stdout, copied.stdout, "the same stdout as the copied checker");
    } finally { rmSync(root, { recursive: true, force: true }); }
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
  it("runs when invoked through a symlink, the way npm's bin link invokes it", { skip: process.platform === "win32" ? "symlinks need privileges on Windows" : false }, () => {
    const link = join(dir, "planrails-link.mjs");
    symlinkSync(BIN, link);
    const r = spawnSync(process.execPath, [link, "--version"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/, "the CLI must run through a symlink");
  });
});
