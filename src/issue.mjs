/**
 * `planrails issue [bug|wish|edge] [--title "…"] [--print] [--gh]`
 *
 * Opens a prefilled GitHub issue for this project's planrails install: the
 * version, Node, the platform, the Claude Code version, and what doctor and
 * validate say — never file contents, never plan text. Opens the browser by
 * default; --print prints the URL; --gh uses the GitHub CLI instead.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { packageRoot, projectRoot } from "./plan/lib/paths.mjs";

export const REPO = "vivmagarwal/planrails";
const TEMPLATES = { bug: "bug.yml", wish: "wish.yml", edge: "edge-case.yml" };

function versionOf(cmd, args) { try { const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 4000 }); return r.status === 0 ? r.stdout.trim().split("\n")[0] : null; } catch { return null; } }

export async function environment() {
  const pkg = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8"));
  const lines = [`planrails ${pkg.version}`, `node ${process.version} · ${process.platform} ${process.arch}`, `claude: ${versionOf("claude", ["--version"]) || "not on PATH"}`];
  try {
    const { status } = await import("./hooks/install.mjs");
    const s = status({ print: false });
    lines.push(`hooks: ${s.problems ? `${s.problems} problem(s)` : "ok"} — ${s.lines.filter((l) => !l.ok).map((l) => l.text.replace(projectRoot(), "<project>")).slice(0, 4).join(" | ") || "all installed"}`);
  } catch (e) { lines.push(`hooks: could not check (${e.message})`); }
  try {
    const { listPlanIds, loadPlan, validatePlan } = await import("./plan/lib/store.mjs");
    const ids = listPlanIds();
    let errors = 0, warnings = 0; const first = [];
    for (const id of ids) { try { const v = validatePlan(loadPlan(id)); errors += v.errors.length; warnings += v.warnings.length; for (const e of v.errors.slice(0, 2)) first.push(e); } catch (e) { errors++; first.push(`${id}: ${e.message}`); } }
    lines.push(`plans: ${ids.length} — ${errors} error(s), ${warnings} warning(s)${first.length ? ` — e.g. ${first.slice(0, 3).join(" | ")}` : ""}`);
  } catch (e) { lines.push(`plans: could not validate (${e.message})`); }
  return lines.join("\n");
}

export async function issue({ kind = "bug", title = "", print = false, gh = false, log = console.log } = {}) {
  const template = TEMPLATES[kind];
  if (!template) { log(`issue kind must be one of: ${Object.keys(TEMPLATES).join(", ")}`); return 2; }
  const env = await environment();
  const params = new URLSearchParams({ template, title: title || "", environment: env });
  const url = `https://github.com/${REPO}/issues/new?${params.toString()}`;
  if (gh) {
    const body = `### Environment\n\n\`\`\`\n${env}\n\`\`\`\n\n### What happened / what you wish\n\n(fill in)\n\n### Steps or the case\n\n(fill in)\n`;
    const r = spawnSync("gh", ["issue", "create", "--repo", REPO, "--title", title || `${kind}: (describe)`, "--body", body, "--label", kind === "bug" ? "bug" : kind === "wish" ? "enhancement" : "edge-case"], { stdio: "inherit" });
    if (r.status === 0) return 0;
    log(`gh failed (exit ${r.status}); here is the URL instead:`);
  }
  log(url);
  if (print || gh) return 0;
  const opener = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  const r = spawnSync(opener[0], opener[1], { stdio: "ignore" });
  if (r.status !== 0) log("(could not open a browser — copy the URL above)");
  return 0;
}
