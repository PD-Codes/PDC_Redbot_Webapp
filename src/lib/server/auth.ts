import crypto from 'node:crypto';
import { config } from './env';
import type { SessionUser } from './session';

const DISCORD_API = 'https://discord.com/api/v10';
const SCOPES = ['identify', 'guilds'];

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.discordRedirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state
    // kein prompt:'none' – sonst schlägt der ERSTE Login mit consent_required fehl.
  });
  return `${DISCORD_API}/oauth2/authorize?${params}`;
}

export function newState(): string {
  return crypto.randomBytes(16).toString('hex');
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.discordClientId,
      client_secret: config.discordClientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.discordRedirectUri
    })
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    // 401/invalid_client => falsche CLIENT_ID/SECRET; redirect_uri-Mismatch => invalid_grant
    throw new Error(`Token-Austausch fehlgeschlagen: ${res.status} ${detail}`.trim());
  }
  return res.json();
}

export async function fetchDiscordUser(accessToken: string): Promise<SessionUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`Discord-User konnte nicht geladen werden: ${res.status}`);
  const u = await res.json();
  const avatar = u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
    : null;
  return {
    id: u.id,
    username: u.username,
    globalName: u.global_name ?? null,
    avatar,
    accessToken,
    expiresAt: 0,
    locale: u.locale?.startsWith('de') ? 'de-DE' : 'en-US'
  };
}
