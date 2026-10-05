import type { CarStats, Chassis, Compound, PartKey, StaffRole, ConditionKey } from '../types';

export const TIERS = [
  {
    name: 'Formel Nachwuchs',
    short: 'FN',
    desc: 'Regionale Nachwuchsserie. Kleine Budgets, junge Fahrer, große Träume.',
    money: 1,
    travel: 12000,
    aiMin: 40,
    aiMax: 54,
    promoteRep: 30,
    laps: { short: 3, medium: 4, long: 7 },
  },
  {
    name: 'Continental Series',
    short: 'CS',
    desc: 'Internationale Serie mit professionellen Teams und starken Herstellern.',
    money: 2.6,
    travel: 32000,
    aiMin: 56,
    aiMax: 71,
    promoteRep: 60,
    laps: { short: 3, medium: 5, long: 8 },
  },
  {
    name: 'Weltmeisterschaft',
    short: 'WM',
    desc: 'Die Königsklasse. Nur die besten Teams der Welt kämpfen hier um den Titel.',
    money: 6.5,
    travel: 80000,
    aiMin: 72,
    aiMax: 89,
    promoteRep: 101,
    laps: { short: 3, medium: 6, long: 10 },
  },
];

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const PRIZE = [90000, 70000, 56000, 46000, 39000, 33000, 28000, 24000, 20000, 17000, 14000, 12000, 10000, 8500, 7000, 6000];
export const TEAM_SEASON_PRIZE = [600000, 380000, 260000, 190000, 150000, 120000, 100000, 80000];

export const STAT_LABELS: Record<keyof CarStats, string> = {
  power: 'Motorleistung',
  accel: 'Beschleunigung',
  topSpeed: 'Höchstgeschwindigkeit',
  braking: 'Bremsleistung',
  handling: 'Handling',
  aero: 'Aerodynamik',
  tyreCare: 'Reifenschonung',
  reliability: 'Zuverlässigkeit',
  weight: 'Gewicht',
};

export const CHASSIS: Chassis[] = [
  {
    id: 'mirage', name: 'Mirage F-N (gebraucht)', tier: 0, price: 210000,
    base: { power: 38, accel: 40, topSpeed: 40, braking: 37, handling: 36, aero: 34, tyreCare: 46, reliability: 48, weight: 690 },
    description: 'Ältere Konstruktion aus zweiter Hand. Günstig, aber schwer und wenig Abtrieb.',
  },
  {
    id: 'kestrel', name: 'Kestrel RS', tier: 0, price: 360000,
    base: { power: 45, accel: 46, topSpeed: 45, braking: 45, handling: 44, aero: 42, tyreCare: 50, reliability: 58, weight: 672 },
    description: 'Ausgewogenes Kundenchassis. Robust und gutmütig, ideal für den Einstieg.',
  },
  {
    id: 'talon', name: 'Talon Evo', tier: 0, price: 520000,
    base: { power: 51, accel: 52, topSpeed: 50, braking: 50, handling: 51, aero: 50, tyreCare: 46, reliability: 52, weight: 662 },
    description: 'Aktuelles Spitzenmodell der Serie. Schnell, aber anspruchsvoll bei den Reifen.',
  },
  {
    id: 'vector', name: 'Vector C1', tier: 1, price: 1300000,
    base: { power: 60, accel: 60, topSpeed: 60, braking: 59, handling: 58, aero: 60, tyreCare: 55, reliability: 60, weight: 655 },
    description: 'Solides Chassis für die Continental Series.',
  },
  {
    id: 'stratos', name: 'Stratos C2', tier: 1, price: 2100000,
    base: { power: 66, accel: 65, topSpeed: 64, braking: 65, handling: 66, aero: 67, tyreCare: 58, reliability: 62, weight: 645 },
    description: 'Werkschassis mit modernem Unterboden.',
  },
  {
    id: 'helios', name: 'Helios W-1', tier: 2, price: 5200000,
    base: { power: 76, accel: 75, topSpeed: 76, braking: 75, handling: 75, aero: 77, tyreCare: 62, reliability: 66, weight: 638 },
    description: 'Weltmeisterschaftsauto mit Hybrid-Antrieb.',
  },
  {
    id: 'zenith', name: 'Zenith W-2', tier: 2, price: 8400000,
    base: { power: 82, accel: 81, topSpeed: 81, braking: 80, handling: 82, aero: 84, tyreCare: 65, reliability: 68, weight: 630 },
    description: 'Kompromisslose Spitzenkonstruktion für den Titelkampf.',
  },
];
export const CHASSIS_BY_ID: Record<string, Chassis> = Object.fromEntries(CHASSIS.map((c) => [c.id, c]));

