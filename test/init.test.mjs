/** `planrails init` on an empty directory and on an existing project: idempotent, additive, reversible. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { box, BIN, ROOT } from "./_helpers.mjs";

const run = (root, ...args) => execFileSync("node", [BIN, ...args, "--dir", root], { cwd: root, env: { ...process.env, PLAN_PROJECT_ROOT: undefined, CLAUDE_PROJECT_DIR: undefined }, encoding: "utf8" });
const snapshot = (root) => { const files = ["package.json", "CLAUDE.md", ".gitignore", ".claude/settings.json", ".claude/skills/plan/SKILL.md", "docs/PLANNING_GUIDE.md"]; return files.map((f) => `${f}:${existsSync(join(root, f)) ? createHash("sha1").update(readFileSync(join(root, f))).digest("hex") : "-"}`).join("\n"); };

describe("planrails init", () => {
  it("sets an EMPTY directory up, and a second run changes nothing", () => {
    const root = box("planrails-init-new-");
    const out = run(root, "init", "--no-install");
    for (const f of ["package.json", "CLAUDE.md", ".gitignore", ".claude/settings.json", ".claude/skills/plan/SKILL.md", "docs/PLANNING_GUIDE.md", ".project-management/plans/.gitkeep"]) assert.ok(existsSync(join(root, f)), `init should create ${f}`);
    const settings = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8"));
    for (const ev of ["SessionStart", "PreToolUse", "SubagentStart", "Stop", "PreCompact", "PostCompact"]) assert.ok(settings.hooks[ev], `hook event ${ev} installed`);
    assert.ok(!JSON.stringify(settings).includes("guard-never-delete"), "the never-delete guard is opt-in");
    const md = readFileSync(join(root, "CLAUDE.md"), "utf8");
    assert.ok(md.includes("## Project management") && md.includes("<!-- plans:begin") && md.indexOf("plans:begin") < md.indexOf("## Project management"));
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(pkg.scripts.plan, "planrails");
    assert.ok(readFileSync(join(root, ".gitignore"), "utf8").includes(".planrails/"));
    assert.match(out, /doctor: healthy/);
    const before = snapshot(root);
    const again = run(root, "init", "--no-install");
    assert.equal(snapshot(root), before, "a second init must change no file");
    assert.ok(!again.includes("  + "), `a second init reports nothing added:\n${again}`);
    assert.match(execFileSync("node", [BIN, "doctor", "--dir", root], { cwd: root, env: { ...process.env, PLAN_PROJECT_ROOT: root }, encoding: "utf8" }), /healthy/);
  });

  it("adds to an EXISTING project without touching what is there: foreign hooks, CLAUDE.md text, check script, gitignore", () => {
    const root = box("planrails-init-existing-");
    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "existing", version: "1.2.3", scripts: { check: "tsc --noEmit", test: "vitest" } }, null, 2));
    writeFileSync(join(root, "CLAUDE.md"), "# Existing project\n\nKeep this.\n\n## Commands\n\n- npm test\n");
    writeFileSync(join(root, ".gitignore"), "node_modules/\n");
    writeFileSync(join(root, ".claude/settings.json"), JSON.stringify({ permissions: { allow: ["Bash(npm test)"] }, hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node /theirs/lint-guard.mjs" }] }] } }, null, 2));
    run(root, "init", "--no-install", "--with-never-delete");
    const settings = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8"));
    assert.deepEqual(settings.permissions, { allow: ["Bash(npm test)"] }, "other settings survive");
    const cmds = JSON.stringify(settings.hooks);
    assert.ok(cmds.includes("/theirs/lint-guard.mjs"), "a foreign hook survives");
    assert.ok(cmds.includes("guard-never-delete.sh"), "the guard was asked for");
    const md = readFileSync(join(root, "CLAUDE.md"), "utf8");
    assert.ok(md.startsWith("# Existing project\n\nKeep this.") && md.includes("## Commands") && md.includes("## Project management") && md.includes("plans:begin"));
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(pkg.version, "1.2.3");
    assert.equal(pkg.scripts.test, "vitest");
    assert.equal(pkg.scripts.check, "tsc --noEmit && planrails validate --all --quiet");
    assert.equal(readFileSync(join(root, ".gitignore"), "utf8"), "node_modules/\n.planrails/\n");
    // uninstall removes the hooks and the skill only
    run(root, "uninstall");
    const after = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8"));
    assert.ok(JSON.stringify(after.hooks).includes("/theirs/lint-guard.mjs") && !JSON.stringify(after.hooks).includes("planrails"));
    assert.ok(!existsSync(join(root, ".claude/skills/plan/SKILL.md")));
    assert.ok(existsSync(join(root, "docs/PLANNING_GUIDE.md")) && existsSync(join(root, ".project-management/plans")));
  });

  it("--dry-run writes nothing", () => {
    const root = box("planrails-init-dry-");
    const out = run(root, "init", "--dry-run", "--no-install");
    assert.match(out, /dry run/);
    assert.deepEqual(readdirSync(root), []);
  });

  it("the package's own copy of the guide is what init installs", () => {
    const root = box("planrails-init-guide-");
    run(root, "init", "--no-install");
    assert.equal(readFileSync(join(root, "docs/PLANNING_GUIDE.md"), "utf8"), readFileSync(join(ROOT, "docs/PLANNING_GUIDE.md"), "utf8"));
  });
});
