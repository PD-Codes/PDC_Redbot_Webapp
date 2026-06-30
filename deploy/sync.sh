#!/usr/bin/env bash
#
# DKS – Sync vom lokalen Windows-PC auf den Linux-Server (rsync über SSH).
#
# Spiegelt BEIDE Repos auf den Server und baut/startet anschließend die Web-App neu.
# Cog-Änderungen werden übertragen, müssen aber im Discord per [p]reload aktiviert werden
# (Red hat dafür keinen serverseitigen Befehl).
#
# Ausführen in WSL, Git-Bash oder einer Linux-Shell:
#   bash deploy/sync.sh            # alles (Web-App + Cogs), dann Build+Restart
#   bash deploy/sync.sh web        # nur Web-App
#   bash deploy/sync.sh cogs       # nur Cogs
#   bash deploy/sync.sh --dry-run  # nur anzeigen, nichts schreiben
#
# Konfiguration: deploy/sync.config (aus sync.config.example kopieren, NICHT committen).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${SYNC_CONFIG:-$SCRIPT_DIR/sync.config}"

if [ ! -f "$CONFIG" ]; then
  echo "FEHLER: $CONFIG nicht gefunden."
  echo "       Kopiere deploy/sync.config.example -> deploy/sync.config und trage deine Werte ein."
  exit 1
fi
# shellcheck disable=SC1090
. "$CONFIG"

# --- Defaults / Ableitungen ------------------------------------------------- #
LOCAL_APP_DIR="${LOCAL_APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOCAL_COGS_DIR="${LOCAL_COGS_DIR:-$(cd "$SCRIPT_DIR/../../DKS_Redcogs" 2>/dev/null && pwd || true)}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"

# Argument-Parsing
TARGET="all"
DRYRUN=""
for arg in "$@"; do
  case "$arg" in
    web|cogs|all) TARGET="$arg" ;;
    --dry-run|-n) DRYRUN="--dry-run" ;;
    *) echo "Unbekanntes Argument: $arg"; exit 1 ;;
  esac
done

# SSH-Optionen zusammenbauen
SSH_OPTS=(-p "$SSH_PORT")
[ -n "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")
SSH_CMD="ssh ${SSH_OPTS[*]}"
REMOTE="${SSH_USER}@${SSH_HOST}"

# Gemeinsame rsync-Optionen
RSYNC_BASE=(-az --human-readable --info=stats1 $DRYRUN -e "$SSH_CMD")

echo "==> Ziel: $REMOTE (Port $SSH_PORT)"
[ -n "$DRYRUN" ] && echo "==> TROCKENLAUF – es wird nichts geschrieben."

# --- Web-App ---------------------------------------------------------------- #
sync_web() {
  echo
  echo "==> Web-App: $LOCAL_APP_DIR  ->  $REMOTE_APP_DIR"
  rsync "${RSYNC_BASE[@]}" --delete \
    --exclude='.git/' \
    --exclude='node_modules/' \
    --exclude='build/' \
    --exclude='.svelte-kit/' \
    --exclude='.npm-cache/' \
    --exclude='.cache/' \
    --exclude='.env' \
    --exclude='deploy/sync.config' \
    "$LOCAL_APP_DIR/" "$REMOTE:$REMOTE_APP_DIR/"
}

# --- Cogs ------------------------------------------------------------------- #
sync_cogs() {
  if [ -z "${LOCAL_COGS_DIR:-}" ] || [ ! -d "$LOCAL_COGS_DIR" ]; then
    echo "FEHLER: LOCAL_COGS_DIR nicht gefunden ('$LOCAL_COGS_DIR'). In sync.config setzen."; exit 1
  fi
  echo
  echo "==> Cogs: $LOCAL_COGS_DIR  ->  $REMOTE_COGS_DIR"
  # Bewusst OHNE --delete: löscht keine anderen Cogs auf dem Server.
  rsync "${RSYNC_BASE[@]}" \
    --exclude='.git/' \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    "$LOCAL_COGS_DIR/" "$REMOTE:$REMOTE_COGS_DIR/"
}

# --- Server: Build + Restart der Web-App ------------------------------------ #
rebuild_web() {
  [ -n "$DRYRUN" ] && { echo "==> (Trockenlauf) Build/Restart übersprungen."; return; }
  echo
  echo "==> Build + Restart auf dem Server"
  # shellcheck disable=SC2029
  $SSH_CMD "$REMOTE" "cd '$REMOTE_APP_DIR' && sudo bash deploy/update.sh"
}

case "$TARGET" in
  web)  sync_web; rebuild_web ;;
  cogs) sync_cogs ;;
  all)  sync_web; sync_cogs; rebuild_web ;;
esac

echo
echo "==> Fertig."
if [ "$TARGET" != "web" ]; then
  echo "    Hinweis: Cog-Änderungen im Discord aktivieren, z. B.:"
  echo "    [p]reload webdashboard reactionrole channeljoinnotification wowtools wowguild_automation adminprotocol"
fi
