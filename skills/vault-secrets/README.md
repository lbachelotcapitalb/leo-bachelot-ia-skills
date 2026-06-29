# vault-secrets

> Choose & configure a **queryable secrets manager**, store secrets without pasting them, and use the
> vault **in place of `.env` files** — read secrets at runtime instead.

A plaintext `.env` on disk is the classic weak point: committed by accident, copied into backups,
readable by any process in your session. This skill helps you move to a **queryable vault** (a
password manager with a read/write CLI) and wire it into your scripts and CI so secrets are injected
**only for the duration of a command** — never written to disk in the clear.

## What it does

1. **Choose** a manager — an honest comparison of the queryable options (those with a scriptable CLI).
2. **Configure** its CLI — install + authenticate, verified with `vault.sh doctor`.
3. **Use** it instead of `.env` — store a secret (masked input, never pasted in chat), then read or
   inject it at runtime.

Everything goes through one façade script, [`scripts/vault.sh`](scripts/vault.sh), with adapters per
provider. Secret entry uses a **native hidden-input dialog** (reuses the companion
[`autocli-password`](../autocli-password/) skill if installed) — the value never lands in the chat.

## Supported vaults

| Manager | CLI | Native `.env` replacement | Notes |
|---|---|---|---|
| **1Password** | `op` | ✅ `op run` / `op inject` (`op://` refs) | Smoothest .env replacement. Paid. |
| **Bitwarden / Vaultwarden** | `bw` | via `vault.sh run` | Open source, self-hostable. The free default. |
| **Doppler** | `doppler` | ✅ `doppler run` | Built for CI/prod, per-environment. SaaS. |
| **Infisical** | `infisical` | ✅ `infisical run` | Open source, self-hostable. |
| **pass** | `pass` | via `vault.sh run` | Unix standard (gpg files + git). Fully local. |
| **KeePassXC** | `keepassxc-cli` | via `vault.sh run` | Local `.kdbx`, offline. |

> NordPass / Dashlane / LastPass are intentionally **not** recommended here — no reliable read/write
> CLI, so they can't be queried to replace a `.env`.

## The script

```bash
vault.sh doctor                       # diagnose the active provider + auth
vault.sh add  "Stripe — API" --field STRIPE_SECRET_KEY   # store (value typed in a masked window)
vault.sh get  "Stripe — API" --field STRIPE_SECRET_KEY   # print one secret to stdout
vault.sh run  --map .vault.map -- node app.js            # inject secrets, then run (≈ source .env)
```

Provider is auto-detected (first CLI found) or forced with `export VAULT_PROVIDER=bitwarden`.

### Replacing `.env`

For providers with a native runner, the skill points you to it (`op run`, `doppler run`,
`infisical run`). For the others, you declare a **manifest** that holds only *references* (safe to
commit — no secret values):

```
# .vault.map  —  ENV_VAR=secret-name[#field]
DATABASE_URL=prod-db-url
STRIPE_KEY=Stripe — API#STRIPE_SECRET_KEY
```

```bash
vault.sh run --map .vault.map -- node app.js
```

`vault.sh run` reads each reference from the vault and exports the variables for that process only.
Then delete the `.env`.

## Requirements

- One supported vault CLI installed and authenticated (see `SKILL.md` for per-provider setup).
- `bash`; Node.js for the Bitwarden adapter's JSON handling (no `jq` dependency).
- Optional: the [`autocli-password`](../autocli-password/) skill for the masked-input dialog and a
  bounded RAM cache of the master password (otherwise a built-in fallback prompt is used).

## Security

- The vault's **master password** never touches disk — it unlocks in RAM for the session.
- Secrets travel only via **stdin** (write) or **stdout** (read), never as CLI args, never logged.
- The `.vault.map` manifest is safe to commit (references only); the `.env` is what disappears.

## Usage

Trigger it by describing the goal: *"store this API key"*, *"get my secrets out of `.env`"*, *"which
password manager should I use with my scripts?"*. Claude reads `SKILL.md`, helps you pick/configure a
vault, and drives `vault.sh`.
