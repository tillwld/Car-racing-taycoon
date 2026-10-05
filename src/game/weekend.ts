// Rennwochenende: Wetter, Strategie, Aufbau der Rennkonfiguration, Qualifying-Simulation, Ergebnisauswertung.
import { POINTS, PRIZE, TIERS, TEAM_SEASON_PRIZE } from '../data/catalog';
import { TRACK_BY_ID } from '../data/tracks';
import { buildTrack, compilePolygon, type TrackGeometry } from '../race/trackGeometry';
import { RaceEngine, type Damage, type EntryConfig, type RaceConfig, type SessionMode } from '../race/engine';
import { bestCompoundFor, buildCarParams, WETNESS } from '../race/params';
import type { Compound, ConditionKey, Driver, GameState, RaceResult, ResultEntry, Setup, Strategy, Team, TrackDef, WeatherKind, WeatherSegment, Weekend } from '../types';
import { pitCrewTime, playerCarStats, researchExtras, staffSkill } from './carModel';
import { allTeams, computeStandings } from './season';
import { book, bookCapture, news, playerDrivers, refreshMarkets, tickDevelopments, unlock } from './state';
import { driverSalary, makeAITeams, makeDriver, goalText } from './generators';
import { clamp, gauss, pick, rand } from './util';
import { maybeGenerateEvents } from './events';

const geoCache = new Map<string, TrackGeometry>();
export function trackGeometry(t: TrackDef): TrackGeometry {
  let g = geoCache.get(t.id);
  if (!g) {
    g = buildTrack(compilePolygon(t.vertices), t.halfWidth, t.runoff);
    geoCache.set(t.id, g);
  }
  return g;
}

export function lapsFor(s: GameState) {
  return TIERS[s.tier].laps[s.settings.raceLength];
}

function genWeather(t: TrackDef, forceRain = false): WeatherSegment[] {
  const rainy = forceRain || Math.random() < t.rainChance;
  const segs: WeatherSegment[] = [];
  const dry = (): WeatherKind => (Math.random() < 0.6 ? 'sunny' : 'cloudy');
  const wet = (): WeatherKind => (Math.random() < 0.7 ? 'lightRain' : 'heavyRain');
  if (rainy && Math.random() < 0.4) {
    segs.push({ at: 0, kind: wet() });
    if (Math.random() < t.weatherVariability * 0.7) segs.push({ at: rand(0.35, 0.7), kind: 'cloudy' });
  } else {
    segs.push({ at: 0, kind: dry() });
    if (rainy) {
      segs.push({ at: rand(0.25, 0.7), kind: wet() });
      if (Math.random() < t.weatherVariability * 0.35) segs.push({ at: rand(0.78, 0.92), kind: 'cloudy' });
    } else if (Math.random() < 0.3) segs.push({ at: rand(0.3, 0.8), kind: dry() });
  }
  return segs;
}

function blurForecast(actual: WeatherSegment[], confidence: number): WeatherSegment[] {
  return actual
    .map((seg) => {
      if (seg.at === 0 || Math.random() < confidence) return { ...seg };
      if (seg.at === 0) return { at: 0, kind: seg.kind === 'heavyRain' ? 'lightRain' : seg.kind === 'lightRain' ? (Math.random() < 0.5 ? 'cloudy' : 'heavyRain') : seg.kind } as WeatherSegment;
      return Math.random() < 0.5 ? null : { at: clamp(seg.at + rand(-0.25, 0.25), 0.1, 0.95), kind: seg.kind };
    })
    .filter(Boolean) as WeatherSegment[];
}

export function defaultStrategy(laps: number, startKind: WeatherKind): Strategy {
  const wet = WETNESS[startKind];
  const startCompound: Compound = wet > 0.66 ? 'wet' : wet > 0.2 ? 'inter' : 'medium';
  return {
    startCompound,
    fuel: 1.06,
    stops: laps >= 4 && wet === 0 ? [{ lap: Math.ceil(laps * 0.5), compound: 'hard' }] : [],
    style: 'balanced',
    aggression: 50,
    overtake: 'normal',
    setup: { wing: 50, gearing: 50, suspension: 50 },
    reactToWeather: true,
  };
}

