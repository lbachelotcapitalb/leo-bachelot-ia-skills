---
name: vault-secrets
description: >-
  Aider à choisir et configurer un gestionnaire de mots de passe / coffre de secrets « requêtable »
  (avec CLI), y déposer un secret SANS le coller dans le chat, et surtout l'utiliser à la place des
  fichiers .env : lire les secrets à l'exécution. Utilise-le quand l'utilisateur veut ranger un mot
  de passe / token / clé d'API, sortir ses secrets des .env, ou demande quel gestionnaire choisir et
  comment le brancher à ses scripts/CI. Façade multi-providers (Bitwarden, 1Password, pass,
  KeePassXC, Doppler, Infisical) via scripts/vault.sh ; saisie masquée, secret jamais sur disque.
---

# vault-secrets — sortir les secrets des .env, sans jamais les coller

## Le problème qu'on règle

Un fichier `.env` en clair sur disque est le point faible classique : versionné par accident,
copié dans un backup, lisible par tout process tournant sous la session. L'alternative moderne est
un **coffre requêtable** : un gestionnaire avec un CLI qui lit/écrit les secrets, qu'on interroge
**au moment de l'exécution**. L'app ne lit plus un `.env` ; elle reçoit ses secrets injectés depuis
le coffre, juste pour la durée de la commande.

Ce skill fait trois choses :
1. **Choisir** un gestionnaire adapté (et le citer honnêtement).
2. **Configurer** son CLI (installation + authentification).
3. **Utiliser** le coffre à la place des `.env` — déposer un secret, puis le lire/injecter à l'exécution.

Tout passe par **un seul script** : [`scripts/vault.sh`](scripts/vault.sh), une façade au-dessus des
providers. La saisie d'un secret se fait dans une **fenêtre native à champ masqué** (réutilise le
skill compagnon [[autocli-password]] s'il est installé) — l'utilisateur ne colle jamais sa valeur
dans le chat.

## 1. Choisir un gestionnaire (citer, ne pas imposer)

Ne recommande un coffre « requêtable » que s'il a un **CLI de lecture** scriptable. Repères :

| Gestionnaire | CLI | Lecture | Écriture | `.env` natif | Notes |
|---|---|---|---|---|---|
| **1Password** | `op` | ✅ | ✅ | ✅ `op run` / `op inject` (refs `op://`) | Le plus fluide pour remplacer .env. Payant. |
| **Bitwarden / Vaultwarden** | `bw` | ✅ | ✅ | via `vault.sh run` | Open source, **self-host** possible (Vaultwarden), EU/US. Le défaut « libre ». |
| **Doppler** | `doppler` | ✅ | ✅ | ✅ `doppler run` | Pensé pour la CI/prod, secrets par environnement. SaaS. |
| **Infisical** | `infisical` | ✅ | ✅ | ✅ `infisical run` | Open source, self-host. Équivalent libre de Doppler. |
| **pass** | `pass` | ✅ | ✅ | via `vault.sh run` | Standard Unix (fichiers gpg + git). Zéro SaaS, 100 % local. |
| **KeePassXC** | `keepassxc-cli` | ✅ | ✅ (interactif) | via `vault.sh run` | Base `.kdbx` locale, hors-ligne. |
| **HashiCorp Vault** | `vault` | ✅ | ✅ | via wrappers | Pour infra/équipe, pas un perso. Surdimensionné en solo. |

À éviter pour cet usage : **NordPass, Dashlane, LastPass** — pas de CLI d'écriture/lecture fiable,
donc non requêtables pour remplacer un `.env`.

Heuristique de reco rapide :
- **Solo, tout local, zéro SaaS** → `pass` (ou KeePassXC si tu veux une base chiffrée unique).
- **Solo/équipe, open source, self-host** → **Bitwarden/Vaultwarden** ou **Infisical**.
- **Confort maximal pour remplacer .env** → **1Password** (`op run`) ou **Doppler**.

## 2. Configurer le CLI (installation + auth)

Installe le CLI du provider choisi, puis vérifie avec `vault.sh doctor`.

