import type { LayoutServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';

type NavPage = { slug: string; title: string; nav: boolean; visibility: string };
type ModulePage = { key: string; name: string; icon: string | null };
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

// Global cog pages for the "Module (Cog) Sites" menu. Permission-filtered per user,
// so cache per (user, locale) with a short TTL to keep navigation snappy.
const _modCache = new Map<string, { at: number; pages: ModulePage[] }>();

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
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

  // Global cog pages for the sidebar (only for logged-in users; permission-filtered).
  let modulePages: ModulePage[] = [];
  if (locals.user) {
    const uiLocale = cookies.get('locale') || '';
    const ckey = `${locals.user.id}:${uiLocale}`;
    const hit = _modCache.get(ckey);
    if (hit && now - hit.at <= TTL_MS) {
      modulePages = hit.pages;
    } else {
      try {
        const m = await rpc<{ contributions: Array<Record<string, unknown>> }>(
          'manifest.get',
          {},
          authFromUser(locals.user, null, uiLocale)
        );
        modulePages = (m.contributions ?? [])
          .filter(
            (c) => c.kind === 'page' && (c.scope ?? 'guild') === 'global' && c.nav !== false
          )
          .map((c) => ({ key: c.key as string, name: c.name as string, icon: (c.icon as string) ?? null }));
        _modCache.set(ckey, { at: now, pages: modulePages });
      } catch {
        modulePages = hit?.pages ?? [];
      }
    }
  }

  return { user: locals.user, pages: _cache.pages, branding: _cache.branding, modulePages };
};
