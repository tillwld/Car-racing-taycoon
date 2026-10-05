import { ACHIEVEMENTS, CHASSIS_BY_ID, CONDITION_COST, FACILITY, PARTS, RESEARCH_BY_ID, TIERS } from '../data/catalog';
import { TRACKS } from '../data/tracks';
import type { ConditionKey, Driver, GameState, LedgerEntry, LogoKind, PartKey, Region, Settings, Sponsor, Staff, Stats } from '../types';
import { devSlots, partCost, partTime, researchCost, researchTime, staffSkill } from './carModel';
import { driverSalary, genId, makeAITeams, makeDriver, makeDriverMarket, makeSponsorOffers, makeStaffMarket, staffSalary } from './generators';
import { shuffle, clamp } from './util';

export const SAVE_VERSION = 4;

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
  volume: 0.7,
  camera: 'chase',
  touchControls: 'auto',
  steerSensitivity: 1,
  showLine: false,
  cornerHints: false,
  brakeAssist: false,
  steerAssist: true,
  difficulty: 'normal',
  raceLength: 'medium',
  quality: 'high',
};

export const emptyStats = (): Stats => ({
  races: 0,
  wins: 0,
  podiums: 0,
  poles: 0,
  fastestLaps: 0,
  points: 0,
  titles: 0,
  teamTitles: 0,
  dnfs: 0,
  income: 0,
  expenses: 0,
  km: 0,
  bestLaps: {},
  overtakes: 0,
  pitStops: 0,
  bestPitStop: 0,
  researchDone: 0,
  upgradesDone: 0,
  racesDriven: 0,
  rainWins: 0,
  passive: 0,
});

export function makeCalendar(): string[] {
  const rest = shuffle(TRACKS.map((t) => t.id).filter((id) => id !== 'eifel'));
  return ['eifel', ...rest];
}

export interface TeamSetup {
  name: string;
  short: string;
  color: string;
  color2: string;
  logo: LogoKind;
  region: Region;
}

export function createGame(setup: TeamSetup, settings?: Settings): GameState {
  const tier = 0;
  const { teams, drivers } = makeAITeams(tier, 7, setup.name, setup.region);
  const market = makeDriverMarket(tier, setup.region, 10);
  const all: Record<string, Driver> = {};
  for (const d of [...drivers, ...market]) all[d.id] = d;
  const s: GameState = {
    version: SAVE_VERSION,
    created: true,
    createdAt: Date.now(),
    team: {
      id: 'player',
      name: setup.name,
      short: setup.short,
      color: setup.color,
      color2: setup.color2,
      logo: setup.logo,
      region: setup.region,
      isPlayer: true,
      carStats: { power: 0, accel: 0, topSpeed: 0, braking: 0, handling: 0, aero: 0, tyreCare: 0, reliability: 0, weight: 0 },
      driverIds: [],
      strength: 0,
      pitCrew: 0,
    },
    money: 1400000,
    reputation: 10,
    tier,
    season: 1,
    round: 0,
    calendar: makeCalendar(),
    car: {
      chassisId: '',
      parts: { engine: 0, brakes: 0, tyres: 0, suspension: 0, aero: 0, gearbox: 0, cooling: 0 },
      condition: { engine: 1, gearbox: 1, brakes: 1, frontWing: 1, suspension: 1 },
    },
    facility: 1,
    plots: {},
    lastTick: Date.now(),
    drivers: all,
    aiTeams: teams,
    staff: {},
    staffMarket: makeStaffMarket(tier, 10),
    driverMarket: market.map((d) => d.id),
    academy: [],
    sponsors: [],
    sponsorOffers: [],
    research: {},
    developments: [],
    results: [],
    ledger: [],
    stats: emptyStats(),
    achievements: {},
    pendingEvents: [],
    weekend: null,
    history: [],
    settings: settings ?? { ...DEFAULT_SETTINGS },
    tutorialDone: false,
    tipsSeen: {},
    news: [],
    seasonEnd: null,
    nextId: 1,
    flags: {},
  };
  s.sponsorOffers = makeSponsorOffers(s);
  news(s, `Willkommen in der ${TIERS[tier].name}! ${setup.name} startet in die erste Saison.`, 'neutral');
  return s;
}

