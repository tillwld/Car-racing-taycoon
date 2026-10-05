// KI-Fahrer: folgen einer Ideallinie mit eigenem Geschwindigkeitsprofil, reagieren auf Verkehr,
// überholen, verteidigen, machen Fehler und nutzen den Boost. Gesteuert wird über dieselbe Physik wie der Spieler.
import type { CarSim, Input, RaceEngine } from './engine';
import { pointAt, wrapIndex, type TrackGeometry } from './trackGeometry';
import { PIT } from './params';

export interface AIState {
  offsetCur: number;
  offsetTarget: number;
  offsetTimer: number;
  mistake: number;
  mistakeKind: 'none' | 'late' | 'lock' | 'wide';
  profile: Float32Array;
  profileTimer: number;
  profileGrip: number;
  startDelay: number;
  boostTimer: number;
  defendTimer: number;
  lastCornerIdx: number;
  blocked: number;
}

export function lineOffAt(g: TrackGeometry, s: number) {
  const f = (((s % g.length) + g.length) % g.length) / g.ds;
  const a = Math.floor(f) % g.n;
  const b = (a + 1) % g.n;
  const t = f - Math.floor(f);
  return g.lineOff[a] * (1 - t) + g.lineOff[b] * t;
}

export function computeProfile(eng: RaceEngine, c: CarSim, cornerUse: number, brakeUse: number) {
  const g = eng.geo;
  const e = eng.eff(c);
  const prof = c.ai.profile;
  const vmax = e.vmax;
  const mech = e.mech * cornerUse;
  const aero = e.aero * cornerUse;
  for (let i = 0; i < g.n; i++) {
    const k = Math.abs(g.lineK[i]);
    let v: number;
    if (k < 1e-5) v = vmax;
    else {
      const den = 1 - aero / (6400 * k);
      v = den <= 0.04 ? vmax : Math.sqrt(mech / (k * den));
    }
    prof[i] = Math.min(v, vmax);
  }
  // Bremspunkte: zweimal rückwärts über die Runde
  for (let pass = 0; pass < 2; pass++) {
    for (let i = g.n - 1; i >= 0; i--) {
      const j = (i + 1) % g.n;
      const vj = prof[j];
      const gl = e.mech + e.aero * (vj / 80) * (vj / 80);
      const dec = Math.min(e.brake, gl * 1.35 + 4) * brakeUse;
      const lim = Math.sqrt(vj * vj + 2 * dec * g.ds);
      if (lim < prof[i]) prof[i] = lim;
    }
  }
  c.ai.profileGrip = e.gripMul;
}

function wrapDelta(a: number, L: number) {
  let d = a % L;
  if (d > L / 2) d -= L;
  if (d < -L / 2) d += L;
  return d;
}

