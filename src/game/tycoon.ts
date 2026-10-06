// Tycoon-Schicht: bebaubare Felder auf dem Teamgelände, passives Einkommen, Freischaltungen, Aufträge.
import { TIPS } from '../data/tips';
import type { GameState, PlotId } from '../types';
import { book, news } from './state';

export type PlotKind = 'income' | 'feature';

export interface PlotDef {
  id: PlotId;
  name: string;
  blurb: string;
  kind: PlotKind;
  /** Kosten je Stufe (Rennklasse 1). Einnahmequellen werden mit der Klasse teurer. */
  costs: number[];
  /** Einnahmen pro Sekunde je Stufe (Rennklasse 1) */
  yields?: number[];
  /** Was die Fläche freischaltet (nur Anzeige) */
  unlocks?: string;
}

const races = (g: GameState) => g.stats.races;
const has = (g: GameState, id: PlotId) => (g.plots[id] ?? 0) >= 1;

export const PLOTS: Record<PlotId, PlotDef> = {
  kiosk: {
    id: 'kiosk', name: 'Fan-Kiosk', kind: 'income', blurb: 'Getränke und Snacks für die Fans.',
    costs: [4000, 9000, 20000, 42000, 90000], yields: [15, 32, 54, 82, 120],
  },
  fanshop: {
    id: 'fanshop', name: 'Fanshop', kind: 'income', blurb: 'Trikots, Kappen und Modellautos.',
    costs: [12000, 26000, 55000, 110000, 220000], yields: [24, 52, 88, 135, 195],
  },
  workshop: {
    id: 'workshop', name: 'Werkstatt', kind: 'feature', blurb: 'Upgrades, Reparatur und Chassis.',
    costs: [15000], unlocks: 'Upgrades, Reparatur, Chassis-Markt',
  },
  sponsorLounge: {
    id: 'sponsorLounge', name: 'Sponsoren-Lounge', kind: 'feature', blurb: 'Sponsoren und ihre Ziele.',
    costs: [20000], unlocks: 'Sponsoren-Verträge',
  },
  setupLab: {
    id: 'setupLab', name: 'Prüfstand', kind: 'feature', blurb: 'Training und Fahrzeugabstimmung.',
    costs: [18000], unlocks: 'Training und Abstimmung',
  },
  tireDepot: {
    id: 'tireDepot', name: 'Reifenlager', kind: 'feature', blurb: 'Reifenwahl, Sprit und Boxenstopps.',
    costs: [25000], unlocks: 'Reifen, Tankmenge und Boxenstopps',
  },
  grandstand: {
    id: 'grandstand', name: 'Tribüne', kind: 'income', blurb: 'Zuschauer an der Teststrecke.',
    costs: [45000, 100000, 210000, 420000, 800000], yields: [45, 100, 165, 250, 360],
  },
  staffOffice: {
    id: 'staffOffice', name: 'Personalbüro', kind: 'feature', blurb: 'Mechaniker und Ingenieure einstellen.',
    costs: [40000], unlocks: 'Mitarbeiter',
  },
  lounge: {
    id: 'lounge', name: 'Fahrerlounge', kind: 'feature', blurb: 'Fahrer, Verträge und Akademie.',
    costs: [35000], unlocks: 'Fahrer und Transfermarkt',
  },
  lab: {
    id: 'lab', name: 'Forschungslabor', kind: 'feature', blurb: 'Neue Technik entwickeln.',
    costs: [60000], unlocks: 'Forschungsbaum',
  },
  pitwall: {
    id: 'pitwall', name: 'Boxenmauer', kind: 'feature', blurb: 'Taktik für deine Fahrer.',
    costs: [70000], unlocks: 'Fahrstil, Aggressivität, Überholstrategie',
  },
  media: {
    id: 'media', name: 'Mediazentrum', kind: 'income', blurb: 'Übertragungsrechte und Werbepartner.',
    costs: [140000, 300000, 620000, 1200000, 2400000], yields: [80, 170, 280, 430, 640],
  },
};

