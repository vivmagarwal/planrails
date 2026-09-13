# Example: a weekly digest email

This is a plan mid-flight, as it looks inside a real project. It plans a feature
that emails each user a weekly digest of the top posts.

- [`.project-management/plans/weekly-digest/PLAN.md`](.project-management/plans/weekly-digest/PLAN.md)
  — the map and tracker. Read NOW first.
- [`.project-management/plans/weekly-digest/LOG.md`](.project-management/plans/weekly-digest/LOG.md)
  — the append-only history.

T1 is done, so it carries pasted evidence with its exit code. T2 is in progress,
and NOW points at it. The checker passes this plan, because every task that is
marked done has a proof and exit 0 evidence, and NOW names an open task:

```bash
node ../../tools/check-plans.mjs --root .
```
