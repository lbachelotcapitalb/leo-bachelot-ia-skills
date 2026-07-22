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

## Boucle d'apprentissage — ce skill capitalise, il ne se répète pas

**Règle permanente : dès que tu rencontres une friction ou un incident avec ce mécanisme et que tu le résous, tu INSCRIS la leçon ici avant de clore.** Une saisie qui bloque, une passphrase re-demandée pour rien, un cache mal purgé, un dialogue qui timeout, un piège d'outillage en aval : chacun est un apprentissage à graver, pas à revivre. Le but est qu'une deuxième occurrence du même problème soit impossible — parce que la règle qui l'évite est déjà dans ce fichier.

Comment graver, à chaque fois :
1. **Symptôme → cause racine → règle** en une ou deux phrases, datée, ajoutée à la section pertinente (souvent « Anti-typo, mais ciblé » ou une nouvelle puce). Formule la règle de façon *actionnable* (« ne fais pas X quand Y », pas « attention à X »).
2. Si la cause touche un système précis (karto, Bitwarden…), pose aussi le détail dans la mémoire-pièges de ce système (`[[pitfalls-karto]]`, etc.) et lie-la ici.
3. Si un petit outil de contrôle a manqué (un test lecture-seule, un validateur), crée-le et référence-le, pour que la prochaine fois le diagnostic soit une commande, pas une enquête.

**Avant de reprompter ou de conclure « ça ne marche pas », relis d'abord les leçons déjà gravées ici** : la réponse à ta friction du jour y est peut-être déjà. Chaque incident bien capitalisé rend ce skill strictement plus fiable que la veille — c'est le seul état acceptable.

