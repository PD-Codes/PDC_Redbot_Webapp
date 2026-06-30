<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';
  import { renderMarkdown } from '$lib/markdown';
  import { liveStatus } from '$lib/stores/live';

  export let data: {
    commands: {
      bot: { name: string | null; avatar: string | null } | null;
      prefix: Array<{ name: string; description: string; cog: string; repo?: string | null }>;
      slash: Array<{ name: string; description: string; cog: string; repo?: string | null }>;
    };
    stats: {
      guild_count?: number;
      user_count?: number;
      uptime_s?: number | null;
      owner?: string | null;
      description?: string | null;
      name?: string | null;
      avatar?: string | null;
      latency_ms?: number | null;
    } | null;
    online: boolean;
    user: { username: string } | null;
    branding?: { description?: string; support_url?: string; invite_url?: string } | null;
  };

  // Branding-Beschreibung hat Vorrang vor der Bot-About-Beschreibung.
  $: supportUrl = data.branding?.support_url?.trim() || '';

  type Cmd = { name: string; description: string; cog: string; repo?: string | null };

  $: c = data.commands ?? { bot: null, prefix: [], slash: [], counts: { prefix: 0, slash: 0 } };
  $: stats = data.stats ?? {};

  // Live overview via SSE (/api/events) overrides the SSR snapshot once it arrives.
  $: live = $liveStatus;
  $: guildCount = live.overview?.guild_count ?? stats.guild_count;
  $: userCount = live.overview?.user_count ?? stats.user_count;
  $: uptimeS = live.overview?.bot_uptime_s ?? stats.uptime_s;
  $: online = live.online ?? data.online;

  $: botName = stats.name ?? c.bot?.name ?? 'Bot';
  $: botAvatar = stats.avatar ?? c.bot?.avatar ?? null;
  $: owner = stats.owner ?? null;
  $: description = stats.description ?? $t('home.default_description');

  // Alle aktiven Befehle (Slash + Prefix).
  $: allCmds = [...(c.slash ?? []), ...(c.prefix ?? [])] as Cmd[];

  // Repo-Filter: nur Repos, in denen es aktive Module gibt. Befehle ohne Repo
  // werden als „__none__" (System) gruppiert.
  $: repoOptions = Array.from(new Set(allCmds.map((x) => x.repo ?? '__none__'))).sort((a, b) =>
    a === '__none__' ? 1 : b === '__none__' ? -1 : a.localeCompare(b)
  );
  let repo = 'all';
  const inRepo = (x: Cmd) => repo === 'all' || (x.repo ?? '__none__') === repo;

  // Modulfilter passt sich dem gewählten Repo an (nur Module aus aktiven Repos).
  $: modules = Array.from(new Set(allCmds.filter(inRepo).map((x) => x.cog || '—'))).sort((a, b) => a.localeCompare(b));
  let module = 'all';
  // Modulauswahl zurücksetzen, wenn sie unter dem gewählten Repo nicht mehr existiert.
  $: if (module !== 'all' && !modules.includes(module)) module = 'all';

  const matches = (x: Cmd) => inRepo(x) && (module === 'all' || (x.cog || '—') === module);
  $: slash = (c.slash ?? []).filter(matches);
  $: prefix = (c.prefix ?? []).filter(matches);

  function uptime(s: number | null | undefined) {
    if (s == null) return '—';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    if (d >= 30) {
      const mo = Math.floor(d / 30), rd = d % 30;
      return `${$t('home.uptime_months', { n: mo })}, ${$t('home.uptime_days', { n: rd })}`;
    }
    return `${$t('home.uptime_days', { n: d })}, ${$t('home.uptime_hours', { n: h })}`;
  }
</script>

