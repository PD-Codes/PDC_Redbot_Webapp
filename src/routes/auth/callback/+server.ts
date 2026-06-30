import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCode, fetchDiscordUser } from '$lib/server/auth';
import { setSession } from '$lib/server/session';
import { config } from '$lib/server/env';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = cookies.get('oauth_state');

  if (!code || !state || state !== expected) {
    throw error(400, 'Ungültiger OAuth2-State (CSRF-Schutz).');
  }
  cookies.delete('oauth_state', { path: '/' });

  let token, user;
  try {
    token = await exchangeCode(code);
    user = await fetchDiscordUser(token.access_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Saubere Fehlerseite statt 500 – mit Discords echter Antwort zur Diagnose.
    throw error(
      400,
      `Discord-Login fehlgeschlagen. Prüfe DISCORD_CLIENT_ID/SECRET und die Redirect-URI. Details: ${msg}`
    );
  }

  user.refreshToken = token.refresh_token;
  user.expiresAt = Date.now() + token.expires_in * 1000;
  user.iat = Date.now();

  setSession(cookies, user);
  throw redirect(302, '/');
};