function aiStrategy(laps: number, startKind: WeatherKind, aggression: number): Strategy {
  const base = defaultStrategy(laps, startKind);
  const wet = WETNESS[startKind];
  if (wet === 0) {
    const r = Math.random();
    if (laps <= 3) {
      base.startCompound = r < 0.5 ? 'medium' : 'soft';
      base.stops = [];
    } else if (r < 0.35) {
      base.startCompound = 'soft';
      base.stops = [{ lap: Math.max(2, Math.round(laps * 0.4)), compound: 'medium' }];
    } else if (r < 0.75) {
      base.startCompound = 'medium';
      base.stops = [{ lap: Math.ceil(laps * 0.55), compound: 'hard' }];
    } else {
      base.startCompound = 'hard';
      base.stops = laps >= 8 ? [{ lap: Math.ceil(laps * 0.6), compound: 'medium' }] : [];
    }
  }
  base.style = aggression > 70 ? 'attack' : aggression < 35 ? 'conserve' : 'balanced';
  base.aggression = aggression;
  base.overtake = aggression > 70 ? 'risky' : aggression < 35 ? 'cautious' : 'normal';
  base.fuel = 1.04;
  return base;
}

export function ensureWeekend(s: GameState): Weekend {
  if (s.weekend && s.weekend.round === s.round && s.weekend.season === s.season) return s.weekend;
  const trackId = s.calendar[s.round];
  const t = TRACK_BY_ID[trackId];
  const forceRain = !!s.flags.forceRain;
  delete s.flags.forceRain;
  const weather = genWeather(t, forceRain);
  const analyst = staffSkill(s, 'dataAnalyst');
  const confidence = clamp(0.45 + analyst * 0.005, 0.45, 0.95);
  const forecast = blurForecast(weather, confidence);
  const laps = lapsFor(s);
  const eng = staffSkill(s, 'raceEngineer');
  const knowledge = Math.min(90, Math.round(10 + eng * 0.3 + (s.flags.setupBonus ?? 0)));
  delete s.flags.setupBonus;
  const hint = (v: number) => clamp(Math.round(v + gauss() * (100 - knowledge) * 0.32), 0, 100);
  const strategy = defaultStrategy(laps, forecast[0].kind);
  s.weekend = {
    season: s.season,
    round: s.round,
    trackId,
    forecast,
    weather,
    forecastConfidence: confidence,
    setupHint: { wing: hint(t.ideal.wing), gearing: hint(t.ideal.gearing), suspension: hint(t.ideal.suspension) },
    laps,
    practiceDone: false,
    practiceBest: 0,
    setupKnowledge: knowledge,
    qualiDone: false,
    qualiPlayerDrove: false,
    grid: [],
    qualiTimes: {},
    strategy,
    teammateStrategy: { ...strategy, stops: strategy.stops.map((x) => ({ ...x })) },
    practiceLog: [],
    engineFailureRisk: s.flags.engineRisk ? 1 : 0,
  };
  delete s.flags.engineRisk;
  return s.weekend;
}

// Setup-Wissen wächst im Training; die Empfehlung nähert sich dem Optimum
export function gainSetupKnowledge(s: GameState, amount: number) {
  const w = s.weekend;
  if (!w) return;
  const t = TRACK_BY_ID[w.trackId];
  const before = w.setupKnowledge;
  w.setupKnowledge = clamp(w.setupKnowledge + amount, 0, 100);
  const f = before >= 100 ? 1 : (w.setupKnowledge - before) / (100 - before);
  const k: (keyof Setup)[] = ['wing', 'gearing', 'suspension'];
  for (const key of k) w.setupHint[key] = Math.round(w.setupHint[key] + (t.ideal[key] - w.setupHint[key]) * f);
}

export function practiceFeedback(s: GameState): string[] {
  const w = s.weekend;
  if (!w) return [];
  const t = TRACK_BY_ID[w.trackId];
  const st = w.strategy.setup;
  const out: string[] = [];
  const tol = 6 + (100 - w.setupKnowledge) * 0.25;
  const msgs: Record<keyof Setup, [string, string]> = {
    wing: ['Das Auto rutscht in schnellen Kurven – mehr Abtrieb würde helfen.', 'Auf den Geraden fehlt Topspeed – weniger Flügel probieren.'],
    gearing: ['Die Übersetzung ist zu lang, beim Herausbeschleunigen fehlt Zug.', 'Wir hängen zu früh im Begrenzer – längere Übersetzung.'],
    suspension: ['Das Auto ist zu weich und träge in den Wechselkurven.', 'Das Auto ist zu hart, wir verlieren Grip über die Randsteine.'],
  };
  for (const key of ['wing', 'gearing', 'suspension'] as (keyof Setup)[]) {
    const diff = st[key] - t.ideal[key];
    if (Math.abs(diff) > tol) out.push(diff < 0 ? msgs[key][0] : msgs[key][1]);
  }
  if (!out.length) out.push('Fahrer: „Das Auto fühlt sich richtig gut an!“');
  return out;
}