export const PARTS: Record<PartKey, { label: string; desc: string; base: number; effect: Partial<CarStats> }> = {
  engine: { label: 'Motor', desc: 'Mehr Leistung und Endgeschwindigkeit.', base: 45000, effect: { power: 3, topSpeed: 1.5, accel: 1, reliability: -0.3 } },
  brakes: { label: 'Bremsen', desc: 'Kürzere Bremswege, späteres Anbremsen.', base: 28000, effect: { braking: 3.5 } },
  tyres: { label: 'Reifen & Felgen', desc: 'Besserer Grip und weniger Verschleiß.', base: 25000, effect: { tyreCare: 3, handling: 1 } },
  suspension: { label: 'Fahrwerk', desc: 'Stabileres Auto in Kurven.', base: 32000, effect: { handling: 3, tyreCare: 0.5 } },
  aero: { label: 'Aerodynamik', desc: 'Mehr Abtrieb in schnellen Kurven.', base: 40000, effect: { aero: 3.5, topSpeed: -0.3 } },
  gearbox: { label: 'Getriebe', desc: 'Schnellere Schaltvorgänge, bessere Beschleunigung.', base: 30000, effect: { accel: 3, reliability: 0.5 } },
  cooling: { label: 'Kühlung', desc: 'Höhere Zuverlässigkeit und stabile Motortemperatur.', base: 22000, effect: { reliability: 3, power: 0.5 } },
};
export const PART_KEYS = Object.keys(PARTS) as PartKey[];

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  engine: 'Motor',
  gearbox: 'Getriebe',
  brakes: 'Bremsen',
  frontWing: 'Frontflügel',
  suspension: 'Fahrwerk',
};
export const CONDITION_COST: Record<ConditionKey, number> = {
  engine: 90000,
  gearbox: 50000,
  brakes: 24000,
  frontWing: 30000,
  suspension: 36000,
};

export const FACILITY = [
  { level: 1, name: 'Mietgarage', cost: 0, time: 0, partCap: 4 },
  { level: 2, name: 'Eigene Werkstatt', cost: 350000, time: 2, partCap: 6 },
  { level: 3, name: 'Technikzentrum', cost: 950000, time: 3, partCap: 8 },
  { level: 4, name: 'Werksfabrik', cost: 2400000, time: 4, partCap: 10 },
];

export const COMPOUNDS: Record<Compound, { label: string; short: string; color: string; dry: number; life: number; desc: string }> = {
  soft: { label: 'Soft', short: 'S', color: '#ff3b47', dry: 1.0, life: 0.42, desc: 'Maximaler Grip, hoher Verschleiß' },
  medium: { label: 'Medium', short: 'M', color: '#ffd23f', dry: 0.975, life: 0.68, desc: 'Ausgewogen' },
  hard: { label: 'Hard', short: 'H', color: '#f2f4f5', dry: 0.95, life: 1.05, desc: 'Langlebig, weniger Grip' },
  inter: { label: 'Intermediate', short: 'I', color: '#3ecf6a', dry: 0.86, life: 0.7, desc: 'Für feuchte Strecke' },
  wet: { label: 'Wet', short: 'W', color: '#3b8cff', dry: 0.78, life: 0.8, desc: 'Für starken Regen' },
};
export const COMPOUND_KEYS = Object.keys(COMPOUNDS) as Compound[];

export const STAFF_ROLES: Record<StaffRole, { label: string; desc: string; effect: string }> = {
  raceEngineer: { label: 'Renningenieur', desc: 'Abstimmung und Strategie', effect: 'Bessere Grundabstimmung, schnelleres Setup-Wissen im Training, Fahrerentwicklung' },
  mechanic: { label: 'Mechaniker', desc: 'Boxencrew', effect: 'Schnellere Boxenstopps, weniger Fehler beim Reifenwechsel' },
  chiefMechanic: { label: 'Chefmechaniker', desc: 'Werkstatt und Wartung', effect: 'Günstigere Reparaturen, weniger Verschleiß, höhere Zuverlässigkeit' },
  aeroEngineer: { label: 'Aerodynamik-Ingenieur', desc: 'Aero und Fahrwerk', effect: 'Schnellere und günstigere Aero-/Fahrwerks-Upgrades, Abtrieb-Bonus' },
  engineEngineer: { label: 'Motoren-Ingenieur', desc: 'Antrieb', effect: 'Schnellere und günstigere Motor-/Getriebe-/Kühlungs-Upgrades, Leistungsbonus' },
  dataAnalyst: { label: 'Datenanalyst', desc: 'Daten und Forschung', effect: 'Schnellere Forschung, Talent von Fahrern erkennen, genauere Wetterprognose' },
};
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

