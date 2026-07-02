<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';
  import { renderMarkdown } from '$lib/markdown';
  import type { EmbedGuild } from './+page.server';

  export let data: { guilds: EmbedGuild[] };

  interface EmbedField {
    name: string;
    value: string;
    inline: boolean;
  }

  // ----- Composer state ---------------------------------------------------- //
  let content = '';
  let title = '';
  let description = '';
  let color = '#5865F2';
  let author = '';
  let footer = '';
  let imageUrl = '';
  let thumbUrl = '';
  let fields: EmbedField[] = [];
  let useTimestamp = false;

  const MAX_FIELDS = 10;

  function addField() {
    if (fields.length < MAX_FIELDS) fields = [...fields, { name: '', value: '', inline: false }];
  }
  function removeField(i: number) {
    fields = fields.filter((_, idx) => idx !== i);
  }

  $: hasEmbed = !!(
    title ||
    description ||
    author ||
    footer ||
    imageUrl ||
    thumbUrl ||
    fields.some((f) => f.name || f.value)
  );
  // Parts the gateway's announce.send does NOT deliver (preview/export only).
  $: hasUnsupported = !!(thumbUrl || useTimestamp || fields.some((f) => f.name || f.value));

  // ----- Send panel (reuses /api/announce → announce.channels/announce.send) //
  let guildId = data.guilds[0]?.id ?? '';
  let channels: Array<{ id: string; name: string; can_send: boolean }> = [];
  let channelId = '';
  let busy = false;
  let msg = '';

  async function api(op: string, body: Record<string, unknown>) {
    const res = await fetch('/api/announce', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op, guildId, ...body })
    });
    return res.json();
  }

  async function loadChannels() {
    channels = [];
    channelId = '';
    if (!guildId) return;
    const j = await api('channels', {});
    if (!j.error) {
      channels = j.channels ?? [];
      channelId = channels[0]?.id ?? '';
    }
  }
  $: if (guildId) loadChannels();

  async function send() {
    busy = true;
    msg = '';
    // Gateway payload shape (announce.send): flat strings + hex color.
    const embed = hasEmbed
      ? { title, description, color, footer, author, image_url: imageUrl }
      : undefined;
    const j = await api('send', { channel_id: channelId, content, embed });
    busy = false;
    msg = j.error ? '✗ ' + j.error : '✓ ' + $t('embeds.sent');
  }

  // ----- Export / import (Discord API embed format) ------------------------ //
  let jsonText = '';
  let jsonError = '';

  function toDiscordJson(): Record<string, unknown> {
    const e: Record<string, unknown> = {};
    if (title) e.title = title;
    if (description) e.description = description;
    e.color = parseInt(color.replace('#', ''), 16) || 0;
    if (author) e.author = { name: author };
    if (footer) e.footer = { text: footer };
    if (imageUrl) e.image = { url: imageUrl };
    if (thumbUrl) e.thumbnail = { url: thumbUrl };
    const fs = fields.filter((f) => f.name && f.value);
    if (fs.length) e.fields = fs.map((f) => ({ name: f.name, value: f.value, inline: f.inline }));
    if (useTimestamp) e.timestamp = new Date().toISOString();
    return e;
  }

  function exportJson() {
    jsonError = '';
    jsonText = JSON.stringify(toDiscordJson(), null, 2);
  }

  function importJson() {
    jsonError = '';
    try {
      const raw = JSON.parse(jsonText) as Record<string, unknown>;
      // Accept both a bare embed and { embeds: [ ... ] } message payloads.
      const e = (Array.isArray(raw.embeds) ? raw.embeds[0] : raw) as Record<string, unknown>;
      if (!e || typeof e !== 'object') throw new Error('no embed');
      title = typeof e.title === 'string' ? e.title : '';
      description = typeof e.description === 'string' ? e.description : '';
      color =
        typeof e.color === 'number'
          ? '#' + e.color.toString(16).padStart(6, '0')
          : '#5865F2';
      const a = e.author as { name?: string } | undefined;
      author = typeof a?.name === 'string' ? a.name : '';
      const f = e.footer as { text?: string } | undefined;
      footer = typeof f?.text === 'string' ? f.text : '';
      const img = e.image as { url?: string } | undefined;
      imageUrl = typeof img?.url === 'string' ? img.url : '';
      const th = e.thumbnail as { url?: string } | undefined;
      thumbUrl = typeof th?.url === 'string' ? th.url : '';
      useTimestamp = typeof e.timestamp === 'string' && !!e.timestamp;
      const rawFields = Array.isArray(e.fields) ? e.fields : [];
      fields = rawFields.slice(0, MAX_FIELDS).map((rf: Record<string, unknown>) => ({
        name: typeof rf.name === 'string' ? rf.name : '',
        value: typeof rf.value === 'string' ? rf.value : '',
        inline: !!rf.inline
      }));
    } catch {
      jsonError = $t('embeds.import_invalid');
    }
  }

  // ----- Drafts (localStorage) ---------------------------------------------- //
  const DRAFTS_KEY = 'pdc.embed.drafts';
  interface Draft {
    name: string;
    content: string;
    embed: Record<string, unknown>;
  }
  let drafts: Draft[] = [];
  let draftName = '';

  function readDrafts(): Draft[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const arr = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  function writeDrafts(list: Draft[]) {
    drafts = list;
    if (typeof localStorage !== 'undefined') localStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
  }
  // Initial read runs on the client only (localStorage guard inside).
  drafts = [];
  if (typeof localStorage !== 'undefined') drafts = readDrafts();

  function saveDraft() {
    const name = draftName.trim() || new Date().toLocaleString();
    const d: Draft = { name, content, embed: toDiscordJson() };
    writeDrafts([d, ...drafts.filter((x) => x.name !== name)]);
    draftName = '';
    msg = '✓ ' + $t('embeds.draft_saved');
  }
  function loadDraft(d: Draft) {
    content = d.content ?? '';
    jsonText = JSON.stringify(d.embed ?? {}, null, 2);
    importJson();
  }
  function deleteDraft(d: Draft) {
    writeDrafts(drafts.filter((x) => x !== d));
  }

  // Discord treats single newlines as breaks → softBreaks for a faithful preview.
  $: previewDesc = renderMarkdown(description, { softBreaks: true });
</script>

<div class="mx-auto max-w-6xl space-y-6">
  <h1 class="text-2xl font-semibold">{$t('embeds.title')}</h1>
  <p class="text-sm text-muted-foreground">{$t('embeds.subtitle')}</p>

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <!-- Editor column -->
    <div class="space-y-4">
      <Card class="space-y-3 p-5">
        <div>
          <label class="text-xs font-medium" for="e-content">{$t('embeds.content')}</label>
          <textarea
            id="e-content"
            bind:value={content}
            rows="2"
            class="w-full rounded-md border border-input bg-background p-2 text-sm"
          ></textarea>
        </div>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input bind:value={title} maxlength="256" placeholder={$t('embeds.f_title')} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
          <input bind:value={author} maxlength="256" placeholder={$t('embeds.f_author')} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label class="text-xs font-medium" for="e-desc">{$t('embeds.f_desc')}</label>
          <textarea
            id="e-desc"
            bind:value={description}
            rows="5"
            maxlength="4096"
            class="w-full rounded-md border border-input bg-background p-2 text-sm"
          ></textarea>
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input bind:value={footer} maxlength="2048" placeholder={$t('embeds.f_footer')} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
          <input bind:value={imageUrl} placeholder={$t('embeds.f_image')} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
          <input bind:value={thumbUrl} placeholder={$t('embeds.f_thumb')} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
          <label class="flex items-center gap-2 text-sm">
            {$t('embeds.f_color')}
            <input type="color" bind:value={color} class="h-7 w-12 rounded border border-input bg-background" />
          </label>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={useTimestamp} class="h-4 w-4 rounded border-input" />
          {$t('embeds.timestamp')}
        </label>

        <!-- Fields -->
        <div class="space-y-2 pt-1">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {$t('embeds.fields')} ({fields.length}/{MAX_FIELDS})
            </p>
            <button
              type="button"
              class="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
              disabled={fields.length >= MAX_FIELDS}
              on:click={addField}
            >
              + {$t('embeds.add_field')}
            </button>
          </div>
          {#each fields as f, i (i)}
            <div class="flex items-start gap-2">
              <div class="grid flex-1 grid-cols-1 gap-1 sm:grid-cols-2">
                <input bind:value={f.name} maxlength="256" placeholder={$t('embeds.field_name')} class="rounded-md border border-input bg-background px-2 py-1 text-sm" />
                <input bind:value={f.value} maxlength="1024" placeholder={$t('embeds.field_value')} class="rounded-md border border-input bg-background px-2 py-1 text-sm" />
              </div>
              <label class="flex items-center gap-1 pt-1.5 text-xs" title={$t('embeds.inline')}>
                <input type="checkbox" bind:checked={f.inline} class="h-3.5 w-3.5 rounded border-input" />
                {$t('embeds.inline')}
              </label>
              <button type="button" class="pt-1 text-xs text-muted-foreground hover:text-foreground" title={$t('common.delete')} on:click={() => removeField(i)}>✕</button>
            </div>
          {/each}
        </div>
      </Card>

      <!-- Send panel -->
      <Card class="space-y-3 p-5">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('embeds.send_panel')}</p>
        {#if data.guilds.length === 0}
          <p class="text-sm text-muted-foreground">{$t('embeds.no_admin')}</p>
        {:else}
          <div class="flex flex-wrap gap-2">
            <select bind:value={guildId} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" aria-label={$t('embeds.guild')}>
              {#each data.guilds as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
            </select>
            <select bind:value={channelId} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" aria-label={$t('embeds.channel')}>
              {#each channels as c (c.id)}<option value={c.id} disabled={!c.can_send}>#{c.name}{c.can_send ? '' : ' 🔒'}</option>{/each}
            </select>
          </div>
          {#if hasUnsupported}
            <p class="text-xs text-amber-500">{$t('embeds.gateway_limit_hint')}</p>
          {/if}
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={busy || !channelId || (!content && !hasEmbed)}
              on:click={send}
            >
              {busy ? '…' : $t('embeds.send')}
            </button>
            {#if msg}<span class="text-sm text-muted-foreground">{msg}</span>{/if}
          </div>
        {/if}
      </Card>

      <!-- Drafts + JSON -->
      <Card class="space-y-3 p-5">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('embeds.drafts')}</p>
        <div class="flex gap-2">
          <input bind:value={draftName} placeholder={$t('embeds.draft_name')} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
          <button type="button" class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary" on:click={saveDraft}>{$t('embeds.save_draft')}</button>
        </div>
        {#if drafts.length}
          <ul class="space-y-1">
            {#each drafts as d (d.name)}
              <li class="flex items-center justify-between gap-2 text-sm">
                <span class="truncate">{d.name}</span>
                <span class="flex shrink-0 gap-2">
                  <button type="button" class="text-xs text-muted-foreground hover:text-foreground" on:click={() => loadDraft(d)}>{$t('embeds.load_draft')}</button>
                  <button type="button" class="text-xs text-muted-foreground hover:text-foreground" on:click={() => deleteDraft(d)}>{$t('common.delete')}</button>
                </span>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="flex gap-2 pt-2">
          <button type="button" class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary" on:click={exportJson}>{$t('embeds.export')}</button>
          <button type="button" class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary" on:click={importJson}>{$t('embeds.import')}</button>
        </div>
        <textarea
          bind:value={jsonText}
          rows="6"
          spellcheck="false"
          placeholder={'{ "title": "…" }'}
          class="w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
        ></textarea>
        {#if jsonError}<p class="text-xs text-red-500">{jsonError}</p>{/if}
      </Card>
    </div>

    <!-- Preview column (Discord-style) -->
    <div class="space-y-2">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('embeds.preview')}</p>
      <div class="rounded-lg bg-[#313338] p-4 text-sm text-[#dbdee1]">
        {#if content}<p class="mb-2 whitespace-pre-wrap">{content}</p>{/if}
        {#if hasEmbed}
          <div class="max-w-lg overflow-hidden rounded border-l-4 bg-[#2b2d31]" style={`border-color:${color}`}>
            <div class="flex gap-3 p-3">
              <div class="min-w-0 flex-1 space-y-1">
                {#if author}<p class="text-xs font-semibold">{author}</p>{/if}
                {#if title}<p class="font-semibold text-white">{title}</p>{/if}
                {#if description}
                  <div class="prose prose-invert max-w-none text-sm">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags — renderMarkdown escapes input -->
                    {@html previewDesc}
                  </div>
                {/if}
                {#if fields.some((f) => f.name || f.value)}
                  <div class="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                    {#each fields as f, i (i)}
                      {#if f.name || f.value}
                        <div class={f.inline ? 'min-w-[30%] flex-1' : 'w-full'}>
                          <p class="text-xs font-semibold text-white">{f.name}</p>
                          <p class="whitespace-pre-wrap text-xs">{f.value}</p>
                        </div>
                      {/if}
                    {/each}
                  </div>
                {/if}
                {#if imageUrl}<img src={imageUrl} alt="" class="mt-2 max-h-72 rounded" />{/if}
                {#if footer || useTimestamp}
                  <p class="pt-1 text-xs text-[#a3a6aa]">
                    {footer}{footer && useTimestamp ? ' • ' : ''}{useTimestamp ? new Date().toLocaleString() : ''}
                  </p>
                {/if}
              </div>
              {#if thumbUrl}<img src={thumbUrl} alt="" class="h-20 w-20 shrink-0 rounded object-cover" />{/if}
            </div>
          </div>
        {/if}
        {#if !content && !hasEmbed}<p class="text-[#a3a6aa]">{$t('embeds.preview_empty')}</p>{/if}
      </div>
    </div>
  </div>
</div>
