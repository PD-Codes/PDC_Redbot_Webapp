<script lang="ts">
  // Reusable confirmation modal for destructive actions.
  // Controlled via `open` (bindable). Calls `onConfirm` when the user confirms.
  import { t } from '$lib/i18n';
  import { onDestroy } from 'svelte';

  export let open = false;
  export let title = '';
  export let message = '';
  export let confirmLabel = '';
  export let danger = true;
  export let onConfirm: () => void = () => {};

  function close() {
    open = false;
  }
  function confirm() {
    open = false;
    onConfirm();
  }
  function onKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'Enter') confirm();
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKey);
    onDestroy(() => window.removeEventListener('keydown', onKey));
  }
</script>

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="presentation"
    on:click|self={close}
  >
    <div class="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl" role="dialog" aria-modal="true">
      {#if title}<h2 class="mb-2 text-lg font-semibold">{title}</h2>{/if}
      <p class="mb-5 whitespace-pre-wrap text-sm text-muted-foreground">{message}</p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
          on:click={close}>{$t('common.cancel')}</button>
        <button
          type="button"
          class="rounded-md px-4 py-2 text-sm font-medium text-white {danger
            ? 'bg-destructive hover:bg-destructive/90'
            : 'bg-primary hover:bg-primary/90'}"
          on:click={confirm}>{confirmLabel || $t('common.confirm')}</button>
      </div>
    </div>
  </div>
{/if}
