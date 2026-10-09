import { loc, lazyRecord } from '../i18n';
import type { CarStats, Chassis, Compound, PartKey, StaffRole, ConditionKey } from '../types';

// Texte (Namen, Beschreibungen) liegen in src/i18n/{de,en}/data.ts unter `catalog.<tabelle>.<id>.<feld>`.
// Die Tabellen behalten ihre Form: die Textfelder sind Getter, die bei jedem Zugriff in der aktuellen Sprache übersetzen.
const blank = <F extends string>(fields: readonly F[]) => Object.fromEntries(fields.map((f) => [f, ''])) as Record<F, string>;

function locRows<R extends object, F extends string>(prefix: string, rows: readonly R[], fields: readonly F[], idOf: (r: R, i: number) => string): (R & Record<F, string>)[] {
  return rows.map((r, i) => loc(prefix, { id: idOf(r, i), ...blank(fields), ...r }, fields as never) as unknown as R & Record<F, string>);
}

function locTable<K extends string, R extends object, F extends string>(prefix: string, raw: Record<K, R>, fields: readonly F[]): Record<K, R & Record<F, string>> {
  const out = {} as Record<K, R & Record<F, string>>;
  for (const k of Object.keys(raw) as K[]) out[k] = loc(prefix, { id: k, ...blank(fields), ...raw[k] }, fields as never) as unknown as R & Record<F, string>;
  return out;
}

const TIER_DATA = [
  {
    money: 1,
    travel: 12000,
    aiMin: 40,
    aiMax: 54,
    promoteRep: 30,
    laps: { short: 3, medium: 4, long: 7 },
  },
  {
    money: 2.6,
    travel: 32000,
    aiMin: 56,
    aiMax: 71,
    promoteRep: 60,
    laps: { short: 3, medium: 5, long: 8 },
  },
  {
    money: 6.5,
    travel: 80000,
    aiMin: 72,
    aiMax: 89,
    promoteRep: 101,
    laps: { short: 3, medium: 6, long: 10 },
  },
];
/** Rennklassen: name, short und desc sind übersetzte Getter (`catalog.tier.<index>.…`) */
export const TIERS = locRows('catalog.tier', TIER_DATA, ['name', 'short', 'desc'], (_r, i) => String(i));

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const PRIZE = [90000, 70000, 56000, 46000, 39000, 33000, 28000, 24000, 20000, 17000, 14000, 12000, 10000, 8500, 7000, 6000];
export const TEAM_SEASON_PRIZE = [600000, 380000, 260000, 190000, 150000, 120000, 100000, 80000];

export const STAT_LABELS: Record<keyof CarStats, string> = lazyRecord<keyof CarStats>('catalog.stat', ['power', 'accel', 'topSpeed', 'braking', 'handling', 'aero', 'tyreCare', 'reliability', 'weight']);

const CHASSIS_DATA: Chassis[] = [
  {
    id: 'mirage', name: '', tier: 0, price: 210000,
    base: { power: 38, accel: 40, topSpeed: 40, braking: 37, handling: 36, aero: 34, tyreCare: 46, reliability: 48, weight: 690 },
    description: '',
  },
  {
    id: 'kestrel', name: 'Kestrel RS', tier: 0, price: 360000,
    base: { power: 45, accel: 46, topSpeed: 45, braking: 45, handling: 44, aero: 42, tyreCare: 50, reliability: 58, weight: 672 },
    description: '',
  },
  {
    id: 'talon', name: 'Talon X', tier: 0, price: 520000,
    base: { power: 51, accel: 52, topSpeed: 50, braking: 50, handling: 51, aero: 50, tyreCare: 46, reliability: 52, weight: 662 },
    description: '',
  },
  {
    id: 'vector', name: 'Vanta C1', tier: 1, price: 1300000,
    base: { power: 60, accel: 60, topSpeed: 60, braking: 59, handling: 58, aero: 60, tyreCare: 55, reliability: 60, weight: 655 },
    description: '',
  },
  {
    id: 'stratos', name: 'Corvo C2', tier: 1, price: 2100000,
    base: { power: 66, accel: 65, topSpeed: 64, braking: 65, handling: 66, aero: 67, tyreCare: 58, reliability: 62, weight: 645 },
    description: '',
  },
  {
    id: 'helios', name: 'Helios W-1', tier: 2, price: 5200000,
    base: { power: 76, accel: 75, topSpeed: 76, braking: 75, handling: 75, aero: 77, tyreCare: 62, reliability: 66, weight: 638 },
    description: '',
  },
  {
    id: 'zenith', name: 'Aurelian W-2', tier: 2, price: 8400000,
    base: { power: 82, accel: 81, topSpeed: 81, braking: 80, handling: 82, aero: 84, tyreCare: 65, reliability: 68, weight: 630 },
    description: '',
  },
];
/** Chassis: Beschreibung übersetzt; der Name ist ein Eigenname und bleibt (nur „Marlin F-N (gebraucht)“ trägt einen Zusatz und wird übersetzt) */
const CHASSIS_NAME_TRANSLATED = new Set(['mirage']);
export const CHASSIS: Chassis[] = CHASSIS_DATA.map((c) => loc('catalog.chassis', c, CHASSIS_NAME_TRANSLATED.has(c.id) ? ['name', 'description'] : ['description']));
export const CHASSIS_BY_ID: Record<string, Chassis> = Object.fromEntries(CHASSIS.map((c) => [c.id, c]));

