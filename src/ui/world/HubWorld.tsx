// Begehbares Teamgelände im Tycoon-Stil: Der Spieler läuft als Fahrer über das Gelände, verdient passiv Geld,
// stellt sich auf leuchtende Kaufflächen, um zu bauen, und betritt gebaute Gebäude, um sein Team zu verwalten.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, PlotId, StaffRole } from '../../types';
import { buildLayout, FENCE_Y, GATE, isWalkable, spotKey, START, STATION_LABELS, TEST_PAD, TRACK_Y, WALK, WORLD, type Rect, type Spot, type StationId } from './hubLayout';
import { STAFF_ROLES } from '../../data/catalog';
import { PLOTS, plotAvailable, plotCost, plotLevel, plotMaxLevel, plotYield } from '../../game/tycoon';
import { money } from '../../game/util';
import { sound } from '../../audio/sound';
import { keyLabel, labelsFor, reverseKeys } from '../../race/keys';

interface Props {
  game: GameState;
  paused: boolean;
  /** Gelände ist verdeckt (z. B. Fahrt auf der Teststrecke): nichts berechnen oder zeichnen */
  hidden?: boolean;
  alerts: Partial<Record<StationId, string>>;
  /** Spot-ID, Plot-ID oder 'track': dort zeigt ein Pfeil hin */
  objective: string | null;
  onOpen: (s: StationId) => void;
  onBuy: (id: PlotId) => void;
  onFreeDrive: () => void;
  walkTo?: { target: string; n: number } | null;
}

interface Npc {
  x: number;
  y: number;
  dir: number;
  color: string;
  accent: string;
  label: string;
  station: StationId;
  helmet?: boolean;
  phase: number;
}

interface PadInfo {
  id: string; // Plot-ID oder 'track'
  x: number;
  y: number;
  name: string;
  cost: number;
  level: number;
  max: number;
  avail: boolean;
  afford: boolean;
  req: string;
  gain: number;
  above: boolean;
  kind: 'plot' | 'track';
}

interface Fx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  text?: string;
  color: string;
  size: number;
  grav: number;
}

const R = 14;
const CELL = 20;
const SPEED = 270;
const PAD_R = 46;
const DWELL = 0.55;
const TAU = Math.PI * 2;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function circleRect(px: number, py: number, r: Rect, rad: number) {
  const cx = Math.max(r.x, Math.min(px, r.x + r.w));
  const cy = Math.max(r.y, Math.min(py, r.y + r.h));
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy < rad * rad ? { cx, cy, dx, dy } : null;
}

