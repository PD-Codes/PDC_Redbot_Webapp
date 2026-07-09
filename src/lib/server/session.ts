import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { config } from './env';

export interface SessionUser {
  id: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
  // OAuth2 access token is kept server-side in the encrypted session cookie only.
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  locale: string;
  iat?: number; // Ausstellungszeitpunkt (ms) – für "Sessions zurücksetzen"
}

/** Client-safe subset of the session user — MUST NOT contain OAuth tokens. */
export interface PublicUser {
  id: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
  locale: string;
}

/** Strip server-only fields (OAuth tokens etc.) before exposing a user to the client. */
export function toPublicUser(user: SessionUser | null): PublicUser | null {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    globalName: user.globalName ?? null,
    avatar: user.avatar ?? null,
    locale: user.locale
  };
}

// AES-256-GCM-encrypted session cookie (stateless, no DB needed). The key is
// derived from SESSION_SECRET via HKDF-SHA256; GCM both encrypts (the OAuth
// tokens inside are not readable from the cookie) and authenticates the payload.
// Format: `v2.<iv>.<ciphertext>.<authTag>` (all parts base64url).
const sessionKey = Buffer.from(
  crypto.hkdfSync('sha256', config.sessionSecret, '', 'pdc-session-cookie-v2', 32)
);

export function encodeSession(user: SessionUser): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(user), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const parts = token.split('.');
  // Only the encrypted v2 format is accepted. Legacy (signed-only) cookies are
  // simply invalid — the user just logs in again.
  if (parts.length !== 4 || parts[0] !== 'v2') return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[3], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(Buffer.from(parts[2], 'base64url')),
      decipher.final()
    ]).toString('utf8');
    const user = JSON.parse(plain) as SessionUser;
    if (user.expiresAt && user.expiresAt < Date.now()) return null;
    return user;
  } catch {
    // Wrong key, tampered/truncated token or legacy format — treat as no session.
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
