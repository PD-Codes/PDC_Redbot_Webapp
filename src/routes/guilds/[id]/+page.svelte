<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Widget from '$lib/components/Widget.svelte';
  import ModuleTabs from '$lib/components/ModuleTabs.svelte';
  import { t } from '$lib/i18n';

  export let data: {
    detail: {
      id: string;
      name: string;
      icon: string | null;
      owner: string | null;
      member_count: number;
      channels: { text: number; voice: number; categories: number; total: number };
      roles: number;
      presence: { online: number; idle: number; dnd: number; offline: number };
      created_at: string | null;
      joined_at: string | null;
    };
    contributions: Array<{ key: string; kind: string; name: string; cog?: string; scope?: string; size?: string; refresh?: number | null; description?: string | null }>;
    guildId: string;
  };

  const d = data.detail;
  $: widgets = data.contributions.filter((c) => c.kind === 'widget' && (c.scope ?? 'guild') !== 'global');
  // Guild-scoped cog pages -> buttons next to "Bot settings".
  $: guildPages = data.contributions.filter((c) => c.kind === 'page' && (c.scope ?? 'guild') !== 'global');

  // Panels + Listen je Modul (Cog) bündeln. Globale Beiträge (scope=global) gehören
  // NICHT hierher, sondern unter /cogs → Global.
  $: manageable = data.contributions.filter(
    (c) => (c.kind === 'panel' || c.kind === 'list') && (c.scope ?? 'guild') !== 'global'
  );
  $: moduleMap = manageable.reduce((acc: Record<string, typeof manageable>, c) => {
    (acc[c.cog ?? '—'] ??= []).push(c);
    return acc;
  }, {});
  $: modules = Object.keys(moduleMap).sort((a, b) => a.localeCompare(b));

  // Module-Karten erst beim Aufklappen rendern (Tabs laden dann ihre Inhalte).
  let openPanels: Record<string, boolean> = {};
  const togglePanel = (key: string) => (openPanels = { ...openPanels, [key]: !openPanels[key] });

  function fmt(iso: string | null) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return '—';
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <a href="/guilds" class="text-sm text-muted-foreground hover:text-foreground">{$t('guild.all_servers')}</a>
    <div class="flex flex-wrap items-center justify-end gap-2">
      {#each guildPages as gp (gp.key)}
        <a href={`/modules/${encodeURIComponent(gp.key)}?guild=${data.guildId}`} class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">{gp.name}</a>
      {/each}
      <a href={`/guilds/${data.guildId}/settings`} class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">{$t('guild.bot_settings')}</a>
    </div>
  </div>

  <!-- Overview-Karte (Bild-2-Stil) -->
  <Card class="p-6">
    <div class="flex flex-col items-center gap-3 text-center">
      {#if d.icon}
        <img src={d.icon} alt="" class="h-20 w-20 rounded-full" />
      {/if}
      <div>
        <h1 class="text-2xl font-semibold">{d.name}</h1>
        {#if d.owner}<p class="text-sm text-muted-foreground">{$t('guild.owner', { owner: d.owner })}</p>{/if}
      </div>

      <div class="mt-2 flex gap-8">
        <div><p class="text-2xl font-semibold">{d.member_count}</p><p class="text-xs text-muted-foreground">{$t('guild.members')}</p></div>
        <div><p class="text-2xl font-semibold">{d.channels.total}</p><p class="text-xs text-muted-foreground">{$t('guild.channels')}</p></div>
        <div><p class="text-2xl font-semibold">{d.roles}</p><p class="text-xs text-muted-foreground">{$t('guild.roles')}</p></div>
      </div>

      <div class="mt-2 flex flex-wrap justify-center gap-3 text-sm">
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>{d.presence.online}</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span>{d.presence.idle}</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-destructive"></span>{d.presence.dnd}</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-muted-foreground"></span>{d.presence.offline}</span>
      </div>
      <div class="text-xs text-muted-foreground">
        # {d.channels.text} · 🔊 {d.channels.voice}
      </div>

      <div class="mt-2 text-xs text-muted-foreground">
        {$t('guild.created_joined', { created: fmt(d.created_at), joined: fmt(d.joined_at) })}
      </div>
    </div>
  </Card>

  <!-- Cog-Widgets dieser Guild -->
  {#if widgets.length}
    <div>
      <h2 class="mb-2 text-lg font-semibold">{$t('guild.overview')}</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        {#each widgets as w (w.key)}
          <Widget contribution={w} guildId={data.guildId} />
        {/each}
      </div>
    </div>
  {/if}

  <!-- Cog-Module – je Modul eine aufklappbare Karte mit Tabs (Einstellungen + Verwaltung) -->
  {#if modules.length}
    <div>
      <h2 class="mb-2 text-lg font-semibold">{$t('guild.modules')}</h2>
      <div class="space-y-3">
        {#each modules as mod (mod)}
          <div class="overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-secondary/40"
              on:click={() => togglePanel(mod)}
            >
              <span>
                {mod}
                <span class="ml-1 text-xs font-normal text-muted-foreground">({moduleMap[mod].length})</span>
              </span>
              <span class="text-muted-foreground">{openPanels[mod] ? '▲' : '▼'}</span>
            </button>
            {#if openPanels[mod]}
              <div class="border-t border-border p-3">
                <ModuleTabs contributions={moduleMap[mod]} guildId={data.guildId} />
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
