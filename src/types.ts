import type { Vertex } from './race/trackGeometry';

export type PartKey = 'engine' | 'brakes' | 'tyres' | 'suspension' | 'aero' | 'gearbox' | 'cooling';
export type ConditionKey = 'engine' | 'gearbox' | 'brakes' | 'frontWing' | 'suspension';
export type Compound = 'soft' | 'medium' | 'hard' | 'inter' | 'wet';
export type WeatherKind = 'sunny' | 'cloudy' | 'lightRain' | 'heavyRain';
export type StaffRole = 'raceEngineer' | 'mechanic' | 'chiefMechanic' | 'aeroEngineer' | 'engineEngineer' | 'dataAnalyst';
export type DrivingStyle = 'conserve' | 'balanced' | 'attack';
export type OvertakeMode = 'cautious' | 'normal' | 'risky';
export type Region = 'europe' | 'americas' | 'asia' | 'oceania';
export type LogoKind = 'shield' | 'circle' | 'chevron' | 'wing' | 'bolt' | 'star' | 'hex' | 'flag';
// Bebaubare Felder auf dem Teamgelände (Einnahmequellen und Freischaltungen)
export type PlotId = 'kiosk' | 'fanshop' | 'grandstand' | 'media' | 'workshop' | 'setupLab' | 'tireDepot' | 'pitwall' | 'lab' | 'staffOffice' | 'lounge' | 'sponsorLounge';

export interface TrackDef {
  id: string;
  name: string;
  short: string;
  country: string;
  flag: [string, string];
  description: string;
  vertices: Vertex[];
  rotate: number;
  halfWidth: number;
  runoff: number;
  street: boolean;
  tyreWear: number;
  brakeWear: number;
  rainChance: number;
  weatherVariability: number;
  ideal: Setup;
  surface: string;
  scenery: 'harbor' | 'park' | 'forest' | 'dry';
}

export interface CarStats {
  power: number;
  accel: number;
  topSpeed: number;
  braking: number;
  handling: number;
  aero: number;
  tyreCare: number;
  reliability: number;
  weight: number; // kg
}

export interface Chassis {
  id: string;
  name: string;
  tier: number;
  price: number;
  base: CarStats;
  description: string;
}

export interface CarState {
  chassisId: string;
  parts: Record<PartKey, number>;
  condition: Record<ConditionKey, number>; // 1 = neuwertig
}

export interface DriverStats {
  speed: number;
  braking: number;
  cornering: number;
  reaction: number;
  consistency: number;
  aggression: number;
  wet: number;
  tyreMgmt: number;
  experience: number;
}

export interface Driver {
  id: string;
  name: string;
  country: string;
  age: number;
  stats: DriverStats;
  talent: number; // Potenzial 0-100
  talentKnown: boolean;
  salary: number; // pro Rennen
  contract: number; // verbleibende Rennen
  morale: number; // 0-100
  xp: number;
  teamId: string | null; // null = vereinslos / Markt
  academy?: boolean;
  traits: string[];
  careerWins: number;
  careerPodiums: number;
  careerRaces: number;
}

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  skill: number;
  salary: number;
  country: string;
  trait?: string;
}

export interface SponsorGoal {
  kind: 'finish' | 'quali' | 'points' | 'bothPoints';
  value: number; // Platz-Grenze
}

export interface Sponsor {
  id: string;
  name: string;
  industry: string;
  color: string;
  perRace: number;
  signingBonus: number;
  goal: SponsorGoal;
  goalBonus: number;
  races: number; // Laufzeit / verbleibend
  minReputation: number;
  slot: 'main' | 'secondary';
  satisfaction: number; // 0-100
  misses: number;
}

export interface Setup {
  wing: number;
  gearing: number;
  suspension: number;
}

export interface PlannedStop {
  lap: number;
  compound: Compound;
}

export interface Strategy {
  startCompound: Compound;
  fuel: number; // Anteil am Rennbedarf (1 = exakt)
  stops: PlannedStop[];
  style: DrivingStyle;
  aggression: number; // 0-100
  overtake: OvertakeMode;
  setup: Setup;
  reactToWeather: boolean;
}

export interface WeatherSegment {
  at: number; // Rennfortschritt 0..1
  kind: WeatherKind;
}

