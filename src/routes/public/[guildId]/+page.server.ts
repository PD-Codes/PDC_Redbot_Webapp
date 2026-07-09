import type { PageServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';
import { renderMarkdown } from '$lib/markdown';
import { sanitizeHtml } from '$lib/server/sanitize';

// Public guild showcase page — works WITHOUT login.
//
// Security model: the gateway exposes no anonymous per-guild data, so this page
// only renders content that the bot owner explicitly published via the existing
// custom-pages mechanism ("public" visibility). A guild opts in by convention:
// a public page with slug `guild-<guildId>` is the showcase; additional public
// pages with slug prefix `guild-<guildId>-` (e.g. `guild-123-leaderboard`) are
// listed as sub-pages. Nothing auth-gated is ever fetched anonymously.
//
// Enrichment: if the visitor IS logged in and a member of the guild, we add the
// live server name/icon/member count via core.guild_detail (member-gated by the
// gateway itself) — anonymous visitors simply don't get that block.

interface NavPage {
  slug: string;
  title: string;
  nav: boolean;
  visibility: string;
}

interface GuildInfo {
  name: string;
  icon: string | null;
  member_count: number | null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const guildId = params.guildId;
  const baseSlug = `guild-${guildId}`;

  // Public reads only — no auth object is passed for anonymous visitors.
  let publicPages: NavPage[] = [];
  let gatewayOffline = false;
  try {
    const r = await rpc<{ pages: NavPage[] }>('pages.list', {});
    publicPages = (r.pages ?? []).filter((p) => (p.visibility ?? 'public') === 'public');
  } catch {
    gatewayOffline = true;
  }

  const showcase = publicPages.find((p) => p.slug === baseSlug) ?? null;
  const subPages = publicPages
    .filter((p) => p.slug.startsWith(baseSlug + '-'))
    .map((p) => ({ slug: p.slug, title: p.title }));

  // Render the showcase markdown (owner-authored, escaped by renderMarkdown).
  let html = '';
  let title = '';
  if (showcase) {
    try {
      const r = await rpc<{ page: { title: string; markdown?: string; html?: string; visibility?: string } }>(
        'pages.get',
        { slug: showcase.slug }
      );
      // Double-check visibility on the full record (defence in depth).
      if ((r.page.visibility ?? 'public') === 'public') {
        title = r.page.title;
        // Legacy HTML is sanitized server-side because it is rendered via {@html}.
        html = r.page.markdown?.trim()
          ? renderMarkdown(r.page.markdown)
          : sanitizeHtml(r.page.html ?? '');
      }
    } catch {
      /* page vanished between list and get — treat as not public */
    }
  }

  // Optional enrichment for logged-in members (gateway enforces membership).
  let guild: GuildInfo | null = null;
  if (locals.user) {
    try {
      const g = await rpc<GuildInfo>('core.guild_detail', {}, authFromUser(locals.user, guildId));
      guild = { name: g.name, icon: g.icon ?? null, member_count: g.member_count ?? null };
    } catch {
      /* not a member / gateway error — anonymous view is fine */
    }
  }

  return {
    guildId,
    hasPublic: !!(title && html),
    title,
    html,
    subPages,
    guild,
    gatewayOffline,
    // Slug the owner would create to enable this page (shown on the empty state
    // only to logged-in users so we don't advertise internals to anonymous visitors).
    optInSlug: baseSlug,
    isLoggedIn: !!locals.user
  };
};
