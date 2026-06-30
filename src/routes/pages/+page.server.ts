import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  const auth = authFromUser(locals.user);
  let isOwner = false;
  try {
    const ov = await rpc<{ is_owner: boolean }>('dashboard.overview', {}, auth);
    isOwner = !!ov.is_owner;
  } catch {
    /* ignore */
  }
  let pages: Array<{ slug: string; title: string; nav: boolean; visibility?: string }> = [];
  try {
    const r = await rpc<{ pages: typeof pages }>('pages.list', {}, auth);
    pages = r.pages ?? [];
  } catch {
    /* ignore */
  }
  return { pages, isOwner };
};
