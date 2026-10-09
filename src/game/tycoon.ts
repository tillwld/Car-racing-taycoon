// Tycoon-Schicht: bebaubare Felder auf dem Teamgelände, passives Einkommen, Freischaltungen, Aufträge.
import { TIPS } from '../data/tips';
import { loc, m, mp, t, tx } from '../i18n';
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

/** Fläche mit übersetzten Textfeldern (Schlüssel tycoon.plot.<id>.name / blurb / unlocks), die Felder werden bei jedem Zugriff übersetzt */
function plot(b: Omit<PlotDef, 'name' | 'blurb' | 'unlocks'>, withUnlocks = false): PlotDef {
  const base: PlotDef = { ...b, name: '', blurb: '', ...(withUnlocks ? { unlocks: '' } : {}) };
  return loc('tycoon.plot', base, withUnlocks ? ['name', 'blurb', 'unlocks'] : ['name', 'blurb']);
}

export const PLOTS: Record<PlotId, PlotDef> = {
  kiosk: plot({ id: 'kiosk', kind: 'income', costs: [4000, 9000, 20000, 42000, 90000], yields: [15, 32, 54, 82, 120] }),
  fanshop: plot({ id: 'fanshop', kind: 'income', costs: [12000, 26000, 55000, 110000, 220000], yields: [24, 52, 88, 135, 195] }),
  workshop: plot({ id: 'workshop', kind: 'feature', costs: [15000] }, true),
  sponsorLounge: plot({ id: 'sponsorLounge', kind: 'feature', costs: [20000] }, true),
  setupLab: plot({ id: 'setupLab', kind: 'feature', costs: [18000] }, true),
  tireDepot: plot({ id: 'tireDepot', kind: 'feature', costs: [25000] }, true),
  grandstand: plot({ id: 'grandstand', kind: 'income', costs: [45000, 100000, 210000, 420000, 800000], yields: [45, 100, 165, 250, 360] }),
  staffOffice: plot({ id: 'staffOffice', kind: 'feature', costs: [40000] }, true),
  lounge: plot({ id: 'lounge', kind: 'feature', costs: [35000] }, true),
  lab: plot({ id: 'lab', kind: 'feature', costs: [60000] }, true),
  pitwall: plot({ id: 'pitwall', kind: 'feature', costs: [70000] }, true),
  media: plot({ id: 'media', kind: 'income', costs: [140000, 300000, 620000, 1200000, 2400000], yields: [80, 170, 280, 430, 640] }),
};

/** Name einer Fläche als Text für Spielstand/News/Buchungen (wird erst beim Anzeigen mit tx() übersetzt) */
export const plotNameMsg = (id: PlotId) => m(`tycoon.plot.${id}.name`);

/** Mehrere m()-Texte zu einem m()-Text verbinden (durch Zeilenumbruch oder Leerzeichen). Balanciert verschachtelt, damit der Text kompakt bleibt. */
export function joinMsgs(parts: string[], sep: 'nl' | 'space' = 'nl'): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const mid = Math.ceil(parts.length / 2);
  return m(sep === 'nl' ? 'tycoon.join.nl' : 'tycoon.join.space', { a: joinMsgs(parts.slice(0, mid), sep), b: joinMsgs(parts.slice(mid), sep) });
}

/**
 * Aufbau-Reihenfolge: Es wird immer nur die nächste Anlage frei. Sie braucht die vorherige (gebaut) und eine Mindestzahl
 * gefahrener Rennen. So kommt alles nacheinander, jeweils mit eigener Erklärung, und nie mehrere neue Dinge auf einmal.
 */
const stage = (id: PlotId, need: number) => loc('tycoon.aufbau', { id, races: need, why: '' }, ['why']);
export const AUFBAU: { id: PlotId; races: number; why: string }[] = [
  stage('kiosk', 0),
  stage('fanshop', 0),
  stage('workshop', 1),
  stage('sponsorLounge', 2),
  stage('setupLab', 3),
  stage('grandstand', 3),
  stage('tireDepot', 4),
  stage('lounge', 5),
  stage('staffOffice', 6),
  stage('lab', 7),
  stage('pitwall', 8),
  stage('media', 9),
];

/** Reihenfolge, in der Felder auf dem Gelände nacheinander frei werden */
export const PLOT_ORDER: PlotId[] = AUFBAU.map((a) => a.id);

/** Die nächste noch nicht gebaute Anlage der Reihenfolge */
export function nextPlot(g: GameState): PlotId | null {
  return PLOT_ORDER.find((p) => plotLevel(g, p) < 1) ?? null;
}

