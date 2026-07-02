<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import PanelForm from '$lib/components/PanelForm.svelte';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import { toastSuccess } from '$lib/stores/toasts';
  import type { SetupPanel } from './+page.server';

  export let data: {
    cog: string;
    emoji: string;
    catalogKey: string | null;
    guildId: string | null;
    panels: SetupPanel[];
    online: boolean;
  };

  // i18n helper with fallback (flat dict returns the key itself when missing).
  function tOr(key: string, fallback: string): string {
    const v = $t(key);
    return v === key ? fallback : v;
  }
  $: title = data.catalogKey ? tOr(`features.cog.${data.catalogKey}.title`, data.cog) : data.cog;
  $: backHref = `/features${data.guildId ? `?guild=${encodeURIComponent(data.guildId)}` : ''}`;

  // Wizard state: one settings panel per step. Panels already visited stay
  // mounted (hidden) so entered values survive Previous/Next navigation.
  let step = 0;
  let seen: Record<number, boolean> = { 0: true };
  $: total = data.panels.length;
  $: seen = { ...seen, [step]: true };

  function prev() {
    if (step > 0) step -= 1;
  }
  function next() {
    if (step < total - 1) step += 1;
  }
  function finish() {
    toastSuccess($t('features.setup_done'));
    goto(backHref);
  }
</script>

<div class="mx-auto max-w-3xl space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-semibold">
      <span aria-hidden="true">{data.emoji}</span>
      {$t('features.setup_title', { name: title })}
    </h1>
    <a href={backHref} class="text-sm text-muted-foreground hover:text-foreground">← {$t('features.back')}</a>
  </div>

  {#if !data.online}
    <Card class="border-destructive/50 p-4"><p class="text-sm text-destructive">{$t('common.gateway_offline')}</p></Card>
  {:else if total === 0}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('features.setup_none')}</p></Card>
  {:else}
    <!-- Progress: step counter + bar -->
    <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium">{data.panels[step].name}</span>
        <span class="text-muted-foreground">{$t('features.setup_step', { n: step + 1, total })}</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div class="h-full rounded-full bg-primary transition-all" style={`width: ${((step + 1) / total) * 100}%`}></div>
      </div>
    </div>

    <!-- Keep visited steps mounted so PanelForm state is preserved when going back. -->
    {#each data.panels as panel, i (panel.key)}
      {#if seen[i]}
        <div class:hidden={step !== i}>
          <PanelForm contribution={panel} guildId={data.guildId} />
        </div>
      {/if}
    {/each}

    <div class="flex items-center justify-between">
      <button
        type="button"
        class="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary disabled:opacity-50"
        disabled={step === 0}
        on:click={prev}
      >{$t('features.setup_prev')}</button>
      {#if step < total - 1}
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          on:click={next}
        >{$t('features.setup_next')}</button>
      {:else}
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          on:click={finish}
        >{$t('features.setup_finish')}</button>
      {/if}
    </div>
  {/if}
</div>
