import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BIN = join(ROOT, "bin", "planrails.mjs");
export const box = (prefix = "planrails-test-") => mkdtempSync(join(tmpdir(), prefix));
const envFor = (root) => { const e = { ...process.env, PLAN_PROJECT_ROOT: root }; delete e.CLAUDE_PROJECT_DIR; return e; };
/** Run the CLI against a throwaway project root; throws on non-zero exit. */
export const plan = (root, ...args) => execFileSync("node", [BIN, ...args], { cwd: ROOT, env: envFor(root), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
/** Run the CLI and return { status, out } whatever the exit code. */
export const planTry = (root, ...args) => { const r = spawnSync("node", [BIN, ...args], { cwd: ROOT, env: envFor(root), encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
