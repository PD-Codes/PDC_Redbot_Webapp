import type { PageServerLoad } from './$types';
import { rpc } from '$lib/server/rpc';
import { toPublicUser } from '$lib/server/session';

// Öffentliche Seite: ohne Login erreichbar. Zeigt nur aktive Commands.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  let data: any = { bot: null, prefix: [], slash: [], counts: { prefix: 0, slash: 0 } };
  let online = true;
  try {
    data = await rpc('core.commands', {
      locale: cookies.get('locale') ?? 'en-US',
      include_orphans: !!locals.user
    });
  } catch {
    online = false;
  }
  // Only expose the whitelisted public fields — never the OAuth tokens.
  return { commands: data, online, user: toPublicUser(locals.user) };
};
