/**
 * Hook commands must name the PROJECT's copy of the package whenever it has one,
 * whichever copy runs the installer. 0.1.0 compared the running copy with the
 * project's, so `npx planrails init` on a project that did not yet hold the
 * package (the documented first step) wrote the npx cache's absolute path into
 * every hook: machine-local, and evicted by npm. A symlink would not reproduce
 * it (realpath equality held), so the project here gets a real COPY.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { box, BIN, ROOT } from "./_helpers.mjs";

const envFor = (root) => { const e = { ...process.env, PLAN_PROJECT_ROOT: root }; delete e.CLAUDE_PROJECT_DIR; return e; };
const commandsIn = (root) => Object.values(JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8")).hooks).flat().flatMap((e) => e.hooks.map((h) => h.command));

describe("hook paths", () => {
  it("name $CLAUDE_PROJECT_DIR/node_modules/planrails when the project holds a COPY of the package, even when another copy runs the installer", () => {
    const root = box("planrails-hookpath-");
    const local = join(root, "node_modules", "planrails");
    mkdirSync(local, { recursive: true });
    for (const f of ["package.json", "bin", "src"]) cpSync(join(ROOT, f), join(local, f), { recursive: true });
    writeFileSync(join(root, "CLAUDE.md"), "# t\n\n## Project management\n");
    execFileSync("node", [BIN, "hooks", "install"], { cwd: ROOT, env: envFor(root), encoding: "utf8" });
    const commands = commandsIn(root);
    assert.ok(commands.length >= 6, `expected the six managed hooks, got ${commands.length}`);
    for (const c of commands) assert.match(c, /^node "\$CLAUDE_PROJECT_DIR\/node_modules\/planrails\/src\/hooks\/[a-z-]+\.mjs"$/, c);
    const status = execFileSync("node", [BIN, "hooks", "status"], { cwd: ROOT, env: { ...envFor(root), CLAUDE_PROJECT_DIR: root }, encoding: "utf8" });
    assert.ok(!/FAIL/.test(status), status);
  });

  it("fall back to the running copy's absolute path when the project has no copy of its own, and say so", () => {
    const root = box("planrails-hookpath-abs-");
    writeFileSync(join(root, "CLAUDE.md"), "# t\n\n## Project management\n");
    const out = execFileSync("node", [BIN, "hooks", "install"], { cwd: ROOT, env: envFor(root), encoding: "utf8" });
    for (const c of commandsIn(root)) assert.ok(c.includes(join(ROOT, "src", "hooks")), c);
    assert.match(out, /only works on this machine/);
  });
});
