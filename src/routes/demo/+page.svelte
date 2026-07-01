<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';

  // Statische Beispieldaten – kein Gateway, kein Login nötig.
  const bot = { name: 'PDC-Bot', guild_count: 7, latency_ms: 42 };

  const kpis = [
    { label: 'Mitglieder', value: '1.284', trend: '+12', intent: 'positive', span: 'md:col-span-1' },
    { label: 'Aktive Events', value: 6, span: 'md:col-span-1' },
    { label: 'ReactionRoles', value: 18, span: 'md:col-span-1' }
  ];

  const status = { state: 'ok', label: 'WarcraftLogs API', detail: 'Token gültig' };

  const list = {
    title: 'Letzte Beitritte',
    items: [
      { label: 'Thrall', value: 'vor 2 Min' },
      { label: 'Jaina', value: 'vor 18 Min' },
      { label: 'Sylvanas', value: 'vor 1 Std' }
    ]
  };

  // Mini-Bar-Chart (inline SVG, keine Library nötig)
  const chart = { title: 'Nachrichten / Tag', bars: [12, 19, 8, 22, 17, 25, 14] };
  const maxBar = Math.max(...chart.bars);

  // Demo-Panel (Formular, nicht funktional)
  let enabled = true;
  let message = 'Willkommen auf dem Server, {member}! 🎉';
</script>

<div class="space-y-6">
  <div class="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
    <b>Demo-Ansicht.</b> Alle Werte sind Beispieldaten – hier siehst du nur, wie das Dashboard
    aussieht. Das echte Board findest du nach dem Login unter „Übersicht".
  </div>

  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Übersicht</h1>
    <select class="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
      <option>Meine WoW-Gilde</option>
      <option>Test-Server</option>
    </select>
  </div>

  <!-- Bot-Infozeile -->
  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    <Card class="p-4"><p class="text-xs text-muted-foreground">Bot</p><p class="text-lg font-semibold">{bot.name}</p></Card>
    <Card class="p-4"><p class="text-xs text-muted-foreground">Server</p><p class="text-lg font-semibold">{bot.guild_count}</p></Card>
    <Card class="p-4"><p class="text-xs text-muted-foreground">Latenz</p><p class="text-lg font-semibold">{bot.latency_ms} ms</p></Card>
    <Card class="p-4"><p class="text-xs text-muted-foreground">Owner</p><p class="text-lg font-semibold">✓</p></Card>
  </div>

  <!-- Widget-Board -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    {#each kpis as k}
      <Card class={`p-4 ${k.span}`}>
        <p class="mb-2 text-sm font-medium text-muted-foreground">{k.label}</p>
        <div class="flex items-end gap-2">
          <span class="text-3xl font-semibold">{k.value}</span>
          {#if k.trend}<span class="text-xs text-emerald-500">{k.trend}</span>{/if}
        </div>
      </Card>
    {/each}

    <!-- Status-Widget -->
    <Card class="p-4">
      <p class="mb-2 text-sm font-medium text-muted-foreground">Status</p>
      <div class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
        <span class="text-sm">{status.label}</span>
      </div>
      <p class="mt-1 text-xs text-muted-foreground">{status.detail}</p>
    </Card>

    <!-- Listen-Widget -->
    <Card class="p-4">
      <p class="mb-2 text-sm font-medium text-muted-foreground">{list.title}</p>
      <ul class="space-y-1 text-sm">
        {#each list.items as item}
          <li class="flex justify-between border-b border-border/50 py-1">
            <span>{item.label}</span><span class="text-muted-foreground">{item.value}</span>
          </li>
        {/each}
      </ul>
    </Card>

    <!-- Chart-Widget -->
    <Card class="p-4">
      <p class="mb-2 text-sm font-medium text-muted-foreground">{chart.title}</p>
      <svg viewBox="0 0 140 60" class="h-20 w-full">
        {#each chart.bars as b, i}
          <rect
            x={i * 20 + 4}
            y={60 - (b / maxBar) * 52}
            width="12"
            height={(b / maxBar) * 52}
            rx="2"
            class="fill-primary"
          />
        {/each}
      </svg>
    </Card>
  </div>

  <!-- Kontextuelles Panel -->
  <h2 class="pt-2 text-lg font-semibold">Einstellungen</h2>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Card class="p-5">
      <h3 class="mb-1 text-base font-semibold">Willkommensnachricht</h3>
      <p class="mb-4 text-sm text-muted-foreground">Begrüßung für neue Mitglieder (Demo).</p>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium" for="demo-enabled">Aktiviert</label>
          <input id="demo-enabled" type="checkbox" bind:checked={enabled} class="chb-main" />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium" for="demo-msg">Nachricht</label>
          <textarea id="demo-msg" bind:value={message} rows="3"
            class="w-full rounded-md border border-input bg-background p-2 text-sm"></textarea>
        </div>
        <button type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-90">
          Speichern
        </button>
      </div>
    </Card>

    <Card class="p-5">
      <h3 class="mb-1 text-base font-semibold">Auto-Reply</h3>
      <p class="mb-4 text-sm text-muted-foreground">WoWTools Auto-Antworten (Demo).</p>
      <div class="flex items-center justify-between">
        <span class="text-sm">Aktiv</span>
        <span class="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-400">An</span>
      </div>
    </Card>
  </div>
</div>
