<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';

  export let data: {
    guildId: string;
    hasPublic: boolean;
    title: string;
    html: string;
    subPages: Array<{ slug: string; title: string }>;
    guild: { name: string; icon: string | null; member_count: number | null } | null;
    gatewayOffline: boolean;
    optInSlug: string;
    isLoggedIn: boolean;
  };
</script>

<svelte:head>
  <title>{data.hasPublic ? data.title : $t('public.title')}</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-4 py-4">
  <a href="/" class="text-sm text-muted-foreground hover:text-foreground">← {$t('public.back')}</a>

  {#if data.guild}
    <!-- Live guild header: only visible to logged-in members (gateway-gated). -->
    <Card class="flex items-center gap-4 p-4">
      {#if data.guild.icon}
        <img src={data.guild.icon} alt="" class="h-14 w-14 rounded-full" />
      {/if}
      <div>
        <h1 class="text-xl font-semibold">{data.guild.name}</h1>
        {#if data.guild.member_count != null}
          <p class="text-sm text-muted-foreground">
            {$t('public.member_count', { n: data.guild.member_count })}
          </p>
        {/if}
      </div>
    </Card>
  {/if}

  {#if data.hasPublic}
    {#if !data.guild}
      <h1 class="text-2xl font-semibold">{data.title}</h1>
    {:else}
      <h2 class="text-lg font-semibold">{data.title}</h2>
    {/if}
    <div class="prose max-w-none text-sm leading-relaxed">
      <!-- eslint-disable-next-line svelte/no-at-html-tags — server-rendered, escaped markdown -->
      {@html data.html}
    </div>

    {#if data.subPages.length}
      <div class="pt-2">
        <p class="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {$t('public.more_pages')}
        </p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {#each data.subPages as sp (sp.slug)}
            <a
              href={`/p/${sp.slug}`}
              class="rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
            >
              {sp.title} →
            </a>
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <Card class="space-y-2 p-6 text-center">
      <p class="text-lg font-medium">{$t('public.nothing')}</p>
      <p class="text-sm text-muted-foreground">
        {#if data.gatewayOffline}
          {$t('common.gateway_offline')}
        {:else}
          {$t('public.nothing_hint')}
        {/if}
      </p>
      {#if data.isLoggedIn && !data.gatewayOffline}
        <!-- Only shown to logged-in users: how an owner enables this showcase. -->
        <p class="text-xs text-muted-foreground">
          {$t('public.opt_in_hint', { slug: data.optInSlug })}
        </p>
      {/if}
    </Card>
  {/if}
</div>
