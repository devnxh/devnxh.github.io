import { DEFAULT_LANG, LANGS, type Lang } from '../site.config';
import { dictionaries, type UiKey } from './ui';

export { DEFAULT_LANG, LANGS, type Lang, type UiKey };

/** `t('writeup.minutes', { n: 9 })` → "9 min read" */
export type Translate = (key: UiKey, values?: Record<string, string | number>) => string;

export function useTranslations(lang: Lang): Translate {
  return (key, values) => {
    let text: string = dictionaries[lang][key];
    for (const [name, value] of Object.entries(values ?? {})) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  };
}

/** Picks the `.one` or `.many` form of a counted string. */
export function plural(t: Translate, base: 'projects.count' | 'writeups.count' | 'tags.count' | 'search.results', n: number): string {
  return t(`${base}.${n === 1 ? 'one' : 'many'}` as UiKey, { n });
}

/** Route param `lang` is `undefined` for English and `de` for German. */
export function langFromParam(param: string | undefined): Lang {
  return param === 'de' ? 'de' : 'en';
}

/** The `[...lang]` route param for a language. */
export function langParam(lang: Lang): string | undefined {
  return lang === DEFAULT_LANG ? undefined : lang;
}

/** `/projects/` → `/de/projects/` for German, unchanged for English. */
export function localise(path: string, lang: Lang): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return lang === DEFAULT_LANG ? clean : `/${lang}${clean}`;
}

/** The same page in another language, for the EN | DE switch and hreflang. */
export function switchLang(pathname: string, to: Lang): string {
  const withoutPrefix = pathname.replace(/^\/de(?=\/|$)/, '') || '/';
  return localise(withoutPrefix, to);
}

const LOCALES: Record<Lang, string> = { en: 'en-GB', de: 'de-DE' };

export function formatDate(date: Date, lang: Lang, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** `2026-11-20`, for `<time datetime>` and for index rows. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALES[lang]).format(value);
}

export function staticLangPaths(): Array<{ params: { lang: string | undefined } }> {
  return LANGS.map((lang) => ({ params: { lang: langParam(lang) } }));
}
