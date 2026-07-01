<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib/i18n';

  export let user: { username: string } | null = null;
  export let navPages: Array<{ slug: string; title: string; visibility: string }> = [];
  export let modulePages: Array<{ key: string; name: string; icon: string | null }> = [];
  export let updateAvailable = false;
  export let cogUpdateCount = 0;
  // Called after a link is clicked (used to close the mobile drawer).
  export let onNavigate: () => void = () => {};

  // External links (open in a new tab).
  const URL_DOCS = 'https://github.com/PD-Codes/PDC_Redbot_Webapp/wiki';
  const URL_GH_DASHBOARD = 'https://github.com/PD-Codes/PDC_Redbot_Webapp';
  const URL_GH_COGS = 'https://github.com/PD-Codes/PDC_Redbot_Cogs';

  const publicNav = [
    { href: '/', key: 'nav.overview', icon: 'home' },
    { href: '/commands', key: 'nav.commands', icon: 'terminal' }
  ];
  const authNav = [
    { href: '/guilds', key: 'nav.guilds', icon: 'server' },
    { href: '/stats', key: 'nav.stats', icon: 'bar-chart' },
    { href: '/announce', key: 'nav.announce', icon: 'megaphone' },
    { href: '/cogs', key: 'nav.cogs', icon: 'puzzle' },
    { href: '/settings', key: 'nav.settings', icon: 'gear' },
    { href: '/pages', key: 'nav.pages', icon: 'file' },
    { href: '/audit', key: 'nav.audit', icon: 'clipboard' },
    { href: '/logs', key: 'nav.logs', icon: 'logs' },
    { href: '/system', key: 'nav.system', icon: 'activity' },
    { href: '/docs/integration', key: 'nav.integration_docs', icon: 'book', muted: true }
  ];

  $: path = $page.url.pathname;
  // Active when the path matches exactly, or (for non-root) is a sub-route.
  // The current path is passed IN from the markup (as `cur`) on purpose: Svelte
  // only tracks reactive variables referenced directly in a markup expression.
  // If these helpers read the top-level `path` internally, `class={cls(href)}`
  // would NOT recompute on client-side navigation and the active highlight would
  // stay stuck on the previous page. Passing `path` makes the dependency explicit.
  function isActive(href: string, cur: string): boolean {
    if (href === '/') return cur === '/';
    return cur === href || cur.startsWith(href + '/');
  }
  function cls(href: string, cur: string, muted = false): string {
    const base = 'flex items-center gap-2 rounded-md px-3 py-2 transition-colors';
    if (isActive(href, cur)) return `${base} bg-secondary font-medium text-foreground`;
    return `${base} hover:bg-secondary ${muted ? 'text-muted-foreground' : ''}`;
  }
  // External / non-highlighted link styling.
  function extCls(muted = false): string {
    return `flex items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-secondary ${muted ? 'text-muted-foreground' : ''}`;
  }
</script>

<nav class="flex flex-col text-sm">
  <div class="space-y-1">
    {#each publicNav as n}
      <a href={n.href} class={cls(n.href, path)} aria-current={isActive(n.href, path) ? 'page' : undefined} on:click={onNavigate}>
        <svg class="h-4 w-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          {#if n.icon === 'home'}<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          {:else if n.icon === 'terminal'}<polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />{/if}
        </svg>
        <span>{$t(n.key)}</span>
      </a>
    {/each}
    {#each navPages as p (p.slug)}
      <a href={`/p/${p.slug}`} class={cls(`/p/${p.slug}`, path)} aria-current={isActive(`/p/${p.slug}`, path) ? 'page' : undefined} on:click={onNavigate}>
        <svg class="h-4 w-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
        <span>{p.title}{#if p.visibility === 'private'}<span class="ml-1 text-xs text-muted-foreground" title={$t('nav.private_hint')}>🔒</span>{/if}</span>
      </a>
    {/each}
    {#if user}
      {#each authNav as n}
        <a href={n.href} class={cls(n.href, path, n.muted)} aria-current={isActive(n.href, path) ? 'page' : undefined} on:click={onNavigate}>
          <svg class="h-4 w-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            {#if n.icon === 'server'}<rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
            {:else if n.icon === 'bar-chart'}<line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
            {:else if n.icon === 'megaphone'}<path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            {:else if n.icon === 'puzzle'}<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.063-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z" />
            {:else if n.icon === 'gear'}<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            {:else if n.icon === 'file'}<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            {:else if n.icon === 'clipboard'}<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="14" y2="15" />
            {:else if n.icon === 'activity'}<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            {:else if n.icon === 'book'}<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          {:else if n.icon === 'logs'}<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />{/if}
          </svg>
          <span>{$t(n.key)}</span>
          {#if n.key === 'nav.system' && updateAvailable}
            <span class="ml-auto inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Update verfügbar" aria-label="Update verfügbar"></span>
          {/if}
          {#if n.key === 'nav.cogs' && cogUpdateCount > 0}
            <span class="ml-auto inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-medium text-white" title="Cog-Updates" aria-label="Cog-Updates">{cogUpdateCount}</span>
          {/if}
        </a>
      {/each}

      {#if modulePages.length}
        <div class="mt-3">
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            {$t('nav.module_sites')}
          </p>
          {#each modulePages as mp (mp.key)}
            {@const mhref = `/modules/${encodeURIComponent(mp.key)}`}
            <a href={mhref} class={cls(mhref, path)} aria-current={isActive(mhref, path) ? 'page' : undefined} on:click={onNavigate}>
              <svg class="h-4 w-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>{mp.name}</span>
            </a>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- External links / extra section -->
  <div class="mt-4 space-y-1 border-t border-border pt-4">
    <a href={URL_DOCS} target="_blank" rel="noopener noreferrer" class={extCls(true)}>
      <svg class="h-4 w-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
      <span>{$t('nav.documentation')}</span>
    </a>
    <a href={URL_GH_DASHBOARD} target="_blank" rel="noopener noreferrer" class={extCls()}>
      <svg class="h-4 w-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      </svg>
      <span>{$t('nav.github_dashboard')}</span>
    </a>
    <a href={URL_GH_COGS} target="_blank" rel="noopener noreferrer" class={extCls()}>
      <svg class="h-4 w-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      </svg>
      <span>{$t('nav.github_cogs')}</span>
    </a>
    <a href="/credits" class={cls('/credits', path)} aria-current={isActive('/credits', path) ? 'page' : undefined} on:click={onNavigate}>
      <svg class="h-4 w-4 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span>{$t('nav.credits')}</span>
    </a>
  </div>
</nav>
