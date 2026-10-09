// Aktuelle Sprache des Spiels: Erkennung, Umschalten und Benachrichtigung der Oberfläche.
import { useSyncExternalStore } from 'react';

export type Lang = 'de' | 'en';
export const LANGS: readonly Lang[] = ['de', 'en'];
export const LANG_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English' };
export const LOCALES: Record<Lang, string> = { de: 'de-DE', en: 'en-US' };

/** Standard ist Englisch, nur Deutsch („de“, „de-AT“ …) wird als Deutsch erkannt */
export function normalizeLang(raw: unknown): Lang {
  return typeof raw === 'string' && raw.trim().toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** Sprache beim Start: erst die der Plattform (Bridge), sonst die des Browsers */
export function detectLang(platformLanguage?: string | null): Lang {
  if (platformLanguage) return normalizeLang(platformLanguage);
  try {
    return normalizeLang(typeof navigator !== 'undefined' ? navigator.language : 'en');
  } catch {
    return 'en';
  }
}

let current: Lang = detectLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  try {
    document.documentElement.lang = l;
  } catch {
    /* ohne DOM (Tests) */
  }
  for (const cb of [...listeners]) cb();
}

export function subscribeLang(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Oberfläche neu zeichnen, wenn die Sprache wechselt. In Komponenten aufrufen, die Texte zwischenspeichern (useMemo). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}
