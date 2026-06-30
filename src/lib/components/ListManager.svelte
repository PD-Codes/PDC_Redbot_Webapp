<script lang="ts">
  import Card from './ui/Card.svelte';
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';

  export let contribution: {
    key: string;
    name: string;
    description?: string | null;
    editable?: boolean;
    deletable?: boolean;
  };
  export let guildId: string | null = null;

  let loading = true;
  let error: string | null = null;
  let busy = '';
  let columns: Array<{ key: string; label: string }> = [];
  let rows: Array<{ id: string; cells: Record<string, string> }> = [];

  // Bearbeiten-Status
  let editId: string | null = null;
  let editFields: any[] = [];
  let editValues: Record<string, any> = {};
  let editError: string | null = null;
  let editLoading = false;

  async function load() {
    loading = true;
    try {
      const res = await fetch('/api/list', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'rows', key: contribution.key, guildId })
      });
      const j = await res.json();
      if (j.error) error = j.error;
      else {
        columns = j.columns ?? [];
        rows = j.rows ?? [];
        error = null;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Fehler';
    } finally {
      loading = false;
    }
  }

  async function del(id: string) {
    busy = id;
    try {
      const res = await fetch('/api/list', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'delete', key: contribution.key, guildId, id })
      });
      const j = await res.json();
      if (j.error) error = j.error;
      else await load();
    } finally {
      busy = '';
    }
  }

  async function openEdit(id: string) {
    if (editId === id) { editId = null; return; }
    editId = id;
    editError = null;
    editLoading = true;
    editFields = [];
    editValues = {};
    try {
      const res = await fetch('/api/list', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'edit_form', key: contribution.key, guildId, id })
      });
      const j = await res.json();
      if (j.error) { editError = j.error; return; }
      editFields = j.schema?.fields ?? [];
      for (const f of editFields) editValues[f.key] = f.value;
    } catch (e) {
      editError = e instanceof Error ? e.message : 'Fehler';
    } finally {
      editLoading = false;
    }
  }

  async function saveEdit() {
    if (!editId) return;
    busy = 'edit:' + editId;
    editError = null;
    try {
      const res = await fetch('/api/list', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'edit', key: contribution.key, guildId, id: editId, data: editValues })
      });
      const j = await res.json();
      if (j.error) { editError = j.error; return; }
      if (j.result && j.result.success === false) { editError = j.result.message ?? 'Fehler'; return; }
      editId = null;
      await load();
    } finally {
      busy = '';
    }
  }

  onMount(load);
</script>

<Card class="p-5">
  <div class="mb-3 flex items-center justify-between">
    <h3 class="text-base font-semibold">{contribution.name}</h3>
    <button type="button" class="text-xs text-muted-foreground hover:text-foreground" on:click={load}>↻ {$t('common.refresh')}</button>
  </div>
  {#if contribution.description}<p class="mb-3 text-sm text-muted-foreground">{contribution.description}</p>{/if}

  {#if loading}
    <div class="h-16 animate-pulse rounded bg-muted"></div>
  {:else if error}
    <p class="text-sm text-destructive">{error}</p>
  {:else if rows.length === 0}
    <p class="text-sm text-muted-foreground">{$t('common.no_entries')}</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {#each columns as col (col.key)}<th class="px-2 py-1.5 font-medium">{col.label}</th>{/each}
            <th class="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.id)}
            <tr class="border-b border-border/60 last:border-0">
              {#each columns as col (col.key)}
                <td class="px-2 py-1.5">{row.cells[col.key] ?? '—'}</td>
              {/each}
              <td class="px-2 py-1.5">
                <div class="flex justify-end gap-2">
                  {#if contribution.editable}
                    <button
                      type="button"
                      class="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
                      on:click={() => openEdit(row.id)}
                    >
                      {editId === row.id ? $t('common.close') : $t('common.edit')}
                    </button>
                  {/if}
                  {#if contribution.deletable !== false}
                    <button
                      type="button"
                      class="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive disabled:opacity-40"
                      disabled={busy === row.id}
                      on:click={() => del(row.id)}
                    >
                      {busy === row.id ? '…' : $t('common.delete')}
                    </button>
                  {/if}
                </div>
              </td>
            </tr>

            {#if editId === row.id}
              <tr class="bg-secondary/30">
                <td colspan={columns.length + 1} class="px-3 py-3">
                  {#if editLoading}
                    <div class="h-10 animate-pulse rounded bg-muted"></div>
                  {:else if editError && editFields.length === 0}
                    <p class="text-sm text-destructive">{editError}</p>
                  {:else}
                    <div class="space-y-3">
                      {#each editFields as f (f.key)}
                        <div class="space-y-1">
                          <label class="text-xs font-medium" for={'e_' + f.key}>{f.label}</label>
                          {#if f.type === 'switch'}
                            <input id={'e_' + f.key} type="checkbox" bind:checked={editValues[f.key]} class="h-5 w-9 accent-primary" />
                          {:else if f.type === 'number'}
                            <input id={'e_' + f.key} type="number" min={f.min} max={f.max} bind:value={editValues[f.key]}
                              class="w-full rounded-md border border-input bg-background p-2 text-sm" />
                          {:else if f.type === 'select'}
                            <select id={'e_' + f.key} bind:value={editValues[f.key]}
                              class="w-full rounded-md border border-input bg-background p-2 text-sm">
                              {#each f.options ?? [] as opt (opt.value)}<option value={opt.value}>{opt.label}</option>{/each}
                            </select>
                          {:else if f.type === 'multiselect'}
                            {@const sel = Array.isArray(editValues[f.key]) ? editValues[f.key].map(String) : []}
                            {@const labelOf = (v) => (f.options ?? []).find((o) => String(o.value) === String(v))?.label ?? v}
                            <div class="flex flex-wrap gap-2">
                              {#each sel as v (v)}
                                <span class="inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-1 text-sm">
                                  {labelOf(v)}
                                  <button type="button" class="text-muted-foreground hover:text-destructive"
                                    on:click={() => (editValues[f.key] = sel.filter((x) => x !== v))}>✕</button>
                                </span>
                              {/each}
                            </div>
                            <select class="w-full rounded-md border border-input bg-background p-2 text-sm"
                              on:change={(e) => {
                                const val = e.currentTarget.value;
                                if (val && !sel.includes(val)) editValues[f.key] = [...sel, val];
                                e.currentTarget.value = '';
                              }}>
                              <option value="">{$t('panel.add')}</option>
                              {#each (f.options ?? []).filter((o) => !sel.includes(String(o.value))) as opt (opt.value)}
                                <option value={opt.value}>{opt.label}</option>
                              {/each}
                            </select>
                          {:else}
                            <input id={'e_' + f.key} type="text" placeholder={f.placeholder} bind:value={editValues[f.key]}
                              class="w-full rounded-md border border-input bg-background p-2 text-sm" />
                          {/if}
                          {#if f.description}<p class="text-xs text-muted-foreground">{f.description}</p>{/if}
                        </div>
                      {/each}
                      <div class="flex items-center gap-3">
                        <button type="button" disabled={busy === 'edit:' + row.id}
                          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                          on:click={saveEdit}>
                          {busy === 'edit:' + row.id ? '…' : $t('common.save')}
                        </button>
                        {#if editError}<span class="text-sm text-destructive">{editError}</span>{/if}
                      </div>
                    </div>
                  {/if}
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Card>
