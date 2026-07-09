import type { PageServerLoad } from './$types';
import { rpc } from '$lib/server/rpc';
import { toPublicUser } from '$lib/server/session';

// Öffentliche Landing/Übersicht: Hero + Kennzahlen + aktive Befehle.
// Kein Redirect – Eingeloggte erreichen das Dashboard über die Navigation.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  let commands: { bot: unknown; prefix: unknown[]; slash: unknown[] } = {
    bot: null,
    prefix: [],
    slash: []
  };
  let stats: unknown = null;
  let online = true;

  try {
    commands = await rpc('core.commands', { locale: cookies.get('locale') ?? 'en-US' });
    stats = await rpc('core.stats', {});
  } catch {
    online = false;
  }

  // Only expose the whitelisted public fields — never the OAuth tokens.
  return { commands, stats, online, user: toPublicUser(locals.user) };
};
