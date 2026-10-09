// Übersetzungen: t() für Texte, die sofort angezeigt werden, m() für Texte, die im Spielstand oder in der Engine liegen
// und erst beim Anzeigen übersetzt werden (tx()). So wechselt auch gespeicherter Text (News, Buchungen, Ereignisse) die Sprache.
import { GAME_NAME } from '../config';
import { de } from './de';
import { en } from './en';
import { applyFormat } from './format';
import { getLang, type Lang } from './lang';

export { LANGS, LANG_NAMES, LOCALES, detectLang, getLang, normalizeLang, setLang, subscribeLang, useLang, type Lang } from './lang';
export { fmtMoney, fmtNum, fmtPct } from './format';

export type Param = string | number | boolean | null | undefined;
export type Params = Record<string, Param>;

const DICTS: Record<Lang, Record<string, string>> = { de, en };
const MARK = '\u0001';
const SEP = '\u0002';
const PLACEHOLDER = /\{([a-zA-Z0-9_]+)(?::([a-zA-Z0-9]+))?\}/g;
const warned = new Set<string>();

function lookup(lang: Lang, key: string): string | undefined {
  return DICTS[lang][key] ?? DICTS.en[key] ?? DICTS.de[key];
}

function decode(lang: Lang, s: string): string {
  const i = s.indexOf(SEP);
  const key = s.slice(1, i < 0 ? undefined : i);
  let params: Params | undefined;
  if (i >= 0) {
    try {
      params = JSON.parse(s.slice(i + 1)) as Params;
    } catch {
      params = undefined;
    }
  }
  return render(lang, key, params);
}

function render(lang: Lang, key: string, params?: Params): string {
  const raw = lookup(lang, key);
  if (raw === undefined) {
    if (!warned.has(key)) {
      warned.add(key);
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  }
  if (!raw.includes('{')) return raw;
  return raw.replace(PLACEHOLDER, (all, name: string, fmt?: string) => {
    let v: Param = params && name in params ? params[name] : name === 'game' ? GAME_NAME : undefined;
    if (v === undefined || v === null) return all;
    if (typeof v === 'string' && v.charCodeAt(0) === 1) v = decode(lang, v);
    return fmt ? applyFormat(lang, v, fmt) : String(v);
  });
}

/** Text in der aktuellen Sprache. Platzhalter: {name}, mit Format {zahl:num} {betrag:money} {betrag:moneyC} {betrag:moneyS} {x:dec1} {anteil:pct}. {game} ist der Spielname. */
export function t(key: string, params?: Params): string {
  return render(getLang(), key, params);
}

/** Text in einer bestimmten Sprache (z. B. für Suchbegriffe in beiden Sprachen) */
export function tIn(lang: Lang, key: string, params?: Params): string {
  return render(lang, key, params);
}

/** Mehrzahl: nutzt `<key>.one` bei genau 1, sonst `<key>.other`. Der Platzhalter {n} ist die Anzahl. */
export function tp(key: string, n: number, params?: Params): string {
  return render(getLang(), `${key}.${n === 1 ? 'one' : 'other'}`, { n, ...params });
}

/** Text für den Spielstand, die Engine oder Ereignisse: wird erst bei tx() übersetzt. Zahlen als Zahlen übergeben (nicht vorformatiert). */
export function m(key: string, params?: Params): string {
  if (!params || !Object.keys(params).length) return MARK + key;
  return MARK + key + SEP + JSON.stringify(params);
}

/** Mehrzahl-Variante von m() */
export function mp(key: string, n: number, params?: Params): string {
  return m(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...params });
}

export function isMsg(s: unknown): s is string {
  return typeof s === 'string' && s.charCodeAt(0) === 1;
}

/** Text anzeigen, der mit m() gebaut wurde. Normaler (auch älterer, deutscher) Text kommt unverändert zurück. */
export function tx(s: string | null | undefined): string {
  if (!s) return '';
  return s.charCodeAt(0) === 1 ? decode(getLang(), s) : s;
}

/** Wie tx(), aber in einer festen Sprache */
export function txIn(lang: Lang, s: string | null | undefined): string {
  if (!s) return '';
  return s.charCodeAt(0) === 1 ? decode(lang, s) : s;
}

/**
 * Textfelder eines Datenobjekts bei jedem Zugriff übersetzen. Das Objekt braucht ein Feld `id`.
 * Schlüssel in den Sprachdateien: `<prefix>.<id>.<feld>`. Bestehender Code liest weiter `obj.name`.
 */
export function loc<T extends { id: string }>(prefix: string, obj: T, fields: (keyof T & string)[]): T {
  const out = { ...obj } as T;
  for (const f of fields) {
    Object.defineProperty(out, f, { get: () => t(`${prefix}.${obj.id}.${f}`), enumerable: true, configurable: true });
  }
  return out;
}

export function locList<T extends { id: string }>(prefix: string, list: readonly T[], fields: (keyof T & string)[]): T[] {
  return list.map((o) => loc(prefix, o, fields));
}

/** Objekt mit einem übersetzten Text je Eintrag: lazyRecord('stat', ['speed','accel']) → { speed: t('stat.speed'), … } */
export function lazyRecord<K extends string>(prefix: string, ids: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const id of ids) Object.defineProperty(out, id, { get: () => t(`${prefix}.${id}`), enumerable: true, configurable: true });
  return out;
}

/** Liste von Texten (z. B. Aufzählungspunkte): `<prefix>.0`, `<prefix>.1` … bis count-1, bei jedem Zugriff übersetzt */
export function lazyArray(prefix: string, count: number): string[] {
  return new Proxy([] as string[], {
    get(_target, prop) {
      if (prop === 'length') return count;
      if (prop === Symbol.iterator) return function* () { for (let i = 0; i < count; i++) yield t(`${prefix}.${i}`); };
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return Number(prop) < count ? t(`${prefix}.${prop}`) : undefined;
      const arr = Array.from({ length: count }, (_, i) => t(`${prefix}.${i}`));
      const v = (arr as unknown as Record<string | symbol, unknown>)[prop];
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(arr) : v;
    },
  });
}