export interface Weekend {
  season: number;
  round: number;
  trackId: string;
  forecast: WeatherSegment[];
  weather: WeatherSegment[];
  forecastConfidence: number;
  setupHint: Setup;
  laps: number;
  practiceBest: number;
  qualiPlayerDrove: boolean;
  practiceDone: boolean;
  setupKnowledge: number; // 0..100
  qualiDone: boolean;
  grid: string[]; // driverIds
  qualiTimes: Record<string, number>;
  strategy: Strategy;
  teammateStrategy: Strategy;
  practiceLog: string[];
  engineFailureRisk: number; // aus Zufallsereignissen
}

export interface ResultEntry {
  driverId: string;
  teamId: string;
  pos: number;
  grid: number;
  time: number;
  laps: number;
  bestLap: number;
  dnf: boolean;
  dnfReason?: string;
  points: number;
  fastest: boolean;
  pits: number;
}

export interface RaceResult {
  season: number;
  round: number;
  trackId: string;
  weather: WeatherKind;
  entries: ResultEntry[];
  poleDriverId: string;
  fastestDriverId: string;
  playerDrove: boolean;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
  color2: string;
  logo: LogoKind;
  region: Region;
  isPlayer: boolean;
  carStats: CarStats; // für KI-Teams; beim Spieler wird live berechnet
  driverIds: string[];
  strength: number;
  pitCrew: number;
}

export interface LedgerEntry {
  season: number;
  round: number;
  label: string;
  amount: number;
  category: 'sponsor' | 'prize' | 'bonus' | 'event' | 'salary' | 'staff' | 'travel' | 'repair' | 'upgrade' | 'research' | 'purchase' | 'facility' | 'other';
}

export interface Development {
  id: string;
  kind: 'part' | 'research' | 'facility';
  target: string; // PartKey, ResearchId oder 'facility'
  remaining: number; // Rennen
  total: number;
  label: string;
}

export interface GameEventChoice {
  label: string;
  detail: string;
  effect: string; // Schlüssel für die Auflösung
  cost?: number;
}

export interface GameEvent {
  id: string;
  kind: string;
  title: string;
  text: string;
  choices: GameEventChoice[];
  data: Record<string, any>;
}

export interface Stats {
  races: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  titles: number;
  teamTitles: number;
  dnfs: number;
  income: number;
  expenses: number;
  km: number;
  bestLaps: Record<string, number>;
  overtakes: number;
  pitStops: number;
  bestPitStop: number;
  researchDone: number;
  upgradesDone: number;
  racesDriven: number;
  rainWins: number;
  passive: number; // insgesamt durch Anlagen verdientes Geld
}

export interface SeasonSummary {
  season: number;
  tier: number;
  teamPos: number;
  driverPos: number;
  points: number;
  championDriver: string;
  championTeam: string;
  wins: number;
}

export interface Settings {
  muted: boolean;
  volume: number;
  camera: 'chase' | 'high' | 'cockpit';
  touchControls: 'auto' | 'on' | 'off';
  steerSensitivity: number;
  showLine: boolean;
  cornerHints: boolean; // Kurvenvorschau mit Bremshinweis (Fahrhilfe)
  brakeAssist: boolean;
  steerAssist: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
  raceLength: 'short' | 'medium' | 'long';
  quality: 'low' | 'high';
}

export interface GameState {
  version: number;
  created: boolean;
  createdAt: number;
  team: Team;
  money: number;
  reputation: number;
  tier: number;
  season: number;
  round: number; // Index des nächsten Rennens
  calendar: string[]; // trackIds
  car: CarState;
  facility: number;
  plots: Partial<Record<PlotId, number>>; // Ausbaustufe der Felder (0 oder fehlend = nicht gebaut)
  lastTick: number; // Zeitstempel des letzten Einkommens-Ticks (für Einnahmen während der Abwesenheit)
  drivers: Record<string, Driver>;
  aiTeams: Team[];
  staff: Partial<Record<StaffRole, Staff>>;
  staffMarket: Staff[];
  driverMarket: string[];
  academy: string[];
  sponsors: Sponsor[];
  sponsorOffers: Sponsor[];
  research: Record<string, boolean>;
  developments: Development[];
  results: RaceResult[];
  ledger: LedgerEntry[];
  stats: Stats;
  achievements: Record<string, number>;
  pendingEvents: GameEvent[];
  weekend: Weekend | null;
  history: SeasonSummary[];
  settings: Settings;
  tutorialDone: boolean;
  tipsSeen: Record<string, boolean>;
  news: { id: string; text: string; tone: 'good' | 'bad' | 'neutral'; season: number; round: number }[];
  seasonEnd: null | { summary: SeasonSummary; promotionOffered: boolean; prize: number };
  nextId: number;
  flags: Record<string, any>;
}
