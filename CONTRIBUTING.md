# Contributing

Thank you. Three ways to help, easiest first.

## 1. Tell us what went wrong, or what you wish for

From any project that uses planrails:

```bash
npx planrails issue bug    # something broke
npx planrails issue edge   # a gate, a rule or a condition was wrong in a case we did not think of
npx planrails issue wish   # something you wish it did
```

That opens a prefilled issue with your versions and what `doctor` and `validate`
say. No file contents and no plan text are sent. You can also open an issue by
hand: https://github.com/vivmagarwal/planrails/issues/new/choose

## 2. Run the tests

```bash
git clone https://github.com/vivmagarwal/planrails && cd planrails
npm install
npm test            # node --test: the CLI, init, the hooks, the issue command
npm run selftest    # the validator's own refusals, and the hooks on captured payloads
npm run acceptance  # needs the claude CLI: a real session must quote the injected brief
```

Every test drives the real CLI against a throwaway directory. Nothing touches
a real project.

## 3. Change something

- Every rail has a test that proves it can fail. If you add a refusal to the
  validator, add a case to `planrails selftest` (in `src/plan/plan.mjs`) that
  trips it. If you add a hook behaviour, add a case to `src/hooks/selftest.mjs`
  built from a payload a real Claude Code run produced, not from the docs.
- Write for a beginner. Short sentences, plain words, one concrete example.
- `docs/PLANNING_GUIDE.md` ships with the package and is copied into every
  project by `init`, so a change to behaviour changes the guide in the same
  commit.
- Never let the agent bend a gate. If a change makes it easier to mark a task
  done without evidence, it will not be merged.

## 4. Release (maintainers)

Releases are published by GitHub Actions through npm **trusted publishing**
(OIDC). No npm token exists anywhere: the workflow proves its identity to npm
with a short-lived OpenID token that GitHub mints for it, npm accepts a publish
from that one workflow of this one repository, and provenance is attached
automatically. This is the path npm itself points to. Since July 2026, tokens
that bypass 2FA are being retired (direct publishing with them ends around
January 2027), and every local `npm publish` needs a person to approve it in a
browser. A tag push needs nobody.

**One-time setup on npmjs.com, by a maintainer with 2FA** (npm requires this
to be done interactively; a token cannot do it):
**planrails → Settings → Trusted Publisher → GitHub Actions**

| field | value |
|---|---|
| Organization or user | `vivmagarwal` |
| Repository | `planrails` |
| Workflow filename | `publish.yml` |
| Environment name | leave empty |
| Allowed actions | tick **`npm publish`** as well. Configurations made after 2026-09-03 default to `npm stage publish` only, which needs a person to approve every release. |

Then, on the same page, **Publishing access → "Require two-factor
authentication and disallow tokens"**. After that, only this workflow (OIDC)
and a person with 2FA can publish. npm does not verify the configuration when
you save it; a wrong field shows up as `ENEEDAUTH` on the first run, and the
troubleshooting list is in npm's trusted-publishers guide.

**Every release, from a clean and pushed `main`:**

```bash
# CHANGELOG.md has a "## <new version> — <date>" entry, committed and pushed
npm version patch            # or minor / major → commit "planrails 0.1.3" + tag v0.1.3
git push --follow-tags       # the tag starts .github/workflows/publish.yml
gh run watch                 # or: gh run list --workflow publish.yml
npm view planrails version   # the proof
```

The workflow installs with `npm ci`, runs the tests and the selftests, then
`npm publish`. Around that, `scripts/release-check.mjs` runs as
`prepublishOnly` and `postpublish`:

- **before** refuses, one plain sentence each, when the tag does not match
  `package.json`, the version is already on the registry, the CHANGELOG has no
  entry for it, or the tree is dirty. On a laptop it also refuses an unpushed or
  detached HEAD. npm's own escape hatch is `npm publish --ignore-scripts`.
- **after** waits until the registry serves the version, then prints the next
  lines, so the job ends only when `npm install` will work.

**Why the wait exists — measured 2026-09-12 with npm 11.3.0.** A publish is
*staged*: the registry answers the upload with `202 Accepted` and finalizes the
version about a minute later (69 s and 75 s measured). Inside that window a
second `npm publish` fails with `E409 Cannot publish over previously staged
version`, and `npm install planrails@<version>` fails with `ETARGET No matching
version found`. So never run `npm publish` twice; let `after` wait, or check
with `npm view planrails version`.

**Fallback, from a laptop:** `npm publish` still works, with the browser 2FA
prompt; the same checks run.
