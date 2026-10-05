// Rennengine: Fahrphysik, Rundenzählung, Reifen, Kraftstoff, Wetter, Schäden, Boxenstopps.
// Läuft identisch für selbst gefahrene, zugeschaute und blitzschnell simulierte Rennen.
import type { Compound, TrackDef, WeatherKind, WeatherSegment } from '../types';
import type { TrackGeometry } from './trackGeometry';
import { nearestIndex, nearestIndexGlobal, pointAt, wrapIndex } from './trackGeometry';
import { PIT, AIR_TEMP, compoundGrip, TEMP_WINDOW, WETNESS, bestCompoundFor, type DriverParams, type EntryStrategy, type PhysicsParams } from './params';
import { aiControl, computeProfile, type AIState } from './ai';
import { COMPOUNDS } from '../data/catalog';

export { PIT };

export type DamageKey = 'engine' | 'gearbox' | 'brakes' | 'frontWing' | 'suspension';
export type Damage = Record<DamageKey, number>;

export interface EntryConfig {
  id: string;
  teamId: string;
  name: string;
  short: string;
  number: number;
  color: string;
  color2: string;
  human: boolean;
  playerTeam: boolean;
  car: PhysicsParams;
  driver: DriverParams;
  strategy: EntryStrategy;
  damage: Damage;
  pitBase: number; // Standzeit in Sekunden
  pitError: number; // Fehlerwahrscheinlichkeit
  boxIndex: number;
  paceMul: number; // Schwierigkeitsfaktor für KI
}

export type SessionMode = 'race' | 'quali' | 'practice';

export interface RaceConfig {
  mode: SessionMode;
  track: TrackDef;
  geo: TrackGeometry;
  laps: number;
  weather: WeatherSegment[];
  entries: EntryConfig[];
  grid: string[];
  assists: { brake: boolean; steer: boolean };
  steerSensitivity: number;
  wearScaleLaps?: number;
}

export interface Input {
  throttle: number;
  brake: number;
  steer: number; // -1 links .. +1 rechts
  boost: boolean;
}

export interface PitRequest {
  compound: Compound;
  repair: boolean;
  refuel: boolean;
}

export interface RaceMessage {
  t: number;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'warn';
  carId?: string;
}

type PitPhase = 'none' | 'entry' | 'toBox' | 'stopped' | 'exit';


export interface CarSim {
  cfg: EntryConfig;
  x: number;
  y: number;
  h: number;
  vx: number;
  vy: number;
  speed: number;
  steer: number;
  throttle: number;
  brake: number;
  boost: boolean;
  idx: number;
  lat: number;
  s: number;
  dist: number;
  lapsDone: number;
  lapStart: number;
  lastLap: number;
  bestLap: number;
  sectorStart: number;
  sector: number;
  sectors: number[];
  bestSectors: number[];
  tyre: { compound: Compound; wear: number; temp: number; age: number };
  fuel: number;
  ers: number;
  damage: Damage;
  slide: number;
  latUse: number;
  offTrack: number; // 0 Strecke, 1 Randstein, 2 Gras/Auslauf
  grass: number; // 0..1 gleitender Übergang zum Gras (Grip wechselt nicht schlagartig)
  yaw: number; // Gierrate des Spielerautos (rad/s)
  pit: PitPhase;
  pitReq: PitRequest | null;
  pitTimer: number; // verbleibende Standzeit
  pitTotal: number; // gesamte Standzeit des laufenden Stopps (für die Boxencrew)
  pitRel: number; // Weg seit der Einfahrtslinie
  pitLatStart: number;
  pitCaptureRel: number; // Weg ab Einfahrt, an dem das Auto erfasst wurde
  pitHeadErr: number; // Winkelversatz beim Einfahren, wird auf der Zufahrt abgebaut
  pitStopRel: number; // Halteposition an der Box (relativ zur Einfahrt)
  pitDrive: boolean; // Durchfahrt ohne Stopp
  pitShift: number; // Länge des Spurwechsels zur Arbeitsspur
  pitWait: number; // Wartezeit an der Ausfahrtsampel
  pitDecided: boolean; // KI: Entscheidung für diese Runde getroffen
  pitMissed: boolean; // Einfahrt in dieser Runde verpasst (Hinweis schon gezeigt)
  pits: number;
  lastPitTime: number;
  finished: boolean;
  finishTime: number;
  dnf: boolean;
  dnfReason: string;
  pos: number;
  gridPos: number;
  ai: AIState;
  overtakes: number;
  slip: number;
  collideCd: number;
  odo: number;
  started: boolean;
  stopIndex: number;
  lastWarn: Record<string, number>;
  lapTimes: number[];
}

/** Abstimmung des Fahrgefühls (Spielerauto) */
export const PHYS = { rise: 5.0, riseSpd: 0.3, ret: 1.9, exp: 1.0, kd: 1.0, kdOff: 1.12, lag: 0.05, osP: 0.22, osB: 0.16, kStab: 2.0, kStabOff: 0.8, stabSteer: 0.6, accelCirc: 0.3 };

const PIT_SPEED = PIT.speed;
const CAR_R = 1.1;
const CAR_OFF = 1.45;

export class RaceEngine {
  cfg: RaceConfig;
  geo: TrackGeometry;
  cars: CarSim[];
  byId: Record<string, CarSim>;
  time = 0;
  phase: 'countdown' | 'racing' | 'finished' = 'countdown';
  countdown = 0;
  lightsOut = 0;
  wetness = 0;
  weatherNow: WeatherKind = 'sunny';
  leaderFinished = false;
  leaderFinishTime = 0;
  messages: RaceMessage[] = [];
  fastestLap = { id: '', time: Infinity };
  bestSectorsOverall = [Infinity, Infinity, Infinity];
  pitIn: number; // Einfahrtslinie (Anfang der Zufahrt)
  pitOut: number; // Ende der Ausfahrt
  pitSide: number; // Seite der Boxengasse (+1 rechts vom Fahrer, -1 links)
  pitLat: number; // Mitte der Fahrspur der Boxengasse
  pitWorkLat: number; // Arbeitsspur an den Boxen
  pitLen: number; // Länge der gesamten Boxengasse
  exitRed = false; // Ausfahrtsampel
  humanInput: Input = { throttle: 0, brake: 0, steer: 0, boost: false };
  humanId: string | null = null;
  autopilotHuman = false;
  sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  skids: { x: number; y: number; h: number; life: number }[] = [];
  collisionsThisFrame = 0;
  wearDist: number;
  raceDist: number;
  onEvent?: (e: { type: string; carId?: string; data?: any }) => void;

  constructor(cfg: RaceConfig) {
    this.cfg = cfg;
    this.geo = cfg.geo;
    const L = this.geo.length;
    this.pitSide = this.geo.turnSign >= 0 ? 1 : -1;
    this.pitIn = L - 230;
    this.pitOut = 230;
    this.pitLen = 460;
    this.pitLat = this.pitSide * (this.geo.halfWidth + PIT.fast);
    this.pitWorkLat = this.pitSide * (this.geo.halfWidth + PIT.work);
    this.raceDist = cfg.laps * L;
    this.wearDist = Math.max(cfg.wearScaleLaps ?? cfg.laps, 6) * L;
    this.weatherNow = cfg.weather[0]?.kind ?? 'sunny';
    this.wetness = WETNESS[this.weatherNow];
    this.cars = cfg.grid.map((id, i) => this.makeCar(cfg.entries.find((e) => e.id === id)!, i));
    this.byId = Object.fromEntries(this.cars.map((c) => [c.cfg.id, c]));
    const human = this.cars.find((c) => c.cfg.human);
    this.humanId = human ? human.cfg.id : null;
    if (cfg.mode !== 'race') {
      this.phase = 'racing';
      this.lightsOut = 0;
      this.cars.forEach((c) => (c.started = true));
    } else {
      this.countdown = 0;
      this.lightsOut = 4.2 + Math.random() * 1.0;
    }
  }