/** Was fehlt noch, bevor diese Anlage gebaut werden kann? Als m()-Texte. Leer = kann gebaut werden. */
function blockerMsgs(g: GameState, id: PlotId): string[] {
  const i = PLOT_ORDER.indexOf(id);
  const out: string[] = [];
  if (plotLevel(g, id) >= 1) return out;
  // Davor liegende Anlagen müssen stehen: gemeldet wird nur die erste fehlende
  const missing = PLOT_ORDER.slice(0, i).find((p) => plotLevel(g, p) < 1);
  if (missing) out.push(m('tycoon.req.buildFirst', { name: plotNameMsg(missing) }));
  const need = AUFBAU[i].races;
  if (races(g) < need) out.push(mp('tycoon.req.races', need - races(g)));
  return out;
}

/** Was fehlt noch, bevor diese Anlage gebaut werden kann? Leer = kann gebaut werden. (Anzeige-Texte in der aktuellen Sprache) */
export function plotBlockers(g: GameState, id: PlotId): string[] {
  return blockerMsgs(g, id).map(tx);
}

export function plotReqText(g: GameState, id: PlotId): string {
  return plotBlockers(g, id).join(' ');
}

/** Wie plotReqText, aber als m()-Text für gespeicherte Nachrichten (leer, wenn nichts fehlt) */
export function plotReqMsg(g: GameState, id: PlotId): string {
  return joinMsgs(blockerMsgs(g, id), 'space');
}

/** Hinweis für die nächste Anlage als m()-Text: was fehlt, sonst "jetzt baubar" */
export function aufbauHintMsg(g: GameState, id: PlotId): string {
  return plotReqMsg(g, id) || m('tycoon.path.buildable');
}