export const RESEARCH_BRANCHES: Record<ResearchNode['branch'], string> = {
  engine: 'Motor',
  aero: 'Aerodynamik',
  chassis: 'Fahrwerk',
  tyres: 'Reifen',
  pit: 'Boxencrew',
};

export const RESEARCH: ResearchNode[] = [
  { id: 'eng_pow1', branch: 'engine', name: 'Leistung I', desc: 'Optimierte Einspritzung', cost: 60000, time: 2, requires: [], stats: { power: 4, topSpeed: 1 } },
  { id: 'eng_pow2', branch: 'engine', name: 'Leistung II', desc: 'Neue Brennraumgeometrie', cost: 150000, time: 3, requires: ['eng_pow1'], stats: { power: 5, topSpeed: 2 } },
  { id: 'eng_pow3', branch: 'engine', name: 'Leistung III', desc: 'Hybrid-Boost', cost: 340000, time: 4, requires: ['eng_pow2', 'eng_rel1'], stats: { power: 6, accel: 3, topSpeed: 2 } },
  { id: 'eng_eff1', branch: 'engine', name: 'Effizienz I', desc: '6 % weniger Kraftstoffverbrauch', cost: 50000, time: 2, requires: [], fuelSave: 0.06 },
  { id: 'eng_eff2', branch: 'engine', name: 'Effizienz II', desc: 'Weitere 8 % weniger Verbrauch, mehr Boost-Energie', cost: 130000, time: 3, requires: ['eng_eff1'], fuelSave: 0.08, stats: { power: 1 } },
  { id: 'eng_rel1', branch: 'engine', name: 'Zuverlässigkeit I', desc: 'Verstärkte Lager', cost: 55000, time: 2, requires: [], stats: { reliability: 6 } },
  { id: 'eng_rel2', branch: 'engine', name: 'Zuverlässigkeit II', desc: 'Neue Materialien für Ventiltrieb', cost: 140000, time: 3, requires: ['eng_rel1'], stats: { reliability: 8 } },

  { id: 'aero_df1', branch: 'aero', name: 'Abtrieb I', desc: 'Überarbeiteter Frontflügel', cost: 65000, time: 2, requires: [], stats: { aero: 4 } },
  { id: 'aero_df2', branch: 'aero', name: 'Abtrieb II', desc: 'Neuer Unterboden', cost: 160000, time: 3, requires: ['aero_df1'], stats: { aero: 5 } },
  { id: 'aero_df3', branch: 'aero', name: 'Abtrieb III', desc: 'Doppeldiffusor', cost: 360000, time: 4, requires: ['aero_df2', 'ch_corner1'], stats: { aero: 6, handling: 2 } },
  { id: 'aero_drag1', branch: 'aero', name: 'Luftwiderstand I', desc: 'Schlankere Seitenkästen', cost: 60000, time: 2, requires: [], stats: { topSpeed: 3 } },
  { id: 'aero_drag2', branch: 'aero', name: 'Luftwiderstand II', desc: 'Low-Drag-Heckflügel', cost: 150000, time: 3, requires: ['aero_drag1'], stats: { topSpeed: 4 } },

  { id: 'ch_corner1', branch: 'chassis', name: 'Kurvengeschwindigkeit I', desc: 'Neue Federraten', cost: 60000, time: 2, requires: [], stats: { handling: 4 } },
  { id: 'ch_corner2', branch: 'chassis', name: 'Kurvengeschwindigkeit II', desc: 'Hydraulische Stabilisatoren', cost: 150000, time: 3, requires: ['ch_corner1'], stats: { handling: 5 } },
  { id: 'ch_corner3', branch: 'chassis', name: 'Kurvengeschwindigkeit III', desc: 'Aktive Dämpfung', cost: 330000, time: 4, requires: ['ch_corner2', 'ch_stab1'], stats: { handling: 6 } },
  { id: 'ch_stab1', branch: 'chassis', name: 'Stabilität I', desc: 'Weniger Fahrfehler, ruhigeres Heck', cost: 55000, time: 2, requires: [], stability: 0.15, stats: { handling: 1 } },
  { id: 'ch_stab2', branch: 'chassis', name: 'Stabilität II', desc: 'Kontrollierbares Rutschen am Limit', cost: 140000, time: 3, requires: ['ch_stab1'], stability: 0.2, stats: { handling: 2, tyreCare: 2 } },

  { id: 'ty_grip1', branch: 'tyres', name: 'Grip I', desc: 'Besseres Reifen-Temperaturfenster', cost: 55000, time: 2, requires: [], grip: 0.012 },
  { id: 'ty_grip2', branch: 'tyres', name: 'Grip II', desc: 'Felgenkühlung', cost: 140000, time: 3, requires: ['ty_grip1'], grip: 0.016 },
  { id: 'ty_wear1', branch: 'tyres', name: 'Verschleiß I', desc: 'Sanftere Lastverteilung', cost: 50000, time: 2, requires: [], stats: { tyreCare: 5 } },
  { id: 'ty_wear2', branch: 'tyres', name: 'Verschleiß II', desc: 'Sturzoptimierung', cost: 120000, time: 3, requires: ['ty_wear1'], stats: { tyreCare: 5 } },
  { id: 'ty_wear3', branch: 'tyres', name: 'Verschleiß III', desc: 'Reifendaten in Echtzeit', cost: 260000, time: 4, requires: ['ty_wear2', 'ty_grip1'], stats: { tyreCare: 6 } },

  { id: 'pit1', branch: 'pit', name: 'Boxenstopp I', desc: 'Schnellere Schlagschrauber (−0,4 s)', cost: 45000, time: 1, requires: [], pitBonus: 0.4 },
  { id: 'pit2', branch: 'pit', name: 'Boxenstopp II', desc: 'Neue Radmuttern (−0,4 s)', cost: 110000, time: 2, requires: ['pit1'], pitBonus: 0.4 },
  { id: 'pit3', branch: 'pit', name: 'Boxenstopp III', desc: 'Automatische Ampelanlage (−0,5 s)', cost: 230000, time: 3, requires: ['pit2'], pitBonus: 0.5 },
];
export const RESEARCH_BY_ID: Record<string, ResearchNode> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

