// Canvas-Darstellung des Rennens: Strecke, Boxengasse, Fahrzeuge, Effekte, Minikarte.
import type { RaceEngine, CarSim } from './engine';
import { pointAt, wrapIndex, nearestIndexGlobal, type TrackGeometry } from './trackGeometry';
import type { TrackDef } from '../types';

interface Scenery {
  trees: { x: number; y: number; r: number; c: string }[];
  stands: { x: number; y: number; w: number; h: number; a: number }[];
}

const SCENERY_COLORS: Record<TrackDef['scenery'], { ground: string; ground2: string; runoff: string; tree: string[] }> = {
  park: { ground: '#2e5233', ground2: '#335a38', runoff: '#3b6a40', tree: ['#1f3d24', '#26472b', '#2c5131'] },
  forest: { ground: '#24412b', ground2: '#284830', runoff: '#2f5a36', tree: ['#163020', '#1b3826', '#21402b'] },
  harbor: { ground: '#4c565c', ground2: '#535e65', runoff: '#5f6a70', tree: ['#2c4a33', '#33553a'] },
  dry: { ground: '#7b6c4b', ground2: '#84744f', runoff: '#8e7f5a', tree: ['#4b5a2e', '#566533'] },
};

export interface RenderOptions {
  camera: 'rotate' | 'fixed';
  viewDist: 'near' | 'normal' | 'far';
  showLine: boolean;
  quality: 'low' | 'high';
}

