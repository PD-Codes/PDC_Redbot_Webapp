<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';
  import { toastError } from '$lib/stores/toasts';
  import type { LogEntry } from './+page.server';

  export let data: { isOwner: boolean; logs: LogEntry[]; cached?: boolean; online?: boolean };

  let logs: LogEntry[] = data.logs ?? [];
  let cached = !!data.cached;
  let level = '';
  let query = '';
  let busy = false;
  let expanded = new Set<number>();

  const LEVELS = ['INFO', 'WARNING', 'ERROR'];

  $: filtered = logs.filter((l) => {
    const okQuery =
      !query.trim() || `${l.message} ${l.logger}`.toLowerCase().includes(query.trim().toLowerCase());
    return okQuery;
  });

  async function refresh() {
    busy = true;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'logs_list', level, query, limit: 500 })
      });
      const j = await res.json();
      if (j.error) {
        toastError($t('logs.refresh_failed') + ': ' + j.error);
      } else {
        logs = j.logs ?? [];
        cached = !!j.cached;
      }
    } catch (e) {
      toastError($t('logs.refresh_failed') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      busy = false;
    }
  }
  // Re-pull from the server whenever the level filter changes (server-side filtering).
  let firstLevel = true;
  $: {
    level;
    if (firstLevel) firstLevel = false;
    else refresh();
  }

  function toggle(i: number) {
    if (expanded.has(i)) expanded.delete(i);
    else expanded.add(i);
    expanded = expanded;
  }

  function fmtTime(ts: number): string {
    try {
      return new Date(ts * 1000).toLocaleString();
    } catch {
      return '—';
    }
  }

  function levelTone(lv: string): string {
    if (lv === 'ERROR' || lv === 'CRITICAL') return 'bg-destructive/15 text-destructive';
    if (lv === 'WARNING') return 'bg-amber-500/15 text-amber-500';
    if (lv === 'DEBUG') return 'bg-secondary text-muted-foreground';
    return 'bg-primary/15 text-primary';
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-semibold">{$t('logs.title')}</h1>
    {#if data.isOwner}
      <div class="flex flex-wrap items-center gap-2">
        <select bind:value={level} class="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
          <option value="">{$t('logs.level_all')}</option>
          {#each LEVELS as lv}<option value={lv}>{lv}</option>{/each}
        </select>
        <input
          bind:value={query}
          placeholder={$t('logs.search')}
          class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        <button
          type="button"
          class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
          disabled={busy}
          on:click={refresh}>{busy ? '…' : '↻ ' + $t('common.refresh')}</button>
      </div>
    {/if}
  </div>

  {#if data.isOwner && cached}
    <Card class="border-amber-500/50 p-3">
      <p class="text-sm text-amber-500">{$t('logs.cached_notice')}</p>
    </Card>
  {/if}

  {#if !data.isOwner}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('logs.owner_only')}</p></Card>
  {:else if filtered.length === 0}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('logs.empty')}</p></Card>
  {:else}
    <Card class="overflow-hidden p-0">
      <div class="divide-y divide-border/60">
        {#each filtered as l, i (i)}
          <div class="px-4 py-2 text-sm">
            <div class="flex items-start gap-3">
              <span class="mt-0.5 shrink-0 whitespace-nowrap text-xs text-muted-foreground">{fmtTime(l.time)}</span>
              <span class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold {levelTone(l.level)}">{l.level}</span>
              <span class="mt-0.5 shrink-0 max-w-[14rem] truncate font-mono text-xs text-muted-foreground" title={l.logger}>{l.logger}</span>
              <div class="min-w-0 flex-1">
                <p class="whitespace-pre-wrap break-words">{l.message}</p>
                {#if l.exc}
                  <button type="button" class="mt-1 text-xs text-primary hover:underline" on:click={() => toggle(i)}>
                    {expanded.has(i) ? '▾' : '▸'} Traceback
                  </button>
                  {#if expanded.has(i)}
                    <pre class="mt-1 max-h-72 overflow-auto rounded bg-secondary/50 p-2 text-[11px] leading-tight">{l.exc}</pre>
                  {/if}
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}
</div>
