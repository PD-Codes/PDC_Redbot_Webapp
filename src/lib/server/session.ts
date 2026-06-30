import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { config } from './env';

export interface SessionUser {
  id: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
  // OAuth2-Access-Token wird serverseitig in der signierten Session gehalten
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  locale: string;
  iat?: number; // Ausstellungszeitpunkt (ms) – für "Sessions zurücksetzen"
}

/** HMAC-signiertes, base64url-kodiertes Session-Cookie (stateless, kein DB nötig). */
function sign(payload: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
}

export function encodeSession(user: SessionUser): string {
  const body = Buffer.from(JSON.stringify(user)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  // konstant-Zeit-Vergleich
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return null;
  try {
    const user = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionUser;
    if (user.expiresAt && user.expiresAt < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}

export function setSession(cookies: Cookies, user: SessionUser): void {
  cookies.set(config.cookieName, encodeSession(user), {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: config.sessionMaxAge
  });
}

export function clearSession(cookies: Cookies): void {
  cookies.delete(config.cookieName, { path: '/' });
}

export function readSession(cookies: Cookies): SessionUser | null {
  return decodeSession(cookies.get(config.cookieName));
}
