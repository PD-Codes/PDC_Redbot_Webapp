<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';
  import { renderMarkdown } from '$lib/markdown';
  import type { AnnounceGuild } from './+page.server';

  export let data: { guilds: AnnounceGuild[] };

  let guildId = data.guilds[0]?.id ?? '';
  let channels: Array<{ id: string; name: string; can_send: boolean }> = [];
  let channelId = '';

  let content = '';
  let title = '';
  let description = '';
  let color = '#5865F2';
  let footer = '';
  let author = '';
  let imageUrl = '';

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

  $: hasEmbed = !!(title || description || footer || author || imageUrl);

  async function send() {
    busy = true;
    msg = '';
    const embed = hasEmbed
      ? { title, description, color, footer, author, image_url: imageUrl }
      : undefined;
    const j = await api('send', { channel_id: channelId, content, embed });
    busy = false;
    msg = j.error ? '✗ ' + j.error : '✓ ' + $t('announce.sent');
  }

  // Discord erhält einzelne Zeilenumbrüche → softBreaks, damit die Vorschau passt.
  $: previewDesc = renderMarkdown(description, { softBreaks: true });
</script>

<div class="mx-auto max-w-5xl space-y-6">
  <h1 class="text-2xl font-semibold">{$t('announce.title')}</h1>

  {#if data.guilds.length === 0}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('announce.no_admin')}</p></Card>
  {:else}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Editor -->
      <Card class="space-y-3 p-5">
        <div class="flex flex-wrap gap-2">
          <select bind:value={guildId} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm">
            {#each data.guilds as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
          </select>
          <select bind:value={channelId} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm">
            {#each channels as c (c.id)}<option value={c.id} disabled={!c.can_send}>#{c.name}{c.can_send ? '' : ' 🔒'}</option>{/each}
          </select>
        </div>

        <div>
          <label class="text-xs font-medium" for="a-content">{$t('announce.content')}</label>
          <textarea id="a-content" bind:value={content} rows="2" class="w-full rounded-md border border-input bg-background p-2 text-sm"></textarea>
        </div>

        <p class="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('announce.embed')}</p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input bind:value={title} placeholder={$t('announce.f_title')} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
          <input bind:value={author} placeholder={$t('announce.f_author')} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label class="text-xs font-medium" for="a-desc">{$t('announce.f_desc')}</label>
          <textarea id="a-desc" bind:value={description} rows="4" class="w-full rounded-md border border-input bg-background p-2 text-sm"></textarea>
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input bind:value={footer} placeholder={$t('announce.f_footer')} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
          <input bind:value={imageUrl} placeholder={$t('announce.f_image')} class="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        </div>
        <label class="flex items-center gap-2 text-sm">
          {$t('announce.f_color')}
          <input type="color" bind:value={color} class="h-7 w-12 rounded border border-input bg-background" />
        </label>

        <div class="flex items-center gap-3 pt-1">
          <button type="button" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy || !channelId} on:click={send}>
            {busy ? '…' : $t('announce.send')}
          </button>
          {#if msg}<span class="text-sm text-muted-foreground">{msg}</span>{/if}
        </div>
      </Card>

      <!-- Vorschau (Discord-ähnlich) -->
      <div class="space-y-2">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{$t('announce.preview')}</p>
        <div class="rounded-lg bg-[#313338] p-4 text-sm text-[#dbdee1]">
          {#if content}<p class="mb-2 whitespace-pre-wrap">{content}</p>{/if}
          {#if hasEmbed}
            <div class="overflow-hidden rounded border-l-4 bg-[#2b2d31]" style={`border-color:${color}`}>
              <div class="space-y-1 p-3">
                {#if author}<p class="text-xs font-semibold">{author}</p>{/if}
                {#if title}<p class="font-semibold text-white">{title}</p>{/if}
                {#if description}<div class="prose prose-invert max-w-none text-sm">{@html previewDesc}</div>{/if}
                {#if imageUrl}<img src={imageUrl} alt="" class="mt-2 max-h-60 rounded" />{/if}
                {#if footer}<p class="pt-1 text-xs text-[#a3a6aa]">{footer}</p>{/if}
              </div>
            </div>
          {/if}
          {#if !content && !hasEmbed}<p class="text-[#a3a6aa]">{$t('announce.preview_empty')}</p>{/if}
        </div>
      </div>
    </div>
  {/if}
</div>
