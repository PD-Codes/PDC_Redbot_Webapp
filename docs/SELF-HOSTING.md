# Self-Hosting Guide — PDC Redbot Webapp

This guide walks you through a full self-hosted setup: Red-DiscordBot, the
`pdc_webdashboard` companion cog (the RPC gateway), and this SvelteKit web
dashboard — either with Docker Compose or natively with Node.js.

## Architecture at a glance

```
Browser ── HTTPS ──> Webapp (SvelteKit, adapter-node, port 3000)
                        │  JSON-RPC over HTTP + WebSocket/SSE
                        ▼
                     RPC gateway (pdc_webdashboard cog, default 127.0.0.1:6970)
                        │
                        ▼
                     Red-DiscordBot ── Discord
```

## 1. Prerequisites

- A Discord account and a server where you have admin rights
- **Docker + Docker Compose v2** (recommended), or:
  - Python 3.11+ (for a native Red install)
  - Node.js 20+ and npm (for a native webapp install)
- Optional but recommended for production: a domain and a reverse proxy
  (nginx or Caddy) with TLS

## 2. Create the Discord application

1. Open <https://discord.com/developers/applications> and click **New Application**.
2. **Bot** tab:
   - Click **Reset Token** and save the token — this is `DISCORD_BOT_TOKEN`.
   - Enable the **Privileged Gateway Intents** your cogs need
     (Server Members and Message Content are typically required by Red).
3. **OAuth2** tab:
   - Copy the **Client ID** → `DISCORD_CLIENT_ID`.
   - Click **Reset Secret**, copy the **Client Secret** → `DISCORD_CLIENT_SECRET`.
   - Under **Redirects**, add the webapp callback URL **exactly** as the webapp
     will use it:
     - Development: `http://localhost:5173/auth/callback`
     - Docker (no proxy): `http://localhost:3000/auth/callback`
     - Production: `https://dashboard.example.com/auth/callback`
4. Invite the bot to your server (OAuth2 URL Generator → scopes `bot` +
   `applications.commands`, pick permissions, open the generated URL).

## 3. Install Red-DiscordBot

### Option A — Docker (via this repo's compose stack)

The included `docker-compose.yml` starts Red using the official
`phasecorex/red-discordbot:full` image plus the webapp. Skip to step 6
("Run with Docker Compose") and then come back to step 4 to install the cogs
inside the running bot.

### Option B — Native

Follow the official docs: <https://docs.discord.red/en/stable/install_guides/index.html>

```bash
python3 -m venv ~/redenv
source ~/redenv/bin/activate
python -m pip install -U pip Red-DiscordBot
redbot-setup            # create an instance
redbot <instance-name>  # start it, paste your bot token and prefix
```

## 4. Install the PDC cogs

In Discord, as bot owner (replace `[p]` with your prefix):

```
[p]load downloader
[p]repo add pdc-cogs https://github.com/PD-Codes/PDC_Redbot_Cogs
[p]cog install pdc-cogs pdc_webdashboard
[p]load pdc_webdashboard

# Optional: powers the /stats page of the webapp
[p]cog install pdc-cogs pdc_webdashboard_stats
[p]load pdc_webdashboard_stats
```

Game/extra cogs live in `https://github.com/PD-Codes/PDC_Redbot_Game_Cogs`
and can be added the same way.

## 5. Configure the gateway (cog side)

```
# Show / generate the shared secret. Copy it into the webapp .env (GATEWAY_TOKEN).
[p]pdcdashboard token

# The gateway binds to 127.0.0.1:6970 by default. That is fine when webapp and
# bot run on the same host. If the webapp runs in Docker and the bot in another
# container (the compose stack in this repo), bind to all interfaces:
[p]pdcdashboard bind 0.0.0.0 6970
# ...then reload the cog or restart the bot for the bind to take effect.
```

Security note: only expose the gateway on interfaces the webapp actually needs.
Inside the compose stack, the port is reachable on the internal Docker network
only — do not publish it to the internet.

## 6. Configure the webapp

```bash
cp .env.example .env
```

Fill in at minimum:

