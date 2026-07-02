/** Remembers user IDs that were recently verified as bot owner via the gateway.
 * Needed for graceful degradation: owner-only cached data (e.g. persisted logs)
 * may only be served while the gateway is DOWN if the user was positively
 * verified as owner while it was still up. */
const _owners = new Map<string, number>(); // user id -> verified-at (ms)
const TTL_MS = 24 * 60 * 60 * 1000; // trust a positive owner check for 24 h

export function rememberOwner(userId: string, isOwner: boolean): void {
  if (isOwner) _owners.set(userId, Date.now());
  else _owners.delete(userId);
}

export function wasRecentlyOwner(userId: string): boolean {
  const at = _owners.get(userId);
  if (!at) return false;
  if (Date.now() - at > TTL_MS) {
    _owners.delete(userId);
    return false;
  }
  return true;
}
