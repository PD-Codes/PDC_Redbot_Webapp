import type { PageServerLoad } from './$types';
import { rpc } from '$lib/server/rpc';

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
  return { commands: data, online, user: locals.user };
};
