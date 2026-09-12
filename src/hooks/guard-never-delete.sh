#!/usr/bin/env bash
# PreToolUse(Bash) — the optional never-delete guard (npx planrails hooks install --with-never-delete).
# Why: a delete command needs a person to approve it, which turns an unattended run into a stall,
# and a mistaken delete of ungitted work cannot be undone. Moving aside is always reversible.
# Uses jq (~8ms) rather than node (~20ms) because this fires on every Bash call.
# Turn it off with: npx planrails hooks install (without the flag) after removing it, or delete
# the PreToolUse/Bash entry from .claude/settings.json.

cmd=$(jq -r '.tool_input.command // ""' 2>/dev/null)
[ -z "$cmd" ] && exit 0

# A leading word boundary that is start-of-string, whitespace, or a shell separator.
# Deliberately does NOT match "--rm" (docker), "npm", "charm", "./rm" — the char
# before the word must be a real separator.
if printf '%s' "$cmd" | grep -qE '(^|[;&|(`]|[[:space:]])(rm|rmdir|unlink|shred)([[:space:]]|$)'; then
  trash=".planrails/trash/<what>-$(date +%Y-%m-%d)"
  jq -n --arg t "$trash" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: (
        "BLOCKED by the never-delete guard (planrails).\n\n" +
        "A delete needs a person to approve it, which stalls an unattended run; and a mistaken delete of work that is not in git cannot be undone. Move it aside instead:\n  mkdir -p " + $t + " && mv <path> " + $t + "/\n\n" +
        "Name the reason in the directory name. Emptying the trash is a person'\''s deliberate act, never a step in a flow."
      )
    }
  }'
fi
exit 0
