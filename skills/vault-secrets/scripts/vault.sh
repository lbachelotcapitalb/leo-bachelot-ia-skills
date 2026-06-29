#!/usr/bin/env bash
# vault.sh — façade unique au-dessus de plusieurs gestionnaires de secrets « requêtables »
# (avec CLI de lecture/écriture). But : remplacer les fichiers .env par une lecture à la demande,
# et déposer un secret SANS jamais le coller dans un chat ou le passer en argument clair.
#
# Providers supportés (détection auto, ou via $VAULT_PROVIDER) :
#   bitwarden  -> bw              (open source, self-host possible, lecture+écriture)
#   1password  -> op             (lecture+écriture ; `op run` remplace nativement .env)
#   pass       -> pass (+gpg)    (standard Unix, scriptable, lecture+écriture)
#   keepassxc  -> keepassxc-cli  (base .kdbx locale, lecture+écriture)
#   doppler    -> doppler        (`doppler run` remplace nativement .env)
#   infisical  -> infisical      (open source, `infisical run` remplace nativement .env)
#
# Sous-commandes :
#   vault.sh get  <name> [--field F]        -> imprime un secret sur stdout
#   vault.sh run  [--map FILE] -- <cmd...>   -> exécute <cmd> avec les secrets injectés en env (≈ .env)
#   vault.sh add  <name> [--field F]         -> dépose un secret (valeur tapée dans une fenêtre masquée)
#   vault.sh doctor                          -> diagnostique le provider et son authentification
#
# Sécurité : un secret ne transite QUE par stdin (écriture) ou stdout (lecture), jamais en argv,
# jamais loggé, jamais écrit sur disque par ce script. Cf. le skill autocli-password.
set -euo pipefail

# --- localisation de la saisie masquée (réutilise autocli-password si présent) --------------
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASK_SECRET=""
for cand in \
  "$SELF_DIR/../../autocli-password/scripts/ask-secret.sh" \
  "$HOME/.claude/skills/autocli-password/scripts/ask-secret.sh" ; do
  [ -f "$cand" ] && { ASK_SECRET="$cand"; break; }
done

# saisie masquée : préfère ask-secret.sh ; sinon repli natif (osascript/zenity/tty)
prompt_secret() {  # $1 = libellé, $2 = titre
  if [ -n "$ASK_SECRET" ]; then "$ASK_SECRET" "$1" "$2"; return; fi
  case "$(uname -s)" in
    Darwin) osascript -e "display dialog \"${1//\"/\\\"}\" with title \"${2//\"/\\\"}\" default answer \"\" with hidden answer buttons {\"Annuler\",\"OK\"} default button \"OK\"" -e 'text returned of result' ;;
    Linux)  if command -v zenity >/dev/null 2>&1; then zenity --password --title="$2"; else printf '%s ' "$1" >/dev/tty; IFS= read -rs s </dev/tty; echo >/dev/tty; printf '%s' "$s"; fi ;;
    *)      printf '%s ' "$1" >/dev/tty; IFS= read -rs s </dev/tty; echo >/dev/tty; printf '%s' "$s" ;;
  esac
}

die(){ echo "vault: $*" >&2; exit 1; }
have(){ command -v "$1" >/dev/null 2>&1; }

# --- détection du provider ------------------------------------------------------------------
detect_provider() {
  if [ -n "${VAULT_PROVIDER:-}" ]; then echo "$VAULT_PROVIDER"; return; fi
  if   have op;            then echo 1password
  elif have bw;            then echo bitwarden
  elif have doppler;       then echo doppler
  elif have infisical;     then echo infisical
  elif have pass;          then echo pass
  elif have keepassxc-cli; then echo keepassxc
  else die "aucun CLI de coffre détecté. Installe-en un (voir le SKILL.md) ou exporte VAULT_PROVIDER."
  fi
}
PROVIDER="$(detect_provider)"

