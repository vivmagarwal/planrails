#!/usr/bin/env node
// PostCompact — closes the loop opened by precompact-journal.mjs.
//
// Compaction has just discarded every tool result. This injects the path of the
// journal that was written a moment earlier, so the next turn re-reads what was
// already done instead of doing it again.
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { journalRoot, projectRoot } from "../plan/lib/paths.mjs";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }

const sid = String(input.session_id || "").replace(/[^A-Za-z0-9_-]/g, "");
if (!sid) process.exit(0);

const path = join(journalRoot(), `${sid}.md`);
if (!existsSync(path)) process.exit(0);

let kb = 0;
try { kb = Math.round(statSync(path).size / 1024); } catch { /* ignore */ }
const rel = relative(projectRoot(), path);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostCompact",
    additionalContext:
      `A progress journal for this session exists at ${rel} (${kb} KB). ` +
      `The compaction you just went through discarded every tool result, so your record of what ` +
      `was already done is in that file, not in this context. Read its most recent section before ` +
      `resuming — especially the files already written and the commands already run — so you do not repeat work.`,
  },
  suppressOutput: true,
}));
process.exit(0);
