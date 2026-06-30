<script lang="ts">
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';

  export let user: { username: string } | null = null;
  export let pages: Array<{ slug: string; title: string; nav: boolean; visibility: string }> = [];

  let open = false;
  let query = '';
  let active = 0;
  let inputEl: HTMLInputElement;

  type Item = { label: string; href: string };

  $: base = [
    { label: $t('nav.overview'), href: '/' },
    { label: $t('nav.commands'), href: '/commands' },
    ...(user
      ? [
          { label: $t('nav.guilds'), href: '/guilds' },
          { label: $t('nav.stats'), href: '/stats' },
          { label: $t('nav.cogs'), href: '/cogs' },
          { label: $t('nav.settings'), href: '/settings' },
          { label: $t('nav.pages'), href: '/pages' },
          { label: $t('nav.audit'), href: '/audit' },
          { label: $t('nav.system'), href: '/system' }
        ]
      : []),
    ...pages
      .filter((p) => p.nav && (p.visibility === 'public' || user))
      .map((p) => ({ label: p.title, href: `/p/${p.slug}` }))
  ] as Item[];

  $: items = query.trim()
    ? base.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()))
    : base;
  $: if (active >= items.length) active = 0;

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open = !open;
      query = '';
      active = 0;
      if (open) setTimeout(() => inputEl?.focus(), 0);
    } else if (open && e.key === 'Escape') {
      open = false;
    }
  }

  function onListKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(items[active]);
    }
  }

  function select(it: Item | undefined) {
    if (!it) return;
    open = false;
    goto(it.href);
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
    on:click={(e) => {
      if (e.target === e.currentTarget) open = false;
    }}
    role="presentation"
  >
    <div
      class="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-xl"
      role="dialog"
      aria-modal="true"
    >
      <input
        bind:this={inputEl}
        bind:value={query}
        on:keydown={onListKey}
        placeholder={$t('palette.placeholder')}
        class="w-full border-b border-border bg-transparent px-4 py-3 text-sm focus:outline-none"
      />
      <ul class="max-h-72 overflow-y-auto py-1">
        {#each items as it, i (it.href)}
          <li>
            <button
              type="button"
              class="flex w-full items-center justify-between px-4 py-2 text-left text-sm {i === active
                ? 'bg-secondary'
                : 'hover:bg-secondary/50'}"
              on:mouseenter={() => (active = i)}
              on:click={() => select(it)}
            >
              <span>{it.label}</span>
              <span class="text-xs text-muted-foreground">{it.href}</span>
            </button>
          </li>
        {:else}
          <li class="px-4 py-3 text-sm text-muted-foreground">{$t('palette.empty')}</li>
        {/each}
      </ul>
    </div>
  </div>
{/if}
