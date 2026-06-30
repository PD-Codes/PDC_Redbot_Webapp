import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export interface StatsGuild {
  id: string;
  name: string;
  icon: string | null;
  member_count: number;
  level: number;
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');

  let guilds: StatsGuild[] = [];
  try {
    const res = await rpc<{ guilds?: StatsGuild[] }>('core.guilds', {}, authFromUser(locals.user));
    guilds = res.guilds ?? [];
  } catch (e) {
    if (!(e instanceof RpcError)) throw e;
    // Gateway nicht erreichbar o. Ä. → leere Liste, Seite zeigt Hinweis.
    guilds = [];
  }

  return { guilds };
};
