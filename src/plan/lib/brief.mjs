/**
 * The brief: what a fresh session (or one that just compacted) needs to know
 * about a plan, in about a thousand tokens. Rendered from the files every
 * time — never stored, so it cannot go stale.
 *
 * It answers, in order: what is this · where does it stand · what do I do
 * NOW · what happened last · what is unverified · which rules apply · how to
 * record. Everything else is a pointer into PLAN.md.
 */
import { lastRunFor, verifiedFor, taskCounts } from "./store.mjs";
import { shortStamp } from "./time.mjs";
import { pathMatches } from "./glob.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JUDGMENT_SHORT } from "./judgment.mjs";

const CAP = Number(process.env.PLAN_BRIEF_CAP || 6000);

/** First paragraph under a "## Heading" in PLAN.md, or "". */
export function sectionOf(md, heading) {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, "mi");
  const m = re.exec(md);
  if (!m) return "";
  const rest = md.slice(m.index + m[0].length);
  const end = rest.search(/^##\s+/m);
  return (end === -1 ? rest : rest.slice(0, end)).replace(/<!--[\s\S]*?-->/g, "").trim();
}
function firstParagraph(text, max = 420) {
  const p = text.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() || "";
  return p.length > max ? p.slice(0, max - 1) + "…" : p;
}
function clip(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

/**
 * The AGENT BRIEF: what a subagent gets instead of the plan. Measured reason
 * (CLAUDE.md § TOKEN DISCIPLINE): a subagent's fixed prompt is re-read on every
 * turn, so it carries the task, its files, the rules for those files, what
 * "done" means, where to write its report, and what it must never do — and
 * nothing else. The hook re-injects the same rules at the tool call, per agent.
 */
export function renderAgentBrief(plan, task, { unit = null, label = null, cli = "npx planrails" } = {}) {
  const { state } = plan;
  const gate = task.gate ? plan.gates.gates.find((g) => g.id === task.gate) : null;
  const rules = (plan.rules?.rules || []).filter((r) => r.when.path && task.files.some((f) => pathMatches(f, r.when.path)));
  const ruleText = (r) => { if (r.text) return r.text; try { return readFileSync(join(plan.dir, r.file), "utf8").trim(); } catch { return `(rule ${r.id}: ${r.file} unreadable)`; } };
  const reportName = `${task.id}-${(label || unit || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "report"}.md`;
  const reportPath = `${plan.dir.replace(/.*\/(\.project-management\/)/, "$1")}/reports/${reportName}`;
  const out = [];
  out.push(`AGENT BRIEF — plan ${state.id}, task ${task.id}: ${clip(task.title, 160)}`);
  out.push("You are a subagent. This brief is your whole memory of the plan; the main session owns the plan and closes tasks.");
  out.push(`DO: ${clip(unit || task.title, 400)}${task.effort ? ` · think at effort ${task.effort}` : ""}`);
  out.push(`FILES YOU MAY WRITE: ${task.files.length ? task.files.join(", ") : "(none declared — write only under the paths the main session names)"} — nothing else.`);
  if (task.notes) out.push(`NOTES FROM THE PLAN: ${clip(task.notes, 300)}`);
  out.push(`DONE MEANS (the main session checks this, not you): ${gate ? `${gate.id} — ${clip(gate.question, 200)} — $ ${gate.command}` : clip(task.manualCheck || "(not stated)", 200)}`);
  out.push(`REPORT: write ${reportPath} — what you wrote (paths); every number WITH its locator (file:line, page, verse); every doubt; what you did NOT do. Then return at most 10 lines that name that file. A report that lives only in your reply dies with you.`);
  out.push(`NEVER: delete anything (move it aside instead); write outside the files above; run \`${cli} task done\` or \`close\`; settle a doubt by guessing — write it in the report; skip work already on disk without saying so.`);
  // Rules last and clipped per rule: truncation, if it ever happens, cuts guidance, never the contract above.
  for (const r of rules.slice(0, 3)) out.push(`RULE ${r.id} FOR THESE FILES: ${clip(ruleText(r), 600)}`);
  const planRules = sectionOf(plan.planMd, "Rules for this plan").split("\n").filter((l) => l.trim()).slice(0, 4);
  if (planRules.length) out.push(`PLAN RULES (first lines of PLAN.md § Rules): ${planRules.map((l) => clip(l, 140)).join(" ")}`);
  let text = out.join("\n");
  if (text.length > 3000) text = text.slice(0, 2960) + "\n…(guidance truncated at 3000 chars; the contract above is complete)";
  return text;
}

export function renderBrief(plan, { cli = "npx planrails" } = {}) {
  const { state, gates } = plan;
  const c = taskCounts(state);
  const doing = state.tasks.filter((t) => t.status === "doing");
  const blocked = state.tasks.filter((t) => t.status === "blocked");
  const todo = state.tasks.filter((t) => t.status === "todo");
  const last = plan.log.at(-1);
  const gateLine = (gid) => {
    if (!gid) return "manual check";
    const g = gates.gates.find((x) => x.id === gid);
    const r = lastRunFor(plan, gid);
    const v = g?.knownFail ? (verifiedFor(plan, gid) ? "" : " · never verified against its knownFail") : "";
    return `${gid}${r ? ` (last ${r.result.toUpperCase()} ${shortStamp(r.at)})` : " (never run)"}${v}`;
  };
  const out = [];
  out.push(`## Plan ${state.id} — ${state.title}`);
  out.push(`${state.status} · ${c.done}/${state.tasks.length} tasks done · ${c.doing} doing · ${c.blocked} blocked · last log ${last ? shortStamp(last.at) : "never"}`);
  const why = firstParagraph(sectionOf(plan.planMd, "Why"));
  if (why) out.push(`WHY: ${why}`);
  if (last) {
    out.push(`RESUME: ${clip(last.next, 400)}`);
    if (last.uncommitted) out.push(`UNCOMMITTED: ${clip(last.uncommitted, 200)}`);
  } else out.push(`RESUME: no log entry yet — read PLAN.md § Method, start the first task with: ${cli} task start ${state.id} ${todo[0]?.id || "T1"}`);
  for (const t of doing) out.push(`NOW ${t.id}: ${clip(t.title, 120)} — proves done by ${gateLine(t.gate)}${t.effort ? ` · effort ${t.effort}` : ""}`);
  for (const t of blocked) out.push(`BLOCKED ${t.id}: ${clip(t.title, 80)} — ${clip(t.blocked?.reason, 160)} (needs ${t.blocked?.needs})`);
  if (todo.length) out.push(`NEXT: ${todo.slice(0, 3).map((t) => `${t.id} ${clip(t.title, 70)}`).join(" · ")}${todo.length > 3 ? ` · +${todo.length - 3} more` : ""}`);
  const recent = plan.log.slice(-3).reverse();
  if (recent.length) {
    out.push("LAST LOG:");
    for (const e of recent) out.push(`- ${shortStamp(e.at)}${e.task ? ` [${e.task}]` : ""} ${clip(e.what, 220)}`);
  }
  const leads = plan.learnings.filter((l) => l.status === "lead");
  if (leads.length) {
    out.push(`LEADS (need a second reader before anyone acts on them):`);
    for (const l of leads.slice(-4)) out.push(`- ${l.id}: ${clip(l.what, 160)}`);
  }
  const rules = sectionOf(plan.planMd, "Rules for this plan");
  if (rules) {
    const lines = rules.split("\n").filter((l) => l.trim()).slice(0, 14);
    out.push("RULES FOR THIS PLAN (full text: PLAN.md § Rules for this plan):");
    for (const l of lines) out.push(clip(l, 240));
  }
  const owner = sectionOf(plan.planMd, "Owner decides");
  if (owner) out.push(`OWNER DECIDES (stop and ask before each): ${clip(owner.split("\n").map((l) => l.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean).join(" · "), 300)}`);
  out.push(JUDGMENT_SHORT);
  out.push(`RECORD AS YOU GO: ${cli} log ${state.id} --task <T> --what "…" --next "…"  ·  learn / decide / task done <T> (runs the gate)`);
  out.push(`FULL METHOD: ${plan.dir.replace(/.*\/(\.project-management\/)/, "$1")}/PLAN.md`);
  let text = out.join("\n");
  if (text.length > CAP) text = text.slice(0, CAP - 40) + `\n…(brief truncated at ${CAP} chars; open PLAN.md)`;
  return text;
}