export const bookCapture: { list: LedgerEntry[] | null } = { list: null };

export function book(s: GameState, label: string, amount: number, category: LedgerEntry['category']) {
  if (!amount) return;
  s.money += amount;
  if (amount > 0) s.stats.income += amount;
  else s.stats.expenses += -amount;
  const entry = { season: s.season, round: s.round, label, amount, category };
  s.ledger.push(entry);
  bookCapture.list?.push(entry);
  if (s.ledger.length > 400) s.ledger.splice(0, s.ledger.length - 400);
  if (s.money >= 3_000_000) unlock(s, 'millionaire');
  if (s.money >= 15_000_000) unlock(s, 'multi_millionaire');
}

export function news(s: GameState, text: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') {
  s.news.unshift({ id: `n${s.nextId++}`, text, tone, season: s.season, round: s.round });
  if (s.news.length > 40) s.news.length = 40;
}

export const newAchievements: string[] = [];
export function unlock(s: GameState, id: string) {
  if (s.achievements[id]) return;
  s.achievements[id] = Date.now();
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (a) {
    news(s, `Erfolg freigeschaltet: ${a.name}`, 'good');
    newAchievements.push(a.name);
  }
}

export const playerDrivers = (s: GameState) => s.team.driverIds.map((id) => s.drivers[id]).filter(Boolean);

// ---------- Fahrzeug ----------
export function buyChassis(s: GameState, id: string): string | null {
  const ch = CHASSIS_BY_ID[id];
  if (!ch) return 'Unbekanntes Chassis.';
  if (ch.tier > s.tier) return 'Dieses Chassis ist erst in einer höheren Rennklasse verfügbar.';
  if (s.car.chassisId === id) return 'Dieses Chassis fährst du bereits.';
  const old = CHASSIS_BY_ID[s.car.chassisId];
  const resale = old ? Math.round(old.price * 0.4) : 0;
  if (s.money + resale < ch.price) return 'Nicht genug Budget.';
  if (old) book(s, `Verkauf ${old.name}`, resale, 'purchase');
  book(s, `Kauf ${ch.name}`, -ch.price, 'purchase');
  s.car.chassisId = id;
  s.car.condition = { engine: 1, gearbox: 1, brakes: 1, frontWing: 1, suspension: 1 };
  news(s, `Neues Chassis: ${ch.name}`, 'good');
  return null;
}

export function startPartUpgrade(s: GameState, part: PartKey): string | null {
  const cap = FACILITY[s.facility - 1].partCap;
  if (s.car.parts[part] >= cap) return `Maximale Stufe für deine ${FACILITY[s.facility - 1].name} erreicht. Baue die Fabrik aus.`;
  if (s.developments.some((d) => d.kind === 'part' && d.target === part)) return 'Dieses Bauteil wird bereits entwickelt.';
  const busy = s.developments.filter((d) => d.kind === 'part').length;
  if (busy >= devSlots(s).parts) return 'Alle Entwicklungsplätze sind belegt.';
  const cost = partCost(s, part);
  if (s.money < cost) return 'Nicht genug Budget.';
  const time = partTime(s, part);
  book(s, `Upgrade ${PARTS[part].label} Stufe ${s.car.parts[part] + 1}`, -cost, 'upgrade');
  s.developments.push({ id: genId('dev'), kind: 'part', target: part, remaining: time, total: time, label: `${PARTS[part].label} Stufe ${s.car.parts[part] + 1}` });
  return null;
}

export function startResearch(s: GameState, id: string): string | null {
  const r = RESEARCH_BY_ID[id];
  if (!r) return 'Unbekanntes Projekt.';
  if (s.research[id]) return 'Bereits erforscht.';
  if (!r.requires.every((q) => s.research[q])) return 'Voraussetzungen fehlen.';
  if (s.developments.some((d) => d.kind === 'research' && d.target === id)) return 'Wird bereits erforscht.';
  if (s.developments.filter((d) => d.kind === 'research').length >= devSlots(s).research) return 'Das Forschungslabor ist ausgelastet.';
  const cost = researchCost(s, r.cost);
  if (s.money < cost) return 'Nicht genug Budget.';
  const time = researchTime(s, r.time);
  book(s, `Forschung ${r.name}`, -cost, 'research');
  s.developments.push({ id: genId('dev'), kind: 'research', target: id, remaining: time, total: time, label: r.name });
  return null;
}

