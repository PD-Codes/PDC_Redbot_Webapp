<script lang="ts">
  export let grid: number[][] = [];
  export let peak = 0;
  export let metric = 'messages';
  export let unit = ''; // z. B. "Nachrichten" oder "Std" – vom Aufrufer übergeben.

  // Kurze + volle Wochentags-Labels, Zeile 0 = Montag .. 6 = Sonntag.
  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const weekdaysFull = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const hours = Array.from({ length: 24 }, (_, h) => h);

  function alpha(v: number): number {
    if (!peak) return 0.05;
    return 0.08 + 0.92 * (v / peak);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  function fmtVal(v: number): string {
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
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
