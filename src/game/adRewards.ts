// Belohnungen für freiwillig angesehene Werbung. Die Spiellogik kennt die Werbung selbst nicht:
// Sie schreibt nur gut, wenn der Aufrufer (nach erfolgreichem Ansehen) `grant…` aufruft.
import { m } from '../i18n';
import type { GameState } from '../types';
import { book, news } from './state';

/** Anteil des aktuellen Budgets, den der Sponsor-Bonus bringt */
export const SPONSOR_BONUS_RATE = 0.1;
const MIN_BONUS = 500;

const weekendKey = (g: Pick<GameState, 'season' | 'round'>) => `${g.season}:${g.round}`;

/** Höhe des Sponsor-Bonus: 10 % des aktuellen Budgets (mindestens ein kleiner Betrag, nie bei Schulden negativ) */
export function sponsorBonusAmount(g: GameState): number {
  return Math.max(MIN_BONUS, Math.round((Math.max(0, g.money) * SPONSOR_BONUS_RATE) / 100) * 100);
}

/** Einmal pro Rennwochenende, nur solange die Saison läuft */
export function canClaimSponsorBonus(g: GameState): boolean {
  return g.flags.adBonusKey !== weekendKey(g) && g.round < g.calendar.length && !g.seasonEnd;
}

export function grantSponsorBonus(s: GameState): number {
  const amount = sponsorBonusAmount(s);
  s.flags.adBonusKey = weekendKey(s);
  book(s, m('ads.ledger.sponsorBonus'), amount, 'bonus');
  news(s, m('ads.news.sponsorBonus', { amount }), 'good');
  return amount;
}

/** Reparaturkosten sind bis zum nächsten Rennen halbiert (Merker auf das kommende Rennwochenende) */
export function repairDiscountActive(g: Pick<GameState, 'season' | 'round' | 'flags'>): boolean {
  return g.flags.repairHalfKey === weekendKey(g);
}

export function grantRepairDiscount(s: GameState) {
  s.flags.repairHalfKey = weekendKey(s);
  news(s, m('ads.news.repairHalf'), 'good');
}

/** Faktor für Reparaturkosten (0,5 mit Rabatt) */
export const repairFactor = (g: GameState) => (repairDiscountActive(g) ? 0.5 : 1);
