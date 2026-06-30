import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';

export interface AnnounceGuild {
  id: string;
  name: string;
  level: number;
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  let guilds: AnnounceGuild[] = [];
  try {
    const r = await rpc<{ guilds: AnnounceGuild[] }>('core.guilds', {}, authFromUser(locals.user));
    // Nur Server, auf denen der User mindestens Admin ist (Level 3).
    guilds = (r.guilds ?? []).filter((g) => g.level >= 3);
  } catch {
    /* ignore */
  }
  return { guilds };
};