export class RaceRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  eng: RaceEngine;
  geo: TrackGeometry;
  track: TrackDef;
  opts: RenderOptions;
  dpr = 1;
  w = 0;
  h = 0;
  camX = 0;
  camY = 0;
  camH = 0;
  zoom = 6;
  carScale = 1;
  boards: { x: number; y: number; a: number; n: number }[] = [];
  scenery: Scenery;
  paths!: {
    runoff: Path2D;
    surface: Path2D;
    edgeL: Path2D;
    edgeR: Path2D;
    kerbL: Path2D;
    kerbR: Path2D;
    wallL: Path2D;
    wallR: Path2D;
    pitLane: Path2D;
    pitWall: Path2D;
    mini: Path2D;
    rubber: Path2D;
  };
  miniBounds = { minX: 0, minY: 0, scale: 1 };
  lineCache: { x: number; y: number; brake: boolean }[] = [];
  lineTimer = 0;
  rainDrops: { x: number; y: number; l: number }[] = [];

  constructor(canvas: HTMLCanvasElement, eng: RaceEngine, opts: RenderOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.eng = eng;
    this.geo = eng.geo;
    this.track = eng.cfg.track;
    this.opts = opts;
    this.buildPaths();
    this.scenery = this.buildScenery();
    this.buildBoards();
    for (let i = 0; i < 160; i++) this.rainDrops.push({ x: Math.random(), y: Math.random(), l: 0.5 + Math.random() });
  }

  private offsetPath(lat: number, from = 0, to = this.geo.n, closed = true): Path2D {
    const g = this.geo;
    const p = new Path2D();
    for (let k = from; k <= to; k++) {
      const i = wrapIndex(k, g.n);
      const x = g.x[i] + g.nx[i] * lat;
      const y = g.y[i] + g.ny[i] * lat;
      if (k === from) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    if (closed) p.closePath();
    return p;
  }

  private buildPaths() {
    const g = this.geo;
    const hw = g.halfWidth;
    const center = this.offsetPath(0);
    const kerbL = new Path2D();
    const kerbR = new Path2D();
    let inK = false;
    for (let i = 0; i <= g.n; i++) {
      const ii = wrapIndex(i, g.n);
      const k = g.k[ii];
      const corner = Math.abs(k) > 1 / 160;
      // Randsteine nur am Kurvenaußen- und -innenrand
      const xl = g.x[ii] - g.nx[ii] * (hw + 0.5);
      const yl = g.y[ii] - g.ny[ii] * (hw + 0.5);
      const xr = g.x[ii] + g.nx[ii] * (hw + 0.5);
      const yr = g.y[ii] + g.ny[ii] * (hw + 0.5);
      if (corner && !inK) {
        kerbL.moveTo(xl, yl);
        kerbR.moveTo(xr, yr);
      } else if (corner) {
        kerbL.lineTo(xl, yl);
        kerbR.lineTo(xr, yr);
      }
      inK = corner;
    }
    const wall = hw + this.track.runoff;
    // Boxengasse
    const eng = this.eng;
    const pit = new Path2D();
    const pitWall = new Path2D();
    const L = g.length;
    const total = (eng.pitOut - eng.pitIn + L) % L;
    for (let d = 0; d <= total; d += 4) {
      const s = eng.pitIn + d;
      let lat = eng.pitLat;
      if (d < 80) lat = g.lineOff[wrapIndex(Math.round(eng.pitIn / g.ds), g.n)] * (1 - sm(d / 80)) + eng.pitLat * sm(d / 80);
      else if (d > total - 90) lat = eng.pitLat + (g.lineOff[wrapIndex(Math.round(eng.pitOut / g.ds), g.n)] - eng.pitLat) * sm((d - (total - 90)) / 90);
      const p = pointAt(g, s, lat);
      if (d === 0) pit.moveTo(p.x, p.y);
      else pit.lineTo(p.x, p.y);
      if (d > 90 && d < total - 100) {
        const w = pointAt(g, s, Math.sign(eng.pitLat) * (Math.abs(eng.pitLat) - 5.5));
        if (d < 95) pitWall.moveTo(w.x, w.y);
        else pitWall.lineTo(w.x, w.y);
      }
    }
    // Minikarte
    const mini = new Path2D();
    for (let i = 0; i <= g.n; i += 4) {
      const ii = wrapIndex(i, g.n);
      if (i === 0) mini.moveTo(g.x[ii], g.y[ii]);
      else mini.lineTo(g.x[ii], g.y[ii]);
    }
    mini.closePath();
    const rubber = new Path2D();
    for (let i = 0; i <= g.n; i += 3) {
      const ii = wrapIndex(i, g.n);
      const x = g.x[ii] + g.nx[ii] * g.lineOff[ii];
      const y = g.y[ii] + g.ny[ii] * g.lineOff[ii];
      if (i === 0) rubber.moveTo(x, y);
      else rubber.lineTo(x, y);
    }
    this.paths = {
      rubber,
      runoff: center,
      surface: center,
      edgeL: this.offsetPath(-hw),
      edgeR: this.offsetPath(hw),
      kerbL,
      kerbR,
      wallL: this.offsetPath(-wall),
      wallR: this.offsetPath(wall),
      pitLane: pit,
      pitWall,
      mini,
    };
  }

  // Bremsschilder (150 / 100 / 50 m) vor jeder deutlichen Kurve
  private buildBoards() {
    const g = this.geo;
    const n = g.n;
    const strong = (i: number) => Math.abs(g.lineK[wrapIndex(i, n)]) > 1 / 95;
    const entries: number[] = [];
    for (let i = 0; i < n; i++) if (strong(i) && !strong(i - 1)) entries.push(i);
    let lastExit = -1e9;
    const exits = new Map<number, number>();
    for (const e of entries) {
      let j = e;
      while (strong(j) && j - e < n) j++;
      exits.set(e, j);
    }
    const sorted = [...entries].sort((a, b) => a - b);
    sorted.forEach((e, k) => {
      const prev = sorted[(k - 1 + sorted.length) % sorted.length];
      const prevExit = exits.get(prev) ?? prev;
      const gapM = (((e - prevExit) % n) + n) % n * g.ds;
      lastExit = prevExit;
      if (gapM < 110) return;
      const outside = -Math.sign(g.lineK[wrapIndex(e + 5, n)] || 1);
      for (const [dist, num] of [[150, 3], [100, 2], [50, 1]] as const) {
        if (dist > gapM - 20) continue;
        const i = wrapIndex(e - Math.round(dist / g.ds), n);
        const off = (g.halfWidth + 3.4) * outside;
        this.boards.push({ x: g.x[i] + g.nx[i] * off, y: g.y[i] + g.ny[i] * off, a: Math.atan2(g.ty[i], g.tx[i]), n: num });
      }
    });
    void lastExit;
  }

  private buildScenery(): Scenery {
    const g = this.geo;
    const pad = 220;
    const trees: Scenery['trees'] = [];
    const stands: Scenery['stands'] = [];
    const cols = SCENERY_COLORS[this.track.scenery];
    const count = this.opts.quality === 'high' ? 900 : 350;
    const minD = g.halfWidth + this.track.runoff + 10;
    let tries = 0;
    while (trees.length < count && tries < count * 3) {
      tries++;
      const x = g.minX - pad + Math.random() * (g.maxX - g.minX + pad * 2);
      const y = g.minY - pad + Math.random() * (g.maxY - g.minY + pad * 2);
      const i = nearestIndexGlobal(g, x, y);
      const d = Math.hypot(x - g.x[i], y - g.y[i]);
      if (d < minD + 4) continue;
      if (Math.abs(d - Math.abs(this.eng.pitLat)) < 22 && (i * g.ds > this.eng.pitIn - 40 || i * g.ds < this.eng.pitOut + 40)) continue;
      if (this.track.scenery === 'harbor' && Math.random() < 0.6) continue;
      trees.push({ x, y, r: 2.5 + Math.random() * 4.5, c: cols.tree[Math.floor(Math.random() * cols.tree.length)] });
    }
    // Tribünen an langsamen Kurven und Start/Ziel
    for (let i = 0; i < g.n; i += 6) {
      const k = Math.abs(g.k[i]);
      if ((k > 1 / 45 && Math.random() < 0.25) || (i === 0)) {
        const side = -Math.sign(g.k[i] || 1);
        const off = g.halfWidth + this.track.runoff + 9;
        const x = g.x[i] + g.nx[i] * off * side;
        const y = g.y[i] + g.ny[i] * off * side;
        stands.push({ x, y, w: 34, h: 9, a: Math.atan2(g.ty[i], g.tx[i]) });
      }
    }
    return { trees, stands };
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.quality === 'high' ? 2 : 1.25);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  updateRacingLine(car: CarSim) {
    const g = this.geo;
    const prof = car.ai.profile;
    const out: { x: number; y: number; brake: boolean }[] = [];
    for (let i = 0; i < g.n; i += 3) {
      const j = wrapIndex(i + 6, g.n);
      const brake = prof[j] < prof[i] - 0.8;
      out.push({ x: g.x[i] + g.nx[i] * g.lineOff[i], y: g.y[i] + g.ny[i] * g.lineOff[i], brake });
    }
    this.lineCache = out;
  }

  render(focus: CarSim | null, dt: number) {
    const ctx = this.ctx;
    const g = this.geo;
    const eng = this.eng;
    const cols = SCENERY_COLORS[this.track.scenery];
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = cols.ground;
    ctx.fillRect(0, 0, this.w, this.h);

    // Kamera
    const minDim = Math.min(this.w, this.h);
    const speed = focus ? focus.speed : 0;
    // Sichtweite nach vorne hängt von Tempo und Einstellung ab
    const vd = this.opts.viewDist;
    const ahead = vd === 'near' ? Math.min(150, 70 + speed * 1.0) : vd === 'normal' ? Math.min(260, 120 + speed * 1.8) : Math.min(340, 160 + speed * 2.6);
    const targetZoom = Math.max(1.7, this.opts.camera === 'rotate' ? (this.h * 0.8) / ahead : minDim / (ahead * 1.15));
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 1.8);
    this.carScale = Math.max(1, Math.min(2.3, 24 / (this.zoom * 4.8)));
    void minDim;
    if (focus) {
      const look = this.opts.camera === 'rotate' ? 0 : Math.min(this.opts.viewDist === 'near' ? 30 : 70, speed * 0.9);
      const tx = focus.x + Math.cos(focus.h) * look;
      const ty = focus.y + Math.sin(focus.h) * look;
      if (this.camX === 0 && this.camY === 0) {
        this.camX = tx;
        this.camY = ty;
        this.camH = focus.h;
      }
      const k = Math.min(1, dt * 8);
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
      let dh = focus.h - this.camH;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.camH += dh * Math.min(1, dt * 5);
    }
    ctx.save();
    if (this.opts.camera === 'rotate') {
      ctx.translate(this.w / 2, this.h * 0.79);
      ctx.scale(this.zoom, this.zoom);
      ctx.rotate(-this.camH - Math.PI / 2);
    } else {
      ctx.translate(this.w / 2, this.h / 2);
      ctx.scale(this.zoom, this.zoom);
    }
    ctx.translate(-this.camX, -this.camY);
    const viewR = (Math.hypot(this.w, this.h) / this.zoom) * 0.75;
    const vis = (x: number, y: number, r = 0) => Math.abs(x - this.camX) < viewR + r && Math.abs(y - this.camY) < viewR + r;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const hw = g.halfWidth;
    const wall = hw + this.track.runoff;

    // Auslaufzone
    ctx.strokeStyle = this.track.street ? '#565f66' : cols.runoff;
    ctx.lineWidth = wall * 2;
    ctx.stroke(this.paths.runoff);
    // Boxengasse
    ctx.strokeStyle = '#3a3f45';
    ctx.lineWidth = 8;
    ctx.stroke(this.paths.pitLane);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.25;
    ctx.setLineDash([2, 2]);
    ctx.stroke(this.paths.pitLane);
    ctx.setLineDash([]);
    // Streckenbelag
    ctx.strokeStyle = this.track.surface;
    ctx.lineWidth = hw * 2;
    ctx.stroke(this.paths.surface);
    // Nässe
    if (eng.wetness > 0.02) {
      ctx.strokeStyle = `rgba(40,60,85,${eng.wetness * 0.45})`;
      ctx.lineWidth = hw * 2;
      ctx.stroke(this.paths.surface);
    }
    // Gummiabrieb auf der Ideallinie
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 3;
    ctx.stroke(this.paths.rubber);
    // Kanten
    ctx.strokeStyle = 'rgba(240,240,240,0.9)';
    ctx.lineWidth = 0.35;
    ctx.stroke(this.paths.edgeL);
    ctx.stroke(this.paths.edgeR);
    // Randsteine
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#e8e8e8';
    ctx.stroke(this.paths.kerbL);
    ctx.stroke(this.paths.kerbR);
    ctx.strokeStyle = '#d4232f';
    ctx.setLineDash([2.2, 2.2]);
    ctx.stroke(this.paths.kerbL);
    ctx.stroke(this.paths.kerbR);
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    // Mauern / Reifenstapel
    ctx.strokeStyle = this.track.street ? '#c9d1d6' : '#20262b';
    ctx.lineWidth = this.track.street ? 0.9 : 0.8;
    ctx.stroke(this.paths.wallL);
    ctx.stroke(this.paths.wallR);
    ctx.strokeStyle = '#c9d1d6';
    ctx.lineWidth = 0.8;
    ctx.stroke(this.paths.pitWall);

    // Bremsschilder
    for (const b of this.boards) {
      if (!vis(b.x, b.y, 10)) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      const bs = Math.max(1.4, this.carScale * 1.5);
      ctx.scale(bs, bs);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-0.9 + 0.3, -1.6 + 0.3, 1.8, 3.2);
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(-0.9, -1.6, 1.8, 3.2);
      ctx.fillStyle = b.n === 1 ? '#d4232f' : '#1b1f23';
      for (let k = 0; k < b.n; k++) ctx.fillRect(-0.7 + k * 0.55, -1.3, 0.3, 2.6);
      ctx.restore();
    }

    // Start-/Ziellinie (Schachbrett)
    {
      const p0 = pointAt(g, 0, 0);
      const a = Math.atan2(p0.ty, p0.tx);
      ctx.save();
      ctx.translate(p0.x, p0.y);
      ctx.rotate(a);
      const cells = Math.round(hw * 2);
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < cells; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#111' : '#f4f4f4';
          ctx.fillRect(-1 + r, -hw + (c * (hw * 2)) / cells, 1, (hw * 2) / cells);
        }
      ctx.restore();
      // Startplätze
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.3;
      for (let i = 0; i < 16; i++) {
        const s = g.length - 14 - i * 9;
        const lat = (i % 2 === 0 ? -1 : 1) * Math.min(3, hw - 2) * -g.turnSign;
        const p = pointAt(g, s + 3, lat);
        if (!vis(p.x, p.y, 10)) continue;
        ctx.beginPath();
        ctx.moveTo(p.x + p.nx * 1.4, p.y + p.ny * 1.4);
        ctx.lineTo(p.x - p.nx * 1.4, p.y - p.ny * 1.4);
        ctx.stroke();
      }
    }
    // Boxen
    {
      const teams = new Map<number, string>();
      for (const c of eng.cars) teams.set(c.cfg.boxIndex, c.cfg.color);
      teams.forEach((color, idx) => {
        const s = g.length - 150 + idx * 26;
        const p = pointAt(g, s, eng.pitLat + Math.sign(eng.pitLat) * 7);
        if (!vis(p.x, p.y, 20)) return;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.ty, p.tx));
        ctx.fillStyle = '#2a3036';
        ctx.fillRect(-10, -3, 20, 6);
        ctx.fillStyle = color;
        ctx.fillRect(-10, Math.sign(eng.pitLat) > 0 ? 2 : -3, 20, 1);
        ctx.restore();
      });
    }

    // Ideallinie
    if (this.opts.showLine && focus && this.lineCache.length) {
      for (const p of this.lineCache) {
        if (!vis(p.x, p.y, 4)) continue;
        ctx.fillStyle = p.brake ? 'rgba(255,70,70,0.75)' : 'rgba(80,230,140,0.55)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Reifenspuren
    ctx.strokeStyle = 'rgba(10,10,10,0.35)';
    ctx.lineWidth = 0.35;
    for (const s of eng.skids) {
      if (s.life <= 0 || !vis(s.x, s.y)) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life));
      const cx = Math.cos(s.h), cy = Math.sin(s.h), nx = -cy, ny = cx;
      for (const side of [-0.8, 0.8]) {
        ctx.beginPath();
        ctx.moveTo(s.x - cx * 1.6 + nx * side, s.y - cy * 1.6 + ny * side);
        ctx.lineTo(s.x - cx * 0.4 + nx * side, s.y - cy * 0.4 + ny * side);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Tribünen
    for (const st of this.scenery.stands) {
      if (!vis(st.x, st.y, 30)) continue;
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.a);
      ctx.fillStyle = '#59626b';
      ctx.fillRect(-st.w / 2, -st.h / 2, st.w, st.h);
      ctx.fillStyle = '#7d8790';
      for (let r = 0; r < 3; r++) ctx.fillRect(-st.w / 2 + 1, -st.h / 2 + 1 + r * 2.7, st.w - 2, 1.2);
      ctx.restore();
    }

    // Fahrzeuge
    const order = [...eng.cars].sort((a, b) => (a === focus ? 1 : 0) - (b === focus ? 1 : 0));
    for (const c of order) {
      if (!vis(c.x, c.y, 8)) continue;
      // Gischt bei Nässe
      if (eng.wetness > 0.2 && c.speed > 20 && this.opts.quality === 'high') {
        ctx.fillStyle = `rgba(210,220,230,${Math.min(0.22, eng.wetness * 0.25)})`;
        for (let k = 1; k <= 3; k++) {
          const d = 3 + k * 2.5;
          ctx.beginPath();
          ctx.arc(c.x - Math.cos(c.h) * d, c.y - Math.sin(c.h) * d, 1.2 + k * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      drawCar(ctx, c, c === focus, this.carScale);
    }

    // Funken
    ctx.fillStyle = '#ffd36b';
    for (const sp of eng.sparks) {
      ctx.globalAlpha = Math.max(0, sp.life * 2);
      ctx.fillRect(sp.x - 0.15, sp.y - 0.15, 0.3, 0.3);
    }
    ctx.globalAlpha = 1;

    // Bäume (über Autos, aber nie auf der Strecke)
    for (const t of this.scenery.trees) {
      if (!vis(t.x, t.y, 10)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(t.x + 1.2, t.y + 1.2, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.c;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Namensschilder
    ctx.save();
    for (const c of eng.cars) {
      if (!vis(c.x, c.y, 8) || c.dnf) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (this.opts.camera === 'rotate') ctx.rotate(this.camH + Math.PI / 2);
      ctx.scale(1 / this.zoom, 1 / this.zoom);
      ctx.font = '600 11px "Chivo Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      const label = c.cfg.short;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = c === focus ? 'rgba(255,255,255,0.92)' : 'rgba(10,14,18,0.7)';
      ctx.fillRect(-tw / 2, -34, tw, 15);
      ctx.fillStyle = c === focus ? '#0b0f12' : '#e8eef1';
      ctx.fillText(label, 0, -23);
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();

    // Regen im Bildschirmraum
    if (eng.wetness > 0.05 && eng.weatherNow !== 'sunny' && eng.weatherNow !== 'cloudy') {
      const intensity = eng.weatherNow === 'heavyRain' ? 1 : 0.5;
      ctx.strokeStyle = 'rgba(200,215,235,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const n = Math.round(this.rainDrops.length * intensity);
      for (let i = 0; i < n; i++) {
        const d = this.rainDrops[i];
        d.y += dt * (1.6 + d.l);
        d.x -= dt * 0.15;
        if (d.y > 1) {
          d.y = 0;
          d.x = Math.random();
        }
        if (d.x < 0) d.x += 1;
        const x = d.x * this.w;
        const y = d.y * this.h;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 12 * d.l);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(30,40,55,${0.15 * intensity})`;
      ctx.fillRect(0, 0, this.w, this.h);
    } else if (eng.weatherNow === 'cloudy') {
      ctx.fillStyle = 'rgba(20,28,36,0.12)';
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  // Minikarte in einen eigenen Canvas zeichnen
  renderMini(canvas: HTMLCanvasElement, focus: CarSim | null) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const g = this.geo;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(r.width * dpr)) {
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pad = 10 * dpr;
    const sw = g.maxX - g.minX;
    const sh = g.maxY - g.minY;
    const sc = Math.min((canvas.width - pad * 2) / sw, (canvas.height - pad * 2) / sh);
    const ox = (canvas.width - sw * sc) / 2 - g.minX * sc;
    const oy = (canvas.height - sh * sc) / 2 - g.minY * sc;
    ctx.setTransform(sc, 0, 0, sc, ox, oy);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 9 / sc;
    ctx.stroke(this.paths.mini);
    ctx.strokeStyle = 'rgba(232,238,241,0.85)';
    ctx.lineWidth = 2.6 / sc;
    ctx.stroke(this.paths.mini);
    const p0 = pointAt(g, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(p0.x - 3 / sc, p0.y - 6 / sc, 6 / sc, 12 / sc);
    for (const c of this.eng.cars) {
      if (c.dnf) continue;
      ctx.fillStyle = c.cfg.color;
      ctx.strokeStyle = c === focus ? '#fff' : 'rgba(0,0,0,0.6)';
      ctx.lineWidth = (c === focus ? 2.5 : 1) / sc;
      ctx.beginPath();
      ctx.arc(c.x, c.y, (c === focus ? 6 : 4) / sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function sm(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function drawCar(ctx: CanvasRenderingContext2D, c: CarSim, focus: boolean, scale = 1) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.h);
  ctx.scale(scale, scale);
  const col = c.cfg.color;
  const col2 = c.cfg.color2;
  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-2.3, -0.85, 4.9, 1.9);
  if (focus) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Räder
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(1.15, -1.0, 0.85, 0.42);
  ctx.fillRect(1.15, 0.58, 0.85, 0.42);
  ctx.fillRect(-1.95, -1.05, 1.0, 0.48);
  ctx.fillRect(-1.95, 0.57, 1.0, 0.48);
  // Heckflügel
  ctx.fillStyle = col2;
  ctx.fillRect(-2.35, -0.78, 0.38, 1.56);
  // Frontflügel (bei Schaden kleiner)
  const fw = 1 - c.damage.frontWing * 0.6;
  ctx.fillStyle = col2;
  ctx.fillRect(2.15, -0.92 * fw, 0.32, 1.84 * fw);
  // Chassis
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
  // Streifen
  ctx.fillStyle = col2;
  ctx.fillRect(-1.6, -0.1, 3.6, 0.2);
  // Cockpit
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(-0.1, 0, 0.45, 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  // Helm
  ctx.fillStyle = focus ? '#fff' : col2;
  ctx.beginPath();
  ctx.arc(-0.05, 0, 0.17, 0, Math.PI * 2);
  ctx.fill();
  // Bremslicht
  if (c.brake > 0.2) {
    ctx.fillStyle = '#ff2b2b';
    ctx.fillRect(-2.42, -0.12, 0.12, 0.24);
  }
  if (c.boost) {
    ctx.fillStyle = 'rgba(120,200,255,0.8)';
    ctx.fillRect(-2.9, -0.15, 0.5, 0.3);
  }
  ctx.restore();
}
