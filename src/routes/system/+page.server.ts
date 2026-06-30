import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';
import pkg from '../../../package.json';

export interface SystemInfo {
  uptime_s: number | null;
  latency_ms: number | null;
  guild_count: number;
  user_count: number;
  cogs_loaded: number;
  cogs_available: number;
  contributions: number;
  shard_count: number;
  python: string | null;
  discord: string | null;
  red: string | null;
  memory_mb: number | null;
  gateway_host: string;
  gateway_port: number;
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  const auth = authFromUser(locals.user);

  let isOwner = false;
  try {
    const ov = await rpc<{ is_owner: boolean }>('dashboard.overview', {}, auth);
    isOwner = !!ov.is_owner;
  } catch {
    /* ignore */
  }

  let info: SystemInfo | null = null;
  let online = true;
  if (isOwner) {
    try {
      info = await rpc<SystemInfo>('system.info', {}, auth);
    } catch {
      online = false;
    }
  }
  return { isOwner, info, online, version: pkg.version };
};
