/**
 * The shape of every plan file, declared ONCE.
 *
 * Why strict objects: an unregistered key is refused, the same rule the corpus
 * gate applies (scripts/corpus/structure.mjs). Before that rule, a field could
 * appear in one book and be invisible in the other thirty. Same risk here: a
 * plan that spells "evidence" as "proof" would pass a loose schema and the
 * done-needs-evidence check would never see it.
 *
 * Why the minimum lengths: a task titled "fix" and a gate whose question is
 * "works?" are the shapes that let a completion claim through unread.
 */
import { z } from "zod";

export const PLAN_ID = z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, "kebab-case, 2–64 chars");
export const TASK_ID = z.string().regex(/^T\d+$/, "T1, T2 …");
export const GATE_ID = z.string().regex(/^G\d+$/, "G1, G2 …");
export const RULE_ID = z.string().regex(/^R\d+$/, "R1, R2 …");
export const LEARNING_ID = z.string().regex(/^L\d+$/, "L1, L2 …");
export const DECISION_ID = z.string().regex(/^D\d+$/, "D1, D2 …");
const ISO = z.iso.datetime({ offset: true });
const DATE = z.iso.date();

export const EFFORT = z.enum(["max", "xhigh", "high"]);
export const TASK_STATUS = z.enum(["todo", "doing", "done", "blocked", "dropped"]);
export const PLAN_STATUS = z.enum(["draft", "active", "paused", "done", "abandoned"]);

/**
 * How a task got to `done`. A gate run the CLI recorded, or a person's word
 * with a reason. Nothing else. `by: "owner"` means the executor asked the
 * owner in chat and the owner said yes — the guide says so, the schema
 * cannot check it.
 */
export const Evidence = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("gate"), gate: GATE_ID, runId: z.string().min(8), at: ISO }),
  z.strictObject({
    kind: z.literal("manual"),
    by: z.enum(["owner", "agent"]),
    at: ISO,
    reason: z.string().min(20, "say what was checked and how (≥ 20 chars)"),
  }),
]);

export const STATEMENT_ID = z.string().regex(/^C\d+$/, "C1, C2 …");
export const STATEMENT_KIND = z.enum(["auto:gate", "auto:logged", "auto:files", "manual"]);
/** A condition of done. auto:* kinds are evaluated by the CLI; manual ones need an answer in words. */
/** since: when a plan-level condition was added with `plan condition add`; a task closed before then is not held to it. Absent on the defaults. */
export const Statement = z.strictObject({ id: STATEMENT_ID, statement: z.string().min(10), kind: STATEMENT_KIND, since: ISO.nullable().optional() });
/** What was actually answered when the task was closed. Stored on the task so `plan review` can show it. */
export const ChecklistEntry = z.strictObject({ id: STATEMENT_ID, statement: z.string().min(10), kind: STATEMENT_KIND, answer: z.string().min(10, "answer in at least 10 characters — say what you checked"), at: ISO });
/** Every plan starts with these; a plan may edit them, a task may add its own. */
export const DEFAULT_DONE_WHEN = [
  { id: "C1", statement: "The task's gate ran in this very command and passed — or a manual reason names who checked it and how.", kind: "auto:gate" },
  { id: "C2", statement: "A log entry names this task and was written after it started, saying what landed and what comes next.", kind: "auto:logged" },
  { id: "C3", statement: "Every file this task lists exists on disk.", kind: "auto:files" },
  { id: "C4", statement: "The docs that describe this change shipped in the same change — name them, or say why none were needed.", kind: "manual" },
  { id: "C5", statement: "Every number in the log entry and in any report carries a locator (file:line, page, verse) or was re-derived — say which.", kind: "manual" },
  { id: "C6", statement: "Anything learned or decided while doing this is recorded with plan learn / plan decide — name the ids, or say nothing was.", kind: "manual" },
  { id: "C7", statement: "You read the changed files whole, against the task's purpose and the app they live in, and judged the result right yourself — say what you read, what you looked for, and what the gate could not see.", kind: "manual" },
];

export const Task = z.strictObject({
  id: TASK_ID,
  title: z.string().min(8),
  status: TASK_STATUS,
  /** The gate whose pass means done. null only when manualCheck says who verifies and how. */
  gate: GATE_ID.nullable(),
  manualCheck: z.string().min(12).nullable(),
  files: z.array(z.string()),
  effort: EFFORT.nullable(),
  dependsOn: z.array(TASK_ID),
  notes: z.string(),
  startedAt: ISO.nullable(),
  doneAt: ISO.nullable(),
  evidence: Evidence.nullable(),
  blocked: z.strictObject({ reason: z.string().min(8), since: ISO, needs: z.enum(["owner", "external", "self"]) }).nullable(),
  /** Task-specific conditions of done, on top of the plan's doneWhen. */
  doneWhen: z.array(Statement).default([]),
  /** The answers given when the task was closed. Empty on a task that is not done. */
  doneChecklist: z.array(ChecklistEntry).default([]),
});

export const State = z.strictObject({
  id: PLAN_ID,
  title: z.string().min(8),
  status: PLAN_STATUS,
  created: DATE,
  activatedAt: ISO.nullable(),
  closedAt: ISO.nullable(),
  /** Repo-relative globs the plan's work lands in. The Stop hook watches them. */
  paths: z.array(z.string().min(1)),
  /** Conditions every task must satisfy before `task done` accepts it. Seeded with DEFAULT_DONE_WHEN. */
  doneWhen: z.array(Statement).default(() => structuredClone(DEFAULT_DONE_WHEN)),
  tasks: z.array(Task),
});

