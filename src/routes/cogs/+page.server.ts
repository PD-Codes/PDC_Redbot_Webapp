import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) throw redirect(302, '/login');
  const auth = authFromUser(locals.user);

  const out: {
    cogs: Array<{ name: string; loaded: boolean; has_dashboard: boolean }>;
    slash: Array<{ name: string; type: number; cog: string; enabled: boolean }>;
    repos: unknown[];
    forbidden: boolean;
    online: boolean;
    downloaderAvailable: boolean;
    downloaderError: string | null;
    globalPanels: Array<{ key: string; kind: string; name: string; cog: string; description?: string | null }>;
  } = { cogs: [], slash: [], repos: [], forbidden: false, online: true, downloaderAvailable: true, downloaderError: null, globalPanels: [] };

  try {
    const c = await rpc<{ cogs: typeof out.cogs }>('cogs.list', {}, auth);
    out.cogs = c.cogs ?? [];
  } catch (e) {
    if (e instanceof RpcError && e.code === -32001) {
      out.forbidden = true;
      return out;
    }
    out.online = false;
    return out;
  }

  try {
    const s = await rpc<{ commands: typeof out.slash }>('slash.list', { locale: cookies.get('locale') ?? 'en-US' }, auth);
    out.slash = s.commands ?? [];
  } catch {
    /* Slash optional */
  }

  try {
    const d = await rpc<{ repos: unknown[]; available: boolean }>('downloader.repos', {}, auth);
    out.repos = d.repos ?? [];
    out.downloaderAvailable = d.available !== false;
  } catch (e) {
    out.downloaderAvailable = false;
    // Echten Fehler durchreichen (z. B. Methode unbekannt = Gateway nicht neu geladen,
    // oder eine Exception aus downloader.repos).
    out.downloaderError = e instanceof RpcError ? `${e.message} (code ${e.code})` : String(e);
  }

  // Globale Cog-Panels (scope=global) – für den Global-Tab.
  try {
    const m = await rpc<{ contributions: any[] }>('manifest.get', {}, auth); // ohne Guild = global
    // Globale Panels UND Listen (scope=global) – als Tabs je Modul gruppierbar.
    out.globalPanels = (m.contributions ?? []).filter(
      (c) => (c.kind === 'panel' || c.kind === 'list') && c.scope === 'global'
    );
  } catch {
    /* optional */
  }

  return out;
};