export default function HubWorld({ game, paused, hidden = false, alerts, objective, onOpen, onBuy, onFreeDrive, walkTo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const key = spotKey(game);
  const kmap = reverseKeys(game.settings.keys).map;
  const keyHint = [kmap.up[0], kmap.left[0], kmap.down[0], kmap.right[0]].map(keyLabel).join(' ');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => buildLayout(game), [key]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const gameRef = useRef(game);
  gameRef.current = game;
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const objRef = useRef(objective);
  objRef.current = objective;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onBuyRef = useRef(onBuy);
  onBuyRef.current = onBuy;
  const onFreeRef = useRef(onFreeDrive);
  onFreeRef.current = onFreeDrive;

  const player = useRef({ x: START.x, y: START.y, dir: -Math.PI / 2, phase: 0, moving: false, path: [] as { x: number; y: number }[], arrive: null as StationId | null });
  const keys = useRef<Record<string, boolean>>({});
  const cam = useRef({ x: START.x, y: START.y, zoom: 1, user: 1 });
  const [near, setNear] = useState<{ station: StationId; sx: number; sy: number; name: string } | null>(null);
  const nearRef = useRef<StationId | null>(null);
  const [hint, setHint] = useState(true);
  const padState = useRef<Record<string, { dwell: number; lock: boolean }>>({});
  const fx = useRef<Fx[]>([]);
  const builtAt = useRef<Record<string, number>>({});
  const prevPlots = useRef<Record<string, number>>({ ...game.plots });
  const clock = useRef(0);

  // Statische Dekoration (Bäume) mit festem Zufall
  const decor = useMemo(() => {
    const rnd = seeded(7);
    const trees: { x: number; y: number; r: number; c: string }[] = [];
    const cols = ['#21412a', '#28492f', '#2e5236', '#1c3925'];
    let tries = 0;
    while (trees.length < 150 && tries < 3000) {
      tries++;
      const x = rnd() * WORLD.w;
      const y = rnd() * (FENCE_Y - 10);
      if (x > WALK.x0 - 40 && x < WALK.x1 + 40 && y > WALK.y0 - 40 && y < FENCE_Y - 10) continue;
      trees.push({ x, y, r: 16 + rnd() * 22, c: cols[Math.floor(rnd() * cols.length)] });
    }
    return { trees };
  }, []);

  // Laufraster für die Wegfindung: nur gebaute Gebäude sind Hindernisse
  const grid = useMemo(() => {
    const gw = Math.ceil(WORLD.w / CELL);
    const gh = Math.ceil(WORLD.h / CELL);
    const blocked = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const x = gx * CELL + CELL / 2;
        const y = gy * CELL + CELL / 2;
        let b = !isWalkable(x, y);
        if (!b) for (const bl of layout) if (bl.built && circleRect(x, y, bl.rect, R + 4)) b = true;
        blocked[gy * gw + gx] = b ? 1 : 0;
      }
    }
    return { gw, gh, blocked };
  }, [layout]);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  function padsNow(): PadInfo[] {
    const g = gameRef.current;
    const out: PadInfo[] = [];
    for (const s of layoutRef.current) {
      if (!s.pad || !s.plot) continue;
      const cost = plotCost(g, s.plot);
      if (cost === null) continue;
      const lvl = plotLevel(g, s.plot);
      out.push({
        id: s.plot, x: s.pad.x, y: s.pad.y, name: PLOTS[s.plot].name, cost, level: lvl, max: plotMaxLevel(s.plot),
        avail: plotAvailable(g, s.plot), afford: g.money >= cost, req: PLOTS[s.plot].reqText,
        gain: PLOTS[s.plot].yields ? plotYield(g, s.plot, lvl + 1) - plotYield(g, s.plot, lvl) : 0, above: s.door.side === 'n', kind: 'plot',
      });
    }
    out.push({ id: 'track', x: TEST_PAD.x, y: TEST_PAD.y, name: 'Teststrecke', cost: 0, level: 0, max: 0, avail: true, afford: true, req: '', gain: 0, above: true, kind: 'track' });
    return out;
  }

  // Auftrag von außen: zu einem Ziel laufen
  useEffect(() => {
    if (!walkTo) return;
    const t = walkTo.target;
    if (t === 'track') return goTo(TEST_PAD.x, TEST_PAD.y, null);
    const s = layoutRef.current.find((x) => x.id === t || x.plot === t);
    if (!s) return;
    if (s.built && s.station) goTo(s.door.x, s.door.y, s.station);
    else if (s.pad) goTo(s.pad.x, s.pad.y, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkTo?.n]);

  function findPath(sx: number, sy: number, tx: number, ty: number) {
    const { gw, gh, blocked } = gridRef.current;
    const toCell = (x: number, y: number) => [Math.max(0, Math.min(gw - 1, Math.floor(x / CELL))), Math.max(0, Math.min(gh - 1, Math.floor(y / CELL)))];
    const [sx0, sy0] = toCell(sx, sy);
    let [tx0, ty0] = toCell(tx, ty);
    if (blocked[ty0 * gw + tx0]) {
      let best = -1, bd = Infinity;
      for (let r = 1; r < 8 && best < 0; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const x = tx0 + dx, y = ty0 + dy;
            if (x < 0 || y < 0 || x >= gw || y >= gh || blocked[y * gw + x]) continue;
            const d = dx * dx + dy * dy;
            if (d < bd) {
              bd = d;
              best = y * gw + x;
            }
          }
      if (best < 0) return [];
      tx0 = best % gw;
      ty0 = Math.floor(best / gw);
    }
    const start = sy0 * gw + sx0;
    const goal = ty0 * gw + tx0;
    const g = new Float32Array(gw * gh).fill(Infinity);
    const from = new Int32Array(gw * gh).fill(-1);
    const open: number[] = [start];
    const f = new Float32Array(gw * gh).fill(Infinity);
    const h = (i: number) => {
      const dx = Math.abs((i % gw) - tx0), dy = Math.abs(Math.floor(i / gw) - ty0);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    g[start] = 0;
    f[start] = h(start);
    const closed = new Uint8Array(gw * gh);
    let guard = 0;
    while (open.length && guard++ < 30000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === goal) break;
      closed[cur] = 1;
      const cx = cur % gw, cy = Math.floor(cur / gw);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const ni = ny * gw + nx;
          if (blocked[ni] || closed[ni]) continue;
          if (dx && dy && (blocked[cy * gw + nx] || blocked[ny * gw + cx])) continue;
          const ng = g[cur] + (dx && dy ? 1.414 : 1);
          if (ng < g[ni]) {
            g[ni] = ng;
            f[ni] = ng + h(ni);
            from[ni] = cur;
            if (!open.includes(ni)) open.push(ni);
          }
        }
    }
    if (from[goal] < 0 && goal !== start) return [];
    const cells: { x: number; y: number }[] = [];
    for (let c = goal; c >= 0 && c !== start; c = from[c]) cells.unshift({ x: (c % gw) * CELL + CELL / 2, y: Math.floor(c / gw) * CELL + CELL / 2 });
    const clear = (ax: number, ay: number, bx: number, by: number) => {
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (CELL / 2));
      for (let i = 1; i < steps; i++) {
        const x = ax + ((bx - ax) * i) / steps, y = ay + ((by - ay) * i) / steps;
        const c = Math.floor(y / CELL) * gw + Math.floor(x / CELL);
        if (blocked[c]) return false;
      }
      return true;
    };
    const out: { x: number; y: number }[] = [];
    let ax = sx, ay = sy;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !clear(ax, ay, cells[j].x, cells[j].y)) j--;
      out.push(cells[j]);
      ax = cells[j].x;
      ay = cells[j].y;
      i = j + 1;
    }
    if (out.length && !blocked[Math.floor(ty / CELL) * gw + Math.floor(tx / CELL)]) out[out.length - 1] = { x: tx, y: ty };
    return out;
  }

  function goTo(x: number, y: number, arrive: StationId | null) {
    const p = player.current;
    p.path = findPath(p.x, p.y, x, y);
    p.arrive = arrive;
    if (!p.path.length && arrive) {
      if (Math.hypot(p.x - x, p.y - y) < 60) onOpenRef.current(arrive);
    }
  }

  function npcs(): Npc[] {
    const g = gameRef.current;
    const L = layoutRef.current;
    const at = (id: string) => L.find((b) => b.id === id && b.built);
    const out: Npc[] = [];
    const team = g.team;
    const place: Record<StaffRole, { b: string; dx: number; dy: number }> = {
      mechanic: { b: 'workshop', dx: -50, dy: 64 },
      chiefMechanic: { b: 'workshop', dx: 90, dy: 66 },
      raceEngineer: { b: 'truck', dx: -110, dy: -56 },
      aeroEngineer: { b: 'lab', dx: -80, dy: 40 },
      engineEngineer: { b: 'lab', dx: 90, dy: 40 },
      dataAnalyst: { b: 'staffOffice', dx: -70, dy: 36 },
    };
    (Object.keys(place) as StaffRole[]).forEach((r, i) => {
      const st = g.staff[r];
      const b = at(place[r].b);
      if (!st || !b) return;
      out.push({ x: b.door.x + place[r].dx, y: b.door.y + place[r].dy, dir: Math.PI / 2, color: team.color, accent: '#2a3237', label: `${st.name} · ${STAFF_ROLES[r].label}`, station: 'staff', phase: i * 1.7 });
    });
    const lounge = at('lounge');
    const d2 = g.drivers[team.driverIds[1]];
    if (d2 && lounge) out.push({ x: lounge.door.x + 50, y: lounge.door.y + 60, dir: Math.PI, color: team.color, accent: team.color2, label: `${d2.name} · Fahrer 2`, station: 'lounge', helmet: true, phase: 3 });
    if (lounge) {
      for (const id of g.academy.slice(0, 3)) {
        const d = g.drivers[id];
        if (!d) continue;
        out.push({ x: lounge.door.x + 40 + out.length * 6, y: lounge.door.y - 70 + (out.length % 3) * 24, dir: 0, color: '#8fa0aa', accent: team.color, label: `${d.name} · Akademie`, station: 'lounge', helmet: true, phase: out.length });
      }
    }
    return out;
  }

  // Hauptschleife
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    let w = 0, h = 0, dpr = 1;
    let nearTimer = 0;
    let incomeTimer = 1.2;
    const trackCars = Array.from({ length: 5 }, (_, i) => ({ x: i * 420, speed: 420 + i * 25, lane: i % 2 }));
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const burst = (x: number, y: number, n: number, colors: string[]) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const sp = 120 + Math.random() * 260;
        fx.current.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.9 + Math.random() * 0.5, max: 1.4, color: colors[i % colors.length], size: 3 + Math.random() * 4, grav: 520 });
      }
    };
    const floatText = (x: number, y: number, text: string, color: string, size = 17) => {
      fx.current.push({ x, y, vx: 0, vy: -46, life: 1.5, max: 1.5, text, color, size, grav: 0 });
    };

    const step = (dt: number) => {
      const p = player.current;
      const k = keys.current;
      let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      let my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      if (pausedRef.current) mx = my = 0;
      if (mx || my) {
        p.path = [];
        p.arrive = null;
      } else if (p.path.length) {
        const tgt = p.path[0];
        const dx = tgt.x - p.x, dy = tgt.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) {
          p.path.shift();
          if (!p.path.length && p.arrive) {
            const s = p.arrive;
            p.arrive = null;
            onOpenRef.current(s);
          }
        } else {
          mx = dx / d;
          my = dy / d;
        }
      }
      const len = Math.hypot(mx, my);
      p.moving = len > 0;
      if (len > 0) {
        mx /= len;
        my /= len;
        const nx = p.x + mx * SPEED * dt;
        const ny = p.y + my * SPEED * dt;
        const blockedAt = (x: number, y: number) => !isWalkable(x, y) || layoutRef.current.some((b) => b.built && circleRect(x, y, b.rect, R));
        if (!blockedAt(nx, p.y)) p.x = nx;
        if (!blockedAt(p.x, ny)) p.y = ny;
        const targetDir = Math.atan2(my, mx);
        let dd = targetDir - p.dir;
        dd = Math.atan2(Math.sin(dd), Math.cos(dd));
        p.dir += dd * Math.min(1, dt * 14);
        p.phase += dt * 11;
      }
      for (const c of trackCars) {
        c.x += c.speed * dt;
        if (c.x > WORLD.w + 200) c.x = -200 - Math.random() * 300;
      }

      // Kaufflächen: draufstellen und kurz warten
      const pads = padsNow();
      const live = new Set<string>();
      for (const pd of pads) {
        live.add(pd.id);
        const st = (padState.current[pd.id] ??= { dwell: 0, lock: false });
        const d = Math.hypot(p.x - pd.x, p.y - pd.y);
        if (d >= PAD_R) {
          st.dwell = 0;
          if (d > PAD_R + 26) st.lock = false;
          continue;
        }
        if (pausedRef.current || st.lock) continue;
        if (pd.kind === 'track') {
          st.dwell += dt;
          if (st.dwell > 0.45) {
            st.lock = true;
            st.dwell = 0;
            p.path = [];
            onFreeRef.current();
          }
          continue;
        }
        if (!pd.avail || !pd.afford) {
          st.dwell = 0;
          continue;
        }
        st.dwell += dt;
        if (st.dwell >= DWELL) {
          st.dwell = 0;
          st.lock = true;
          onBuyRef.current(pd.id as PlotId);
        }
      }
      for (const id of Object.keys(padState.current)) if (!live.has(id)) delete padState.current[id];

      // Gebaut? Dann Effekte auslösen
      const g = gameRef.current;
      for (const id of Object.keys(g.plots) as PlotId[]) {
        const now = g.plots[id] ?? 0;
        const was = prevPlots.current[id] ?? 0;
        if (now > was) {
          builtAt.current[id] = clock.current;
          const s = layoutRef.current.find((x) => x.plot === id);
          if (s) {
            const cx = s.rect.x + s.rect.w / 2, cy = s.rect.y + s.rect.h / 2;
            burst(cx, cy, was === 0 ? 70 : 36, ['#f2b53d', '#3fd08f', '#5fb8ff', '#ff6a8a', '#ffffff']);
            floatText(cx, s.rect.y - 20, was === 0 ? 'Gebaut!' : `Stufe ${now}`, '#f2b53d', 26);
          }
        }
        prevPlots.current[id] = now;
      }

      // Einnahmen als kleine Zahlen über den Anlagen
      incomeTimer -= dt;
      if (incomeTimer <= 0) {
        incomeTimer = 2.4;
        if (!pausedRef.current) {
          for (const s of layoutRef.current) {
            if (!s.plot || !s.built || !PLOTS[s.plot].yields) continue;
            const amount = Math.round(plotYield(g, s.plot) * 2.4);
            if (amount > 0) floatText(s.rect.x + s.rect.w / 2 + (Math.random() - 0.5) * 30, s.rect.y + s.rect.h * 0.3, `+${amount.toLocaleString('de-DE')} €`, '#6ee7a8', 15);
          }
        }
      }
      for (const f of fx.current) {
        f.life -= dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += f.grav * dt;
      }
      fx.current = fx.current.filter((f) => f.life > 0);

      // Nähe zu einem Eingang
      nearTimer -= dt;
      if (nearTimer <= 0) {
        nearTimer = 0.1;
        let best: Spot | null = null, bd = 90;
        for (const b of layoutRef.current) {
          if (!b.built || !b.station) continue;
          const d = Math.hypot(b.door.x - p.x, b.door.y - p.y);
          if (d < bd) {
            bd = d;
            best = b;
          }
        }
        const id = best ? best.station! : null;
        if (id !== nearRef.current || best) {
          nearRef.current = id;
          if (best) {
            const c = cam.current;
            const sx = (best.door.x - c.x) * c.zoom + w / 2;
            const sy = (best.door.y - c.y) * c.zoom + h / 2;
            setNear({ station: best.station!, sx, sy, name: best.id === 'tunnel' ? 'Windkanal' : STATION_LABELS[best.station!] });
          } else setNear(null);
        }
      }
    };

    let lastDraw = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // Verdeckt (Rennen im Vordergrund): nichts tun, damit das Rennen die volle Leistung bekommt.
      // Hinter einem Fenster reichen wenige Bilder pro Sekunde.
      if (hiddenRef.current) {
        last = now;
        return;
      }
      if (pausedRef.current && now - lastDraw < 220) return;
      lastDraw = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock.current += dt;
      step(dt);
      const p = player.current;
      const c = cam.current;
      const base = Math.min(w, h) < 560 ? Math.min(w, h) / 560 : Math.min(w / 1650, h / 1080);
      c.zoom = Math.max(0.35, Math.min(1.8, base * c.user));
      const vw = w / c.zoom, vh = h / c.zoom;
      let tx = p.x, ty = p.y;
      tx = vw >= WORLD.w ? WORLD.w / 2 : Math.max(vw / 2, Math.min(WORLD.w - vw / 2, tx));
      ty = vh >= WORLD.h ? WORLD.h / 2 : Math.max(vh / 2, Math.min(WORLD.h - vh / 2, ty));
      c.x += (tx - c.x) * Math.min(1, dt * 6);
      c.y += (ty - c.y) * Math.min(1, dt * 6);
      draw(ctx, w, h, dpr, clock.current, trackCars);
    };
    raf = requestAnimationFrame(loop);

    const kd = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const acts = reverseKeys(gameRef.current.settings.keys).rev.get(e.code) ?? [];
      const move = acts.find((a) => a === 'up' || a === 'down' || a === 'left' || a === 'right');
      if (move) {
        keys.current[move] = true;
        e.preventDefault();
        setHint(false);
      } else if ((acts.includes('interact') || e.code === 'Space') && nearRef.current) {
        e.preventDefault();
        onOpenRef.current(nearRef.current);
      }
    };
    const ku = (e: KeyboardEvent) => {
      const acts = reverseKeys(gameRef.current.settings.keys).rev.get(e.code) ?? [];
      for (const a of acts) keys.current[a] = false;
    };
    const blur = () => (keys.current = {});
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused) keys.current = {};
  }, [paused]);

  function toWorld(clientX: number, clientY: number) {
    const r = canvasRef.current!.getBoundingClientRect();
    const c = cam.current;
    return { x: (clientX - r.left - r.width / 2) / c.zoom + c.x, y: (clientY - r.top - r.height / 2) / c.zoom + c.y };
  }

  function onPointer(e: React.PointerEvent) {
    if (paused) return;
    sound.ensure();
    setHint(false);
    const p = toWorld(e.clientX, e.clientY);
    // Kaufflächen und Teststrecke
    const pad = padsNow().find((pd) => Math.hypot(pd.x - p.x, pd.y - p.y) < PAD_R + 26);
    if (pad) {
      goTo(pad.x, pad.y, null);
      return;
    }
    const L = layoutRef.current;
    const b = L.find((bl) => p.x >= bl.rect.x - 10 && p.x <= bl.rect.x + bl.rect.w + 10 && p.y >= bl.rect.y - 10 && p.y <= bl.rect.y + bl.rect.h + 10);
    if (b) {
      if (b.built && b.station) goTo(b.door.x, b.door.y, b.station);
      else if (b.pad) goTo(b.pad.x, b.pad.y, null);
      return;
    }
    const gar = L.find((bl) => bl.id === 'workshop' && bl.built);
    if (gar && Math.abs(p.x - (gar.rect.x + 58)) < 30 && Math.abs(p.y - (gar.rect.y + gar.rect.h + 52)) < 45) {
      goTo(gar.door.x, gar.door.y, 'garage');
      return;
    }
    const n = npcs().find((np) => Math.hypot(np.x - p.x, np.y - p.y) < 26);
    if (n) {
      goTo(n.x, n.y + 30, n.station);
      return;
    }
    goTo(p.x, p.y, null);
    tapMarker.current = { x: p.x, y: p.y, t: 0.6 };
  }
  const tapMarker = useRef<{ x: number; y: number; t: number } | null>(null);

  function onWheel(e: React.WheelEvent) {
    const c = cam.current;
    c.user = Math.max(0.6, Math.min(1.8, c.user * (e.deltaY > 0 ? 0.9 : 1.1)));
  }

  // ---------- Zeichnen ----------
  function draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, t: number, trackCars: { x: number; speed: number; lane: number }[]) {
    const g = gameRef.current;
    const c = cam.current;
    const p = player.current;
    const team = g.team;
    const L = layoutRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2b4a31';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(c.zoom, c.zoom);
    ctx.translate(-c.x, -c.y);

    // Gras-Muster
    ctx.fillStyle = '#2f5135';
    for (let y = 0; y < WORLD.h; y += 80) for (let x = (y / 80) % 2 ? 0 : 40; x < WORLD.w; x += 80) ctx.fillRect(x, y, 40, 80);

    // Teststrecke im Süden
    const TY = TRACK_Y;
    ctx.fillStyle = '#3c6a42';
    ctx.fillRect(0, FENCE_Y - 40, WORLD.w, WORLD.h - FENCE_Y + 40);
    ctx.fillStyle = '#41464b';
    ctx.fillRect(0, TY, WORLD.w, 120);
    ctx.fillStyle = '#e9e9e9';
    ctx.fillRect(0, TY, WORLD.w, 3);
    ctx.fillRect(0, TY + 117, WORLD.w, 3);
    for (let x = 0; x < WORLD.w; x += 40) {
      ctx.fillStyle = (x / 40) % 2 ? '#d4232f' : '#f0f0f0';
      ctx.fillRect(x, TY - 8, 40, 8);
      ctx.fillRect(x, TY + 120, 40, 8);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, TY + 50, WORLD.w, 18);
    // Start/Ziel unterhalb der Teststrecken-Fläche
    for (let r = 0; r < 12; r++) for (let k = 0; k < 2; k++) {
      ctx.fillStyle = (r + k) % 2 ? '#111' : '#f5f5f5';
      ctx.fillRect(1090 + k * 10, TY + 3 + r * 9.5, 10, 9.5);
    }
    const carCols = [team.color, ...g.aiTeams.map((a) => a.color)];
    trackCars.forEach((tc, i) => {
      drawTopCar(ctx, tc.x, TY + 35 + tc.lane * 46, 0, carCols[i % carCols.length], i === 0 ? team.color2 : '#f2f2f2', 11);
    });

    // Zaun mit Sponsorbannern (mit Durchgang zur Teststrecke)
    ctx.fillStyle = '#9aa5ac';
    ctx.fillRect(0, FENCE_Y, GATE.x0 - 10, 4);
    ctx.fillRect(GATE.x1 + 10, FENCE_Y, WORLD.w - GATE.x1 - 10, 4);
    for (let x = 10; x < WORLD.w; x += 60) if (x < GATE.x0 - 10 || x > GATE.x1 + 10) ctx.fillRect(x, FENCE_Y - 6, 4, 16);
    ctx.fillStyle = '#e9c24d';
    ctx.fillRect(GATE.x0 - 14, FENCE_Y - 20, 8, 44);
    ctx.fillRect(GATE.x1 + 6, FENCE_Y - 20, 8, 44);
    const sp = g.sponsors.length ? g.sponsors : [];
    const banners = Math.max(3, sp.length * 2);
    for (let i = 0; i < banners; i++) {
      const s = sp[i % Math.max(1, sp.length)];
      const bx = 140 + i * 260;
      if (bx > WORLD.w - 200) break;
      if (bx + 200 > GATE.x0 - 20 && bx < GATE.x1 + 20) continue;
      ctx.fillStyle = s ? s.color : '#3a454c';
      ctx.fillRect(bx, FENCE_Y - 16, 200, 26);
      ctx.fillStyle = s ? '#0c1215' : '#8b9ca6';
      ctx.font = '700 15px "Saira Condensed", "Arial Narrow", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s ? s.name.toUpperCase() : 'WERBEFLÄCHE FREI', bx + 100, FENCE_Y - 2);
    }

    // Fahrerlager (Asphalt) samt Zugang zur Teststrecke
    ctx.fillStyle = '#3b4247';
    roundRect(ctx, WALK.x0 - 40, WALK.y0 - 40, WALK.x1 - WALK.x0 + 80, WALK.y1 - WALK.y0 + 60, 40);
    ctx.fill();
    ctx.strokeStyle = '#4a5359';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#3b4247';
    ctx.fillRect(GATE.x0 - 10, GATE.y0 - 20, GATE.x1 - GATE.x0 + 20, GATE.y1 - GATE.y0 + 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 2;
    for (let x = WALK.x0; x < WALK.x1; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, WALK.y0 - 30);
      ctx.lineTo(x, WALK.y1 + 10);
      ctx.stroke();
    }
    ctx.setLineDash([24, 18]);
    ctx.strokeStyle = 'rgba(242,181,61,0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(430, 470);
    ctx.lineTo(1790, 470);
    ctx.lineTo(1790, 850);
    ctx.lineTo(430, 850);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    // Teamlogo auf dem Boden
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = team.color;
    ctx.beginPath();
    ctx.arc(1760, 620, 90, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = team.color;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(1760, 620, 90, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = team.color2;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(1760, 620, 72, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = team.color2;
    ctx.font = '800 58px "Saira Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(team.short, 1760, 624);
    ctx.restore();

    // Baumschatten
    for (const tr of decor.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(tr.x + 8, tr.y + 10, tr.r, 0, TAU);
      ctx.fill();
    }

    // Bauland und Gebäude
    const pads = padsNow();
    for (const s of L) {
      if (!s.built) drawLot(ctx, s, pads.find((pd) => pd.id === s.plot), t, g);
      else {
        const born = s.plot ? builtAt.current[s.plot] : undefined;
        const age = born === undefined ? 9 : t - born;
        if (age < 0.7) {
          const k = easeOutBack(Math.min(1, age / 0.7));
          ctx.save();
          const cx = s.rect.x + s.rect.w / 2, cy = s.rect.y + s.rect.h / 2;
          ctx.translate(cx, cy);
          ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
          ctx.translate(-cx, -cy);
          drawBuilding(ctx, s, g, t);
          ctx.restore();
        } else drawBuilding(ctx, s, g, t);
      }
    }

    // Baustelle beim Fabrikausbau
    const gar = L.find((b) => b.id === 'workshop' && b.built);
    if (gar && g.developments.some((d) => d.kind === 'facility')) {
      const bx = gar.rect.x + gar.rect.w + 6, by = gar.rect.y + 20, bw = 70, bh = gar.rect.h - 30;
      for (let i = 0; i < bh; i += 16) {
        ctx.fillStyle = (i / 16) % 2 ? '#f2b53d' : '#1b1f23';
        ctx.fillRect(bx, by + i, 8, Math.min(16, bh - i));
        ctx.fillRect(bx + bw - 8, by + i, 8, Math.min(16, bh - i));
      }
      ctx.fillStyle = 'rgba(242,181,61,0.12)';
      ctx.fillRect(bx, by, bw, bh);
      const ang = Math.sin(t * 0.4) * 0.6 - 2.2;
      ctx.strokeStyle = '#f2b53d';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(bx + bw / 2, by + bh / 2);
      ctx.lineTo(bx + bw / 2 + Math.cos(ang) * 150, by + bh / 2 + Math.sin(ang) * 150);
      ctx.stroke();
      ctx.fillStyle = '#1b1f23';
      ctx.fillRect(bx + bw / 2 - 12, by + bh / 2 - 12, 24, 24);
      label(ctx, bx + bw / 2, by + bh + 16, 'Ausbau läuft', false);
    }

    // Geparktes Teamauto vor der Werkstatt
    if (gar && g.car.chassisId) {
      const cx = gar.rect.x + 58, cy = gar.rect.y + gar.rect.h + 52;
      drawTopCar(ctx, cx, cy, Math.PI / 2, team.color, team.color2, 15);
      const cond = Object.values(g.car.condition).reduce((a, v) => a + v, 0) / 5;
      if (cond < 0.75) {
        for (let i = 0; i < 4; i++) {
          const ph = (t * 0.6 + i / 4) % 1;
          ctx.fillStyle = `rgba(180,185,190,${0.35 * (1 - ph)})`;
          ctx.beginPath();
          ctx.arc(cx - 20 + ph * 10, cy - 10 - ph * 50, 10 + ph * 16, 0, TAU);
          ctx.fill();
        }
      }
    }

    // Kaufflächen
    for (const pd of pads) drawPad(ctx, pd, t, padState.current[pd.id]?.dwell ?? 0, g);

    // Figuren nach y sortiert
    const people: { y: number; draw: () => void }[] = [];
    for (const n of npcs()) {
      people.push({
        y: n.y,
        draw: () => {
          const look = n.dir + Math.sin(t * 0.7 + n.phase) * 0.6;
          drawPerson(ctx, n.x, n.y + Math.sin(t * 2 + n.phase) * 0.6, look, 0, n.color, n.accent, !!n.helmet, false);
          if (Math.hypot(n.x - p.x, n.y - p.y) < 90) label(ctx, n.x, n.y - 34, n.label, false);
        },
      });
    }
    people.push({ y: p.y, draw: () => drawPerson(ctx, p.x, p.y, p.dir, p.moving ? p.phase : 0, team.color, team.color2, true, true) });
    people.sort((a, b) => a.y - b.y).forEach((pp) => pp.draw());

    // Baumkronen
    for (const tr of decor.trees) {
      ctx.fillStyle = tr.c;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.arc(tr.x - tr.r * 0.3, tr.y - tr.r * 0.3, tr.r * 0.5, 0, TAU);
      ctx.fill();
    }

    // Tipp-Markierung
    const tm = tapMarker.current;
    if (tm && tm.t > 0) {
      tm.t -= 1 / 60;
      ctx.strokeStyle = `rgba(255,255,255,${tm.t})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tm.x, tm.y, 18 * (1.4 - tm.t), 0, TAU);
      ctx.stroke();
    }

    // Effekte
    for (const f of fx.current) {
      const a = Math.max(0, Math.min(1, f.life / (f.max * 0.6)));
      ctx.globalAlpha = a;
      if (f.text) {
        ctx.font = `800 ${f.size}px "Saira Condensed", "Arial Narrow", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(10,15,18,0.85)';
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      } else {
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size * 0.6);
      }
    }
    ctx.globalAlpha = 1;

    // Hinweise und Ziel
    const al = alertsRef.current;
    for (const b of L) {
      if (!b.built || b.id === 'tunnel') continue;
      const sx = b.rect.x + b.rect.w / 2;
      const sy = b.door.side === 's' ? b.rect.y - 54 : b.kind === 'truck' || b.kind === 'board' || b.door.side === 'n' ? b.rect.y - 50 : b.rect.y - 16;
      if (!b.station || !al[b.station]) continue;
      if (objRef.current === b.id) continue;
      const pulse = 1 + Math.sin(t * 5) * 0.08;
      ctx.save();
      ctx.translate(sx, sy - 6);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#f2b53d';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a1206';
      ctx.font = '800 22px "Saira Condensed", "Arial Narrow", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 1);
      ctx.restore();
    }
    // Auftragspfeil
    const obj = objRef.current;
    if (obj) {
      let ax = 0, ay = 0, ok = false;
      if (obj === 'track') {
        ax = TEST_PAD.x;
        ay = TEST_PAD.y - 74;
        ok = true;
      } else {
        const s = L.find((x) => x.id === obj || x.plot === obj);
        if (s) {
          if (!s.built && s.pad) {
            ax = s.pad.x;
            ay = s.pad.y - 74;
          } else if (s.door.side === 's') {
            ax = s.door.x;
            ay = s.rect.y - 64;
          } else {
            ax = s.rect.x + s.rect.w / 2;
            ay = s.rect.y - 60;
          }
          ok = true;
        }
      }
      if (ok) {
        const bob = Math.sin(t * 4) * 7;
        ctx.fillStyle = '#f2b53d';
        ctx.strokeStyle = 'rgba(10,15,18,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ax, ay + 6 + bob);
        ctx.lineTo(ax - 17, ay - 20 + bob);
        ctx.lineTo(ax + 17, ay - 20 + bob);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  const nearAlert = near ? alerts[near.station] : undefined;
  const isTouch = useMemo(() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  }, []);
  return (
    <div className="hub" ref={wrapRef}>
      <canvas ref={canvasRef} className="hub-canvas" onPointerDown={onPointer} onWheel={onWheel} aria-label="Teamgelände" />
      {near && !paused && (
        <div className="hub-prompt" style={{ left: near.sx, top: near.sy }}>
          <button type="button" className="btn primary" onClick={() => onOpen(near.station)}>
            {!isTouch && <kbd className="hub-kbd">E</kbd>} {near.name} betreten
          </button>
          {nearAlert && <span className="hub-alert">{nearAlert}</span>}
        </div>
      )}
      {hint && !paused && (
        <div className="hub-hint">
          {isTouch ? (
            <>Tippe auf den Boden, um hinzulaufen. Stell dich auf leuchtende Flächen, um zu bauen.</>
          ) : (
            <>Laufen mit <kbd className="hub-kbd">{keyHint}</kbd>, oder klicke auf ein Ziel. Stell dich auf leuchtende Flächen, um zu bauen. Gebäude betrittst du mit <kbd className="hub-kbd">{labelsFor(reverseKeys(game.settings.keys).map, 'interact').split(' / ')[0]}</kbd>.</>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Zeichenhilfen ----------
function easeOutBack(x: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, big: boolean) {
  ctx.font = `${big ? 700 : 600} ${big ? 18 : 13}px "Barlow", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width + 14;
  ctx.fillStyle = 'rgba(10,15,18,0.82)';
  roundRect(ctx, x - tw / 2, y - 11, tw, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#e6edf0';
  ctx.fillText(text, x, y + 1);
}

function lockIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  roundRect(ctx, -9, -2, 18, 14, 3);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -3, 6, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

/** Leuchtende Kauffläche: grün = kaufbar, gelb = es fehlt Geld, grau = noch gesperrt */
function drawPad(ctx: CanvasRenderingContext2D, pd: PadInfo, t: number, dwell: number, g: GameState) {
  const isTrack = pd.kind === 'track';
  const ready = pd.avail && pd.afford;
  const col = isTrack ? '#5fb8ff' : !pd.avail ? '#6a7b85' : pd.afford ? '#3fd08f' : '#f2b53d';
  const pulse = 1 + Math.sin(t * 4 + pd.x) * (ready ? 0.07 : 0.025);
  ctx.save();
  ctx.translate(pd.x, pd.y);
  // Bodenplatte
  ctx.fillStyle = 'rgba(8,12,14,0.55)';
  roundRect(ctx, -56, -56, 112, 112, 22);
  ctx.fill();
  if (ready || isTrack) {
    const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, PAD_R * 1.5);
    gr.addColorStop(0, isTrack ? 'rgba(95,184,255,0.45)' : 'rgba(63,208,143,0.5)');
    gr.addColorStop(1, 'rgba(63,208,143,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(0, 0, PAD_R * 1.5, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = 5;
  ctx.setLineDash(ready || isTrack ? [] : [10, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, PAD_R * pulse - 4, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  // Symbol
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  if (isTrack) {
    ctx.beginPath();
    ctx.moveTo(-10, 16);
    ctx.lineTo(-10, -16);
    ctx.lineTo(14, -9);
    ctx.lineTo(-10, -2);
    ctx.stroke();
  } else if (!pd.avail) {
    lockIcon(ctx, 0, -2, 1.1, col);
  } else if (pd.level === 0) {
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 14);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-13, 5);
    ctx.lineTo(0, -9);
    ctx.lineTo(13, 5);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // Fortschritt beim Daraufstehen
  if (dwell > 0 && !isTrack) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, PAD_R + 8, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, dwell / DWELL));
    ctx.stroke();
  }
  ctx.restore();

  // Preisschild
  const title = isTrack ? 'TESTSTRECKE' : pd.name.toUpperCase();
  const sub = isTrack
    ? 'Freie Fahrt · Runden bringen Geld'
    : !pd.avail
      ? pd.req
      : pd.level === 0
        ? money(pd.cost)
        : `Stufe ${pd.level + 1} · ${money(pd.cost)}${pd.gain > 0 ? ` · +${Math.round(pd.gain)} €/s` : ''}`;
  const sub2 = !isTrack && pd.avail && !pd.afford ? `Es fehlen ${money(pd.cost - g.money)}` : '';
  ctx.font = '700 17px "Saira Condensed", "Arial Narrow", sans-serif';
  const w1 = ctx.measureText(title).width;
  ctx.font = '600 13px "Barlow", "Segoe UI", sans-serif';
  const w2 = Math.max(ctx.measureText(sub).width, sub2 ? ctx.measureText(sub2).width : 0);
  const tw = Math.max(w1, w2) + 24;
  const th = sub2 ? 58 : 42;
  const ty = pd.above ? pd.y - 62 - th : pd.y + 62;
  ctx.fillStyle = 'rgba(10,15,18,0.88)';
  roundRect(ctx, pd.x - tw / 2, ty, tw, th, 8);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e6edf0';
  ctx.font = '700 17px "Saira Condensed", "Arial Narrow", sans-serif';
  ctx.fillText(title, pd.x, ty + 14);
  ctx.font = '600 13px "Barlow", "Segoe UI", sans-serif';
  ctx.fillStyle = col;
  ctx.fillText(sub, pd.x, ty + 31);
  if (sub2) {
    ctx.fillStyle = '#8b9ca6';
    ctx.fillText(sub2, pd.x, ty + 47);
  }
}

/** Bauland: gestrichelter Rahmen, Absperrband und ein Schatten des späteren Gebäudes */
function drawLot(ctx: CanvasRenderingContext2D, s: Spot, pd: PadInfo | undefined, t: number, g: GameState) {
  const { x, y, w, h } = s.rect;
  const locked = pd ? !pd.avail : true;
  ctx.fillStyle = locked ? 'rgba(20,28,32,0.35)' : 'rgba(95,184,255,0.1)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = locked ? 'rgba(139,156,166,0.5)' : 'rgba(95,184,255,0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -t * 12;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  // Eckpfosten mit Warnstreifen
  for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
    ctx.fillStyle = '#f2b53d';
    ctx.fillRect(px - 5, py - 5, 10, 10);
    ctx.fillStyle = '#1b1f23';
    ctx.fillRect(px - 5, py - 5, 5, 5);
    ctx.fillRect(px, py, 5, 5);
  }
  // Umriss des künftigen Gebäudes
  ctx.strokeStyle = locked ? 'rgba(139,156,166,0.25)' : 'rgba(95,184,255,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 14, y + 14, w - 28, h - 28, 10);
  ctx.stroke();
  // Schild
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 ' + (w > 150 ? 24 : 18) + 'px "Saira Condensed", "Arial Narrow", sans-serif';
  ctx.fillStyle = locked ? 'rgba(200,212,219,0.55)' : 'rgba(230,237,240,0.9)';
  ctx.fillText(s.name.toUpperCase(), cx, cy - (locked ? 6 : 0));
  if (locked) lockIcon(ctx, cx, cy + 18, 0.9, 'rgba(200,212,219,0.55)');
  void g;
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Spot, g: GameState, t: number) {
  const { x, y, w, h } = b.rect;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  if (b.kind === 'tunnel') {
    roundRect(ctx, x + 12, y + 14, w, h, h / 2);
    ctx.fill();
  } else ctx.fillRect(x + 12, y + 14, w, h);

  if (b.kind === 'truck') {
    ctx.fillStyle = '#eef2f4';
    roundRect(ctx, x, y, w - 70, h, 8);
    ctx.fill();
    ctx.fillStyle = g.team.color;
    ctx.fillRect(x, y + h / 2 - 12, w - 70, 24);
    ctx.fillStyle = g.team.color2;
    ctx.fillRect(x, y + h / 2 + 12, w - 70, 5);
    ctx.fillStyle = '#0c1215';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tname = g.team.name.toUpperCase();
    let fs = 22;
    ctx.font = `800 ${fs}px "Saira Condensed", "Arial Narrow", sans-serif`;
    while (fs > 10 && ctx.measureText(tname).width > w - 90) {
      fs--;
      ctx.font = `800 ${fs}px "Saira Condensed", "Arial Narrow", sans-serif`;
    }
    ctx.fillText(tname, x + (w - 70) / 2, y + 18);
    ctx.fillStyle = '#262c30';
    roundRect(ctx, x + w - 64, y + 6, 64, h - 12, 10);
    ctx.fill();
    ctx.fillStyle = '#7fb6d6';
    ctx.fillRect(x + w - 16, y + 16, 8, h - 32);
    ctx.fillStyle = g.team.color;
    ctx.fillRect(x + w - 60, y + 10, 30, h - 20);
    signPlate(ctx, b.door.x, y - 26, 'Team-Transporter', 'Zum Rennwochenende');
    return;
  }
  if (b.kind === 'board') {
    ctx.fillStyle = '#1a2024';
    ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 7; i++) {
      const done = i < g.round;
      ctx.fillStyle = i === g.round ? g.team.color : done ? '#3fd08f' : '#5e707a';
      ctx.fillRect(x + 8 + i * 17, y + 7, 12, 12);
    }
    ctx.fillStyle = '#6b767c';
    ctx.fillRect(x + 10, y + h, 6, 16);
    ctx.fillRect(x + w - 16, y + h, 6, 16);
    signPlate(ctx, b.door.x, y - 22, 'Rennkalender', `Runde ${Math.min(g.round + 1, g.calendar.length)}/${g.calendar.length}`);
    return;
  }
  if (b.kind === 'stand') {
    drawStand(ctx, b, g, t);
    return;
  }
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, shade(b.roof, 14));
  grad.addColorStop(1, shade(b.roof, -12));
  ctx.fillStyle = grad;
  if (b.kind === 'tunnel') {
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (w * i) / 7, y + 6);
      ctx.lineTo(x + (w * i) / 7, y + h - 6);
      ctx.stroke();
    }
    signPlate(ctx, x + w / 2, y + h + 26, 'Windkanal', '');
    return;
  }
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

  const lvl = b.plot ? plotLevel(g, b.plot) : 1;
  if (b.kind === 'garage' || b.kind === 'factory') {
    ctx.strokeStyle = 'rgba(0,0,0,0.13)';
    ctx.lineWidth = 2;
    for (let i = 12; i < w; i += 14) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 6);
      ctx.lineTo(x + i, y + h - 24);
      ctx.stroke();
    }
    if (b.kind === 'factory') {
      ctx.fillStyle = 'rgba(140,200,235,0.55)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 30 + i * ((w - 60) / 4), y + 20, (w - 60) / 4 - 16, 40);
    }
    ctx.fillStyle = g.team.color;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.4, 30, 0, TAU);
    ctx.fill();
    ctx.fillStyle = g.team.color2;
    ctx.font = '800 26px "Saira Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.team.short, x + w / 2, y + h * 0.4 + 1);
  } else if (b.kind === 'lab') {
    ctx.fillStyle = 'rgba(120,190,230,0.6)';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 24 + i * 80, y + 26, 60, 34);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + w - 60, y + 90, 36, 30);
    if (g.developments.some((d) => d.kind === 'research')) {
      ctx.fillStyle = `rgba(95,184,255,${0.5 + Math.sin(t * 5) * 0.4})`;
      ctx.beginPath();
      ctx.arc(x + 30, y + 110, 8, 0, TAU);
      ctx.fill();
    }
  } else if (b.kind === 'office') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + 20, y + 20, 40, 30);
    ctx.fillRect(x + 70, y + 20, 40, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 20, y + h - 70, w - 40, 30);
  } else if (b.kind === 'lounge') {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, x + 24, y + 24, w - 48, h - 80, 14);
    ctx.fill();
  } else if (b.kind === 'trophy') {
    const cups = Math.min(12, g.stats.wins + g.stats.titles * 3);
    for (let i = 0; i < Math.max(3, cups); i++) {
      const cx = x + 30 + (i % 5) * 30;
      const cy = y + 40 + Math.floor(i / 5) * 40;
      ctx.fillStyle = i < cups ? '#f2c14e' : 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy - 10);
      ctx.lineTo(cx + 9, cy - 10);
      ctx.lineTo(cx + 5, cy + 4);
      ctx.lineTo(cx - 5, cy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - 2, cy + 4, 4, 6);
      ctx.fillRect(cx - 7, cy + 10, 14, 4);
    }
  } else if (b.kind === 'kiosk') {
    // Markise mit Streifen und Tresen
    const sw = w / 8;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#f4f6f7' : g.team.color;
      ctx.fillRect(x + i * sw, y, sw, h * 0.55);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + h * 0.55, w, 6);
    ctx.fillStyle = '#8d6b44';
    ctx.fillRect(x + 8, y + h * 0.62, w - 16, h * 0.22);
    if (lvl >= 2) {
      ctx.fillStyle = g.team.color2;
      ctx.beginPath();
      ctx.arc(x - 16, y + h + 6, 15, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w + 16, y + h + 6, 15, 0, TAU);
      ctx.fill();
    }
    if (lvl >= 3) {
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 6 + i * ((w - 12) / 6), y - 8, 8, 8);
    }
  } else if (b.kind === 'shop') {
    ctx.fillStyle = g.team.color;
    ctx.fillRect(x, y + 10, w, 22);
    ctx.fillStyle = g.team.color2;
    ctx.font = '800 20px "Saira Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FANSHOP', x + w / 2, y + 22);
    ctx.fillStyle = 'rgba(120,190,230,0.55)';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 14 + i * ((w - 28) / 4), y + 44, (w - 28) / 4 - 10, 26);
    for (let i = 0; i < Math.min(lvl, 5); i++) {
      ctx.fillStyle = i % 2 ? g.team.color2 : g.team.color;
      ctx.fillRect(x + 10 + i * 30, y + h + 2, 18, 30);
    }
  } else if (b.kind === 'media') {
    ctx.fillStyle = 'rgba(120,190,230,0.5)';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 20 + i * 58, y + 22, 44, 30);
    // Satellitenschüssel und Antenne
    ctx.fillStyle = '#d9e0e5';
    ctx.beginPath();
    ctx.ellipse(x + w - 60, y + 100, 38, 26, -0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7d8b94';
    ctx.beginPath();
    ctx.arc(x + w - 60, y + 100, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9aa5ac';
    ctx.fillRect(x + 40, y + 80, 8, 70);
    ctx.fillStyle = `rgba(255,70,70,${0.4 + Math.sin(t * 4) * 0.4})`;
    ctx.beginPath();
    ctx.arc(x + 44, y + 78, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = g.team.color;
    ctx.fillRect(x + 90, y + 90, 90, 14);
  } else if (b.kind === 'dyno') {
    // Rollen des Prüfstands und Fahrzeug
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, x + 30, y + 24, w - 60, 70, 10);
    ctx.fill();
    ctx.fillStyle = '#9aa5ac';
    for (const dx of [58, w - 58]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + 59, 24, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5e6b73';
      ctx.beginPath();
      ctx.arc(x + dx, y + 59, 9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#9aa5ac';
    }
    drawTopCar(ctx, x + w / 2, y + 59, 0, g.team.color, g.team.color2, 15);
    ctx.fillStyle = `rgba(63,208,143,${0.5 + Math.sin(t * 3) * 0.4})`;
    ctx.beginPath();
    ctx.arc(x + w - 24, y + 24, 6, 0, TAU);
    ctx.fill();
  } else if (b.kind === 'tyres') {
    // Reifenstapel in den Mischungsfarben
    const cols = ['#ff3b47', '#ffd23f', '#f2f4f5', '#3ecf6a', '#3b8cff'];
    for (let i = 0; i < 9; i++) {
      const cx = x + 22 + i * ((w - 44) / 8);
      for (const cy of [y + 22, y + 52]) {
        ctx.fillStyle = '#15181b';
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = cols[i % cols.length];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, TAU);
        ctx.stroke();
      }
    }
  } else if (b.kind === 'pitwall') {
    // Bildschirme der Boxenmauer
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#10181c';
      ctx.fillRect(x + 16 + i * 60, y + 20, 50, 34);
      ctx.fillStyle = `rgba(95,184,255,${0.45 + Math.sin(t * 2 + i) * 0.2})`;
      ctx.fillRect(x + 20 + i * 60, y + 24, 42, 26);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x + 16, y + 74, w - 32, 30);
    ctx.fillStyle = g.team.color;
    ctx.fillRect(x + 16, y + 70, w - 32, 4);
  }

  // Fassade mit Tür zur Platzseite
  const fac = 18;
  ctx.fillStyle = b.facade;
  const s = b.door.side;
  if (s === 's') ctx.fillRect(x, y + h - fac, w, fac);
  if (s === 'n') ctx.fillRect(x, y, w, fac);
  if (s === 'e') ctx.fillRect(x + w - fac, y, fac, h);
  if (s === 'w') ctx.fillRect(x, y, fac, h);
  if (b.kind === 'garage' || b.kind === 'factory') {
    const doors = Math.max(2, g.facility + 1);
    const dw = (w - 40) / doors;
    for (let i = 0; i < doors; i++) {
      ctx.fillStyle = '#9aa5ac';
      ctx.fillRect(x + 20 + i * dw + 6, y + h - fac + 3, dw - 12, fac - 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x + 20 + i * dw + 6, y + h - fac + 5 + k * 4, dw - 12, 1);
    }
  } else if (b.station) {
    ctx.fillStyle = '#d8dee2';
    if (s === 's') ctx.fillRect(b.door.x - 18, y + h - fac + 4, 36, fac - 4);
    if (s === 'e') ctx.fillRect(x + w - fac + 4, b.door.y - 18, fac - 4, 36);
    if (s === 'w') ctx.fillRect(x, b.door.y - 18, fac - 4, 36);
    if (s === 'n') ctx.fillRect(b.door.x - 18, y, 36, fac - 4);
    ctx.fillStyle = g.team.color;
    if (s === 's') ctx.fillRect(b.door.x - 18, y + h - 3, 36, 3);
    if (s === 'e') ctx.fillRect(x + w - 3, b.door.y - 18, 3, 36);
    if (s === 'w') ctx.fillRect(x, b.door.y - 18, 3, 36);
    if (s === 'n') ctx.fillRect(b.door.x - 18, y, 36, 3);
  }

  // Schild; Einnahmeanlagen zeigen Stufe und Ertrag
  let sub = b.sub ?? '';
  if (b.plot && PLOTS[b.plot].yields) sub = `Stufe ${lvl}/${plotMaxLevel(b.plot)} · +${Math.round(plotYield(g, b.plot))} €/s`;
  const sx = b.door.side === 'e' || b.door.side === 'w' ? x + w / 2 : b.door.x;
  const sy = b.door.side === 's' ? y - 22 : b.door.side === 'n' ? y + h + 24 : y + h / 2 + 68;
  signPlate(ctx, sx, sy, b.name, sub);
}

function drawStand(ctx: CanvasRenderingContext2D, b: Spot, g: GameState, t: number) {
  const { x, y, w, h } = b.rect;
  const lvl = b.plot ? plotLevel(g, b.plot) : 1;
  ctx.fillStyle = '#59626b';
  ctx.fillRect(x, y, w, h);
  const rows = 4;
  const rh = (h - 18) / rows;
  const rnd = seeded(31);
  const cols = ['#d8453b', '#2f6fd1', '#f2c14e', '#e9e9e9', '#33a867', '#c46ad1', '#ff8a3d'];
  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = r % 2 ? '#6b757e' : '#7d8790';
    ctx.fillRect(x + 4, y + 4 + r * rh, w - 8, rh - 2);
    const density = 0.18 + lvl * 0.14;
    for (let i = 0; i < (w - 16) / 9; i++) {
      if (rnd() > density) continue;
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
      const bob = Math.sin(t * 3 + i * 1.3 + r) * 1.2;
      ctx.beginPath();
      ctx.arc(x + 12 + i * 9, y + 4 + r * rh + rh / 2 + bob, 3.2, 0, TAU);
      ctx.fill();
    }
  }
  // Dach hinten
  ctx.fillStyle = '#2f373d';
  ctx.fillRect(x, y, w, 8);
  // Treppe zum Fahrerlager
  ctx.fillStyle = '#9aa5ac';
  ctx.fillRect(x, y + h - 14, w, 14);
  ctx.fillStyle = g.team.color;
  ctx.fillRect(x, y + h - 4, w, 4);
  const sub = b.plot ? `Stufe ${lvl}/${plotMaxLevel(b.plot)} · +${Math.round(plotYield(g, b.plot!))} €/s` : '';
  signPlate(ctx, x + w / 2, y - 22, b.name, sub);
}

function signPlate(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, sub: string) {
  ctx.font = '700 17px "Saira Condensed", "Arial Narrow", sans-serif';
  ctx.font = '600 12px "Barlow", "Segoe UI", sans-serif';
  const subW = sub ? ctx.measureText(sub).width : 0;
  ctx.font = '700 17px "Saira Condensed", "Arial Narrow", sans-serif';
  const tw = Math.max(ctx.measureText(title.toUpperCase()).width, subW) + 22;
  const hh = sub ? 36 : 24;
  ctx.fillStyle = 'rgba(10,15,18,0.86)';
  roundRect(ctx, x - tw / 2, y - hh / 2, tw, hh, 6);
  ctx.fill();
  ctx.fillStyle = '#e6edf0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title.toUpperCase(), x, y - (sub ? 7 : 0));
  if (sub) {
    ctx.font = '600 12px "Barlow", "Segoe UI", sans-serif';
    ctx.fillStyle = '#8b9ca6';
    ctx.fillText(sub, x, y + 10);
  }
}

function shade(hex: string, amt: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const gg = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${gg},${b})`;
}

export function drawTopCar(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, col: string, col2: string, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-2.2, -0.75, 4.9, 1.9);
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(1.15, -1.0, 0.85, 0.42);
  ctx.fillRect(1.15, 0.58, 0.85, 0.42);
  ctx.fillRect(-1.95, -1.05, 1.0, 0.48);
  ctx.fillRect(-1.95, 0.57, 1.0, 0.48);
  ctx.fillStyle = col2;
  ctx.fillRect(-2.35, -0.78, 0.38, 1.56);
  ctx.fillRect(2.15, -0.92, 0.32, 1.84);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(2.4, 0);
  ctx.lineTo(1.4, -0.22);
  ctx.lineTo(0.6, -0.42);
  ctx.lineTo(0.1, -0.72);
  ctx.lineTo(-1.2, -0.68);
  ctx.lineTo(-2.05, -0.32);
  ctx.lineTo(-2.05, 0.32);
  ctx.lineTo(-1.2, 0.68);
  ctx.lineTo(0.1, 0.72);
  ctx.lineTo(0.6, 0.42);
  ctx.lineTo(1.4, 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = col2;
  ctx.fillRect(-1.6, -0.1, 3.6, 0.2);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(-0.1, 0, 0.45, 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Person von oben: Beine, Körper, Arme, Kopf/Helm
function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, phase: number, suit: string, accent: string, helmet: boolean, me: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.35, 1.35);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 5, 15, 11, 0, 0, TAU);
  ctx.fill();
  if (me) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 4, 22, 16, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.rotate(dir);
  const swing = Math.sin(phase) * 7;
  ctx.fillStyle = helmet ? shade(suit, -40) : '#2b3238';
  ctx.fillRect(-4 + swing, -7, 10, 5);
  ctx.fillRect(-4 - swing, 2, 10, 5);
  ctx.fillStyle = suit;
  ctx.beginPath();
  ctx.arc(swing * -0.6, -11, 4, 0, TAU);
  ctx.arc(-swing * -0.6, 11, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = suit;
  roundRect(ctx, -7, -10, 14, 20, 6);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(-7, -2, 14, 4);
  if (helmet) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(1, 0, 7.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = suit;
    ctx.fillRect(-6, -1.5, 13, 3);
    ctx.fillStyle = '#10181c';
    ctx.fillRect(4, -5, 3.5, 10);
  } else {
    ctx.fillStyle = '#d9a77f';
    ctx.beginPath();
    ctx.arc(1, 0, 6.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3b2a20';
    ctx.beginPath();
    ctx.arc(-1, 0, 6, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.fill();
  }
  ctx.restore();
}
