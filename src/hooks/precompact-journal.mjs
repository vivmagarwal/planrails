#!/usr/bin/env node
// PreCompact — writes what this stretch of work actually DID to disk, before
// compaction throws it away.
//
// Why this exists. Compaction keeps the user's messages and discards every tool
// result. Project instructions (CLAUDE.md) survive, because they are rebuilt each
// request; what is lost is progress state: which files were written, which
// commands and gates were run, which searches came back empty. That is the real
// cause of re-doing work after a compaction. This hook writes that record to
// .planrails/journal/<session>.md, and postcompact-journal.mjs hands the path back.
//
// Reads only the TAIL of the transcript (it can be hundreds of MB). That is
// correct, not a shortcut: this hook runs at EVERY compaction, so earlier
// stretches were already journaled by earlier runs.

import { openSync, fstatSync, readSync, closeSync, mkdirSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { projectRoot, journalRoot } from "../plan/lib/paths.mjs";
const TAIL_BYTES = 12 * 1024 * 1024;
const PROJECT = projectRoot();
const OUT_DIR = journalRoot();

function readTail(path, bytes) {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const len = size - start;
    const buf = Buffer.allocUnsafe(len);
    readSync(fd, buf, 0, len, start);
    const text = buf.toString("utf8");
    return start > 0 ? text.slice(text.indexOf("\n") + 1) : text;
  } finally {
    closeSync(fd);
  }
}

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }

const transcript = String(input.transcript_path || "");
const sid = String(input.session_id || "unknown").replace(/[^A-Za-z0-9_-]/g, "");
const trigger = String(input.trigger || input.matcher || "auto");

if (!transcript || !existsSync(transcript)) process.exit(0);

let lines = [];
try { lines = readTail(transcript, TAIL_BYTES).split("\n"); } catch { process.exit(0); }

const wrote = new Set();      // files created or edited
const ran = [];               // gates, scripts, commits
const readNonImage = new Set();
let images = 0;
let lastUser = "";
let sinceBoundary = false;

// Walk backwards to the most recent compaction boundary, then forward from there.
let startIdx = 0;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes("compact_boundary") || lines[i].includes('"isCompactSummary":true')) { startIdx = i; break; }
}

for (let i = startIdx; i < lines.length; i++) {
  const raw = lines[i];
  if (!raw) continue;
  let d;
  try { d = JSON.parse(raw); } catch { continue; }
  sinceBoundary = true;
  const m = d.message || {};
  // Real user intent only — skip slash-command echoes and local-command stdout,
  // which are shaped like user messages but say nothing about the work.
  if (m.role === "user" && typeof m.content === "string" && !d.isMeta &&
      !/^\s*<(local-command|command-name|command-message|command-args)/.test(m.content)) {
    lastUser = m.content.slice(0, 400);
  }
  const c = m.content;
  if (!Array.isArray(c)) continue;
  for (const b of c) {
    if (!b || b.type !== "tool_use") continue;
    const i_ = b.input || {};
    if (b.name === "Write" || b.name === "Edit" || b.name === "NotebookEdit") {
      const f = String(i_.file_path || "");
      if (f) wrote.add(f.replace(PROJECT + "/", ""));
    } else if (b.name === "Read") {
      const f = String(i_.file_path || "");
      if (/\.(png|jpe?g|webp|tiff?|gif)$/i.test(f)) images++;
      else if (f) readNonImage.add(f.replace(PROJECT + "/", ""));
    } else if (b.name === "Bash") {
      // Match the FIRST LINE only. A heredoc body often quotes "npm run …" inside
      // prose, which made the journal record documents as if they were commands.
      const first = String(i_.command || "").split("\n")[0].replace(/\s+/g, " ").trim();
      if (/(^|\s|&&|;)(node |npm |npx |pnpm |yarn |git commit|git push|make |cargo |go |python)/.test(first)) {
        ran.push(first.slice(0, 160));
      }
    }
  }
}

if (!sinceBoundary) process.exit(0);

const stamp = new Date().toISOString();
const out = [];
out.push(`\n## ${stamp} — before ${trigger} compaction`);
if (lastUser) out.push(`\n**Working on:** ${lastUser.replace(/\n/g, " ")}`);
const section = (title, items, cap = 40) => {
  const a = [...items];
  if (!a.length) return;
  out.push(`\n**${title}** (${a.length})`);
  for (const x of a.slice(0, cap)) out.push(`- ${x}`);
  if (a.length > cap) out.push(`- …and ${a.length - cap} more`);
};
section("Files written or edited", wrote);
section("Scripts, gates and git run", ran, 25);
section("Files read (not images)", readNonImage, 30);
if (images) out.push(`\n**Images read in this thread:** ${images}`);
out.push(`\n> Written by planrails (precompact-journal.mjs). Tool results are gone after this point; this file is what survives.\n`);

try {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, `${sid}.md`);
  appendFileSync(path, out.join("\n"));
  process.stdout.write(JSON.stringify({
    systemMessage: `Progress journalled before compaction → .planrails/journal/${sid}.md`,
    suppressOutput: true,
  }));
} catch { /* never block a compaction */ }
process.exit(0);