function aiSetup(t: TrackDef, strength: number): Setup {
  const e = (100 - strength) * 0.35;
  return {
    wing: clamp(Math.round(t.ideal.wing + gauss() * e), 0, 100),
    gearing: clamp(Math.round(t.ideal.gearing + gauss() * e), 0, 100),
    suspension: clamp(Math.round(t.ideal.suspension + gauss() * e), 0, 100),
  };
}

const DIFF = { easy: 0.93, normal: 0.972, hard: 0.995 };

export function conditionDamage(s: GameState): Damage {
  const c = s.car.condition;
  const d = (k: ConditionKey) => clamp(1 - c[k], 0, 0.95);
  return { engine: d('engine') * 0.6, gearbox: d('gearbox') * 0.6, brakes: d('brakes'), frontWing: d('frontWing'), suspension: d('suspension') * 0.8 };
}

export function buildEntries(s: GameState, mode: SessionMode, humanDriverId: string | null): EntryConfig[] {
  const w = ensureWeekend(s);
  const t = TRACK_BY_ID[w.trackId];
  const teams = allTeams(s);
  const out: EntryConfig[] = [];
  const startKind = w.weather[0].kind;
  let num = 1;
  teams.forEach((team, ti) => {
    const isPlayer = team.id === 'player';
    team.driverIds.forEach((did, di) => {
      const d = s.drivers[did];
      if (!d) return;
      let entry: EntryConfig;
      if (isPlayer) {
        const stats = playerCarStats(s);
        const ex = researchExtras(s);
        const crew = pitCrewTime(s);
        const strat = di === 0 ? w.strategy : w.teammateStrategy;
        const car = buildCarParams(stats, w.strategy.setup, t, { stability: ex.stability, grip: ex.grip, fuelSave: ex.fuelSave });
        entry = {
          id: d.id,
          teamId: team.id,
          name: d.name,
          short: shortName(d),
          number: num++,
          color: team.color,
          color2: team.color2,
          human: d.id === humanDriverId,
          playerTeam: true,
          car,
          driver: { ...d.stats },
          strategy: { ...strat, stops: strat.stops.map((x) => ({ ...x })) },
          damage: conditionDamage(s),
          pitBase: crew.base,
          pitError: crew.error,
          boxIndex: ti,
          paceMul: 1,
        };
        if (w.engineFailureRisk) entry.damage.engine = Math.max(entry.damage.engine, 0.3);
      } else {
        const car = buildCarParams(team.carStats, aiSetup(t, team.strength), t, { stability: team.strength / 400 });
        const aggr = clamp(Math.round(d.stats.aggression + rand(-10, 10)), 10, 95);
        entry = {
          id: d.id,
          teamId: team.id,
          name: d.name,
          short: shortName(d),
          number: num++,
          color: team.color,
          color2: team.color2,
          human: false,
          playerTeam: false,
          car,
          driver: { ...d.stats },
          strategy: aiStrategy(w.laps, startKind, aggr),
          damage: { engine: 0, gearbox: 0, brakes: 0, frontWing: 0, suspension: 0 },
          pitBase: 2.2 + (100 - team.pitCrew) * 0.04,
          pitError: 0.01 + 0.1 * (1 - team.pitCrew / 100),
          boxIndex: ti,
          paceMul: DIFF[s.settings.difficulty],
        };
      }
      if (mode !== 'race') entry.strategy = { ...entry.strategy, startCompound: bestCompoundFor(WETNESS[startKind], 'soft'), fuel: 0.3 };
      out.push(entry);
    });
  });
  return out;
}

export function shortName(d: Driver) {
  const parts = d.name.split(' ');
  const last = parts[parts.length - 1].replace(/[^A-Za-zÄÖÜäöüß]/g, '');
  return (last.slice(0, 3) || d.name.slice(0, 3)).toUpperCase();
}

