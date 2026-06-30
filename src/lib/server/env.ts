import { env } from '$env/dynamic/private';

/** Serverseitige Konfiguration (niemals an den Client ausliefern). */
export const config = {
  // Discord OAuth2
  discordClientId: env.DISCORD_CLIENT_ID ?? '',
  discordClientSecret: env.DISCORD_CLIENT_SECRET ?? '',
  discordRedirectUri: env.DISCORD_REDIRECT_URI ?? 'http://localhost:5173/auth/callback',

  // RPC-Gateway (Companion-Cog)
  gatewayUrl: env.GATEWAY_URL ?? 'http://127.0.0.1:6970',
  gatewayToken: env.GATEWAY_TOKEN ?? '',

  // Session
  sessionSecret: env.SESSION_SECRET ?? 'CHANGE_ME_dev_only_secret',
  cookieName: 'pdc_session',
  sessionMaxAge: 60 * 60 * 24 * 7 // 7 Tage
};

// FAIL-CLOSED: In Produktion ohne echtes SESSION_SECRET NICHT starten – sonst sind
// Session-Cookies mit dem öffentlich bekannten Default-Secret fälschbar (Identitäts-Spoofing).
const _isProd = (env.NODE_ENV ?? '') === 'production';
if (_isProd && (!env.SESSION_SECRET || config.sessionSecret === 'CHANGE_ME_dev_only_secret')) {
  throw new Error(
    'SESSION_SECRET ist in Produktion nicht gesetzt. Abbruch: ohne starkes Secret könnten ' +
      'Sessions gefälscht werden. Setze SESSION_SECRET (z. B. `openssl rand -hex 32`).'
  );
}

export function assertConfig(): string[] {
  const missing: string[] = [];
  if (!config.discordClientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.discordClientSecret) missing.push('DISCORD_CLIENT_SECRET');
  if (!config.gatewayToken) missing.push('GATEWAY_TOKEN');
  if (config.sessionSecret === 'CHANGE_ME_dev_only_secret') missing.push('SESSION_SECRET');
  return missing;
}
