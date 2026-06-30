#!/usr/bin/env bash
#
# DKS Redbot WebApp – Update/Redeploy: Code holen, neu bauen, Dienst neu starten.
#
# Funktioniert in zwei Modi:
#   1) Als root:               sudo bash deploy/update.sh
#   2) Als Dienst-User:        bash deploy/update.sh   (so triggert es das Web-Panel)
#
# Im Web-Panel-Modus laeuft das Script bereits als der User, dem die App gehoert.
# Es wird dann KEIN "sudo -u" benoetigt; nur der Dienst-Neustart braucht Rechte
# (sudoers NOPASSWD, siehe deploy/README bzw. unten).
#
set -euo pipefail

# Bei jedem Abbruch einen Fehler-Marker schreiben, damit das Web-Panel den
# Fehlschlag sofort erkennt (statt in einen Timeout zu laufen).
trap 'echo "===UPDATE_ERROR==="' ERR

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SERVICE_USER="${SERVICE_USER:-dks}"
SERVICE_NAME="${SERVICE_NAME:-dks-dashboard}"

cd "$APP_DIR"

CUR_USER="$(id -un)"
IS_ROOT=0
[ "$(id -u)" -eq 0 ] && IS_ROOT=1

# Fuehrt einen Befehl als Dienst-User aus.
#  - Als root:        via "sudo -u".
#  - Als Dienst-User: direkt (wir SIND schon der richtige User).
#  - Sonst:           direkt (best effort).
as_service() {
  if [ "$IS_ROOT" -eq 1 ] && [ "$CUR_USER" != "$SERVICE_USER" ]; then
    sudo -u "$SERVICE_USER" "$@"
  else
    "$@"
  fi
}

# git ohne "dubious ownership"-Abbruch (egal welcher User das Repo besitzt) und ohne
# die globalen ignore/attributes-Dateien zu lesen – sonst gibt es "Permission denied"-
# Warnungen, wenn der Dienst-User nicht an ~/.config/git herankommt. /dev/null ist immer
# lesbar und leer, daher verschwinden die Warnungen ohne Funktionsverlust.
GIT=(git -c "safe.directory=$APP_DIR" -c "safe.directory=*" \
     -c "core.excludesFile=/dev/null" -c "core.attributesFile=/dev/null")

# Aktuellen Stand holen (nur wenn es ein Git-Repo ist).
# Ein Deploy-Checkout soll GitHub exakt spiegeln, daher fetch + hard reset
# statt "pull": so blockieren lokale Aenderungen an getrackten Dateien das
# Update NIE (untrackte Dateien wie .env bleiben unangetastet).
if [ -d .git ]; then
  echo "==> git fetch"
  as_service "${GIT[@]}" fetch --prune origin
  BRANCH="${DEPLOY_BRANCH:-$(as_service "${GIT[@]}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
  echo "==> git reset --hard origin/${BRANCH}"
  as_service "${GIT[@]}" reset --hard "origin/${BRANCH}"
fi

echo "==> Build"
NPM_CACHE="$APP_DIR/.npm-cache"
mkdir -p "$NPM_CACHE"
# Besitz nur korrigieren, wenn wir root sind (sonst nicht noetig/erlaubt).
if [ "$IS_ROOT" -eq 1 ]; then
  chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR" 2>/dev/null || true
fi
NPM_ENV=(HOME="$APP_DIR" XDG_CACHE_HOME="$APP_DIR/.cache" npm_config_cache="$NPM_CACHE")
if ! as_service env "${NPM_ENV[@]}" npm ci; then
  as_service env "${NPM_ENV[@]}" npm install
fi
as_service env "${NPM_ENV[@]}" npm run build

# Marker fuer das Web-Panel: Build erfolgreich abgeschlossen (vor dem Neustart).
echo "===UPDATE_DONE==="

echo "==> Dienst neu starten"
if [ "$IS_ROOT" -eq 1 ]; then
  systemctl restart "${SERVICE_NAME}"
  systemctl --no-pager --full status "${SERVICE_NAME}" || true
elif systemctl restart "${SERVICE_NAME}" 2>/dev/null; then
  # Funktioniert ohne sudo, wenn eine polkit-Regel den User berechtigt.
  echo "Dienst neu gestartet (via systemd/polkit)."
elif sudo -n systemctl restart "${SERVICE_NAME}" 2>/dev/null; then
  echo "Dienst neu gestartet (via sudo)."
else
  echo "===RESTART_SKIPPED==="
  echo "!! Konnte den Dienst nicht selbst neu starten."
  echo "!! Dein sudo liegt auf einem 'nosuid'-Mount und kann nicht root werden;"
  echo "!! eine sudoers-Regel hilft daher NICHT. Empfohlen: polkit-Regel anlegen."
  echo "!! /etc/polkit-1/rules.d/49-${SERVICE_NAME}.rules:"
  echo "!!   polkit.addRule(function(action, subject) {"
  echo "!!     if (action.id == \"org.freedesktop.systemd1.manage-units\" &&"
  echo "!!         action.lookup(\"unit\") == \"${SERVICE_NAME}.service\" &&"
  echo "!!         subject.user == \"${CUR_USER}\") { return polkit.Result.YES; }"
  echo "!!   });"
  echo "!! Oder starte manuell:  systemctl restart ${SERVICE_NAME}"
fi
