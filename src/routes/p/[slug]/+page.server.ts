import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';
import { renderMarkdown } from '$lib/markdown';

// Custom Page ansehen. Öffentliche Seiten ohne Login; private nur eingeloggt.
export const load: PageServerLoad = async ({ params, locals }) => {
  let page: {
    slug: string;
    title: string;
    markdown?: string;
    html?: string;
    visibility?: string;
  };
  try {
    const auth = locals.user ? authFromUser(locals.user) : undefined;
    const r = await rpc<{ page: typeof page }>('pages.get', { slug: params.slug }, auth);
    page = r.page;
  } catch (e) {
    if (e instanceof RpcError) throw error(404, 'Seite nicht gefunden.');
    throw error(502, 'Seite konnte nicht geladen werden.');
  }

  if ((page.visibility ?? 'public') === 'private' && !locals.user) {
    // Privat: ohne Login nicht sichtbar.
    throw error(404, 'Seite nicht gefunden.');
  }

  // Markdown bevorzugt; sonst Legacy-HTML (vom Owner verfasst).
  const html =
    page.markdown && page.markdown.trim() ? renderMarkdown(page.markdown) : (page.html ?? '');

  return { page: { slug: page.slug, title: page.title }, html };
};
