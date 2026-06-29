# claude-skills

A collection of **[Claude Code](https://claude.com/claude-code) skills**, cleaned up for public
reuse. Each one is self-contained, dependency-light, and softcoded so it works on any project.

> A *skill* is a folder with a `SKILL.md` (instructions Claude reads) plus optional helper scripts.
> Claude loads it **automatically** when your task matches the skill's `description` — you don't
> call it by name. See the [skills docs](https://docs.claude.com/en/docs/claude-code/skills).

**Browsing with an AI?** Point it at [`skills.json`](skills.json) — a machine-readable index of every
skill (summary, when to use / when to skip, deps, triggers, relationships) so it can recommend the
right one. Humans: use the chooser below.

---

## Which skill do I need?

| Your situation | Skill |
|---|---|
| "Build / redesign / de-clutter a **slide deck**" | [deck-builder](#deck-builder) |
| "**Someone sent me a commit/branch/PR** — review and merge it safely" | [review-contrib](#review-contrib) |
| "**I want to contribute** a clean PR to a repo I don't maintain" | [contribuer](#contribuer) |
| "This command needs a **password only I know**, and I don't want to paste it" | [autocli-password](#autocli-password) |
| "Get my secrets **out of `.env`** / pick & wire up a password manager" | [vault-secrets](#vault-secrets) |
| "**Continue this work on another machine** (VPS, laptop)" | [handoff](#handoff) |

They split into three themes — **documents**, **collaboration (PRs)**, **secrets** — plus a
machine-to-machine handoff. Two pairs are designed to face each other:

```
  COLLABORATION                       SECRETS
  review-contrib  ⇄  contribuer       autocli-password  ⇄  vault-secrets
  (maintainer)       (contributor)    (one interactive secret)  (a whole vault, replaces .env)
```

---

## The skills

### deck-builder
**Build or restructure polished, on-brand PowerPoint (`.pptx`) decks programmatically.** Encodes hard
layout/design rules (fill-the-space, assertion titles, one-idea-per-slide, readable type floors,
section-rhythm backgrounds), embeds true vector SVG icons, and self-verifies with silent audits + a
render-to-PNG check before handing back. Theme-agnostic.
- **Use it when** you're creating a pitch/deck, or fixing slides that feel empty, repetitive, or inconsistent.
- **Skip it when** you only need to *read/extract* from a `.pptx` (the base `pptx` skill covers that).
- **Needs** Python (`python-pptx`, Pillow); `rsvg-convert` for icons; LibreOffice for the faithful render.
- [README](skills/deck-builder/README.md) · [SKILL.md](skills/deck-builder/SKILL.md)

### review-contrib
**Audit, test and merge a collaborator's commit / branch / PR safely — before it touches `main`.** A
deterministic pipeline: discover the commit (fork/branch/PR), conflict-audit with `merge-tree`,
review in an isolated git worktree, run the repo's validation gate, delegate a code review to a
sub-agent, manually test, then merge only on approval.
- **Use it when** you're the **maintainer** adopting an incoming contribution and `main` is production.
- **Skip it when** you're the one *writing* the contribution → use [contribuer](#contribuer) instead.
- **Needs** `git` (2.38+) and the `gh` CLI.
- [README](skills/review-contrib/README.md) · [SKILL.md](skills/review-contrib/SKILL.md)

### contribuer
**Prepare a clean, adoptable PR to a repo you don't maintain.** The contributor-side mirror of
review-contrib: sync the fork, branch off `upstream/main`, find and respect the project's immutable
rules & conventions, pass its validation gate, and open a small reviewable PR — so whatever the
reviewer checks, you did it first.
- **Use it when** you start coding a feature/fix on **someone else's** repo.
- **Skip it when** you're the maintainer reviewing others' work → use [review-contrib](#review-contrib).
- **Needs** `git` and the `gh` CLI.
- [README](skills/contribuer/README.md) · [SKILL.md](skills/contribuer/SKILL.md)

### autocli-password
**Run a CLI command that needs a secret only the user knows — without pasting it.** Claude runs the
command; a native hidden-input dialog pops up; the value flows straight into the command's
environment. The secret stays in RAM — never in the chat, shell history, or on disk. Optional
`ssh-agent`-style RAM cache to avoid retyping.
- **Use it when** a single command blocks on a credential (decrypt a vault, an SSH passphrase, a `sudo` step).
- **Skip it when** you need many secrets at runtime / to replace `.env` → use [vault-secrets](#vault-secrets).
- **Needs** Bash + Node (zero external deps). macOS/Linux dialogs, TTY fallback.
- [README](skills/autocli-password/README.md) · [SKILL.md](skills/autocli-password/SKILL.md)

### vault-secrets
**Choose & configure a queryable secrets manager, and use it in place of `.env`.** A provider-agnostic
façade (`vault.sh`) over Bitwarden, 1Password, pass, KeePassXC, Doppler, Infisical: store a secret
(masked input, never pasted), read one, or inject a whole set into a command at runtime — so you can
delete the plaintext `.env`.
- **Use it when** you want secrets out of `.env`, or help picking/wiring a password manager into scripts/CI.
- **Skip it when** you just need *one* interactive secret for *one* command → use [autocli-password](#autocli-password).
- **Needs** Bash + one supported vault CLI (Node for the Bitwarden adapter; no `jq`).
- [README](skills/vault-secrets/README.md) · [SKILL.md](skills/vault-secrets/SKILL.md)

### handoff
**Hand a Claude Code session between machines over git.** Transports the code (a WIP commit on a safe
branch) + a `HANDOFF.md` resume brief, and prints a ready-to-paste resume command. Refuses to push
WIP onto an auto-deployed branch. Optional autonomous remote agent (`delegate`) and a config-driven
target diagnostic (`check`). Softcoded per repo via `.claude/handoff.json`.
- **Use it when** you want to continue (or delegate) work on a VPS / another workstation.
- **Skip it when** both ends already share a live workspace.
- **Needs** Node (zero deps) + git/SSH on both machines.
- [README](skills/handoff/README.md) · [SKILL.md](skills/handoff/SKILL.md)

---

## Install

Skills live in `~/.claude/skills/` (global) or `<project>/.claude/skills/` (per-project). Copy the
one(s) you want:

```bash
git clone https://github.com/lbachelotcapitalb/leo-bachelot-ia-skills.git
cp -R leo-bachelot-ia-skills/skills/deck-builder ~/.claude/skills/
```

No registration step — Claude Code discovers them and triggers the right one from your task
description. Some skills reference each other (e.g. `handoff` and `vault-secrets` can use
`autocli-password`); installing the companion is optional, each degrades gracefully.

## Notes

- **Genericized.** Extracted from a personal setup; any reference to private infra (vault names,
  hosts, project conventions) was replaced with neutral placeholders. No personal data remains.
- **Language.** Some skills are written in French, some in English — the `description` is what Claude
  matches on, and it operates fine in either language.
- **Platform.** Mostly cross-platform; a few use macOS-first native dialogs / the LibreOffice render
  path with documented Linux fallbacks. Each skill's README lists its exact prerequisites.

## License

[MIT](LICENSE). `deck-builder` reuses MIT-licensed design-token tables and text-measurement ideas —
attribution is in [`skills/deck-builder/SKILL.md`](skills/deck-builder/SKILL.md#attribution--licenses).
