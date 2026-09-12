#!/usr/bin/env node
/**
 * SubagentStart — the do-nots every subagent must carry, as a rail.
 *
 * Measured 2026-09-12 (scratchpad hooktest, Claude Code 2.1.269): a SubagentStart
 * hook's additionalContext reaches the SUBAGENT and not the main thread; the
 * payload carries agent_id, agent_type and the PARENT's session_id. So this is
 * the one place a note can be put in front of every subagent without the main
 * session remembering to write it into every prompt.
 *
 * It stays short (< 700 chars): a subagent's fixed prompt is re-read every turn
 * (CLAUDE.md § TOKEN DISCIPLINE). The task-specific brief comes from the main
 * session (`plan agent-brief <id> <T>`); the rules for a file arrive from
 * plan-pre-tool.mjs at the tool call. Silent when no plan is active.
 */
import { readInput, addContext } from "./_lib.mjs";
import { activePlanIds } from "../plan/lib/store.mjs";

const input = readInput();
let ids = [];
try { ids = activePlanIds(); } catch { ids = []; }
if (!ids.length) process.exit(0);
const reports = ids.map((id) => `.project-management/plans/${id}/reports/`).join(" or ");
addContext("SubagentStart",
  `SUBAGENT NOTE (plan system; active plan${ids.length > 1 ? "s" : ""}: ${ids.join(", ")}). Your prompt is your whole memory of the plan; the main session owns it. ` +
  `Write only the files your prompt names. Put your findings in a report file under ${reports} (every number WITH its locator: file:line, page, verse) and name it in your reply — a finding that lives only in your reply is lost. ` +
  `Never delete (move it aside instead), never run \`plan task done\` or \`plan close\`, never settle a doubt by guessing: write the doubt down. Rules for a file arrive when you touch it; follow them.`);
