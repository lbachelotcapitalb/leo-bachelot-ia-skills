# handoff

> Hand a Claude Code work session from one machine to another over **git** — WIP + a resume brief.

Two self-hosted Claude Code instances (your laptop, a VPS, another workstation) share no cloud sync.
This skill performs the handoff through git: it transports the **code** (a WIP commit on a safe
branch) and a **resume brief** (`HANDOFF.md`). The conversation itself doesn't migrate — it's
reconstructed from the brief, which is more robust (absolute paths, MCP servers and checkpoints
differ across machines).

## What it does

Two symmetric moves, driven by one zero-dependency Node script ([`scripts/handoff.mjs`](scripts/handoff.mjs)):

- **Leaving** (`out`) — write `HANDOFF.md`, commit the WIP onto a safe branch, push, and print a
  ready-to-paste resume command for the remote machine.
- **Arriving** (`in`) — fetch + checkout the WIP branch + pull, then display the brief so you pick up
  exactly where you left off.

It also covers:
- **`delegate`** — push the WIP and launch an **autonomous headless agent** on the remote (detached, survives SSH disconnect), which commits and pushes its result back.
- **`check`** — probe the target machine channel by channel (GitHub access, network, secrets, mounted drives…) and print recommendations, so you know the remote can actually reach what the task needs *before* you leave.

## Why git, not a session copy

The brief is the hard part, not git. The remote Claude restarts with no context, so the quality of
the resume depends entirely on `HANDOFF.md` (objective / done / next action / how to verify / pitfalls).
The skill makes writing it the first step of every `out`.

## Configuration (softcoded per repo)

Everything is read from `.claude/handoff.json` at the repo root — nothing hardcoded, so the skill is
shareable. Create one with:

```bash
node ~/.claude/skills/handoff/scripts/handoff.mjs init --to vps --ssh user@host --path '~/your-repo'
```

Key fields: `wipBranch` (pattern with `{repo}` `{user}` `{date}` placeholders), `protectedBranches` /
`noDeployToBranches` (the skill **refuses** to push WIP onto an auto-deployed branch like `main`),
`handoffFile`, `remotes` (one entry per target machine), `defaultRemote`. See
[`references/config-example.json`](references/config-example.json).

## Commands

| Command | Purpose |
|---|---|
| `init [--to <name>] [--ssh user@host] [--path ~/repo]` | Create `.claude/handoff.json`. |
| `out [--to <remote>] [-m "msg"] [--exec]` | Push WIP + print the resume command (`--exec` runs the SSH directly). |
| `in [<branch>] [--from <remote>]` | Fetch the WIP + show the brief. |
| `delegate --task "..." [--to <remote>] [--max-turns N]` | Push WIP + launch an autonomous agent on the remote. |
| `delegate-status [--to <remote>]` | State of the remote agent (running / done + log tail). |
| `check [--to <remote>] [--ssh user@host] [--repo <url>]` | Probe the target's transmission channels + recommend fixes. |
| `status` | Current branch, target WIP branch, known remotes. |

## Requirements

- `git` and SSH access to a remote that shares the same git remote (e.g. a GitHub repo).
- Node.js on both machines (the script is pure Node, no dependencies).
- Optional: the [`autocli-password`](../autocli-password/) skill, to type the SSH password into a
  masked dialog instead of pasting it.

## Guardrails

- **Never pushes WIP onto an auto-deployed branch.** If the computed WIP branch is in
  `noDeployToBranches` / `protectedBranches`, the script refuses — fix the config, don't bypass it.
- **Non-destructive save.** It never `checkout`s the WIP branch locally; it commits on the *current*
  branch, pushes that commit to the remote WIP branch, then `reset --mixed` back — your working tree
  is left exactly as it was.
- **No session transfer.** Code + brief travel, not the literal chat history.

## Usage

Trigger it by saying things like *"resume this on the VPS"*, *"switch to my remote machine"*, or
*"pick up the work from the server"*. Claude reads `SKILL.md` and runs the right side of the handoff.