  private makeCar(e: EntryConfig, gridPos: number): CarSim {
    const g = this.geo;
    let s: number;
    let lat: number;
    let speed = 0;
    if (this.cfg.mode === 'race') {
      s = g.length - 14 - gridPos * 9;
      lat = (gridPos % 2 === 0 ? -1 : 1) * Math.min(3, g.halfWidth - 2) * -this.geo.turnSign;
    } else {
      s = g.length - 260;
      lat = 0;
      speed = 42;
    }
    const p = pointAt(g, s, lat);
    const idx = nearestIndexGlobal(g, p.x, p.y);
    const h = Math.atan2(p.ty, p.tx);
    const ai: AIState = {
      offsetCur: 0,
      offsetTarget: 0,
      offsetTimer: 0,
      mistake: 0,
      mistakeKind: 'none',
      profile: new Float32Array(g.n),
      profileTimer: 0,
      profileGrip: 0,
      startDelay: 0.18 + (100 - e.driver.reaction) * 0.006 + Math.random() * 0.15,
      boostTimer: 0,
      defendTimer: 0,
      lastCornerIdx: -999,
      blocked: 0,
    };
    const startDist = this.cfg.mode === 'race' ? s - g.length : -260;
    return {
      cfg: e,
      x: p.x,
      y: p.y,
      h,
      vx: Math.cos(h) * speed,
      vy: Math.sin(h) * speed,
      speed,
      steer: 0,
      throttle: 0,
      brake: 0,
      boost: false,
      idx,
      lat,
      s,
      dist: startDist,
      lapsDone: 0,
      lapStart: 0,
      lastLap: 0,
      bestLap: Infinity,
      sectorStart: 0,
      sector: 0,
      sectors: [0, 0, 0],
      bestSectors: [Infinity, Infinity, Infinity],
      tyre: { compound: e.strategy.startCompound, wear: 0, temp: this.cfg.mode === 'race' ? 72 : 88, age: 0 },
      fuel: e.strategy.fuel,
      ers: 1,
      damage: { ...e.damage },
      slide: 0,
      latUse: 0,
      offTrack: 0,
      grass: 0,
      yaw: 0,
      pit: 'none',
      pitReq: null,
      pitTimer: 0,
      pitTotal: 0,
      pitRel: 0,
      pitLatStart: 0,
      pitCaptureRel: 0,
      pitHeadErr: 0,
      pitStopRel: 0,
      pitDrive: false,
      pitShift: 24,
      pitWait: 0,
      pitDecided: false,
      pitMissed: false,
      pits: 0,
      lastPitTime: 0,
      finished: false,
      finishTime: 0,
      dnf: false,
      dnfReason: '',
      pos: gridPos + 1,
      gridPos: gridPos + 1,
      ai,
      overtakes: 0,
      slip: 0,
      collideCd: 0,
      odo: 0,
      started: false,
      stopIndex: 0,
      lastWarn: {},
      lapTimes: [],
    };
  }

  msg(text: string, kind: RaceMessage['kind'] = 'info', carId?: string) {
    this.messages.push({ t: this.time, text, kind, carId });
    if (this.messages.length > 60) this.messages.shift();
  }

  get human(): CarSim | null {
    return this.humanId ? this.byId[this.humanId] : null;
  }

  requestPit(id: string, req: PitRequest | null) {
    const c = this.byId[id];
    if (!c || c.pit !== 'none') return;
    c.pitReq = req;
  }

  // Fahrzeug zurück auf die Ideallinie setzen (z. B. nach Dreher)
  resetCar(id: string) {
    const c = this.byId[id];
    if (!c || c.dnf || c.pit !== 'none') return;
    const g = this.geo;
    const i = c.idx;
    const p = pointAt(g, i * g.ds, g.lineOff[i]);
    c.x = p.x;
    c.y = p.y;
    c.h = Math.atan2(p.ty, p.tx);
    c.vx = c.vy = 0;
    c.speed = 0;
    c.steer = 0;
    c.yaw = 0;
    c.grass = 0;
    c.slide = 0;
    c.lat = g.lineOff[i];
    this.msg('Zurück auf die Strecke gesetzt.', 'info', id);
  }

  // Fortschritt des Rennens 0..1 (für Wetterverlauf)
  progress(): number {
    if (this.cfg.mode !== 'race') return Math.min(1, this.time / 240);
    let best = 0;
    for (const c of this.cars) best = Math.max(best, c.dist);
    return Math.max(0, Math.min(1, best / this.raceDist));
  }

  private updateWeather(dt: number) {
    const prog = this.progress();
    let kind: WeatherKind = this.cfg.weather[0]?.kind ?? 'sunny';
    for (const seg of this.cfg.weather) if (prog >= seg.at) kind = seg.kind;
    if (kind !== this.weatherNow) {
      const wasDry = WETNESS[this.weatherNow] === 0;
      this.weatherNow = kind;
      if (wasDry && WETNESS[kind] > 0) {
        this.msg('Regen setzt ein! Strecke wird nass.', 'warn');
        const h = this.human;
        if (h && this.cfg.mode === 'race' && !this.autopilotHuman && ['soft', 'medium', 'hard'].includes(h.tyre.compound)) {
          this.msg('Mit Slicks wird es rutschig: Taste P (oder BOX) ruft dich zum Reifenwechsel an die Box.', 'warn', h.cfg.id);
        }
      }
      else if (WETNESS[kind] === 0) this.msg('Der Regen hört auf, die Strecke trocknet ab.', 'info');
      else if (kind === 'heavyRain') this.msg('Starker Regen! Wet-Reifen empfohlen.', 'warn');
      this.onEvent?.({ type: 'weather', data: kind });
    }
    const target = WETNESS[kind];
    const rate = target > this.wetness ? 0.02 : 0.0055;
    if (Math.abs(target - this.wetness) < rate * dt) this.wetness = target;
    else this.wetness += Math.sign(target - this.wetness) * rate * dt;
  }

  tyreGrip(c: CarSim): number {
    const t = c.tyre;
    let g = compoundGrip(t.compound, this.wetness);
    const w = t.wear;
    g *= w < 0.62 ? 1 - 0.1 * w : 0.938 - 0.75 * (w - 0.62) * (w - 0.62) * 2.2 - (w - 0.62) * 0.12;
    const [lo, hi] = TEMP_WINDOW[t.compound];
    if (t.temp < lo) g *= 1 - Math.min(0.13, (lo - t.temp) * 0.0035);
    else if (t.temp > hi) g *= 1 - Math.min(0.1, (t.temp - hi) * 0.004);
    g *= 1 - this.wetness * 0.12;
    // Fahrerkönnen im Nassen
    if (this.wetness > 0.15) g *= 1 + (c.cfg.driver.wet - 60) * 0.0006 * this.wetness;
    return Math.max(0.25, g) * c.cfg.car.gripBonus;
  }

  // Effektive Fahrzeugwerte inkl. Schäden, Gewicht, Windschatten
  eff(c: CarSim) {
    const p = c.cfg.car;
    const d = c.damage;
    const fuelKg = Math.max(0, c.fuel) * 70;
    const massF = (p.weight + 80) / (p.weight + 80 + fuelKg);
    const tyreG = this.tyreGrip(c);
    const grassGrip = this.cfg.track.street ? 0.82 : 0.55;
    const surf = (1 - c.grass * (1 - grassGrip)) * (c.offTrack === 1 ? 0.97 : 1);
    const gripMul = tyreG * surf * (1 - 0.05 * d.frontWing) * (1 - 0.18 * d.suspension);
    return {
      vmax: p.vmax * (1 - 0.15 * d.engine) * (1 + c.slip * 0.055 + (c.boost ? 0.035 : 0)) * (c.tyre.wear > 0.95 ? 0.85 : 1),
      accel: p.accel * (1 - 0.25 * d.gearbox) * (1 - 0.1 * d.engine) * massF * (c.boost ? 1.14 : 1),
      // Bremsen hängt wie alles am Reifengrip: bei Nässe wird der Bremsweg deutlich länger
      brake: p.brake * (1 - 0.4 * d.brakes) * Math.min(1, gripMul / 0.95),
      mech: p.mechGrip * gripMul,
      aero: p.aeroGrip * gripMul * (1 - 0.55 * d.frontWing),
      gripMul,
    };
  }

