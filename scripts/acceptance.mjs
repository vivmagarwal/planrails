#!/usr/bin/env node
/**
 * REALITY GATE — does the plan brief actually reach the model?
 *
 * Every other test of the hooks checks their OUTPUT. This one checks the
 * model's INPUT: it runs a real `claude -p` session from the project root,
 * with no tools, and asks it to quote the RESUME line of every plan brief it
 * was given. The RESUME line comes only from the SessionStart injection — it is
 * not in CLAUDE.md, and with tools disabled it cannot be read off disk — so a
 * correct quote proves the injection happened.
 *
 *   node scripts/acceptance.mjs              # PASS when every active plan's RESUME is quoted
 *   node scripts/acceptance.mjs --no-hooks   # the known-fail case: hooks off → NONE → exit 1
 *
 * Costs one small model call (haiku by default; PLAN_ACCEPT_MODEL overrides).
 * Re-run after any Claude Code upgrade: the injection contract was measured on
 * 2.1.269 (2026-09-12), and nothing else here would notice it changing.
 */
import { spawnSync } from "node:child_process";
import { projectRoot } from "../src/plan/lib/paths.mjs";
import { activePlanIds, loadPlan } from "../src/plan/lib/store.mjs";
import { renderBrief } from "../src/plan/lib/brief.mjs";

const noHooks = process.argv.includes("--no-hooks");
const ids = activePlanIds();
if (!ids.length) { console.log("acceptance: no active plans — nothing to check"); process.exit(2); }

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const expected = ids.map((id) => {
  const line = renderBrief(loadPlan(id)).split("\n").find((l) => l.startsWith("RESUME: ")) || "";
  return { id, key: norm(line.slice(8)).split(" ").slice(0, 6).join(" ") };
});

const prompt =
  "Your context may contain one or more plan briefs injected at session start, each headed '## Plan <id> — …' with a line beginning 'RESUME:'. " +
  "For each such brief, output one line: the plan id, a colon, then the RESUME line quoted verbatim. Do not use any tools. Do not read files. " +
  "If your context contains no such brief, output exactly: NONE";
const args = ["-p", prompt, "--output-format", "text", "--model", process.env.PLAN_ACCEPT_MODEL || "haiku", "--tools", ""];
if (noHooks) args.push("--settings", JSON.stringify({ disableAllHooks: true }));

const r = spawnSync("claude", args, { cwd: projectRoot(), encoding: "utf8", timeout: 240_000 });
const reply = (r.stdout || "").trim();
console.log(`reply (${noHooks ? "hooks OFF" : "hooks on"}): ${reply.replace(/\s+/g, " ").slice(0, 400)}`);
// Exit 3 for a broken claude invocation, so a usage error can never pass as the known-fail case (which expects exit 1).
if (r.status !== 0) { console.log(`claude exited ${r.status}: ${(r.stderr || "").slice(0, 300)}`); process.exit(3); }
const got = norm(reply);
const missing = expected.filter((e) => !e.key || !got.includes(e.key));
if (missing.length) { console.log(`acceptance: FAIL — RESUME not quoted for ${missing.map((m) => m.id).join(", ")} (expected to see: ${missing.map((m) => `"${m.key}"`).join("; ")})`); process.exit(1); }
console.log(`acceptance: PASS — the model quoted the RESUME line of ${ids.join(", ")}`);
