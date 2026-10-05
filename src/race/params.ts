// Übersetzt Spielwerte (Fahrzeug, Abstimmung, Fahrer) in physikalische Parameter für die Rennengine.
import type { CarStats, Compound, DriverStats, DrivingStyle, OvertakeMode, PlannedStop, Setup, TrackDef, WeatherKind } from '../types';

export interface PhysicsParams {
  vmax: number; // m/s
  accel: number; // m/s² bei niedriger Geschwindigkeit
  brake: number; // m/s²
  mechGrip: number; // m/s²
  aeroGrip: number; // zusätzlicher Grip bei 80 m/s
  tyreWear: number; // Multiplikator
  reliability: number;
  fuelUse: number; // Multiplikator
  stability: number; // 0..0.4
  gripBonus: number; // zusätzlicher Faktor
  weight: number; // kg
}

export interface DriverParams extends DriverStats {}

export interface EntryStrategy {
  startCompound: Compound;
  fuel: number;
  stops: PlannedStop[];
  style: DrivingStyle;
  aggression: number;
  overtake: OvertakeMode;
  reactToWeather: boolean;
}

export function setupQuality(setup: Setup, track: TrackDef): number {
  const e = Math.abs(setup.wing - track.ideal.wing) + Math.abs(setup.gearing - track.ideal.gearing) + Math.abs(setup.suspension - track.ideal.suspension);
  return Math.max(0, 1 - e / 150);
}

export function buildCarParams(
  stats: CarStats,
  setup: Setup,
  track: TrackDef,
  extra: { stability?: number; grip?: number; fuelSave?: number } = {},
): PhysicsParams {
  const wingD = (setup.wing - 50) / 50;
  const gearD = (setup.gearing - 50) / 50;
  const suspD = (setup.suspension - 50) / 50;
  const q = setupQuality(setup, track);
  const setupMul = 0.965 + q * 0.05; // 0.965 .. 1.015
  const weightF = 680 / stats.weight;
  return {
    vmax: (63 + stats.topSpeed * 0.21 + stats.power * 0.05 - wingD * 2.4 + gearD * 1.8) * (0.99 + q * 0.012),
    accel: (6.5 + stats.accel * 0.055 + stats.power * 0.025) * (1 - gearD * 0.09) * weightF * Math.sqrt(setupMul),
    brake: 15 + stats.braking * 0.14,
    mechGrip: (12.8 + stats.handling * 0.048 + suspD * 0.35) * setupMul,
    aeroGrip: (3.4 + stats.aero * 0.058 + wingD * 2.4) * setupMul,
    tyreWear: (1.35 - stats.tyreCare * 0.0062) * (1 + suspD * 0.1),
    reliability: stats.reliability,
    fuelUse: 1 - (extra.fuelSave ?? 0),
    stability: extra.stability ?? 0,
    gripBonus: 1 + (extra.grip ?? 0),
    weight: stats.weight,
  };
}

export const WETNESS: Record<WeatherKind, number> = { sunny: 0, cloudy: 0, lightRain: 0.5, heavyRain: 1 };
export const AIR_TEMP: Record<WeatherKind, number> = { sunny: 34, cloudy: 24, lightRain: 16, heavyRain: 12 };

// Grip einer Mischung abhängig von der Streckennässe (0 trocken .. 1 sehr nass)
export function compoundGrip(c: Compound, w: number): number {
  switch (c) {
    case 'soft':
      return 1.0 * (1 - 0.56 * Math.pow(w, 0.8));
    case 'medium':
      return 0.975 * (1 - 0.56 * Math.pow(w, 0.8));
    case 'hard':
      return 0.95 * (1 - 0.56 * Math.pow(w, 0.8));
    case 'inter':
      return w < 0.6 ? 0.86 - 0.04 * w : 0.836 - 0.5 * (w - 0.6);
    case 'wet':
      return 0.775 + 0.02 * w;
  }
}

export const TEMP_WINDOW: Record<Compound, [number, number]> = {
  soft: [82, 104],
  medium: [88, 110],
  hard: [94, 116],
  inter: [50, 85],
  wet: [40, 72],
};

export function bestCompoundFor(w: number, dryChoice: Compound = 'medium'): Compound {
  if (w > 0.66) return 'wet';
  if (w > 0.28) return 'inter';
  return dryChoice;
}