| Variable | Value |
| --- | --- |
| `DISCORD_CLIENT_ID` | from the Developer Portal |
| `DISCORD_CLIENT_SECRET` | from the Developer Portal |
| `DISCORD_REDIRECT_URI` | must match a Redirect in the portal exactly |
| `GATEWAY_URL` | `http://redbot:6970` (compose) / `http://127.0.0.1:6970` (same host) / `http://host.docker.internal:6970` (webapp in Docker, bot on host) |
| `GATEWAY_TOKEN` | output of `[p]pdcdashboard token` |
| `SESSION_SECRET` | `openssl rand -hex 32` — required in production |
| `ORIGIN` | your public URL when behind a reverse proxy |

For the compose stack also set `DISCORD_BOT_TOKEN` (and optionally
`BOT_PREFIX`) in `.env` — they are consumed by the `redbot` service.

## 7. Run

### Docker Compose (recommended)

```bash
docker compose up -d --build
docker compose logs -f webapp   # check for startup errors
```

The dashboard is now on `http://localhost:3000`. Red's first start asks no
questions when `TOKEN`/`PREFIX` env vars are set.

### Native (Node.js)

```bash
npm ci        # or: npm install
npm run build # adapter-node output in ./build
node build    # respects HOST, PORT, ORIGIN and the .env values
```

For a systemd service see `deploy/pdc-redbot-webapp.service` and
`deploy/install-service.sh`.

## 8. Reverse proxy (production)

The webapp uses long-lived streaming connections on `/api/events`
(SSE/WebSocket). Your proxy must not buffer or time out these requests.

### Caddy (simplest — automatic TLS)

```caddy
dashboard.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy handles WebSockets and streaming out of the box. Set
`ORIGIN=https://dashboard.example.com` in `.env`.

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name dashboard.example.com;
    # ssl_certificate ...; ssl_certificate_key ...;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # WebSocket upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # SSE / event stream: disable buffering, extend timeouts
    location /api/events {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
        chunked_transfer_encoding off;
    }
}
```

Remember to update `DISCORD_REDIRECT_URI` (and the portal Redirect) to the
`https://` URL and set `ORIGIN`.

## 9. Troubleshooting

**"Gateway offline" / dashboard shows no bot data**
- Is the cog loaded? `[p]cog list` / `[p]load pdc_webdashboard`.
- Does `GATEWAY_URL` point where the gateway actually listens?
  Check the bot log for `RPC gateway running on http://<host>:<port>`.
- Webapp in Docker + bot on host: `127.0.0.1` inside the container is the
  container itself — use `http://host.docker.internal:6970` and make sure the
  gateway is bound to an address the container can reach (not only 127.0.0.1
  on the host; bind to `0.0.0.0` or the docker bridge IP).
- Compose stack: `GATEWAY_URL=http://redbot:6970` and
  `[p]pdcdashboard bind 0.0.0.0 6970`.
- Test from the webapp host/container: `curl -i http://<gateway-host>:6970/rpc`
  (any HTTP answer means the port is reachable).

**Discord OAuth error: "Invalid OAuth2 redirect_uri"**
- `DISCORD_REDIRECT_URI` must match a Redirect entry in the Developer Portal
  **character for character** (scheme, host, port, path, no trailing slash
  differences).
- Behind a proxy, the redirect must use the public `https://` URL, and
  `ORIGIN` must be set accordingly.

**401 / Unauthorized from the gateway (token mismatch)**
- `GATEWAY_TOKEN` in `.env` must equal the current cog token. Tokens can be
  rotated with `[p]pdcdashboard token` — after rotating, update `.env` and
  restart the webapp (`docker compose restart webapp`).
- Watch for trailing whitespace/newlines when pasting the token.

**Webapp refuses to start: "SESSION_SECRET ist in Produktion nicht gesetzt"**
- In production (`NODE_ENV=production`) a real `SESSION_SECRET` is mandatory.
  Generate one: `openssl rand -hex 32`.

**Login works but live updates (logs/stats) stall behind nginx**
- Ensure the `/api/events` location has `proxy_buffering off` and the
  `Upgrade`/`Connection` headers as in the snippet above.

**Red in Docker: how do I run owner commands?**
- Either in Discord as the bot owner, or attach to the container:
  `docker attach pdc-redbot` (detach with `Ctrl-p Ctrl-q`).