*(Incident fondateur, 16/07/2026 : passphrase karto correcte re-demandée 5+ fois parce que la doctrine purgeait le cache sur un échec en aval — alors que le kid concordait. Cause réelle : coffre au kid périmé vs ct. Règle gravée → section « Anti-typo, mais ciblé ». C'est précisément ce que cette boucle doit rendre non-répétable.)*

## La règle d'or (sécurité)

Un secret maître (passphrase qui déchiffre un coffre, clé qui ouvre toute une infra) **ne doit JAMAIS être persisté**. La raison : tout ce qui est stocké est volable — par un process tournant sous la session déverrouillée de l'utilisateur, ou par quelqu'un devant sa machine déverrouillée. Gardé seulement dans sa tête + transitoirement en RAM, il n'y a rien à voler.

Concrètement, à chaque usage :
- Capture le secret par **substitution de commande** (`$(...)`) dans une variable d'env, pour **une seule** commande.
- `unset` la variable juste après.
- N'écris JAMAIS le secret dans un fichier, un log, ou un argument en clair (`--passphrase 'xxx'` finit dans `history` et dans la table des process — préfère toujours une **variable d'environnement** que l'outil lit).
- Ne le ré-affiche jamais (pas d'`echo "$SECRET"`).
- **Refuse le DISQUE** pour un secret maître : jamais Keychain, jamais un champ Bitwarden, jamais `.env`. Tout ce qui touche le disque est volable et survit au redémarrage.

## Exception bornée et autorisée : mémorisation en RAM (modèle ssh-agent)

Leo a explicitement validé (25/06) une **commodité opt-in** : éviter de retaper la même passphrase
à chaque fenêtre, **sans jamais toucher le disque**. C'est le modèle `ssh-agent`/`gpg-agent`, pas
un store sur disque — donc compatible avec la règle d'or ci-dessus (l'interdit, c'est le disque).

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
  si Leo choisit explicitement une durée. Sans 3ᵉ argument (clé de cache), `ask-secret.sh` se
  comporte exactement comme avant : une fenêtre, zéro mémorisation.
- **Plafond 24 h, en dur**, dans le daemon (impossible de demander plus). Ladder : 5 min → 24 h.
  Au-delà de quelques heures, l'exposition est réelle (secret maître en RAM toute la journée) :
  réserve les longues durées aux grosses journées d'allers-retours, pas en continu.
- **RAM seulement** : aucune écriture disque du secret, jamais.
- **Périmètre** : seulement les secrets maîtres réutilisables — clés `karto` et `bw-master`. Pas
  les valeurs jetables (un mot de passe qu'on dépose une fois ne se met pas en cache).
- **Bouton panique** : `node ~/.claude/skills/autocli-password/scripts/secret-agent.mjs flush`
  oublie tout immédiatement (et éteint le daemon). À proposer si Leo s'éloigne de sa machine.
- **Anti-typo, mais ciblé** (leçon 16/07/2026) : ne `drop`/reprompte QUE sur une **preuve positive
  de mauvaise saisie** — une empreinte de clé qui **ne concorde pas** (`keycheck verify` → kid ≠
  canonique, unlock explicitement « clé invalide »). Un simple **échec en aval** (rebuild raté,
  « coffre indéchiffrable », deploy KO) alors que **le kid CONCORDE** signifie que la passphrase est
  BONNE et que le problème est ailleurs (coffre corrompu, kid périmé vs ct, bug d'outillage) →
  **GARDE le cache, n'ennuie pas l'utilisateur, débogue la cause.** Purger la clé sur ce genre
  d'échec = re-demander en boucle une passphrase déjà correcte (exactement ce qui s'est passé le
  16/07 : coffre karto au kid valide mais ct inouvrable — la passphrase n'a jamais été en cause).
  ⚠️ `keycheck verify` **ne déchiffre pas** (compare seulement le kid) : un kid qui concorde ne
  prouve pas que le ct s'ouvre. `vault-add.mjs` drope déjà sur mismatch pour `bw-master`/`karto`.
- **Cache par défaut pour un flux multi-étapes** : dès qu'une session va rappeler le même secret
  maître plusieurs fois (récup + rebuild + deploy…), fournis la **clé de cache** et suggère une
  durée dès la 1ʳᵉ fenêtre → UNE seule saisie pour toute la séquence, au lieu de N fenêtres.

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
seulement pour un secret maître réutilisable, avec une clé stable (`karto`, `bw-master`) :

```bash
# 1ʳᵉ fois : fenêtre masquée + sélecteur de durée. Cache HIT ensuite → aucune fenêtre.
SECRET="$("$SKILL/scripts/ask-secret.sh" "Passphrase karto (rebuild chiffré)" "karto · rebuild" karto)" \
  && CARTO_PASS="$SECRET" node karto-sync.mjs rebuild ; unset SECRET CARTO_PASS
```

Réutilise la **même clé** pour le même secret partout (sinon le cache ne se partage pas). Si la
commande échoue sur un secret invalide, oublie-le avant de retenter :
`node "$SKILL/scripts/secret-agent.mjs" drop karto`.

**Exemple réel — rebuild + deploy d'un coffre chiffré (karto) :**

```bash
SKILL=~/.claude/skills/autocli-password
cd ~/Documents/Claude/Projects/cartographie-it \
  && CARTO_PASS="$("$SKILL/scripts/ask-secret.sh" "Passphrase karto (rebuild chiffré)" "karto · rebuild")" \
       node karto-sync.mjs rebuild \
  ; unset CARTO_PASS
# puis (sans secret) :
./deploy-karto.sh
```

Donne à l'outil Bash un **timeout généreux** (≈ 180 s) sur la commande qui ouvre la fenêtre : il attend pendant que l'utilisateur tape.

## Avant de prompter : le secret a-t-il déjà un agent/cache natif ?

Leçon (22/07/2026) : passphrase SSH VPS re-demandée en fenêtre alors qu'elle est **déjà dans le
Keychain macOS** (posée là par Léo, cf. mémoire GTMAdvisory 16/07). Règle actionnable — pour une
**clé SSH**, avant toute fenêtre : `ssh-add --apple-load-keychain` (recharge sans rien demander),
et seulement si ça ne charge rien → fenêtre masquée puis `ssh-add --apple-use-keychain` (le
Keychain est l'exception validée pour CETTE passphrase ; la doctrine « jamais sur disque » vaut
pour les coffres karto/Bitwarden, pas pour ce cas déjà acté). Généralisation : si le secret vise
un outil qui a son propre agent/cache (ssh-agent, gpg-agent, keychain), vérifie d'abord que
l'agent n'est pas simplement vide — un agent vidé par un redémarrage n'est pas un secret perdu.

## Quand tu n'es pas sûr : vérifie en lecture seule d'abord

Avant une action **destructive ou irréversible** qui dépend du secret (déchiffrer-puis-réécrire un coffre, écraser un fichier, déployer), si tu as un doute sur la validité du secret, fais d'abord un **test en lecture seule** : déchiffre / authentifie sans rien écrire ni envoyer, et confirme que ça passe. Ça évite de partir dans une opération à mi-chemin avec un mauvais secret.

## La saisie est à l'aveugle → les fautes de frappe arrivent

Le champ est masqué : l'utilisateur peut se tromper sans le voir. Si une étape échoue (« passphrase invalide / coffre indéchiffrable »), **ne conclus rien avant de VÉRIFIER l'empreinte** : compare le kid de la saisie à la clé canonique (`keycheck verify`, ou `keyIdOf(pass)`). Deux cas nettement distincts :

- **kid ne concorde PAS** → vraie mauvaise saisie (typo, ou mauvaise passphrase). Là, re-propose la fenêtre (et `drop` le cache d'abord).
- **kid concorde mais l'étape échoue quand même** → la passphrase est BONNE ; **arrête de re-demander**. Le problème est en aval (coffre corrompu, kid périmé vs ct, transfert tronqué, bug de script). Débogue ça, garde le cache. Re-prompter en boucle ne fera que répéter le même échec avec la bonne passphrase (incident karto 16/07 : 5+ saisies inutiles d'une passphrase parfaitement correcte).

⚠️ Un kid qui concorde prouve que la passphrase est la bonne, **pas** que le ct s'ouvre (`keycheck verify` ne déchiffre pas). Pour trancher « le coffre lui-même est-il ouvrable ? », il faut un **vrai déchiffrement** (ex. `vault-open.mjs` côté karto), pas le kid.

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