export const Gate = z.strictObject({
  id: GATE_ID,
  /** What the command LITERALLY answers. Not what you hope it answers. */
  question: z.string().min(20),
  /** The nearby question it does NOT answer — the one a reader will assume it does. */
  notTheSameAs: z.string().min(10),
  command: z.string().min(3),
  passWhen: z.union([z.literal("exit0"), z.strictObject({ stdoutMatches: z.string().min(1) })]),
  timeoutSec: z.number().int().positive().max(3600),
  /** A case that MUST fail. Run by `gate verify`. A gate that has never failed has never been tested. */
  /** expectExit: the exit code the failing case must produce (default: any non-zero). A usage error (127, 2) must not count as "the gate saw the problem". */
  knownFail: z.strictObject({ command: z.string().min(3), description: z.string().min(10), expectExit: z.number().int().nullable().optional() }).nullable(),
  /** The honest answer to "what would still pass if the thing this protects broke?" */
  couldPassWhileWrongIf: z.string().min(20),
  /** static reads files · runtime executes code · reality observes the live system · report never fails, only informs */
  kind: z.enum(["static", "runtime", "reality", "report"]),
});
export const Gates = z.strictObject({ gates: z.array(Gate) });

/** When a rule fires. `tool` is a regex over tool names; the others narrow it. */
export const RuleWhen = z.strictObject({
  tool: z.string().min(1),
  path: z.string().min(1).optional(),      // glob, repo-relative, for Edit/Write/Read/NotebookEdit file_path
  command: z.string().min(1).optional(),   // regex, for Bash command
  prompt: z.string().min(1).optional(),    // regex, for Agent prompt / Workflow script
});
export const Rule = z.strictObject({
  id: RULE_ID,
  when: RuleWhen,
  /** ≤ 1200 chars (~300 tokens). Longer belongs in `file`, and a file should still be short. */
  text: z.string().min(10).max(1200).optional(),
  file: z.string().min(1).optional(),
  /** once per session (default) · always · every:N calls */
  repeat: z.union([z.literal("once"), z.literal("always"), z.string().regex(/^every:\d+$/)]).default("once"),
  /** The case that taught it. Kept for the reader; not injected. */
  why: z.string().min(10),
  learning: LEARNING_ID.nullable(),
}).refine((r) => Boolean(r.text) !== Boolean(r.file), { message: "a rule has exactly one of text or file" });
export const Rules = z.strictObject({ rules: z.array(Rule) });

export const LogEntry = z.strictObject({
  at: ISO,
  session: z.string().nullable(),
  task: TASK_ID.nullable(),
  what: z.string().min(10),
  /** The exact next action, executable by a stranger. This is what the brief shows as RESUME. */
  next: z.string().min(5),
  refs: z.array(z.string()),
  uncommitted: z.string().nullable(),
});

export const Learning = z.strictObject({
  id: LEARNING_ID,
  at: ISO,
  session: z.string().nullable(),
  task: TASK_ID.nullable(),
  /** The case, with its numbers and paths. */
  what: z.string().min(20),
  /** The general rule it teaches. */
  rule: z.string().min(10),
  appliesWhen: z.string().min(5),
  /** prose = must be read · rule = injected by the hook (rules.json) · gate = machine-checked · docs = written into a guide */
  enforcement: z.enum(["prose", "rule", "gate", "docs"]),
  ref: z.string().nullable(),
  /** lead = needs a second reader before anyone acts on it */
  status: z.enum(["lead", "confirmed", "retracted"]),
});

export const Decision = z.strictObject({
  id: DECISION_ID,
  at: ISO,
  session: z.string().nullable(),
  task: TASK_ID.nullable(),
  decision: z.string().min(10),
  why: z.string().min(10),
  rejected: z.array(z.strictObject({ option: z.string().min(1), why: z.string().min(1) })),
  by: z.enum(["owner", "agent"]),
  supersedes: DECISION_ID.nullable(),
});

export const GateRun = z.strictObject({
  runId: z.string().min(8),
  gate: GATE_ID,
  /** run = the gate itself · verify = its knownFail case (which must FAIL) */
  kind: z.enum(["run", "verify"]),
  at: ISO,
  session: z.string().nullable(),
  command: z.string(),
  exit: z.number().int().nullable(),
  durationMs: z.number().int().nonnegative(),
  result: z.enum(["pass", "fail", "error"]),
  /** Last lines of output — enough to see WHY, never the whole log. */
  tail: z.string().max(4000),
  /** verify runs only: the gate's MAIN command at the time it was verified. A gate whose command changed since is not verified until gate verify runs again. */
  gateCommand: z.string().nullable().optional(),
});

export const SCHEMAS = { State, Gates, Rules, LogEntry, Learning, Decision, GateRun, Task, Gate, Rule, Statement, ChecklistEntry };

/** "state.json › tasks[2].evidence: expected …" — one line per issue, paths a reader can follow. */
export function formatIssues(file, error) {
  return error.issues.map((i) => `${file} › ${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`);
}
