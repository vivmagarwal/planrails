#!/usr/bin/env node
/**
 * Builds a TAMPERED copy of a black-box trial's snapshots at .tmp/broken-trial/: every task
 * that run 2 closed is rewritten as closed BY HAND (manual evidence, no gate run). Gate G7's
 * known-fail case runs trial/check.mjs on that copy, and it must FAIL — proving the trial
 * verdict cannot be passed by a run that never let a gate decide anything.
 *   node node_modules/planrails/src/plan/fixtures/broken-trial.mjs <trial-dir>
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const trial = process.argv[2];
if (!trial || !existsSync(join(trial, ".tmp", "trial", "snapshot-after-run2.json"))) { console.error("broken-trial: need a trial dir that has run (snapshot-after-run2.json missing)"); process.exit(3); }
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const out = join(root, ".tmp", "broken-trial");
mkdirSync(join(out, ".tmp"), { recursive: true });
cpSync(join(trial, ".tmp", "trial"), join(out, ".tmp", "trial"), { recursive: true });
let tampered = 0;
for (const f of ["snapshot-after-run2.json", "snapshot-after-run3.json"]) {
  const p = join(out, ".tmp", "trial", f); const snap = JSON.parse(readFileSync(p, "utf8"));
  for (const plan of Object.values(snap.plans)) { for (const t of plan.tasks) if (t.status === "done" && t.evidence?.kind === "gate") { t.evidence = { kind: "manual", by: "agent", at: t.evidence.at, reason: "TAMPERED: closed by hand, no gate ran" }; tampered++; } plan.gateRuns = 0; }
  writeFileSync(p, JSON.stringify(snap, null, 2));
}
if (!tampered) { console.error("broken-trial: no gate-closed task to tamper with — the fixture would test nothing"); process.exit(3); }
console.log(`tampered trial built at ${out} (${tampered} gate closes rewritten as manual)`);