/**
 * Aufbau-Reihenfolge: Es wird immer nur die nächste Anlage frei. Sie braucht die vorherige (gebaut) und eine Mindestzahl
 * gefahrener Rennen. So kommt alles nacheinander, jeweils mit eigener Erklärung, und nie mehrere neue Dinge auf einmal.
 */
export const AUFBAU: { id: PlotId; races: number; why: string }[] = [
  { id: 'kiosk', races: 0, why: 'Dein erstes Einkommen: Der Kiosk verdient von allein Geld.' },
  { id: 'fanshop', races: 0, why: 'Mehr Einnahmen, damit du dir die Technik leisten kannst.' },
  { id: 'workshop', races: 1, why: 'Hier machst du dein Auto schneller und hältst es in Schuss.' },
  { id: 'sponsorLounge', races: 2, why: 'Sponsoren zahlen dir bei jedem Rennen Geld.' },
  { id: 'setupLab', races: 3, why: 'Training und Abstimmung: Dein Auto auf die Strecke einstellen.' },
  { id: 'grandstand', races: 3, why: 'Zuschauer an der Teststrecke bringen kräftig Geld.' },
  { id: 'tireDepot', races: 4, why: 'Reifen, Tankmenge und eigene Boxenstopps.' },
  { id: 'lounge', races: 5, why: 'Fahrer verwalten: Verträge, Transfers und Nachwuchs.' },
  { id: 'staffOffice', races: 6, why: 'Mechaniker und Ingenieure machen dein Team besser.' },
  { id: 'lab', races: 7, why: 'Neue Technik entwickeln, die dauerhaft wirkt.' },
  { id: 'pitwall', races: 8, why: 'Taktik für deinen Computer-Fahrer.' },
  { id: 'media', races: 9, why: 'Die größte Einnahmequelle.' },
];

/** Reihenfolge, in der Felder auf dem Gelände nacheinander frei werden */
export const PLOT_ORDER: PlotId[] = AUFBAU.map((a) => a.id);

/** Die nächste noch nicht gebaute Anlage der Reihenfolge */
export function nextPlot(g: GameState): PlotId | null {
  return PLOT_ORDER.find((p) => plotLevel(g, p) < 1) ?? null;
}

/** Was fehlt noch, bevor diese Anlage gebaut werden kann? Leer = kann gebaut werden. */
export function plotBlockers(g: GameState, id: PlotId): string[] {
  const i = PLOT_ORDER.indexOf(id);
  const out: string[] = [];
  if (plotLevel(g, id) >= 1) return out;
  // Davor liegende Anlagen müssen stehen: gemeldet wird nur die erste fehlende
  const missing = PLOT_ORDER.slice(0, i).find((p) => plotLevel(g, p) < 1);
  if (missing) out.push(`Baue zuerst: ${PLOTS[missing].name}.`);
  const need = AUFBAU[i].races;
  if (races(g) < need) out.push(need - races(g) === 1 ? 'Fahre noch 1 Rennen.' : `Fahre noch ${need - races(g)} Rennen.`);
  return out;
}

export function plotReqText(g: GameState, id: PlotId): string {
  return plotBlockers(g, id).join(' ');
}

export const START_MONEY = 20000;
const BASE_GRANT = 8; // Grundförderung pro Sekunde

export function tierMul(g: GameState) {
  return [1, 2, 4][Math.min(2, g.tier)];
}

export function plotLevel(g: GameState, id: PlotId) {
  return g.plots[id] ?? 0;
}

export function plotMaxLevel(id: PlotId) {
  return PLOTS[id].costs.length;
}

/** Preis der nächsten Stufe, null wenn voll ausgebaut */
export function plotCost(g: GameState, id: PlotId): number | null {
  const d = PLOTS[id];
  const lvl = plotLevel(g, id);
  if (lvl >= d.costs.length) return null;
  return Math.round((d.costs[lvl] * (d.kind === 'income' ? tierMul(g) : 1)) / 100) * 100;
}

/** Ausbaustufen einer schon gebauten Anlage sind immer möglich, eine neue braucht die Voraussetzungen der Reihenfolge */
export function plotAvailable(g: GameState, id: PlotId) {
  return plotLevel(g, id) >= 1 || plotBlockers(g, id).length === 0;
}