  latGrip(c: CarSim, v: number, e = this.eff(c)) {
    const r = v / 80;
    return e.mech + e.aero * r * r;
  }

  step(dt: number) {
    this.collisionsThisFrame = 0;
    if (this.phase === 'countdown') {
      this.time += dt;
      this.countdown = this.time;
      if (this.time >= this.lightsOut) {
        this.phase = 'racing';
        this.time = 0;
        this.onEvent?.({ type: 'lightsOut' });
        this.msg('Lichter aus – los geht’s!', 'good');
      }
      return;
    }
    if (this.phase === 'finished') {
      this.time += dt;
      for (const c of this.cars) if (!c.dnf) this.stepCar(c, dt);
      return;
    }
    this.time += dt;
    this.updateWeather(dt);
    this.updateExitLight();
    for (const c of this.cars) {
      if (c.dnf) continue;
      this.stepCar(c, dt);
    }
    this.collide();
    this.updatePositions();
    // Partikel
    for (const sp of this.sparks) {
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
    }
    if (this.sparks.length) this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const sk of this.skids) sk.life -= dt * 0.12;
    if (this.skids.length > 600) this.skids.splice(0, this.skids.length - 600);
    this.checkEnd();
  }

  private checkEnd() {
    const mode = this.cfg.mode;
    if (mode === 'race') {
      const active = this.cars.filter((c) => !c.dnf && !c.finished);
      if (active.length === 0 || (this.leaderFinished && this.time - this.leaderFinishTime > 100)) {
        this.phase = 'finished';
        this.onEvent?.({ type: 'finished' });
      }
    }
  }

  private stepCar(c: CarSim, dt: number) {
    const g = this.geo;
    const L = g.length;
    if (c.collideCd > 0) c.collideCd -= dt;
    // --- Steuerung ermitteln
    let inp: Input;
    const isHuman = c.cfg.human && !this.autopilotHuman && !c.finished;
    if (c.pit !== 'none') {
      this.stepPit(c, dt);
      return;
    }
    if (isHuman) {
      inp = this.humanInput;
      if (this.cfg.assists.brake) {
        // Bremsassistent: bremst automatisch, wenn deutlich zu schnell für die kommende Kurve
        if (c.ai.profileTimer <= 0) {
          computeProfile(this, c, 0.97, 0.92);
          c.ai.profileTimer = 1;
        }
        c.ai.profileTimer -= dt;
        const ahead = wrapIndex(c.idx + Math.round((c.speed * 0.3 + 4) / g.ds), g.n);
        const vt = c.ai.profile[ahead];
        if (c.speed > vt + 3 && inp.brake < 0.6) inp = { ...inp, brake: Math.min(1, (c.speed - vt) / 8), throttle: 0 };
      }
    } else {
      inp = aiControl(this, c, dt);
    }
    if (!c.started) {
      if (this.time >= (c.cfg.human && !this.autopilotHuman ? 0 : c.ai.startDelay)) c.started = true;
      else inp = { throttle: 0, brake: 1, steer: 0, boost: false };
    }
    if (c.fuel <= 0) inp = { ...inp, throttle: 0, boost: false };

    // Lenken glätten: Tastatur-Einschlag baut sich auf und wird mit dem Tempo langsamer (kein Zucken bei hoher Geschwindigkeit)
    {
      const ds = inp.steer - c.steer;
      let rate: number;
      if (isHuman) {
        const spF = Math.max(0, Math.min(1, c.speed / Math.max(30, c.cfg.car.vmax)));
        const rise = PHYS.rise * this.cfg.steerSensitivity * (1 - PHYS.riseSpd * spF);
        const toward0 = Math.abs(inp.steer) < Math.abs(c.steer) || inp.steer * c.steer < 0;
        rate = toward0 ? rise * PHYS.ret : rise;
      } else rate = 6;
      c.steer += Math.sign(ds) * Math.min(Math.abs(ds), rate * dt);
    }
    c.throttle = inp.throttle;
    c.brake = inp.brake;
    c.boost = inp.boost && c.ers > 0.02 && inp.throttle > 0.5;

    const e = this.eff(c);
    const fx = Math.cos(c.h);
    const fy = Math.sin(c.h);
    let vx = c.vx;
    let vy = c.vy;
    let vF = vx * fx + vy * fy;
    const v = Math.hypot(vx, vy);
    const lat = this.latGrip(c, v, e);

    // Längsdynamik
    let aLong = 0;
    if (c.throttle > 0) {
      if (vF >= -0.5) {
        const ratio = Math.max(0, vF) / e.vmax;
        aLong += c.throttle * e.accel * Math.max(-0.6, 1 - ratio * ratio);
      } else aLong += c.throttle * 9;
    }
    // Traktion: bei Nässe können die Reifen weniger Vortrieb übertragen
    let accelUse = 0;
    if (aLong > 0) {
      const tcap = lat * 1.2 + 0.8;
      if (aLong > tcap) aLong = tcap;
      accelUse = Math.min(1, aLong / Math.max(4, lat));
    }
    const brakeCap = Math.min(e.brake, lat * 1.35 + 4 * Math.min(1, e.gripMul / 0.95));
    if (c.brake > 0) {
      if (vF > 0.5) aLong -= c.brake * brakeCap;
      else if (vF > -6 && isHuman && c.throttle < 0.1) aLong -= c.brake * 5; // rückwärts
      else if (vF < -0.5) aLong += c.brake * brakeCap;
    }
    // Roll- und Luftwiderstand
    aLong -= Math.sign(vF) * (0.35 + 0.00028 * vF * vF);
    if (c.throttle === 0 && c.brake === 0) aLong -= Math.sign(vF) * 0.8;
    if (c.grass > 0.3 && !this.cfg.track.street) aLong -= Math.sign(vF) * (3.5 + Math.abs(vF) * 0.07) * Math.min(1, c.grass * 1.4);
    vF += aLong * dt;
    if (!isHuman && vF < 0) vF = 0;

    // Querdynamik: Geschwindigkeitsvektor zur Fahrzeugausrichtung ziehen
    const brakeUse = c.brake > 0 && vF > 0 ? Math.min(1, (c.brake * brakeCap) / (lat * 1.35 + 4)) : 0;
    const latAvail = lat * Math.sqrt(Math.max(0.35, 1 - brakeUse * brakeUse * 0.55 - (isHuman ? accelUse * accelUse * PHYS.accelCirc : 0)));
    const vLat = -vx * fy + vy * fx;
    vx = fx * vF - fy * vLat;
    vy = fy * vF + fx * vLat;
    const sp = Math.hypot(vx, vy);
    let slideAmt = 0;
    if (sp > 0.5) {
      const velAng = Math.atan2(vy, vx);
      let beta = c.h - velAng;
      if (vF < 0) beta += Math.PI;
      beta = Math.atan2(Math.sin(beta), Math.cos(beta));
      const maxRot = (latAvail * dt) / Math.max(sp, 1);
      const rot = Math.sign(beta) * Math.min(Math.abs(beta), maxRot);
      const ca = Math.cos(rot), sa = Math.sin(rot);
      const nvx = vx * ca - vy * sa;
      const nvy = vx * sa + vy * ca;
      vx = nvx;
      vy = nvy;
      if (Math.abs(beta) > maxRot) {
        slideAmt = Math.min(1, (Math.abs(beta) - maxRot) * 6);
        // Reibverlust beim Rutschen
        const scrub = Math.min(sp, latAvail * 0.4 * Math.sin(Math.min(1.2, Math.abs(beta))) * dt);
        const k = (sp - scrub) / sp;
        vx *= k;
        vy *= k;
      }
    }
    c.slide = c.slide * 0.8 + slideAmt * 0.2;

    // Gieren
    const vNow = Math.hypot(vx, vy);
    const vSign = vF >= 0 ? 1 : -1;
    const latNom = this.latGrip(c, Math.max(vNow, 1), e);
    if (isHuman) {
      // Spielerauto: Der Lenkeinschlag verlangt höchstens, was die Reifen halten. Wer mehr will, schiebt über die
      // Vorderräder (Untersteuern) statt sofort zu driften. Übersteuern entsteht nur durch Gas, Bremsen und Nässe
      // beim Einlenken, und das Heck wird von der Stabilisierung zur Fahrtrichtung zurückgezogen.
      const assist = this.cfg.assists.steer;
      const vmax = Math.max(30, e.vmax);
      const kd = assist ? PHYS.kd : PHYS.kdOff;
      const maxCurv = Math.min(1 / 5.5, (latNom * kd) / Math.max(1, vNow * vNow));
      const steerEff = Math.sign(c.steer) * Math.pow(Math.abs(c.steer), PHYS.exp);
      const wTarget = vSign * Math.min(vNow, Math.abs(vF) + 0.5) * steerEff * maxCurv;
      c.yaw += (wTarget - c.yaw) * (1 - Math.exp(-dt / PHYS.lag));
      const sAbs = Math.min(1, Math.abs(c.steer) * 1.6);
      const powerOS = Math.max(0, c.throttle) * Math.max(0, 1 - vNow / (0.62 * vmax));
      const brakeOS = brakeUse * Math.min(1, vNow / 40);
      const over = 1 + (assist ? 1 : 1.7) * (PHYS.osP * powerOS + PHYS.osB * brakeOS) * sAbs;
      const wMax = (latAvail / Math.max(vNow, 4)) * over;
      c.yaw = Math.max(-wMax, Math.min(wMax, c.yaw));
      let w = c.yaw;
      if (vF > 3 && vNow > 6) {
        let beta = c.h - Math.atan2(vy, vx);
        beta = Math.atan2(Math.sin(beta), Math.cos(beta));
        const kStab = (assist ? PHYS.kStab : PHYS.kStabOff) * (1 - 0.45 * this.wetness) * (1 + c.cfg.car.stability * 2);
        w -= kStab * beta * (1 - PHYS.stabSteer * Math.min(1, Math.abs(c.steer)));
      }
      c.h += w * dt;
      c.latUse = Math.min(1.5, (Math.abs(w) * vNow) / Math.max(1, latAvail));
    } else {
      const steerK = 1.3;
      const maxCurv = Math.min(1 / 5.5, (latNom * steerK) / Math.max(1, vNow * vNow));
      c.h += vSign * Math.min(vNow, Math.abs(vF) + 0.5) * c.steer * maxCurv * dt;
      c.latUse = Math.min(1.5, (vNow * vNow * Math.abs(c.steer) * maxCurv) / Math.max(1, latAvail));
    }

    // Position
    c.vx = vx;
    c.vy = vy;
    c.speed = vNow;
    const px = c.x, py = c.y;
    c.x += vx * dt;
    c.y += vy * dt;
    c.odo += vNow * dt;

    // Streckenbezug
    c.idx = nearestIndex(g, c.x, c.y, c.idx, 24);
    const i = c.idx;
    const dx = c.x - g.x[i];
    const dy = c.y - g.y[i];
    c.lat = dx * g.nx[i] + dy * g.ny[i];
    const along = dx * g.tx[i] + dy * g.ty[i];
    const newS = (i * g.ds + along + L) % L;
    let dS = newS - c.s;
    if (dS > L / 2) dS -= L;
    if (dS < -L / 2) dS += L;
    c.s = newS;
    const prevDist = c.dist;
    c.dist += dS;

    // Randsteine, Auslauf, Mauer
    const hw = g.halfWidth;
    const al = Math.abs(c.lat);
    c.offTrack = al > hw + 1.3 ? 2 : al > hw - 0.3 ? 1 : 0;
    c.grass += (Math.max(0, Math.min(1, (al - (hw - 0.2)) / 2.4)) - c.grass) * Math.min(1, dt * 10);
    const sign = Math.sign(c.lat) || 1;
    const wall = this.wallAt(c.s, sign);
    if (al > wall - 1) {
      const pen = al - (wall - 1);
      c.x -= g.nx[i] * pen * sign;
      c.y -= g.ny[i] * pen * sign;
      const vn = c.vx * g.nx[i] + c.vy * g.ny[i];
      if (vn * sign > 0) {
        const impact = Math.abs(vn);
        c.vx -= g.nx[i] * vn * 1.35;
        c.vy -= g.ny[i] * vn * 1.35;
        const keep = Math.max(0.5, 1 - impact * 0.02);
        c.vx *= keep;
        c.vy *= keep;
        if (impact > 3.5) {
          this.addDamage(c, 'frontWing', impact * 0.018);
          this.addDamage(c, 'suspension', Math.max(0, impact - 10) * 0.025);
          this.spark(c.x + g.nx[i] * sign, c.y + g.ny[i] * sign, impact);
          this.onEvent?.({ type: 'wall', carId: c.cfg.id, data: impact });
          if (c.cfg.human) this.collisionsThisFrame = Math.max(this.collisionsThisFrame, impact);
        }
      }
      // Ausrichtung nach Einschlag leicht zur Strecke drehen
      const th = Math.atan2(g.ty[i], g.tx[i]);
      let dh = th - c.h;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      if (Math.abs(dh) < Math.PI / 2) c.h += dh * 0.08;
    }

    // Reifen
    const t = c.tyre;
    const w = this.wetness;
    const driverTyre = 1.15 - c.cfg.driver.tyreMgmt * 0.003;
    const styleW = c.cfg.human && !this.autopilotHuman ? 1 : c.cfg.strategy.style === 'attack' ? 1.18 : c.cfg.strategy.style === 'conserve' ? 0.82 : 1;
    let wetMul = 1;
    if (t.compound === 'inter' && w < 0.3) wetMul = 1 + 2.5 * (1 - w / 0.3);
    if (t.compound === 'wet' && w < 0.5) wetMul = 1 + 4 * (1 - w / 0.5);
    const load = 0.62 + 0.85 * Math.min(1.2, c.latUse) ** 2 + c.slide * 1.6 + 0.25 * brakeUse + c.grass * 0.6;
    const life = COMPOUNDS[t.compound].life;
    const wearPerM = (0.7 / (life * this.wearDist)) * this.cfg.track.tyreWear * c.cfg.car.tyreWear * driverTyre * styleW * wetMul;
    const hot = t.temp > TEMP_WINDOW[t.compound][1] ? 1 + (t.temp - TEMP_WINDOW[t.compound][1]) * 0.03 : 1;
    t.wear = Math.min(1, t.wear + wearPerM * load * hot * vNow * dt);
    t.age += vNow * dt;
    const air = AIR_TEMP[this.weatherNow];
    const tgt = air + 26 + vNow * 0.48 + Math.min(1.2, c.latUse) * 26 + c.slide * 40 + brakeUse * 8 - w * 46 + (t.compound === 'soft' ? 4 : t.compound === 'hard' ? -3 : 0);
    t.temp += (tgt - t.temp) * Math.min(1, dt * 0.22);

    // Kraftstoff (Anteil am Rennbedarf)
    if (this.cfg.mode === 'race') {
      const styleF = c.cfg.human && !this.autopilotHuman ? 1 : c.cfg.strategy.style === 'attack' ? 1.04 : c.cfg.strategy.style === 'conserve' ? 0.93 : 1;
      c.fuel -= ((vNow * dt) / this.raceDist) * (0.35 + 0.75 * c.throttle) / 0.91 * c.cfg.car.fuelUse * styleF;
      if (c.fuel <= 0 && !c.lastWarn.fuelOut) {
        c.lastWarn.fuelOut = 1;
        if (c.cfg.human) this.msg('Kein Sprit mehr! Das Auto rollt aus.', 'bad', c.cfg.id);
      }
    }

    // ERS
    if (c.boost) c.ers = Math.max(0, c.ers - 0.17 * dt);
    else c.ers = Math.min(1, c.ers + (0.012 + brakeUse * 0.12) * dt);

    // Bremsverschleiß & Zuverlässigkeit
    c.damage.brakes = Math.min(0.95, c.damage.brakes + brakeUse * dt * 0.00045 * this.cfg.track.brakeWear);
    if (this.cfg.mode === 'race' && c.started && !c.finished) {
      const rel = c.cfg.car.reliability;
      const styleR = c.cfg.strategy.style === 'attack' ? 1.35 : c.cfg.strategy.style === 'conserve' ? 0.8 : 1;
      const hazard = 0.6e-6 * Math.pow(Math.max(5, 125 - rel), 1.5) * (1 + 2 * (c.damage.engine + c.damage.gearbox)) * styleR * (c.boost ? 1.6 : 1);
      if (Math.random() < hazard * dt) {
        const part: DamageKey = Math.random() < 0.62 ? 'engine' : 'gearbox';
        const amt = 0.15 + Math.random() * 0.45;
        this.addDamage(c, part, amt);
        if (!c.dnf) this.msg(`${c.cfg.short}: Problem am ${part === 'engine' ? 'Motor' : 'Getriebe'}!`, c.cfg.playerTeam ? 'bad' : 'info', c.cfg.id);
      }
    }

    // Windschatten
    c.slip = Math.max(0, c.slip - dt * 2);
    if (vNow > 30) {
      for (const o of this.cars) {
        if (o === c || o.dnf || o.pit !== 'none') continue;
        const ox = o.x - c.x, oy = o.y - c.y;
        const fwd = ox * fx + oy * fy;
        if (fwd < 4 || fwd > 45) continue;
        const side = Math.abs(-ox * fy + oy * fx);
        if (side < 2.6) c.slip = Math.max(c.slip, 1 - (fwd - 4) / 41);
      }
    }

    // Reifenspuren
    if ((c.slide > 0.35 || (brakeUse > 0.95 && vNow > 25)) && this.skids.length < 900 && Math.random() < 0.5) {
      this.skids.push({ x: c.x, y: c.y, h: c.h, life: 1 });
    }
    void px;
    void py;

    // Runden & Sektoren
    this.handleTiming(c, prevDist);

    // Boxengasse: KI-Entscheidung, Einfahrt, verpasste Einfahrt
    if (!c.finished) this.pitLogic(c, dS, !!isHuman);
  }

  private handleTiming(c: CarSim, prevDist: number) {
    const L = this.geo.length;
    const prevLap = Math.floor(prevDist / L);
    const nowLap = Math.floor(c.dist / L);
    const sec = Math.min(2, Math.floor((((c.dist % L) + L) % L) / (L / 3)));
    if (nowLap > prevLap) {
      if (nowLap >= 1 && c.lapStart >= 0 && (this.cfg.mode === 'race' || c.lapsDone >= 0)) {
        const lt = this.time - c.lapStart;
        const timed = this.cfg.mode === 'race' ? nowLap >= 1 && c.lapsDone >= 0 && prevLap >= 0 : prevLap >= 0;
        if (timed) {
          c.sectors[2] = this.time - c.sectorStart;
          this.sectorDone(c, 2);
          c.lastLap = lt;
          c.lapTimes.push(lt);
          if (lt < c.bestLap) c.bestLap = lt;
          if (lt < this.fastestLap.time) {
            const had = this.fastestLap.id !== '';
            this.fastestLap = { id: c.cfg.id, time: lt };
            if (had && this.cfg.mode === 'race') this.msg(`Schnellste Runde: ${c.cfg.short} ${fmt(lt)}`, c.cfg.playerTeam ? 'good' : 'info', c.cfg.id);
          }
          this.onEvent?.({ type: 'lap', carId: c.cfg.id, data: lt });
        }
      }
      c.lapsDone = Math.max(0, nowLap);
      c.lapStart = this.time;
      c.sectorStart = this.time;
      c.sector = 0;
      if (this.cfg.mode === 'race') {
        if (!c.finished && (this.leaderFinished || c.lapsDone >= this.cfg.laps) && c.lapsDone >= 1) {
          c.finished = true;
          c.finishTime = this.time;
          if (!this.leaderFinished) {
            this.leaderFinished = true;
            this.leaderFinishTime = this.time;
            this.msg(`Zielflagge! ${c.cfg.name} gewinnt.`, c.cfg.playerTeam ? 'good' : 'info', c.cfg.id);
            this.onEvent?.({ type: 'flag', carId: c.cfg.id });
          }
          this.onEvent?.({ type: 'carFinished', carId: c.cfg.id });
        }
      }
    } else if (sec > c.sector && nowLap >= 0) {
      c.sectors[c.sector] = this.time - c.sectorStart;
      this.sectorDone(c, c.sector);
      c.sector = sec;
      c.sectorStart = this.time;
    }
  }

  private sectorDone(c: CarSim, i: number) {
    const t = c.sectors[i];
    if (t <= 0) return;
    if (t < c.bestSectors[i]) c.bestSectors[i] = t;
    if (t < this.bestSectorsOverall[i]) this.bestSectorsOverall[i] = t;
  }

  private aiPitDecision(c: CarSim): PitRequest | null {
    const st = c.cfg.strategy;
    const lapsLeft = this.cfg.laps - c.lapsDone;
    if (lapsLeft <= 1) return null; // in der letzten Runde lohnt kein Stopp mehr
    const w = this.wetness;
    const ideal = bestCompoundFor(w, lapsLeft <= 2 ? 'soft' : 'medium');
    const isSlick = ['soft', 'medium', 'hard'].includes(c.tyre.compound);
    const wrongTyre = st.reactToWeather || !c.cfg.playerTeam ? (isSlick && w > 0.32) || (!isSlick && w < 0.15) || (c.tyre.compound === 'inter' && w > 0.75) : false;
    const planned = st.stops[c.stopIndex];
    const lapNow = c.lapsDone + 1;
    const fuelNeed = Math.max(0, (this.raceDist - c.dist) / this.raceDist);
    const fuelShort = c.fuel < fuelNeed * 0.98;
    const damaged = c.damage.frontWing > 0.35;
    let wantCompound: Compound | null = null;
    if (wrongTyre) wantCompound = ideal;
    else if (planned && lapNow >= planned.lap) {
      wantCompound = planned.compound;
      if (isSlick && ['inter', 'wet'].includes(planned.compound) && w < 0.2) wantCompound = 'medium';
      if (!isSlick && w > 0.3) wantCompound = ideal;
    } else if (!planned) {
      // ungeplanter Stopp nur bei Reifen am Ende
      const remainingNeed = lapsLeft / Math.max(1, this.cfg.laps);
      if (c.tyre.wear > 0.8 && remainingNeed > 0.12) wantCompound = isSlick ? (lapsLeft <= 3 ? 'soft' : 'medium') : ideal;
    }
    if (!wantCompound && (fuelShort || damaged) && lapsLeft > 1) wantCompound = isSlick ? (c.tyre.wear > 0.4 ? 'medium' : c.tyre.compound) : c.tyre.compound;
    if (!wantCompound) return null;
    if (planned && lapNow >= planned.lap) c.stopIndex++;
    return { compound: wantCompound, repair: damaged || c.damage.suspension > 0.3, refuel: fuelShort };
  }

  // ---------- Boxengasse ----------
  // Aufbau (Querabstand von der Streckenkante, auf der Boxenseite):
  //   Strecke | Grünstreifen | Boxenmauer | Fahrspur (Limiter) | Arbeitsspur | Garagen | Außenmauer
  // Die Zufahrt zweigt am Einfahrtspunkt von der Strecke ab, die Ausfahrt mündet am Ende wieder ein.

  /** Weg ab der Einfahrtslinie (0 … Streckenlänge) */
  pitRelOf(s: number) {
    const L = this.geo.length;
    return (((s - this.pitIn) % L) + L) % L;
  }

  /** Position der Box eines Teams, als Weg ab der Einfahrt */
  boxRel(idx: number) {
    const L = this.geo.length;
    return this.pitRelOf(L - PIT.firstBox + idx * PIT.boxGap);
  }

  /** Streckenposition der Box (für die Darstellung) */
  boxS(idx: number) {
    const L = this.geo.length;
    return (L - PIT.firstBox + idx * PIT.boxGap + L * 2) % L;
  }

  /** Äußere Begrenzung (ohne Boxenmauer): öffnet sich auf der Boxenseite hinter den Garagen */
  outerWallAt(s: number, sign: number): number {
    const hw = this.geo.halfWidth;
    const base = hw + this.cfg.track.runoff;
    if (sign !== this.pitSide) return base;
    const outer = Math.max(base, hw + PIT.barrier);
    let rel = this.pitRelOf(s);
    if (rel > this.geo.length - 30) rel -= this.geo.length;
    if (rel < -30 || rel > this.pitLen + 30) return base;
    if (rel < 0) return base + (outer - base) * smooth((rel + 30) / 30);
    if (rel <= this.pitLen) return outer;
    return outer + (base - outer) * smooth((rel - this.pitLen) / 30);
  }

  /** Abstand der Wand zur Mittellinie, an der Autos anschlagen: auf der Boxenseite zwischen Zufahrt und Ausfahrt die Boxenmauer */
  wallAt(s: number, sign: number): number {
    const outer = this.outerWallAt(s, sign);
    if (sign !== this.pitSide) return outer;
    const rel = this.pitRelOf(s);
    if (rel >= PIT.entryLen && rel <= this.pitLen - PIT.exitLen) return Math.min(outer, this.geo.halfWidth + PIT.wall);
    return outer;
  }

  /** Tempolimit der Boxengasse beginnt an der Einfahrtslinie und gilt bis zum Ende der Zufahrt der Ausfahrt */
  private pitLogic(c: CarSim, dS: number, isHuman: boolean) {
    const L = this.geo.length;
    const hw = this.geo.halfWidth;
    const toIn = (((this.pitIn - c.s) % L) + L) % L;
    // KI entscheidet ca. 270 m vor der Einfahrt, ob sie in dieser Runde reinkommt
    if (!isHuman && this.cfg.mode === 'race') {
      if (toIn <= 290 && toIn > 250) {
        if (!c.pitDecided) {
          c.pitDecided = true;
          if (!c.pitReq) {
            const req = this.aiPitDecision(c);
            if (req) c.pitReq = req;
          }
        }
      } else c.pitDecided = false;
    }
    const rel = this.pitRelOf(c.s);
    if (rel < PIT.entryLen + 8 && dS > 0) {
      const side = c.lat * this.pitSide;
      // Im Training, Qualifying und auf der Teststrecke gibt es keine Stopps: die Gasse lässt sich nur durchfahren
      const lastLap = this.cfg.mode !== 'race' || c.lapsDone >= this.cfg.laps - 1;
      if (!c.pitReq) {
        // Wer von selbst auf die Zufahrt abbiegt, meldet sich damit an: das Team bereitet den Stopp vor
        if (isHuman && side > hw + 1.0) {
          if (lastLap || rel >= PIT.entryLen) {
            this.enterPit(c, true);
            this.msg(lastLap ? (this.cfg.mode === 'race' ? 'Letzte Runde: Durchfahrt durch die Boxengasse, ohne Stopp.' : 'Durchfahrt durch die Boxengasse: Boxenstopps gibt es nur im Rennen.') : 'Zu spät eingebogen: Durchfahrt durch die Boxengasse, ohne Stopp.', 'info', c.cfg.id);
          } else {
            c.pitReq = this.defaultPitRequest(c);
            this.enterPit(c);
            this.msg(`Boxeneinfahrt: Dein Team wartet. Neue Reifen: ${COMPOUNDS[c.pitReq.compound].label}. Mit P kannst du den Stopp noch absagen.`, 'warn', c.cfg.id);
          }
        }
        return;
      }
      if (lastLap) {
        // letzte Runde: Stopp lohnt nicht mehr
        c.pitReq = null;
        if (isHuman) this.msg('Letzte Runde – der Boxenstopp ist abgesagt.', 'info', c.cfg.id);
        return;
      }
      if (rel >= PIT.entryLen) {
        // zu spät auf die Zufahrt gelenkt: nicht an der Boxenmauer abprallen, sondern durchfahren (der Wunsch bleibt für die nächste Runde)
        if (isHuman && side > hw + 1.0) {
          this.enterPit(c, true);
          this.msg('Zu spät eingebogen: Durchfahrt ohne Stopp. Dein Stopp-Wunsch gilt für die nächste Runde.', 'warn', c.cfg.id);
        }
        return;
      }
      if (isHuman && side < -0.15 * hw) return; // Fahrer ist auf der falschen Streckenseite
      this.enterPit(c);
    } else if (rel >= PIT.entryLen + 8 && rel < PIT.entryLen + 68 && c.pitReq && isHuman && !c.pitMissed) {
      c.pitMissed = true;
      this.msg('Boxeneinfahrt verpasst – der Stopp gilt für die nächste Runde.', 'warn', c.cfg.id);
    } else if (rel > L * 0.5) c.pitMissed = false;
  }

  /** Vorschlag für einen Stopp: passende Reifen für Wetter und Plan, Reparatur bei Schäden, Nachtanken wenn nötig */
  defaultPitRequest(c: CarSim): PitRequest {
    const planned = c.cfg.strategy.stops[c.stopIndex];
    let compound: Compound;
    if (this.wetness > 0.28) compound = bestCompoundFor(this.wetness);
    else if (planned?.compound && !['inter', 'wet'].includes(planned.compound)) compound = planned.compound;
    else compound = c.tyre.compound === 'soft' ? 'medium' : 'soft';
    const need = Math.max(0, (this.raceDist - c.dist) / this.raceDist);
    return { compound, repair: c.damage.frontWing > 0.15 || c.damage.suspension > 0.15, refuel: c.fuel < need * 1.02 };
  }

  /** Stopp in der Boxengasse noch absagen (nur solange das Auto nicht in die Arbeitsspur eingebogen ist): es wird eine Durchfahrt */
  cancelPitStop(id: string): boolean {
    const c = this.byId[id];
    if (!c || (c.pit !== 'entry' && c.pit !== 'toBox') || c.pitDrive) return false;
    if (c.pitRel > c.pitStopRel - c.pitShift - 1) return false;
    c.pitDrive = true;
    c.pitReq = null;
    if (c.cfg.human) this.msg('Stopp abgesagt: Du fährst durch die Boxengasse durch.', 'info', id);
    return true;
  }

  private enterPit(c: CarSim, drive = false) {
    const g = this.geo;
    c.pit = 'entry';
    c.pitDrive = drive;
    c.pitRel = this.pitRelOf(c.s);
    c.pitCaptureRel = c.pitRel;
    c.pitLatStart = c.lat;
    c.pitWait = 0;
    // Wartet schon ein Auto desselben Teams an der Box, hält dieses Auto dahinter
    let slot = 0;
    for (const o of this.cars) {
      if (o !== c && o.cfg.boxIndex === c.cfg.boxIndex && (o.pit === 'entry' || o.pit === 'toBox' || o.pit === 'stopped')) slot++;
    }
    c.pitStopRel = this.boxRel(c.cfg.boxIndex) - slot * 9.5;
    c.pitShift = Math.max(8, Math.min(24, c.pitStopRel - c.pitRel - 2));
    const p = pointAt(g, c.s, 0);
    const ang = Math.atan2(this.railLat(c, c.pitRel + 3) - this.railLat(c, c.pitRel), 3);
    let err = c.h - (Math.atan2(p.ty, p.tx) + ang);
    err = Math.atan2(Math.sin(err), Math.cos(err));
    c.pitHeadErr = err;
    if (c.cfg.human && !drive) this.msg('Boxengasse: Limiter aktiv (80 km/h).', 'info', c.cfg.id);
    this.onEvent?.({ type: 'pitEntry', carId: c.cfg.id });
  }

  /** Anteil (0 … 1), zu dem das Auto von der Fahrspur in die Arbeitsspur an seiner Box gewechselt ist */
  private workBlend(c: CarSim, cur: number) {
    if (c.pitDrive) return 0;
    const sr = c.pitStopRel;
    const sw = c.pitShift;
    if (cur < sr - sw) return 0;
    if (cur < sr) return smooth((cur - (sr - sw)) / sw);
    if (cur < sr + sw) return c.pits > 0 || c.pit === 'exit' ? 1 - smooth((cur - sr) / sw) : 1;
    return 0;
  }

  /** Seitliche Lage des Autos auf der Boxengassen-Strecke */
  private railLat(c: CarSim, cur: number): number {
    const total = this.pitLen;
    const eL = PIT.entryLen;
    const xL = PIT.exitLen;
    const fast = this.pitLat;
    let lat: number;
    if (cur > total - xL) {
      const merge = this.pitSide * this.geo.halfWidth * 0.4;
      lat = fast + (merge - fast) * smooth((cur - (total - xL)) / xL);
    } else {
      // von der Lage beim Erfassen sanft auf die Fahrspur einlenken (mindestens 30 m)
      const c0 = c.pitCaptureRel;
      const len = Math.max(eL - c0, 30);
      lat = cur >= c0 + len ? fast : c.pitLatStart + (fast - c.pitLatStart) * smooth((cur - c0) / len);
    }
    return lat + (this.pitWorkLat - fast) * this.workBlend(c, cur) * (cur < total - xL ? 1 : 0);
  }

  /** Ausfahrtsampel: rot, solange sich Verkehr auf der Strecke nähert */
  private updateExitLight() {
    const L = this.geo.length;
    let red = false;
    for (const o of this.cars) {
      if (o.dnf || o.pit !== 'none') continue;
      let d = (((this.pitOut - o.s) % L) + L) % L;
      if (d > L / 2) d -= L;
      if (d > -14 && d < o.speed * 2.4 + 35 && o.lat * this.pitSide > -this.geo.halfWidth * 0.2) {
        red = true;
        break;
      }
    }
    this.exitRed = red;
  }

  // Fahrt durch die Boxengasse (geführt): Zufahrt, Fahrspur mit Limiter, Arbeitsspur, Stopp, Ausfahrt mit Ampel
  private stepPit(c: CarSim, dt: number) {
    const g = this.geo;
    const L = g.length;
    const total = this.pitLen;
    const xStart = total - PIT.exitLen;
    let cur = c.pitRel;
    let target = PIT_SPEED;
    if (c.pit === 'entry' || c.pit === 'toBox') {
      if (cur > PIT.entryLen) c.pit = 'toBox';
      const toBox = c.pitDrive ? 1e9 : c.pitStopRel - cur;
      if (c.pitDrive && cur > xStart - 30) c.pit = 'exit';
      if (toBox < 32) target = Math.max(2, Math.min(PIT_SPEED, toBox * 0.9));
      if (toBox <= 0.6) {
        c.pit = 'stopped';
        c.speed = 0;
        const req = c.pitReq ?? { compound: c.tyre.compound, repair: false, refuel: false };
        let tm = c.cfg.pitBase;
        if (req.repair) tm += 2.5 + c.damage.frontWing * 6 + c.damage.suspension * 8;
        if (req.refuel) tm += 2 + Math.max(0, 1.02 - c.fuel) * 6;
        let err = false;
        if (Math.random() < c.cfg.pitError) {
          tm += 1.5 + Math.random() * 3.5;
          err = true;
        }
        c.pitTimer = tm;
        c.pitTotal = tm;
        c.lastPitTime = tm;
        if (c.cfg.playerTeam) this.msg(`${c.cfg.short}: Stopp ${tm.toFixed(1)} s${err ? ' – Probleme am Rad!' : ''}`, err ? 'bad' : 'good', c.cfg.id);
        this.onEvent?.({ type: 'pitStop', carId: c.cfg.id, data: tm });
      }
    } else if (c.pit === 'stopped') {
      target = 0;
      c.pitTimer -= dt;
      if (c.pitTimer <= 0) {
        const req = c.pitReq ?? { compound: c.tyre.compound, repair: false, refuel: false };
        c.tyre = { compound: req.compound, wear: 0, temp: 70, age: 0 };
        if (req.repair) {
          c.damage.frontWing = 0;
          c.damage.suspension *= 0.4;
          c.damage.brakes *= 0.8;
        }
        if (req.refuel) c.fuel = Math.max(c.fuel, Math.max(0, (this.raceDist - c.dist) / this.raceDist) * 1.08 + 0.02);
        c.pits++;
        c.pitReq = null;
        c.pitWait = 0;
        c.pit = 'exit';
        this.onEvent?.({ type: 'pitGo', carId: c.cfg.id });
      }
    }
    if (c.pit === 'exit') {
      target = PIT_SPEED;
      if (cur > xStart) target = Math.min(48, PIT_SPEED + (cur - xStart) * 0.35);
      // Ausfahrtsampel: vor der Einmündung warten, bis die Strecke frei ist (höchstens 5 s)
      const hold = xStart - 2;
      if (this.exitRed && cur < hold + 3 && c.pitWait < 5) {
        target = Math.min(target, Math.max(0, (hold - cur) * 1.3));
        if (cur > hold - 4 && c.speed < 1.2) c.pitWait += dt;
      }
    }
    // Abstand zum Vordermann auf der Fahrspur halten
    if (c.pit !== 'stopped') {
      for (const o of this.cars) {
        if (o === c || o.pit === 'none') continue;
        const gap = o.pitRel - cur;
        if (gap > 0 && gap < 36 && Math.abs(o.lat - c.lat) < 2.6) target = Math.min(target, Math.max(0, o.speed + (gap - 8) * 1.5));
      }
    }
    const acc = target > c.speed ? (c.pit === 'exit' && cur > xStart ? 14 : 9) : 38;
    if (Math.abs(target - c.speed) < acc * dt) c.speed = target;
    else c.speed += Math.sign(target - c.speed) * acc * dt;
    c.throttle = target > c.speed ? 0.4 : 0;
    c.brake = target < c.speed - 0.5 ? 0.5 : 0;
    const prevDist = c.dist;
    const adv = c.speed * dt;
    cur += adv;
    c.pitRel = cur;
    c.dist += adv;
    c.s = (c.s + adv) % L;
    c.odo += adv;
    c.pitHeadErr *= Math.exp(-adv / 16);
    // Lage und Ausrichtung auf der Boxengassen-Strecke
    const lat = this.railLat(c, cur);
    const ang = Math.atan2(this.railLat(c, cur + 3) - lat, 3);
    const p = pointAt(g, c.s, lat);
    c.h = Math.atan2(p.ty, p.tx) + ang + c.pitHeadErr;
    c.x = p.x;
    c.y = p.y;
    c.vx = Math.cos(c.h) * c.speed;
    c.vy = Math.sin(c.h) * c.speed;
    c.lat = lat;
    c.steer = Math.max(-1, Math.min(1, ang * 4));
    c.idx = nearestIndex(g, c.x, c.y, c.idx, 30);
    c.offTrack = 0;
    c.grass = 0;
    c.yaw = 0;
    c.slide = 0;
    c.tyre.temp += (60 - c.tyre.temp) * dt * 0.1;
    this.handleTiming(c, prevDist);
    if (c.pit === 'exit' && cur >= total) {
      c.pit = 'none';
      c.pitWait = 0;
      c.steer = 0;
      c.idx = nearestIndex(g, c.x, c.y, c.idx, 30);
    }
  }

  addDamage(c: CarSim, k: DamageKey, amt: number) {
    if (amt <= 0 || c.dnf) return;
    c.damage[k] = Math.min(1, c.damage[k] + amt);
    if (c.cfg.human && amt > 0.08) {
      const label = { engine: 'Motor', gearbox: 'Getriebe', brakes: 'Bremsen', frontWing: 'Frontflügel', suspension: 'Aufhängung' }[k];
      if ((c.lastWarn[k] ?? -99) < this.time - 4) {
        c.lastWarn[k] = this.time;
        this.msg(`Schaden: ${label} (${Math.round(c.damage[k] * 100)} %)`, 'bad', c.cfg.id);
      }
    }
    if ((k === 'engine' || k === 'gearbox' || k === 'suspension') && c.damage[k] >= 1 && this.cfg.mode === 'race') {
      c.dnf = true;
      c.dnfReason = k === 'engine' ? 'Motorschaden' : k === 'gearbox' ? 'Getriebeschaden' : 'Unfall';
      c.speed = 0;
      c.vx = c.vy = 0;
      this.msg(`Ausfall: ${c.cfg.name} (${c.dnfReason})`, c.cfg.playerTeam ? 'bad' : 'info', c.cfg.id);
      this.onEvent?.({ type: 'dnf', carId: c.cfg.id });
    }
  }

  private spark(x: number, y: number, power: number) {
    const n = Math.min(14, Math.round(power / 2));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 6 + Math.random() * power;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.3 + Math.random() * 0.4 });
    }
  }

  // Fahrzeugkollisionen mit je zwei Kreisen pro Auto
  private collide() {
    const cars = this.cars;
    for (let a = 0; a < cars.length; a++) {
      const A = cars[a];
      if (A.dnf || A.pit !== 'none' || (A.finished && !A.cfg.human)) continue;
      for (let b = a + 1; b < cars.length; b++) {
        const B = cars[b];
        if (B.dnf || B.pit !== 'none' || (B.finished && !B.cfg.human)) continue;
        if (A.finished || B.finished) continue;
        const dx0 = B.x - A.x, dy0 = B.y - A.y;
        if (dx0 * dx0 + dy0 * dy0 > 49) continue;
        const ca = [
          [A.x + Math.cos(A.h) * CAR_OFF, A.y + Math.sin(A.h) * CAR_OFF],
          [A.x - Math.cos(A.h) * CAR_OFF, A.y - Math.sin(A.h) * CAR_OFF],
        ];
        const cb = [
          [B.x + Math.cos(B.h) * CAR_OFF, B.y + Math.sin(B.h) * CAR_OFF],
          [B.x - Math.cos(B.h) * CAR_OFF, B.y - Math.sin(B.h) * CAR_OFF],
        ];
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            const dx = cb[j][0] - ca[i][0];
            const dy = cb[j][1] - ca[i][1];
            const d2 = dx * dx + dy * dy;
            const min = CAR_R * 2;
            if (d2 >= min * min || d2 < 1e-6) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d, ny = dy / d;
            const pen = min - d;
            A.x -= nx * pen * 0.5;
            A.y -= ny * pen * 0.5;
            B.x += nx * pen * 0.5;
            B.y += ny * pen * 0.5;
            const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
            if (rv < 0) {
              const jimp = -rv * 0.65;
              A.vx -= nx * jimp;
              A.vy -= ny * jimp;
              B.vx += nx * jimp;
              B.vy += ny * jimp;
              const impact = Math.abs(rv);
              if (impact > 2.5 && A.collideCd <= 0 && B.collideCd <= 0) {
                A.collideCd = B.collideCd = 0.4;
                // Wer mit der Front einschlägt, beschädigt den Frontflügel
                const aFront = i === 0 && (Math.cos(A.h) * nx + Math.sin(A.h) * ny) > 0.5;
                const bFront = j === 0 && (Math.cos(B.h) * -nx + Math.sin(B.h) * -ny) > 0.5;
                if (aFront) this.addDamage(A, 'frontWing', impact * 0.035);
                if (bFront) this.addDamage(B, 'frontWing', impact * 0.035);
                if (impact > 9) {
                  this.addDamage(A, 'suspension', (impact - 9) * 0.03);
                  this.addDamage(B, 'suspension', (impact - 9) * 0.03);
                }
                if (impact > 11 && this.cfg.mode === 'race') {
                  for (const car of [A, B]) {
                    if (Math.random() < 0.22) {
                      car.tyre.wear = Math.max(car.tyre.wear, 0.97);
                      this.msg(`${car.cfg.short}: Reifenschaden!`, car.cfg.playerTeam ? 'bad' : 'info', car.cfg.id);
                    }
                  }
                }
                this.spark((A.x + B.x) / 2, (A.y + B.y) / 2, impact * 1.5);
                this.onEvent?.({ type: 'collision', carId: A.cfg.human ? A.cfg.id : B.cfg.human ? B.cfg.id : A.cfg.id, data: impact });
                if (A.cfg.human || B.cfg.human) this.collisionsThisFrame = Math.max(this.collisionsThisFrame, impact);
                // leichter Dreh
                A.h += (Math.random() - 0.5) * impact * 0.01;
                B.h += (Math.random() - 0.5) * impact * 0.01;
              }
            }
          }
        }
      }
    }
  }

  private updatePositions() {
    const sorted = this.order();
    sorted.forEach((c, i) => {
      const np = i + 1;
      if (this.cfg.mode === 'race' && c.started && np < c.pos && !c.finished && !c.dnf && this.time > 3) {
        // Überholvorgang (nicht über Boxenstopps)
        for (const o of sorted.slice(np, c.pos)) {
          if (o.pit === 'none' && c.pit === 'none' && !o.dnf && Math.abs(o.dist - c.dist) < 60) {
            c.overtakes++;
            if (c.cfg.human) this.onEvent?.({ type: 'overtake', carId: c.cfg.id });
          }
        }
      }
      c.pos = np;
    });
  }

  order(): CarSim[] {
    const key = (c: CarSim) => {
      if (c.dnf) return -1e12 + c.dist;
      if (c.finished) return 1e9 + c.lapsDone * 1e6 - c.finishTime;
      return c.dist;
    };
    return [...this.cars].sort((a, b) => key(b) - key(a));
  }

  // Zeitabstand zum Vordermann/Führenden (Näherung über Distanz und Geschwindigkeit)
  gapTo(c: CarSim, ahead: CarSim): number {
    const d = ahead.dist - c.dist;
    const v = Math.max(20, (c.speed + ahead.speed) / 2 || 50);
    return d / Math.max(30, v);
  }

  // Simulation des restlichen Rennens ohne Darstellung
  fastForward(maxSeconds = 1200, dt = 1 / 30) {
    let t = 0;
    while (this.phase !== 'finished' && t < maxSeconds) {
      this.step(dt);
      t += dt;
    }
  }
}

function smooth(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function fmt(t: number) {
  if (!isFinite(t)) return '–';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
