import { AI_TEAM_POOL, COUNTRIES, FIRST, LAST, SPONSOR_POOL } from '../data/names';
import { STAFF_ROLES, TIERS } from '../data/catalog';
import { m } from '../i18n';
import type { CarStats, Driver, DriverStats, GameState, Region, Sponsor, SponsorGoal, Staff, StaffRole, Team } from '../types';
import { clamp, gauss, pick, rand, randInt, shuffle } from './util';

let counter = 0;
export const genId = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

const ALL_COUNTRIES = Object.values(COUNTRIES).flat();

export function randomName(country?: string) {
  const c = country ?? pick(ALL_COUNTRIES);
  const first = pick(FIRST[c] ?? FIRST.DE);
  const last = pick(LAST[c] ?? LAST.DE);
  return { name: `${first} ${last}`, country: c };
}

export function countryFor(region?: Region) {
  if (region && Math.random() < 0.55) return pick(COUNTRIES[region]);
  return pick(ALL_COUNTRIES);
}

type Archetype = 'allround' | 'speedster' | 'steady' | 'rain' | 'tyre' | 'rookie';

export function makeDriver(quality: number, opts: { region?: Region; archetype?: Archetype; age?: number; tier?: number } = {}): Driver {
  const { name, country } = randomName(countryFor(opts.region));
  const arch: Archetype = opts.archetype ?? pick(['allround', 'allround', 'speedster', 'steady', 'rain', 'tyre']);
  const q = quality;
  const v = (bias = 0, spread = 8) => clamp(Math.round(q + bias + gauss() * spread), 15, 99);
  const s: DriverStats = {
    speed: v(),
    braking: v(),
    cornering: v(),
    reaction: v(0, 12),
    consistency: v(),
    aggression: v(0, 15),
    wet: v(0, 12),
    tyreMgmt: v(),
    experience: v(0, 10),
  };
  const traits: string[] = [];
  switch (arch) {
    case 'speedster':
      s.speed = clamp(s.speed + 10, 15, 99);
      s.cornering = clamp(s.cornering + 6, 15, 99);
      s.aggression = clamp(s.aggression + 22, 15, 99);
      s.consistency = clamp(s.consistency - 12, 15, 99);
      break;
    case 'steady':
      s.consistency = clamp(s.consistency + 14, 15, 99);
      s.speed = clamp(s.speed - 6, 15, 99);
      s.aggression = clamp(s.aggression - 15, 15, 99);
      s.tyreMgmt = clamp(s.tyreMgmt + 6, 15, 99);
      break;
    case 'rain':
      s.wet = clamp(s.wet + 20, 15, 99);
      break;
    case 'tyre':
      s.tyreMgmt = clamp(s.tyreMgmt + 16, 15, 99);
      s.speed = clamp(s.speed - 3, 15, 99);
      break;
    case 'rookie':
      s.experience = clamp(Math.round(rand(5, 22)), 1, 99);
      s.consistency = clamp(s.consistency - 8, 15, 99);
      break;
  }
  const age = opts.age ?? (arch === 'rookie' ? randInt(16, 19) : randInt(19, 36));
  if (age > 30) s.experience = clamp(s.experience + (age - 30) * 3, 15, 99);
  const talent = clamp(Math.round((arch === 'rookie' ? q + rand(12, 32) : q + rand(-4, 14) - Math.max(0, age - 27) * 1.5)), 20, 99);
  if (s.speed >= 72 && s.speed >= q + 6) traits.push(m('gen.trait.fast'));
  if (s.aggression >= 72) traits.push(m('gen.trait.aggressive'));
  if (s.consistency >= 72 && s.consistency >= q + 8) traits.push(m('gen.trait.flawless'));
  if (s.wet >= 74) traits.push(m('gen.trait.rainSpecialist'));
  if (s.tyreMgmt >= 72 && s.tyreMgmt >= q + 8) traits.push(m('gen.trait.tyreWhisperer'));
  if (s.reaction >= 76) traits.push(m('gen.trait.quickStarter'));
  if (age <= 19) traits.push(m('gen.trait.prospect'));
  const d: Driver = {
    id: genId('d'),
    name,
    country,
    age,
    stats: s,
    talent,
    talentKnown: false,
    salary: 0,
    contract: randInt(7, 21),
    morale: randInt(60, 85),
    xp: 0,
    teamId: null,
    traits,
    careerWins: 0,
    careerPodiums: 0,
    careerRaces: randInt(0, Math.max(0, (age - 17) * 6)),
  };
  d.salary = driverSalary(d, opts.tier ?? 0);
  return d;
}

