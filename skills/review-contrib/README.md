# review-contrib

> Audit, test and merge a collaborator's **commit / branch / PR** safely — before it touches `main`.

A repeatable review workflow for adopting outside contributions (often pushed to a **fork** without
a PR) quickly *and* safely. The guiding rule: when `main` is auto-deployed to production, you never
test or fix on `main` — every review happens on a throwaway `review/*` branch in a separate git
**worktree**, and the merge only lands once everything is green and approved.

## Why it exists

A contributor's commit isn't always where you expect (fork, unopened PR, stale branch), may conflict
with what `main` has gained since, and may carry subtle issues (locale parsing, formula injection,
data leaks, a heavy dependency bloating the bundle). This skill turns "someone sent me a commit" into
a deterministic pipeline that ends in a clean merge or a clear list of blockers.

## The pipeline

```
fork/branch  →  fetch  →  conflict audit (merge-tree)  →  review worktree (merge)
            →  automated gate (lint + secrets + tests + build)
            →  sub-agent code review  →  manual test (dev server)
            →  fixes on review/*  →  merge into main  (= go prod)
```

Each step is a copy-pasteable block in `SKILL.md`:

1. **Discover** the commit across PRs / collaborators / forks / branches, and diff it without cloning (`gh api … /compare`).
2. **Conflict audit** with `git merge-tree --write-tree` — know if it merges cleanly *before* you start.
3. **Review worktree** — `git worktree add` a second folder so the main checkout stays on `main`, untouched.
4. **Automated gate** — run the repo's validation command (lint, secret scan, tests, build); watch the bundle.
5. **Code review** — delegate a focused audit of the changed files to a sub-agent, then verify each blocker yourself.
6. **Manual test** — run the dev server *from the worktree*; nothing is deployed.
7. **Adjust & merge** — apply blockers, re-validate, merge only on explicit approval, then remove the worktree.

It also covers **industrializing** the flow (ask for PRs, add a CI gate + `CODEOWNERS`) so future
contributions arrive review-ready.

## Requirements

- `git` (2.38+ for `git merge-tree --write-tree`).
- The [`gh`](https://cli.github.com/) GitHub CLI, authenticated.
- The target repo should expose a single validation command (the skill assumes `npm run audit` by
  convention — adapt it to your project's lint/test/build script).

## Usage

Trigger it by describing the situation: *"a collaborator pushed a commit"*, *"review X's branch/PR"*,
*"audit and test this contribution"*, *"how do I adopt this commit"*. Claude reads `SKILL.md` and
walks the pipeline, softcoded per repo.

## Guardrails

- `main` = production → never WIP on it, never `push origin main` without explicit approval.
- The review worktree is a disposable sibling folder; `git worktree remove` when done.
- A heavy new dependency is only acceptable if dynamically imported (zero impact on the initial bundle).
