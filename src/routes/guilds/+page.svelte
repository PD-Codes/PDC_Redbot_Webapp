<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';
  export let data: {
    guilds: Array<{ id: string; name: string; icon: string | null; member_count: number; level: number }>;
    online: boolean;
  };

  const levelKey: Record<number, string> = {
    1: 'guilds.level_member',
    2: 'guilds.level_mod',
    3: 'guilds.level_admin',
    4: 'guilds.level_owner',
    5: 'guilds.level_bot_owner'
  };
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-semibold">{$t('guilds.title')}</h1>

  {#if !data.online}
    <Card class="border-destructive/50 p-4"><p class="text-sm text-destructive">{$t('common.gateway_offline')}</p></Card>
  {:else if data.guilds.length === 0}
    <p class="text-sm text-muted-foreground">{$t('guilds.no_access')}</p>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.guilds as g (g.id)}
        <a href={`/guilds/${g.id}`} class="block">
          <Card class="flex items-center gap-3 p-4 transition hover:border-primary/50">
            {#if g.icon}
              <img src={g.icon} alt="" class="h-12 w-12 rounded-full" />
            {:else}
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                {g.name.slice(0, 2).toUpperCase()}
              </div>
            {/if}
            <div class="min-w-0">
              <p class="truncate font-medium">{g.name}</p>
              <p class="text-xs text-muted-foreground">
                {$t('guilds.members_level', { count: g.member_count, level: levelKey[g.level] ? $t(levelKey[g.level]) : '—' })}
              </p>
            </div>
          </Card>
        </a>
      {/each}
    </div>
  {/if}
</div>