export function driverRating(d: Driver): number {
  const s = d.stats;
  return Math.round(
    s.speed * 0.22 + s.cornering * 0.2 + s.braking * 0.15 + s.consistency * 0.15 + s.reaction * 0.05 + s.tyreMgmt * 0.08 + s.wet * 0.07 + s.experience * 0.08,
  );
}

export function driverSalary(d: Driver, tier: number) {
  const r = driverRating(d) / 100;
  const base = 1500 + Math.pow(r, 3) * 62000 + Math.max(0, d.talent - 70) * 120;
  return Math.round((base * TIERS[Math.min(tier, 2)].money) / 500) * 500;
}

// Schlüssel der Mitarbeiter-Eigenschaften (werden mit m() zu Text, der erst beim Anzeigen übersetzt wird)
const STAFF_TRAITS: Record<StaffRole, string[]> = {
  raceEngineer: ['gen.staffTrait.calmRadio', 'gen.staffTrait.strategyFox', 'gen.staffTrait.dataLover'],
  mechanic: ['gen.staffTrait.quickHands', 'gen.staffTrait.teamPlayer', 'gen.staffTrait.perfectionist'],
  chiefMechanic: ['gen.staffTrait.oldHand', 'gen.staffTrait.organizer', 'gen.staffTrait.thrifty'],
  aeroEngineer: ['gen.staffTrait.windTunnelGuru', 'gen.staffTrait.cfdSpecialist', 'gen.staffTrait.creativeMind'],
  engineEngineer: ['gen.staffTrait.powerHunter', 'gen.staffTrait.durabilityPro', 'gen.staffTrait.hybridExpert'],
  dataAnalyst: ['gen.staffTrait.patternSpotter', 'gen.staffTrait.weatherWatcher', 'gen.staffTrait.talentScout'],
};

export function makeStaff(role: StaffRole, quality: number, tier = 0): Staff {
  const { name, country } = randomName();
  const skill = clamp(Math.round(quality + gauss() * 8), 15, 99);
  return {
    id: genId('s'),
    name,
    country,
    role,
    skill,
    salary: staffSalary(skill, tier),
    trait: Math.random() < 0.5 ? m(pick(STAFF_TRAITS[role])) : undefined,
  };
}

export function staffSalary(skill: number, tier: number) {
  return Math.round(((600 + skill * skill * 1.15) * TIERS[Math.min(tier, 2)].money) / 250) * 250;
}

export function makeStaffMarket(tier: number, reputation: number): Staff[] {
  const roles = Object.keys(STAFF_ROLES) as StaffRole[];
  const out: Staff[] = [];
  const base = 30 + tier * 15;
  for (const r of roles) {
    out.push(makeStaff(r, base + rand(-8, 4), tier));
    out.push(makeStaff(r, base + 12 + reputation * 0.15 + rand(-4, 8), tier));
    if (Math.random() < 0.6) out.push(makeStaff(r, base + 24 + reputation * 0.25, tier));
  }
  return out;
}

const GOAL_FACTOR: Record<string, number> = {};
function goalFactor(goal: SponsorGoal) {
  const key = `${goal.kind}${goal.value}`;
  if (GOAL_FACTOR[key]) return GOAL_FACTOR[key];
  let f = 1;
  if (goal.kind === 'finish') f = goal.value >= 10 ? 1 : goal.value >= 8 ? 1.3 : goal.value >= 5 ? 1.9 : goal.value >= 3 ? 2.9 : 4.2;
  if (goal.kind === 'quali') f = goal.value >= 10 ? 0.9 : goal.value >= 5 ? 1.7 : goal.value >= 3 ? 2.5 : 3.6;
  if (goal.kind === 'bothPoints') f = 1.7;
  GOAL_FACTOR[key] = f;
  return f;
}

/** Sponsorziel als m()-Text: jede Anzeige braucht tx(goalText(…)) */
export function goalText(g: SponsorGoal) {
  if (g.kind === 'finish') return g.value === 1 ? m('gen.goal.win') : g.value === 3 ? m('gen.goal.podium') : m('gen.goal.finish', { n: g.value });
  if (g.kind === 'quali') return g.value === 1 ? m('gen.goal.pole') : m('gen.goal.grid', { n: g.value });
  return m('gen.goal.bothPoints');
}

