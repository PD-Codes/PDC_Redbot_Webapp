<script lang="ts">
  // html ist serverseitig aus Markdown gerendert und HTML-escaped (XSS-sicher),
  // bzw. vom Bot-Owner verfasstes Legacy-HTML.
  export let data: { page: { slug: string; title: string }; html: string };
</script>

<div class="mx-auto max-w-3xl space-y-4 py-4">
  <a href="/" class="text-sm text-muted-foreground hover:text-foreground">← Zurück</a>
  <h1 class="text-2xl font-semibold">{data.page.title}</h1>
  <div class="prose max-w-none text-sm leading-relaxed">
    {@html data.html}
  </div>
</div>
