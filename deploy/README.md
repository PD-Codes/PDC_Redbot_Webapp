# Deploy — Linux-Service (systemd)

> 🇩🇪 Deutsch — 🇬🇧 English below.

## 🇩🇪 Schnellstart (Copy/Paste)

Auf dem Server, im Projektordner (z. B. `/opt/dks/redbot-dks-dashboard`):

```bash
# 1) .env anlegen und ausfüllen (einmalig)
cp .env.example .env && nano .env

# 2) Service bauen + einrichten + starten
sudo bash deploy/install-service.sh
```

Das Skript ist **idempotent**: legt bei Bedarf den System-User `dks` an, baut die App
(`npm ci && npm run build`), schreibt die systemd-Unit, aktiviert und startet sie.

Anpassbar über Umgebungsvariablen:
```bash
APP_DIR=/opt/dks/redbot-dks-dashboard SERVICE_USER=dks SERVICE_NAME=dks-dashboard \
  sudo -E bash deploy/install-service.sh
```

**Danach:**
```bash
journalctl -u dks-dashboard -f          # Live-Logs
sudo systemctl restart dks-dashboard    # Neustart
sudo bash deploy/update.sh              # Update: pull + build + restart
```

### Wichtig
- Der Dienst lädt die `.env` über `EnvironmentFile=` (deshalb braucht `node build` hier
  **kein** dotenv).
- Hinter HTTPS-Reverse-Proxy in die `.env`:
  `ORIGIN=https://deine-domain`, `PROTOCOL_HEADER=x-forwarded-proto`,
  `HOST_HEADER=x-forwarded-host`.
- `.env`-Format für systemd: pro Zeile `KEY=value`, **ohne** `export`, ohne Anführungszeichen.

### Manuell (ohne Skript)
`dks-dashboard.service` nach `/etc/systemd/system/` kopieren, Pfade/User anpassen, dann:
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now dks-dashboard
```

---

## 🇬🇧 Quick start (copy/paste)

On the server, inside the project folder (e.g. `/opt/dks/redbot-dks-dashboard`):

```bash
# 1) create and fill .env (once)
cp .env.example .env && nano .env

# 2) build + install + start the service
sudo bash deploy/install-service.sh
```

The script is **idempotent**: creates the `dks` system user if needed, builds the app
(`npm ci && npm run build`), writes the systemd unit, enables and starts it.

Configurable via environment variables:
```bash
APP_DIR=/opt/dks/redbot-dks-dashboard SERVICE_USER=dks SERVICE_NAME=dks-dashboard \
  sudo -E bash deploy/install-service.sh
```

**Afterwards:**
```bash
journalctl -u dks-dashboard -f          # live logs
sudo systemctl restart dks-dashboard    # restart
sudo bash deploy/update.sh              # update: pull + build + restart
```

### Notes
- The service loads `.env` via `EnvironmentFile=` (so `node build` needs **no** dotenv here).
- Behind an HTTPS reverse proxy, add to `.env`:
  `ORIGIN=https://your-domain`, `PROTOCOL_HEADER=x-forwarded-proto`,
  `HOST_HEADER=x-forwarded-host`.
- systemd `.env` format: one `KEY=value` per line, **no** `export`, no quotes.

### Manual (no script)
Copy `dks-dashboard.service` to `/etc/systemd/system/`, adjust paths/user, then:
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now dks-dashboard
```