export function makeRaceConfig(s: GameState, mode: SessionMode, humanDriverId: string | null, onlyIds?: string[]): RaceConfig {
  const w = ensureWeekend(s);
  const t = TRACK_BY_ID[w.trackId];
  let entries = buildEntries(s, mode, humanDriverId);
  if (onlyIds) entries = entries.filter((e) => onlyIds.includes(e.id));
  let grid: string[];
  if (mode === 'race') {
    grid = w.grid.filter((id) => entries.some((e) => e.id === id));
    for (const e of entries) if (!grid.includes(e.id)) grid.push(e.id);
  } else grid = entries.map((e) => e.id);
  const weather: WeatherSegment[] = mode === 'race' ? w.weather : [{ at: 0, kind: w.weather[0].kind }];
  return {
    mode,
    track: t,
    geo: trackGeometry(t),
    laps: mode === 'race' ? w.laps : 99,
    weather,
    entries,
    grid,
    assists: { brake: s.settings.brakeAssist, steer: s.settings.steerAssist },
    steerSensitivity: s.settings.steerSensitivity,
    wearScaleLaps: w.laps,
  };
}

// Teststrecke: freie Fahrt ohne Rennwochenende, nur dein Auto auf der Strecke des nächsten Rennens
export function makeFreeDriveConfig(s: GameState): { config: RaceConfig; trackId: string; driverId: string } {
  const trackId = s.calendar[s.round] ?? s.calendar[0] ?? 'eifel';
  const t = TRACK_BY_ID[trackId];
  const d = s.drivers[s.team.driverIds[0]];
  const stats = playerCarStats(s);
  const ex = researchExtras(s);
  const crew = pitCrewTime(s);
  const setup = { ...t.ideal };
  const car = buildCarParams(stats, setup, t, { stability: ex.stability, grip: ex.grip, fuelSave: ex.fuelSave });
  const base = defaultStrategy(4, 'sunny');
  const entry: EntryConfig = {
    id: d.id,
    teamId: 'player',
    name: d.name,
    short: shortName(d),
    number: 1,
    color: s.team.color,
    color2: s.team.color2,
    human: true,
    playerTeam: true,
    car,
    driver: { ...d.stats },
    strategy: { ...base, startCompound: 'medium', fuel: 0.3, stops: [] },
    damage: { engine: 0, gearbox: 0, brakes: 0, frontWing: 0, suspension: 0 },
    pitBase: crew.base,
    pitError: crew.error,
    boxIndex: 0,
    paceMul: 1,
  };
  const config: RaceConfig = {
    mode: 'practice',
    track: t,
    geo: trackGeometry(t),
    laps: 99,
    weather: [{ at: 0, kind: 'sunny' }],
    entries: [entry],
    grid: [d.id],
    assists: { brake: s.settings.brakeAssist, steer: s.settings.steerAssist },
    steerSensitivity: s.settings.steerSensitivity,
    wearScaleLaps: 8,
  };
  return { config, trackId, driverId: d.id };
}

// Qualifying: jedes Auto fährt allein eine fliegende Runde
export function simulateQualiLaps(s: GameState, skipIds: string[] = []): Record<string, number> {
  const base = makeRaceConfig(s, 'quali', null);
  const times: Record<string, number> = {};
  for (const e of base.entries) {
    if (skipIds.includes(e.id)) continue;
    const cfg: RaceConfig = { ...base, entries: [e], grid: [e.id] };
    const eng = new RaceEngine(cfg);
    const c = eng.cars[0];
    let guard = 0;
    while (c.lapTimes.length < 1 && guard < 9000) {
      eng.step(1 / 30);
      guard++;
    }
    const noise = Math.abs(gauss()) * 0.35 * (1.25 - e.driver.consistency / 100) + gauss() * 0.12;
    times[e.id] = (c.lapTimes[0] ?? 999) + noise;
  }
  return times;
}

export function finishQuali(s: GameState, times: Record<string, number>, playerDrove: boolean) {
  const w = ensureWeekend(s);
  w.qualiTimes = times;
  w.grid = Object.keys(times).sort((a, b) => times[a] - times[b]);
  w.qualiDone = true;
  w.qualiPlayerDrove = playerDrove;
  const pd = s.team.driverIds;
  const best = Math.min(...pd.map((id) => w.grid.indexOf(id) + 1).filter((x) => x > 0));
  if (best === 1) {
    news(s, `Pole Position für ${s.team.name}!`, 'good');
  }
}

