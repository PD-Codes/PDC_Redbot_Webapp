<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { t } from '$lib/i18n';

  const base = 'https://github.com/PD-Codes/PDC_Redbot_Webapp/blob/main/documents';
  const policies = [
    { label: 'Privacy Policy', href: `${base}/Privacy%20Policy.md` },
    { label: 'Cookie Policy', href: `${base}/Cookie%20Policy.md` },
    { label: 'Third Parties Disclaimer', href: `${base}/Third%20Parties%20Disclaimer.md` }
  ];
</script>

<div class="prose-none max-w-3xl space-y-6">
  <div>
    <h1 class="text-2xl font-semibold">{$t('credits.title')}</h1>
    <p class="mt-2 text-sm text-muted-foreground">{$t('credits.intro')}</p>
  </div>

  <Card class="p-5">
    <div class="space-y-4 text-sm">
      <p>
        The <strong>PDC Redbot Webapp</strong> was built from scratch by
        <strong>pd-codes</strong>, licensed under the
        <strong>GNU General Public License v3.0</strong>.
      </p>
      <p>
        Inspired by the original Red-DiscordBot Dashboard by
        <strong>Neuro Assassin#4779</strong> and <strong>AAA3A</strong>.
      </p>
      <p>
        Built for <strong>Red-DiscordBot</strong> — a multifunctional, fully modular
        Discord bot — created by <strong>Twentysix</strong> and made great by many.
        Red-DiscordBot is licensed under the
        <strong>GNU General Public License v3.0</strong>.
      </p>
    </div>
  </Card>

  <Card class="p-5">
    <h2 class="mb-3 text-lg font-semibold">{$t('credits.policies_title')}</h2>
    <ul class="list-disc space-y-1 pl-5 text-sm">
      {#each policies as p}
        <li>
          <a
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline-offset-2 hover:underline"
          >
            {p.label}
          </a>
        </li>
      {/each}
    </ul>
    <p class="mt-3 text-xs text-muted-foreground">{$t('credits.policies_note')}</p>
  </Card>
</div>
