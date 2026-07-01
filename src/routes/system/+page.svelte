<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { invalidateAll } from '$app/navigation';
  import { t } from '$lib/i18n';
  import type { SystemInfo } from './+page.server';

  export let data: {
    isOwner: boolean;
    info: SystemInfo | null;
    online: boolean;
    version: string;
    legacyInstall: boolean;
    serviceName: string;
    runUser: string;
  };

  let refreshing = false;

  // Update-Check (nur Pruefung, ohne Self-Update auszufuehren).
  let checking = false;
  let checkDone = false;
  let checkAvailable = false;
  let checkLatest = '';
  let checkError = '';

  async function checkUpdate() {
    checking = true;
    checkDone = false;
    checkError = '';
    try {
      const r = await fetch('/api/update/check', { cache: 'no-store' });
      const j = await r.json();
      if (j.error && !('available' in j)) {
        checkError = j.error;
      } else {
        checkAvailable = !!j.available;
        checkLatest = j.latest ?? '';
        if (j.error) checkError = j.error;
        checkDone = true;
      }
    } catch (e) {
      checkError = e instanceof Error ? e.message : 'Fehler';
    } finally {
      checking = false;
    }
  }

  // Update-Status
  let showConfirm = false;
  let updating = false;
  let updateLog = '';
  let updatePhase: '' | 'building' | 'restarting' | 'done' | 'error' = '';
  let updateError = '';
  let bootBefore: string | null = null; // Boot-ID des Servers VOR dem Neustart
  let restartManual = false; // Build ok, aber Dienst-Neustart muss manuell erfolgen.

  // Letzte aussagekraeftige Fehlerzeile aus dem Log ziehen.
  function extractError(log: string): string {
    const lines = log.split('\n').map((l) => l.trim()).filter(Boolean);
    const hit = [...lines].reverse().find((l) =>
      /error|fatal|fehlgeschlagen|denied|cannot|not found|abort/i.test(l)
    );
    return hit ?? $t('system.update_failed');
  }

  function askUpdate() {
    showConfirm = true;
  }

  async function startUpdate() {
    showConfirm = false;
    updating = true;
    updateLog = '';
    updateError = '';
    restartManual = false;
    bootBefore = null;
    updatePhase = 'building';
    try {
      const res = await fetch('/api/update', { method: 'POST' });
      const j = await res.json();
      if (j.error) {
        updatePhase = 'error';
        updateError = j.error;
        updating = false;
        return;
      }
    } catch (e) {
      updatePhase = 'error';
      updateError = e instanceof Error ? e.message : 'Fehler';
      updating = false;
      return;
    }
    await pollLog();
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function pollLog() {
    // Phase 1: Build läuft – Log streamen (max ~6 Min).
    for (let i = 0; i < 180 && updatePhase === 'building'; i++) {
      await sleep(2000);
      try {
        const r = await fetch('/api/update', { cache: 'no-store' });
        const j = await r.json();
        if (j.error) {
          updatePhase = 'error';
          updateError = j.error;
          updating = false;
          return;
        }
        updateLog = j.log ?? '';
        // Boot-ID des laufenden (noch alten) Servers merken – Referenz für den Neustart.
        if (bootBefore === null && j.boot) bootBefore = j.boot;
        // Build/Script abgebrochen → Fehler aus dem Log anzeigen, kein Timeout.
        if (j.failed) {
          updatePhase = 'error';
          updateError = extractError(updateLog);
          updating = false;
          return;
        }
        if (j.done) {
          // Build ok, aber Dienst konnte sich nicht selbst neu starten.
          if (j.restartSkipped) {
            updatePhase = 'done';
            restartManual = true;
            updating = false;
            return;
          }
          updatePhase = 'restarting';
        }
      } catch {
        // Verbindung weg → Dienst startet bereits neu.
        updatePhase = 'restarting';
      }
    }
    // Phase 2: auf Neustart warten und DANACH die Seite neu laden.
    // Primärsignal: die Boot-ID ändert sich (neuer Prozess). Das ist zuverlässig,
    // auch wenn der Neustart so schnell ist, dass das "Server weg"-Fenster verpasst wird.
    // Fallback: Server war weg und ist wieder da.
    let wasDown = false;
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      try {
        const r = await fetch('/api/update', { cache: 'no-store' });
        if (r.ok) {
          let booted = false;
          try {
            const j = await r.json();
            booted = !!(j.boot && bootBefore && j.boot !== bootBefore);
          } catch {
            /* ignore */
          }
          if (booted || wasDown) {
            updatePhase = 'done';
            updating = false;
            await sleep(800);
            location.reload();
            return;
          }
        }
      } catch {
        wasDown = true;
      }
    }
    // Sicherheitsnetz: Neustart nicht eindeutig erkannt → trotzdem einmal neu laden.
    updatePhase = 'done';
    updating = false;
    location.reload();
  }

  function uptime(s: number | null): string {
    if (s == null) return '—';
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  async function refresh() {
    refreshing = true;
    try {
      await invalidateAll();
    } finally {
      refreshing = false;
    }
  }

  $: kpis = data.info
    ? [
        { label: $t('system.uptime'), value: uptime(data.info.uptime_s) },
        { label: $t('system.latency'), value: data.info.latency_ms != null ? `${data.info.latency_ms} ms` : '—' },
        { label: $t('system.guilds'), value: String(data.info.guild_count) },
        { label: $t('system.users'), value: data.info.user_count.toLocaleString() },
        { label: $t('system.memory'), value: data.info.memory_mb != null ? `${data.info.memory_mb} MB` : '—' },
        { label: $t('system.cogs'), value: `${data.info.cogs_loaded}/${data.info.cogs_available}` }
      ]
    : [];
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-semibold">{$t('system.title')}</h1>
    {#if data.isOwner}
      <button
        type="button"
        class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
        disabled={refreshing}
        on:click={refresh}>{refreshing ? '…' : '↻ ' + $t('common.refresh')}</button>
    {/if}
  </div>

  {#if !data.isOwner}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('system.owner_only')}</p></Card>
  {:else if !data.online || !data.info}
    <Card class="border-destructive/50 p-4"><p class="text-sm text-destructive">{$t('system.offline')}</p></Card>
  {:else}
    <!-- Kennzahlen -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {#each kpis as k (k.label)}
        <Card class="p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
          <p class="mt-1.5 text-xl font-semibold">{k.value}</p>
        </Card>
      {/each}
    </div>

    <!-- Versionen / Gateway -->
    <Card class="p-5">
      <h2 class="mb-3 text-base font-semibold">{$t('system.versions')}</h2>
      <div class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div class="flex justify-between border-b border-border/50 py-1"><span class="text-muted-foreground">Red-DiscordBot</span><code>{data.info.red ?? '—'}</code></div>
        <div class="flex justify-between border-b border-border/50 py-1"><span class="text-muted-foreground">discord.py</span><code>{data.info.discord ?? '—'}</code></div>
        <div class="flex justify-between border-b border-border/50 py-1"><span class="text-muted-foreground">Python</span><code>{data.info.python ?? '—'}</code></div>
        <div class="flex justify-between border-b border-border/50 py-1"><span class="text-muted-foreground">Shards</span><code>{data.info.shard_count}</code></div>
        <div class="flex justify-between border-b border-border/50 py-1"><span class="text-muted-foreground">Dashboard-Beiträge</span><code>{data.info.contributions}</code></div>
        <div class="flex justify-between border-b border-border/50 py-1"><span class="text-muted-foreground">Gateway</span><code>{data.info.gateway_host}:{data.info.gateway_port}</code></div>
      </div>
    </Card>

    <!-- Migrations-Empfehlung: neue Repos & Cogs verwenden -->
    <Card class="border-amber-500/40 bg-amber-500/5 p-5">
      <h2 class="mb-1 text-base font-semibold">{$t('system.migrate_title')}</h2>
      <p class="mb-3 text-sm text-muted-foreground">{$t('system.migrate_desc')}</p>
      {#if data.legacyInstall}
        <p class="mb-3 text-sm text-amber-600 dark:text-amber-400">
          &#9888; {$t('system.migrate_legacy', { service: data.serviceName, user: data.runUser || 'dks' })}
        </p>
      {/if}
      <pre class="overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">Web-App: https://github.com/PD-Codes/PDC_Redbot_Webapp
[p]repo add pdc-cogs https://github.com/PD-Codes/PDC_Redbot_Cogs
[p]repo add pdc-game-cogs https://github.com/PD-Codes/PDC_Redbot_Game_Cogs
[p]cog install pdc-cogs &lt;name&gt;
[p]cog install pdc-game-cogs &lt;name&gt;</pre>
    </Card>

    <!-- GitHub-Updater -->
    <Card class="p-5">
      <h2 class="mb-1 text-base font-semibold">{$t('system.update_title')}</h2>
      <p class="mb-3 text-sm text-muted-foreground">{$t('system.update_desc')}</p>

      <!-- Update-Pruefung (ohne Self-Update) -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <span class="text-sm text-muted-foreground">{$t('system.current_version')}: <code>v{data.version}</code></span>
        <button
          type="button"
          class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
          disabled={checking}
          on:click={checkUpdate}>{checking ? $t('system.check_checking') : $t('system.check_update')}</button>
        {#if checkError}
          <span class="text-sm text-destructive">✗ {$t('system.check_failed')}: {checkError}</span>
        {:else if checkDone && checkAvailable}
          <span class="text-sm text-amber-500">⬆ {$t('system.update_available', { current: data.version, latest: checkLatest })}</span>
        {:else if checkDone}
          <span class="text-sm text-emerald-500">✓ {$t('system.up_to_date', { current: data.version })}</span>
        {/if}
      </div>

      <!-- Voraussetzungen / Setup -->
      <div class="mb-4 rounded-md border border-border bg-secondary/40 p-3 text-sm">
        <p class="mb-2 font-medium">{$t('system.update_req_title')}</p>
        <ul class="space-y-1.5 text-muted-foreground">
          <li class="flex gap-2"><span class="text-foreground">①</span><span>{$t('system.update_req_owner')}</span></li>
          <li class="flex gap-2"><span class="text-foreground">②</span><span>{$t('system.update_req_enable')} <code class="rounded bg-background px-1">ENABLE_SELF_UPDATE=true</code></span></li>
          <li class="flex gap-2"><span class="text-foreground">③</span><span>{$t('system.update_req_restart')}</span></li>
        </ul>
        <p class="mt-2 text-xs text-muted-foreground/80">{$t('system.update_req_hint')}</p>
        <pre class="mt-2 overflow-auto rounded bg-background p-2 text-xs leading-relaxed text-muted-foreground">// /etc/polkit-1/rules.d/49-{data.serviceName}.rules
polkit.addRule(function(action, subject) {'{'}
  if (action.id == "org.freedesktop.systemd1.manage-units" &&
      action.lookup("unit") == "{data.serviceName}.service" &&
      subject.user == "{data.runUser || 'pdc'}") {'{'} return polkit.Result.YES; {'}'}
{'}'});</pre>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          disabled={updating}
          on:click={askUpdate}>{updating ? '…' : $t('system.update_btn')}</button>
        {#if updatePhase === 'building'}<span class="text-sm text-amber-500">⟳ {$t('system.update_building')}</span>{/if}
        {#if updatePhase === 'restarting'}<span class="text-sm text-amber-500">⟳ {$t('system.update_restarting')}</span>{/if}
        {#if updatePhase === 'done' && !restartManual}<span class="text-sm text-emerald-500">✓ {$t('system.update_done')}</span>{/if}
        {#if updatePhase === 'done' && restartManual}<span class="text-sm text-amber-500">⚠ {$t('system.update_restart_manual')}</span>{/if}
        {#if updatePhase === 'error'}<span class="text-sm text-destructive">✗ {updateError}</span>{/if}
      </div>

      {#if updatePhase === 'error'}
        <p class="mt-2 text-sm text-destructive">{$t('system.update_failed')}: {updateError}</p>
      {/if}
      {#if updatePhase === 'done' && restartManual}
        <p class="mt-2 text-sm text-amber-600 dark:text-amber-400">{$t('system.update_restart_manual_hint')} <code class="rounded bg-background px-1">systemctl restart {data.serviceName}</code></p>
      {/if}

      {#if updateLog}
        <pre class="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{updateLog}</pre>
      {/if}
    </Card>
  {/if}
</div>

<!-- Bestätigungs-Modal (ersetzt window.confirm) -->
{#if showConfirm}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="presentation"
    on:click={(e) => {
      if (e.target === e.currentTarget) showConfirm = false;
    }}
  >
    <div class="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl" role="dialog" aria-modal="true">
      <h3 class="mb-2 text-base font-semibold">{$t('system.update_title')}</h3>
      <p class="mb-4 text-sm text-muted-foreground">{$t('system.update_confirm')}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary" on:click={() => (showConfirm = false)}>{$t('common.cancel')}</button>
        <button type="button" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" on:click={startUpdate}>{$t('system.update_btn')}</button>
      </div>
    </div>
  </div>
{/if}