/** Sichtbar sind alle gebauten Felder und genau das nächste der Reihenfolge */
export function plotVisible(g: GameState, id: PlotId) {
  return plotLevel(g, id) > 0 || id === nextPlot(g);
}

/** Fortschritt in der Aufbau-Reihenfolge für die Anzeige */
export function aufbauPath(g: GameState): { id: PlotId; name: string; state: 'built' | 'next' | 'later'; text: string; why: string }[] {
  const next = nextPlot(g);
  return AUFBAU.map((a) => ({
    id: a.id,
    name: PLOTS[a.id].name,
    state: plotLevel(g, a.id) >= 1 ? 'built' : a.id === next ? 'next' : 'later',
    text: a.id === next ? (plotReqText(g, a.id) || 'Jetzt baubar: Stell dich auf die leuchtende Fläche.') : '',
    why: a.why,
  }));
}

export function repFactor(g: GameState) {
  return 0.85 + (g.reputation / 100) * 0.5;
}

export function plotYield(g: GameState, id: PlotId, level = plotLevel(g, id)) {
  const d = PLOTS[id];
  if (!d.yields || level <= 0) return 0;
  return d.yields[level - 1] * tierMul(g) * (id === 'kiosk' ? 1 : repFactor(g));
}

export function incomeParts(g: GameState): { label: string; perSec: number; plot?: PlotId }[] {
  const out: { label: string; perSec: number; plot?: PlotId }[] = [{ label: 'Förderung des Verbands', perSec: BASE_GRANT * tierMul(g) }];
  for (const id of PLOT_ORDER) {
    const y = plotYield(g, id);
    if (y > 0) out.push({ label: `${PLOTS[id].name} (Stufe ${plotLevel(g, id)})`, perSec: y, plot: id });
  }
  return out;
}

export function incomePerSec(g: GameState) {
  return incomeParts(g).reduce((a, p) => a + p.perSec, 0);
}

// ---------- Freischaltungen ----------
export interface Features {
  garage: boolean;
  training: boolean;
  setup: boolean;
  quali: boolean;
  tyres: boolean;
  tactics: boolean;
  research: boolean;
  staff: boolean;
  drivers: boolean;
  sponsors: boolean;
  finance: boolean;
}

export function features(g: GameState): Features {
  const has2 = (id: PlotId) => plotLevel(g, id) >= 1;
  return {
    garage: has2('workshop'),
    training: has2('setupLab'),
    setup: has2('setupLab'),
    quali: g.stats.races >= 2,
    tyres: has2('tireDepot'),
    tactics: has2('pitwall'),
    research: has2('lab'),
    staff: has2('staffOffice'),
    drivers: has2('lounge'),
    sponsors: has2('sponsorLounge'),
    finance: has2('sponsorLounge') || g.stats.races >= 5,
  };
}

// ---------- Erklärungen ----------
export function queueTip(s: GameState, id: string) {
  if (!TIPS[id] || s.tipsSeen[id]) return;
  const q = (s.flags.tipQueue ??= []) as string[];
  if (!q.includes(id)) q.push(id);
}

export function dismissTip(s: GameState, id: string) {
  s.tipsSeen[id] = true;
  s.flags.tipQueue = ((s.flags.tipQueue ?? []) as string[]).filter((x) => x !== id);
}

export function currentTip(g: GameState): string | null {
  const q = (g.flags.tipQueue ?? []) as string[];
  return q.find((id) => TIPS[id] && !g.tipsSeen[id]) ?? null;
}

// ---------- Kaufen ----------
export function buyPlot(s: GameState, id: PlotId): string | null {
  const d = PLOTS[id];
  const lvl = plotLevel(s, id);
  if (lvl >= d.costs.length) return 'Diese Anlage ist voll ausgebaut.';
  if (lvl === 0 && !plotAvailable(s, id)) return plotReqText(s, id);
  const cost = plotCost(s, id) as number;
  if (s.money < cost) return 'Dafür fehlt noch Geld.';
  book(s, lvl === 0 ? `Gebaut: ${d.name}` : `Ausbau: ${d.name} auf Stufe ${lvl + 1}`, -cost, 'facility');
  s.plots[id] = lvl + 1;
  if (lvl === 0) {
    queueTip(s, `plot_${id}`);
    if (d.kind === 'income') queueTip(s, 'income');
    news(s, `${d.name} ist fertig gebaut.`, 'good');
  } else news(s, `${d.name} wurde auf Stufe ${lvl + 1} ausgebaut.`, 'good');
  return null;
}

