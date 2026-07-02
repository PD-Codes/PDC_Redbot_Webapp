<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { setLocale, t, locale } from '$lib/i18n';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import NavLinks from '$lib/components/NavLinks.svelte';
  import Toasts from '$lib/components/Toasts.svelte';
  import { cogUpdateCount, refreshCogUpdateCount } from '$lib/stores/updates';
  import { page } from '$app/stores';
  export let data: {
    user: { username: string; avatar?: string | null } | null;
    pages?: Array<{ slug: string; title: string; nav: boolean; visibility: string }>;
    modulePages?: Array<{ key: string; name: string; icon: string | null }>;
    branding?: {
      title?: string;
      icon?: string;
      description?: string;
      short_desc?: string;
      support_url?: string;
      color?: string;
      theme?: string;
      invite_url?: string;
      bot_avatar?: string;
    } | null;
  };

  // Custom pages in the navigation: public ones always, private ones only when logged in.
  $: navPages = (data.pages ?? []).filter((p) => p.nav && (p.visibility === 'public' || data.user));

  // Branding title/icon (fallback: i18n app title). Reactive so saving takes effect immediately.
  $: brandTitle = data.branding?.title?.trim() || $t('app.title');
  $: brandIcon = data.branding?.icon?.trim() || '';

  // Color tokens (branding color → CSS variable --primary, HSL).
  const PRIMARY: Record<string, string> = {
    indigo: '243 75% 59%',
    success: '142 71% 45%',
    blue: '217 91% 60%',
    red: '0 72% 51%'
  };

  function applyBranding() {
    if (typeof document === 'undefined') return;
    const c = data.branding?.color && PRIMARY[data.branding.color];
    if (c) document.documentElement.style.setProperty('--primary', c);
    document.title = brandTitle;
  }

  let theme = 'dark';
  onMount(() => {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem('locale');
    if (saved) setLocale(saved);
    const savedTheme = typeof localStorage !== 'undefined' && localStorage.getItem('theme');
    // Use the branding theme as default until the user has switched it themselves.
    const effectiveTheme = savedTheme || data.branding?.theme || 'dark';
    if (effectiveTheme === 'light') {
      theme = 'light';
      document.documentElement.classList.remove('dark');
    } else {
      theme = 'dark';
      document.documentElement.classList.add('dark');
    }
    applyBranding();
  });

  // Apply title/color immediately when branding changes (after invalidateAll).
  $: if (data.branding) applyBranding();

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', theme);
  }

  async function onLocaleChange(e: Event) {
    setLocale((e.target as HTMLSelectElement).value);
    // Re-run server loads (e.g. the cog manifest) so module names/descriptions
    // are delivered in the new language.
    await invalidateAll();
  }

  // Mobile navigation drawer (hamburger). Closes automatically on navigation.
  let mobileNavOpen = false;
  $: if ($page.url.pathname) mobileNavOpen = false;

  // "Update available" badge (owner-only). Fed by the automatic update check;
  // /api/update/config is owner-gated, so non-owners simply get no badge.
  let updateAvailable = false;
  onMount(async () => {
    if (!data.user) return;
    try {
      const r = await fetch('/api/update/config');
      if (r.ok) {
        const j = await r.json();
        updateAvailable = !!(j.last && j.last.available);
      }
    } catch {
      /* ignore */
    }
    // Cog-update badge lives in a shared store so pages (e.g. the cogs page)
    // can refresh it right after update actions instead of showing stale counts.
    refreshCogUpdateCount();
  });

  // ── Gateway offline banner (graceful degradation) ────────────────────
  // Lightweight liveness poll; shows a friendly banner instead of letting every
  // page run into hard RPC timeout errors without explanation.
  let gatewayOffline = false;
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  async function checkHealth() {
    try {
      const r = await fetch('/api/health');
      const j = await r.json();
      const nowOffline = !j.ok;
      // On transition offline -> online refresh data so cached pages recover.
      if (gatewayOffline && !nowOffline) invalidateAll().catch(() => {});
      gatewayOffline = nowOffline;
    } catch {
      gatewayOffline = true;
    }
  }
  onMount(() => {
    if (!data.user) return;
    checkHealth();
    healthTimer = setInterval(checkHealth, 30_000);
  });
  onDestroy(() => {
    if (healthTimer) clearInterval(healthTimer);
  });

  // ── Cross-tab session/state sync ─────────────────────────────────────
  // Keep locale, theme and login state consistent across open tabs: other tabs
  // pick up changes via the storage event; login/logout triggers a data refresh.
  const UID_KEY = 'pdc:uid';
  function onStorage(e: StorageEvent) {
    if (e.key === 'locale' && e.newValue) {
      setLocale(e.newValue);
      invalidateAll().catch(() => {});
    } else if (e.key === 'theme' && e.newValue) {
      theme = e.newValue === 'light' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } else if (e.key === UID_KEY) {
      // Another tab logged in/out -> re-run loads so this tab reflects it.
      invalidateAll().catch(() => {});
    }
  }
  onMount(() => {
    // Publish the current login state so other tabs can detect changes.
    try {
      const uid = data.user ? String((data.user as { username: string; id?: string }).username) : '';
      if (localStorage.getItem(UID_KEY) !== uid) localStorage.setItem(UID_KEY, uid);
    } catch {
      /* storage unavailable */
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  });
</script>

<svelte:head>
  <title>{brandTitle}</title>
  <meta name="description" content={data.branding?.short_desc || data.branding?.description || ''} />
  {#if data.branding?.bot_avatar}
    <link rel="icon" href={data.branding.bot_avatar} />
  {/if}
  <!-- Open Graph (nice link previews) -->
  <meta property="og:title" content={brandTitle} />
  <meta property="og:description" content={data.branding?.short_desc || data.branding?.description || ''} />
  {#if data.branding?.bot_avatar}
    <meta property="og:image" content={data.branding.bot_avatar} />
  {/if}
</svelte:head>

<CommandPalette user={data.user} pages={data.pages ?? []} />

<div class="flex h-screen overflow-hidden">
  <aside class="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-card/40 p-4 md:block">
    <div class="mb-6 flex items-center gap-2 px-2">
      {#if brandIcon}
        <img src={brandIcon} alt="" class="h-6 w-6 rounded-md object-cover" />
      {:else}
        <span class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">{brandTitle.charAt(0).toUpperCase()}</span>
      {/if}
      <span class="text-lg font-bold">{brandTitle}</span>
    </div>
    <NavLinks user={data.user} navPages={navPages} modulePages={data.modulePages ?? []} {updateAvailable} cogUpdateCount={$cogUpdateCount} />
  </aside>

  <!-- Mobile nav drawer -->
  {#if mobileNavOpen}
    <div
      class="fixed inset-0 z-40 bg-black/50 md:hidden"
      role="presentation"
      on:click={() => (mobileNavOpen = false)}
    ></div>
    <aside class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-border bg-card p-4 md:hidden">
      <div class="mb-6 flex items-center justify-between px-2">
        <div class="flex items-center gap-2">
          {#if brandIcon}
            <img src={brandIcon} alt="" class="h-6 w-6 rounded-md object-cover" />
          {:else}
            <span class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">{brandTitle.charAt(0).toUpperCase()}</span>
          {/if}
          <span class="text-lg font-bold">{brandTitle}</span>
        </div>
        <button type="button" class="rounded-md p-1 text-muted-foreground hover:bg-secondary" aria-label="Close menu" on:click={() => (mobileNavOpen = false)}>✕</button>
      </div>
      <NavLinks user={data.user} navPages={navPages} modulePages={data.modulePages ?? []} {updateAvailable} cogUpdateCount={$cogUpdateCount} onNavigate={() => (mobileNavOpen = false)} />
    </aside>
  {/if}

  <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
    <header class="flex items-center justify-between border-b border-border px-6 py-3">
      <div class="flex items-center gap-2 md:hidden">
        <button
          type="button"
          class="rounded-md border border-input p-1.5 text-lg leading-none"
          aria-label="Open menu"
          on:click={() => (mobileNavOpen = true)}
        >☰</button>
        <span class="text-base font-bold">{brandTitle}</span>
      </div>
      <div class="ml-auto flex items-center gap-3">
        <button
          type="button"
          class="rounded-md border border-input bg-background px-2 py-1 text-sm"
          title="Theme"
          on:click={toggleTheme}
        >{theme === 'dark' ? '☀️' : '🌙'}</button>
        <select
          class="rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={$locale}
          on:change={onLocaleChange}
        >
          <option value="de-DE">DE</option>
          <option value="en-US">EN</option>
        </select>
        {#if data.user}
          <span class="text-sm text-muted-foreground">{data.user.username}</span>
          {#if data.user.avatar}<img src={data.user.avatar} alt="" class="h-8 w-8 rounded-full" />{/if}
          <form method="POST" action="/logout">
            <button class="text-sm text-muted-foreground hover:text-foreground">{$t('common.logout')}</button>
          </form>
        {:else}
          <a
            href="/auth/login"
            class="inline-flex items-center justify-center rounded-md bg-[#5865F2] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {$t('login.with_discord')}
          </a>
        {/if}
      </div>
    </header>
    {#if data.user && gatewayOffline}
      <div class="border-b border-amber-500/40 bg-amber-500/10 px-6 py-2 text-sm text-amber-600 dark:text-amber-400">
        ⚠ {$t('common.gateway_offline_banner')}
      </div>
    {/if}
    <main class="min-h-0 flex-1 overflow-y-auto p-6">
      <slot />
    </main>
  </div>
</div>

<Toasts />