<div class="space-y-6">
  {#if !online}
    <Card class="border-destructive/50 p-4">
      <p class="text-sm text-destructive">{$t('home.gateway_offline')}</p>
    </Card>
  {/if}

  <!-- Hero -->
  <Card class="p-7">
    {#if owner}<p class="text-sm font-semibold text-muted-foreground">{$t('home.powered_by', { owner })}</p>{/if}
    <h1 class="mt-1 text-4xl font-bold tracking-tight">{botName}</h1>

    <div class="mt-6 flex flex-wrap items-center gap-7">
      {#if botAvatar}
        <img src={botAvatar} alt="" class="h-32 w-32 shrink-0 rounded-full border border-border object-cover" />
      {:else}
        <span class="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-4xl font-bold text-muted-foreground">
          {botName.slice(0, 1)}
        </span>
      {/if}

      <div class="min-w-[240px] flex-1">
        <div class="max-w-lg text-lg leading-snug">{@html renderMarkdown(description)}</div>
        <div class="mt-4 flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full {online ? 'bg-emerald-500' : 'bg-destructive'}"></span>
          <span class="text-sm text-muted-foreground">
            {online ? $t('home.online') : $t('home.gateway_offline')}{#if online && stats.latency_ms != null} · {$t('home.latency', { ms: stats.latency_ms })}{/if}
          </span>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          {#if !data.user}
            <a href="/auth/login" class="inline-flex items-center justify-center rounded-md bg-[#5865F2] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
              {$t('login.with_discord')}
            </a>
          {/if}
          {#if data.branding?.invite_url}
            <a href={data.branding.invite_url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center rounded-md bg-[#5865F2] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
              {$t('home.invite_me')}
            </a>
          {/if}
          {#if supportUrl}
            <a href={supportUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center rounded-md border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary">
              {$t('home.support_server')}
            </a>
          {/if}
        </div>
      </div>
    </div>
  </Card>

  <!-- Kennzahlen -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <Card class="flex items-center justify-between p-5">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('home.kpi_servers')}</p>
        <p class="mt-1.5 text-2xl font-semibold">{guildCount ?? '—'}</p>
      </div>
      <span class="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15"><span class="h-3 w-3 rounded-full bg-destructive"></span></span>
    </Card>
    <Card class="flex items-center justify-between p-5">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('home.kpi_users')}</p>
        <p class="mt-1.5 text-2xl font-semibold">{userCount?.toLocaleString('de-DE') ?? '—'}</p>
      </div>
      <span class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15"><span class="h-3 w-3 rounded-full bg-primary"></span></span>
    </Card>
    <Card class="flex items-center justify-between p-5">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('home.kpi_online_since')}</p>
        <p class="mt-1.5 text-2xl font-semibold">{uptime(uptimeS)}</p>
      </div>
      <span class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15"><span class="h-3 w-3 rounded-full bg-emerald-500"></span></span>
    </Card>
  </div>

  <!-- Aktive Befehle -->
  <div>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">{$t('home.active_commands')}</h2>
      <div class="flex items-center gap-3">
        {#if repoOptions.length > 1}
          <select bind:value={repo} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" title={$t('cogs.filter_repo')}>
            <option value="all">{$t('home.all_repos')}</option>
            {#each repoOptions as r}<option value={r}>{r === '__none__' ? $t('home.no_repo') : r}</option>{/each}
          </select>
        {/if}
        <select bind:value={module} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
          <option value="all">{$t('home.all_modules')}</option>
          {#each modules as m}<option value={m}>{m}</option>{/each}
        </select>
        <a href="/commands" class="whitespace-nowrap text-sm text-primary hover:underline">{$t('home.view_all_commands')}</a>
      </div>
    </div>

    {#if slash.length === 0 && prefix.length === 0}
      <Card class="p-5"><p class="text-sm text-muted-foreground">{$t('home.no_commands_module')}</p></Card>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card class="overflow-hidden p-0">
          <div class="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 class="text-sm font-semibold">{$t('home.slash_commands')}</h3>
            <span class="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">{slash.length}</span>
          </div>
          {#each slash as cmd (cmd.name)}
            <div class="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-2.5 last:border-0">
              <div class="min-w-0">
                <code class="text-sm text-primary">/{cmd.name}</code>
                <p class="mt-0.5 truncate text-xs text-muted-foreground">{cmd.description}</p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-0.5">
                <span class="text-xs text-muted-foreground">{cmd.cog}</span>
                {#if cmd.repo}<span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground" title="Repo">{cmd.repo}</span>{/if}
              </div>
            </div>
          {:else}
            <p class="px-4 py-3 text-sm text-muted-foreground">—</p>
          {/each}
        </Card>

        <Card class="overflow-hidden p-0">
          <div class="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 class="text-sm font-semibold">{$t('home.prefix_commands')}</h3>
            <span class="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{prefix.length}</span>
          </div>
          {#each prefix as cmd (cmd.name)}
            <div class="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-2.5 last:border-0">
              <div class="min-w-0">
                <code class="text-sm text-primary">{cmd.name}</code>
                <p class="mt-0.5 truncate text-xs text-muted-foreground">{cmd.description}</p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-0.5">
                <span class="text-xs text-muted-foreground">{cmd.cog}</span>
                {#if cmd.repo}<span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground" title="Repo">{cmd.repo}</span>{/if}
              </div>
            </div>
          {:else}
            <p class="px-4 py-3 text-sm text-muted-foreground">—</p>
          {/each}
        </Card>
      </div>
    {/if}
  </div>
</div>