// ---------- Rennergebnis ----------
export interface OutcomeEntry {
  id: string;
  teamId: string;
  laps: number;
  time: number;
  bestLap: number;
  dnf: boolean;
  dnfReason: string;
  pits: number;
  finished: boolean;
  damage: Damage;
  overtakes: number;
  km: number;
  lastPit: number;
  gridPos: number;
}

export interface RaceOutcome {
  order: OutcomeEntry[];
  fastestId: string;
  rainy: boolean;
  weather: WeatherKind;
  playerDrove: boolean;
  humanId: string | null;
}

export function outcomeFromEngine(eng: RaceEngine, playerDrove: boolean, wasRainy: boolean): RaceOutcome {
  const order = eng.order().map((c) => ({
    id: c.cfg.id,
    teamId: c.cfg.teamId,
    laps: c.lapsDone,
    time: c.finished ? c.finishTime : 0,
    bestLap: isFinite(c.bestLap) ? c.bestLap : 0,
    dnf: c.dnf || !c.finished,
    dnfReason: c.dnf ? c.dnfReason : c.finished ? '' : 'Nicht gewertet',
    pits: c.pits,
    finished: c.finished,
    damage: { ...c.damage },
    overtakes: c.overtakes,
    km: c.odo / 1000,
    lastPit: c.lastPitTime,
    gridPos: c.gridPos,
  }));
  return { order, fastestId: eng.fastestLap.id, rainy: wasRainy, weather: eng.weatherNow, playerDrove, humanId: eng.humanId };
}

export function applyRaceResult(s: GameState, out: RaceOutcome): RaceResult {
  bookCapture.list = [];
  try {
    return applyRaceResultInner(s, out);
  } finally {
    s.flags.lastRaceLedger = bookCapture.list;
    bookCapture.list = null;
  }
}

