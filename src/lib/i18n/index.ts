import { derived, writable } from 'svelte/store';
import de from './de.json';
import en from './en.json';

type Dict = Record<string, string>;
const dicts: Record<string, Dict> = { 'de-DE': de, 'en-US': en };

export const locale = writable<string>('de-DE');

export const t = derived(locale, ($locale) => {
  const dict = dicts[$locale] ?? dicts['en-US'];
  return (key: string, vars?: Record<string, string | number>) => {
    let str = dict[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
    return str;
  };
});

export function setLocale(l: string) {
  locale.set(l);
  if (typeof localStorage !== 'undefined') localStorage.setItem('locale', l);
  // Also persist as a cookie so server-side loads (e.g. the cog manifest) can
  // localize module names/descriptions to the chosen UI language.
  if (typeof document !== 'undefined') {
    document.cookie = `locale=${encodeURIComponent(l)};path=/;max-age=31536000;samesite=lax`;
  }
}
