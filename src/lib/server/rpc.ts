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

// Hard timeout per RPC call. Without it a blocked gateway call (e.g. a cog handler
// blocking the bot event loop) would hang the Node request forever and the reverse
// proxy would answer with 502 "Bad Gateway". With the timeout we quickly get a clean
// error instead (widget/page shows a message rather than a 502).
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
      throw new RpcError(504, `Gateway timeout (${method}) after ${timeoutMs} ms`);
    }
    throw new RpcError(502, `Gateway unreachable (${method})`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new RpcError(res.status, `Gateway HTTP error ${res.status}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new RpcError(json.error.code, json.error.message, json.error.data);
  }
  return json.result as T;
}

/** True for transport-level failures (gateway down/slow), false for real
 * application errors returned by the gateway. */
export function isTransientRpcError(e: unknown): boolean {
  return e instanceof RpcError && (e.code === 502 || e.code === 504);
}

/** RPC with a small retry for TRANSIENT transport failures. Only use this for
 * read-only methods – mutations must not be replayed blindly. */
export async function rpcWithRetry<T = unknown>(
  method: string,
  args: Record<string, unknown> = {},
  auth?: RpcAuth,
  retries = 1,
  timeoutMs: number = RPC_TIMEOUT_MS
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await rpc<T>(method, args, auth, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (!isTransientRpcError(e) || attempt === retries) throw e;
      // Brief backoff before retrying (gateway may be restarting).
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
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
