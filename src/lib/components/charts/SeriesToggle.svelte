<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let series: Array<{ label: string; color: string; hidden: boolean }> = [];

  const dispatch = createEventDispatcher<{ toggle: number }>();

  function toggle(i: number) {
    dispatch('toggle', i);
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each series as s, i (s.label)}
    <button
      type="button"
      on:click={() => toggle(i)}
      class="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs transition
        {s.hidden ? 'opacity-50' : 'bg-secondary/40'}"
    >
      <span class="h-2.5 w-2.5 rounded-full" style="background:{s.color}"></span>
      <span class={s.hidden ? 'line-through text-muted-foreground' : 'text-foreground'}>{s.label}</span>
    </button>
  {/each}
</div>