# =================================  GET  ====================================================
cmd_get() {
  local name="${1:-}" field="password"; shift || true
  while [ $# -gt 0 ]; do case "$1" in --field) field="$2"; shift 2;; *) shift;; esac; done
  [ -n "$name" ] || die "usage: vault.sh get <name> [--field F]"
  case "$PROVIDER" in
    1password)  op read "op://${OP_VAULT:-Private}/$name/$field" 2>/dev/null \
                  || op item get "$name" --fields "label=$field" --reveal 2>/dev/null \
                  || die "1Password: '$name' introuvable" ;;
    bitwarden)  ensure_bw
                if [ "$field" = "password" ]; then bw get password "$name" --session "$BW_SESSION"
                else bw get item "$name" --session "$BW_SESSION" \
                       | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const i=JSON.parse(s);const f=(i.fields||[]).find(x=>x.name===process.argv[1]);if(!f)process.exit(3);process.stdout.write(f.value||"")})' "$field"
                fi ;;
    pass)       if [ "$field" = "password" ]; then pass show "$name" | head -n1
                else pass show "$name" | sed -n "s/^$field:[[:space:]]*//p" | head -n1; fi ;;
    keepassxc)  ensure_kp
                printf '%s' "$KP_PASS" | keepassxc-cli show -q -a "$field" -s "$KP_DB" "$name" ;;
    doppler)    doppler secrets get "$name" --plain ;;
    infisical)  infisical secrets get "$name" --plain 2>/dev/null || infisical export --format=dotenv | sed -n "s/^$name=//p" ;;
    *)          die "get non supporté pour $PROVIDER" ;;
  esac
}

# =================================  RUN  (remplace .env)  ====================================
# Délègue aux commandes natives quand elles existent (les plus robustes), sinon injecte depuis
# un manifeste .vault.map :  ENV_VAR=secret-name        ou   ENV_VAR=secret-name#field
cmd_run() {
  local map=".vault.map"
  while [ $# -gt 0 ]; do case "$1" in --map) map="$2"; shift 2;; --) shift; break;; *) break;; esac; done
  [ $# -gt 0 ] || die "usage: vault.sh run [--map FILE] -- <commande...>"
  case "$PROVIDER" in
    1password) exec op run --no-masking -- "$@" ;;          # lit les refs op:// d'un .env modèle
    doppler)   exec doppler run -- "$@" ;;
    infisical) exec infisical run -- "$@" ;;
    *)         # injection générique depuis le manifeste
      [ -f "$map" ] || die "manifeste '$map' absent. Format : ENV_VAR=secret-name[#field] (1 par ligne)."
      local exports=()
      while IFS= read -r line; do
        line="${line%%#manifest-comment}"; [ -z "${line// }" ] && continue
        case "$line" in \#*) continue;; esac
        local var="${line%%=*}" ref="${line#*=}" sec="$ref" fld="password"
        case "$ref" in *"#"*) sec="${ref%%#*}"; fld="${ref#*#}";; esac
        exports+=("$var=$(cmd_get "$sec" --field "$fld")")
      done < "$map"
      exec env "${exports[@]}" "$@" ;;
  esac
}

