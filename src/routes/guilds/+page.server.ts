import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  let guilds: unknown[] = [];
  let online = true;
  try {
    const r = await rpc<{ guilds: unknown[] }>('core.guilds', {}, authFromUser(locals.user));
    guilds = r.guilds;
  } catch {
    online = false;
  }
  return { guilds, online };
};