// ---------- Aufträge ----------
export type MissionTarget = PlotId | 'track' | 'truck' | 'garage' | 'office';

export interface Mission {
  id: string;
  text: string;
  target: MissionTarget;
  reward: number;
  done: (g: GameState) => boolean;
  /** Mission erst zeigen, wenn dies erfüllt ist */
  avail?: (g: GameState) => boolean;
}

const built = (id: PlotId) => (g: GameState) => plotLevel(g, id) >= 1;
const buildable = (id: PlotId) => (g: GameState) => plotAvailable(g, id);

export const MISSIONS: Mission[] = [
  { id: 'drive', text: 'Fahre eine Runde auf der Teststrecke', target: 'track', reward: 1500, done: (g) => (g.flags.testLaps ?? 0) >= 1 },
  { id: 'kiosk', text: 'Baue den Fan-Kiosk: Stell dich auf die leuchtende Fläche', target: 'kiosk', reward: 0, done: built('kiosk') },
  { id: 'fanshop', text: 'Baue den Fanshop', target: 'fanshop', reward: 0, done: built('fanshop'), avail: buildable('fanshop') },
  { id: 'race1', text: 'Fahre dein erstes Rennen am Team-Transporter', target: 'truck', reward: 8000, done: (g) => g.stats.races >= 1 },
  { id: 'workshop', text: 'Baue die Werkstatt', target: 'workshop', reward: 0, done: built('workshop'), avail: buildable('workshop') },
  { id: 'upgrade', text: 'Starte ein Upgrade in der Werkstatt', target: 'garage', reward: 4000, done: (g) => g.stats.upgradesDone >= 1 || g.developments.some((d) => d.kind === 'part'), avail: built('workshop') },
  { id: 'sponsors', text: 'Baue die Sponsoren-Lounge', target: 'sponsorLounge', reward: 0, done: built('sponsorLounge'), avail: buildable('sponsorLounge') },
  { id: 'setupLab', text: 'Baue den Prüfstand für Training und Abstimmung', target: 'setupLab', reward: 0, done: built('setupLab'), avail: buildable('setupLab') },
  { id: 'practice', text: 'Fahre oder simuliere ein Training und stelle dein Auto am Prüfstand ein', target: 'setupLab', reward: 3000, done: (g) => !!g.flags.practiced, avail: built('setupLab') },
  { id: 'stand', text: 'Baue die Tribüne', target: 'grandstand', reward: 0, done: built('grandstand'), avail: buildable('grandstand') },
  { id: 'tires', text: 'Baue das Reifenlager', target: 'tireDepot', reward: 0, done: built('tireDepot'), avail: buildable('tireDepot') },
  { id: 'points', text: 'Hole deine ersten Meisterschaftspunkte (Top 10)', target: 'truck', reward: 12000, done: (g) => g.stats.points > 0 },
  { id: 'lounge', text: 'Baue die Fahrerlounge', target: 'lounge', reward: 0, done: built('lounge'), avail: buildable('lounge') },
  { id: 'staff', text: 'Baue das Personalbüro und stelle einen Mechaniker ein', target: 'staffOffice', reward: 6000, done: (g) => plotLevel(g, 'staffOffice') >= 1 && !!g.staff.mechanic, avail: buildable('staffOffice') },
  { id: 'lab', text: 'Baue das Forschungslabor', target: 'lab', reward: 0, done: built('lab'), avail: buildable('lab') },
  { id: 'research', text: 'Starte ein Forschungsprojekt', target: 'lab', reward: 5000, done: (g) => g.developments.some((d) => d.kind === 'research') || Object.keys(g.research).length > 0, avail: built('lab') },
  { id: 'podium', text: 'Fahre aufs Podium', target: 'truck', reward: 30000, done: (g) => g.stats.podiums >= 1 },
  { id: 'pitwall', text: 'Baue die Boxenmauer', target: 'pitwall', reward: 0, done: built('pitwall'), avail: buildable('pitwall') },
  { id: 'season', text: 'Beende deine erste Saison', target: 'truck', reward: 60000, done: (g) => g.history.length >= 1 || !!g.seasonEnd },
  { id: 'media', text: 'Baue das Mediazentrum', target: 'media', reward: 0, done: built('media'), avail: buildable('media') },
  { id: 'win', text: 'Gewinne ein Rennen', target: 'truck', reward: 80000, done: (g) => g.stats.wins >= 1 },
];

