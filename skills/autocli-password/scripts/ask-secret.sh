#!/usr/bin/env bash
# ask-secret.sh — collecte un secret via une fenêtre native à champ masqué et l'imprime sur stdout.
#
# Usage :   SECRET="$(scripts/ask-secret.sh "Passphrase du coffre" "coffre · rebuild")"
#           VAULT_PASS="$SECRET" node build-vault.mjs rebuild ; unset SECRET VAULT_PASS
#
# 3ᵉ argument optionnel = CLÉ DE CACHE. S'il est fourni ET que l'utilisateur choisit une durée
# dans le sélecteur, le secret est gardé en RAM (agent éphémère, ≤ 1 h) et les appels suivants
# avec la même clé ne rouvrent PAS de fenêtre. Sans 3ᵉ argument → comportement historique exact
# (une fenêtre, aucune mémorisation). Défaut du sélecteur = « Aucune » : opt-in strict.
#
# Le secret est écrit UNIQUEMENT sur stdout (pour substitution `$(...)`). Rien n'est
# stocké sur DISQUE, journalisé, ni affiché à l'écran. Annulation / saisie vide -> sortie 1, ce
# qui fait avorter la commande appelante (avec `&&`) sans rien exécuter.
#
# Plateformes : macOS (osascript) · Linux (zenity | systemd-ask-password) · repli TTY (read -rs).
# Le sélecteur de durée est macOS-only ; ailleurs la clé de cache est ignorée (aucune mémorisation).
set -euo pipefail

PROMPT="${1:-Mot de passe :}"
TITLE="${2:-Secret requis}"
CACHE_KEY="${3:-}"

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT="$SELF_DIR/secret-agent.mjs"
HAVE_NODE=0; command -v node >/dev/null 2>&1 && HAVE_NODE=1
IS_MAC=0; [ "$(uname -s)" = "Darwin" ] && IS_MAC=1
CACHEABLE=0; [ -n "$CACHE_KEY" ] && [ "$HAVE_NODE" = 1 ] && [ -f "$AGENT" ] && CACHEABLE=1

# --- 1) cache hit : aucune fenêtre, on rend le secret mémorisé -------------
if [ "$CACHEABLE" = 1 ]; then
  if cached="$(node "$AGENT" get "$CACHE_KEY" 2>/dev/null)" && [ -n "$cached" ]; then
    printf '%s' "$cached"; exit 0
  fi
fi

# --- durée de mémorisation (macOS, opt-in, défaut = aucune) ----------------
ask_duration() {
  osascript \
    -e 'set opts to {"Aucune (ne pas mémoriser)","5 minutes","15 minutes","30 minutes","1 heure","4 heures","8 heures","24 heures"}' \
    -e 'set r to choose from list opts with title "Mémorisation (RAM)" with prompt "Garder ce secret en mémoire vive pour…  (défaut : aucune)" default items {"Aucune (ne pas mémoriser)"} OK button name "OK" cancel button name "Annuler"' \
    -e 'if r is false then return "0"' \
    -e 'set c to item 1 of r' \
    -e 'if c is "5 minutes" then return "300"' \
    -e 'if c is "15 minutes" then return "900"' \
    -e 'if c is "30 minutes" then return "1800"' \
    -e 'if c is "1 heure" then return "3600"' \
    -e 'if c is "4 heures" then return "14400"' \
    -e 'if c is "8 heures" then return "28800"' \
    -e 'if c is "24 heures" then return "86400"' \
    -e 'return "0"' 2>/dev/null || printf '0'
}

