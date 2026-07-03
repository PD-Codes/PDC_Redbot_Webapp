<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables, type ChartConfiguration } from 'chart.js';
  Chart.register(...registerables);

  export let labels: string[] = [];
  export let data: number[] = [];
  export let locale: string = 'en-US'; // controls tick/tooltip separators (thousands/decimal)
  export let colors: string[] = [
    '#22c55e',
    '#3b82f6',
    '#ef4444',
    '#f59e0b',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#84cc16',
    '#f97316',
    '#14b8a6'
  ];

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  const muted = 'rgba(148, 163, 184, 0.85)';

  function buildConfig(): ChartConfiguration {
    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: labels.map((_, i) => colors[i % colors.length]),
            borderColor: 'rgba(15, 23, 42, 0.6)',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        locale,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: muted, boxWidth: 12, padding: 10, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw) || 0;
                const total = (ctx.dataset.data as number[]).reduce(
                  (a, b) => a + (Number(b) || 0),
                  0
                );
                const pct = total > 0 ? (value / total) * 100 : 0;
                const valueStr = new Intl.NumberFormat(locale).format(value);
                const pctStr = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(pct);
                return ` ${ctx.label}: ${valueStr} (${pctStr}%)`;
              }
            }
          }
        }
      }
    };
  }

  onMount(() => {
    chart = new Chart(canvas, buildConfig());
  });

  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });

  function rebuild(_l: unknown, _d: unknown, _c: unknown, _loc: unknown) {
    if (!chart) return;
    const cfg = buildConfig();
    chart.data = cfg.data;
    if (cfg.options) chart.options = cfg.options;
    chart.update();
  }
  $: rebuild(labels, data, colors, locale);
</script>

<div class="relative h-[240px] w-full">
  <canvas bind:this={canvas}></canvas>
</div>
