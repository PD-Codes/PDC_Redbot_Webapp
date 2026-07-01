<script lang="ts">
  import Card from './ui/Card.svelte';
  import { onMount, tick, createEventDispatcher } from 'svelte';
  import { t, locale } from '$lib/i18n';

  const dispatch = createEventDispatcher();

  export let contribution: { key: string; name: string; description?: string | null };
  export let guildId: string | null = null;

  let loading = true;
  let saving = false;
  let message: string | null = null;
  let error: string | null = null;
  let schema: { fields: any[]; submit_label?: string; description?: string | null } | null = null;
  let values: Record<string, any> = {};

  // Refs auf die Textareas (für Variablen-Einfügung an Cursor-Position).
  let taRefs: Record<string, HTMLTextAreaElement> = {};

  async function loadSchema() {
    const res = await fetch('/api/panel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'schema', key: contribution.key, guildId, locale: $locale })
    });
    const json = await res.json();
    if (json.error) { error = json.error; loading = false; return; }
    schema = json.schema;
    // Neues Objekt zuweisen (nicht mutieren), damit Svelte die Eingaben nach einem
    // Neuladen – z. B. Profilwechsel via reload_on_change – tatsächlich aktualisiert.
    const nv: Record<string, any> = {};
    for (const f of schema!.fields) nv[f.key] = f.value;
    values = nv;
    loading = false;
  }

  // Fügt nur die Variable an der aktuellen Cursor-Position ein (ersetzt Auswahl).
  async function insertVar(key: string, token: string) {
    const ta = taRefs[key];
    const cur = values[key] ?? '';
    let start = cur.length, end = cur.length;
    if (ta) { start = ta.selectionStart; end = ta.selectionEnd; }
    values[key] = cur.slice(0, start) + token + cur.slice(end);
    await tick();
    if (ta) {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    }
  }

  async function submit() {
    saving = true;
    message = null;
    error = null;
    const res = await fetch('/api/panel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'submit', key: contribution.key, guildId, data: values })
    });
    const json = await res.json();
    saving = false;
    if (json.error) { error = json.error; return; }
    if (json.result?.success) {
      message = json.result.message ?? 'Gespeichert.';
      // Manche Aktionen (z. B. Profilwechsel) wirken sich auf andere Tabs aus →
      // Modul-Reload anstoßen, damit die Geschwister-Panels den Stand neu laden.
      if (json.result.reload) dispatch('reloadModule');
    } else {
      error = json.result?.message ?? 'Fehler';
    }
  }

  // Select mit reload_on_change: Auswahl sofort anwenden (Speichern) + Panel neu laden,
  // damit z. B. nach Profilwechsel die zugehörigen Werte erscheinen.
  async function reloadField() {
    saving = true;
    message = null;
    error = null;
    try {
      await fetch('/api/panel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'submit', key: contribution.key, guildId, data: values })
      });
      await loadSchema();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Fehler';
    } finally {
      saving = false;
    }
  }

  onMount(loadSchema);

  // Bei Sprachwechsel das Schema neu laden (Panel-Beschreibung ist lokalisiert).
  let prevLocale = '';
  $: if ($locale && $locale !== prevLocale) {
    if (prevLocale) loadSchema();
    prevLocale = $locale;
  }
</script>

<Card class="p-5">
  <h3 class="mb-1 text-base font-semibold">{contribution.name}</h3>
  {#if schema?.description ?? contribution.description}<p class="mb-4 text-sm text-muted-foreground">{schema?.description ?? contribution.description}</p>{/if}

  {#if loading}
    <div class="h-24 animate-pulse rounded bg-muted"></div>
  {:else if error && !schema}
    <p class="text-sm text-destructive">{error}</p>
  {:else if schema}
    <form on:submit|preventDefault={submit} class="space-y-4">
      {#each schema.fields as f}
        <div class="space-y-1.5">
          <label class="text-sm font-medium" for={f.key}>{f.label}</label>
          {#if f.type === 'switch'}
            <input id={f.key} type="checkbox" bind:checked={values[f.key]} class="chb-main" />
          {:else if f.type === 'textarea'}
            <textarea id={f.key} bind:this={taRefs[f.key]} bind:value={values[f.key]} maxlength={f.max_length}
              class="w-full rounded-md border border-input bg-background p-2 text-sm" rows="3"></textarea>

            {#if f.variables?.length}
              <p class="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('panel.insert_variables')}</p>
              <div class="flex flex-wrap gap-2">
                {#each f.variables as v}
                  <button
                    type="button"
                    title={v.desc}
                    on:click={() => insertVar(f.key, v.token)}
                    class="inline-flex items-baseline gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 hover:border-primary/60"
                  >
                    <code class="text-sm text-primary">{v.token}</code>
                    <span class="text-xs text-muted-foreground">{v.desc}</span>
                  </button>
                {/each}
              </div>
            {/if}
          {:else if f.type === 'number'}
            <input id={f.key} type="number" min={f.min} max={f.max} bind:value={values[f.key]}
              class="w-full rounded-md border border-input bg-background p-2 text-sm" />
          {:else if f.type === 'select'}
            <select id={f.key} bind:value={values[f.key]}
              on:change={() => f.reload_on_change && reloadField()}
              class="w-full rounded-md border border-input bg-background p-2 text-sm">
              {#each f.options ?? [] as opt}<option value={opt.value}>{opt.label}</option>{/each}
            </select>
          {:else if f.type === 'multiselect'}
            <!-- Mehrfachauswahl als Chips + Hinzufügen-Dropdown -->
            {@const sel = Array.isArray(values[f.key]) ? values[f.key].map(String) : []}
            {@const labelOf = (v) => (f.options ?? []).find((o) => String(o.value) === String(v))?.label ?? v}
            <div class="flex flex-wrap gap-2">
              {#each sel as v (v)}
                <span class="inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-1 text-sm">
                  {labelOf(v)}
                  <button type="button" class="text-muted-foreground hover:text-destructive"
                    on:click={() => (values[f.key] = sel.filter((x) => x !== v))}>✕</button>
                </span>
              {:else}
                <span class="text-xs text-muted-foreground">{$t('panel.nothing_selected')}</span>
              {/each}
            </div>
            <select
              class="w-full rounded-md border border-input bg-background p-2 text-sm"
              on:change={(e) => {
                const val = e.currentTarget.value;
                if (val && !sel.includes(val)) values[f.key] = [...sel, val];
                e.currentTarget.value = '';
              }}
            >
              <option value="">{$t('panel.add')}</option>
              {#each (f.options ?? []).filter((o) => !sel.includes(String(o.value))) as opt (opt.value)}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          {:else}
            <input id={f.key} type="text" placeholder={f.placeholder} bind:value={values[f.key]}
              maxlength={f.max_length} class="w-full rounded-md border border-input bg-background p-2 text-sm" />
          {/if}
          {#if f.description}<p class="text-xs text-muted-foreground">{f.description}</p>{/if}
        </div>
      {/each}

      <div class="flex items-center gap-3">
        <button type="submit" disabled={saving}
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {saving ? '…' : (schema.submit_label ?? $t('panel.save'))}
        </button>
        {#if message}<span class="text-sm text-emerald-500">{message}</span>{/if}
        {#if error}<span class="text-sm text-destructive">{error}</span>{/if}
      </div>
    </form>
  {/if}
</Card>