export function makeSponsor(state: Pick<GameState, 'tier' | 'reputation'>, slot: 'main' | 'secondary', difficulty?: number): Sponsor {
  const pool = pick(SPONSOR_POOL);
  const rep = state.reputation;
  const diff = difficulty ?? Math.random();
  let goal: SponsorGoal;
  if (diff < 0.35) goal = { kind: 'finish', value: Math.random() < 0.5 ? 12 : 10 };
  else if (diff < 0.55) goal = { kind: 'quali', value: 10 };
  else if (diff < 0.7) goal = { kind: 'finish', value: 8 };
  else if (diff < 0.82) goal = { kind: 'finish', value: 5 };
  else if (diff < 0.9) goal = { kind: 'bothPoints', value: 10 };
  else if (diff < 0.96) goal = { kind: 'finish', value: 3 };
  else goal = { kind: 'finish', value: 1 };
  const f = goalFactor(goal);
  const tierMoney = TIERS[Math.min(state.tier, 2)].money;
  const slotMult = slot === 'main' ? 1 : 0.45;
  const perRace = Math.round(((16000 + rep * 600) * f * slotMult * tierMoney * rand(0.85, 1.15)) / 1000) * 1000;
  return {
    id: genId('sp'),
    name: pool.name,
    industry: pool.industry,
    color: pool.color,
    perRace,
    signingBonus: Math.round((perRace * rand(1, 2.2)) / 1000) * 1000,
    goal,
    goalBonus: Math.round((perRace * rand(0.3, 0.6)) / 1000) * 1000,
    races: randInt(5, 14),
    minReputation: Math.max(0, Math.round((f - 1) * 14 + state.tier * 10 - 8)),
    slot,
    satisfaction: 70,
    misses: 0,
  };
}

export function makeSponsorOffers(state: Pick<GameState, 'tier' | 'reputation' | 'sponsors'>): Sponsor[] {
  const taken = new Set(state.sponsors.map((s) => s.name));
  const out: Sponsor[] = [];
  const diffs = [0.1, 0.45, 0.65, 0.78, 0.92, 0.98];
  for (const d of diffs) {
    const sp = makeSponsor(state, 'main', d);
    if (!taken.has(sp.name)) {
      out.push(sp);
      taken.add(sp.name);
    }
  }
  for (let i = 0; i < 4; i++) {
    const sp = makeSponsor(state, 'secondary', rand(0, 0.85));
    if (!taken.has(sp.name)) {
      out.push(sp);
      taken.add(sp.name);
    }
  }
  return out;
}

export function makeCarStats(strength: number): CarStats {
  const v = () => clamp(Math.round(strength + gauss() * 4), 10, 115);
  return {
    power: v(),
    accel: v(),
    topSpeed: v(),
    braking: v(),
    handling: v(),
    aero: v(),
    tyreCare: v(),
    reliability: clamp(Math.round(strength + 4 + gauss() * 6), 10, 115),
    weight: Math.round(700 - strength * 0.7 + rand(-6, 6)),
  };
}

export function makeAITeams(tier: number, count: number, playerName: string, region: Region): { teams: Team[]; drivers: Driver[] } {
  const t = TIERS[tier];
  const pool = shuffle(AI_TEAM_POOL).filter((p) => p.name !== playerName).slice(0, count);
  const teams: Team[] = [];
  const drivers: Driver[] = [];
  pool.forEach((p, i) => {
    const strength = t.aiMin + ((t.aiMax - t.aiMin) * (count - 1 - i)) / Math.max(1, count - 1) + rand(-2, 2);
    const id = genId('t');
    const ds = [0, 1].map(() => {
      const d = makeDriver(strength + rand(-6, 4), { tier, region: Math.random() < 0.3 ? region : undefined });
      d.teamId = id;
      d.contract = randInt(10, 30);
      return d;
    });
    drivers.push(...ds);
    teams.push({
      id,
      name: p.name,
      short: p.short,
      color: p.color,
      color2: p.color2,
      logo: pick(['shield', 'circle', 'chevron', 'wing', 'bolt', 'star', 'hex', 'flag'] as const),
      region: pick(['europe', 'americas', 'asia', 'oceania'] as const),
      isPlayer: false,
      carStats: makeCarStats(strength),
      driverIds: ds.map((d) => d.id),
      strength,
      pitCrew: clamp(Math.round(strength + rand(-10, 10)), 20, 99),
    });
  });
  return { teams, drivers };
}

export function makeDriverMarket(tier: number, region: Region, reputation: number): Driver[] {
  const t = TIERS[tier];
  const out: Driver[] = [];
  const lo = t.aiMin - 8;
  const hi = t.aiMax - 2 + reputation * 0.06;
  for (let i = 0; i < 9; i++) {
    const q = lo + ((hi - lo) * i) / 8 + rand(-3, 3);
    out.push(makeDriver(q, { region, tier }));
  }
  out.push(makeDriver(lo + 4, { region, tier, archetype: 'rookie' }));
  out.push(makeDriver(lo + 10, { region, tier, archetype: 'speedster' }));
  out.push(makeDriver(lo + 12, { region, tier, archetype: 'steady' }));
  return out;
}
