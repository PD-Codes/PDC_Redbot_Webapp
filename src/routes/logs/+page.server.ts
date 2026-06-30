import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';

export interface LogEntry {
  time: number;
  level: string;
  levelno: number;
  logger: string;
  message: string;
  exc: string | null;
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

  let logs: LogEntry[] = [];
  if (isOwner) {
    try {
      const r = await rpc<{ logs: LogEntry[] }>('logs.list', { limit: 300 }, auth);
      logs = r.logs ?? [];
    } catch {
      /* ignore */
    }
  }
  return { isOwner, logs };
};
