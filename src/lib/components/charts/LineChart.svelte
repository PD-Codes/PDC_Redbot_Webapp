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
  export let area: boolean = false;

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  const muted = 'rgba(148, 163, 184, 0.7)';
  const grid = 'rgba(148, 163, 184, 0.12)';

  function hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function buildConfig(): ChartConfiguration {
    return {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((d) => ({
          label: d.label,
          data: d.data,
          borderColor: d.color,
          backgroundColor: area || d.fill ? hexToRgba(d.color, 0.18) : d.color,
          fill: area || !!d.fill,
          hidden: !!d.hidden,
          tension: 0.3,
          spanGaps: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
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
            ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
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

  // Rebuild on any prop change (avoid stale state).
  // Reference every prop so Svelte tracks them all as dependencies.
  // In-place aktualisieren statt zerstören/neu erstellen (deutlich performanter, kein
  // Flackern/Neu-Animieren bei jedem Prop-Wechsel wie z. B. Serien-Toggle).
  function rebuild(_l: unknown, _d: unknown, _s: unknown, _a: unknown) {
    if (!chart) return;
    const cfg = buildConfig();
    chart.data = cfg.data;
    if (cfg.options) chart.options = cfg.options;
    chart.update();
  }
  $: rebuild(labels, datasets, stacked, area);
</script>

<div class="relative h-[320px] w-full">
  <canvas bind:this={canvas}></canvas>
</div>
