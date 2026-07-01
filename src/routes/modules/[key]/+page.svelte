<script lang="ts">
  import PageRenderer from '$lib/components/PageRenderer.svelte';
  import { locale } from '$lib/i18n';

  export let data: {
    key: string;
    guildId: string | null;
    name: string;
    icon: string | null;
    schema: { components?: unknown[]; controls?: Array<{ id: string; value: string | null }> } | null;
  };

  let schema = data.schema;
  let busy = false;
  // Current control values (sent back to the handler on every change).
  let values: Record<string, string> = Object.fromEntries(
    (data.schema?.controls ?? []).map((c) => [c.id, c.value ?? ''])
  );

  async function onControl(id: string, value: string) {
    values = { ...values, [id]: value };
    busy = true;
    try {
      const res = await fetch('/api/page', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: data.key, params: values, guildId: data.guildId, locale: $locale })
      });
      const j = await res.json();
      if (!j.error) schema = j.schema;
    } finally {
      busy = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-semibold">{data.name}</h1>
    {#if data.guildId}
      <a href={`/guilds/${data.guildId}`} class="text-sm text-muted-foreground hover:text-foreground">←</a>
    {/if}
  </div>
  <PageRenderer {schema} {busy} {onControl} guildId={data.guildId} />
</div>