function applyRaceResultInner(s: GameState, out: RaceOutcome): RaceResult {
  const w = ensureWeekend(s);
  const t = TRACK_BY_ID[w.trackId];
  const money = TIERS[s.tier].money;
  const entries: ResultEntry[] = out.order.map((o, i) => {
    const pos = i + 1;
    const pts = !o.dnf && pos <= 10 ? POINTS[pos - 1] + (o.id === out.fastestId ? 1 : 0) : 0;
    return {
      driverId: o.id,
      teamId: o.teamId,
      pos,
      grid: (w.grid.indexOf(o.id) + 1) || o.gridPos,
      time: o.time,
      laps: o.laps,
      bestLap: o.bestLap,
      dnf: o.dnf,
      dnfReason: o.dnfReason,
      points: pts,
      fastest: o.id === out.fastestId,
      pits: o.pits,
    };
  });
  const result: RaceResult = {
    season: s.season,
    round: s.round,
    trackId: w.trackId,
    weather: out.weather,
    entries,
    poleDriverId: w.grid[0] ?? '',
    fastestDriverId: out.fastestId,
    playerDrove: out.playerDrove,
  };
  s.results.push(result);

  const mine = entries.filter((e) => e.teamId === 'player');
  const mineOut = out.order.filter((o) => o.teamId === 'player');
  const st = s.stats;
  st.races++;
  if (out.playerDrove) st.racesDriven++;
  let repDelta = 0;
  for (const e of mine) {
    const d = s.drivers[e.driverId];
    st.points += e.points;
    if (e.dnf) {
      st.dnfs++;
      repDelta -= 0.5;
    } else {
      if (e.pos === 1) {
        st.wins++;
        repDelta += 4;
        unlock(s, 'first_win');
        if (e.grid >= 8) unlock(s, 'underdog');
        if (out.rainy) {
          st.rainWins++;
          unlock(s, 'rain_master');
        }
        if (out.playerDrove && out.humanId === e.driverId) unlock(s, 'driver_win');
        if (e.grid === 1 && e.fastest) unlock(s, 'perfect');
      }
      if (e.pos <= 3) {
        st.podiums++;
        repDelta += 2;
        unlock(s, 'first_podium');
      }
      if (e.pos <= 10) repDelta += 0.6;
      else repDelta -= 0.2;
      if (e.points > 0) unlock(s, 'first_points');
      const prize = Math.round((PRIZE[e.pos - 1] ?? 4000) * money);
      book(s, `Preisgeld P${e.pos} (${d?.name ?? ''})`, prize, 'prize');
    }
    if (e.grid === 1) {
      st.poles++;
      unlock(s, 'pole');
    }
    if (e.fastest) st.fastestLaps++;
    if (e.bestLap > 0 && (!st.bestLaps[w.trackId] || e.bestLap < st.bestLaps[w.trackId])) st.bestLaps[w.trackId] = e.bestLap;
  }
  if (mine.filter((e) => !e.dnf && e.pos <= 3).length >= 2) unlock(s, 'double_podium');
  for (const o of mineOut) {
    st.km += o.km;
    st.pitStops += o.pits;
    if (o.pits > 0 && o.lastPit > 0 && (st.bestPitStop === 0 || o.lastPit < st.bestPitStop)) st.bestPitStop = o.lastPit;
    if (o.lastPit > 0 && o.lastPit < 2.6) unlock(s, 'fast_pit');
  }
  if (out.playerDrove && out.humanId) {
    const h = out.order.find((o) => o.id === out.humanId);
    if (h) {
      st.overtakes += h.overtakes;
      if (h.overtakes >= 10) unlock(s, 'overtaker');
    }
  }
  if (st.races >= 25) unlock(s, 'iron_man');

  // Sponsoren
  const bestFinish = Math.min(...mine.map((e) => (e.dnf ? 99 : e.pos)));
  const bestGrid = Math.min(...mine.map((e) => e.grid || 99));
  const bothPoints = mine.length >= 2 && mine.every((e) => !e.dnf && e.pos <= 10);
  for (const sp of [...s.sponsors]) {
    const met = sp.goal.kind === 'finish' ? bestFinish <= sp.goal.value : sp.goal.kind === 'quali' ? bestGrid <= sp.goal.value : bothPoints;
    book(s, `Sponsor ${sp.name}`, sp.perRace, 'sponsor');
    if (met) {
      book(s, `Zielbonus ${sp.name}`, sp.goalBonus, 'bonus');
      sp.satisfaction = clamp(sp.satisfaction + 8, 0, 100);
      sp.misses = 0;
    } else {
      sp.satisfaction = clamp(sp.satisfaction - 16, 0, 100);
      sp.misses++;
      repDelta -= 0.7;
    }
    sp.races--;
    if (sp.misses >= 3 || sp.satisfaction < 15) {
      s.sponsors = s.sponsors.filter((x) => x.id !== sp.id);
      repDelta -= 2;
      news(s, `${sp.name} steigt aus: Ziel „${goalText(sp.goal)}“ zu oft verfehlt.`, 'bad');
    } else if (sp.races <= 0) {
      s.sponsors = s.sponsors.filter((x) => x.id !== sp.id);
      news(s, `Vertrag mit ${sp.name} ist ausgelaufen.`, 'neutral');
    }
  }
  // Herausforderung aus Ereignis
  if (s.flags.challenge) {
    const ch = s.flags.challenge as { target: number; reward: number; penalty: number; name: string };
    if (bestFinish <= ch.target) {
      book(s, `Sonderbonus ${ch.name}`, ch.reward, 'event');
      news(s, `Sonderbonus von ${ch.name} kassiert!`, 'good');
    } else {
      repDelta -= ch.penalty;
      news(s, `Sonderziel von ${ch.name} verfehlt.`, 'bad');
    }
    delete s.flags.challenge;
  }
  if (s.flags.bold) {
    if (bestFinish > 10) {
      repDelta -= 5;
      news(s, 'Nach der Kampfansage lacht die Presse über das Ergebnis.', 'bad');
    }
    delete s.flags.bold;
  }

  // Kosten
  for (const d of playerDrivers(s)) book(s, `Gehalt ${d.name}`, -d.salary, 'salary');
  for (const id of s.academy) {
    const d = s.drivers[id];
    if (d) book(s, `Akademie ${d.name}`, -d.salary, 'salary');
  }
  for (const stf of Object.values(s.staff)) if (stf) book(s, `Gehalt ${stf.name}`, -stf.salary, 'staff');
  book(s, `Reisekosten ${t.name}`, -TIERS[s.tier].travel, 'travel');

  s.reputation = clamp(Math.round((s.reputation + repDelta) * 10) / 10, 0, 100);

  // Fahrzeugzustand
  const chief = staffSkill(s, 'chiefMechanic');
  const wearF = 1 - Math.max(0, chief - 30) * 0.006;
  const dmg: Damage = { engine: 0, gearbox: 0, brakes: 0, frontWing: 0, suspension: 0 };
  for (const o of mineOut) for (const k of Object.keys(dmg) as (keyof Damage)[]) dmg[k] = Math.max(dmg[k], o.damage[k]);
  const c = s.car.condition;
  c.engine = clamp(1 - Math.max(dmg.engine, 1 - c.engine) - 0.06 * wearF, 0.05, 1);
  c.gearbox = clamp(1 - Math.max(dmg.gearbox, 1 - c.gearbox) - 0.045 * wearF, 0.05, 1);
  c.brakes = clamp(1 - dmg.brakes - 0.03 * wearF, 0.05, 1);
  c.frontWing = clamp(1 - dmg.frontWing, 0.05, 1);
  c.suspension = clamp(1 - Math.max(dmg.suspension, (1 - c.suspension) * 0.9) - 0.02 * wearF, 0.05, 1);

  // Fahrer entwickeln sich
  const engSkill = staffSkill(s, 'raceEngineer');
  for (const e of entries) {
    const d = s.drivers[e.driverId];
    if (!d) continue;
    d.careerRaces++;
    if (!e.dnf && e.pos === 1) d.careerWins++;
    if (!e.dnf && e.pos <= 3) d.careerPodiums++;
    if (e.teamId === 'player') {
      developDriver(d, 1 + engSkill / 200);
      d.morale = clamp(d.morale + (e.dnf ? -4 : e.pos <= 3 ? 6 : e.pos <= 10 ? 2 : -2), 0, 100);
      d.contract--;
    } else developDriver(d, 0.6);
  }
  for (const id of s.academy) {
    const d = s.drivers[id];
    if (d) developDriver(d, 1.6 + engSkill / 150);
  }

  // Verträge
  for (const d of playerDrivers(s)) {
    if (d.contract === 2) news(s, `Der Vertrag von ${d.name} läuft in 2 Rennen aus.`, 'bad');
    if (d.contract <= 0) {
      s.team.driverIds = s.team.driverIds.filter((x) => x !== d.id);
      d.teamId = null;
      d.salary = driverSalary(d, s.tier);
      s.driverMarket.push(d.id);
      news(s, `${d.name} hat das Team nach Vertragsende verlassen!`, 'bad');
    }
  }

  // Entwicklung, KI-Teams, Märkte
  tickDevelopments(s);
  developAITeams(s);
  if (s.round % 2 === 1) refreshMarkets(s);
  else {
    // Sponsorangebote immer frisch halten
    if (s.sponsorOffers.length < 5) refreshMarkets(s);
  }

  const posText = mine.map((e) => `${s.drivers[e.driverId]?.name ?? ''}: ${e.dnf ? 'Ausfall' : 'P' + e.pos}`).join(', ');
  news(s, `${t.name}: ${posText}`, bestFinish <= 3 ? 'good' : bestFinish <= 10 ? 'neutral' : 'bad');

  s.weekend = null;
  s.round++;
  if (s.round >= s.calendar.length) endSeason(s);
  else maybeGenerateEvents(s);
  return result;
}

