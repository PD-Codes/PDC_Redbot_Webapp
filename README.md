# PDC Redbot Webapp

A modern, modular and secure web dashboard (frontend + BFF) for the PDC Red-DiscordBot.
Counterpart to the companion cog `pdc_webdashboard` (repo `PDC_Redbot_Cogs`).

![Screenshot: PDC Redbot Webapp dashboard landing page](https://cdn.domekologe.eu/d6c3daa9-2e80-4cdb-8191-5c700b811e2e/0779ae9a-104a-46cd-a2cb-dc9d0c678485/7ebdc3a3-4e9e-4ca6-a8ec-4d2ca280a14d.png)

> 📖 **Full documentation:** [PDC_Redbot_Webapp Wiki](https://github.com/PD-Codes/PDC_Redbot_Webapp/wiki) (English & Deutsch)

- **Repository:** https://github.com/PD-Codes/PDC_Redbot_Webapp
- **Stack:** SvelteKit + TypeScript + TailwindCSS (shadcn-svelte tokens), adapter-node, Chart.js
- **Auth:** Discord OAuth2 (login in the SvelteKit server / BFF)
- **Transport to the bot:** JSON-RPC 2.0 via the cog's gateway (HTTP + WebSocket)
- **Languages:** German & English (switch in the top-right, fully translated UI)

```bash
git clone https://github.com/PD-Codes/PDC_Redbot_Webapp.git
cd PDC_Redbot_Webapp
```

Architecture details: `PDC_Redbot_Cogs/pdc_webdashboard/ARCHITECTURE.md`.

## Requirements — companion cog

The web app talks to the bot through the **`pdc_webdashboard`** cog (the RPC gateway).
Without it the dashboard has nothing to connect to. Install it on the bot from the
**[PDC_Redbot_Cogs](https://github.com/PD-Codes/PDC_Redbot_Cogs)** repo:

```
[p]repo add pdc-cogs https://github.com/PD-Codes/PDC_Redbot_Cogs
[p]cog install pdc-cogs pdc_webdashboard
[p]load pdc_webdashboard
[p]pdcdashboard token          # copy the token into the web app's .env (GATEWAY_TOKEN)
```

Optional: install **`pdc_webdashboard_stats`** (same repo) to power the `/stats` page.

## Features

- Public landing/overview + **command list** (no login; grouped by module, with a **category dropdown filter** — All / Admin / Moderator / Setup / User, auto-detected from each command's permission level — to show only one category at a time). The overview shows the bot's
  **Markdown** description (GitHub-flavored) and an **"Invite me"** button (the bot's OAuth
  invite, auto-built from the client id with `scope=bot+applications.commands&permissions=8`,
  overridable via the `invite_url` branding field).
- After login: **server overview**, per-guild bot settings, embedded **cog widgets,
  panels & lists** – one **module-with-tabs** per cog (create/view/edit/delete, e.g.
  reaction roles, WoW profiles).
- **Cog pages** (`@dashboard_page`): cogs can register full standalone pages with a
  declarative component tree (headings, text, tables, charts, grids) and optional
  **server-driven controls** (dropdowns). Global pages appear under the
  **Module (Cog) Sites** menu; guild-scoped pages as a button on the server page.
- **Automatic update check** (`/system` + Settings): a server-side scheduler checks the
  web app's GitHub version on a configurable interval (off / 1h / 2h / 4h / 8h / 16h / 24h).
  An **"update available" badge** shows on the *System* menu entry and page.
- **Automatic cog-update check + alerts** (Settings): the companion cog periodically
  checks installed cogs for updates (configurable interval); a **count badge** shows on
  the *Cogs* menu entry, and the bot can **DM the owner** on available cog updates or when
  memory usage crosses a configurable threshold.
- **Cog management** (`/cogs`): load/unload/**reload** cogs, **Downloader** (collapsible
  repos, **update check + per-cog "Update"**), **Slash** (grouped by cog, per-command/
  per-cog toggle incl. **disabled** commands, sync), **Global** (per-cog owner panels as tabs).
- **Statistics** (`/stats`): Statbot-style server analytics (overview, messages, voice,
  status, invites, activity, heatmaps, live "Now", peaks, leaderboard, retention,
  member/channel drilldown) with a server dropdown, time filter (up to 365 days) and
  Chart.js charts. Requires the **`pdc_webdashboard_stats`** cog (collects the data).
- **Announcements** (`/announce`): embed builder with live preview, send to a channel.
- **Settings** (`/settings`): global bot settings, branding (title/icon/color/theme),
  a **Markdown bot description**, a **website description (`short_desc`)** used as the HTML
  `<meta name="description">` and Open Graph description for SEO/link previews, an optional
  `invite_url` override, lock/refresh. The **favicon and OG image** come from the bot's avatar.
- **Navigation:** every menu entry has an icon; a bottom section adds external links opening
  in a new tab — **Documentation** (the GitHub Wiki), **GitHub: Dashboard** and **GitHub: Cogs** —
  plus an internal **Credits** link. Mobile gets the same menu via a hamburger drawer.
- **Credits** (`/credits`, public): attribution/licensing (MIT base template; AAA3A &
  Neuro Assassin#4779 under AGPLv3; Red-DiscordBot by Twentysix under GPLv3) with links to the
  policy documents in `documents/` (`Credits.md`, `Privacy Policy.md`, `Cookie Policy.md`,
  `Third Parties Disclaimer.md`).
- **Custom Pages** (`/pages`): **Markdown** editor with preview, **public/private** per
  page (private = logged-in only), appear in the navigation immediately.
- **System** (`/system`): bot health, versions, an optional GitHub self-updater, and a
  **"Check for updates"** button that compares the running version (from `package.json`) with
  the latest on the git remote and reports "up to date" / "update available".
- **Logs** (`/logs`, owner only): live view of the bot's recent log records (in-memory ring
  buffer attached while `pdc_webdashboard` is loaded) with a **level filter** (INFO/WARNING/ERROR),
  search and expandable tracebacks.
- **Live updates:** the overview/landing page uses **Server-Sent Events** (`/api/events`,
  polled server-side so the gateway token stays on the server) to push live server/user counts,
  uptime and online status — no client polling.
- **Confirmation dialogs** guard destructive actions (cog **uninstall**, **repo remove**) with a
  reusable modal (Esc/Enter, click-outside).

![Screenshot: the /stats analytics page](https://cdn.domekologe.eu/d6c3daa9-2e80-4cdb-8191-5c700b811e2e/0779ae9a-104a-46cd-a2cb-dc9d0c678485/9ee4d6a4-de8f-488b-a250-9c1229af8334.png)
![Screenshot: the /cogs management page](https://cdn.domekologe.eu/d6c3daa9-2e80-4cdb-8191-5c700b811e2e/0779ae9a-104a-46cd-a2cb-dc9d0c678485/183ca8ac-60eb-4f46-a47f-26968aac5046.png)
![Screenshot: a cog's module with tabs in the dashboard](https://cdn.domekologe.eu/d6c3daa9-2e80-4cdb-8191-5c700b811e2e/0779ae9a-104a-46cd-a2cb-dc9d0c678485/59f446db-aaad-4a75-a345-6907d0abe5bf.png)

## Development

```bash
npm install
cp .env.example .env      # fill in values (see below)
npm run dev               # http://localhost:5173
```

### `.env`
| Variable | Description |
|---|---|
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | From the Discord Developer Portal (OAuth2) |
| `DISCORD_REDIRECT_URI` | Must be registered exactly as a redirect in the portal |
| `GATEWAY_URL` | Address of the cog gateway (default `http://127.0.0.1:6970`) |
| `GATEWAY_TOKEN` | Get it on the bot with `[p]pdcdashboard token` |
| `SESSION_SECRET` | Long random secret, e.g. `openssl rand -hex 32` |
| `ENABLE_SELF_UPDATE` | `true` to enable the GitHub self-updater on `/system` |

## Production (recommended: `node build`, not `npm run dev`)

**Fastest path – ready-made Linux service via copy/paste:**
```bash
cp .env.example .env && nano .env     # configure once
sudo bash deploy/install-service.sh   # builds + installs the systemd service + starts it
```
Details/update script: `deploy/README.md`. Manual route:

```bash
npm ci
npm run build
node -r dotenv/config build      # starts adapter-node (default port 3000)
```

**Important gotchas (learned the hard way):**

1. **`node build` does NOT read `.env`.** adapter-node only uses real environment
   variables. Load them via `node -r dotenv/config build` (`npm i dotenv`),
   `set -a; . ./.env; set +a`, or systemd `EnvironmentFile=`.
2. **Behind an HTTPS reverse proxy** also set these (otherwise e.g. 403 on logout):
   ```dotenv
   ORIGIN=https://your-domain
   PROTOCOL_HEADER=x-forwarded-proto
   HOST_HEADER=x-forwarded-host
   ```
3. **A Tailwind config must exist.** Without `tailwind.config.(cjs|js)`, Tailwind only
   emits the base layer → the page is (almost) unstyled. Never delete it; commit it to git.
   With `"type":"module"`, `tailwind.config.cjs` (CommonJS) is the most robust.
4. **The proxy must pass `/_app/` through.** A single catch-all `location /` to the Node
   port is enough; no `root`/`try_files` intercepting `/_app/...`.
5. **CDN cache (e.g. Cloudflare):** assets are cached `immutable`. While iterating, purge
   the cache after rebuilds or use "Development Mode".

![Screenshot: dashboard running behind a reverse proxy on a custom domain](https://cdn.domekologe.eu/d6c3daa9-2e80-4cdb-8191-5c700b811e2e/0779ae9a-104a-46cd-a2cb-dc9d0c678485/5dc851e4-c3c0-4f5b-b1e9-02f0c0dd9f79.png)

### systemd
```ini
# /etc/systemd/system/pdc-redbot-webapp.service
[Unit]
Description=PDC Redbot Webapp
After=network.target
[Service]
WorkingDirectory=/opt/pdc/pdc-redbot-webapp
EnvironmentFile=/opt/pdc/pdc-redbot-webapp/.env
ExecStart=/usr/bin/node build
Restart=on-failure
User=pdc
[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now pdc-redbot-webapp
journalctl -u pdc-redbot-webapp -f
```

### Docker
```bash
cp .env.example .env
docker compose up -d --build      # http://localhost:3000
```
If the bot runs on the host: `GATEWAY_URL=http://host.docker.internal:6970` (compose maps
`host.docker.internal` via `extra_hosts`, also on Linux).

### nginx (reverse proxy)
```nginx
server {
    server_name your-domain;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

> Using Apache instead of nginx? Set `ProxyTimeout 60`/`Timeout 60` so slow gateway calls
> don't turn into a 502.

## Integrating your own cog

That's done on the **bot side** (Python), not here. Guide + template:
`PDC_Redbot_Cogs/pdc_webdashboard/INTEGRATION.md` and the `dashboardtemplate` cog.

## Structure
```
src/
  hooks.server.ts            Session from cookie + epoch check, 404 filter
  lib/server/                Server-side ONLY (secrets!): env, session, auth, rpc
  lib/components/            Widget, PanelForm, ListManager, ModuleTabs, ui/
  lib/components/charts/     Chart.js wrappers (Line/Bar/Donut/SeriesToggle) + Heatmap
  lib/i18n/                  de + en (full UI translation)
  lib/markdown.ts            safe Markdown→HTML renderer (Custom Pages)
  routes/
    +page.svelte             landing/overview (public)
    commands/                public command list
    guilds/ [id]/ settings/  server overview + bot settings (modules with tabs)
    cogs/                    cog management (Cogs/Slash/Downloader/Global)
    stats/                   server statistics (cog pdc_webdashboard_stats)
    announce/                announcement/embed builder
    settings/                global settings + branding
    pages/  p/[slug]/        Custom Pages (Markdown editor + public view)
    audit/  system/          audit log + bot health/self-updater
    auth/… logout            OAuth2 flow
    api/…                    BFF endpoints (call RPC, incl. /api/stats)
```
