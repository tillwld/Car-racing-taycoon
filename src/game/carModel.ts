import { CHASSIS, CHASSIS_BY_ID, PARTS, PART_KEYS, RESEARCH, TIERS } from '../data/catalog';
import type { CarStats, GameState, StaffRole } from '../types';

export function staffSkill(s: GameState, role: StaffRole): number {
  return s.staff[role]?.skill ?? 0;
}

export function researchExtras(s: GameState) {
  let stability = 0, grip = 0, fuelSave = 0, pitBonus = 0;
  for (const r of RESEARCH) {
    if (!s.research[r.id]) continue;
    stability += r.stability ?? 0;
    grip += r.grip ?? 0;
    fuelSave += r.fuelSave ?? 0;
    pitBonus += r.pitBonus ?? 0;
  }
  return { stability, grip, fuelSave, pitBonus };
}

export function playerCarStats(s: GameState, includeCondition = true): CarStats {
  const ch = CHASSIS_BY_ID[s.car.chassisId] ?? CHASSIS[0];
  const st: CarStats = { ...ch.base };
  for (const p of PART_KEYS) {
    const lvl = s.car.parts[p] ?? 0;
    const eff = PARTS[p].effect;
    for (const k of Object.keys(eff) as (keyof CarStats)[]) st[k] += (eff[k] ?? 0) * lvl;
  }
  for (const r of RESEARCH) {
    if (!s.research[r.id] || !r.stats) continue;
    for (const k of Object.keys(r.stats) as (keyof CarStats)[]) st[k] += r.stats[k] ?? 0;
  }
  const aero = staffSkill(s, 'aeroEngineer');
  const engine = staffSkill(s, 'engineEngineer');
  const chief = staffSkill(s, 'chiefMechanic');
  if (aero) st.aero += (aero - 50) * 0.06;
  if (engine) st.power += (engine - 50) * 0.06;
  st.reliability += chief ? (chief - 50) * 0.1 : -5;
  if (includeCondition) st.reliability -= (1 - s.car.condition.engine) * 14 + (1 - s.car.condition.gearbox) * 8;
  for (const k of Object.keys(st) as (keyof CarStats)[]) if (k !== 'weight') st[k] = Math.round(st[k] * 10) / 10;
  return st;
}

export function carRating(st: CarStats): number {
  return Math.round((st.power + st.accel + st.topSpeed + st.braking + st.handling * 1.2 + st.aero * 1.2 + st.tyreCare * 0.6 + st.reliability * 0.5) / 7.5);
}

export function pitCrewTime(s: GameState) {
  const mech = staffSkill(s, 'mechanic') || 15;
  const chief = staffSkill(s, 'chiefMechanic') || 15;
  const { pitBonus } = researchExtras(s);
  const base = 2.25 + (100 - mech) * 0.042 + (100 - chief) * 0.01 - pitBonus;
  return { base: Math.max(1.85, base), error: Math.max(0.01, 0.13 * (1 - mech / 100)) };
}

export function partCost(s: GameState, part: keyof typeof PARTS): number {
  const lvl = s.car.parts[part];
  const eng = ['engine', 'gearbox', 'cooling'].includes(part) ? staffSkill(s, 'engineEngineer') : staffSkill(s, 'aeroEngineer');
  const disc = 1 - Math.max(0, eng - 40) * 0.003;
  return Math.round((PARTS[part].base * Math.pow(1.32, lvl) * TIERS[s.tier].money * disc) / 1000) * 1000;
}

export function partTime(s: GameState, part: keyof typeof PARTS): number {
  const lvl = s.car.parts[part];
  const eng = ['engine', 'gearbox', 'cooling'].includes(part) ? staffSkill(s, 'engineEngineer') : staffSkill(s, 'aeroEngineer');
  return Math.max(1, 1 + Math.floor(lvl / 3) - (eng >= 75 ? 1 : 0));
}

export function researchCost(s: GameState, base: number) {
  const an = staffSkill(s, 'dataAnalyst');
  return Math.round((base * TIERS[s.tier].money * (1 - Math.max(0, an - 40) * 0.002)) / 1000) * 1000;
}

export function researchTime(s: GameState, base: number) {
  const an = staffSkill(s, 'dataAnalyst');
  return Math.max(1, base - (an >= 70 ? 1 : 0));
}

export function devSlots(s: GameState) {
  return { parts: s.facility >= 3 ? 2 : 1, research: s.facility >= 4 ? 2 : 1 };
}
