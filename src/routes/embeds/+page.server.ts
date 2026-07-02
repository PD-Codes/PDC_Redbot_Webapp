import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';

export interface EmbedGuild {
  id: string;
  name: string;
  level: number;
}

// Embed builder — same access model as /announce: the gateway's announce.send
// and announce.channels require guild_admin (level 3), so only admin guilds
// are offered for sending. Composing/exporting works regardless.
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  let guilds: EmbedGuild[] = [];
  try {
    const r = await rpc<{ guilds: EmbedGuild[] }>('core.guilds', {}, authFromUser(locals.user));
    guilds = (r.guilds ?? []).filter((g) => g.level >= 3);
  } catch {
    /* gateway offline — composer still works, sending is disabled */
  }
  return { guilds };
};
