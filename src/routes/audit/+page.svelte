<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';
  import type { AuditEntry } from './+page.server';

  export let data: { isOwner: boolean; entries: AuditEntry[] };

  let entries: AuditEntry[] = data.entries ?? [];
  let filter = '';
  let busy = false;

  $: filtered = filter.trim()
    ? entries.filter((e) => {
        const hay = `${e.action} ${e.user ?? ''} ${e.guild ?? ''} ${JSON.stringify(e.detail)}`.toLowerCase();
        return hay.includes(filter.trim().toLowerCase());
      })
    : entries;

  // Pagination.
  const PAGE_SIZES = [10, 20, 50, 100];
  let pageSize = 10;
  let page = 1;
  $: totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Back to page 1 whenever the filter or the page size changes.
  $: {
    filter;
    pageSize;
    page = 1;
  }
  $: if (page > totalPages) page = totalPages;
  $: paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function refresh() {
    busy = true;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'audit_list', limit: 300 })
      });
      const j = await res.json();
      if (!j.error) entries = j.entries ?? [];
    } finally {
      busy = false;
    }
  }

  function fmtTime(ts: number | null): string {
    if (!ts) return '—';
    try {
      return new Date(ts * 1000).toLocaleString();
    } catch {
      return '—';
    }
  }

  function fmtDetail(d: Record<string, unknown>): string {
    const keys = Object.keys(d ?? {});
    if (!keys.length) return '';
    return keys
      .map((k) => `${k}: ${typeof d[k] === 'object' ? JSON.stringify(d[k]) : String(d[k])}`)
      .join(' · ');
  }

  // Aktion einfärben: löschen/entfernen rot, schreiben/laden neutral.
  function actionTone(a: string): string {
    if (/delete|remove|uninstall|unload|lock/i.test(a)) return 'text-destructive';
    if (/set|save|add|install|load|reload|sync|enable|update/i.test(a)) return 'text-primary';
    return 'text-foreground';
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-semibold">{$t('audit.title')}</h1>
    {#if data.isOwner}
      <div class="flex items-center gap-2">
        <input
          bind:value={filter}
          placeholder={$t('audit.filter')}
          class="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
          disabled={busy}
          on:click={refresh}>{busy ? '…' : '↻ ' + $t('common.refresh')}</button>
      </div>
    {/if}
  </div>

  {#if !data.isOwner}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('audit.owner_only')}</p></Card>
  {:else if filtered.length === 0}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('audit.empty')}</p></Card>
  {:else}
    <Card class="overflow-hidden p-0">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th class="px-4 py-2 font-medium">{$t('audit.col_time')}</th>
              <th class="px-4 py-2 font-medium">{$t('audit.col_action')}</th>
              <th class="px-4 py-2 font-medium">{$t('audit.col_user')}</th>
              <th class="px-4 py-2 font-medium">{$t('audit.col_guild')}</th>
              <th class="px-4 py-2 font-medium">{$t('audit.col_detail')}</th>
            </tr>
          </thead>
          <tbody>
            {#each paged as e, i (i)}
              <tr class="border-b border-border/50 last:border-0 align-top">
                <td class="whitespace-nowrap px-4 py-2 text-muted-foreground">{fmtTime(e.time)}</td>
                <td class="px-4 py-2"><code class={actionTone(e.action)}>{e.action}</code></td>
                <td class="px-4 py-2">{e.user ?? e.user_id ?? '—'}</td>
                <td class="px-4 py-2 text-muted-foreground">{e.guild ?? '—'}</td>
                <td class="max-w-[28rem] break-words px-4 py-2 text-xs text-muted-foreground">{fmtDetail(e.detail)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
        <label class="flex items-center gap-2 text-muted-foreground">
          {$t('audit.per_page')}
          <select bind:value={pageSize} class="rounded-md border border-input bg-background px-2 py-1 text-sm">
            {#each PAGE_SIZES as n}<option value={n}>{n}</option>{/each}
          </select>
        </label>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="rounded-md border border-border px-2.5 py-1 hover:bg-secondary disabled:opacity-40"
            disabled={page <= 1}
            aria-label={$t('audit.prev')}
            on:click={() => (page = Math.max(1, page - 1))}>‹</button>
          <span class="whitespace-nowrap text-muted-foreground">{$t('audit.page_of', { page, total: totalPages })}</span>
          <button
            type="button"
            class="rounded-md border border-border px-2.5 py-1 hover:bg-secondary disabled:opacity-40"
            disabled={page >= totalPages}
            aria-label={$t('audit.next')}
            on:click={() => (page = Math.min(totalPages, page + 1))}>›</button>
        </div>
      </div>
    </Card>
  {/if}
</div>
