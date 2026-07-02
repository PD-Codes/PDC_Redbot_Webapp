<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { invalidateAll, goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import { toastError, toastSuccess } from '$lib/stores/toasts';
  import { FEATURE_CATALOG, normalizeCogName, type FeatureMeta } from '$lib/features/catalog';
  import type { FeatureContribution, FeatureGuild, FeatureCogState } from './+page.server';

  export let data: {
    online: boolean;
    isOwner: boolean;
    guilds: FeatureGuild[];
    guildId: string | null;
    cogs: FeatureCogState[];
    contributions: FeatureContribution[];
  };

  // Group manifest contributions by normalized cog name (class name → package name).
  $: contribsByCog = data.contributions.reduce((acc: Record<string, FeatureContribution[]>, c) => {
    (acc[normalizeCogName(c.cog)] ??= []).push(c);
    return acc;
  }, {});
  $: cogStateByNorm = new Map(data.cogs.map((c) => [normalizeCogName(c.name), c]));

  interface FeatureCard {
    meta: FeatureMeta;
    /** Cog class name as registered in the manifest (needed for the setup route). */
    cogName: string | null;
    installed: boolean;
    loaded: boolean;
    /** First registered dashboard page of the module (→ /modules/[key]). */
    pageKey: string | null;
    /** Guild-scoped settings panels → setup wizard available. */
    hasSetup: boolean;
    /** Fallback description from the manifest (localized by the gateway). */
    manifestDesc: string | null;
  }

  // One card per known PDC cog that is installed (owner view) or exposes
  // dashboard contributions (everyone). Unknown cogs are intentionally omitted.
  $: cards = FEATURE_CATALOG.flatMap((meta): FeatureCard[] => {
    const norm = normalizeCogName(meta.key);
    const state = cogStateByNorm.get(norm);
    const contribs = contribsByCog[norm] ?? [];
    if (!state && contribs.length === 0) return [];
    const page = contribs.find((c) => c.kind === 'page');
    const panels = contribs.filter((c) => c.kind === 'panel' && c.scope !== 'global');
    const withDesc = contribs.find((c) => c.description);
    return [
      {
        meta,
        cogName: contribs[0]?.cog ?? null,
        installed: true,
        // Non-owners have no cog list: presence of contributions implies loaded.
        loaded: state ? state.loaded : contribs.length > 0,
        pageKey: page?.key ?? null,
        hasSetup: panels.length > 0,
        manifestDesc: withDesc?.description ?? null
      }
    ];
  });

  // i18n helper with fallback: the flat dict returns the key itself when missing.
  function tOr(key: string, fallback: string): string {
    const v = $t(key);
    return v === key ? fallback : v;
  }

  let busy = '';
  let confirmDlg = { open: false, title: '', message: '', confirmLabel: '', onConfirm: () => {} };

  function onGuildChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    goto(`/features?guild=${encodeURIComponent(id)}`, { invalidateAll: true, noScroll: true });
  }

  // Load/unload via the existing owner-only /api/cogs endpoint (same as the cogs page).
  async function setLoaded(card: FeatureCard, load: boolean) {
    if (busy) return;
    const name = card.meta.key;
    busy = name;
    try {
      const headers = { 'content-type': 'application/json' };
      const res = await fetch('/api/cogs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, action: load ? 'load' : 'unload' })
      });
      const j = await res.json();
      if (j.error) {
        toastError(j.error);
        return;
      }
      if (load) {
        // Reload once so slash commands + dashboard contributions register immediately.
        await fetch('/api/cogs', { method: 'POST', headers, body: JSON.stringify({ name, action: 'reload' }) }).catch(() => {});
      }
      toastSuccess($t('common.done'));
      await invalidateAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : $t('common.error'));
    } finally {
      busy = '';
    }
  }

  function toggle(card: FeatureCard) {
    if (busy) return;
    if (card.loaded) {
      // Disabling a module is disruptive – confirm first (same UX as the cogs page).
      confirmDlg = {
        open: true,
        title: $t('features.confirm_disable_title'),
        message: $t('features.confirm_disable', { cog: card.meta.key }),
        confirmLabel: $t('features.disable'),
        onConfirm: () => setLoaded(card, false)
      };
    } else {
      setLoaded(card, true);
    }
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold">{$t('features.title')}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{$t('features.subtitle')}</p>
    </div>
    {#if data.guilds.length}
      <label class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground">{$t('features.guild_label')}</span>
        <select
          value={data.guildId}
          on:change={onGuildChange}
          class="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {#each data.guilds as g (g.id)}
            <option value={g.id}>{g.name}</option>
          {/each}
        </select>
      </label>
    {/if}
  </div>

  {#if !data.online}
    <Card class="border-destructive/50 p-4"><p class="text-sm text-destructive">{$t('common.gateway_offline')}</p></Card>
  {:else if cards.length === 0}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('features.empty')}</p></Card>
  {:else}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {#each cards as card (card.meta.key)}
        <Card class="flex flex-col gap-3 p-4 {card.loaded ? '' : 'opacity-75'}">
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <span class="text-2xl leading-none" aria-hidden="true">{card.meta.emoji}</span>
              <div class="min-w-0">
                <p class="truncate font-medium">{tOr(`features.cog.${card.meta.key}.title`, card.meta.key)}</p>
                {#if card.meta.replaces}
                  <p class="truncate text-[11px] text-muted-foreground">{$t('features.replaces', { bot: card.meta.replaces })}</p>
                {/if}
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              {#if card.loaded}
                <span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">{$t('features.loaded')}</span>
              {:else}
                <span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{$t('features.not_loaded')}</span>
              {/if}
              {#if data.isOwner}
                <button
                  type="button"
                  aria-label={card.loaded ? $t('features.disable') : $t('features.enable')}
                  title={card.loaded ? $t('features.disable') : $t('features.enable')}
                  disabled={busy === card.meta.key}
                  on:click={() => toggle(card)}
                  class="relative h-5 w-9 shrink-0 rounded-full transition {card.loaded ? 'bg-primary' : 'bg-secondary'} disabled:opacity-50"
                >
                  <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all {card.loaded ? 'left-[18px]' : 'left-0.5'}"></span>
                </button>
              {/if}
            </div>
          </div>

          <p class="min-h-[2.5rem] text-sm text-muted-foreground">
            {tOr(`features.cog.${card.meta.key}.desc`, card.manifestDesc ?? '')}
          </p>

          <div class="mt-auto flex flex-wrap items-center gap-2">
            {#if card.loaded && card.hasSetup && card.cogName && data.guildId}
              <a
                href={`/features/setup/${encodeURIComponent(card.cogName)}?guild=${encodeURIComponent(data.guildId)}`}
                class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >{$t('features.setup')}</a>
            {/if}
            {#if card.loaded && card.pageKey}
              <a
                href={`/modules/${encodeURIComponent(card.pageKey)}${data.guildId ? `?guild=${encodeURIComponent(data.guildId)}` : ''}`}
                class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
              >{$t('features.open_pages')}</a>
            {/if}
            {#if card.loaded && card.hasSetup && !data.guildId}
              <span class="text-xs text-muted-foreground">{$t('features.setup_hint_guild')}</span>
            {/if}
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  <ConfirmDialog
    bind:open={confirmDlg.open}
    title={confirmDlg.title}
    message={confirmDlg.message}
    confirmLabel={confirmDlg.confirmLabel}
    onConfirm={confirmDlg.onConfirm}
  />
</div>
