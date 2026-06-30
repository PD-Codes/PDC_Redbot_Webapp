<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { setLocale, t, locale } from '$lib/i18n';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import NavLinks from '$lib/components/NavLinks.svelte';
  import { page } from '$app/stores';
  export let data: {
    user: { username: string; avatar?: string | null } | null;
    pages?: Array<{ slug: string; title: string; nav: boolean; visibility: string }>;
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

  // Custom Pages in der Navigation: öffentliche immer, private nur eingeloggt.
  $: navPages = (data.pages ?? []).filter((p) => p.nav && (p.visibility === 'public' || data.user));

  // Branding-Titel/Icon (Fallback: i18n-App-Titel). Reaktiv, damit ein Speichern sofort greift.
  $: brandTitle = data.branding?.title?.trim() || $t('app.title');
  $: brandIcon = data.branding?.icon?.trim() || '';

  // Farb-Token (Branding-Farbe → CSS-Variable --primary, HSL).
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
    // Branding-Theme als Default, solange der Nutzer nicht selbst umgeschaltet hat.
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

  // Bei Branding-Änderung (nach invalidateAll) Titel/Farbe sofort übernehmen.
  $: if (data.branding) applyBranding();

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', theme);
  }

  async function onLocaleChange(e: Event) {
    setLocale((e.target as HTMLSelectElement).value);
    // Server-Loads (z. B. das Cog-Manifest) neu ausführen, damit Modul-Namen/
    // -Beschreibungen in der neuen Sprache geliefert werden.
    await invalidateAll();
  }

  // Mobiles Navigations-Drawer (Hamburger). Schließt automatisch bei Navigation.
  let mobileNavOpen = false;
  $: if ($page.url.pathname) mobileNavOpen = false;
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

<div class="flex min-h-screen">
  <aside class="hidden w-60 shrink-0 border-r border-border bg-card/40 p-4 md:block">
    <div class="mb-6 flex items-center gap-2 px-2">
      {#if brandIcon}
        <img src={brandIcon} alt="" class="h-6 w-6 rounded-md object-cover" />
      {:else}
        <span class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">{brandTitle.charAt(0).toUpperCase()}</span>
      {/if}
      <span class="text-lg font-bold">{brandTitle}</span>
    </div>
    <NavLinks user={data.user} navPages={navPages} />
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
      <NavLinks user={data.user} navPages={navPages} onNavigate={() => (mobileNavOpen = false)} />
    </aside>
  {/if}

  <div class="flex flex-1 flex-col">
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
    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>
</div>