/** Begründung einer Anlage der Aufbau-Reihenfolge als m()-Text */
export const aufbauWhyMsg = (id: PlotId) => m(`tycoon.aufbau.${id}.why`);

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
  return plotLevel(g, id) >= 1 || blockerMsgs(g, id).length === 0;
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
    text: a.id === next ? (plotReqText(g, a.id) || t('tycoon.path.buildable')) : '',
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
  const out: { label: string; perSec: number; plot?: PlotId }[] = [{ label: t('tycoon.income.grant'), perSec: BASE_GRANT * tierMul(g) }];
  for (const id of PLOT_ORDER) {
    const y = plotYield(g, id);
    if (y > 0) out.push({ label: t('tycoon.income.plotLevel', { name: PLOTS[id].name, level: plotLevel(g, id) }), perSec: y, plot: id });
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
  if (lvl >= d.costs.length) return t('tycoon.buy.maxed');
  if (lvl === 0 && !plotAvailable(s, id)) return plotReqText(s, id);
  const cost = plotCost(s, id) as number;
  if (s.money < cost) return t('tycoon.buy.noMoney');
  book(s, lvl === 0 ? m('tycoon.buy.built', { name: plotNameMsg(id) }) : m('tycoon.buy.upgraded', { name: plotNameMsg(id), level: lvl + 1 }), -cost, 'facility');
  s.plots[id] = lvl + 1;
  if (lvl === 0) {
    queueTip(s, `plot_${id}`);
    if (d.kind === 'income') queueTip(s, 'income');
    news(s, m('tycoon.news.built', { name: plotNameMsg(id) }), 'good');
  } else news(s, m('tycoon.news.upgraded', { name: plotNameMsg(id), level: lvl + 1 }), 'good');
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

/** Auftrag mit übersetztem Text (Schlüssel tycoon.mission.<id>.text) */
const mission = (def: Omit<Mission, 'text'>): Mission => loc('tycoon.mission', { ...def, text: '' }, ['text']);

export const MISSIONS: Mission[] = [
  mission({ id: 'drive', target: 'track', reward: 1500, done: (g) => (g.flags.testLaps ?? 0) >= 1 }),
  mission({ id: 'kiosk', target: 'kiosk', reward: 0, done: built('kiosk') }),
  mission({ id: 'fanshop', target: 'fanshop', reward: 0, done: built('fanshop'), avail: buildable('fanshop') }),
  mission({ id: 'race1', target: 'truck', reward: 8000, done: (g) => g.stats.races >= 1 }),
  mission({ id: 'workshop', target: 'workshop', reward: 0, done: built('workshop'), avail: buildable('workshop') }),
  mission({ id: 'upgrade', target: 'garage', reward: 4000, done: (g) => g.stats.upgradesDone >= 1 || g.developments.some((d) => d.kind === 'part'), avail: built('workshop') }),
  mission({ id: 'sponsors', target: 'sponsorLounge', reward: 0, done: built('sponsorLounge'), avail: buildable('sponsorLounge') }),
  mission({ id: 'setupLab', target: 'setupLab', reward: 0, done: built('setupLab'), avail: buildable('setupLab') }),
  mission({ id: 'practice', target: 'setupLab', reward: 3000, done: (g) => !!g.flags.practiced, avail: built('setupLab') }),
  mission({ id: 'stand', target: 'grandstand', reward: 0, done: built('grandstand'), avail: buildable('grandstand') }),
  mission({ id: 'tires', target: 'tireDepot', reward: 0, done: built('tireDepot'), avail: buildable('tireDepot') }),
  mission({ id: 'points', target: 'truck', reward: 12000, done: (g) => g.stats.points > 0 }),
  mission({ id: 'lounge', target: 'lounge', reward: 0, done: built('lounge'), avail: buildable('lounge') }),
  mission({ id: 'staff', target: 'staffOffice', reward: 6000, done: (g) => plotLevel(g, 'staffOffice') >= 1 && !!g.staff.mechanic, avail: buildable('staffOffice') }),
  mission({ id: 'lab', target: 'lab', reward: 0, done: built('lab'), avail: buildable('lab') }),
  mission({ id: 'research', target: 'lab', reward: 5000, done: (g) => g.developments.some((d) => d.kind === 'research') || Object.keys(g.research).length > 0, avail: built('lab') }),
  mission({ id: 'podium', target: 'truck', reward: 30000, done: (g) => g.stats.podiums >= 1 }),
  mission({ id: 'pitwall', target: 'pitwall', reward: 0, done: built('pitwall'), avail: buildable('pitwall') }),
  mission({ id: 'season', target: 'truck', reward: 60000, done: (g) => g.history.length >= 1 || !!g.seasonEnd }),
  mission({ id: 'media', target: 'media', reward: 0, done: built('media'), avail: buildable('media') }),
  mission({ id: 'win', target: 'truck', reward: 80000, done: (g) => g.stats.wins >= 1 }),
];

export function missionDone(g: GameState, id: string) {
  return !!(g.flags.missions && g.flags.missions[id]);
}

/** Die nächsten offenen Aufträge (höchstens n) */
export function activeMissions(g: GameState, n = 3): Mission[] {
  return MISSIONS.filter((mi) => !missionDone(g, mi.id) && (!mi.avail || mi.avail(g))).slice(0, n);
}

/** Schließt erledigte Aufträge ab und zahlt die Belohnung. Gibt die Texte der neu erledigten zurück (für sofortige Toasts, in der aktuellen Sprache). */
export function claimMissions(s: GameState): string[] {
  const out: string[] = [];
  const map = (s.flags.missions ??= {}) as Record<string, boolean>;
  for (const mi of MISSIONS) {
    if (map[mi.id] || !mi.done(s)) continue;
    map[mi.id] = true;
    if (mi.reward > 0) {
      book(s, m('tycoon.claim.booking', { text: m(`tycoon.mission.${mi.id}.text`) }), mi.reward, 'bonus');
      out.push(t('tycoon.claim.toastReward', { amount: mi.reward }));
    } else out.push(t('tycoon.claim.toast'));
  }
  return out;
}

export function hasPendingMissions(g: GameState) {
  const map = (g.flags.missions ?? {}) as Record<string, boolean>;
  return MISSIONS.some((mi) => !map[mi.id] && mi.done(g));
}

// ---------- Einnahmen während der Abwesenheit ----------
// Der Betrag liegt als Zahl in flags.offline und wird beim Anzeigen formatiert (kein Text im Spielstand).
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

/** Zahlt Prämien für eine Fahrt auf der Teststrecke. Gibt die Abrechnung zurück (Labels sind m()-Texte, beim Anzeigen mit tx() auflösen). */
export function freeDriveReward(s: GameState, trackId: string, laps: number[]): { label: string; amount: number }[] {
  const lines: { label: string; amount: number }[] = [];
  if (!laps.length) return lines;
  const mul = tierMul(s);
  s.flags.testLaps = (s.flags.testLaps ?? 0) + laps.length;
  const counted = Math.min(FREE_LAP_CAP, laps.length);
  const lapPay = Math.round(600 * mul) * counted;
  lines.push({ label: mp('tycoon.free.laps', counted), amount: lapPay });
  const best = Math.min(...laps);
  const tb = (s.flags.testBest ??= {}) as Record<string, number>;
  const prev = tb[trackId];
  if (!prev) lines.push({ label: m('tycoon.free.firstBest'), amount: Math.round(1500 * mul) });
  else if (best < prev - 0.001) lines.push({ label: m('tycoon.free.newBest', { diff: prev - best }), amount: Math.round(Math.min(2500, 500 + (prev - best) * 400) * mul) });
  if (!prev || best < prev) tb[trackId] = best;
  if (!s.stats.bestLaps[trackId] || best < s.stats.bestLaps[trackId]) s.stats.bestLaps[trackId] = best;
  for (const l of lines) book(s, m('tycoon.free.booking', { label: l.label }), l.amount, 'prize');
  return lines;
}