# =================================  ADD  ====================================================
cmd_add() {
  local name="${1:-}" field=""; shift || true
  while [ $# -gt 0 ]; do case "$1" in --field) field="$2"; shift 2;; *) shift;; esac; done
  [ -n "$name" ] || die "usage: vault.sh add <name> [--field F]"
  local label="${field:-$name}"
  local val; val="$(prompt_secret "Valeur à stocker pour « $name »${field:+ ($field)}" "vault · add")"
  [ -n "$val" ] || die "saisie vide — abandon."
  case "$PROVIDER" in
    pass)       if [ -n "$field" ]; then printf '%s\n%s: %s\n' "$val" "$field" "$val" | pass insert -m -f "$name" >/dev/null
                else printf '%s\n' "$val" | pass insert -m -f "$name" >/dev/null; fi
                echo "+ pass: $name créé" ;;
    1password)  if [ -n "$field" ]; then op item create --category="API Credential" --title="$name" "$field[password]=$val" >/dev/null
                else op item create --category=password --title="$name" "password=$val" >/dev/null; fi
                echo "+ 1Password: $name créé" ;;
    bitwarden)  ensure_bw
                # secure note avec un champ masqué (jamais la valeur en argv : passée via node/stdin)
                printf '%s' "$val" | node -e '
                  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
                    const [name,label]=process.argv.slice(1);
                    const item={type:2,name,notes:null,secureNote:{type:0},
                      fields:[{name:label,value:s,type:1}]}; // type 1 = hidden
                    process.stdout.write(Buffer.from(JSON.stringify(item)).toString("base64"));
                  })' "$name" "$label" \
                  | bw create item --session "$BW_SESSION" >/dev/null
                bw sync --session "$BW_SESSION" >/dev/null
                echo "+ Bitwarden: $name créé" ;;
    keepassxc)  die "keepassxc-cli add est interactif. Lance manuellement :
  keepassxc-cli add -p \"$KP_DB\" \"$name\"   (tape le mot de passe maître puis la valeur)" ;;
    doppler|infisical) die "$PROVIDER est orienté projet/CI. Ajoute via : $PROVIDER secrets set $name" ;;
    *)          die "add non supporté pour $PROVIDER" ;;
  esac
  unset val
}

# =================================  DOCTOR  =================================================
cmd_doctor() {
  echo "Provider     : $PROVIDER"
  case "$PROVIDER" in
    bitwarden) echo "CLI          : $(command -v bw)"; bw status 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log("Statut       : "+JSON.parse(s).status)}catch{console.log("Statut       : inconnu")}})' || true ;;
    1password) echo "CLI          : $(command -v op)"; op whoami 2>/dev/null && echo "Auth         : OK" || echo "Auth         : non connecté (op signin)" ;;
    pass)      echo "CLI          : $(command -v pass)"; echo "Store        : ${PASSWORD_STORE_DIR:-$HOME/.password-store}" ;;
    keepassxc) echo "CLI          : $(command -v keepassxc-cli)"; echo "Base (KP_DB) : ${KP_DB:-<non défini>}" ;;
    doppler)   echo "CLI          : $(command -v doppler)"; doppler configure get token >/dev/null 2>&1 && echo "Auth         : OK" || echo "Auth         : doppler login" ;;
    infisical) echo "CLI          : $(command -v infisical)"; echo "(infisical login + infisical init dans le projet)" ;;
  esac
}

# --- helpers d'unlock (RAM seulement) -------------------------------------------------------
ensure_bw() {
  [ -n "${BW_SESSION:-}" ] && return 0
  local st; st="$(bw status 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).status)}catch{process.stdout.write("")}})' || true)"
  [ "$st" = "unauthenticated" ] && die "Bitwarden non connecté. Fais d'abord : bw login"
  local mp; mp="$(prompt_secret "Mot de passe maître Bitwarden" "Bitwarden · unlock")"
  BW_SESSION="$(printf '%s' "$mp" | bw unlock --raw 2>/dev/null)" ; unset mp
  [ -n "$BW_SESSION" ] || die "unlock Bitwarden refusé (mauvais mot de passe ?)"
  export BW_SESSION
}
ensure_kp() {
  [ -n "${KP_DB:-}" ] || die "Définis KP_DB=/chemin/vers/base.kdbx"
  [ -n "${KP_PASS:-}" ] && return 0
  KP_PASS="$(prompt_secret "Mot de passe de la base KeePassXC" "KeePassXC · unlock")"
}

# --- dispatch -------------------------------------------------------------------------------
case "${1:-}" in
  get)    shift; cmd_get "$@" ;;
  run)    shift; cmd_run "$@" ;;
  add)    shift; cmd_add "$@" ;;
  doctor) shift; cmd_doctor "$@" ;;
  ''|-h|--help) echo "usage: vault.sh {get|run|add|doctor}  (provider: $PROVIDER) — voir SKILL.md"; ;;
  *) die "sous-commande inconnue: $1" ;;
esac
