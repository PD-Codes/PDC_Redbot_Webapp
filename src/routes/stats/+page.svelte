<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import LineChart from '$lib/components/charts/LineChart.svelte';
  import BarChart from '$lib/components/charts/BarChart.svelte';
  import DonutChart from '$lib/components/charts/DonutChart.svelte';
  import SeriesToggle from '$lib/components/charts/SeriesToggle.svelte';
  import Heatmap from '$lib/components/charts/Heatmap.svelte';
  import { onDestroy } from 'svelte';
  import { t, locale } from '$lib/i18n';
  import type { StatsGuild } from './+page.server';

  export let data: { guilds: StatsGuild[] };

  // ── Palette ──────────────────────────────────────────────────────────
  const COLORS = {
    green: '#22c55e',
    blue: '#3b82f6',
    red: '#ef4444',
    amber: '#f59e0b',
    violet: '#8b5cf6'
  };
  const DONUT = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];

  type Section =
    | 'overview'
    | 'messages'
    | 'voice'
    | 'status'
    | 'invites'
    | 'activity'
    | 'commands'
    | 'member_drilldown'
    | 'channel_drilldown'
    | 'now'
    | 'heatmap'
    | 'peaks'
    | 'leaderboard'
    | 'retention';

  const MENU: Array<{ key: Section; tkey: string }> = [
    { key: 'overview', tkey: 'stats.menu_overview' },
    { key: 'messages', tkey: 'stats.menu_messages' },
    { key: 'voice', tkey: 'stats.menu_voice' },
    { key: 'status', tkey: 'stats.menu_status' },
    { key: 'invites', tkey: 'stats.menu_invites' },
    { key: 'activity', tkey: 'stats.menu_activity' },
    { key: 'commands', tkey: 'stats.menu_commands' },
    { key: 'member_drilldown', tkey: 'stats.menu_member_drilldown' },
    { key: 'channel_drilldown', tkey: 'stats.menu_channel_drilldown' },
    { key: 'now', tkey: 'stats.menu_now' },
    { key: 'heatmap', tkey: 'stats.menu_heatmap' },
    { key: 'peaks', tkey: 'stats.menu_peaks' },
    { key: 'leaderboard', tkey: 'stats.menu_leaderboard' },
    { key: 'retention', tkey: 'stats.menu_retention' }
  ];

  const DAY_OPTIONS = [1, 7, 14, 30, 60, 90, 180, 365];

  // ── State ────────────────────────────────────────────────────────────
  let selectedGuild: string = data.guilds[0]?.id ?? '';
  let section: Section = 'overview';
  // Zeitraum: Preset aus DAY_OPTIONS oder "custom" mit freier Eingabe (1–365 Tage).
  let dayPreset: number | 'custom' = 30;
  let customDays = 30;
  $: days = dayPreset === 'custom'
    ? Math.max(1, Math.min(365, Math.round(Number(customDays)) || 1))
    : (dayPreset as number);
  let memberId = '';
  let channelId = '';
  let heatmapMetric: 'messages' | 'voice' = 'messages';

  // Leaderboard: fetch up to 100 entries from the gateway, paginate client-side.
  const LEADERBOARD_LIMIT = 100;
  const LEADERBOARD_PAGE_SIZE = 20;
  let lbPage: Record<'messages' | 'voice', number> = { messages: 1, voice: 1 };

  let loading = false;
  let error = '';
  let result: any = null;

  // Toggle state per section (hide/show individual rows).
  let hidden: Record<string, boolean[]> = {};

  // To keep reactivity from running into an endless loop, the fetch only
  // depends on the input parameters, not on `result`.
  let lastKey = '';
  let reqSeq = 0;

  async function fetchStats(key: string) {
    const seq = ++reqSeq; // only the LATEST request may set the result
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/stats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          section,
          guildId: selectedGuild,
          days,
          member_id: memberId,
          channel_id: channelId,
          metric: heatmapMetric,
          limit: section === 'leaderboard' ? LEADERBOARD_LIMIT : undefined
        })
      });
      const j = await res.json();
      if (seq !== reqSeq) return; // veraltete Antwort (User hat inzwischen umgeschaltet)
      if (j.error) {
        error = j.error;
        result = null;
      } else {
        result = j;
        // Drilldown: ausgewählte Option vom Server übernehmen.
        if (section === 'member_drilldown' && j.member_id != null) memberId = j.member_id;
        if (section === 'channel_drilldown' && j.channel_id != null) channelId = j.channel_id;
        if (section === 'leaderboard') lbPage = { messages: 1, voice: 1 }; // reset pagination on new data
      }
    } catch (e) {
      if (seq !== reqSeq) return;
      error = e instanceof Error ? e.message : $t('stats.load_error');
      result = null;
    } finally {
      if (seq === reqSeq) {
        loading = false;
        lastKey = key;
      }
    }
  }

  // Reactive: only input parameters trigger a fetch.
  $: requestKey = `${selectedGuild}|${section}|${days}|${memberId}|${channelId}|${heatmapMetric}`;
  $: if (selectedGuild && requestKey !== lastKey) {
    fetchStats(requestKey);
  }

  // Auto-refresh: reload every 10s while active.
  // IMPORTANT: do NOT reactively depend on autoTimer (otherwise the timer
  // endlessly deletes/recreates itself and never fires). Hence wrapped in a
  // function that is only re-set-up when `auto`/`selectedGuild` change.
  let auto = false;
  let autoTimer: ReturnType<typeof setInterval> | null = null;
  function setupAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    if (auto && selectedGuild) {
      autoTimer = setInterval(() => fetchStats(requestKey), 10000);
    }
  }
  $: {
    auto;
    selectedGuild;
    setupAuto();
  }
  onDestroy(() => {
    if (autoTimer) clearInterval(autoTimer);
  });

  // Sektionswechsel → Toggle-Status zurücksetzen.
  function selectSection(s: Section) {
    section = s;
  }

  function toggleSeries(sec: string, count: number, i: number) {
    const arr = hidden[sec] ?? new Array(count).fill(false);
    arr[i] = !arr[i];
    hidden = { ...hidden, [sec]: [...arr] };
  }
  function isHidden(sec: string, i: number): boolean {
    return hidden[sec]?.[i] ?? false;
  }

  // ── Formatting (follows the UI language, en-US default) ─────────────
  let nf = new Intl.NumberFormat('en-US');
  let fmtLocale = 'en-US';
  $: {
    fmtLocale = $locale || 'en-US';
    nf = new Intl.NumberFormat(fmtLocale);
  }
  function fmt(n: number | null | undefined): string {
    if (n == null) return '–';
    return nf.format(n);
  }
  function fmtHours(n: number | null | undefined): string {
    if (n == null) return '–';
    return nf.format(Math.round(n * 10) / 10);
  }
  // Retention: the gateway has been observed sending the rate both as a 0–1
  // fraction and as an already-computed 0–100 percentage. Normalize defensively
  // so the UI never shows something like "8,420%" again (16/19 stayed = ~84.2%).
  function retentionPct(rate: number | null | undefined): number {
    const r = rate ?? 0;
    return r > 1 ? r : r * 100;
  }
  function shortDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(fmtLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function readableDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(fmtLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function guildIconUrl(g: StatsGuild): string | null {
    if (!g.icon) return null;
    return `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`;
  }

  // ── Abgeleitete Datasets (mit Toggle) ────────────────────────────────
  // IMPORTANT: reference `hidden` directly here (not via the isHidden() helper).
  // Svelte's $: dependency tracking is purely syntactic — it only picks up
  // top-level variables referenced literally inside the reactive statement.
  // Calling a helper function that reads `hidden` internally does NOT register
  // `hidden` as a dependency, so toggling a series used to have no visible
  // effect until the next full data fetch (e.g. a page reload).
  $: overviewSeries =
    result && section === 'overview'
      ? [
          { label: $t('stats.series_members'), color: COLORS.green, data: result.members ?? [], hidden: hidden['overview']?.[0] ?? false },
          { label: $t('stats.series_joins'), color: COLORS.blue, data: result.joins ?? [], hidden: hidden['overview']?.[1] ?? false },
          { label: $t('stats.series_leaves'), color: COLORS.red, data: result.leaves ?? [], hidden: hidden['overview']?.[2] ?? false },
          { label: $t('stats.series_net'), color: COLORS.amber, data: result.net ?? [], hidden: hidden['overview']?.[3] ?? false }
        ]
      : [];

  $: statusSeries =
    result && section === 'status'
      ? [
          { label: $t('stats.series_online'), color: COLORS.green, data: (result.samples ?? []).map((s: any) => s.on), fill: true, hidden: hidden['status']?.[0] ?? false },
          { label: $t('stats.series_idle'), color: COLORS.amber, data: (result.samples ?? []).map((s: any) => s.idle), fill: true, hidden: hidden['status']?.[1] ?? false },
          { label: $t('stats.series_dnd'), color: COLORS.red, data: (result.samples ?? []).map((s: any) => s.dnd), fill: true, hidden: hidden['status']?.[2] ?? false }
        ]
      : [];
  $: statusLabels = result && section === 'status' ? (result.samples ?? []).map((s: any) => shortDate(s.t)) : [];
  // KPI cards for the Status page: latest snapshot + peak over the selected period.
  $: statusSamplesRaw = result && section === 'status' ? (result.samples ?? []) : [];
  $: statusCurrent = statusSamplesRaw.length ? statusSamplesRaw[statusSamplesRaw.length - 1] : null;
  $: statusPeakVals = statusSamplesRaw.length
    ? {
        on: Math.max(...statusSamplesRaw.map((s: any) => s.on ?? 0)),
        idle: Math.max(...statusSamplesRaw.map((s: any) => s.idle ?? 0)),
        dnd: Math.max(...statusSamplesRaw.map((s: any) => s.dnd ?? 0))
      }
    : null;

  // Invites: label each series/slice as "name (code)" when the gateway tells us
  // who owns the invite code (result.code_owners: { [code]: displayName }).
  // Falls back to the bare code when that isn't available.
  function inviteLabel(code: string): string {
    const owner = result?.code_owners?.[code];
    return owner ? `${owner} (${code})` : code;
  }

  $: inviteSeries =
    result && section === 'invites'
      ? Object.keys(result.series ?? {}).map((code, idx) => ({
          label: inviteLabel(code),
          color: DONUT[idx % DONUT.length],
          data: result.series[code] as number[],
          hidden: hidden['invites']?.[idx] ?? false
        }))
      : [];

  $: peakSeries =
    result && section === 'peaks'
      ? [
          { label: $t('stats.series_online'), color: COLORS.green, data: result.online ?? [], hidden: hidden['peaks']?.[0] ?? false },
          { label: $t('stats.series_voice'), color: COLORS.violet, data: result.voice ?? [], hidden: hidden['peaks']?.[1] ?? false }
        ]
      : [];

  // ── CSV-Export ───────────────────────────────────────────────────────
  function csvCell(v: any): string {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function downloadCsv(rows: any[][], name: string) {
    if (!rows.length) return;
    const text = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Sections that have exportable table data.
  function hasCsv(s: Section): boolean {
    return ['messages', 'voice', 'leaderboard', 'commands', 'activity', 'invites'].includes(s);
  }

  function exportCsv() {
    if (!result) return;
    const rows: any[][] = [];
    if (section === 'messages' || section === 'voice') {
      rows.push(['#', 'name', 'value']);
      (result.top_members ?? []).forEach((m: any, i: number) => rows.push([i + 1, m.name, m.value]));
    } else if (section === 'leaderboard') {
      rows.push(['board', 'rank', 'name', 'value', 'change']);
      (result.messages ?? []).forEach((m: any) => rows.push(['messages', m.rank, m.name, m.value, m.change ?? 'new']));
      (result.voice ?? []).forEach((m: any) => rows.push(['voice', m.rank, m.name, m.value, m.change ?? 'new']));
    } else if (section === 'commands') {
      rows.push(['#', 'command', 'count', 'errors']);
      (result.top_commands ?? []).forEach((c: any, i: number) => rows.push([i + 1, c.name, c.count, c.errors]));
    } else if (section === 'activity') {
      rows.push(['#', 'game', 'minutes']);
      (result.top_games ?? []).forEach((g: any, i: number) => rows.push([i + 1, g.name, g.minutes]));
    } else if (section === 'invites') {
      rows.push(['date', 'member', 'code']);
      (result.recent_logs ?? []).forEach((l: any) => rows.push([l.date, l.username, l.code]));
    }
    downloadCsv(rows, `stats-${section}.csv`);
  }
</script>

<div class="space-y-5">
  <!-- Top bar ───────────────────────────────────────────────────────── -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-semibold">{$t('stats.title')}</h1>
    <div class="flex flex-wrap items-center gap-2">
      <select
        bind:value={selectedGuild}
        class="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        aria-label={$t('stats.server')}
      >
        {#each data.guilds as g (g.id)}
          <option value={g.id}>{g.name}</option>
        {/each}
      </select>
      <label class="flex items-center gap-1.5 text-sm text-muted-foreground">
        {$t('stats.period')}
        <select bind:value={dayPreset} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground">
          {#each DAY_OPTIONS as d (d)}
            <option value={d}>{$t('stats.days', { n: d })}</option>
          {/each}
          <option value="custom">{$t('stats.days_custom')}</option>
        </select>
        {#if dayPreset === 'custom'}
          <input
            type="number"
            min="1"
            max="365"
            value={customDays}
            on:change={(e) => (customDays = Math.max(1, Math.min(365, Number(e.currentTarget.value) || 1)))}
            class="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            title={$t('stats.days_custom_hint')}
          />
          <span class="text-xs text-muted-foreground">{$t('stats.days', { n: days })}</span>
        {/if}
      </label>
      <label class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <input type="checkbox" bind:checked={auto} class="chb-main" />
        {$t('stats.auto_refresh')}
      </label>
      {#if result && hasCsv(section)}
        <button
          type="button"
          on:click={exportCsv}
          class="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-secondary/50"
        >
          {$t('stats.export_csv')}
        </button>
      {/if}
    </div>
  </div>

  {#if data.guilds.length === 0}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('stats.no_servers')}</p></Card>
  {:else}
    <div class="flex flex-col gap-5 lg:flex-row">
      <!-- Side menu ──────────────────────────────────────────────── -->
      <div class="shrink-0 lg:w-52">
        <div class="flex flex-wrap gap-1 lg:flex-col">
          {#each MENU as m (m.key)}
            <button
              type="button"
              on:click={() => selectSection(m.key)}
              class="rounded-md px-3 py-1.5 text-left text-sm transition
                {section === m.key ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}"
            >
              {$t(m.tkey)}
            </button>
          {/each}
        </div>
      </div>

      <!-- Main content ───────────────────────────────────────────── -->
      <div class="min-w-0 flex-1 space-y-5">
        {#if loading}
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {#each Array(4) as _, i (i)}
                <Card class="h-20 animate-pulse bg-secondary/40 p-4"></Card>
              {/each}
            </div>
            <Card class="h-[320px] animate-pulse bg-secondary/40 p-4"></Card>
          </div>
        {:else if error}
          <Card class="border-destructive/50 p-4"><p class="text-sm text-destructive">{error}</p></Card>
        {:else if result}

          <!-- OVERVIEW ───────────────────────────────────────────── -->
          {#if section === 'overview'}
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.kpi_members')}</p><p class="mt-1 text-2xl font-semibold">{fmt(result.kpi?.members)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.kpi_joins_7d')}</p><p class="mt-1 text-2xl font-semibold text-blue-400">{fmt(result.kpi?.joins_7d)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.kpi_leaves_7d')}</p><p class="mt-1 text-2xl font-semibold text-red-400">{fmt(result.kpi?.leaves_7d)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.kpi_messages_7d')}</p><p class="mt-1 text-2xl font-semibold">{fmt(result.kpi?.messages_7d)}</p></Card>
              <Card class="col-span-2 p-4 sm:col-span-1"><p class="text-xs text-muted-foreground">{$t('stats.kpi_voice_hours_7d')}</p><p class="mt-1 text-2xl font-semibold">{fmtHours(result.kpi?.voice_hours_7d)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.kpi_net_7d')}</p><p class="mt-1 text-2xl font-semibold {(result.kpi?.net_7d ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}">{fmt(result.kpi?.net_7d)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.kpi_peak_online')}</p><p class="mt-1 text-2xl font-semibold">{fmt(result.kpi?.peak_online)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.kpi_peak_voice')}</p><p class="mt-1 text-2xl font-semibold">{fmt(result.kpi?.peak_voice)}</p></Card>
            </div>
            <Card class="p-4">
              <div class="mb-3">
                <SeriesToggle
                  series={overviewSeries.map((s) => ({ label: s.label, color: s.color, hidden: s.hidden }))}
                  on:toggle={(e) => toggleSeries('overview', 4, e.detail)}
                />
              </div>
              <LineChart labels={result.labels ?? []} datasets={overviewSeries} locale={fmtLocale} />
            </Card>

          <!-- MESSAGES / VOICE ───────────────────────────────────── -->
          {:else if section === 'messages' || section === 'voice'}
            {@const isVoice = section === 'voice'}
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card class="p-4"><p class="text-xs text-muted-foreground">{isVoice ? $t('stats.total_hours') : $t('stats.total')}</p><p class="mt-1 text-2xl font-semibold">{isVoice ? fmtHours(result.total) : fmt(result.total)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.unique_members')}</p><p class="mt-1 text-2xl font-semibold">{fmt(result.unique_members)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.unique_channels')}</p><p class="mt-1 text-2xl font-semibold">{fmt(result.unique_channels)}</p></Card>
            </div>
            <Card class="p-4">
              <BarChart
                labels={result.labels ?? []}
                datasets={[{ label: isVoice ? $t('stats.label_hours') : $t('stats.label_messages'), color: isVoice ? COLORS.violet : COLORS.blue, data: result.values ?? [] }]}
                locale={fmtLocale}
              />
            </Card>
            <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card class="p-4">
                <p class="mb-3 text-sm font-semibold">{$t('stats.top_members')}</p>
                {#if (result.top_members ?? []).length}
                  <DonutChart
                    labels={result.top_members.map((m) => m.name)}
                    data={result.top_members.map((m) => m.value)}
                    colors={DONUT}
                    locale={fmtLocale}
                  />
                  <table class="mt-3 w-full text-sm">
                    <tbody>
                      {#each result.top_members as m, i (m.id)}
                        <tr class="border-b border-border/40 last:border-0">
                          <td class="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                          <td class="py-1.5 pr-2 truncate">{m.name}</td>
                          <td class="py-1.5 text-right tabular-nums">{isVoice ? fmtHours(m.value) : fmt(m.value)}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {:else}
                  <p class="text-sm text-muted-foreground">{$t('common.no_data')}</p>
                {/if}
              </Card>
              <Card class="p-4">
                <p class="mb-3 text-sm font-semibold">{$t('stats.top_channels')}</p>
                {#if (result.top_channels ?? []).length}
                  <DonutChart
                    labels={result.top_channels.map((c) => c.name)}
                    data={result.top_channels.map((c) => c.value)}
                    colors={DONUT}
                    locale={fmtLocale}
                  />
                  <table class="mt-3 w-full text-sm">
                    <tbody>
                      {#each result.top_channels as c, i (c.id)}
                        <tr class="border-b border-border/40 last:border-0">
                          <td class="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                          <td class="py-1.5 pr-2 truncate">{c.name}</td>
                          <td class="py-1.5 text-right tabular-nums">{isVoice ? fmtHours(c.value) : fmt(c.value)}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {:else}
                  <p class="text-sm text-muted-foreground">{$t('common.no_data')}</p>
                {/if}
              </Card>
            </div>

          <!-- STATUS ─────────────────────────────────────────────── -->
          {:else if section === 'status'}
            {#if statusCurrent || statusPeakVals}
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Card class="p-4">
                  <p class="text-xs text-muted-foreground">{$t('stats.status_current')} · {$t('stats.now_online')}</p>
                  <p class="mt-1 text-2xl font-semibold text-green-400">{fmt(statusCurrent?.on)}</p>
                </Card>
                <Card class="p-4">
                  <p class="text-xs text-muted-foreground">{$t('stats.status_current')} · {$t('stats.now_idle')}</p>
                  <p class="mt-1 text-2xl font-semibold text-amber-400">{fmt(statusCurrent?.idle)}</p>
                </Card>
                <Card class="p-4">
                  <p class="text-xs text-muted-foreground">{$t('stats.status_current')} · {$t('stats.now_dnd')}</p>
                  <p class="mt-1 text-2xl font-semibold text-red-400">{fmt(statusCurrent?.dnd)}</p>
                </Card>
                <Card class="p-4">
                  <p class="text-xs text-muted-foreground">{$t('stats.status_peak_period')} · {$t('stats.now_online')}</p>
                  <p class="mt-1 text-2xl font-semibold text-green-400">{fmt(statusPeakVals?.on)}</p>
                </Card>
                <Card class="p-4">
                  <p class="text-xs text-muted-foreground">{$t('stats.status_peak_period')} · {$t('stats.now_idle')}</p>
                  <p class="mt-1 text-2xl font-semibold text-amber-400">{fmt(statusPeakVals?.idle)}</p>
                </Card>
                <Card class="p-4">
                  <p class="text-xs text-muted-foreground">{$t('stats.status_peak_period')} · {$t('stats.now_dnd')}</p>
                  <p class="mt-1 text-2xl font-semibold text-red-400">{fmt(statusPeakVals?.dnd)}</p>
                </Card>
              </div>
            {/if}
            <Card class="p-4">
              <div class="mb-3">
                <SeriesToggle
                  series={statusSeries.map((s) => ({ label: s.label, color: s.color, hidden: s.hidden }))}
                  on:toggle={(e) => toggleSeries('status', 3, e.detail)}
                />
              </div>
              {#if statusLabels.length}
                <LineChart labels={statusLabels} datasets={statusSeries} area stacked locale={fmtLocale} />
              {:else}
                <p class="text-sm text-muted-foreground">{$t('stats.no_status_data')}</p>
              {/if}
            </Card>

          <!-- INVITES ────────────────────────────────────────────── -->
          {:else if section === 'invites'}
            <Card class="p-4">
              {#if inviteSeries.length}
                <div class="mb-3">
                  <SeriesToggle
                    series={inviteSeries.map((s) => ({ label: s.label, color: s.color, hidden: s.hidden }))}
                    on:toggle={(e) => toggleSeries('invites', inviteSeries.length, e.detail)}
                  />
                </div>
                <LineChart labels={result.labels ?? []} datasets={inviteSeries} locale={fmtLocale} />
              {:else}
                <p class="text-sm text-muted-foreground">{$t('stats.no_invite_data')}</p>
              {/if}
            </Card>
            <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card class="p-4">
                <p class="mb-3 text-sm font-semibold">{$t('stats.top_invites')}</p>
                {#if (result.top_invites ?? []).length}
                  <DonutChart
                    labels={result.top_invites.map((t) => inviteLabel(t.code))}
                    data={result.top_invites.map((t) => t.count)}
                    colors={DONUT}
                    locale={fmtLocale}
                  />
                  <table class="mt-3 w-full text-sm">
                    <tbody>
                      {#each result.top_invites as t, i (t.code)}
                        <tr class="border-b border-border/40 last:border-0">
                          <td class="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                          <td class="py-1.5 pr-2">
                            {#if result.code_owners?.[t.code]}
                              {result.code_owners[t.code]} <code class="text-muted-foreground">({t.code})</code>
                            {:else}
                              <code>{t.code}</code>
                            {/if}
                          </td>
                          <td class="py-1.5 text-right tabular-nums">{fmt(t.count)}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {:else}
                  <p class="text-sm text-muted-foreground">{$t('common.no_data')}</p>
                {/if}
              </Card>
              <Card class="p-4">
                <p class="mb-3 text-sm font-semibold">{$t('stats.top_members')}</p>
                {#if (result.top_members ?? []).length}
                  <table class="w-full text-sm">
                    <tbody>
                      {#each result.top_members as m, i (m.id)}
                        <tr class="border-b border-border/40 last:border-0">
                          <td class="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                          <td class="py-1.5 pr-2 truncate">{m.name}</td>
                          <td class="py-1.5 text-right tabular-nums">{fmt(m.value)}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {:else}
                  <p class="text-sm text-muted-foreground">{$t('common.no_data')}</p>
                {/if}
              </Card>
            </div>
            <Card class="p-4">
              <p class="mb-3 text-sm font-semibold">{$t('stats.recent_invites')}</p>
              {#if (result.recent_logs ?? []).length}
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-muted-foreground">
                      <th class="py-1.5 pr-2 font-medium">{$t('stats.col_date')}</th>
                      <th class="py-1.5 pr-2 font-medium">{$t('stats.col_member')}</th>
                      <th class="py-1.5 font-medium">{$t('stats.col_code')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each result.recent_logs as log, i (log.user_id + '-' + i)}
                      <tr class="border-b border-border/40 last:border-0">
                        <td class="py-1.5 pr-2 text-muted-foreground">{readableDate(log.date)}</td>
                        <td class="py-1.5 pr-2 truncate">{log.username}</td>
                        <td class="py-1.5"><code>{log.code}</code></td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {:else}
                <p class="text-sm text-muted-foreground">{$t('common.no_entries')}</p>
              {/if}
            </Card>

          <!-- ACTIVITY ───────────────────────────────────────────── -->
          {:else if section === 'activity'}
            <Card class="p-4">
              <p class="mb-3 text-sm font-semibold">{$t('stats.top_games')}</p>
              {#if (result.top_games ?? []).length}
                <BarChart
                  labels={result.top_games.map((g) => g.name)}
                  datasets={[{ label: $t('stats.label_hours'), color: COLORS.violet, data: result.top_games.map((g) => Math.round((g.minutes / 60) * 10) / 10) }]}
                  horizontal
                  locale={fmtLocale}
                />
                <table class="mt-3 w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-muted-foreground">
                      <th class="py-1.5 pr-2 font-medium">#</th>
                      <th class="py-1.5 pr-2 font-medium">{$t('stats.col_game')}</th>
                      <th class="py-1.5 text-right font-medium">{$t('stats.col_minutes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each result.top_games as g, i (g.name)}
                      <tr class="border-b border-border/40 last:border-0">
                        <td class="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                        <td class="py-1.5 pr-2 truncate">{g.name}</td>
                        <td class="py-1.5 text-right tabular-nums">{fmt(g.minutes)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {:else}
                <p class="text-sm text-muted-foreground">{$t('stats.no_activity_data')}</p>
              {/if}
            </Card>
            {#if result.kinds}
              {@const kindDefs = [
                { key: 'streaming', tkey: 'stats.kind_streaming' },
                { key: 'listening', tkey: 'stats.kind_listening' },
                { key: 'watching', tkey: 'stats.kind_watching' }
              ]}
              {@const activeKinds = kindDefs.filter((k) => (result.kinds[k.key] ?? []).length)}
              {#if activeKinds.length}
                <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  {#each activeKinds as kind (kind.key)}
                    <Card class="p-4">
                      <p class="mb-3 text-sm font-semibold">{$t(kind.tkey)}</p>
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="text-left text-xs text-muted-foreground">
                            <th class="py-1.5 pr-2 font-medium">{$t('stats.col_name')}</th>
                            <th class="py-1.5 text-right font-medium">{$t('stats.col_minutes')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each result.kinds[kind.key] ?? [] as e, i (e.name + '-' + i)}
                            <tr class="border-b border-border/40 last:border-0">
                              <td class="py-1.5 pr-2 truncate">{e.name}</td>
                              <td class="py-1.5 text-right tabular-nums">{fmt(e.minutes)}</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </Card>
                  {/each}
                </div>
              {/if}
            {/if}

          <!-- COMMANDS ───────────────────────────────────────────── -->
          {:else if section === 'commands'}
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Card class="p-4"><p class="text-xs uppercase tracking-wide text-muted-foreground">{$t('stats.total')}</p><p class="mt-1.5 text-2xl font-semibold">{result.total ?? 0}</p></Card>
              <Card class="p-4"><p class="text-xs uppercase tracking-wide text-muted-foreground">{$t('stats.unique_commands')}</p><p class="mt-1.5 text-2xl font-semibold">{result.unique_commands ?? 0}</p></Card>
              <Card class="p-4"><p class="text-xs uppercase tracking-wide text-muted-foreground">{$t('stats.errors')}</p><p class="mt-1.5 text-2xl font-semibold">{result.total_errors ?? 0}</p></Card>
            </div>
            <Card class="p-4">
              <p class="mb-3 text-sm font-semibold">{$t('stats.menu_commands')}</p>
              {#if (result.values ?? []).some((v) => v > 0)}
                <BarChart labels={result.labels} datasets={[{ label: $t('stats.menu_commands'), color: COLORS.blue, data: result.values }]} locale={fmtLocale} />
              {/if}
              {#if (result.top_commands ?? []).length}
                <table class="mt-3 w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-muted-foreground">
                      <th class="py-1.5 pr-2 font-medium">#</th>
                      <th class="py-1.5 pr-2 font-medium">{$t('stats.col_command')}</th>
                      <th class="py-1.5 text-right font-medium">{$t('stats.total')}</th>
                      <th class="py-1.5 text-right font-medium">{$t('stats.errors')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each result.top_commands as c, i (c.name)}
                      <tr class="border-b border-border/40 last:border-0">
                        <td class="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                        <td class="py-1.5 pr-2"><code class="text-primary">{c.name}</code></td>
                        <td class="py-1.5 text-right tabular-nums">{c.count}</td>
                        <td class="py-1.5 text-right tabular-nums {c.errors ? 'text-destructive' : 'text-muted-foreground'}">{c.errors}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {:else}
                <p class="text-sm text-muted-foreground">{$t('stats.no_command_data')}</p>
              {/if}
            </Card>

          <!-- MEMBER DRILLDOWN ───────────────────────────────────── -->
          {:else if section === 'member_drilldown'}
            <Card class="p-4">
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <label class="text-sm text-muted-foreground" for="member-sel">{$t('stats.member')}</label>
                <select
                  id="member-sel"
                  bind:value={memberId}
                  class="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {#each result.options ?? [] as o (o.id)}
                    <option value={o.id}>{o.name}</option>
                  {/each}
                </select>
                {#if result.name}<span class="text-sm font-medium">{result.name}</span>{/if}
              </div>
              {#if result.meta || result.rank_messages || result.total_messages != null}
                {@const meta = result.meta ?? {}}
                <div class="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border/40 bg-secondary/20 p-3">
                  {#if meta.avatar}
                    <img src={meta.avatar} alt={result.name ?? ''} class="h-12 w-12 rounded-full" />
                  {/if}
                  <div class="space-y-0.5 text-xs text-muted-foreground">
                    {#if result.name}<p class="text-sm font-semibold text-foreground">{result.name}</p>{/if}
                    {#if result.rank_messages}<p>{$t('stats.rank_messages_line', { rank: result.rank_messages.rank, of: result.rank_messages.of })}</p>{/if}
                    {#if result.rank_voice}<p>{$t('stats.rank_voice_line', { rank: result.rank_voice.rank, of: result.rank_voice.of })}</p>{/if}
                  </div>
                  <div class="space-y-0.5 text-xs text-muted-foreground">
                    <p>{$t('stats.profile_total_messages')}: <span class="tabular-nums text-foreground">{fmt(result.total_messages)}</span></p>
                    <p>{$t('stats.profile_total_voice')}: <span class="tabular-nums text-foreground">{fmtHours(result.total_voice_hours)}</span></p>
                    {#if meta.joined_at}<p>{$t('stats.profile_joined')}: <span class="text-foreground">{readableDate(meta.joined_at)}</span></p>{/if}
                  </div>
                  <div class="space-y-0.5 text-xs text-muted-foreground">
                    {#if meta.top_role}<p>{$t('stats.profile_top_role')}: <span class="text-foreground">{meta.top_role}</span></p>{/if}
                    {#if meta.roles != null}<p>{$t('stats.profile_roles')}: <span class="text-foreground">{fmt(Array.isArray(meta.roles) ? meta.roles.length : meta.roles)}</span></p>{/if}
                    {#if meta.status}<p>{$t('stats.profile_status')}: <span class="text-foreground">{meta.status}</span></p>{/if}
                  </div>
                </div>
              {/if}
              <LineChart
                labels={result.labels ?? []}
                datasets={[
                  { label: $t('stats.label_messages'), color: COLORS.blue, data: result.messages ?? [] },
                  { label: $t('stats.voice_hours'), color: COLORS.violet, data: result.voice_hours ?? [] }
                ]}
                locale={fmtLocale}
              />
            </Card>

          <!-- CHANNEL DRILLDOWN ──────────────────────────────────── -->
          {:else if section === 'channel_drilldown'}
            <Card class="p-4">
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <label class="text-sm text-muted-foreground" for="channel-sel">{$t('stats.channel')}</label>
                <select
                  id="channel-sel"
                  bind:value={channelId}
                  class="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {#each result.options ?? [] as o (o.id)}
                    <option value={o.id}>{o.name}</option>
                  {/each}
                </select>
                {#if result.name}<span class="text-sm font-medium">{result.name}</span>{/if}
              </div>
              {#if result.rank_messages || result.total_messages != null}
                <div class="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-md border border-border/40 bg-secondary/20 p-3 text-xs text-muted-foreground">
                  {#if result.rank_messages}<p>{$t('stats.rank_messages_line', { rank: result.rank_messages.rank, of: result.rank_messages.of })}{#if result.rank_messages.share != null} · {$t('stats.share')}: <span class="text-foreground">{fmtHours(result.rank_messages.share * 100)}%</span>{/if}</p>{/if}
                  <p>{$t('stats.profile_total_messages')}: <span class="tabular-nums text-foreground">{fmt(result.total_messages)}</span></p>
                  <p>{$t('stats.profile_total_voice')}: <span class="tabular-nums text-foreground">{fmtHours(result.total_voice_hours)}</span></p>
                </div>
              {/if}
              <LineChart
                labels={result.labels ?? []}
                datasets={[
                  { label: $t('stats.label_messages'), color: COLORS.blue, data: result.messages ?? [] },
                  { label: $t('stats.voice_hours'), color: COLORS.violet, data: result.voice_hours ?? [] }
                ]}
                locale={fmtLocale}
              />
            </Card>

          <!-- NOW / LIVE ─────────────────────────────────────────── -->
          {:else if section === 'now'}
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.now_online')}</p><p class="mt-1 text-2xl font-semibold text-green-400">{fmt(result.online)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.now_idle')}</p><p class="mt-1 text-2xl font-semibold text-amber-400">{fmt(result.idle)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.now_dnd')}</p><p class="mt-1 text-2xl font-semibold text-red-400">{fmt(result.dnd)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.now_offline')}</p><p class="mt-1 text-2xl font-semibold text-muted-foreground">{fmt(result.offline)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.now_voice_count')}</p><p class="mt-1 text-2xl font-semibold text-violet-400">{fmt(result.voice_count)}</p></Card>
            </div>
            <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card class="p-4">
                <p class="mb-3 text-sm font-semibold">{$t('stats.now_in_voice')}</p>
                {#if (result.in_voice ?? []).length}
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-xs text-muted-foreground">
                        <th class="py-1.5 pr-2 font-medium">{$t('stats.col_name')}</th>
                        <th class="py-1.5 font-medium">{$t('stats.col_channel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each result.in_voice as v, i (v.name + '-' + i)}
                        <tr class="border-b border-border/40 last:border-0">
                          <td class="py-1.5 pr-2 truncate">{v.name}</td>
                          <td class="py-1.5 truncate text-muted-foreground">{v.channel}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {:else}
                  <p class="text-sm text-muted-foreground">{$t('stats.now_nobody_voice')}</p>
                {/if}
              </Card>
              <Card class="p-4">
                <p class="mb-3 text-sm font-semibold">{$t('stats.now_playing')}</p>
                {#if (result.playing ?? []).length}
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-xs text-muted-foreground">
                        <th class="py-1.5 pr-2 font-medium">{$t('stats.col_game')}</th>
                        <th class="py-1.5 text-right font-medium">{$t('stats.col_count')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each result.playing as p, i (p.name + '-' + i)}
                        <tr class="border-b border-border/40 last:border-0">
                          <td class="py-1.5 pr-2 truncate">{p.name}</td>
                          <td class="py-1.5 text-right tabular-nums">{fmt(p.count)}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {:else}
                  <p class="text-sm text-muted-foreground">{$t('common.no_data')}</p>
                {/if}
              </Card>
            </div>

          <!-- HEATMAP ────────────────────────────────────────────── -->
          {:else if section === 'heatmap'}
            <Card class="p-4">
              <div class="mb-3 flex flex-wrap items-center gap-2">
                <div class="inline-flex overflow-hidden rounded-md border border-input text-sm">
                  <button
                    type="button"
                    on:click={() => (heatmapMetric = 'messages')}
                    class="px-3 py-1.5 {heatmapMetric === 'messages' ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}"
                  >
                    {$t('stats.metric_messages')}
                  </button>
                  <button
                    type="button"
                    on:click={() => (heatmapMetric = 'voice')}
                    class="px-3 py-1.5 {heatmapMetric === 'voice' ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}"
                  >
                    {$t('stats.metric_voice')}
                  </button>
                </div>
                <span class="text-xs text-muted-foreground">{$t('stats.heatmap_utc_hint')}</span>
              </div>
              <Heatmap
                grid={result.grid ?? []}
                peak={result.peak ?? 0}
                metric={result.metric ?? heatmapMetric}
                unit={(result.metric ?? heatmapMetric) === 'voice' ? $t('stats.label_hours') : $t('stats.label_messages')}
              />
            </Card>

          <!-- PEAKS ──────────────────────────────────────────────── -->
          {:else if section === 'peaks'}
            <div class="grid grid-cols-2 gap-3">
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.peak_online')}</p><p class="mt-1 text-2xl font-semibold text-green-400">{fmt(result.peak_online)}</p></Card>
              <Card class="p-4"><p class="text-xs text-muted-foreground">{$t('stats.peak_voice')}</p><p class="mt-1 text-2xl font-semibold text-violet-400">{fmt(result.peak_voice)}</p></Card>
            </div>
            <Card class="p-4">
              <div class="mb-3">
                <SeriesToggle
                  series={peakSeries.map((s) => ({ label: s.label, color: s.color, hidden: s.hidden }))}
                  on:toggle={(e) => toggleSeries('peaks', 2, e.detail)}
                />
              </div>
              <LineChart labels={result.labels ?? []} datasets={peakSeries} locale={fmtLocale} />
            </Card>

          <!-- LEADERBOARD ────────────────────────────────────────── -->
          {:else if section === 'leaderboard'}
            <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {#each [{ key: 'messages', tkey: 'stats.lb_messages', voice: false }, { key: 'voice', tkey: 'stats.lb_voice', voice: true }] as board (board.key)}
                {@const rows = result[board.key] ?? []}
                {@const totalPages = Math.max(1, Math.ceil(rows.length / LEADERBOARD_PAGE_SIZE))}
                {@const curPage = Math.min(lbPage[board.key], totalPages)}
                {@const paged = rows.slice((curPage - 1) * LEADERBOARD_PAGE_SIZE, curPage * LEADERBOARD_PAGE_SIZE)}
                <Card class="p-4">
                  <p class="mb-3 text-sm font-semibold">{$t(board.tkey)}</p>
                  {#if rows.length}
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="text-left text-xs text-muted-foreground">
                          <th class="py-1.5 pr-2 font-medium">{$t('stats.col_rank')}</th>
                          <th class="py-1.5 pr-2 font-medium">{$t('stats.col_name')}</th>
                          <th class="py-1.5 text-right font-medium">{$t('stats.col_value')}</th>
                          <th class="py-1.5 text-right font-medium">{$t('stats.col_change')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each paged as row (row.id)}
                          <tr class="border-b border-border/40 last:border-0">
                            <td class="py-1.5 pr-2 text-muted-foreground">{row.rank}</td>
                            <td class="py-1.5 pr-2 truncate">{row.name}</td>
                            <td class="py-1.5 text-right tabular-nums">{board.voice ? fmtHours(row.value) : fmt(row.value)}</td>
                            <td class="py-1.5 text-right tabular-nums">
                              {#if row.change == null}
                                <span class="text-muted-foreground">{$t('stats.lb_new')}</span>
                              {:else if row.change > 0}
                                <span class="text-green-400">▲{row.change}</span>
                              {:else if row.change < 0}
                                <span class="text-red-400">▼{Math.abs(row.change)}</span>
                              {:else}
                                <span class="text-muted-foreground">–</span>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                    {#if totalPages > 1}
                      <div class="mt-3 flex items-center justify-end gap-3 text-sm">
                        <button
                          type="button"
                          class="rounded-md border border-border px-2.5 py-1 hover:bg-secondary disabled:opacity-40"
                          disabled={curPage <= 1}
                          aria-label={$t('audit.prev')}
                          on:click={() => (lbPage = { ...lbPage, [board.key]: Math.max(1, curPage - 1) })}>‹</button>
                        <span class="whitespace-nowrap text-muted-foreground">{$t('audit.page_of', { page: curPage, total: totalPages })}</span>
                        <button
                          type="button"
                          class="rounded-md border border-border px-2.5 py-1 hover:bg-secondary disabled:opacity-40"
                          disabled={curPage >= totalPages}
                          aria-label={$t('audit.next')}
                          on:click={() => (lbPage = { ...lbPage, [board.key]: Math.min(totalPages, curPage + 1) })}>›</button>
                      </div>
                    {/if}
                  {:else}
                    <p class="text-sm text-muted-foreground">{$t('common.no_data')}</p>
                  {/if}
                </Card>
              {/each}
            </div>

          <!-- RETENTION ──────────────────────────────────────────── -->
          {:else if section === 'retention'}
            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {#each [{ key: 'd7', tkey: 'stats.retention_7d' }, { key: 'd30', tkey: 'stats.retention_30d' }] as r (r.key)}
                {@const d = result[r.key] ?? {}}
                <Card class="p-4">
                  <p class="text-xs text-muted-foreground">{$t(r.tkey)}</p>
                  <p class="mt-1 text-3xl font-semibold">{fmtHours(retentionPct(d.rate))}%</p>
                  <p class="mt-1 text-sm text-muted-foreground">{$t('stats.retention_stayed', { stayed: d.stayed ?? 0, joined: d.joined ?? 0 })}</p>
                  <div class="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                    <div class="h-full rounded-full bg-primary" style="width: {Math.max(0, Math.min(100, retentionPct(d.rate)))}%;"></div>
                  </div>
                </Card>
              {/each}
            </div>
            {#if result.note}
              <p class="text-xs text-muted-foreground">{result.note}</p>
            {/if}
          {/if}

        {:else}
          <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('common.no_data')}</p></Card>
        {/if}
      </div>
    </div>
  {/if}
</div>
