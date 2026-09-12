#!/usr/bin/env node
/**
 * Release checks around `npm publish`, wired as lifecycle scripts in package.json:
 *
 *   prepublishOnly → node scripts/release-check.mjs before
 *   postpublish    → node scripts/release-check.mjs after
 *
 * Why this exists (measured 2026-09-12 with npm 11.3.0). A web-authenticated
 * publish is STAGED: the registry answers the upload with 202 Accepted and
 * finalizes the version about a minute later. For 0.1.1 the upload was accepted
 * at 07:27:5x UTC and the version became visible at 07:29:05. Inside that window
 * a second `npm publish` fails with E409 "Cannot publish over previously staged
 * version", and `npm install <name>@<version>` fails with ETARGET "No matching
 * version found" — it did three times in a row, the last one one second before
 * the version appeared. Nothing in npm's output says to wait.
 *
 *   before  refuses, in one plain sentence each, the reasons a publish fails or
 *           should not happen: the version is already on the registry, the
 *           CHANGELOG has no entry for it, the working tree is dirty, HEAD is not
 *           pushed. npm's own escape hatch is `npm publish --ignore-scripts`.
 *   after   polls the registry until it serves the version (up to 3 minutes), so
 *           the command returns only when an install will work, then prints the
 *           next lines. Skipped on `npm publish --dry-run`.
 *
 * The checks are pure functions over injected readers, so test/release-check.test.mjs
 * exercises every refusal without git or a registry.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Reasons not to publish; empty means go. `gitStatus` is `git status --porcelain --branch` output. */
export function reasonsNotToPublish({ name, version, changelog, gitStatus, registryVersionTime }) {
  const out = [];
  if (registryVersionTime) out.push(`${name}@${version} is already on the registry (published ${registryVersionTime}). Bump the version first: npm version patch`);
  if (!new RegExp(`^## ${version.replace(/\./g, "\\.")}\\b`, "m").test(changelog)) out.push(`CHANGELOG.md has no "## ${version}" entry. Write what changed before publishing it`);
  const lines = gitStatus.split("\n").filter(Boolean);
  const dirty = lines.filter((l) => !l.startsWith("##"));
  if (dirty.length) out.push(`the working tree has ${dirty.length} uncommitted change(s); a published tarball must match a commit. Commit or stash first`);
  const head = lines.find((l) => l.startsWith("##")) || "";
  const ahead = head.match(/\[(ahead \d+[^\]]*)\]/);
  if (ahead) out.push(`HEAD is not pushed (${ahead[1]}). Push first, so the published bytes are public in git too`);
  if (/no branch/.test(head)) out.push("HEAD is detached; publish from a branch that is pushed");
  return out;
}

/** Poll `view(name, version)` until it returns the version; resolves with the ms it took, rejects after timeoutMs. */
export async function waitUntilVisible({ name, version, view, sleep, timeoutMs = 180_000, everyMs = 5_000, tick = () => {} }) {
  const start = Date.now();
  for (;;) {
    if (view(name, version) === version) return Date.now() - start;
    if (Date.now() - start >= timeoutMs) {
      throw new Error(`${name}@${version} is still not served by the registry after ${Math.round(timeoutMs / 1000)} s. Check: npm view ${name}@${version} version — and do NOT run npm publish again (a staged version answers E409); wait, then check again.`);
    }
    tick();
    await sleep(everyMs);
  }
}

// --- the real readers ---------------------------------------------------------
const pkg = () => JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
function npmViewJson(spec, field) {
  const r = spawnSync("npm", ["view", spec, field, "--json"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0 || !r.stdout.trim()) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}
const npmView = (name, version) => { const v = npmViewJson(`${name}@${version}`, "version"); return Array.isArray(v) ? v[0] || null : v; };
const npmViewTime = (name, version) => { const t = npmViewJson(`${name}@${version}`, "time"); return t && typeof t === "object" && t[version] ? t[version] : null; };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2];
  const { name, version } = pkg();
  if (mode === "before") {
    const gitStatus = spawnSync("git", ["status", "--porcelain", "--branch"], { cwd: ROOT, encoding: "utf8" }).stdout || "";
    const reasons = reasonsNotToPublish({ name, version, changelog: readFileSync(join(ROOT, "CHANGELOG.md"), "utf8"), gitStatus, registryVersionTime: npmViewTime(name, version) });
    if (reasons.length) {
      process.stderr.write(`release-check: NOT publishing ${name}@${version}:\n${reasons.map((r) => `  - ${r}`).join("\n")}\n(npm's escape hatch, if you must: npm publish --ignore-scripts)\n`);
      process.exit(1);
    }
    process.stdout.write(`release-check: ${name}@${version} — tree clean and pushed, CHANGELOG entry present, version not on the registry yet. Publishing.\n`);
  } else if (mode === "after") {
    if (process.env.npm_config_dry_run === "true") process.exit(0);
    process.stdout.write(`release-check: waiting for the registry to serve ${name}@${version} (a web-authenticated publish is staged and finalizes in about a minute)`);
    waitUntilVisible({ name, version, view: npmView, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), tick: () => process.stdout.write(".") })
      .then((ms) => process.stdout.write(`\n${name}@${version} is on the registry (${Math.round(ms / 1000)} s). Next:\n  git push --follow-tags          # the tag npm version made\n  npm install ${name}@${version}     # in a project\n`))
      .catch((e) => { process.stderr.write(`\n${e.message}\n`); process.exit(1); });
  } else {
    process.stderr.write("usage: node scripts/release-check.mjs before|after\n");
    process.exit(2);
  }
}
