---
name: autocli-password
description: >-
  Run a terminal command that needs a secret only the user knows by collecting it through a
  native hidden-input dialog piped straight into the command — never asking the user to paste it.
  Use when a command would otherwise block on a credential: deploying or rebuilding an encrypted
  artifact, decrypting a vault, logging into a CLI, an SSH key passphrase, or a `sudo` step. The
  secret stays in RAM for one command and is never written to disk or history.
---

# autoCLIpassword — exécution autonome de commandes à secret

## L'idée

Quand une commande a besoin d'un secret que **seul l'utilisateur connaît**, le réflexe habituel est mauvais : soit on lui demande de coller le secret (il transite par le chat / l'historique), soit on lui tend un bloc avec un placeholder `…` à éditer à la main, soit on le code en dur. Tout ça crée de la friction et expose le secret.

À la place : **c'est toi (Claude) qui lances la commande**. Au moment où elle a besoin du secret, une **fenêtre native à champ masqué** s'ouvre sur l'écran de l'utilisateur. Il tape, valide, et la valeur part directement dans l'environnement de la commande. Tu lis la sortie et tu enchaînes. L'utilisateur **n'a qu'un geste : taper son mot de passe**. Il ne colle rien.

Pourquoi c'est mieux : le secret n'apparaît jamais dans la conversation, jamais dans `history`, jamais sur disque. Il n'existe que dans la RAM, le temps d'une commande.

## La règle d'or (sécurité)

Un secret maître (passphrase qui déchiffre un coffre, clé qui ouvre toute une infra) **ne doit JAMAIS être persisté**. La raison : tout ce qui est stocké est volable — par un process tournant sous la session déverrouillée de l'utilisateur, ou par quelqu'un devant sa machine déverrouillée. Gardé seulement dans sa tête + transitoirement en RAM, il n'y a rien à voler.

Concrètement, à chaque usage :
- Capture le secret par **substitution de commande** (`$(...)`) dans une variable d'env, pour **une seule** commande.
- `unset` la variable juste après.
- N'écris JAMAIS le secret dans un fichier, un log, ou un argument en clair (`--passphrase 'xxx'` finit dans `history` et dans la table des process — préfère toujours une **variable d'environnement** que l'outil lit).
- Ne le ré-affiche jamais (pas d'`echo "$SECRET"`).
- **Refuse le DISQUE** pour un secret maître : jamais Keychain, jamais un champ Bitwarden, jamais `.env`. Tout ce qui touche le disque est volable et survit au redémarrage.

## Exception bornée et autorisée : mémorisation en RAM (modèle ssh-agent)

Une **commodité opt-in** : éviter de retaper la même passphrase à chaque fenêtre, **sans jamais
toucher le disque**. C'est le modèle `ssh-agent`/`gpg-agent`, pas un store sur disque — donc
compatible avec la règle d'or ci-dessus (l'interdit, c'est le disque).

`scripts/secret-agent.mjs` est un daemon **éphémère, RAM uniquement** : il garde des secrets
(clé → valeur) derrière une socket Unix `0600`, chaque entrée avec un **TTL plafonné à 24 h**, et
**s'éteint tout seul** dès que tout est expiré (et au plus tard à 24 h 05). Le secret ne vit que
dans le tas de ce process ; le seul fichier sur disque est la socket (0 octet de secret).

Quand une clé de cache est fournie (macOS), la saisie tient dans **UNE seule fenêtre** : une
`NSAlert` Cocoa (pont AppleScript-ObjC, zéro dépendance) avec un champ masqué **et** le menu de
durée côte à côte. Si la NSAlert échoue (vieux macOS), repli automatique sur l'ancien flux à deux
fenêtres (`display dialog` puis `choose from list`). Sans clé de cache : une seule fenêtre masquée
classique, comme avant.

Garde-fous non négociables :
- **Défaut = aucune mémorisation.** Le menu de durée est sur « Aucune ». On ne garde un secret que
  si l'utilisateur choisit explicitement une durée. Sans 3ᵉ argument (clé de cache), `ask-secret.sh`
  se comporte exactement comme avant : une fenêtre, zéro mémorisation.
- **Plafond 24 h, en dur**, dans le daemon (impossible de demander plus). Ladder : 5 min → 24 h.
  Au-delà de quelques heures, l'exposition est réelle (secret maître en RAM toute la journée) :
  réserve les longues durées aux grosses journées d'allers-retours, pas en continu.
- **RAM seulement** : aucune écriture disque du secret, jamais.
- **Périmètre** : seulement les secrets maîtres réutilisables (ex. la passphrase d'un coffre, une
  clé d'infra), avec une clé de cache stable. Pas les valeurs jetables (un mot de passe qu'on dépose
  une fois ne se met pas en cache).
- **Bouton panique** : `node ~/.claude/skills/autocli-password/scripts/secret-agent.mjs flush`
  oublie tout immédiatement (et éteint le daemon). À proposer si l'utilisateur s'éloigne de sa machine.
- **Anti-typo** : si une validation échoue (unlock refusé, rebuild raté), `drop` la clé avant de
  reprompter — sinon un secret mal tapé resterait collé tout le TTL. Reproduis ce réflexe dans tout
  appelant qui met un secret en cache.

## Comment lancer une commande (helper fourni)

Utilise le helper `scripts/ask-secret.sh` — il affiche la bonne fenêtre selon l'OS (macOS `osascript`, Linux `zenity`/`systemd-ask-password`, repli terminal `read -rs`) et imprime le secret saisi sur stdout. Annulation ou saisie vide → il sort en erreur, donc la commande appelante avorte proprement (rien ne se passe).

Patron général (le `&&` garantit que rien ne tourne si l'utilisateur annule) :

```bash
SKILL=~/.claude/skills/autocli-password
SECRET="$("$SKILL/scripts/ask-secret.sh" "Motif clair de la demande" "Titre fenêtre")" \
  && VAR_ATTENDUE_PAR_L_OUTIL="$SECRET" <commande qui lit cette variable> \
  ; unset SECRET
```

**3ᵉ argument optionnel = clé de cache RAM** (voir l'exception bornée ci-dessus). Fournis-le
seulement pour un secret maître réutilisable, avec une clé stable de ton choix (ex. `vault`) :

```bash
# 1ʳᵉ fois : fenêtre masquée + sélecteur de durée. Cache HIT ensuite → aucune fenêtre.
SECRET="$("$SKILL/scripts/ask-secret.sh" "Passphrase du coffre (rebuild chiffré)" "coffre · rebuild" vault)" \
  && VAULT_PASS="$SECRET" node build-vault.mjs rebuild ; unset SECRET VAULT_PASS
```

Réutilise la **même clé** pour le même secret partout (sinon le cache ne se partage pas). Si la
commande échoue sur un secret invalide, oublie-le avant de retenter :
`node "$SKILL/scripts/secret-agent.mjs" drop vault`.

**Exemple — rebuild d'un artefact chiffré puis déploiement :**

```bash
SKILL=~/.claude/skills/autocli-password
cd /chemin/vers/le/projet \
  && VAULT_PASS="$("$SKILL/scripts/ask-secret.sh" "Passphrase du coffre (rebuild chiffré)" "coffre · rebuild")" \
       node build-vault.mjs rebuild \
  ; unset VAULT_PASS
# puis (sans secret) :
./deploy.sh
```

Donne à l'outil Bash un **timeout généreux** (≈ 180 s) sur la commande qui ouvre la fenêtre : il attend pendant que l'utilisateur tape.

## Quand tu n'es pas sûr : vérifie en lecture seule d'abord

Avant une action **destructive ou irréversible** qui dépend du secret (déchiffrer-puis-réécrire un coffre, écraser un fichier, déployer), si tu as un doute sur la validité du secret, fais d'abord un **test en lecture seule** : déchiffre / authentifie sans rien écrire ni envoyer, et confirme que ça passe. Ça évite de partir dans une opération à mi-chemin avec un mauvais secret.

## La saisie est à l'aveugle → les fautes de frappe arrivent

Le champ est masqué : l'utilisateur peut se tromper sans le voir. Si une étape échoue avec un message du genre « passphrase invalide / coffre indéchiffrable », **ne conclus pas tout de suite à un vrai problème** — c'est presque toujours un typo. Re-propose simplement la fenêtre. Pour trancher entre typo et vrai désaccord de clé, utilise le test lecture-seule ci-dessus : s'il passe à la 2ᵉ saisie, c'était un typo.

## Lire le résultat et continuer

C'est tout l'intérêt : **l'utilisateur ne colle jamais la sortie**. Tu l'as nativement (tu as lancé la commande). Les scripts bien faits s'auto-rapportent (`✓ …` / `✗ …`) — en cas de succès, l'utilisateur n'a rien à faire. Enchaîne sur l'étape suivante. Ne lui redemande la sortie que si la commande échoue de façon opaque.

## Limite à connaître : étapes sortantes / prod

Une étape qui sort vers la production (SSH/scp vers un VPS, déploiement, appel d'API distante) peut être **bloquée par le bac à sable de Claude Code**, indépendamment du secret. Si ça arrive :
- soit l'utilisateur lance **cette ligne-là** lui-même (souvent sans secret, ex. un `./deploy.sh`),
- soit il ajoute une **règle de permission Bash** dédiée pour autoriser ce script précis.
Le mécanisme de saisie de secret de ce skill ne contourne pas ces garde-fous — il règle seulement le problème du secret interactif.

## Anti-patterns (à ne pas faire)

- ❌ Demander à l'utilisateur de **coller** son mot de passe dans le chat.
- ❌ Lui tendre une commande avec un placeholder `…`/`<password>` à remplacer.
- ❌ Mettre le secret en argument en clair (`--password xxx`, `-p xxx`) → fuite `history` + `ps`.
- ❌ Stocker un secret maître dans Keychain / Bitwarden / `.env` « pour la prochaine fois ».
- ❌ `echo`/log du secret, même pour debug.
