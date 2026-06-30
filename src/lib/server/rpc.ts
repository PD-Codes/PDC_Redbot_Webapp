import { config } from './env';
import type { SessionUser } from './session';

/** JSON-RPC-2.0-Client (HTTP POST) zum Gateway des Companion-Cogs. */
let _id = 0;

export interface RpcAuth {
  user_id: string;
  guild_id?: string | null;
  locale?: string;
}

export class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
  }
}

// Hartes Timeout pro RPC-Aufruf. Ohne das hängt ein blockierter Gateway-Call (z. B.
// ein Cog-Handler, der die Bot-Event-Loop blockiert) den Node-Request endlos – und der
// Reverse-Proxy antwortet dann mit 502 "Bad Gateway". Mit Timeout kommt stattdessen
// schnell ein sauberer Fehler zurück (Widget/Seite zeigt eine Meldung statt 502).
const RPC_TIMEOUT_MS = 15_000;

export async function rpc<T = unknown>(
  method: string,
  args: Record<string, unknown> = {},
  auth?: RpcAuth,
  timeoutMs: number = RPC_TIMEOUT_MS
): Promise<T> {
  const body = {
    jsonrpc: '2.0',
    id: ++_id,
    method,
    params: { auth: auth ?? null, args }
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${config.gatewayUrl}/rpc`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Dashboard-Token': config.gatewayToken
      },
      body: JSON.stringify(body),
      signal: ac.signal
    });
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') {
      throw new RpcError(504, `Gateway-Timeout (${method}) nach ${timeoutMs} ms`);
    }
    throw new RpcError(502, `Gateway nicht erreichbar (${method})`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new RpcError(res.status, `Gateway-HTTP-Fehler ${res.status}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new RpcError(json.error.code, json.error.message, json.error.data);
  }
  return json.result as T;
}

/** Hilfsfunktion: RPC im Kontext eines eingeloggten Users.
 * `localeOverride` (z. B. aus dem UI-Sprachumschalter) hat Vorrang vor der
 * Discord-Locale des Users – so folgen Modul-Texte der gewählten Webseiten-Sprache. */
export function authFromUser(
  user: SessionUser,
  guildId?: string | null,
  localeOverride?: string | null
): RpcAuth {
  return { user_id: user.id, guild_id: guildId ?? null, locale: localeOverride || user.locale };
}