# --- fenêtre UNIQUE (macOS) : champ masqué + menu durée dans une seule NSAlert Cocoa -------
# Sort sur stdout : "OK\t<secondes>\t<secret>" | "__CANCEL__" (annulé) | "__ERR__" (mécanisme
# indispo → l'appelant retombe sur le flux 2-fenêtres). Le secret ne transite que par stdout.
combined_dialog() {
  PROMPT_TXT="$PROMPT" TITLE_TXT="$TITLE" osascript <<'APPLESCRIPT' 2>/dev/null || printf '__ERR__'
use framework "AppKit"
use scripting additions
set thePrompt to (system attribute "PROMPT_TXT")
set theTitle to (system attribute "TITLE_TXT")
set durTitles to {"Aucune — ne pas mémoriser", "5 minutes", "15 minutes", "30 minutes", "1 heure", "4 heures", "8 heures", "24 heures"}
set durSecs to {0, 300, 900, 1800, 3600, 14400, 28800, 86400}
try
  set alert to current application's NSAlert's alloc()'s init()
  alert's setMessageText:theTitle
  alert's setInformativeText:thePrompt
  (alert's addButtonWithTitle:"OK")
  (alert's addButtonWithTitle:"Annuler")
  set theView to current application's NSView's alloc()'s initWithFrame:(current application's NSMakeRect(0, 0, 330, 64))
  set pwd to current application's NSSecureTextField's alloc()'s initWithFrame:(current application's NSMakeRect(0, 36, 330, 24))
  set lbl to current application's NSTextField's alloc()'s initWithFrame:(current application's NSMakeRect(0, 4, 150, 20))
  lbl's setStringValue:"Garder en mémoire :"
  lbl's setBezeled:false
  lbl's setDrawsBackground:false
  lbl's setEditable:false
  lbl's setSelectable:false
  set popup to current application's NSPopUpButton's alloc()'s initWithFrame:(current application's NSMakeRect(150, 0, 180, 26))
  (popup's addItemsWithTitles:durTitles)
  (theView's addSubview:pwd)
  (theView's addSubview:lbl)
  (theView's addSubview:popup)
  alert's setAccessoryView:theView
  alert's window's setInitialFirstResponder:pwd
  current application's NSApplication's sharedApplication()'s activateIgnoringOtherApps:true
  set resp to alert's runModal()
  if resp = (current application's NSAlertFirstButtonReturn) then
    set theSecret to (pwd's stringValue()) as text
    set idx to (popup's indexOfSelectedItem()) as integer
    set secs to (item (idx + 1) of durSecs)
    return "OK" & tab & (secs as text) & tab & theSecret
  else
    return "__CANCEL__"
  end if
on error
  return "__ERR__"
end try
APPLESCRIPT
}

# --- finalisation : (option) mise en cache RAM + émission sur stdout -------
finish() {
  local secret="${1:-}"
  [ -n "$secret" ] || { echo "ask-secret: saisie vide / annulée — abandon." >&2; exit 1; }
  if [ "$CACHEABLE" = 1 ] && [ "$IS_MAC" = 1 ]; then
    local ttl; ttl="$(ask_duration)"; ttl="${ttl//[^0-9]/}"
    if [ -n "$ttl" ] && [ "$ttl" -gt 0 ] 2>/dev/null; then
      printf '%s' "$secret" | node "$AGENT" set "$CACHE_KEY" "$ttl" >/dev/null 2>&1 || true
    fi
  fi
  printf '%s' "$secret"
}

tty_fallback() {               # lecture silencieuse depuis le terminal contrôlant
  [ -e /dev/tty ] || { echo "ask-secret: aucun dialogue GUI ni TTY disponible." >&2; exit 1; }
  printf '%s ' "$PROMPT" > /dev/tty
  local s; IFS= read -rs s < /dev/tty; echo > /dev/tty
  finish "$s"
}

case "$(uname -s)" in
  Darwin)
    # Cas mémorisable : UNE seule fenêtre (champ masqué + menu durée) via NSAlert Cocoa.
    if [ "$CACHEABLE" = 1 ]; then
      out="$(combined_dialog)"
      case "$out" in
        OK"$(printf '\t')"*)
          rest="${out#OK$'\t'}"; secs="${rest%%$'\t'*}"; secret="${rest#*$'\t'}"
          case "$secs" in ''|*[!0-9]*) secs=0;; esac
          [ -n "$secret" ] || { echo "ask-secret: saisie vide — abandon." >&2; exit 1; }
          if [ "$secs" -gt 0 ]; then printf '%s' "$secret" | node "$AGENT" set "$CACHE_KEY" "$secs" >/dev/null 2>&1 || true; fi
          printf '%s' "$secret"; exit 0 ;;
        __CANCEL__) echo "ask-secret: annulé." >&2; exit 1 ;;
        *) : ;;   # __ERR__ (NSAlert indisponible) → repli sur le flux 2-fenêtres ci-dessous
      esac
    fi
    # Flux classique : une fenêtre masquée. finish() demandera la durée (2ᵉ fenêtre) si CACHEABLE.
    s="$(osascript \
      -e "display dialog \"${PROMPT//\"/\\\"}\" with title \"${TITLE//\"/\\\"}\" default answer \"\" with hidden answer buttons {\"Annuler\",\"OK\"} default button \"OK\"" \
      -e 'text returned of result')" || { echo "ask-secret: annulé." >&2; exit 1; }
    finish "$s"
    ;;
  Linux)
    if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && command -v zenity >/dev/null 2>&1; then
      s="$(zenity --password --title="$TITLE" 2>/dev/null)" || { echo "ask-secret: annulé." >&2; exit 1; }
      finish "$s"
    elif command -v systemd-ask-password >/dev/null 2>&1; then
      s="$(systemd-ask-password "$PROMPT")" || exit 1
      finish "$s"
    else
      tty_fallback
    fi
    ;;
  *)
    tty_fallback
    ;;
esac
