<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';

  const importCode = `# Variant B (decoupled): copy dropin.py as pdc_dashboard.py into your cog
from .pdc_dashboard import (
    dashboard_widget, dashboard_panel,
    WidgetData, PanelSchema, Field, SubmitResult,
    register_dashboard, unregister_dashboard,
)

# Variant A (direct), if pdc_webdashboard is installed anyway:
from pdc_webdashboard.integration import (
    dashboard_widget, dashboard_panel,
    WidgetData, PanelSchema, Field, SubmitResult,
    register_dashboard, unregister_dashboard,
)`;

  const widgetCode = `@dashboard_widget("member_count", "Members", size="sm",
                  refresh=60, permission="guild_member")
async def member_count(self, ctx):
    return WidgetData.kpi(value=ctx.guild.member_count,
                          label="Members", icon="users")`;

  const panelCode = `@dashboard_panel("welcome", "Welcome message",
                 mount="guild_settings", permission="guild_admin")
async def welcome_panel(self, ctx):
    cfg = await self.config.guild(ctx.guild).welcome()
    return PanelSchema(fields=[
        Field.switch("enabled", "Enabled", value=cfg["enabled"]),
        Field.textarea("message", "Message", value=cfg["message"], max_length=2000),
        Field.channel("channel", "Channel", value=cfg["channel"]),
    ])

@welcome_panel.on_submit
async def save_welcome(self, ctx, data):
    await self.config.guild(ctx.guild).welcome.set(data)
    return SubmitResult.ok("Saved.")`;

  const registerCode = `async def cog_load(self):
    # ... your existing logic ...
    register_dashboard(self)     # integrates ONLY if WebDashboard is loaded

def cog_unload(self):
    unregister_dashboard(self)   # safe even if nothing was registered`;

  const levels = [
    'authenticated', 'guild_member', 'guild_mod', 'guild_admin', 'guild_owner', 'bot_owner'
  ];
</script>

<div class="prose-none max-w-3xl space-y-6">
  <div>
    <h1 class="text-2xl font-semibold">{$t('docs_integration.title')}</h1>
    <p class="mt-2 text-sm text-muted-foreground">{$t('docs_integration.intro')}</p>
  </div>

  <Card class="p-5">
    <h2 class="mb-2 text-lg font-semibold">{$t('docs_integration.principles_title')}</h2>
    <ul class="list-disc space-y-1 pl-5 text-sm">
      <li>{@html $t('docs_integration.principle_1')}</li>
      <li>{@html $t('docs_integration.principle_2')}</li>
      <li>{@html $t('docs_integration.principle_3')}</li>
      <li>{@html $t('docs_integration.principle_4')}</li>
    </ul>
  </Card>

  <Card class="p-5">
    <h2 class="mb-2 text-lg font-semibold">{$t('docs_integration.step1_title')}</h2>
    <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>{importCode}</code></pre>
  </Card>

  <Card class="p-5">
    <h2 class="mb-2 text-lg font-semibold">{$t('docs_integration.step2_title')}</h2>
    <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>{widgetCode}</code></pre>
    <p class="mt-3 text-sm text-muted-foreground">{@html $t('docs_integration.step2_note')}</p>
  </Card>

  <Card class="p-5">
    <h2 class="mb-2 text-lg font-semibold">{$t('docs_integration.step3_title')}</h2>
    <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>{panelCode}</code></pre>
    <p class="mt-3 text-sm text-muted-foreground">{$t('docs_integration.step3_note')}</p>
  </Card>

  <Card class="p-5">
    <h2 class="mb-2 text-lg font-semibold">{$t('docs_integration.step4_title')}</h2>
    <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>{registerCode}</code></pre>
  </Card>

  <Card class="p-5">
    <h2 class="mb-2 text-lg font-semibold">{$t('docs_integration.perms_title')}</h2>
    <div class="flex flex-wrap gap-2">
      {#each levels as l}
        <span class="rounded-full border border-border px-3 py-1 text-xs">{l}</span>
      {/each}
    </div>
    <p class="mt-3 text-sm text-muted-foreground">{$t('docs_integration.perms_note')}</p>
  </Card>

  <p class="text-sm text-muted-foreground">{@html $t('docs_integration.footer')}</p>
</div>