export function missionDone(g: GameState, id: string) {
  return !!(g.flags.missions && g.flags.missions[id]);
}

/** Die nächsten offenen Aufträge (höchstens n) */
export function activeMissions(g: GameState, n = 3): Mission[] {
  return MISSIONS.filter((m) => !missionDone(g, m.id) && (!m.avail || m.avail(g))).slice(0, n);
}

/** Schließt erledigte Aufträge ab und zahlt die Belohnung. Gibt die Texte der neu erledigten zurück. */
export function claimMissions(s: GameState): string[] {
  const out: string[] = [];
  const map = (s.flags.missions ??= {}) as Record<string, boolean>;
  for (const m of MISSIONS) {
    if (map[m.id] || !m.done(s)) continue;
    map[m.id] = true;
    if (m.reward > 0) {
      book(s, `Auftrag erfüllt: ${m.text}`, m.reward, 'bonus');
      out.push(`Auftrag erledigt: +${m.reward.toLocaleString('de-DE')} €`);
    } else out.push('Auftrag erledigt');
  }
  return out;
}

export function hasPendingMissions(g: GameState) {
  const map = (g.flags.missions ?? {}) as Record<string, boolean>;
  return MISSIONS.some((m) => !map[m.id] && m.done(g));
}

// ---------- Einnahmen während der Abwesenheit ----------
export function applyOffline(s: GameState) {
  const now = Date.now();
  const last = s.lastTick || now;
  const dt = Math.min(3600, Math.max(0, (now - last) / 1000));
  if (dt >= 60) {
    const gain = Math.round(incomePerSec(s) * dt * 0.5);
    if (gain > 0) {
      s.money += gain;
      s.stats.income += gain;
      s.stats.passive += gain;
      s.flags.offline = { amount: gain, seconds: Math.round(dt) };
    }
  }
  s.lastTick = now;
}

// ---------- Teststrecke ----------
export const FREE_LAP_CAP = 6;

/** Zahlt Prämien für eine Fahrt auf der Teststrecke. Gibt die Abrechnung zurück. */
export function freeDriveReward(s: GameState, trackId: string, laps: number[]): { label: string; amount: number }[] {
  const lines: { label: string; amount: number }[] = [];
  if (!laps.length) return lines;
  const mul = tierMul(s);
  s.flags.testLaps = (s.flags.testLaps ?? 0) + laps.length;
  const counted = Math.min(FREE_LAP_CAP, laps.length);
  const lapPay = Math.round(600 * mul) * counted;
  lines.push({ label: `${counted} Runden gefahren`, amount: lapPay });
  const best = Math.min(...laps);
  const tb = (s.flags.testBest ??= {}) as Record<string, number>;
  const prev = tb[trackId];
  if (!prev) lines.push({ label: 'Erste Bestzeit auf dieser Strecke', amount: Math.round(1500 * mul) });
  else if (best < prev - 0.001) lines.push({ label: `Neue Bestzeit (${(prev - best).toFixed(2)} s schneller)`, amount: Math.round(Math.min(2500, 500 + (prev - best) * 400) * mul) });
  if (!prev || best < prev) tb[trackId] = best;
  if (!s.stats.bestLaps[trackId] || best < s.stats.bestLaps[trackId]) s.stats.bestLaps[trackId] = best;
  for (const l of lines) book(s, `Teststrecke: ${l.label}`, l.amount, 'prize');
  return lines;
}

