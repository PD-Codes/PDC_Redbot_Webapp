<script lang="ts">
  import { toasts, dismissToast } from '$lib/stores/toasts';

  function tone(kind: string): string {
    if (kind === 'error') return 'border-destructive/60 bg-destructive/10 text-destructive';
    if (kind === 'success') return 'border-emerald-500/60 bg-emerald-500/10 text-emerald-500';
    return 'border-border bg-card text-foreground';
  }
</script>

{#if $toasts.length}
  <div class="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
    {#each $toasts as toast (toast.id)}
      <div
        class="pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur {tone(toast.kind)}"
        role="alert"
      >
        <span class="min-w-0 flex-1 break-words">{toast.message}</span>
        <button
          type="button"
          class="shrink-0 opacity-60 hover:opacity-100"
          aria-label="Dismiss"
          on:click={() => dismissToast(toast.id)}
        >✕</button>
      </div>
    {/each}
  </div>
{/if}
