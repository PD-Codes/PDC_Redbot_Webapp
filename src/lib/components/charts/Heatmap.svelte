<script lang="ts">
  import { locale } from '$lib/i18n';

  export let grid: number[][] = [];
  export let peak = 0;
  export let metric = 'messages';
  export let unit = ''; // e.g. "Messages" or "Hours" – provided by the caller.

  // Weekday labels (row 0 = Monday .. 6 = Sunday), localized to the UI language
  // (en-US default). 2024-01-01 is a Monday, used as a stable reference week.
  function weekdayNames(loc: string, style: 'short' | 'long'): string[] {
    try {
      const fmt = new Intl.DateTimeFormat(loc, { weekday: style, timeZone: 'UTC' });
      return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
    } catch {
      const en = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return en;
    }
  }
  $: weekdays = weekdayNames($locale, 'short');
  $: weekdaysFull = weekdayNames($locale, 'long');
  const hours = Array.from({ length: 24 }, (_, h) => h);

  function alpha(v: number): number {
    if (!peak) return 0.05;
    return 0.08 + 0.92 * (v / peak);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  function fmtVal(v: number): string {
    const rounded = Number.isInteger(v) ? v : Math.round(v * 100) / 100;
    return new Intl.NumberFormat($locale, { maximumFractionDigits: 2 }).format(rounded);
  }

  // Cursor-folgendes Tooltip.
  let tip: string | null = null;
  let tx = 0;
  let ty = 0;
  function show(e: MouseEvent, d: number, h: number, v: number) {
    tip = `${weekdaysFull[d]} ${pad(h)}:00–${pad((h + 1) % 24)}:00 · ${fmtVal(v)}${unit ? ' ' + unit : ''}`;
    tx = e.clientX;
    ty = e.clientY;
  }
  function move(e: MouseEvent) {
    tx = e.clientX;
    ty = e.clientY;
  }
  function hide() {
    tip = null;
  }
</script>

<div class="overflow-x-auto">
  <table class="border-separate" style="border-spacing: 2px;">
    <thead>
      <tr>
        <th class="w-8"></th>
        {#each hours as h (h)}
          <th class="h-4 w-5 text-center text-[10px] font-normal text-muted-foreground">
            {h % 2 === 0 ? h : ''}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each grid ?? [] as row, d (d)}
        <tr>
          <td class="pr-1 text-right text-[11px] text-muted-foreground">{weekdays[d] ?? ''}</td>
          {#each row ?? [] as v, h (h)}
            <td
              class="h-5 w-5 cursor-default rounded-sm transition-[outline] hover:outline hover:outline-1 hover:outline-primary"
              style="background: rgba(139,92,246,{alpha(v)});"
              title={`${weekdaysFull[d] ?? ''} ${pad(h)}:00 · ${fmtVal(v)}${unit ? ' ' + unit : ''}`}
              on:mouseenter={(e) => show(e, d, h, v)}
              on:mousemove={move}
              on:mouseleave={hide}
            ></td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if tip}
  <div
    class="pointer-events-none fixed z-50 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs shadow-lg"
    style="left: {tx + 14}px; top: {ty + 14}px;"
  >
    {tip}
  </div>
{/if}
