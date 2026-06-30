import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';

export interface AuditEntry {
  action: string;
  user_id: string | null;
  user: string | null;
  guild_id: string | null;
  guild: string | null;
  detail: Record<string, unknown>;
  time: number | null;
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

  let entries: AuditEntry[] = [];
  if (isOwner) {
    try {
      const r = await rpc<{ entries: AuditEntry[] }>('audit.list', { limit: 300 }, auth);
      entries = r.entries ?? [];
    } catch {
      /* ignore */
    }
  }
  return { isOwner, entries };
};