export function startFacilityUpgrade(s: GameState): string | null {
  const next = FACILITY[s.facility];
  if (!next) return 'Die Fabrik ist voll ausgebaut.';
  if (s.developments.some((d) => d.kind === 'facility')) return 'Der Ausbau läuft bereits.';
  const cost = Math.round(next.cost * (1 + s.tier * 0.5));
  if (s.money < cost) return 'Nicht genug Budget.';
  book(s, `Ausbau: ${next.name}`, -cost, 'facility');
  s.developments.push({ id: genId('dev'), kind: 'facility', target: 'facility', remaining: next.time, total: next.time, label: next.name });
  return null;
}

export function facilityCost(s: GameState) {
  const next = FACILITY[s.facility];
  return next ? Math.round(next.cost * (1 + s.tier * 0.5)) : 0;
}

export function repairCost(s: GameState, k: ConditionKey) {
  const chief = staffSkill(s, 'chiefMechanic');
  return Math.round(((1 - s.car.condition[k]) * CONDITION_COST[k] * TIERS[s.tier].money * (1 - Math.max(0, chief - 30) * 0.004)) / 100) * 100;
}

export function repair(s: GameState, keys: ConditionKey[]): string | null {
  const total = keys.reduce((a, k) => a + repairCost(s, k), 0);
  if (total <= 0) return null;
  if (s.money < total) return 'Nicht genug Budget für die Reparatur.';
  book(s, keys.length > 1 ? 'Reparatur komplett' : `Reparatur`, -total, 'repair');
  for (const k of keys) s.car.condition[k] = 1;
  return null;
}

// ---------- Fahrer ----------
export function signingFee(d: Driver) {
  return d.salary * 2;
}

export function signDriver(s: GameState, id: string, replaceId?: string): string | null {
  const d = s.drivers[id];
  if (!d) return 'Fahrer nicht gefunden.';
  if (s.team.driverIds.includes(id)) return 'Steht bereits unter Vertrag.';
  if (s.team.driverIds.length >= 2 && !replaceId) return 'Beide Cockpits sind besetzt. Wähle einen Fahrer, der ersetzt wird.';
  if (d.academy) return promoteAcademy(s, id, replaceId);
  if (s.reputation + 30 < driverRequiredRep(s, d)) return `${d.name} hält dein Team noch nicht für konkurrenzfähig (Reputation zu niedrig).`;
  const fee = signingFee(d);
  if (s.money < fee) return 'Nicht genug Budget für die Unterschriftsprämie.';
  if (replaceId) releaseDriver(s, replaceId, true);
  book(s, `Vertrag ${d.name}`, -fee, 'salary');
  d.teamId = 'player';
  d.contract = Math.max(d.contract, 7);
  s.team.driverIds.push(id);
  s.driverMarket = s.driverMarket.filter((x) => x !== id);
  news(s, `${d.name} unterschreibt bei ${s.team.name}.`, 'good');
  return null;
}

export function driverRequiredRep(s: GameState, d: Driver) {
  const r = (d.stats.speed + d.stats.cornering + d.stats.consistency) / 3;
  const tierBase = TIERS[s.tier].aiMin;
  return Math.max(0, Math.round((r - tierBase) * 1.6));
}

export function releaseCost(d: Driver) {
  return Math.round(d.salary * Math.min(d.contract, 4) * 0.5);
}

export function releaseDriver(s: GameState, id: string, silent = false): string | null {
  const d = s.drivers[id];
  if (!d) return 'Fahrer nicht gefunden.';
  if (s.academy.includes(id)) {
    s.academy = s.academy.filter((x) => x !== id);
    d.academy = false;
    d.teamId = null;
    return null;
  }
  const cost = releaseCost(d);
  book(s, `Abfindung ${d.name}`, -cost, 'salary');
  s.team.driverIds = s.team.driverIds.filter((x) => x !== id);
  d.teamId = null;
  d.contract = 0;
  s.driverMarket.push(id);
  if (!silent) news(s, `${d.name} verlässt das Team.`, 'neutral');
  return null;
}

