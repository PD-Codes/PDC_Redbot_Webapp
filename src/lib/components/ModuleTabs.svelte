<script lang="ts">
  import PanelForm from './PanelForm.svelte';
  import ListManager from './ListManager.svelte';
  import { t } from '$lib/i18n';

  // Alle Beiträge EINES Moduls (Cogs). Panels + Listen werden zu Tabs.
  export let contributions: Array<{
    key: string;
    kind: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    editable?: boolean;
    deletable?: boolean;
    order?: number;
  }> = [];
  export let guildId: string | null = null;

  // Nur was sich als Tab darstellen lässt (Panels = Formular, Listen = Tabelle),
  // sortiert nach order (kleiner = weiter links), dann Name.
  $: tabs = contributions
    .filter((c) => c.kind === 'panel' || c.kind === 'list')
    .slice()
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name));

  let active = '';
  // Standard-Tab setzen / korrigieren, wenn sich die Beiträge ändern.
  $: if (tabs.length && !tabs.some((t) => t.key === active)) active = tabs[0].key;
  $: current = tabs.find((t) => t.key === active) ?? null;

  // Bereits geöffnete Tabs merken → Inhalt bleibt erhalten (kein Neuladen beim Wechsel).
  let seen: Record<string, boolean> = {};
  $: if (active) seen = { ...seen, [active]: true };

  // Ein Panel meldet, dass sich modulweite Daten geändert haben (z. B. Profilwechsel).
  // Alle ANDEREN Tabs aus dem Cache werfen → sie laden beim nächsten Öffnen frisch.
  function reloadSiblings() {
    seen = active ? { [active]: true } : {};
  }
</script>

{#if tabs.length === 0}
  <p class="text-sm text-muted-foreground">{$t('modules.no_settings')}</p>
{:else}
  <div class="space-y-3">
    {#if tabs.length > 1}
      <div class="flex flex-wrap gap-1 border-b border-border">
        {#each tabs as t (t.key)}
          <button
            type="button"
            on:click={() => (active = t.key)}
            class="-mb-px rounded-t-md border-b-2 px-3 py-1.5 text-sm transition
              {active === t.key
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'}"
          >
            {#if t.kind === 'list'}<span class="mr-1 text-xs opacity-60">≡</span>{/if}{t.name}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Alle einmal geöffneten Tabs im DOM behalten, inaktive nur ausblenden. -->
    {#each tabs as t (t.key)}
      {#if seen[t.key]}
        <div class:hidden={active !== t.key}>
          {#if t.kind === 'panel'}
            <PanelForm contribution={t} {guildId} on:reloadModule={reloadSiblings} />
          {:else if t.kind === 'list'}
            <ListManager contribution={t} {guildId} />
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}
