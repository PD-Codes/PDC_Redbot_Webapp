<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables, type ChartConfiguration } from 'chart.js';
  Chart.register(...registerables);

  export let labels: string[] = [];
  export let datasets: Array<{
    label: string;
    data: (number | null)[];
    color: string;
    fill?: boolean;
    hidden?: boolean;
  }> = [];
  export let stacked: boolean = false;
  export let horizontal: boolean = false;

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  const muted = 'rgba(148, 163, 184, 0.7)';
  const grid = 'rgba(148, 163, 184, 0.12)';

  function buildConfig(): ChartConfiguration {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: datasets.map((d) => ({
          label: d.label,
          data: d.data,
          backgroundColor: d.color,
          borderColor: d.color,
          borderWidth: 0,
          borderRadius: 4,
          hidden: !!d.hidden,
          maxBarThickness: 48
        }))
      },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, labels: { color: muted } },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: grid,
            borderWidth: 1
          }
        },
        scales: {
          x: {
            stacked,
            grid: { color: grid },
            ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 14 }
          },
          y: {
            stacked,
            beginAtZero: true,
            grid: { color: grid },
            ticks: { color: muted }
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

  function rebuild(_l: unknown, _d: unknown, _s: unknown, _h: unknown) {
    if (!chart) return;
    const cfg = buildConfig();
    chart.data = cfg.data;
    if (cfg.options) chart.options = cfg.options;
    chart.update();
  }
  $: rebuild(labels, datasets, stacked, horizontal);
</script>

<div class="relative h-[320px] w-full">
  <canvas bind:this={canvas}></canvas>
</div>