export function renewDriver(s: GameState, id: string, races: number): string | null {
  const d = s.drivers[id];
  if (!d) return 'Fahrer nicht gefunden.';
  const newSalary = Math.round((driverSalary(d, s.tier) * (d.morale < 50 ? 1.15 : 1)) / 500) * 500;
  const bonus = newSalary;
  if (s.money < bonus) return 'Nicht genug Budget für die Verlängerungsprämie.';
  book(s, `Verlängerung ${d.name}`, -bonus, 'salary');
  d.salary = Math.max(d.salary, newSalary);
  d.contract += races;
  d.morale = clamp(d.morale + 8, 0, 100);
  return null;
}

export function academyCost(s: GameState) {
  return Math.round(25000 * TIERS[s.tier].money);
}

export function signAcademy(s: GameState, id: string): string | null {
  const d = s.drivers[id];
  if (!d) return 'Fahrer nicht gefunden.';
  if (s.academy.length >= 3) return 'Die Akademie ist voll (max. 3 Talente).';
  const cost = academyCost(s);
  if (s.money < cost) return 'Nicht genug Budget.';
  book(s, `Akademie: ${d.name}`, -cost, 'salary');
  d.academy = true;
  d.teamId = 'academy';
  d.talentKnown = true;
  d.salary = Math.round(2000 * TIERS[s.tier].money);
  s.academy.push(id);
  s.driverMarket = s.driverMarket.filter((x) => x !== id);
  unlock(s, 'academy');
  news(s, `${d.name} kommt in die Nachwuchsakademie.`, 'good');
  return null;
}

export function promoteAcademy(s: GameState, id: string, replaceId?: string): string | null {
  const d = s.drivers[id];
  if (!d || !s.academy.includes(id)) return 'Nicht in der Akademie.';
  if (s.team.driverIds.length >= 2) {
    if (!replaceId) return 'Wähle einen Fahrer, der das Cockpit räumt.';
    releaseDriver(s, replaceId, true);
  }
  s.academy = s.academy.filter((x) => x !== id);
  d.academy = false;
  d.teamId = 'player';
  d.salary = driverSalary(d, s.tier);
  d.contract = 14;
  s.team.driverIds.push(id);
  news(s, `${d.name} steigt aus der Akademie ins Renncockpit auf!`, 'good');
  return null;
}

export function scoutTalent(s: GameState) {
  // Datenanalyst erkennt Talent
  const an = staffSkill(s, 'dataAnalyst');
  for (const id of s.driverMarket) {
    const d = s.drivers[id];
    if (d && an >= 55) d.talentKnown = true;
  }
}

// ---------- Mitarbeiter ----------
export function hireStaff(s: GameState, staffId: string): string | null {
  const st = s.staffMarket.find((x) => x.id === staffId);
  if (!st) return 'Nicht gefunden.';
  const fee = st.salary * 2;
  if (s.money < fee) return 'Nicht genug Budget.';
  const old = s.staff[st.role];
  if (old) {
    book(s, `Abfindung ${old.name}`, -old.salary * 2, 'staff');
  }
  book(s, `Einstellung ${st.name}`, -fee, 'staff');
  s.staff[st.role] = st;
  s.staffMarket = s.staffMarket.filter((x) => x.id !== staffId);
  if (old) s.staffMarket.push(old);
  if (st.role === 'dataAnalyst') scoutTalent(s);
  news(s, `${st.name} verstärkt das Team.`, 'good');
  return null;
}

export function fireStaff(s: GameState, role: Staff['role']) {
  const old = s.staff[role];
  if (!old) return;
  book(s, `Abfindung ${old.name}`, -old.salary * 2, 'staff');
  delete s.staff[role];
}

// ---------- Sponsoren ----------
export function sponsorSlots(s: GameState) {
  return { main: 1, secondary: s.reputation >= 45 ? 3 : 2 };
}

