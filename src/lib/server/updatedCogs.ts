/** Tracks cogs that were updated through the webapp since the bot's monitor
 * last ran. The gateway's `monitor_last.cogs` list is only refreshed by the
 * bot's periodic check, so right after an update it still lists the cog as
 * outdated – which made the sidebar badge show a stale count. The monitor
 * endpoint filters those out until the next real check supersedes them. */
const _updatedAt = new Map<string, number>(); // cog name (lowercase) -> updated at (unix seconds)

export function recordCogUpdated(cog: string): void {
  if (cog) _updatedAt.set(cog.toLowerCase(), Math.floor(Date.now() / 1000));
}

/** Remove cogs from `cogs` that were updated via the webapp AFTER the bot's
 * last monitor check (checkedAt, unix seconds). */
export function filterRecentlyUpdated(cogs: string[], checkedAt: number): string[] {
  return (cogs ?? []).filter((c) => {
    const at = _updatedAt.get(String(c).toLowerCase());
    return !at || at <= (checkedAt || 0);
  });
}
