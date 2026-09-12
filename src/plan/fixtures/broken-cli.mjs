#!/usr/bin/env node
/**
 * Builds a deliberately BROKEN copy of the plan CLI at .tmp/broken-cli/: the validator no
 * longer refuses a task that cites a gate run which never happened. Gate G3's known-fail
 * case runs the vitest suite against this copy (PLAN_CLI=.tmp/broken-cli/plan.mjs) and the
 * suite must FAIL — that is what proves the suite can see a validator regression, instead of
 * "vitest exits 1 on a missing file", which proved nothing about the gate.
 * Refuses to build if the line it removes is not found (the fixture would then test nothing).
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(src, "..", "..");
const out = join(root, ".tmp", "broken-cli");
mkdirSync(out, { recursive: true });
for (const f of ["plan.mjs", "run.mjs"]) cpSync(join(src, f), join(out, f));
cpSync(join(src, "lib"), join(out, "lib"), { recursive: true });
cpSync(join(src, "skill"), join(out, "skill"), { recursive: true });
const storePath = join(out, "lib", "store.mjs");
let store = readFileSync(storePath, "utf8");
const anchor = "if (!run) E(`${t.id} cites gate run ${t.evidence.runId}, but gate-runs.jsonl has no passing run with that id`);";
if (!store.includes(anchor)) { console.error("broken-cli: the refusal this fixture removes was not found in store.mjs — update the fixture"); process.exit(3); }
store = store.replace(anchor, "if (!run) { /* BROKEN ON PURPOSE: a fabricated run is accepted */ }");
writeFileSync(storePath, store);
if (!existsSync(join(out, "plan.mjs"))) process.exit(3);
console.log(`broken CLI built at ${out} (validator accepts a fabricated gate run)`);
