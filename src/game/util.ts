export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;
export const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const nf = new Intl.NumberFormat('de-DE');
export function money(v: number, compact = false): string {
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (compact) {
    if (a >= 1e6) return `${sign}${(a / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio. €`;
    if (a >= 1e4) return `${sign}${Math.round(a / 1e3).toLocaleString('de-DE')} Tsd. €`;
  }
  return `${sign}${nf.format(Math.round(a))} €`;
}

export function lapTime(t: number | undefined | null): string {
  if (t === undefined || t === null || !isFinite(t) || t <= 0) return '–:––.–––';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function gapTime(t: number): string {
  if (!isFinite(t)) return '';
  return `+${t.toFixed(3)}`;
}

export function pct(v: number) {
  return `${Math.round(v * 100)} %`;
}

export function ordinal(n: number) {
  return `P${n}`;
}
