#!/usr/bin/env bash
#
# DKS Redbot WebApp – Linux-Service per Copy/Paste einrichten.
#
# Nutzung (auf dem Server, im Projektordner ausführen):
#   sudo bash deploy/install-service.sh
#
# Anpassbar über Umgebungsvariablen, z. B.:
#   APP_DIR=/opt/dks/redbot-dks-dashboard SERVICE_USER=dks sudo -E bash deploy/install-service.sh
#
set -euo pipefail

# ---- Konfiguration (Defaults) ----------------------------------------------
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SERVICE_USER="${SERVICE_USER:-dks}"
SERVICE_NAME="${SERVICE_NAME:-dks-dashboard}"

echo "==> App-Verzeichnis : $APP_DIR"
echo "==> Service-Name    : $SERVICE_NAME"
echo "==> Service-User    : $SERVICE_USER"

# ---- Vorbedingungen --------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte mit sudo/root ausführen." >&2
  exit 1
fi
NODE_BIN="$(command -v node || true)"
[ -z "$NODE_BIN" ] && { echo "node nicht gefunden – bitte Node.js (>=18) installieren." >&2; exit 1; }
echo "==> node            : $NODE_BIN ($("$NODE_BIN" -v))"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "WARNUNG: $APP_DIR/.env fehlt. Lege sie an (siehe .env.example), sonst startet der Dienst ohne Konfiguration." >&2
fi

# ---- Service-User anlegen (falls nötig) ------------------------------------
if ! id "$SERVICE_USER" &>/dev/null; then
  echo "==> Lege System-User '$SERVICE_USER' an"
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi
chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"

# ---- Abhängigkeiten + Build ------------------------------------------------
echo "==> Installiere Abhängigkeiten + baue (als $SERVICE_USER)"
cd "$APP_DIR"

# Der System-User hat evtl. kein Home -> npm einen schreibbaren Cache/HOME geben.
NPM_CACHE="$APP_DIR/.npm-cache"
mkdir -p "$NPM_CACHE"
NPM_ENV=(HOME="$APP_DIR" XDG_CACHE_HOME="$APP_DIR/.cache" npm_config_cache="$NPM_CACHE")

# Halb-installiertes node_modules sauber entfernen (vermeidet TAR-ENOENT-Fehler).
rm -rf "$APP_DIR/node_modules"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"

# Direkt npm aufrufen (kein 'bash -lc', sonst überschreibt der Login-Shell HOME).
if ! sudo -u "$SERVICE_USER" env "${NPM_ENV[@]}" npm ci; then
  echo "==> npm ci fehlgeschlagen (kein/altes lockfile?) – nutze npm install"
  sudo -u "$SERVICE_USER" env "${NPM_ENV[@]}" npm install
fi
sudo -u "$SERVICE_USER" env "${NPM_ENV[@]}" npm run build

# ---- systemd-Unit schreiben ------------------------------------------------
UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
echo "==> Schreibe $UNIT"
cat > "$UNIT" <<EOF
[Unit]
Description=DKS Redbot WebApp (SvelteKit/adapter-node)
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
# Lädt die .env automatisch in die Umgebung (node build liest .env NICHT selbst):
EnvironmentFile=${APP_DIR}/.env
ExecStart=${NODE_BIN} build
Restart=on-failure
RestartSec=5
User=${SERVICE_USER}
Group=${SERVICE_USER}

# Härtung
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

# ---- Starten ---------------------------------------------------------------
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"

echo
echo "==> Fertig. Status:"
systemctl --no-pager --full status "${SERVICE_NAME}" || true
echo
echo "Logs live ansehen:  journalctl -u ${SERVICE_NAME} -f"
echo "Neustart:           sudo systemctl restart ${SERVICE_NAME}"