const PART_DATA: Record<PartKey, { base: number; effect: Partial<CarStats> }> = {
  engine: { base: 45000, effect: { power: 3, topSpeed: 1.5, accel: 1, reliability: -0.3 } },
  brakes: { base: 28000, effect: { braking: 3.5 } },
  tyres: { base: 25000, effect: { tyreCare: 3, handling: 1 } },
  suspension: { base: 32000, effect: { handling: 3, tyreCare: 0.5 } },
  aero: { base: 40000, effect: { aero: 3.5, topSpeed: -0.3 } },
  gearbox: { base: 30000, effect: { accel: 3, reliability: 0.5 } },
  cooling: { base: 22000, effect: { reliability: 3, power: 0.5 } },
};
/** Bauteile: label und desc sind übersetzte Getter (`catalog.part.<id>.label|desc`; `.name` ist ein Alias von `.label`) */
export const PARTS: Record<PartKey, { label: string; desc: string; base: number; effect: Partial<CarStats> }> = locTable('catalog.part', PART_DATA, ['label', 'desc']);
export const PART_KEYS = Object.keys(PARTS) as PartKey[];

export const CONDITION_LABELS: Record<ConditionKey, string> = lazyRecord<ConditionKey>('catalog.condition', ['engine', 'gearbox', 'brakes', 'frontWing', 'suspension']);
export const CONDITION_COST: Record<ConditionKey, number> = {
  engine: 90000,
  gearbox: 50000,
  brakes: 24000,
  frontWing: 30000,
  suspension: 36000,
};

const FACILITY_DATA = [
  { level: 1, cost: 0, time: 0, partCap: 4 },
  { level: 2, cost: 350000, time: 2, partCap: 6 },
  { level: 3, cost: 950000, time: 3, partCap: 8 },
  { level: 4, cost: 2400000, time: 4, partCap: 10 },
];
/** Werkstatt-Ausbaustufen: name ist ein übersetzter Getter (`catalog.facility.<index>.name`) */
export const FACILITY = locRows('catalog.facility', FACILITY_DATA, ['name'], (_r, i) => String(i));

const COMPOUND_DATA: Record<Compound, { short: string; color: string; dry: number; life: number }> = {
  soft: { short: 'S', color: '#ff3b47', dry: 1.0, life: 0.42 },
  medium: { short: 'M', color: '#ffd23f', dry: 0.975, life: 0.68 },
  hard: { short: 'H', color: '#f2f4f5', dry: 0.95, life: 1.05 },
  inter: { short: 'I', color: '#3ecf6a', dry: 0.86, life: 0.7 },
  wet: { short: 'W', color: '#3b8cff', dry: 0.78, life: 0.8 },
};
/** Reifenmischungen: label und desc sind übersetzte Getter (`catalog.compound.<c>.label|desc`) */
export const COMPOUNDS: Record<Compound, { label: string; short: string; color: string; dry: number; life: number; desc: string }> = locTable('catalog.compound', COMPOUND_DATA, ['label', 'desc']);
export const COMPOUND_KEYS = Object.keys(COMPOUNDS) as Compound[];

/** Mitarbeiterrollen: label, desc und effect sind übersetzte Getter (`catalog.staffRole.<role>.…`) */
const STAFF_ROLE_IDS: StaffRole[] = ['raceEngineer', 'mechanic', 'chiefMechanic', 'aeroEngineer', 'engineEngineer', 'dataAnalyst'];
export const STAFF_ROLES: Record<StaffRole, { label: string; desc: string; effect: string }> = locTable(
  'catalog.staffRole',
  Object.fromEntries(STAFF_ROLE_IDS.map((r) => [r, {}])) as Record<StaffRole, object>,
  ['label', 'desc', 'effect'],
);
export const STAFF_KEYS = Object.keys(STAFF_ROLES) as StaffRole[];

export interface ResearchNode {
  id: string;
  branch: 'engine' | 'aero' | 'chassis' | 'tyres' | 'pit';
  name: string;
  desc: string;
  cost: number;
  time: number;
  requires: string[];
  stats?: Partial<CarStats>;
  fuelSave?: number;
  pitBonus?: number;
  stability?: number;
  grip?: number;
}

export const RESEARCH_BRANCHES: Record<ResearchNode['branch'], string> = lazyRecord<ResearchNode['branch']>('catalog.branch', ['engine', 'aero', 'chassis', 'tyres', 'pit']);

