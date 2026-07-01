<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';

  export let data: any;

  let busy = '';
  let msg = '';

  // Globale Prefixe
  let gPrefixes: string[] = [...(data.globalSettings?.prefixes ?? [])];
  let newPrefix = '';
  let gEmbeds = !!data.globalSettings?.embeds;
  let gFuzzy = !!data.globalSettings?.fuzzy;

  // Branding
  let ui = { ...(data.dash?.ui ?? {}) };
  if (ui.short_desc === undefined) ui.short_desc = '';

  // Automatic update check (webapp-side scheduler; 0 = off).
  let autoUpdateH = 0;
  let autoAllowed: number[] = [0, 1, 2, 4, 8, 16, 24];
  let autoLast: { available: boolean; current: string; latest?: string; error?: string; checkedAt: number } | null = null;
  let autoMsg = '';

  // Cog-update monitor + alerts (bot-side).
  let cogUpdateH = 0;
  let alertsDm = false;
  let memThreshold = 0;
  let monMsg = '';
  let monCogs: string[] = [];

  onMount(async () => {
    try {
      const r = await fetch('/api/update/config');
      const j = await r.json();
      if (!j.error) {
        autoUpdateH = j.intervalH ?? 0;
        autoAllowed = j.allowed ?? autoAllowed;
        autoLast = j.last ?? null;
      }
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch('/api/monitor');
      const j = await r.json();
      if (!j.error && j.config) {
        cogUpdateH = j.config.cog_update_interval_h ?? 0;
        alertsDm = !!j.config.alerts_dm;
        memThreshold = j.config.mem_threshold_mb ?? 0;
        monCogs = j.last?.cogs ?? [];
      }
    } catch {
      /* ignore */
    }
  });

  async function saveMonitor() {
    monMsg = '';
    try {
      const r = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cog_update_interval_h: cogUpdateH,
          alerts_dm: alertsDm,
          mem_threshold_mb: memThreshold
        })
      });
      const j = await r.json();
      monMsg = j.error ? '✗ ' + j.error : '✓ ' + $t('common.saved');
      if (!j.error && j.config) {
        cogUpdateH = j.config.cog_update_interval_h ?? 0;
        alertsDm = !!j.config.alerts_dm;
        memThreshold = j.config.mem_threshold_mb ?? 0;
      }
    } catch (e) {
      monMsg = '✗ ' + (e instanceof Error ? e.message : 'Fehler');
    }
  }

  async function saveAutoUpdate() {
    autoMsg = '';
    try {
      const r = await fetch('/api/update/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intervalH: autoUpdateH })
      });
      const j = await r.json();
      autoMsg = j.error ? '✗ ' + j.error : '✓ ' + $t('common.saved');
      if (!j.error) autoUpdateH = j.intervalH;
    } catch (e) {
      autoMsg = '✗ ' + (e instanceof Error ? e.message : 'Fehler');
    }
  }

  function fmtWhen(ms: number | undefined): string {
    if (!ms) return '—';
    try {
      return new Date(ms).toLocaleString();
    } catch {
      return '—';
    }
  }

  async function call(url: string, body: unknown, label: string) {
    busy = label;
    msg = '';
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      msg = j.error ? '✗ ' + j.error : '✓ ' + $t('common.saved');
      if (!j.error) await invalidateAll();
    } catch (e) {
      msg = '✗ ' + (e instanceof Error ? e.message : 'Fehler');
    } finally {
      busy = '';
    }
  }

  const setGlobal = (field: string, value: unknown, label: string) =>
    call('/api/settings', { scope: 'global', field, value }, label);
  const saveBranding = () => call('/api/dashboard', { action: 'settings_set', ui }, 'branding');
  const toggleLock = () => call('/api/dashboard', { action: 'lock', locked: !data.overview?.locked }, 'lock');
  const refreshSessions = () => call('/api/dashboard', { action: 'refresh_sessions' }, 'refresh');

  function addPrefix() {
    const p = newPrefix.trim();
    if (p && !gPrefixes.includes(p)) gPrefixes = [...gPrefixes, p];
    newPrefix = '';
  }

  function uptime(s: number | null) {
    if (!s && s !== 0) return '—';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }
</script>

