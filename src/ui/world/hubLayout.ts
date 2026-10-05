// Layout des begehbaren Teamgeländes. Koordinaten in Welt-Einheiten (ca. 1 Einheit = 5 cm).
// Bauflächen (Plots) werden erst durch Kaufen zu Gebäuden; die Fläche davor ist die Kauffläche.
import type { GameState, PlotId } from '../../types';
import { PLOTS, PLOT_ORDER, plotLevel, plotVisible } from '../../game/tycoon';

export type StationId = 'garage' | 'lab' | 'staff' | 'lounge' | 'sponsors' | 'office' | 'trophy' | 'truck' | 'calendar' | 'setup' | 'tyres' | 'pitwall';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SpotKind = 'garage' | 'factory' | 'lab' | 'office' | 'lounge' | 'trophy' | 'truck' | 'board' | 'tunnel' | 'kiosk' | 'shop' | 'stand' | 'media' | 'dyno' | 'tyres' | 'pitwall';

export interface Spot {
  id: string;
  plot?: PlotId;
  /** Bildschirm, der an der Tür geöffnet wird (nur gebaute Gebäude) */
  station?: StationId;
  name: string;
  sub?: string;
  kind: SpotKind;
  rect: Rect;
  door: { x: number; y: number; side: 'n' | 's' | 'e' | 'w' };
  /** Kauffläche zum Bauen und Ausbauen */
  pad: { x: number; y: number } | null;
  built: boolean;
  roof: string;
  facade: string;
}

export const WORLD = { w: 2200, h: 1360 };
export const WALK = { x0: 110, y0: 110, x1: 2090, y1: 1000 };
export const FENCE_Y = 1030;
export const TRACK_Y = 1100;
/** Durchgang im Zaun zur Teststrecke */
export const GATE = { x0: 1010, y0: 995, x1: 1190, y1: 1092 };
export const TEST_PAD = { x: 1100, y: 1062 };
export const START = { x: 900, y: 780 };

export const STATION_LABELS: Record<StationId, string> = {
  garage: 'Werkstatt',
  lab: 'Forschungslabor',
  staff: 'Personalbüro',
  lounge: 'Fahrerlounge',
  sponsors: 'Sponsoren-Lounge',
  office: 'Teamchef-Büro',
  trophy: 'Pokalvitrine',
  truck: 'Team-Transporter',
  calendar: 'Rennkalender',
  setup: 'Prüfstand',
  tyres: 'Reifenlager',
  pitwall: 'Boxenmauer',
};

export function isWalkable(x: number, y: number) {
  if (x >= WALK.x0 && x <= WALK.x1 && y >= WALK.y0 && y <= WALK.y1) return true;
  return x >= GATE.x0 && x <= GATE.x1 && y >= GATE.y0 && y <= GATE.y1;
}

function padFor(r: Rect, side: 'n' | 's' | 'e' | 'w', door: { x: number; y: number }) {
  if (side === 's') return { x: r.x + r.w / 2, y: r.y + r.h + 78 };
  if (side === 'n') return { x: r.x + r.w / 2, y: r.y - 78 };
  if (side === 'e') return { x: r.x + r.w + 78, y: door.y };
  return { x: r.x - 78, y: door.y };
}

