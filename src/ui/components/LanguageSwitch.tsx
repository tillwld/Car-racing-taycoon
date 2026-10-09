// Umschalter Deutsch / English (Einstellungen und Titelbildschirm)
import { LANGS, LANG_NAMES, t, useLang, type Lang } from '../../i18n';
import { setLanguage } from '../../platform/prefs';
import { Seg } from './common';

export function LanguageSwitch({ id }: { id?: string }) {
  const lang = useLang();
  // Die Sprachnamen selbst werden nie übersetzt; nur die Beschriftung für Screenreader ("Sprache / Language")
  return (
    <span role="group" aria-label={t('settings.language.title')} style={{ display: 'inline-flex' }}>
      <Seg<Lang> id={id} value={lang} onChange={setLanguage} options={LANGS.map((l) => ({ v: l, l: LANG_NAMES[l] }))} />
    </span>
  );
}
