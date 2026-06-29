# contribuer

> Prepare a clean, **adoptable pull request** to a repo you don't maintain — end to end.

The contributor-side counterpart of [`review-contrib`](../review-contrib/). Where `review-contrib`
is the **maintainer** auditing an incoming contribution, `contribuer` is the **contributor** making
that contribution land in minutes: resync the fork, work on a short dedicated branch, respect the
project's immutable rules and conventions, pass its validation gate, and open a small, reviewable PR.

The goal isn't just "it works" — it's **adoptable without friction**: small, on-convention, green.
Whatever the reviewer will check, you do it yourself *before* opening the PR.

## The flow

```
read the project's rules  →  branch off upstream/main  →  one intent per branch
  →  respect immutable invariants  →  match conventions  →  green validation gate
  →  self-review  →  small PR
```

1. **Read & sync** — find the repo's own rules (`CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`, docs), then branch off a fresh `upstream/main` (the original repo, not your fork).
2. **Immutable rules** — spot the invariants you must never break (storage keys / persisted formats, schema versions + migrations, destructive-action guards, bundle/perf budgets, idempotent generated data) and stay inside them. The repo's stated rules always win over the generic checklist.
3. **Conventions** — read a neighbouring file and write code that reads like it: reuse existing helpers, match locale/formatting, don't hardcode what the repo centralizes.
4. **Validation gate** — run the repo's validation command (tests/lint/build) and require 100% green; add a test if you touched sensitive logic.
5. **Self-audit + PR** — small focused diff, no secrets, no stray debug, rebased on `upstream/main`, a commit that explains *what & why*, then `gh pr create` filling the repo's PR template.

## Why it exists

A reviewer adopts a PR fast when it's small, green, and respects the project's invariants — and slowly
(or not at all) when it's a sprawling change that trips a storage key or a schema version. This skill
front-loads all of that so your contribution is easy to say yes to.

## Requirements

- `git` and the [`gh`](https://cli.github.com/) GitHub CLI (for the fork → PR flow).
- Whatever the target repo needs to build and run (read its `CONTRIBUTING.md` / `package.json`).

## Usage

Trigger it when you start coding a feature or fix on someone else's repo: *"I want to contribute a
fix to X"*, *"open a clean PR for this"*. Claude reads `SKILL.md` and walks the contribution from a
synced branch to a small, green, reviewable PR. Pairs with [`review-contrib`](../review-contrib/) on
the maintainer's side.