<div class="mx-auto max-w-3xl space-y-6">
  <h1 class="text-2xl font-semibold">{$t('settings.title')}</h1>

  {#if data.forbidden}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('settings.owner_only')}</p></Card>
  {:else if !data.online}
    <Card class="border-destructive/50 p-4"><p class="text-sm text-destructive">{$t('common.gateway_offline')}</p></Card>
  {:else}
    {#if msg}<p class="text-sm text-muted-foreground">{msg}</p>{/if}

    <!-- Overview -->
    <Card class="p-5">
      <h2 class="mb-3 text-base font-semibold">{$t('settings.overview')}</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><p class="text-xs text-muted-foreground">{$t('settings.servers')}</p><p class="text-lg font-semibold">{data.overview?.guild_count ?? '—'}</p></div>
        <div><p class="text-xs text-muted-foreground">{$t('settings.users')}</p><p class="text-lg font-semibold">{data.overview?.user_count ?? '—'}</p></div>
        <div><p class="text-xs text-muted-foreground">{$t('settings.cogs')}</p><p class="text-lg font-semibold">{data.overview?.loaded_cogs ?? '—'}</p></div>
        <div><p class="text-xs text-muted-foreground">{$t('settings.widgets_panels')}</p><p class="text-lg font-semibold">{data.overview?.contributions ?? '—'}</p></div>
      </div>
      <div class="mt-3 text-sm text-muted-foreground">
        {$t('settings.uptime_line', { bot: uptime(data.overview?.bot_uptime_s), gateway: uptime(data.overview?.gateway_uptime_s) })}
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50" disabled={busy === 'lock'} on:click={toggleLock}>
          {data.overview?.locked ? $t('settings.unlock_dashboard') : $t('settings.lock_dashboard')}
        </button>
        <button type="button" class="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50" disabled={busy === 'refresh'} on:click={refreshSessions}>
          {$t('settings.reset_sessions')}
        </button>
      </div>
    </Card>

    <!-- Globale Bot-Settings -->
    <Card class="p-5">
      <h2 class="mb-3 text-base font-semibold">{$t('settings.global_bot')}</h2>
      <p class="mb-1 text-sm font-medium">{$t('settings.global_prefixes')}</p>
      <div class="mb-2 flex flex-wrap gap-2">
        {#each gPrefixes as p (p)}
          <span class="inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-1 text-sm">
            <code>{p}</code><button type="button" class="text-muted-foreground hover:text-destructive" on:click={() => (gPrefixes = gPrefixes.filter((x) => x !== p))}>✕</button>
          </span>
        {/each}
      </div>
      <div class="mb-4 flex gap-2">
        <input bind:value={newPrefix} on:keydown={(e) => e.key === 'Enter' && addPrefix()} placeholder={$t('settings.prefix')} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        <button type="button" class="rounded-md border border-border px-3 py-1.5 text-sm" on:click={addPrefix}>+</button>
        <button type="button" class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy === 'gpref'} on:click={() => setGlobal('prefixes', gPrefixes, 'gpref')}>{$t('common.save')}</button>
      </div>
      <div class="flex flex-wrap gap-6">
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={gEmbeds} on:change={() => setGlobal('embeds', gEmbeds, 'gemb')} class="accent-primary" /> {$t('settings.use_embeds')}</label>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={gFuzzy} on:change={() => setGlobal('fuzzy', gFuzzy, 'gfuz')} class="accent-primary" /> {$t('settings.fuzzy_search')}</label>
      </div>
    </Card>

    <!-- Dashboard-Branding -->
    <Card class="p-5">
      <h2 class="mb-3 text-base font-semibold">{$t('settings.branding')}</h2>
      <div class="space-y-3">
        <div><label class="text-xs text-muted-foreground" for="t">{$t('settings.field_title')}</label><input id="t" bind:value={ui.title} class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" /></div>
        <div><label class="text-xs text-muted-foreground" for="ic">{$t('settings.field_icon_url')}</label><input id="ic" bind:value={ui.icon} class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" /></div>
        <div>
          <label class="text-xs text-muted-foreground" for="de">{$t('settings.field_description')}</label>
          <textarea id="de" rows="4" bind:value={ui.description} class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"></textarea>
          <p class="mt-1 text-xs text-muted-foreground">{$t('settings.field_description_hint')}</p>
        </div>
        <div>
          <label class="text-xs text-muted-foreground" for="sd">{$t('settings.field_short_desc')}</label>
          <textarea id="sd" rows="2" bind:value={ui.short_desc} class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"></textarea>
          <p class="mt-1 text-xs text-muted-foreground">{$t('settings.field_short_desc_hint')}</p>
        </div>
        <div><label class="text-xs text-muted-foreground" for="su">{$t('settings.field_support_url')}</label><input id="su" bind:value={ui.support_url} class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" /></div>
        <div class="flex gap-4">
          <div><label class="text-xs text-muted-foreground" for="co">{$t('settings.field_color')}</label>
            <select id="co" bind:value={ui.color} class="block rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              <option value="indigo">{$t('settings.color_indigo')}</option><option value="success">{$t('settings.color_green')}</option><option value="blue">{$t('settings.color_blue')}</option><option value="red">{$t('settings.color_red')}</option>
            </select>
          </div>
          <div><label class="text-xs text-muted-foreground" for="th">{$t('settings.field_theme')}</label>
            <select id="th" bind:value={ui.theme} class="block rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              <option value="dark">{$t('settings.theme_dark')}</option><option value="light">{$t('settings.theme_light')}</option>
            </select>
          </div>
        </div>
        <button type="button" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy === 'branding'} on:click={saveBranding}>{$t('settings.save_branding')}</button>
      </div>
    </Card>

    <!-- Globale Modul-Einstellungen ausgeblendet: werden bereits unter Cogs → Global
         verwaltet. Doppelte Pflege führte zu Verwirrung (siehe Feedback). -->

    <Card class="p-5">
      <h2 class="mb-1 text-base font-semibold">{$t('settings.autoupdate_title')}</h2>
      <p class="mb-3 text-sm text-muted-foreground">{$t('settings.autoupdate_desc')}</p>
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs text-muted-foreground">{$t('settings.autoupdate_interval')}</span>
          <select bind:value={autoUpdateH} on:change={saveAutoUpdate}
            class="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
            {#each autoAllowed as h}
              <option value={h}>{h === 0 ? $t('settings.autoupdate_off') : `${h}h`}</option>
            {/each}
          </select>
        </label>
        {#if autoMsg}<span class="pb-2 text-sm text-muted-foreground">{autoMsg}</span>{/if}
      </div>
      {#if autoLast}
        <p class="mt-3 text-xs text-muted-foreground">
          {$t('settings.autoupdate_last', { time: fmtWhen(autoLast.checkedAt) })}
          {#if autoLast.error}· {autoLast.error}
          {:else if autoLast.available}· ⬆ v{autoLast.current} → v{autoLast.latest}
          {:else}· ✓ v{autoLast.current}{/if}
        </p>
      {/if}
    </Card>

    <Card class="p-5">
      <h2 class="mb-1 text-base font-semibold">{$t('settings.cogupdate_title')}</h2>
      <p class="mb-3 text-sm text-muted-foreground">{$t('settings.cogupdate_desc')}</p>
      <div class="flex flex-wrap items-end gap-4">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs text-muted-foreground">{$t('settings.autoupdate_interval')}</span>
          <select bind:value={cogUpdateH} on:change={saveMonitor}
            class="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
            {#each autoAllowed as h}
              <option value={h}>{h === 0 ? $t('settings.autoupdate_off') : `${h}h`}</option>
            {/each}
          </select>
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={alertsDm} on:change={saveMonitor} class="accent-primary" />
          {$t('settings.alerts_dm')}
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs text-muted-foreground">{$t('settings.mem_threshold')}</span>
          <input type="number" min="0" bind:value={memThreshold} on:change={saveMonitor}
            class="w-28 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        </label>
        {#if monMsg}<span class="pb-2 text-sm text-muted-foreground">{monMsg}</span>{/if}
      </div>
      <p class="mt-2 text-xs text-muted-foreground">{$t('settings.alerts_dm_hint')}</p>
      {#if monCogs.length}
        <p class="mt-2 text-xs text-amber-500">⬆ {monCogs.length}: {monCogs.join(', ')}</p>
      {/if}
    </Card>

    <a href="/pages" class="inline-block text-sm text-primary hover:underline">{$t('settings.manage_pages')}</a>
  {/if}
</div>
