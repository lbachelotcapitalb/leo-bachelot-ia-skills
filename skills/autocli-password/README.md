# autocli-password

> Run a CLI command that needs a **secret only the user knows** — without ever asking them to paste it.

When a command blocks on a credential (decrypt a vault, rebuild an encrypted artifact, log into a
CLI, an SSH key passphrase, a `sudo` step), the usual options are all bad: paste the secret into the
chat (it lands in history), hand over a command with a `<password>` placeholder to edit by hand, or
hard-code it. This skill does it right: **Claude runs the command**, a **native hidden-input dialog**
pops up on the user's screen, they type, and the value flows straight into the command's environment.
Claude reads the output and continues. The user's only gesture is typing their password — they paste
nothing.

The secret never appears in the conversation, never in shell history, never on disk. It exists only
in RAM, for the duration of one command.

## Why it's safe

- Captured via command substitution into an **env var** for a single command, then `unset`.
- Never passed as a clear-text CLI argument (which would leak into `history` and `ps`).
- Never echoed, logged, or written to a file.
- A master secret is **never persisted to disk** — no Keychain, no password manager, no `.env`. Kept
  only in the user's head + transiently in RAM, there is nothing to steal.

## What's inside

| File | Role |
|---|---|
| `SKILL.md` | Full instructions: the golden rule, the calling pattern, the typo/read-only-check reflexes, anti-patterns. |
| `scripts/ask-secret.sh` | Shows the right hidden-input dialog per OS and prints the secret on stdout. Cancel / empty → exits non-zero so the calling command aborts cleanly. |
| `scripts/secret-agent.mjs` | Optional **RAM-only** secret cache (the `ssh-agent` model): holds secrets behind a `0600` Unix socket with a hard 24h TTL ceiling, auto-shuts down when empty. Nothing secret ever hits disk. |

## How it's used

The core pattern (the `&&` guarantees nothing runs if the user cancels):

```bash
SKILL=~/.claude/skills/autocli-password
SECRET="$("$SKILL/scripts/ask-secret.sh" "Clear reason for the prompt" "Window title")" \
  && EXPECTED_ENV_VAR="$SECRET" <command that reads that variable> \
  ; unset SECRET
```

Optional **3rd argument** = a RAM cache key (opt-in, macOS), so repeated calls with the same key
don't re-open a window within the chosen TTL. Default is *no memorization*.

## Platforms

- **macOS** — `osascript` (a single Cocoa `NSAlert` with masked field + optional duration menu).
- **Linux** — `zenity` or `systemd-ask-password`.
- **Fallback** — silent TTY read (`read -rs`).

The RAM cache duration selector is macOS-only; elsewhere the cache key is ignored (no memorization).

## Requirements

- macOS or Linux; Node.js only if you want the optional RAM cache.
- A documented guardrail: outbound/production steps (SSH, deploy) may still be blocked by Claude
  Code's sandbox independently of the secret — this skill only solves the *interactive secret*
  problem, it doesn't bypass those gates.

## Usage

Trigger it whenever a command would otherwise stall on a credential the user holds. Claude reads
`SKILL.md`, opens the dialog, runs the command, and reports the result.
