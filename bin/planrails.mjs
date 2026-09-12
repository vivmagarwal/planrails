#!/usr/bin/env node
// The `planrails` command. Everything is dispatched by src/plan/plan.mjs.
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const plan = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "plan", "plan.mjs");
process.argv[1] = plan;
await import(plan);
