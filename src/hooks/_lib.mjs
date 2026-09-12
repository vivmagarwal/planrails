/**
 * Shared bits for the plan-system hooks. Hooks run on every tool call, so
 * everything here is small and synchronous, and NOTHING here may throw out —
 * a hook that crashes blocks the tool call it was meant to inform.
 */
import { readFileSync, mkdirSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { hookStateRoot } from "../plan/lib/paths.mjs";

export function readInput() {
  try { return JSON.parse(readFileSync(0, "utf8")); } catch { return {}; }
}
export function sid(input) { return String(input.session_id || "unknown").replace(/[^A-Za-z0-9_-]/g, "") || "unknown"; }
export function sessionDir(input) {
  const d = join(hookStateRoot(), sid(input));
  try { mkdirSync(d, { recursive: true }); } catch { /* best effort */ }
  return d;
}
export function readJsonSafe(path, fallback) {
  try { return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback; } catch { return fallback; }
}
export function writeJsonSafe(path, obj) {
  try { writeFileSync(path, JSON.stringify(obj)); } catch { /* best effort */ }
}
export function appendSafe(path, line) {
  try { appendFileSync(path, line + "\n"); } catch { /* best effort */ }
}
export function emit(obj) { process.stdout.write(JSON.stringify(obj)); }
/** Add text to Claude's context without blocking anything. Measured to work on 2.1.269 for SessionStart and PreToolUse. */
export function addContext(eventName, text) {
  emit({ hookSpecificOutput: { hookEventName: eventName, additionalContext: text }, suppressOutput: true });
}
