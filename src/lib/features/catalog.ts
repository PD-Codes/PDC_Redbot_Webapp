/**
 * Static feature catalog metadata for known PDC cogs.
 * Titles/descriptions live in i18n (features.cog.<key>.title / .desc);
 * this map only carries the emoji icon and the "replaces X bot" hint.
 * Cogs not listed here still show up (generic fallback) if they expose
 * dashboard contributions, so nothing is hidden by accident.
 */
export interface FeatureMeta {
  /** Canonical catalog key (matches the cog package name). */
  key: string;
  /** Emoji shown on the feature card. */
  emoji: string;
  /** Well-known bot(s) this module replaces (shown as a hint badge). */
  replaces?: string;
}

export const FEATURE_CATALOG: FeatureMeta[] = [
  { key: 'leveling', emoji: '📈', replaces: 'MEE6 / Arcane' },
  { key: 'tempvoice', emoji: '🔊', replaces: 'VoiceMaster' },
  { key: 'tickets', emoji: '🎫', replaces: 'Ticket Tool' },
  { key: 'starboard', emoji: '⭐' },
  { key: 'suggestions', emoji: '💡' },
  { key: 'livealerts', emoji: '📺', replaces: 'Streamcord / Notifier' },
  { key: 'automodplus', emoji: '🛡️', replaces: 'Wick' },
  { key: 'giveaway', emoji: '🎉', replaces: 'GiveawayBot' },
  { key: 'birthday', emoji: '🎂' },
  { key: 'reactionrole', emoji: '🎭', replaces: 'Carl-bot' },
  { key: 'scheduledmsg', emoji: '⏰' },
  { key: 'socialfeed', emoji: '📰', replaces: 'MonitoRSS' },
  { key: 'statchannels', emoji: '📊', replaces: 'ServerStats' },
  { key: 'eventlog', emoji: '📋' },
  { key: 'eventmessages', emoji: '👋' },
  { key: 'adminutils', emoji: '🧰' },
  { key: 'guildtools', emoji: '🛠️' },
  { key: 'memegen', emoji: '🖼️' },
  { key: 'neko', emoji: '🐱' },
  { key: 'nekoapi', emoji: '🐾' },
  { key: 'channel-join-notification', emoji: '🔔' }
];

/** Normalizes cog/package/class names for matching (e.g. "TempVoice" ≙ "tempvoice",
 * "ChannelJoinNotification" ≙ "channel-join-notification"). */
export function normalizeCogName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const _byNorm = new Map(FEATURE_CATALOG.map((f) => [normalizeCogName(f.key), f]));

/** Looks up catalog metadata for any cog/package/class name spelling. */
export function catalogFor(name: string): FeatureMeta | undefined {
  return _byNorm.get(normalizeCogName(name));
}
