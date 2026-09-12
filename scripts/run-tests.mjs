#!/usr/bin/env node
/**
 * Run every test/*.test.mjs with the built-in node:test runner.
 *
 * Why a script and not `node --test "test/**"`: Node 20 takes FILE PATHS only
 * (the glob printed "Could not find 'test/**\/*.test.mjs'" and failed CI on
 * both Node 20 jobs, 2026-09-12); Node 21+ takes GLOB PATTERNS, so a bare
 * directory argument fails there ("Cannot find module …/test"). Listing the
 * files here works on every version and a new test file cannot be missed.
 */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "test");
const files = readdirSync(dir).filter((f) => f.endsWith(".test.mjs")).sort().map((f) => join(dir, f));
if (!files.length) { process.stderr.write(`no *.test.mjs files under ${dir}\n`); process.exit(1); }
const r = spawnSync(process.execPath, ["--test", ...files, ...process.argv.slice(2)], { stdio: "inherit", cwd: root });
process.exit(r.status ?? 1);
