<script lang="ts">
  import LineChart from './charts/LineChart.svelte';
  import BarChart from './charts/BarChart.svelte';
  import DonutChart from './charts/DonutChart.svelte';
  import PanelForm from './PanelForm.svelte';
  import Card from './ui/Card.svelte';

  // A page schema as returned by the gateway (already localized).
  export let schema: {
    components?: Array<any>;
    controls?: Array<{ id: string; label: string; type: string; value: string | null; options: Array<{ value: string; label: string }> }>;
  } | null = null;
  export let busy = false;
  // Called when a control value changes (parent re-fetches the schema server-side).
  export let onControl: (id: string, value: string) => void = () => {};
  // Guild id (for guild-scoped pages) so embedded panels can save to the guild.
  export let guildId: string | null = null;

  const CHART_COLORS = ['#5865F2', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

  function chartHeight(c: any): string {
    const h = c?.props?.height;
    return typeof h === 'number' && h > 0 ? `${h}px` : '20rem';
  }
  function datasets(c: any) {
    return (c?.props?.series ?? []).map((s: any, i: number) => ({
      label: s.label,
      data: s.data,
      color: CHART_COLORS[i % CHART_COLORS.length],
      fill: c?.props?.type === 'area'
    }));
  }
  function isDonut(c: any) {
    return c?.props?.type === 'doughnut' || c?.props?.type === 'donut';
  }
  function donutData(c: any): number[] {
    return (c?.props?.series?.[0]?.data ?? []).map((n: any) => Number(n) || 0);
  }
</script>

<!-- Server-driven controls (dropdowns) -->
{#if schema?.controls?.length}
  <div class="mb-4 flex flex-wrap items-end gap-3">
    {#each schema.controls as ctl (ctl.id)}
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground">{ctl.label}</span>
        <select
          class="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          value={ctl.value ?? ''}
          disabled={busy}
          on:change={(e) => onControl(ctl.id, (e.currentTarget as HTMLSelectElement).value)}
        >
          {#each ctl.options as o (o.value)}
            <option value={o.value}>{o.label}</option>
          {/each}
        </select>
      </label>
    {/each}
    {#if busy}<span class="pb-2 text-xs text-muted-foreground">…</span>{/if}
  </div>
{/if}

<!-- Component tree -->
<div class="space-y-4" class:opacity-60={busy}>
  {#each schema?.components ?? [] as c}
    {#if c.type === 'heading'}
      {#if (c.props?.level ?? 2) <= 1}
        <h1 class="text-2xl font-semibold">{c.props?.text}</h1>
      {:else if c.props?.level === 2}
        <h2 class="text-lg font-semibold">{c.props?.text}</h2>
      {:else}
        <h3 class="text-base font-medium">{c.props?.text}</h3>
      {/if}
    {:else if c.type === 'text'}
      <p class="whitespace-pre-wrap text-sm text-muted-foreground">{c.props?.text}</p>
    {:else if c.type === 'divider'}
      <hr class="border-border" />
    {:else if c.type === 'chart'}
      <Card class="p-4">
        {#if c.props?.title}<h3 class="mb-2 text-sm font-medium text-muted-foreground">{c.props.title}</h3>{/if}
        <div style={`height:${chartHeight(c)}`}>
          {#if c.props?.type === 'bar'}
            <BarChart labels={c.props?.labels ?? []} datasets={datasets(c)} />
          {:else if isDonut(c)}
            <DonutChart labels={c.props?.labels ?? []} data={donutData(c)} />
          {:else}
            <LineChart labels={c.props?.labels ?? []} datasets={datasets(c)} area={c.props?.type === 'area'} />
          {/if}
        </div>
      </Card>
    {:else if c.type === 'table'}
      <Card class="p-4">
        {#if c.props?.title}<h3 class="mb-2 text-sm font-medium text-muted-foreground">{c.props.title}</h3>{/if}
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border text-left text-muted-foreground">
                {#each c.props?.columns ?? [] as col}<th class="px-2 py-1 font-medium">{col.label ?? col.key}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each c.props?.rows ?? [] as row}
                <tr class="border-b border-border/50">
                  {#each c.props?.columns ?? [] as col}<td class="px-2 py-1">{row[col.key]}</td>{/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>
    {:else if c.type === 'grid'}
      <div class="grid gap-4" style={`grid-template-columns:repeat(${c.props?.cols ?? 2},minmax(0,1fr))`}>
        {#each c.children ?? [] as child}
          <svelte:self schema={{ components: [child] }} />
        {/each}
      </div>
    {:else if c.type === 'panel_ref' && c.props?.key}
      <PanelForm contribution={{ key: c.props.key, name: c.props.title ?? c.props.key }} {guildId} />
    {:else}
      <!-- unknown component type -->
      <p class="text-xs text-muted-foreground/70">[{c.type}]</p>
    {/if}
  {/each}
</div>
