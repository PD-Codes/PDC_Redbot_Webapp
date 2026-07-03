<script lang="ts">
  import { t } from '$lib/i18n';
  export let data: {
    commands: {
      bot: { name: string | null; avatar: string | null } | null;
      prefix: Array<{ name: string; description: string; cog: string; repo?: string | null; category?: string }>;
      slash: Array<{ name: string; description: string; cog: string; repo?: string | null; orphan?: boolean; synced?: boolean; category?: string }>;
      counts: { prefix: number; slash: number };
    };
    online: boolean;
    user: { username: string } | null;
  };

  type Cmd = { name: string; description: string; cog: string; repo?: string | null; slash: boolean; prefix: boolean; orphan?: boolean; synced?: boolean; category: string };

  let selectedModule: string | null = null; // null = alle
  let query = '';
  let typeFilter: 'all' | 'slash' | 'prefix_only' = 'all';
  let selectedCategory: 'all' | 'Owner' | 'Admin' | 'Moderator' | 'Setup' | 'User' = 'all';

  // Prefix- und Slash-Listen zu einem Befehl je Name zusammenführen.
  function merge(c: typeof data.commands): Cmd[] {
    if (!c) return [];
    const map = new Map<string, Cmd>();
    for (const p of c.prefix ?? [])
      map.set(p.name, { name: p.name, description: p.description, cog: p.cog || '—', repo: p.repo ?? null, slash: false, prefix: true, category: p.category || 'User' });
    for (const s of c.slash ?? []) {
      const e = map.get(s.name);
      if (e) {
        e.slash = true;
        if (!e.description) e.description = s.description;
        if (e.cog === '—') e.cog = s.cog;
        if (!e.repo) e.repo = s.repo ?? null;
        e.synced = s.synced;
        if ((!e.category || e.category === 'User') && s.category) e.category = s.category;
      } else {
        map.set(s.name, { name: s.name, description: s.description, cog: s.cog || '—', repo: s.repo ?? null, slash: true, prefix: false, orphan: s.orphan, synced: s.synced, category: s.category || 'User' });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  $: c = data.commands ?? { bot: null, prefix: [], slash: [], counts: { prefix: 0, slash: 0 } };
  $: merged = merge(c);
  $: modules = Array.from(new Set(merged.map((c) => c.cog))).sort((a, b) => a.localeCompare(b));
  $: moduleCount = (m: string) => merged.filter((c) => c.cog === m).length;

  $: filtered = merged.filter((c) => {
    if (selectedModule && c.cog !== selectedModule) return false;
    if (selectedCategory !== 'all' && (c.category || 'User') !== selectedCategory) return false;
    if (typeFilter === 'slash' && !c.slash) return false;
    if (typeFilter === 'prefix_only' && !(c.prefix && !c.slash)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.description ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Kategorie-Dropdown-Filter (Alle / Admin / Moderator / Setup / Benutzer).
  const CATEGORY_FILTERS = ['Owner', 'Admin', 'Moderator', 'Setup', 'User'];
  // Gruppierung der Anzeige: nach Modul.
  $: groups = (() => {
    const acc: Record<string, Cmd[]> = {};
    for (const cmd of filtered) (acc[cmd.cog] ??= []).push(cmd);
    return acc;
  })();
  const isOrphanGroup = (key: string) => (groups[key] ?? []).some((c) => c.orphan);
  $: groupNames = Object.keys(groups).sort((a, b) => {
    const oa = isOrphanGroup(a),
      ob = isOrphanGroup(b);
    if (oa !== ob) return oa ? 1 : -1;
    return a.localeCompare(b);
  });
  // Globale Modul→Repo-Zuordnung (über ALLE Befehle, unabhängig vom Filter),
  // damit das Menü links und die Detailüberschrift beide das Repo zeigen.
  $: cogRepo = (() => {
    const m = new Map<string, string>();
    for (const x of merged) if (x.repo && !m.has(x.cog)) m.set(x.cog, x.repo);
    return m;
  })();
  const repoForCog = (cog: string) => cogRepo.get(cog) ?? null;

  $: totals = {
    all: merged.length,
    slash: merged.filter((c) => c.slash).length,
    prefixOnly: merged.filter((c) => c.prefix && !c.slash).length
  };
</script>

<div class="mx-auto max-w-5xl space-y-6 py-2">
  <!-- Kopf -->
  <header class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      {#if c.bot?.avatar}
        <img src={c.bot.avatar} alt="" class="h-10 w-10 rounded-full" />
      {/if}
      <div>
        <h1 class="text-xl font-semibold">{$t('commands.title', { bot: c.bot?.name ?? 'Bot' })}</h1>
        <p class="text-sm text-muted-foreground">
          {$t('commands.summary', { all: totals.all, slash: totals.slash, prefixOnly: totals.prefixOnly })}
        </p>
      </div>
    </div>
    {#if data.user}
      <a href="/" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{$t('commands.to_dashboard')}</a>
    {:else}
      <a href="/auth/login" class="rounded-md bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:opacity-90">{$t('login.with_discord')}</a>
    {/if}
  </header>

  {#if !data.online}
    <div class="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">{$t('commands.bot_offline')}</div>
  {/if}

  <div class="flex flex-col gap-6 md:flex-row">
    <!-- Modul-Menü -->
    <aside class="space-y-1 md:w-56 md:shrink-0">
      <p class="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('commands.modules')}</p>
      <button
        class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-secondary {selectedModule === null ? 'bg-secondary font-medium' : ''}"
        on:click={() => (selectedModule = null)}
      >
        <span>{$t('commands.all_modules')}</span><span class="text-muted-foreground">{merged.length}</span>
      </button>
      {#each modules as m (m)}
        <button
          class="flex w-full items-start justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary {selectedModule === m ? 'bg-secondary font-medium' : ''}"
          on:click={() => (selectedModule = m)}
        >
          <span class="min-w-0">
            <span class="block truncate">{m}</span>
            {#if cogRepo.get(m)}<span class="block truncate text-[10px] font-normal text-muted-foreground/70">{cogRepo.get(m)}</span>{/if}
          </span>
          <span class="shrink-0 text-muted-foreground">{moduleCount(m)}</span>
        </button>
      {/each}
    </aside>

    <!-- Befehlsliste -->
    <div class="min-w-0 flex-1 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-md border border-border p-0.5 text-sm">
          <button class="rounded px-3 py-1.5 {typeFilter === 'all' ? 'bg-secondary font-medium' : 'text-muted-foreground'}" on:click={() => (typeFilter = 'all')}>{$t('commands.filter_all')}</button>
          <button class="rounded px-3 py-1.5 {typeFilter === 'slash' ? 'bg-secondary font-medium' : 'text-muted-foreground'}" on:click={() => (typeFilter = 'slash')}>{$t('commands.filter_slash')}</button>
          <button class="rounded px-3 py-1.5 {typeFilter === 'prefix_only' ? 'bg-secondary font-medium' : 'text-muted-foreground'}" on:click={() => (typeFilter = 'prefix_only')}>{$t('commands.filter_prefix_only')}</button>
        </div>
        <label class="inline-flex items-center gap-2 text-sm">
          <span class="text-muted-foreground">{$t('commands.filter_category')}</span>
          <select bind:value={selectedCategory} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
            <option value="all">{$t('commands.cat_all')}</option>
            {#each CATEGORY_FILTERS as cat (cat)}
              <option value={cat}>{$t('commands.cat_' + cat.toLowerCase())}</option>
            {/each}
          </select>
        </label>
        <input type="text" bind:value={query} placeholder={$t('common.search')} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
      </div>

      {#if filtered.length === 0}
        <p class="text-sm text-muted-foreground">{$t('commands.none_found')}</p>
      {:else}
        <div class="space-y-6">
          {#each groupNames as cog (cog)}
            <section>
              <div class="mb-2">
                <h2 class="text-xs font-medium uppercase tracking-wide {isOrphanGroup(cog) ? 'text-destructive' : 'text-muted-foreground'}">{cog}</h2>
                {#if isOrphanGroup(cog)}<p class="text-[10px] text-destructive/70">{$t('commands.orphan_hint')}</p>{:else if repoForCog(cog)}<p class="text-[10px] text-muted-foreground/70">{repoForCog(cog)}</p>{/if}
              </div>
              <div class="overflow-hidden rounded-lg border {isOrphanGroup(cog) ? 'border-destructive/40' : 'border-border'}">
                {#each groups[cog] as cmd (cmd.name)}
                  <div class="flex items-start justify-between gap-4 border-b border-border/60 px-4 py-2.5 last:border-0">
                    <div class="min-w-0">
                      <code class="break-all text-sm {cmd.orphan ? 'text-muted-foreground line-through' : 'text-primary'}">{cmd.slash ? '/' : ''}{cmd.name}</code>
                      <p class="mt-0.5 break-words text-sm text-muted-foreground">{cmd.description || '—'}</p>
                    </div>
                    <div class="flex shrink-0 gap-1">
                      {#if cmd.orphan}
                        <span class="rounded bg-destructive/15 px-2 py-0.5 text-xs text-destructive" title={$t('commands.orphan_hint')}>{$t('commands.badge_orphan')}</span>
                      {:else}
                      {#if cmd.slash && cmd.synced === false && data.user}
                        <span class="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500" title={$t('commands.not_synced_hint')}>{$t('commands.not_synced')}</span>
                      {/if}
                      {#if cmd.slash}
                        <span class="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">{$t('commands.badge_slash')}</span>
                      {/if}
                      {#if cmd.prefix}
                        <span class="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{$t('commands.badge_prefix')}</span>
                      {/if}
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