const RESEARCH_DATA: Omit<ResearchNode, 'name' | 'desc'>[] = [
  { id: 'eng_pow1', branch: 'engine', cost: 60000, time: 2, requires: [], stats: { power: 4, topSpeed: 1 } },
  { id: 'eng_pow2', branch: 'engine', cost: 150000, time: 3, requires: ['eng_pow1'], stats: { power: 5, topSpeed: 2 } },
  { id: 'eng_pow3', branch: 'engine', cost: 340000, time: 4, requires: ['eng_pow2', 'eng_rel1'], stats: { power: 6, accel: 3, topSpeed: 2 } },
  { id: 'eng_eff1', branch: 'engine', cost: 50000, time: 2, requires: [], fuelSave: 0.06 },
  { id: 'eng_eff2', branch: 'engine', cost: 130000, time: 3, requires: ['eng_eff1'], fuelSave: 0.08, stats: { power: 1 } },
  { id: 'eng_rel1', branch: 'engine', cost: 55000, time: 2, requires: [], stats: { reliability: 6 } },
  { id: 'eng_rel2', branch: 'engine', cost: 140000, time: 3, requires: ['eng_rel1'], stats: { reliability: 8 } },

  { id: 'aero_df1', branch: 'aero', cost: 65000, time: 2, requires: [], stats: { aero: 4 } },
  { id: 'aero_df2', branch: 'aero', cost: 160000, time: 3, requires: ['aero_df1'], stats: { aero: 5 } },
  { id: 'aero_df3', branch: 'aero', cost: 360000, time: 4, requires: ['aero_df2', 'ch_corner1'], stats: { aero: 6, handling: 2 } },
  { id: 'aero_drag1', branch: 'aero', cost: 60000, time: 2, requires: [], stats: { topSpeed: 3 } },
  { id: 'aero_drag2', branch: 'aero', cost: 150000, time: 3, requires: ['aero_drag1'], stats: { topSpeed: 4 } },

  { id: 'ch_corner1', branch: 'chassis', cost: 60000, time: 2, requires: [], stats: { handling: 4 } },
  { id: 'ch_corner2', branch: 'chassis', cost: 150000, time: 3, requires: ['ch_corner1'], stats: { handling: 5 } },
  { id: 'ch_corner3', branch: 'chassis', cost: 330000, time: 4, requires: ['ch_corner2', 'ch_stab1'], stats: { handling: 6 } },
  { id: 'ch_stab1', branch: 'chassis', cost: 55000, time: 2, requires: [], stability: 0.15, stats: { handling: 1 } },
  { id: 'ch_stab2', branch: 'chassis', cost: 140000, time: 3, requires: ['ch_stab1'], stability: 0.2, stats: { handling: 2, tyreCare: 2 } },

  { id: 'ty_grip1', branch: 'tyres', cost: 55000, time: 2, requires: [], grip: 0.012 },
  { id: 'ty_grip2', branch: 'tyres', cost: 140000, time: 3, requires: ['ty_grip1'], grip: 0.016 },
  { id: 'ty_wear1', branch: 'tyres', cost: 50000, time: 2, requires: [], stats: { tyreCare: 5 } },
  { id: 'ty_wear2', branch: 'tyres', cost: 120000, time: 3, requires: ['ty_wear1'], stats: { tyreCare: 5 } },
  { id: 'ty_wear3', branch: 'tyres', cost: 260000, time: 4, requires: ['ty_wear2', 'ty_grip1'], stats: { tyreCare: 6 } },

  { id: 'pit1', branch: 'pit', cost: 45000, time: 1, requires: [], pitBonus: 0.4 },
  { id: 'pit2', branch: 'pit', cost: 110000, time: 2, requires: ['pit1'], pitBonus: 0.4 },
  { id: 'pit3', branch: 'pit', cost: 230000, time: 3, requires: ['pit2'], pitBonus: 0.5 },
];
/** Forschungsprojekte: name und desc sind übersetzte Getter (`catalog.research.<id>.name|desc`) */
export const RESEARCH: ResearchNode[] = locRows('catalog.research', RESEARCH_DATA, ['name', 'desc'], (r) => r.id);
export const RESEARCH_BY_ID: Record<string, ResearchNode> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

const ACHIEVEMENT_IDS = [
  'first_points', 'first_podium', 'first_win', 'pole', 'underdog', 'perfect', 'rain_master', 'double_podium', 'driver_win', 'millionaire',
  'multi_millionaire', 'champion', 'promotion', 'world_champion', 'max_part', 'researcher', 'fast_pit', 'iron_man', 'academy', 'overtaker',
];
/** Erfolge: name und desc sind übersetzte Getter (`catalog.achievement.<id>.name|desc`) */
export const ACHIEVEMENTS: { id: string; name: string; desc: string }[] = locRows('catalog.achievement', ACHIEVEMENT_IDS.map((id) => ({ id })), ['name', 'desc'], (r) => r.id);

export const STYLE_LABELS = lazyRecord('catalog.style', ['conserve', 'balanced', 'attack'] as const);
export const OVERTAKE_LABELS = lazyRecord('catalog.overtake', ['cautious', 'normal', 'risky'] as const);
export const WEATHER_LABELS = lazyRecord('catalog.weather', ['sunny', 'cloudy', 'lightRain', 'heavyRain'] as const);
