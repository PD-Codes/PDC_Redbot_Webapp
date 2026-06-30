<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';
  export let data: {
    settings: {
      global_prefixes: string[];
      guild_prefixes: string[];
      nickname: string | null;
      admin_roles: string[];
      mod_roles: string[];
      embeds: boolean | null;
      roles: Array<{ id: string; name: string }>;
    };
    guildId: string;
  };

  let prefixes = [...(data.settings.guild_prefixes ?? [])];
  let newPrefix = '';
  let nickname = data.settings.nickname ?? '';
  let adminRoles = [...(data.settings.admin_roles ?? [])];
  let modRoles = [...(data.settings.mod_roles ?? [])];
  let embeds: string = data.settings.embeds === null || data.settings.embeds === undefined ? 'inherit' : data.settings.embeds ? 'on' : 'off';

  let busy = '';
  let note: Record<string, string> = {};

  async function save(field: string, value: unknown) {
    busy = field;
    note[field] = '';
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope: 'guild', guild: data.guildId, field, value })
      });
      const j = await res.json();
      note[field] = j.error ? '✗ ' + j.error : '✓ Gespeichert';
    } catch (e) {
      note[field] = '✗ ' + (e instanceof Error ? e.message : 'Fehler');
    } finally {
      busy = '';
    }
  }

  function addPrefix() {
    const p = newPrefix.trim();
    if (p && !prefixes.includes(p)) prefixes = [...prefixes, p];
    newPrefix = '';
  }
  const removePrefix = (p: string) => (prefixes = prefixes.filter((x) => x !== p));
  const embedsValue = () => (embeds === 'inherit' ? null : embeds === 'on');

  // Rollen-Auswahl per Dropdown + Chips
  let adminSel = '';
  let modSel = '';
  const roleName = (id: string) => data.settings.roles.find((r) => r.id === id)?.name ?? id;
  function addAdmin() {
    if (adminSel && !adminRoles.includes(adminSel)) adminRoles = [...adminRoles, adminSel];
    adminSel = '';
  }
  function addMod() {
    if (modSel && !modRoles.includes(modSel)) modRoles = [...modRoles, modSel];
    modSel = '';
  }
  const rmAdmin = (id: string) => (adminRoles = adminRoles.filter((x) => x !== id));
  const rmMod = (id: string) => (modRoles = modRoles.filter((x) => x !== id));
  $: availAdmin = data.settings.roles.filter((r) => !adminRoles.includes(r.id));
  $: availMod = data.settings.roles.filter((r) => !modRoles.includes(r.id));
</script>

<div class="mx-auto max-w-3xl space-y-6">
  <a href={`/guilds/${data.guildId}`} class="text-sm text-muted-foreground hover:text-foreground">{$t('guild.back_to_overview')}</a>
  <h1 class="text-2xl font-semibold">{$t('guild.settings_title')}</h1>

  <!-- Prefixe -->
  <Card class="p-5">
    <h2 class="mb-1 text-base font-semibold">{$t('guild.prefixes')}</h2>
    <p class="mb-3 text-xs text-muted-foreground">{$t('guild.prefixes_hint', { prefixes: data.settings.global_prefixes.join(' ') })}</p>
    <div class="mb-3 flex flex-wrap gap-2">
      {#each prefixes as p (p)}
        <span class="inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-1 text-sm">
          <code>{p}</code><button type="button" class="text-muted-foreground hover:text-destructive" on:click={() => removePrefix(p)}>✕</button>
        </span>
      {/each}
    </div>
    <div class="flex gap-2">
      <input bind:value={newPrefix} on:keydown={(e) => e.key === 'Enter' && addPrefix()} placeholder={$t('guild.add_prefix')} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
      <button type="button" class="rounded-md border border-border px-3 py-1.5 text-sm" on:click={addPrefix}>+</button>
      <button type="button" class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy === 'prefixes'} on:click={() => save('prefixes', prefixes)}>{$t('common.save')}</button>
    </div>
    {#if note['prefixes']}<p class="mt-2 text-sm text-muted-foreground">{note['prefixes']}</p>{/if}
  </Card>

  <!-- Nickname -->
  <Card class="p-5">
    <h2 class="mb-1 text-base font-semibold">{$t('guild.nickname_title')}</h2>
    <div class="flex gap-2">
      <input bind:value={nickname} placeholder={$t('guild.nickname_placeholder')} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
      <button type="button" class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy === 'nickname'} on:click={() => save('nickname', nickname)}>{$t('common.save')}</button>
    </div>
    {#if note['nickname']}<p class="mt-2 text-sm text-muted-foreground">{note['nickname']}</p>{/if}
  </Card>

  <!-- Admin-Rollen -->
  <Card class="p-5">
    <h2 class="mb-1 text-base font-semibold">{$t('guild.admin_roles')}</h2>
    <div class="mb-3 flex flex-wrap gap-2">
      {#each adminRoles as id (id)}
        <span class="inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-1 text-sm">
          {roleName(id)}<button type="button" class="text-muted-foreground hover:text-destructive" on:click={() => rmAdmin(id)}>✕</button>
        </span>
      {:else}
        <span class="text-sm text-muted-foreground">{$t('common.none_selected')}</span>
      {/each}
    </div>
    <div class="flex gap-2">
      <select bind:value={adminSel} on:change={addAdmin} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm">
        <option value="">{$t('common.add_role')}</option>
        {#each availAdmin as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
      </select>
      <button type="button" class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy === 'admin_roles'} on:click={() => save('admin_roles', adminRoles)}>{$t('common.save')}</button>
    </div>
    {#if note['admin_roles']}<p class="mt-2 text-sm text-muted-foreground">{note['admin_roles']}</p>{/if}
  </Card>

  <!-- Mod-Rollen -->
  <Card class="p-5">
    <h2 class="mb-1 text-base font-semibold">{$t('guild.mod_roles')}</h2>
    <div class="mb-3 flex flex-wrap gap-2">
      {#each modRoles as id (id)}
        <span class="inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-1 text-sm">
          {roleName(id)}<button type="button" class="text-muted-foreground hover:text-destructive" on:click={() => rmMod(id)}>✕</button>
        </span>
      {:else}
        <span class="text-sm text-muted-foreground">{$t('common.none_selected')}</span>
      {/each}
    </div>
    <div class="flex gap-2">
      <select bind:value={modSel} on:change={addMod} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm">
        <option value="">{$t('common.add_role')}</option>
        {#each availMod as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
      </select>
      <button type="button" class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy === 'mod_roles'} on:click={() => save('mod_roles', modRoles)}>{$t('common.save')}</button>
    </div>
    {#if note['mod_roles']}<p class="mt-2 text-sm text-muted-foreground">{note['mod_roles']}</p>{/if}
  </Card>

  <!-- Embeds -->
  <Card class="p-5">
    <h2 class="mb-1 text-base font-semibold">{$t('guild.embeds_title')}</h2>
    <div class="flex items-center gap-2">
      <select bind:value={embeds} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
        <option value="inherit">{$t('guild.embeds_inherit')}</option>
        <option value="on">{$t('guild.embeds_on')}</option>
        <option value="off">{$t('guild.embeds_off')}</option>
      </select>
      <button type="button" class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy === 'embeds'} on:click={() => save('embeds', embedsValue())}>{$t('common.save')}</button>
    </div>
    {#if note['embeds']}<p class="mt-2 text-sm text-muted-foreground">{note['embeds']}</p>{/if}
  </Card>
</div>
