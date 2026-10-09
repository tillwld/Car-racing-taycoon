// Zahlen und Geldbeträge nach Sprache formatieren (de-DE / en-US). Die Spielwährung ist in beiden Sprachen Euro.
import { LOCALES, getLang, type Lang } from './lang';

const cache = new Map<string, Intl.NumberFormat>();
function nf(lang: Lang, decimals = 0): Intl.NumberFormat {
  const k = `${lang}:${decimals}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    cache.set(k, f);
  }
  return f;
}

/** Zahl mit Tausendertrennzeichen und festen Nachkommastellen */
export function fmtNum(v: number, decimals = 0, lang: Lang = getLang()): string {
  if (!isFinite(v)) return '–';
  return nf(lang, decimals).format(v);
}

/** Geldbetrag: de „1.234 €“, „12 Tsd. €“, „1,5 Mio. €“; en „€1,234“, „€12K“, „€1.5M“. `sign` setzt bei positiven Beträgen ein Plus davor. */
export function fmtMoney(v: number, compact = false, lang: Lang = getLang(), sign = false): string {
  const neg = v < 0;
  const a = Math.abs(v);
  const s = neg ? '−' : sign && v > 0 ? '+' : '';
  const de = lang === 'de';
  if (compact && a >= 1e6) {
    const n = new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 2 }).format(a / 1e6);
    return de ? `${s}${n} Mio. €` : `${s}€${n}M`;
  }
  if (compact && a >= 1e4) {
    const n = nf(lang).format(Math.round(a / 1e3));
    return de ? `${s}${n} Tsd. €` : `${s}€${n}K`;
  }
  const n = nf(lang).format(Math.round(a));
  return de ? `${s}${n} €` : `${s}€${n}`;
}

/** Anteil 0 … 1 als Prozent: de „85 %“, en „85%“ */
export function fmtPct(v: number, lang: Lang = getLang()): string {
  return lang === 'de' ? `${Math.round(v * 100)} %` : `${Math.round(v * 100)}%`;
}

/** Wendet eine Formatangabe aus einem Platzhalter an, z. B. {v:money} */
export function applyFormat(lang: Lang, value: string | number | boolean, fmt: string): string {
  const n = Number(value);
  switch (fmt) {
    case 'num': return fmtNum(n, 0, lang);
    case 'dec1': return fmtNum(n, 1, lang);
    case 'dec2': return fmtNum(n, 2, lang);
    case 'dec3': return fmtNum(n, 3, lang);
    case 'money': return fmtMoney(n, false, lang);
    case 'moneyC': return fmtMoney(n, true, lang);
    case 'moneyS': return fmtMoney(n, false, lang, true);
    case 'moneyCS': return fmtMoney(n, true, lang, true);
    case 'pct': return fmtPct(n, lang);
    default: return String(value);
  }
}