```bash
# 1Password
brew install --cask 1password-cli   # ou voir developer.1password.com/docs/cli
op signin

# Bitwarden
brew install bitwarden-cli          # npm i -g @bitwarden/cli  | choco install bitwarden-cli
bw login                            # (config server <url> d'abord si self-host/EU)

# pass
brew install pass gnupg ; gpg --gen-key ; pass init <gpg-id>

# Doppler / Infisical
brew install dopplerhq/cli/doppler ; doppler login ; doppler setup
brew install infisical/get-cli/infisical ; infisical login ; infisical init

# KeePassXC
brew install keepassxc              # CLI : keepassxc-cli ; définir KP_DB=/chemin/base.kdbx
```

Sélection du provider : auto-détecté (premier CLI présent), ou forcé par `export VAULT_PROVIDER=bitwarden`.
Vérifie :
```bash
~/.claude/skills/vault-secrets/scripts/vault.sh doctor
```

## 3. Déposer un secret (jamais collé dans le chat)

Tu (Claude) passes seulement les infos **non secrètes** (le nom, éventuellement le nom du champ).
La **valeur** se tape dans la fenêtre masquée. Donne au Bash un **timeout généreux** (≈ 180 s) : le
script attend que l'utilisateur tape (et déverrouille le coffre si besoin).

```bash
VAULT=~/.claude/skills/vault-secrets/scripts/vault.sh
# une clé d'API → champ masqué nommé
"$VAULT" add "Hostinger — API" --field HOSTINGER_API_TOKEN
# un mot de passe simple
"$VAULT" add "OVH"
```

Ne demande JAMAIS la valeur secrète en clair. Ne la mets jamais en argument (`--password xxx` fuit
dans `history` et `ps`).

## 4. Remplacer les .env (le cœur)

### Lecture ponctuelle
```bash
"$VAULT" get "Hostinger — API" --field HOSTINGER_API_TOKEN
```

### Injecter dans une commande (≈ source .env, mais sans fichier en clair)

**Si le provider a un mode natif, privilégie-le** (le plus robuste) :
```bash
op run -- node app.js          # 1Password : refs op:// dans un .env modèle versionnable
doppler run -- node app.js     # Doppler
infisical run -- node app.js   # Infisical
```

**Sinon (Bitwarden / pass / KeePassXC)**, déclare un manifeste `.vault.map` (versionnable : il ne
contient que des *références*, aucune valeur) :
```
# .vault.map  —  ENV_VAR=nom-du-secret[#champ]
DATABASE_URL=prod-db-url
STRIPE_KEY=Stripe — API#STRIPE_SECRET_KEY
```
puis :
```bash
"$VAULT" run --map .vault.map -- node app.js
```
`vault.sh run` lit chaque référence dans le coffre et exporte les variables uniquement pour le
process lancé. Rien n'est écrit sur disque.

### Migration depuis un .env existant
1. Pour chaque ligne `VAR=valeur` du `.env`, dépose la valeur : `"$VAULT" add "<nom>" --field VAR`
   (l'utilisateur tape la valeur — ou copie-la, mais ne la mets pas en argv).
2. Crée le `.vault.map` (références) à partir des noms de variables.
3. Remplace `node -r dotenv/config app.js` par `"$VAULT" run -- node app.js`.
4. **Supprime le `.env`** et ajoute-le au `.gitignore` (ainsi que `.vault.map` n'a PAS besoin d'être
   ignoré — il ne contient pas de secret).

## Garde-fous (sécurité)

- Le **mot de passe maître** du coffre ne touche jamais le disque : il déverrouille en RAM le temps
  d'une session (`bw unlock --raw`, KeePassXC via stdin). Mémorisation RAM bornée possible via
  [[autocli-password]] (sélecteur de durée, ≤ 24 h) pour éviter de retaper.
- Un secret ne transite que par **stdin** (écriture) ou **stdout** (lecture) — jamais en argv, jamais
  loggé, jamais `echo`. Le script respecte ça pour tous les providers.
- Le `.vault.map` est sûr à committer (références seulement). Le `.env`, lui, doit disparaître.
- En lecture pour un usage destructif (déchiffrer-puis-réécrire), si tu doutes de la validité d'un
  secret, fais un test lecture-seule d'abord (cf. [[autocli-password]]).

## Limite : self-host & réseau

Un provider SaaS (1Password, Doppler) ou self-host (Vaultwarden, Infisical) fait un appel réseau au
`get`/`run`. En offline, `pass` et KeePassXC restent les seuls 100 % locaux. Si un `op signin` /
`bw login` est requis et que le bac à sable bloque l'appel, l'utilisateur lance la connexion lui-même
une fois, puis les `get`/`run` réutilisent la session.