/** Alle sichtbaren Flächen: gebaute Gebäude und Bauland, das schon angezeigt wird */
export function buildLayout(g: GameState): Spot[] {
  const lvl = g.facility;
  const gw = [300, 380, 440, 480][lvl - 1] ?? 300;
  const out: Spot[] = [];
  const add = (s: Omit<Spot, 'pad' | 'built'> & { padOverride?: { x: number; y: number } | null; free?: boolean }) => {
    const { padOverride, free, ...rest } = s;
    const built = free ? true : s.plot ? plotLevel(g, s.plot) >= 1 : true;
    const income = s.plot ? PLOTS[s.plot].kind === 'income' : false;
    let pad: Spot['pad'] = null;
    if (s.plot && (!built || income)) pad = padOverride !== undefined ? padOverride : padFor(s.rect, s.door.side, s.door);
    out.push({ ...rest, built, pad });
  };

  const garageH = lvl >= 3 ? 230 : 210;
  const spots: (Parameters<typeof add>[0])[] = [
    {
      id: 'workshop', plot: 'workshop', station: 'garage', name: 'Werkstatt', sub: ['Mietgarage', 'Eigene Werkstatt', 'Technikzentrum', 'Werksfabrik'][lvl - 1],
      kind: lvl >= 4 ? 'factory' : 'garage', rect: { x: 190, y: 140, w: gw, h: garageH }, door: { x: 190 + gw / 2, y: 140 + garageH + 34, side: 's' },
      roof: lvl >= 4 ? '#8fa3b0' : lvl >= 2 ? '#6f7f89' : '#5b5f63', facade: '#2c3439',
    },
    { id: 'setupLab', plot: 'setupLab', station: 'setup', name: 'Prüfstand', sub: 'Training und Abstimmung', kind: 'dyno', rect: { x: 740, y: 160, w: 210, h: 170 }, door: { x: 845, y: 364, side: 's' }, roof: '#566873', facade: '#263139' },
    { id: 'lab', plot: 'lab', station: 'lab', name: 'Forschungslabor', kind: 'lab', rect: { x: 1020, y: 150, w: 270, h: 180 }, door: { x: 1155, y: 364, side: 's' }, roof: lvl >= 2 ? '#d7dde1' : '#9aa4aa', facade: '#30383d' },
    { id: 'staffOffice', plot: 'staffOffice', station: 'staff', name: 'Personalbüro', kind: 'office', rect: { x: 1560, y: 160, w: 240, h: 170 }, door: { x: 1680, y: 364, side: 's' }, roof: '#7c6a58', facade: '#33302c' },
    { id: 'pitwall', plot: 'pitwall', station: 'pitwall', name: 'Boxenmauer', sub: 'Rennstrategie', kind: 'pitwall', rect: { x: 1860, y: 170, w: 200, h: 160 }, door: { x: 1960, y: 364, side: 's' }, roof: '#3b4650', facade: '#222a30' },
    { id: 'lounge', plot: 'lounge', station: 'lounge', name: 'Fahrerlounge', kind: 'lounge', rect: { x: 130, y: 440, w: 210, h: 200 }, door: { x: 374, y: 540, side: 'e' }, roof: '#3f5966', facade: '#25333a' },
    { id: 'sponsorLounge', plot: 'sponsorLounge', station: 'sponsors', name: 'Sponsoren-Lounge', kind: 'lounge', rect: { x: 130, y: 700, w: 210, h: 180 }, door: { x: 374, y: 790, side: 'e' }, roof: '#5a4b6e', facade: '#2e2737' },
    { id: 'office', station: 'office', name: 'Teamchef-Büro', kind: 'office', rect: { x: 1880, y: 430, w: 190, h: 200 }, door: { x: 1846, y: 530, side: 'w' }, roof: '#4d5f52', facade: '#26302a', free: true },
    { id: 'kiosk', plot: 'kiosk', name: 'Fan-Kiosk', kind: 'kiosk', rect: { x: 500, y: 610, w: 120, h: 90 }, door: { x: 560, y: 582, side: 'n' }, roof: '#e9eef1', facade: '#2c3439' },
    { id: 'fanshop', plot: 'fanshop', name: 'Fanshop', kind: 'shop', rect: { x: 905, y: 610, w: 170, h: 96 }, door: { x: 990, y: 582, side: 'n' }, roof: '#dfe5e9', facade: '#2c3439' },
    { id: 'media', plot: 'media', name: 'Mediazentrum', kind: 'media', rect: { x: 1230, y: 590, w: 250, h: 110 }, door: { x: 1355, y: 562, side: 'n' }, roof: '#3d4f63', facade: '#222c36' },
    { id: 'truck', station: 'truck', name: 'Team-Transporter', sub: 'Rennwochenende', kind: 'truck', rect: { x: 880, y: 900, w: 290, h: 92 }, door: { x: 1025, y: 872, side: 'n' }, roof: '#e9eef1', facade: '#202629', free: true },
    { id: 'tireDepot', plot: 'tireDepot', station: 'tyres', name: 'Reifenlager', sub: 'Reifen und Boxenstopps', kind: 'tyres', rect: { x: 600, y: 900, w: 230, h: 92 }, door: { x: 715, y: 872, side: 'n' }, roof: '#3a4046', facade: '#1f2428' },
    { id: 'calendar', station: 'calendar', name: 'Rennkalender', kind: 'board', rect: { x: 1190, y: 926, w: 130, h: 26 }, door: { x: 1255, y: 898, side: 'n' }, roof: '#22292d', facade: '#22292d', free: true },
    { id: 'grandstand', plot: 'grandstand', name: 'Tribüne', kind: 'stand', rect: { x: 1350, y: 892, w: 400, h: 104 }, door: { x: 1550, y: 864, side: 'n' }, roof: '#59626b', facade: '#59626b' },
  ];
  for (const s of spots) {
    if (s.plot && !plotVisible(g, s.plot)) continue;
    add(s);
  }
  if (g.stats.races >= 1) {
    add({ id: 'trophy', station: 'trophy', name: 'Pokalvitrine', kind: 'trophy', rect: { x: 1880, y: 690, w: 190, h: 180 }, door: { x: 1846, y: 780, side: 'w' }, roof: '#6b5a2e', facade: '#2f2a1d', free: true });
  }
  if (lvl >= 3 && plotLevel(g, 'lab') >= 1) {
    add({ id: 'tunnel', station: 'lab', name: 'Windkanal', kind: 'tunnel', rect: { x: 1320, y: 160, w: 170, h: 150 }, door: { x: 1405, y: 344, side: 's' }, roof: '#b8c4cb', facade: '#2b3337', free: true });
  }
  return out;
}

export function spotKey(g: GameState) {
  return PLOT_ORDER.map((p) => `${p}${plotLevel(g, p)}`).join(',') + `|${g.facility}|${g.stats.races >= 1 ? 1 : 0}`;
}
