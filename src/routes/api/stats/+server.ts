import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

const METHODS: Record<string, string> = {
  overview: 'serverstats.overview',
  messages: 'serverstats.messages',
  voice: 'serverstats.voice',
  status: 'serverstats.status',
  invites: 'serverstats.invites',
  activity: 'serverstats.activity',
  commands: 'serverstats.commands',
  member_drilldown: 'serverstats.member_drilldown',
  channel_drilldown: 'serverstats.channel_drilldown',
  heatmap: 'serverstats.heatmap',
  peaks: 'serverstats.peaks',
  now: 'serverstats.now',
  leaderboard: 'serverstats.leaderboard',
  retention: 'serverstats.retention'
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const { section, guildId, days, member_id, channel_id, metric } = await request.json();
  const method = METHODS[section];
  if (!method) return json({ error: 'unknown section' }, { status: 400 });
  if (!guildId) return json({ error: 'guildId missing' }, { status: 400 });
  const auth = authFromUser(locals.user, guildId);
  try {
    return json(await rpc(method, { days, member_id, channel_id, metric }, auth));
  } catch (e) {
    console.error(`[api/stats] section "${section}" failed:`, e);
    return json({ error: e instanceof RpcError ? e.message : 'Error' }, { status: 502 });
  }
};