export function signSponsor(s: GameState, id: string): string | null {
  const sp = s.sponsorOffers.find((x) => x.id === id);
  if (!sp) return 'Angebot nicht mehr verfügbar.';
  if (s.reputation < sp.minReputation) return `Benötigt ${sp.minReputation} Reputation.`;
  const slots = sponsorSlots(s);
  const used = s.sponsors.filter((x) => x.slot === sp.slot).length;
  if (used >= (sp.slot === 'main' ? slots.main : slots.secondary)) return sp.slot === 'main' ? 'Du hast bereits einen Hauptsponsor.' : 'Alle Nebensponsor-Plätze sind belegt.';
  book(s, `Unterschrift ${sp.name}`, sp.signingBonus, 'sponsor');
  s.sponsors.push({ ...sp, satisfaction: 70, misses: 0 });
  s.sponsorOffers = s.sponsorOffers.filter((x) => x.id !== id);
  news(s, `${sp.name} wird ${sp.slot === 'main' ? 'Hauptsponsor' : 'Partner'}.`, 'good');
  return null;
}

export function cancelSponsor(s: GameState, id: string) {
  const sp = s.sponsors.find((x) => x.id === id);
  if (!sp) return;
  s.sponsors = s.sponsors.filter((x) => x.id !== id);
  s.reputation = clamp(s.reputation - 3, 0, 100);
  news(s, `Vertrag mit ${sp.name} aufgelöst.`, 'bad');
}

// ---------- Entwicklung abschließen ----------
export function tickDevelopments(s: GameState) {
  for (const d of s.developments) d.remaining -= 1;
  const done = s.developments.filter((d) => d.remaining <= 0);
  s.developments = s.developments.filter((d) => d.remaining > 0);
  for (const d of done) {
    if (d.kind === 'part') {
      const p = d.target as PartKey;
      s.car.parts[p] += 1;
      s.stats.upgradesDone++;
      if (s.car.parts[p] >= 10) unlock(s, 'max_part');
      news(s, `Upgrade fertig: ${d.label}`, 'good');
    } else if (d.kind === 'research') {
      s.research[d.target] = true;
      s.stats.researchDone++;
      if (s.stats.researchDone >= 10) unlock(s, 'researcher');
      news(s, `Forschung abgeschlossen: ${d.label}`, 'good');
    } else if (d.kind === 'facility') {
      s.facility += 1;
      news(s, `Ausbau abgeschlossen: ${FACILITY[s.facility - 1].name}`, 'good');
    }
  }
}

export function refreshMarkets(s: GameState) {
  // Fahrermarkt: alte, nicht verpflichtete Fahrer teilweise ersetzen
  const keep = s.driverMarket.filter(() => Math.random() < 0.55);
  for (const id of s.driverMarket) if (!keep.includes(id)) delete s.drivers[id];
  const fresh = makeDriverMarket(s.tier, s.team.region, s.reputation).slice(0, 12 - keep.length);
  for (const d of fresh) s.drivers[d.id] = d;
  s.driverMarket = [...keep, ...fresh.map((d) => d.id)];
  scoutTalent(s);
  s.staffMarket = makeStaffMarket(s.tier, s.reputation);
  s.sponsorOffers = makeSponsorOffers(s);
}

export function staffMarketSalaryRefresh(s: GameState) {
  for (const st of s.staffMarket) st.salary = staffSalary(st.skill, s.tier);
}

export function discoverTalent(s: GameState): Driver {
  const d = makeDriver(TIERS[s.tier].aiMin - 10, { region: s.team.region, archetype: 'rookie', tier: s.tier });
  d.talent = Math.max(d.talent, 82 + Math.round(Math.random() * 14));
  d.talentKnown = true;
  s.drivers[d.id] = d;
  s.driverMarket.push(d.id);
  return d;
}

export function totalSalaries(s: GameState) {
  const drivers = playerDrivers(s).reduce((a, d) => a + d.salary, 0);
  const academy = s.academy.reduce((a, id) => a + (s.drivers[id]?.salary ?? 0), 0);
  const staff = Object.values(s.staff).reduce((a, st) => a + (st?.salary ?? 0), 0);
  return { drivers, academy, staff, travel: TIERS[s.tier].travel };
}

export function sponsorIncomePerRace(s: GameState) {
  return s.sponsors.reduce((a, sp) => a + sp.perRace, 0);
}

export function setupComplete(s: GameState) {
  return !!s.car.chassisId && s.team.driverIds.length >= 2 && s.sponsors.length >= 1;
}

export type { Sponsor };
