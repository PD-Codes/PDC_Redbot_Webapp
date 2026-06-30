<script lang="ts">
  import Card from './ui/Card.svelte';
  import LineChart from './charts/LineChart.svelte';
  import { onMount } from 'svelte';
  import { locale } from '$lib/i18n';

  // Manifest-Eintrag eines Widgets
  export let contribution: {
    key: string;
    name: string;
    icon?: string | null;
    size?: string;
    refresh?: number | null;
  };
  export let guildId: string | null = null;

  let loading = true;
  let error: string | null = null;
  let data: { kind: string; payload: any } | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function load() {
    try {
      const res = await fetch('/api/widget', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: contribution.key, guildId, locale: $locale })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      data = json.data;
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Fehler';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    load();
    if (contribution.refresh) timer = setInterval(load, contribution.refresh * 1000);
    return () => timer && clearInterval(timer);
  });

  // Bei Sprachwechsel neu laden (Widget-Inhalte können lokalisiert sein).
  let prevLocale = '';
  $: if ($locale && $locale !== prevLocale) {
    if (prevLocale) load();
    prevLocale = $locale;
  }

  const colSpan: Record<string, string> = {
    sm: 'md:col-span-1',
    md: 'md:col-span-2',
    lg: 'md:col-span-3'
  };
  // Palette for chart-kind widget datasets.
  const CHART_COLORS = ['#5865F2', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];
</script>

<Card class={`p-4 ${colSpan[contribution.size ?? 'md']}`}>
  <div class="mb-2 flex items-center justify-between">
    <h3 class="text-sm font-medium text-muted-foreground">{contribution.name}</h3>
  </div>

  {#if loading}
    <div class="h-10 animate-pulse rounded bg-muted"></div>
  {:else if error}
    <p class="text-sm text-destructive">{error}</p>
  {:else if data?.kind === 'kpi'}
    <div class="flex items-end gap-2">
      <span class="text-3xl font-semibold">{data.payload.value}</span>
      {#if data.payload.trend}
        <span
          class="text-xs"
          class:text-emerald-500={data.payload.intent === 'positive'}
          class:text-destructive={data.payload.intent === 'negative'}>{data.payload.trend}</span
        >
      {/if}
    </div>
    <p class="text-xs text-muted-foreground">{data.payload.label}</p>
  {:else if data?.kind === 'status'}
    <div class="flex items-center gap-2">
      <span
        class="h-2.5 w-2.5 rounded-full"
        class:bg-emerald-500={data.payload.state === 'ok'}
        class:bg-amber-500={data.payload.state === 'warn'}
        class:bg-destructive={data.payload.state === 'error'}
      ></span>
      <span class="text-sm">{data.payload.label}</span>
    </div>
    {#if data.payload.detail}<p class="mt-1 text-xs text-muted-foreground">{data.payload.detail}</p>{/if}
  {:else if data?.kind === 'list'}
    <ul class="space-y-1 text-sm">
      {#each data.payload.items as item}
        <li class="flex justify-between border-b border-border/50 py-1">
          <span>{item.label ?? item.name}</span><span class="text-muted-foreground">{item.value ?? ''}</span>
        </li>
      {:else}
        <li class="text-muted-foreground">{data.payload.empty ?? '—'}</li>
      {/each}
    </ul>
  {:else if data?.kind === 'markdown'}
    <p class="whitespace-pre-wrap text-sm">{data.payload.text}</p>
  {:else if data?.kind === 'chart'}
    <div class="h-56">
      <LineChart
        labels={data.payload.labels ?? []}
        datasets={(data.payload.series ?? []).map((s, i) => ({
          label: s.label,
          data: s.data,
          color: CHART_COLORS[i % CHART_COLORS.length]
        }))}
      />
    </div>
  {:else}
    <p class="text-sm text-muted-foreground">—</p>
  {/if}
</Card>
