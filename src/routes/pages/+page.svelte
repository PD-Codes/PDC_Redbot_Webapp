<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { invalidateAll } from '$app/navigation';
  import { renderMarkdown } from '$lib/markdown';
  import { t } from '$lib/i18n';

  export let data: {
    pages: Array<{ slug: string; title: string; nav: boolean; visibility?: string }>;
    isOwner: boolean;
  };

  let slug = '';
  let title = '';
  let nav = true;
  let visibility = 'public';
  let markdown = '';
  let busy = false;
  let msg = '';
  let showPreview = false;

  async function api(action: string, body: Record<string, unknown>) {
    const res = await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...body })
    });
    return res.json();
  }

  function newPage() {
    slug = '';
    title = '';
    nav = true;
    visibility = 'public';
    markdown = $t('pages.default_content');
    msg = '';
  }

  async function edit(s: string) {
    msg = '';
    const j = await api('pages_get', { slug: s });
    if (j.page) {
      slug = j.page.slug;
      title = j.page.title;
      nav = j.page.nav ?? true;
      visibility = j.page.visibility ?? 'public';
      // Markdown bevorzugt; Legacy-HTML wird als Rohtext zum Weiterbearbeiten gezeigt.
      markdown = j.page.markdown ?? j.page.html ?? '';
    }
  }

  async function save() {
    busy = true;
    msg = '';
    const j = await api('pages_save', { slug, title, markdown, nav, visibility });
    busy = false;
    msg = j.error ? '✗ ' + j.error : '✓ ' + $t('common.saved');
    if (!j.error) await invalidateAll();
  }

  async function del(s: string) {
    const j = await api('pages_delete', { slug: s });
    if (!j.error) {
      if (s === slug) newPage();
      await invalidateAll();
    }
  }

  $: previewHtml = renderMarkdown(markdown);
</script>

<div class="mx-auto max-w-4xl space-y-6">
  <h1 class="text-2xl font-semibold">{$t('pages.title')}</h1>

  {#if !data.isOwner}
    <Card class="p-4"><p class="text-sm text-muted-foreground">{$t('pages.owner_only')}</p></Card>
  {:else}
    <div class="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
      <!-- Liste -->
      <aside class="space-y-2">
        <button type="button" class="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" on:click={newPage}>{$t('pages.new_page')}</button>
        {#each data.pages as p (p.slug)}
          <Card class="flex items-center justify-between p-2">
            <button type="button" class="flex min-w-0 items-center gap-1 text-left text-sm hover:underline" on:click={() => edit(p.slug)}>
              <span class="truncate">{p.title}</span>
              {#if p.visibility === 'private'}<span title={$t('pages.private')}>🔒</span>{/if}
            </button>
            <div class="flex items-center gap-2">
              <a href={`/p/${p.slug}`} class="text-xs text-muted-foreground hover:text-foreground" title={$t('pages.view')}>↗</a>
              <button type="button" class="text-xs text-destructive" on:click={() => del(p.slug)}>✕</button>
            </div>
          </Card>
        {/each}
      </aside>

      <!-- Editor -->
      <div class="min-w-0 space-y-3">
        <div class="flex flex-wrap gap-2">
          <input bind:value={title} placeholder={$t('pages.field_title')} class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
          <input bind:value={slug} placeholder={$t('pages.field_slug')} class="w-40 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <label class="flex items-center gap-1.5 text-sm"><input type="checkbox" bind:checked={nav} class="chb-main" /> {$t('pages.in_navigation')}</label>
          <label class="flex items-center gap-1.5 text-sm">
            {$t('pages.visibility')}
            <select bind:value={visibility} class="rounded-md border border-input bg-background px-2 py-1 text-sm">
              <option value="public">{$t('pages.public')}</option>
              <option value="private">{$t('pages.private_logged_in')}</option>
            </select>
          </label>
          <button type="button" class="text-sm text-muted-foreground hover:text-foreground" on:click={() => (showPreview = !showPreview)}>
            {showPreview ? $t('pages.editor') : $t('pages.preview')}
          </button>
        </div>

        <p class="text-xs text-muted-foreground">{$t('pages.markdown_help')}</p>

        {#if showPreview}
          <div class="prose min-h-[300px] max-w-none rounded-md border border-border bg-background p-4 text-sm">
            {@html previewHtml}
          </div>
        {:else}
          <textarea
            bind:value={markdown}
            class="min-h-[300px] w-full rounded-md border border-border bg-background p-4 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={$t('pages.editor_placeholder')}
          ></textarea>
        {/if}

        <div class="flex items-center gap-3">
          <button type="button" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy} on:click={save}>{$t('common.save')}</button>
          {#if msg}<span class="text-sm text-muted-foreground">{msg}</span>{/if}
        </div>
      </div>
    </div>
  {/if}
</div>
