/**
 * Path and tool matching for rules.
 *
 * Own glob matcher, on purpose: Node's path.matchesGlob follows shell rules and
 * `**` does not cross a dot-directory, so `**\/ch*.json` never matched
 * `.tmp/witness-full/x/ch01.json` (found in review, 2026-09-12). Here `**`
 * crosses everything; `*` and `?` stay inside one segment; `{a,b}` alternates.
 * Globs are repo-relative. A tool's file_path arrives absolute or relative to
 * the session's cwd; we make it relative to the project root and refuse to
 * match anything outside the project.
 */
import { isAbsolute, relative, resolve, sep } from "node:path";

const cache = new Map();
export function globToRegExp(glob) {
  if (cache.has(glob)) return cache.get(glob);
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end === -1) { re += "\\{"; continue; }
      re += "(?:" + glob.slice(i + 1, end).split(",").map((s) => s.replace(/[.+^$()|[\]\\]/g, "\\$&")).join("|") + ")";
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  const out = new RegExp("^" + re + "$");
  cache.set(glob, out);
  return out;
}

export function toRepoRelative(filePath, root, cwd = null) {
  if (!filePath) return null;
  const abs = isAbsolute(String(filePath)) ? String(filePath) : resolve(cwd || root, String(filePath));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel.split(sep).join("/");
}

export function pathMatches(relPath, glob) {
  if (!relPath) return false;
  return globToRegExp(glob).test(relPath);
}

export function anyPathMatches(relPath, globs) {
  return (globs || []).some((g) => pathMatches(relPath, g));
}

/** `tool` in a rule is a regex over tool names, anchored: "Edit|Write" matches exactly those. */
export function toolMatches(toolName, toolPattern) {
  try { return new RegExp(`^(?:${toolPattern})$`).test(toolName); } catch { return false; }
}

function safeTest(pattern, text) {
  try { return new RegExp(pattern, "i").test(text || ""); } catch { return false; }
}

/**
 * Does this rule fire for this tool call? Every clause in `when` must hold.
 * Returns false for tools the rule does not name, so a path-only rule never
 * fires on Bash and a command-only rule never fires on Edit.
 */
export function ruleMatches(rule, { toolName, toolInput, root, cwd = null }) {
  const w = rule.when;
  if (!toolMatches(toolName, w.tool)) return false;
  const ti = toolInput || {};
  if (w.path) {
    const rel = toRepoRelative(ti.file_path || ti.notebook_path || "", root, cwd);
    if (!pathMatches(rel, w.path)) return false;
  }
  if (w.command && !safeTest(w.command, ti.command)) return false;
  if (w.prompt && !safeTest(w.prompt, [ti.prompt, ti.script, ti.description, ti.skill, ti.args].filter(Boolean).join("\n"))) return false;
  return true;
}