function developDriver(d: Driver, f: number) {
  const age = d.age;
  const ageF = age < 22 ? 1.5 : age < 27 ? 1 : age < 31 ? 0.5 : 0.15;
  const keys: (keyof Driver['stats'])[] = ['speed', 'braking', 'cornering', 'reaction', 'consistency', 'wet', 'tyreMgmt'];
  for (const k of keys) {
    const gap = d.talent - d.stats[k];
    if (gap > 0 && Math.random() < 0.55) d.stats[k] = Math.min(99, Math.round((d.stats[k] + gap * 0.035 * ageF * f + rand(0, 0.6)) * 10) / 10);
  }
  d.stats.experience = Math.min(99, Math.round((d.stats.experience + 1.2 * f) * 10) / 10);
  d.xp += 10;
}

function developAITeams(s: GameState) {
  const t = TIERS[s.tier];
  for (const team of s.aiTeams) {
    const cap = t.aiMax + 8;
    if (team.strength >= cap) continue;
    const delta = rand(0.1, 0.5) * (1 + (t.aiMax - team.strength) / 60);
    team.strength += delta;
    const cs = team.carStats;
    for (const k of Object.keys(cs) as (keyof typeof cs)[]) if (k !== 'weight') cs[k] = Math.round((cs[k] + delta * rand(0.5, 1.5)) * 10) / 10;
  }
}

