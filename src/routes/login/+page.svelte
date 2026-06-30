<script lang="ts">
  import { t } from '$lib/i18n';
</script>

<div class="flex min-h-[70vh] items-center justify-center">
  <div class="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-lg">
    <h1 class="text-2xl font-bold">{$t('app.title')}</h1>
    <p class="mt-2 text-sm text-muted-foreground">{$t('login.subtitle')}</p>
    <a
      href="/auth/login"
      class="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#5865F2] px-4 py-2.5 font-medium text-white hover:opacity-90"
    >
      {$t('login.with_discord')}
    </a>
    <a href="/demo" class="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground">
      {$t('login.view_demo')}
    </a>
  </div>
</div>