export function aiControl(eng: RaceEngine, c: CarSim, dt: number): Input {
  const g = eng.geo;
  const L = g.length;
  const d = c.cfg.driver;
  const st = c.cfg.strategy;
  const ai = c.ai;
  const v = c.speed;
  const isQuali = eng.cfg.mode !== 'race';

  // Tempo / Risiko
  const styleCorner = st.style === 'attack' || isQuali ? 0.012 : st.style === 'conserve' ? -0.02 : 0;
  let cornerUse = (0.855 + d.cornering * 0.0012 + (d.speed - 50) * 0.0004 + styleCorner) * c.cfg.paceMul;
  if (eng.wetness > 0.15) cornerUse *= 1 - (72 - d.wet) * 0.0009 * eng.wetness;
  cornerUse = Math.min(0.988, cornerUse + c.cfg.car.stability * 0.02);
  let brakeUse = Math.min(0.97, (0.8 + d.braking * 0.0016) * (0.96 + 0.04 * c.cfg.paceMul));
  if (c.finished) {
    cornerUse *= 0.72;
    brakeUse *= 0.8;
  }
  ai.profileTimer -= dt;
  if (ai.profileTimer <= 0) {
    computeProfile(eng, c, cornerUse, brakeUse);
    ai.profileTimer = 0.8 + Math.random() * 0.4;
  }

  // Verkehr
  let ahead: CarSim | null = null;
  let aheadGap = Infinity;
  let behind: CarSim | null = null;
  let behindGap = Infinity;
  if (!isQuali && !c.finished) {
    for (const o of eng.cars) {
      if (o === c || o.dnf || o.pit !== 'none' || o.finished) continue;
      const dd = wrapDelta(o.s - c.s, L);
      if (dd > 0 && dd < 40 && dd < aheadGap) {
        aheadGap = dd;
        ahead = o;
      } else if (dd < 0 && -dd < 28 && -dd < behindGap) {
        behindGap = -dd;
        behind = o;
      }
    }
  }

  const look = 7 + v * 0.36;
  const sT = c.s + look;
  const lineT = lineOffAt(g, sT);
  const hwLim = g.halfWidth - 1.25;
  const kAhead = g.lineK[wrapIndex(c.idx + Math.round(60 / g.ds), g.n)];

  if (ai.offsetTimer > 0) ai.offsetTimer -= dt;
  else ai.offsetTarget *= Math.max(0, 1 - dt * 1.2);
  if (ai.defendTimer > 0) ai.defendTimer -= dt;

  const iA = wrapIndex(c.idx + Math.round((v * 0.22 + 3) / g.ds), g.n);
  let vt = ai.profile[iA];
  const aggr = (d.aggression * 0.6 + st.aggression * 0.4) / 100;

  if (ahead) {
    const closing = v - ahead.speed;
    const latDiff = ahead.lat - c.lat;
    const lapping = ahead.dist < c.dist - L * 0.5;
    const thresh = st.overtake === 'cautious' ? 1.6 : st.overtake === 'risky' ? -0.6 : 0.4;
    const want = lapping || closing > thresh || (c.slip > 0.35 && aheadGap < 22) || ai.blocked > 1.2;
    if (aheadGap < 28 && want && ai.offsetTimer <= 0) {
      const leftAbs = ahead.lat - 3.7;
      const rightAbs = ahead.lat + 3.7;
      const leftOk = leftAbs > -hwLim;
      const rightOk = rightAbs < hwLim;
      let target: number | null = null;
      if (leftOk && rightOk) {
        const inside = Math.sign(kAhead) || 1; // Innenseite der nächsten Kurve
        const preferInside = Math.random() < 0.4 + aggr * 0.5;
        target = preferInside ? (inside > 0 ? rightAbs : leftAbs) : Math.abs(leftAbs - c.lat) < Math.abs(rightAbs - c.lat) ? leftAbs : rightAbs;
      } else if (leftOk) target = leftAbs;
      else if (rightOk) target = rightAbs;
      if (target !== null) {
        ai.offsetTarget = target - lineT;
        ai.offsetTimer = 1.4 + aggr * 1.2;
      }
    }
    // Auffahren vermeiden
    if (aheadGap < 12 && Math.abs(latDiff) < 2.4 && closing > -0.5) {
      const safe = ahead.speed - 0.5 + (aheadGap - 5) * (0.35 + (st.overtake === 'risky' ? 0.15 : 0));
      vt = Math.min(vt, Math.max(0, safe));
      ai.blocked += dt;
    } else ai.blocked = Math.max(0, ai.blocked - dt * 0.5);
  } else ai.blocked = 0;

  if (behind) {
    const lappingMe = behind.dist > c.dist + L * 0.5;
    const closing = behind.speed - v;
    if (lappingMe && behindGap < 25) {
      // Blaue Flagge: Platz machen
      const away = behind.lat >= c.lat ? -1 : 1;
      ai.offsetTarget = away * hwLim - lineT;
      ai.offsetTimer = 1.5;
      vt *= 0.94;
    } else if (behindGap < 14 && closing > 0.3 && ai.defendTimer <= 0 && Math.random() < aggr * 0.06 + 0.01) {
      // Verteidigen: Linie zumachen (nur eine Bewegung)
      const tgt = Math.max(-hwLim, Math.min(hwLim, behind.lat * 0.8));
      ai.offsetTarget = tgt - lineT;
      ai.offsetTimer = 1.3;
      ai.defendTimer = 4;
    }
  }

  // Fahrfehler beim Anbremsen
  if (ai.mistake > 0) ai.mistake -= dt;
  else ai.mistakeKind = 'none';
  if (v > vt + 4 && Math.abs(c.idx - ai.lastCornerIdx) > 40 && !isQuali && !c.finished) {
    ai.lastCornerIdx = c.idx;
    const styleM = st.style === 'attack' ? 1.5 : st.style === 'conserve' ? 0.7 : 1;
    const p =
      0.018 * Math.max(0.15, 1.35 - d.consistency / 100) * (1 + eng.wetness * 1.3) * styleM * Math.max(0.3, 1 - c.cfg.car.stability * 1.5) * Math.max(0.6, 1.2 - d.experience * 0.004);
    if (Math.random() < p) {
      const r = Math.random();
      ai.mistakeKind = r < 0.5 ? 'late' : r < 0.75 ? 'lock' : 'wide';
      ai.mistake = ai.mistakeKind === 'lock' ? 0.45 : 1.1;
      if (ai.mistakeKind === 'lock') c.tyre.wear = Math.min(1, c.tyre.wear + 0.015);
      if (ai.mistakeKind === 'wide') {
        ai.offsetTarget = -Math.sign(kAhead || 1) * 2.5;
        ai.offsetTimer = 1.2;
      }
      if (c.cfg.playerTeam && ai.mistakeKind !== 'wide') eng.msg(`${c.cfg.short}: Verbremser!`, 'warn', c.cfg.id);
    }
  }
  if (ai.mistakeKind === 'late') vt *= 1.09;

  // Boxeneinfahrt: rechtzeitig zur Boxenseite und auf Limiter-Tempo herunter
  let pitW = 0;
  if (c.pitReq && c.pit === 'none' && !isQuali && c.lapsDone < eng.cfg.laps - 1) {
    const toIn = (((eng.pitIn - c.s) % L) + L) % L;
    if (toIn < 340) {
      pitW = Math.max(0, Math.min(1, (340 - toIn) / 190));
      vt = Math.min(vt, Math.sqrt(PIT.speed * PIT.speed + 2 * 24 * toIn));
    }
  }

  // seitlichen Versatz nachführen
  const maxLatRate = 3.2 * (0.7 + aggr * 0.6);
  const dOff = ai.offsetTarget - ai.offsetCur;
  ai.offsetCur += Math.sign(dOff) * Math.min(Math.abs(dOff), maxLatRate * dt);
  let latTarget = lineT + ai.offsetCur;
  latTarget = Math.max(-hwLim, Math.min(hwLim, latTarget));
  if (pitW > 0) latTarget = latTarget * (1 - pitW) + eng.pitSide * (g.halfWidth - 2) * pitW;

  // Lenkung (Pure Pursuit)
  const pt = pointAt(g, sT, latTarget);
  let alpha = Math.atan2(pt.y - c.y, pt.x - c.x) - c.h;
  alpha = Math.atan2(Math.sin(alpha), Math.cos(alpha));
  const desiredCurv = (2 * Math.sin(alpha)) / look;
  const latNom = eng.latGrip(c, Math.max(v, 1));
  const maxCurv = Math.min(1 / 5.5, (latNom * 1.3) / Math.max(1, v * v));
  let steer = Math.max(-1, Math.min(1, desiredCurv / maxCurv));
  if (ai.mistakeKind === 'lock') steer *= 0.4;

  // Gas & Bremse
  let throttle = 0;
  let brake = 0;
  if (v < vt - 0.3) throttle = Math.min(1, (vt - v) / 2 + 0.35);
  else if (v > vt + 0.6) brake = Math.max(0.15, Math.min(1, (v - vt) / 3));
  else throttle = 0.25;
  if (st.style === 'conserve' && !isQuali) throttle = Math.min(throttle, 0.94);
  if (ai.mistakeKind === 'lock') {
    brake = 1;
    throttle = 0;
  }
  // Kraftstoff sparen, wenn knapp
  if (!isQuali) {
    const need = Math.max(0, (eng.raceDist - c.dist) / eng.raceDist);
    if (c.fuel < need * 0.98 && c.pit === 'none') throttle = Math.min(throttle, 0.8);
  }

  // Boost
  if (ai.boostTimer > 0) ai.boostTimer -= dt;
  let boost = ai.boostTimer > 0;
  const onStraight = ai.profile[iA] >= eng.eff(c).vmax * 0.96;
  if (!boost && onStraight && c.ers > 0.3 && throttle > 0.9) {
    const attack = ahead && aheadGap < 45 && v + 1 > ahead.speed;
    const defend = behind && behindGap < 18;
    const lastLap = !isQuali && c.lapsDone >= eng.cfg.laps - 1;
    if (attack || defend || lastLap || isQuali || Math.random() < 0.004 * (1 + aggr)) {
      ai.boostTimer = 1.2 + Math.random();
      boost = true;
    }
  }
  return { throttle, brake, steer, boost };
}
