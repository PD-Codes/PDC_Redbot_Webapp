# Deploy — Linux-Service (systemd)

> 🇩🇪 Deutsch — 🇬🇧 English below.

## 🇩🇪 Schnellstart (Copy/Paste)

Auf dem Server, im Projektordner (z. B. `/opt/pdc/pdc-redbot-webapp`):

```bash
# 1) .env anlegen und ausfüllen (einmalig)
cp .env.example .env && nano .env

# 2) Service bauen + einrichten + starten
sudo bash deploy/install-service.sh
```

Das Skript ist **idempotent**: legt bei Bedarf den System-User `pdc` an, baut die App
(`npm ci && npm run build`), schreibt die systemd-Unit, aktiviert und startet sie.

Anpassbar über Umgebungsvariablen:
```bash
APP_DIR=/opt/pdc/pdc-redbot-webapp SERVICE_USER=pdc SERVICE_NAME=pdc-redbot-webapp \
  sudo -E bash deploy/install-service.sh
```

**Danach:**
```bash
journalctl -u pdc-redbot-webapp -f          # Live-Logs
sudo systemctl restart pdc-redbot-webapp    # Neustart
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
`pdc-redbot-webapp.service` nach `/etc/systemd/system/` kopieren, Pfade/User anpassen, dann:
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now pdc-redbot-webapp
```

### Migration von der alten DKS-Installation

Eine bestehende Installation läuft evtl. noch unter dem alten Dienst `dks-dashboard`
(System-User `dks`, z. B. `/opt/dks/redbot-dks-dashboard`). systemd-Units lassen sich
nicht einfach umbenennen, daher ist alles **rückwärtskompatibel**:

- `deploy/update.sh` **erkennt automatisch**, welcher Dienst aktiv ist
  (`pdc-redbot-webapp` **oder** `dks-dashboard`) und verwendet ihn samt passendem User.
- Beim Update wird `origin` automatisch auf das neue Repo umgestellt
  (`https://github.com/PD-Codes/PDC_Redbot_Webapp`), sodass die alte Installation
  ab sofort aus den **neuen** Repos zieht. Überschreibbar via `REPO_URL=…`.
- Die `/system`-Seite zeigt eine **Empfehlung**, auf die neuen Repos zu wechseln und
  die neuen Cogs zu installieren/verwenden.

Die alte Installation funktioniert unverändert weiter. Für einen **vollständigen Wechsel**
auf `pdc-redbot-webapp` (neuer Dienstname/User/Pfad):

```bash
# alten Dienst stoppen/deaktivieren
sudo systemctl disable --now dks-dashboard
# neu einrichten (kopiert/baut ins neue Verzeichnis; .env übernehmen)
APP_DIR=/opt/pdc/pdc-redbot-webapp SERVICE_USER=pdc SERVICE_NAME=pdc-redbot-webapp \
  sudo -E bash deploy/install-service.sh
# alte Unit-Datei entfernen (optional)
sudo rm -f /etc/systemd/system/dks-dashboard.service && sudo systemctl daemon-reload
```

---

## 🇬🇧 Quick start (copy/paste)

On the server, inside the project folder (e.g. `/opt/pdc/pdc-redbot-webapp`):

```bash
# 1) create and fill .env (once)
cp .env.example .env && nano .env

# 2) build + install + start the service
sudo bash deploy/install-service.sh
```

The script is **idempotent**: creates the `pdc` system user if needed, builds the app
(`npm ci && npm run build`), writes the systemd unit, enables and starts it.

Configurable via environment variables:
```bash
APP_DIR=/opt/pdc/pdc-redbot-webapp SERVICE_USER=pdc SERVICE_NAME=pdc-redbot-webapp \
  sudo -E bash deploy/install-service.sh
```

**Afterwards:**
```bash
journalctl -u pdc-redbot-webapp -f          # live logs
sudo systemctl restart pdc-redbot-webapp    # restart
sudo bash deploy/update.sh              # update: pull + build + restart
```

### Notes
- The service loads `.env` via `EnvironmentFile=` (so `node build` needs **no** dotenv here).
- Behind an HTTPS reverse proxy, add to `.env`:
  `ORIGIN=https://your-domain`, `PROTOCOL_HEADER=x-forwarded-proto`,
  `HOST_HEADER=x-forwarded-host`.
- systemd `.env` format: one `KEY=value` per line, **no** `export`, no quotes.

### Manual (no script)
Copy `pdc-redbot-webapp.service` to `/etc/systemd/system/`, adjust paths/user, then:
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now pdc-redbot-webapp
```

### Migration from the old DKS install

An existing install may still run under the old service `dks-dashboard` (system user
`dks`, e.g. `/opt/dks/redbot-dks-dashboard`). systemd units cannot simply be renamed,
so everything is **backwards compatible**:

- `deploy/update.sh` **auto-detects** which service is active (`pdc-redbot-webapp`
  **or** `dks-dashboard`) and uses it together with its matching user.
- On update, `origin` is automatically repointed to the new repo
  (`https://github.com/PD-Codes/PDC_Redbot_Webapp`), so the old install now pulls from
  the **new** repos. Override with `REPO_URL=…`.
- The `/system` page shows a **recommendation** to switch to the new repos and to
  install/use the new cogs.

The old install keeps working unchanged. For a **full switch** to `pdc-redbot-webapp`
(new service name/user/path):

```bash
# stop/disable the old service
sudo systemctl disable --now dks-dashboard
# set up fresh (builds into the new directory; carry over your .env)
APP_DIR=/opt/pdc/pdc-redbot-webapp SERVICE_USER=pdc SERVICE_NAME=pdc-redbot-webapp \
  sudo -E bash deploy/install-service.sh
# remove the old unit file (optional)
sudo rm -f /etc/systemd/system/dks-dashboard.service && sudo systemctl daemon-reload
```
