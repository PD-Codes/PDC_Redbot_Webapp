import type { LayoutServerLoad } from './$types';
import { rpc } from '$lib/server/rpc';

type NavPage = { slug: string; title: string; nav: boolean; visibility: string };
type Branding = {
  title?: string;
  icon?: string;
  description?: string;
  short_desc?: string;
  support_url?: string;
  color?: string;
  theme?: string;
  invite_url?: string;
  bot_avatar?: string | null;
};

// Modul-Cache: pages.list/dashboard.branding laufen sonst bei JEDER Navigation. Beides
// ändert sich selten → kurzer TTL spart pro Seitenaufruf RPC-Roundtrips + Config-Reads.
let _cache: { at: number; pages: NavPage[]; branding: Branding | null } = {
  at: 0,
  pages: [],
  branding: null
};
const TTL_MS = 30_000;

export const load: LayoutServerLoad = async ({ locals }) => {
  const now = Date.now();
  if (now - _cache.at > TTL_MS) {
    try {
      const [p, b] = await Promise.all([
        rpc<{ pages: NavPage[] }>('pages.list', {}),
        rpc<{ ui?: Record<string, string>; bot_avatar?: string; invite_url?: string }>(
          'dashboard.branding',
          {}
        )
      ]);
      // Flatten ui.* to the top level (components read branding.title/.description/…)
      // and carry the bot avatar (favicon) + invite URL.
      const branding: Branding | null = b
        ? { ...(b.ui ?? {}), bot_avatar: b.bot_avatar ?? null, invite_url: b.invite_url ?? '' }
        : null;
      _cache = { at: now, pages: p.pages ?? [], branding };
    } catch {
      // Gateway offline o. ä. – alten Cache behalten, aber TTL zurücksetzen.
      _cache = { at: now, pages: _cache.pages, branding: _cache.branding };
    }
  }
  return { user: locals.user, pages: _cache.pages, branding: _cache.branding };
};
