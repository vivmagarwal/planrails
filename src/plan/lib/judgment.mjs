/**
 * The words an agent sees at every moment it decides whether work is done:
 * task check, the task done refusal, the brief, and the fresh-session prompt.
 *
 * Why (owner, 2026-09-12, decision D9): a gate is a proxy for the goal, and
 * every proxy has cases where it is wrong. Under "you cannot be done until the
 * gate is green" an agent will sometimes satisfy the proxy instead of the goal:
 * weaken the gate, bend the data, patch a file by hand. The trial did exactly
 * that on its first unattended run. So judgment is pointed in three directions,
 * and the override is routed through the owner: the agent may say "the gate is
 * wrong, here is why" (task block --needs owner), but never both judge and pass.
 */
export const JUDGMENT = [
  "JUDGMENT OUTRANKS THE GATE. A gate is a script: it cannot read, cannot see, and answers only the one question it was written for. You can. Read what it computed, then rule on it:",
  "· gate RED, work right → never make the gate pass. Write down what it literally computed and what is true. If the GATE is wrong, fix the gate and re-run gate verify (its known-fail case must still fail). Otherwise: task block --needs owner --reason \"…\" and stop. The owner's word closes it; yours does not.",
  "· gate GREEN, work wrong → refuse to close. Say what the gate cannot see, and fix the work.",
  "· anything crashed → never edit a plan file by hand. Log it, block, stop.",
];
export const JUDGMENT_SHORT = "JUDGMENT OUTRANKS THE GATE: a red gate is never made to pass, a green gate is never trusted blind, a crash is never patched by hand. task check prints the rest.";