export const ACHIEVEMENTS: { id: string; name: string; desc: string }[] = [
  { id: 'first_points', name: 'Erste Punkte', desc: 'Hole die ersten WM-Punkte.' },
  { id: 'first_podium', name: 'Erstes Podium', desc: 'Fahre aufs Podium.' },
  { id: 'first_win', name: 'Erster Sieg', desc: 'Gewinne ein Rennen.' },
  { id: 'pole', name: 'Pole Position', desc: 'Starte ein Rennen von Platz 1.' },
  { id: 'underdog', name: 'Underdog', desc: 'Gewinne ein Rennen von Startplatz 8 oder schlechter.' },
  { id: 'perfect', name: 'Perfektes Rennen', desc: 'Pole, Sieg und schnellste Runde im selben Rennen.' },
  { id: 'rain_master', name: 'Regenmeister', desc: 'Gewinne ein Rennen bei Regen.' },
  { id: 'double_podium', name: 'Doppelpack', desc: 'Beide Fahrer auf dem Podium.' },
  { id: 'driver_win', name: 'Selbst ist der Pilot', desc: 'Gewinne ein Rennen, das du selbst gefahren bist.' },
  { id: 'millionaire', name: 'Millionär', desc: 'Steigere deinen Kontostand auf über 3 Mio. €.' },
  { id: 'multi_millionaire', name: 'Großinvestor', desc: 'Steigere deinen Kontostand auf über 15 Mio. €.' },
  { id: 'champion', name: 'Meister', desc: 'Gewinne eine Fahrermeisterschaft.' },
  { id: 'promotion', name: 'Aufsteiger', desc: 'Steige in eine höhere Rennklasse auf.' },
  { id: 'world_champion', name: 'Weltmeister', desc: 'Gewinne die Weltmeisterschaft.' },
  { id: 'max_part', name: 'Voll ausgebaut', desc: 'Bringe ein Bauteil auf Stufe 10.' },
  { id: 'researcher', name: 'Forschergeist', desc: 'Schließe 10 Forschungsprojekte ab.' },
  { id: 'fast_pit', name: 'Boxenprofi', desc: 'Boxenstopp unter 2,6 Sekunden Standzeit.' },
  { id: 'iron_man', name: 'Eisenmann', desc: 'Bestreite 25 Rennen.' },
  { id: 'academy', name: 'Talentschmiede', desc: 'Nimm einen Nachwuchsfahrer in die Akademie auf.' },
  { id: 'overtaker', name: 'Überholkünstler', desc: 'Überhole 10 Fahrzeuge in einem selbst gefahrenen Rennen.' },
];

export const STYLE_LABELS = { conserve: 'Schonend', balanced: 'Ausgewogen', attack: 'Angriff' } as const;
export const OVERTAKE_LABELS = { cautious: 'Vorsichtig', normal: 'Normal', risky: 'Riskant' } as const;
export const WEATHER_LABELS = { sunny: 'Sonnig', cloudy: 'Bewölkt', lightRain: 'Leichter Regen', heavyRain: 'Starker Regen' } as const;
