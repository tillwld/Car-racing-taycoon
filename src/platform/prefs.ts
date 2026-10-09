// Einstellungen außerhalb des Spielstands (die gewählte Sprache). Liegt im selben Speicher wie der Spielstand (siehe storage.ts).
import { setLang, type Lang } from '../i18n/lang';
import { store } from './storage';

export const LANG_KEY = 'apex-rennstall-lang';

export function storedLanguage(): Lang | null {
  const v = store.get(LANG_KEY);
  return v === 'de' || v === 'en' ? v : null;
}

/** Sprache umschalten und merken */
export function setLanguage(l: Lang) {
  setLang(l);
  store.set(LANG_KEY, l);
}
