import { readable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Overview {
  bot_name?: string | null;
  guild_count?: number;
  user_count?: number;
  loaded_cogs?: number;
  bot_uptime_s?: number | null;
  gateway_uptime_s?: number | null;
  locked?: boolean;
  [k: string]: unknown;
}

export interface LiveStatus {
  overview: Overview | null;
  online: boolean | null; // null = no event yet
}

// Single shared SSE connection (/api/events). Components subscribe to `liveStatus`
// and get pushed overview + online state. EventSource auto-reconnects on drop.
export const liveStatus = readable<LiveStatus>({ overview: null, online: null }, (set) => {
  if (!browser) return;
  let cur: LiveStatus = { overview: null, online: null };
  const es = new EventSource('/api/events');
  es.addEventListener('overview', (e) => {
    try {
      cur = { overview: JSON.parse((e as MessageEvent).data), online: true };
      set(cur);
    } catch {
      /* ignore malformed frame */
    }
  });
  es.addEventListener('gateway_error', () => {
    cur = { ...cur, online: false };
    set(cur);
  });
  return () => es.close();
});