export function seasonPrize(s: GameState, pos: number) {
  return Math.round((TEAM_SEASON_PRIZE[pos - 1] ?? 50000) * TIERS[s.tier].money);
}

function endSeason(s: GameState) {
  const st = computeStandings(s);
  const teamPos = st.teams.findIndex((t) => t.teamId === 'player') + 1;
  const myDrivers = st.drivers.filter((d) => d.teamId === 'player');
  const driverPos = myDrivers.length ? st.drivers.indexOf(myDrivers[0]) + 1 : 0;
  const prize = seasonPrize(s, teamPos);
  book(s, `Saisonprämie Platz ${teamPos}`, prize, 'prize');
  const champ = st.drivers[0];
  if (champ && champ.teamId === 'player') {
    s.stats.titles++;
    unlock(s, 'champion');
    if (s.tier === 2) unlock(s, 'world_champion');
    s.reputation = clamp(s.reputation + 10, 0, 100);
  }
  if (teamPos === 1) s.stats.teamTitles++;
  s.reputation = clamp(s.reputation + (teamPos <= 3 ? 6 : teamPos <= 5 ? 2 : -2), 0, 100);
  const summary = {
    season: s.season,
    tier: s.tier,
    teamPos,
    driverPos,
    points: st.teams.find((t) => t.teamId === 'player')?.points ?? 0,
    championDriver: champ?.name ?? '',
    championTeam: st.teams[0]?.name ?? '',
    wins: st.teams.find((t) => t.teamId === 'player')?.wins ?? 0,
  };
  s.seasonEnd = { summary, promotionOffered: s.tier < 2 && teamPos <= 3, prize };
  news(s, `Saison ${s.season} beendet: Platz ${teamPos} in der Teamwertung.`, teamPos <= 3 ? 'good' : 'neutral');
}

export function startNextSeason(s: GameState, promote: boolean) {
  if (!s.seasonEnd) return;
  s.history.push(s.seasonEnd.summary);
  const oldTier = s.tier;
  if (promote && s.seasonEnd.promotionOffered) {
    s.tier = Math.min(2, s.tier + 1);
    unlock(s, 'promotion');
    s.reputation = clamp(s.reputation + 8, 0, 100);
    for (const t of s.aiTeams) for (const id of t.driverIds) delete s.drivers[id];
    const { teams, drivers } = makeAITeams(s.tier, 7, s.team.name, s.team.region);
    s.aiTeams = teams;
    for (const d of drivers) s.drivers[d.id] = d;
    news(s, `Aufstieg! ${s.team.name} startet jetzt in der ${TIERS[s.tier].name}.`, 'good');
  } else {
    // KI-Teams: Fahrerwechsel und leichte Annäherung an das Klassenniveau
    for (const t of s.aiTeams) {
      t.driverIds = t.driverIds.map((id) => {
        const d = s.drivers[id];
        if (d && (d.age > 35 || Math.random() < 0.2)) {
          delete s.drivers[id];
          const nd = makeDriver(t.strength + rand(-6, 4), { tier: s.tier });
          nd.teamId = t.id;
          s.drivers[nd.id] = nd;
          return nd.id;
        }
        return id;
      });
    }
  }
  for (const d of Object.values(s.drivers)) {
    d.age++;
    if (d.age > 32) {
      for (const k of ['speed', 'reaction', 'cornering'] as const) d.stats[k] = Math.max(15, d.stats[k] - rand(0.5, 2));
    }
  }
  s.season++;
  s.round = 0;
  s.results = [];
  s.weekend = null;
  s.seasonEnd = null;
  s.calendar = shuffleCalendar();
  if (oldTier !== s.tier) {
    for (const st of s.staffMarket) st.salary = Math.round(st.salary * (TIERS[s.tier].money / TIERS[oldTier].money));
  }
  refreshMarkets(s);
  news(s, `Saison ${s.season} beginnt. Erstes Rennen: ${TRACK_BY_ID[s.calendar[0]].name}.`, 'neutral');
}

function shuffleCalendar() {
  const ids = Object.keys(TRACK_BY_ID);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export { pick };
export type { Team };
