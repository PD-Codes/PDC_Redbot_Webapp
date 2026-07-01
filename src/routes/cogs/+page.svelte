<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import ModuleTabs from '$lib/components/ModuleTabs.svelte';
  import { invalidateAll } from '$app/navigation';
  import { t } from '$lib/i18n';

  export let data: {
    cogs: Array<{ name: string; loaded: boolean; has_dashboard: boolean; repo?: string | null }>;
    slash: Array<{ name: string; type: number; cog: string; enabled: boolean; orphan?: boolean; synced?: boolean }>;
    repos: Array<{
      name: string;
      url: string | null;
      branch: string | null;
      installed: Array<{ name: string; update_available?: boolean }>;
      available_cogs: Array<{ name: string; description: string }>;
    }>;
    forbidden: boolean;
    online: boolean;
    downloaderAvailable: boolean;
    downloaderError: string | null;
    globalPanels: Array<{ key: string; kind: string; name: string; cog: string; description?: string | null }>;
  };

  let tab: 'cogs' | 'slash' | 'downloader' | 'global' = 'cogs';

  // Globale Beiträge nach Modul (Cog) gruppieren → je Modul mehrere Tabs.
  $: globalByCog = (data.globalPanels ?? []).reduce((acc: Record<string, typeof data.globalPanels>, p) => {
    (acc[p.cog] ??= []).push(p);
    return acc;
  }, {});
  $: globalCogs = Object.keys(globalByCog).sort((a, b) => a.localeCompare(b));
  let selectedCog = '';
  $: if (globalCogs.length && !globalCogs.includes(selectedCog)) selectedCog = globalCogs[0];
  let query = '';
  let busy = '';
  let msg = '';
  let err = '';

  // Reusable confirm dialog for destructive actions (uninstall, repo remove).
  let confirmDlg = { open: false, title: '', message: '', confirmLabel: '', onConfirm: () => {} };
  function askConfirm(title: string, message: string, confirmLabel: string, fn: () => void) {
    confirmDlg = { open: true, title, message, confirmLabel, onConfirm: fn };
  }

  // Add-Repo-Formular
  let repoName = '';
  let repoUrl = '';
  let repoBranch = '';

  // Diese Cogs sind für das Web-Dashboard zwingend erforderlich → „Erforderlich"-Pill.
  const REQUIRED_COGS = new Set(['pdc_webdashboard', 'pdc_webdashboard_stats']);
  const isRequired = (name: string) => REQUIRED_COGS.has(name.toLowerCase());
  // Required cogs may be ENABLED freely; only unloading a loaded one is blocked.
  const isLocked = (c: { name: string; loaded: boolean }) => isRequired(c.name) && c.loaded;

  // Repo-Filter: Dropdown mit allen vorkommenden Repos (+ "ohne Repo" falls vorhanden).
  let repoFilter = 'all';
  $: repoOptions = Array.from(
    new Set(data.cogs.map((c) => c.repo ?? '__none__'))
  ).sort((a, b) => (a === '__none__' ? 1 : b === '__none__' ? -1 : a.localeCompare(b)));

  $: filteredCogs = data.cogs.filter((c) => {
    const okQuery = !query || c.name.toLowerCase().includes(query.toLowerCase());
    const okRepo =
      repoFilter === 'all' || (repoFilter === '__none__' ? !c.repo : c.repo === repoFilter);
    return okQuery && okRepo;
  });

  async function post(url: string, body: unknown, label: string): Promise<boolean> {
    busy = label;
    msg = '';
    err = '';
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.error) {
        err = j.error;
        return false;
      }
      msg = $t('common.done');
      await invalidateAll();
      return true;
    } catch (e) {
      err = e instanceof Error ? e.message : 'Fehler';
      return false;
    } finally {
      busy = '';
    }
  }

  async function toggleCog(c: { name: string; loaded: boolean }) {
    if (isLocked(c)) return;
    if (c.loaded) {
      await post('/api/cogs', { name: c.name, action: 'unload' }, 'cog:' + c.name);
      return;
    }
    // Enabling a cog: load it, then reload it so its (slash) commands and dashboard
    // contributions register and become visible, then refresh the view.
    const headers = { 'content-type': 'application/json' };
    busy = 'cog:' + c.name;
    msg = '';
    err = '';
    try {
      const res = await fetch('/api/cogs', { method: 'POST', headers, body: JSON.stringify({ name: c.name, action: 'load' }) });
      const j = await res.json();
      if (j.error) {
        err = j.error;
        return;
      }
      // Reload so newly loaded cogs' app/slash commands show up immediately.
      await fetch('/api/cogs', { method: 'POST', headers, body: JSON.stringify({ name: c.name, action: 'reload' }) }).catch(() => {});
      msg = $t('common.done');
      await invalidateAll();
    } catch (e) {
      err = e instanceof Error ? e.message : 'Fehler';
    } finally {
      busy = '';
    }
  }
  // Bulk-Enable: lädt alle (gefilterten) noch nicht geladenen, nicht geschützten
  // Module nacheinander und lädt sie neu, damit ihre Slash-Befehle sofort
  // erscheinen. Der Dashboard-Cog wird NICHT neu geladen (das würde das Gateway,
  // mit dem diese Seite spricht, mitten im Lauf neu starten).
  async function enableAll() {
    const targets = filteredCogs.filter((c) => !c.loaded && !isLocked(c));
    if (!targets.length) return;
    busy = 'enableall';
    msg = '';
    err = '';
    const headers = { 'content-type': 'application/json' };
    const failed: string[] = [];
    try {
      for (const c of targets) {
        const res = await fetch('/api/cogs', {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: c.name, action: 'load' })
        });
        const j = await res.json().catch(() => ({ error: 'parse error' }));
        if (j.error) {
          failed.push(`${c.name}: ${j.error}`);
          continue;
        }
        if (!isDashboardCog(c.name)) {
          await fetch('/api/cogs', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: c.name, action: 'reload' })
          }).catch(() => {});
        }
      }
      msg = failed.length ? `${$t('common.done')} (${failed.length} ✗)` : $t('common.done');
      err = failed.join('; ');
      await invalidateAll();
    } finally {
      busy = '';
    }
  }

  const reloadCog = (name: string) => post('/api/cogs', { name, action: 'reload' }, 'reload:' + name);
  // Reloading pdc_webdashboard restarts the gateway this page talks to -> warn + confirm
  // first, and remind about the load order. Only for the pdc_webdashboard cog.
  let reloadModalCog: string | null = null;
  let reloadCountdown: number | null = null;
  const isDashboardCog = (name: string) => name.toLowerCase() === 'pdc_webdashboard';
  function requestReload(name: string) {
    if (isDashboardCog(name)) reloadModalCog = name;
    else reloadCog(name);
  }
  function confirmReload() {
    const name = reloadModalCog;
    if (!name) return;
    // Fire the reload (the gateway dies mid-request, so don't await it), then count
    // down and hard-reload the page so it reconnects to the restarted gateway.
    reloadCog(name);
    reloadCountdown = 30;
    const iv = setInterval(() => {
      reloadCountdown = (reloadCountdown ?? 1) - 1;
      if ((reloadCountdown ?? 0) <= 0) {
        clearInterval(iv);
        location.reload();
      }
    }, 1000);
  }
  const syncSlash = () => post('/api/slash', { action: 'sync' }, 'sync');
  const setSlash = (cmd: { name: string; type: number; enabled: boolean }) =>
    post('/api/slash', { action: 'set', name: cmd.name, type: cmd.type, enabled: !cmd.enabled }, 'slash:' + cmd.name);
  const setCog = (cog: string, enabled: boolean) =>
    post('/api/slash', { action: 'set_cog', cog, enabled }, 'slashcog:' + cog);

  // Slash-Commands nach Cog gruppieren
  $: slashByCog = data.slash.reduce((acc: Record<string, typeof data.slash>, s) => {
    (acc[s.cog] ??= []).push(s);
    return acc;
  }, {});
  // Ghost cog (Discord registrations with no loaded cog) sorts to the bottom.
  const isGhostCog = (cog: string) => (slashByCog[cog] ?? []).some((s) => s.orphan);
  $: slashCogs = Object.keys(slashByCog).sort((a, b) => {
    const ga = isGhostCog(a),
      gb = isGhostCog(b);
    if (ga !== gb) return ga ? 1 : -1;
    return a.localeCompare(b);
  });
  const cogAllEnabled = (cog: string) => (slashByCog[cog] ?? []).every((s) => s.enabled);
  let updateMsg = '';
  async function updateCheck() {
    busy = 'update'; msg = ''; err = ''; updateMsg = '';
    try {
      const res = await fetch('/api/downloader', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update_check' }) });
      const j = await res.json();
      if (j.error) { err = j.error; return; }
      const list: string[] = j.cogs_with_updates ?? [];
      updateMsg = list.length ? $t('cogs.updates_found', { n: list.length, list: list.join(', ') }) : $t('cogs.all_up_to_date');
      await invalidateAll();
    } catch (e) {
      err = e instanceof Error ? e.message : 'Fehler';
    } finally {
      busy = '';
    }
  }
  const addRepo = async () => {
    if (await post('/api/downloader', { action: 'repo_add', name: repoName, url: repoUrl, branch: repoBranch || null }, 'repo_add')) {
      repoName = '';
      repoUrl = '';
      repoBranch = '';
    }
  };
  const removeRepo = (name: string) => post('/api/downloader', { action: 'repo_remove', name }, 'repo_rm:' + name);
  const installCog = (repo: string, cog: string) => post('/api/downloader', { action: 'cog_install', repo, cog }, 'inst:' + cog);
  const uninstallCog = (cog: string) => post('/api/downloader', { action: 'cog_uninstall', cog }, 'uninst:' + cog);
  // Markiert einen Cog lokal sofort als „kein Update mehr" (optimistisches UI),
  // damit die Ansicht nicht erst nach F5 nachzieht.
  function clearUpdateFlag(cog: string) {
    for (const repo of data.repos ?? []) {
      for (const ic of repo.installed ?? []) {
        if (ic.name === cog) ic.update_available = false;
      }
    }
    data = data; // Reaktivität triggern
  }

  // Update-Warteschlange: Mehrere Klicks werden gesammelt und NACHEINANDER
  // ausgeführt. So laufen nie zwei Downloader-Operationen / Slash-Syncs parallel
  // (der Downloader ist dafür nicht ausgelegt). Das Gateway sichert das zusätzlich
  // mit einem Lock ab. Schnelldurchklicken ist damit unkritisch.
  let updateQueue: string[] = [];
  let updatingNow = '';
  let updatePending = new Set<string>();
  let syncingSlash = false;
  $: updatesRunning = updatingNow !== '' || updateQueue.length > 0 || syncingSlash;

  function enqueueUpdate(cog: string) {
    if (updatePending.has(cog)) return; // läuft schon oder steht in der Schlange
    updatePending = new Set(updatePending).add(cog);
    updateQueue = [...updateQueue, cog];
    if (!updatingNow) processQueue();
  }

  async function processQueue() {
    let anyOk = false;
    while (updateQueue.length) {
      const cog = updateQueue[0];
      updateQueue = updateQueue.slice(1);
      updatingNow = cog;
      const ok = await runUpdate(cog);
      anyOk = anyOk || ok;
      updatingNow = '';
      const s = new Set(updatePending);
      s.delete(cog);
      updatePending = s;
    }
    // Slash-Commands NUR EINMAL am Ende synchronisieren (nicht pro Cog – das ist
    // langsam und von Discord rate-limitet). Danach echten Stand nachladen.
    if (anyOk) {
      syncingSlash = true;
      try {
        const res = await fetch('/api/slash', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'sync' })
        });
        const j = await res.json();
        if (!j.error) msg = (msg ? msg + ' · ' : '') + $t('cogs.slash_synced');
      } catch {
        /* Sync best-effort */
      }
      syncingSlash = false;
    }
    // Reconcile with server truth. downloader.repos now takes the Downloader lock,
    // so this read waits for any in-flight update and never returns a partial scan.
    await invalidateAll();
  }

  // Pro Cog: Update + Reload (schnell, KEIN Slash-Sync – der läuft einmal am Ende).
  // Liefert true bei Erfolg.
  async function runUpdate(cog: string): Promise<boolean> {
    err = '';
    try {
      const res = await fetch('/api/downloader', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cog_update', cog })
      });
      const j = await res.json();
      if (j.error) {
        err = `${cog}: ${j.error}`;
        return false;
      }
      const parts = [`${cog}: ${$t('cogs.updated')}`];
      if (j.self_skipped) parts.push($t('cogs.reload_manual'));
      else if (j.reloaded) parts.push($t('cogs.reloaded'));
      else if (j.reload_error) parts.push($t('cogs.reload_failed') + ': ' + j.reload_error);
      msg = parts.join(' · ');
      clearUpdateFlag(cog); // optimistisch: Badge/Button sofort weg
      return true;
    } catch (e) {
      err = `${cog}: ` + (e instanceof Error ? e.message : 'Fehler');
      return false;
    }
  }

  // Aufklappbare Repos (Standard: zu, wenn mehr als 1 Repo).
  let openRepos: Record<string, boolean> = {};
  const toggleRepo = (name: string) => (openRepos = { ...openRepos, [name]: !openRepos[name] });
  const isRepoOpen = (name: string) => openRepos[name] ?? (data.repos?.length ?? 0) <= 1;

  // Installierte + verfügbare Cogs eines Repos zu EINER Liste mit Status zusammenführen.
  type RepoCog = { name: string; description: string; installed: boolean; update: boolean };
  function mergedCogs(repo: { installed?: Array<{ name: string; update_available?: boolean }>; available_cogs?: Array<{ name: string; description?: string }> }): RepoCog[] {
    const inst = new Map((repo.installed ?? []).map((c) => [c.name, !!c.update_available]));
    const byName = new Map<string, RepoCog>();
    for (const c of repo.available_cogs ?? [])
      byName.set(c.name, { name: c.name, description: c.description ?? '', installed: inst.has(c.name), update: inst.get(c.name) ?? false });
    for (const c of repo.installed ?? [])
      if (!byName.has(c.name)) byName.set(c.name, { name: c.name, description: '', installed: true, update: !!c.update_available });
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-semibold">{$t('cogs.title')}</h1>

  {#if data.forbidden}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('cogs.forbidden')}</p></Card>
  {:else if !data.online}
    <Card class="border-destructive/50 p-4"><p class="text-sm text-destructive">{$t('common.gateway_offline')}</p></Card>
  {:else}
    <div class="flex items-center gap-3">
      <div class="inline-flex rounded-md border border-border p-0.5 text-sm">
        <button class="rounded px-3 py-1.5 {tab === 'cogs' ? 'bg-secondary font-medium' : 'text-muted-foreground'}" on:click={() => (tab = 'cogs')}>{$t('cogs.tab_cogs')} ({data.cogs.filter((c) => c.loaded).length}/{data.cogs.length})</button>
        <button class="rounded px-3 py-1.5 {tab === 'slash' ? 'bg-secondary font-medium' : 'text-muted-foreground'}" on:click={() => (tab = 'slash')}>{$t('cogs.tab_slash')} ({data.slash.length})</button>
        <button class="rounded px-3 py-1.5 {tab === 'downloader' ? 'bg-secondary font-medium' : 'text-muted-foreground'}" on:click={() => (tab = 'downloader')}>{$t('cogs.tab_downloader')}</button>
        <button class="rounded px-3 py-1.5 {tab === 'global' ? 'bg-secondary font-medium' : 'text-muted-foreground'}" on:click={() => (tab = 'global')}>{$t('cogs.tab_global')} ({data.globalPanels?.length ?? 0})</button>
      </div>
      {#if syncingSlash}<span class="text-sm text-amber-500">⟳ {$t('cogs.slash_syncing')}</span>
      {:else if updatingNow}<span class="text-sm text-amber-500">⟳ {updatingNow}{#if updateQueue.length} (+{updateQueue.length}){/if}</span>{/if}
      {#if msg}<span class="text-sm text-emerald-500">{msg}</span>{/if}
      {#if err}<span class="text-sm text-destructive">{err}</span>{/if}
    </div>

    {#if tab === 'cogs'}
      <div class="flex flex-wrap items-center gap-2">
        <input type="text" bind:value={query} placeholder={$t('common.search')} class="min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <select bind:value={repoFilter} class="rounded-md border border-input bg-background px-3 py-2 text-sm" title={$t('cogs.filter_repo')}>
          <option value="all">{$t('cogs.filter_repo_all')}</option>
          {#each repoOptions as r}
            <option value={r}>{r === '__none__' ? $t('cogs.filter_repo_none') : r}</option>
          {/each}
        </select>
        <button
          type="button"
          class="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
          title={$t('cogs.enable_all_hint')}
          disabled={busy === 'enableall' || !filteredCogs.some((c) => !c.loaded && !isLocked(c))}
          on:click={enableAll}
        >{busy === 'enableall' ? $t('cogs.enabling_all') : $t('cogs.enable_all')}</button>
      </div>
      {#if filteredCogs.length === 0}
        <p class="text-sm text-muted-foreground">{$t('cogs.filter_empty')}</p>
      {/if}
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {#each filteredCogs as c (c.name)}
          <Card class="flex items-center justify-between gap-2 p-3">
            <div class="flex items-center gap-2 min-w-0">
              <button
                type="button"
                aria-label="toggle"
                on:click={() => !isLocked(c) && toggleCog(c)}
                disabled={busy === 'cog:' + c.name || isLocked(c)}
                title={isLocked(c) ? $t('cogs.required_hint') : ''}
                class="relative h-5 w-9 shrink-0 rounded-full transition {c.loaded ? 'bg-primary' : 'bg-secondary'} {isLocked(c) ? 'cursor-not-allowed opacity-60' : ''}"
              >
                <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all {c.loaded ? 'left-[18px]' : 'left-0.5'}"></span>
              </button>
              <span class="truncate text-sm {c.loaded ? 'font-medium' : 'text-muted-foreground'}">{c.name}</span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              {#if isRequired(c.name)}<span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500" title={$t('cogs.required_hint')}>{$t('cogs.required')}</span>{/if}
              {#if c.repo}<span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground" title="Repo">{c.repo}</span>{:else}<span class="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-500" title={$t('cogs.system_hint')}>{$t('cogs.system')}</span>{/if}
              {#if c.has_dashboard}<span class="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary" title="Dashboard-Integration">DB</span>{/if}
              {#if c.loaded}<button type="button" class="text-xs text-muted-foreground hover:text-foreground" on:click={() => requestReload(c.name)}>↻</button>{/if}
            </div>
          </Card>
        {/each}
      </div>
    {/if}

    {#if tab === 'slash'}
      <div class="mb-3 flex items-center justify-between">
        <p class="text-sm text-muted-foreground">{$t('cogs.slash_summary', { n: data.slash.length })}</p>
        <button type="button" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy === 'sync'} on:click={syncSlash}>
          {busy === 'sync' ? '…' : $t('cogs.sync_discord')}
        </button>
      </div>
      <p class="mb-3 text-xs text-muted-foreground">{$t('cogs.sync_hint')}</p>

      <div class="space-y-4">
        {#each slashCogs as cog (cog)}
          <Card class="overflow-hidden p-0 {isGhostCog(cog) ? 'border border-destructive/40' : ''}">
            <div class="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2.5">
              <span class="text-sm font-semibold {isGhostCog(cog) ? 'text-destructive' : ''}">{cog}</span>
              {#if isGhostCog(cog)}
                <span class="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive" title={$t('cogs.ghost_hint')}>{$t('cogs.ghost')}</span>
              {:else}
                <!-- Cog-Master-Toggle: schaltet alle Befehle des Cogs -->
                <button
                  type="button"
                  aria-label="alle umschalten"
                  title={$t('cogs.toggle_all_title')}
                  disabled={busy === 'slashcog:' + cog}
                  on:click={() => setCog(cog, !cogAllEnabled(cog))}
                  class="relative h-5 w-9 shrink-0 rounded-full transition {cogAllEnabled(cog) ? 'bg-primary' : 'bg-secondary'}"
                >
                  <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all {cogAllEnabled(cog) ? 'left-[18px]' : 'left-0.5'}"></span>
                </button>
              {/if}
            </div>
            {#each slashByCog[cog] as s (s.name + s.type)}
              <div class="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2 last:border-0">
                <code class="text-sm {s.orphan ? 'text-destructive line-through' : s.enabled ? 'text-primary' : 'text-muted-foreground line-through'}">/{s.name}</code>
                <div class="flex shrink-0 items-center gap-2">
                  {#if s.enabled && s.synced === false && !s.orphan}
                    <span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500" title={$t('cogs.not_synced_hint')}>{$t('cogs.not_synced')}</span>
                  {/if}
                  {#if s.orphan}
                    <span class="text-[10px] text-destructive" title={$t('cogs.ghost_hint')}>{$t('cogs.ghost')}</span>
                  {:else}
                    <button
                      type="button"
                      aria-label="umschalten"
                      disabled={busy === 'slash:' + s.name}
                      on:click={() => setSlash(s)}
                      class="relative h-5 w-9 shrink-0 rounded-full transition {s.enabled ? 'bg-primary' : 'bg-secondary'}"
                    >
                      <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all {s.enabled ? 'left-[18px]' : 'left-0.5'}"></span>
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </Card>
        {/each}
      </div>
    {/if}

    {#if tab === 'downloader'}
      {#if !data.downloaderAvailable}
        {#if data.downloaderError}
          <Card class="border-destructive/50 p-4">
            <p class="text-sm font-medium text-destructive">{$t('cogs.downloader_error')}</p>
            <p class="mt-1 break-words text-sm text-muted-foreground">{data.downloaderError}</p>
            <p class="mt-2 text-xs text-muted-foreground">{$t('cogs.downloader_error_hint')}</p>
          </Card>
        {:else}
          <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('cogs.downloader_not_loaded')}</p></Card>
        {/if}
      {:else}
        <div class="flex flex-wrap items-end gap-2">
          <div><label class="text-xs text-muted-foreground" for="rn">{$t('cogs.field_name')}</label><input id="rn" bind:value={repoName} class="block rounded-md border border-input bg-background px-2 py-1.5 text-sm" /></div>
          <div class="flex-1"><label class="text-xs text-muted-foreground" for="ru">{$t('cogs.field_repo_url')}</label><input id="ru" bind:value={repoUrl} placeholder="https://github.com/…" class="block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" /></div>
          <div><label class="text-xs text-muted-foreground" for="rb">{$t('cogs.field_branch')}</label><input id="rb" bind:value={repoBranch} placeholder={$t('cogs.field_branch_placeholder')} class="block rounded-md border border-input bg-background px-2 py-1.5 text-sm" /></div>
          <button type="button" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy === 'repo_add'} on:click={addRepo}>{$t('cogs.add_repo')}</button>
          <button type="button" class="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50" disabled={busy === 'update'} on:click={updateCheck}>{busy === 'update' ? '…' : $t('cogs.update_check')}</button>
        </div>
        {#if updateMsg}<p class="text-sm text-muted-foreground">{updateMsg}</p>{/if}

        <div class="space-y-3">
          {#each data.repos as repo (repo.name)}
            {@const cogs = mergedCogs(repo)}
            {@const instCount = cogs.filter((c) => c.installed).length}
            {@const updCount = cogs.filter((c) => c.update).length}
            {@const open = openRepos[repo.name] ?? (data.repos.length <= 1)}
            <Card class="overflow-hidden p-0">
              <!-- Repo-Kopf: anklickbar zum Auf-/Zuklappen -->
              <div class="flex items-start justify-between gap-3 px-4 py-3">
                <button type="button" class="flex min-w-0 flex-1 items-start gap-2 text-left" on:click={() => toggleRepo(repo.name)}>
                  <span class="mt-0.5 shrink-0 text-muted-foreground">{open ? '▾' : '▸'}</span>
                  <span class="min-w-0">
                    <span class="font-medium">{repo.name}</span>
                    <span class="block truncate text-xs text-muted-foreground">{repo.url}{repo.branch ? ' · ' + repo.branch : ''}</span>
                  </span>
                </button>
                <div class="flex shrink-0 items-center gap-2">
                  {#if updCount > 0}
                    <span class="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-500" title={$t('cogs.updates_available')}>{updCount} Update{updCount > 1 ? 's' : ''}</span>
                  {/if}
                  <span class="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{$t('cogs.installed_count', { inst: instCount, total: cogs.length })}</span>
                  <button
                    type="button"
                    class="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive disabled:opacity-40"
                    disabled={instCount > 0 || busy === 'repo_rm:' + repo.name}
                    title={instCount > 0 ? $t('cogs.remove_first_hint') : $t('cogs.remove_repo')}
                    on:click={() => askConfirm($t('cogs.remove_repo'), $t('cogs.confirm_repo_remove', { name: repo.name }), $t('cogs.remove'), () => removeRepo(repo.name))}
                  >{$t('cogs.remove')}</button>
                </div>
              </div>

              {#if open}
                <div class="divide-y divide-border/40 border-t border-border px-4">
                  {#each cogs as c (c.name)}
                    <div class="flex items-center justify-between gap-3 py-2 text-sm">
                      <div class="flex min-w-0 items-start gap-2">
                        {#if c.installed}
                          <span class="mt-0.5 shrink-0 text-emerald-500" title={$t('cogs.installed')}>✓</span>
                        {:else}
                          <span class="mt-0.5 shrink-0 text-muted-foreground/30" title={$t('cogs.not_installed')}>○</span>
                        {/if}
                        <div class="min-w-0">
                          <code class={c.installed ? 'text-foreground' : 'text-primary'}>{c.name}</code>
                          {#if isRequired(c.name)}<span class="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500" title={$t('cogs.required_hint')}>{$t('cogs.required')}</span>{/if}
                          {#if c.update}<span class="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500">{$t('cogs.update_badge')}</span>{/if}
                          {#if c.description}<span class="text-muted-foreground"> — {c.description}</span>{/if}
                        </div>
                      </div>
                      <div class="flex shrink-0 items-center gap-2">
                        {#if c.update}
                          <button
                            type="button"
                            class="rounded-md border border-amber-500/50 px-2 py-1 text-xs text-amber-500 disabled:opacity-40"
                            disabled={updatePending.has(c.name)}
                            on:click={() => enqueueUpdate(c.name)}
                          >{updatingNow === c.name ? '…' : updatePending.has(c.name) ? $t('cogs.update_queued') : $t('cogs.update')}</button>
                        {/if}
                        {#if c.installed}
                          <button
                            type="button"
                            class="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-40"
                            title={$t('cogs.reload_title')}
                            disabled={busy === 'reload:' + c.name}
                            on:click={() => requestReload(c.name)}
                          >{busy === 'reload:' + c.name ? '…' : $t('cogs.reload')}</button>
                          <button
                            type="button"
                            class="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive disabled:opacity-40"
                            disabled={busy === 'uninst:' + c.name}
                            on:click={() => askConfirm($t('cogs.uninstall'), $t('cogs.confirm_uninstall', { cog: c.name }), $t('cogs.uninstall'), () => uninstallCog(c.name))}
                          >{busy === 'uninst:' + c.name ? '…' : $t('cogs.uninstall')}</button>
                        {:else}
                          <button
                            type="button"
                            class="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-40"
                            disabled={busy === 'inst:' + c.name}
                            on:click={() => installCog(repo.name, c.name)}
                          >{busy === 'inst:' + c.name ? '…' : $t('cogs.install')}</button>
                        {/if}
                      </div>
                    </div>
                  {:else}
                    <p class="py-2 text-sm text-muted-foreground">{$t('cogs.no_cogs_in_repo')}</p>
                  {/each}
                </div>
              {/if}
            </Card>
          {/each}
        </div>
      {/if}
    {/if}

    {#if tab === 'global'}
      {#if !globalCogs.length}
        <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('cogs.no_global_settings')}</p></Card>
      {:else}
        <div class="flex flex-col gap-4 md:flex-row">
          <!-- Modul-Auswahl (Sidebar auf Desktop, Dropdown-artig gestapelt auf Mobile) -->
          <div class="shrink-0 md:w-52">
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('cogs.modules')}</p>
            <div class="flex flex-wrap gap-1 md:flex-col">
              {#each globalCogs as cog (cog)}
                <button
                  type="button"
                  on:click={() => (selectedCog = cog)}
                  class="rounded-md px-3 py-1.5 text-left text-sm transition
                    {selectedCog === cog ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-secondary/50'}"
                >
                  {cog}
                  <span class="ml-1 text-xs opacity-60">({globalByCog[cog].length})</span>
                </button>
              {/each}
            </div>
          </div>

          <!-- Tabs des gewählten Moduls (Panels + Listen) -->
          <div class="min-w-0 flex-1">
            {#key selectedCog}
              <ModuleTabs contributions={globalByCog[selectedCog] ?? []} guildId={null} />
            {/key}
          </div>
        </div>
      {/if}
    {/if}

    <p class="text-xs text-muted-foreground">{$t('cogs.footer_hint')}</p>
  {/if}

  <!-- Confirmation modal: only for reloading the pdc_webdashboard cog (restarts the gateway). -->
  {#if reloadModalCog}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      on:click|self={() => {
        if (reloadCountdown === null) reloadModalCog = null;
      }}
    >
      <div class="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl">
        {#if reloadCountdown === null}
          <h3 class="text-lg font-semibold">{$t('cogs.reload_dash_title')}</h3>
          <p class="mt-2 text-sm text-muted-foreground">{$t('cogs.reload_dash_body')}</p>
          <div class="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p class="font-medium text-amber-500">{$t('cogs.reload_dash_order_title')}</p>
            <ol class="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">
              <li>{$t('cogs.reload_dash_step1')}</li>
              <li>{$t('cogs.reload_dash_step2')}</li>
              <li>{$t('cogs.reload_dash_step3')}</li>
            </ol>
          </div>
          <p class="mt-3 text-xs text-muted-foreground">⏱ {$t('cogs.reload_dash_wait')}</p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
              on:click={() => (reloadModalCog = null)}>{$t('common.cancel')}</button>
            <button
              type="button"
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              on:click={confirmReload}>{$t('cogs.reload_dash_confirm')}</button>
          </div>
        {:else}
          <h3 class="text-center text-lg font-semibold">{$t('cogs.reload_dash_restarting')}</h3>
          <p class="my-3 text-center text-6xl font-bold tabular-nums text-primary">{reloadCountdown}</p>
          <p class="text-center text-sm text-muted-foreground">{$t('cogs.reload_dash_countdown')}</p>
        {/if}
      </div>
    </div>
  {/if}

  <ConfirmDialog
    bind:open={confirmDlg.open}
    title={confirmDlg.title}
    message={confirmDlg.message}
    confirmLabel={confirmDlg.confirmLabel}
    onConfirm={confirmDlg.onConfirm}
  />
</div>
