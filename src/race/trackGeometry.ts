// Streckengeometrie: geschlossene Catmull-Rom-Kurve, gleichmäßig abgetastet,
// mit Normalen, Krümmung, Ideallinie und schnellen Nachbarschaftsabfragen.

export interface TrackGeometry {
  n: number;
  ds: number;
  length: number;
  x: Float32Array;
  y: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  k: Float32Array; // geglättete Krümmung der Mittellinie
  lineOff: Float32Array; // seitlicher Versatz der Ideallinie
  lineK: Float32Array; // Krümmung der Ideallinie (Betrag mit Vorzeichen)
  halfWidth: number;
  runoff: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  turnSign: number; // +1 = Strecke überwiegend Linkskurven (Innenseite = +Normale)
}

type P = [number, number];

function catmullRom(p0: P, p1: P, p2: P, p3: P, t: number): P {
  // Zentripetale Catmull-Rom (alpha = 0.5) vermeidet Schleifen
  const alpha = 0.5;
  const d = (a: P, b: P) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-3, alpha);
  const t0 = 0;
  const t1 = t0 + d(p0, p1);
  const t2 = t1 + d(p1, p2);
  const t3 = t2 + d(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const lerp = (a: P, b: P, ta: number, tb: number): P => {
    const f = (tt - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  const a1 = lerp(p0, p1, t0, t1);
  const a2 = lerp(p1, p2, t1, t2);
  const a3 = lerp(p2, p3, t2, t3);
  const b1 = lerp(a1, a2, t0, t2);
  const b2 = lerp(a2, a3, t1, t3);
  return lerp(b1, b2, t1, t2);
}

// Strecke als geschlossenes Polygon mit abgerundeten Ecken: [x, y, radius].
// Start/Ziel liegt auf der Kante v0 -> v1 (Start-Ziel-Gerade).
export type Vertex = [number, number, number];

export function compilePolygon(verts: Vertex[], startFrac = 0.5, step = 4): P[] {
  const m = verts.length;
  const corners = verts.map((v, i) => {
    const p = verts[(i - 1 + m) % m];
    const q = verts[(i + 1) % m];
    const lin = Math.hypot(v[0] - p[0], v[1] - p[1]);
    const lout = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const din: P = [(v[0] - p[0]) / lin, (v[1] - p[1]) / lin];
    const dout: P = [(q[0] - v[0]) / lout, (q[1] - v[1]) / lout];
    const dot = Math.max(-1, Math.min(1, din[0] * dout[0] + din[1] * dout[1]));
    const theta = Math.acos(dot);
    const cross = din[0] * dout[1] - din[1] * dout[0];
    const side = cross >= 0 ? 1 : -1;
    let r = v[2];
    let t = theta < 1e-3 ? 0 : r * Math.tan(theta / 2);
    const maxT = 0.48 * Math.min(lin, lout);
    if (t > maxT) {
      t = maxT;
      r = t / Math.tan(theta / 2);
    }
    const A: P = [v[0] - din[0] * t, v[1] - din[1] * t];
    const B: P = [v[0] + dout[0] * t, v[1] + dout[1] * t];
    const C: P = [A[0] - din[1] * r * side, A[1] + din[0] * r * side];
    return { A, B, C, r, theta, side };
  });
  const pts: P[] = [];
  let startIdx = 0;
  for (let i = 0; i < m; i++) {
    const c = corners[i];
    const nxt = corners[(i + 1) % m];
    // Bogen um Ecke i
    if (c.theta > 1e-3) {
      const a0 = Math.atan2(c.A[1] - c.C[1], c.A[0] - c.C[0]);
      const cnt = Math.max(2, Math.ceil((c.r * c.theta) / step));
      for (let k = 0; k < cnt; k++) {
        const a = a0 + (c.side * c.theta * k) / cnt;
        pts.push([c.C[0] + Math.cos(a) * c.r, c.C[1] + Math.sin(a) * c.r]);
      }
    }
    // Gerade von B_i nach A_{i+1}
    const dx = nxt.A[0] - c.B[0];
    const dy = nxt.A[1] - c.B[1];
    const len = Math.hypot(dx, dy);
    const cnt = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < cnt; k++) {
      if (i === 0 && k === Math.round(cnt * startFrac)) startIdx = pts.length;
      pts.push([c.B[0] + (dx * k) / cnt, c.B[1] + (dy * k) / cnt]);
    }
  }
  return [...pts.slice(startIdx), ...pts.slice(0, startIdx)];
}

// Streckenbeschreibung als Folge aus Geraden und Bögen ("Turtle").
// ['S', länge] | ['R', radius, grad] (im Uhrzeigersinn) | ['L', radius, grad]
export type Seg = ['S', number] | ['R', number, number] | ['L', number, number];

function endPose(segs: Seg[]) {
  let x = 0, y = 0, h = 0;
  const straightHeadings: number[] = [];
  for (const seg of segs) {
    if (seg[0] === 'S') {
      straightHeadings.push(h);
      x += Math.cos(h) * seg[1];
      y += Math.sin(h) * seg[1];
    } else {
      const r = seg[1];
      const ang = ((seg[2] * Math.PI) / 180) * (seg[0] === 'R' ? 1 : -1);
      // Sehne des Bogens
      const chord = 2 * r * Math.sin(Math.abs(ang) / 2);
      x += Math.cos(h + ang / 2) * chord;
      y += Math.sin(h + ang / 2) * chord;
      h += ang;
    }
  }
  return { x, y, straightHeadings };
}

// Schließt die Strecke exakt, indem zwei Geraden in der Länge angepasst werden.
function closeLayout(segs: Seg[]): Seg[] {
  const { x: ex, y: ey, straightHeadings } = endPose(segs);
  const idx: number[] = [];
  segs.forEach((s, i) => s[0] === 'S' && idx.push(i));
  let best: { i: number; j: number; a: number; b: number; score: number } | null = null;
  for (let p = 0; p < idx.length; p++) {
    for (let q = p + 1; q < idx.length; q++) {
      const hi = straightHeadings[p];
      const hj = straightHeadings[q];
      const dix = Math.cos(hi), diy = Math.sin(hi), djx = Math.cos(hj), djy = Math.sin(hj);
      const det = dix * djy - diy * djx;
      if (Math.abs(det) < 0.35) continue;
      const a = (-ex * djy + ey * djx) / det;
      const b = (dix * -ey - diy * -ex) / det;
      const li = (segs[idx[p]] as ['S', number])[1] + a;
      const lj = (segs[idx[q]] as ['S', number])[1] + b;
      if (li < 50 || lj < 50) continue;
      const score = Math.abs(a) + Math.abs(b) + (p === 0 ? 400 : 0);
      if (!best || score < best.score) best = { i: idx[p], j: idx[q], a, b, score };
    }
  }
  if (!best) return segs;
  const out = segs.map((s) => [...s] as Seg);
  (out[best.i] as ['S', number])[1] += best.a;
  (out[best.j] as ['S', number])[1] += best.b;
  return out;
}

export function compileSegments(rawSegs: Seg[], step = 8): P[] {
  const segs = closeLayout(rawSegs);
  let x = 0, y = 0, h = 0;
  const pts: P[] = [[0, 0]];
  const lens: number[] = [0];
  let total = 0;
  const push = () => {
    pts.push([x, y]);
    total += step;
    lens.push(total);
  };
  for (const seg of segs) {
    if (seg[0] === 'S') {
      const cnt = Math.max(1, Math.round(seg[1] / step));
      const l = seg[1] / cnt;
      for (let i = 0; i < cnt; i++) {
        x += Math.cos(h) * l;
        y += Math.sin(h) * l;
        push();
      }
    } else {
      const r = seg[1];
      const ang = (seg[2] * Math.PI) / 180;
      const dir = seg[0] === 'R' ? 1 : -1;
      const len = r * ang;
      const cnt = Math.max(2, Math.round(len / step));
      const da = (ang / cnt) * dir;
      const l = 2 * r * Math.sin(ang / cnt / 2);
      for (let i = 0; i < cnt; i++) {
        h += da / 2;
        x += Math.cos(h) * l;
        y += Math.sin(h) * l;
        h += da / 2;
        push();
      }
    }
  }
  // Schließfehler gleichmäßig verteilen
  const ex = x, ey = y;
  pts.pop();
  lens.pop();
  return pts.map((p, i) => [p[0] - (ex * lens[i]) / total, p[1] - (ey * lens[i]) / total]);
}

export function wrapIndex(i: number, n: number): number {
  i %= n;
  return i < 0 ? i + n : i;
}

export function buildTrack(points: P[], halfWidth: number, runoff: number, ds = 2): TrackGeometry {
  const m = points.length;
  const dense: P[] = [];
  const sub = 48;
  for (let i = 0; i < m; i++) {
    const p0 = points[(i - 1 + m) % m];
    const p1 = points[i];
    const p2 = points[(i + 1) % m];
    const p3 = points[(i + 2) % m];
    for (let s = 0; s < sub; s++) dense.push(catmullRom(p0, p1, p2, p3, s / sub));
  }
  // kumulative Bogenlänge
  const cum: number[] = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[cum.length - 1];
  const n = Math.round(total / ds);
  const realDs = total / n;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = i * realDs;
    while (j < dense.length - 1 && cum[j + 1] < s) j++;
    const a = dense[j];
    const b = dense[(j + 1) % dense.length];
    const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    x[i] = a[0] + (b[0] - a[0]) * f;
    y[i] = a[1] + (b[1] - a[1]) * f;
  }
  const tx = new Float32Array(n);
  const ty = new Float32Array(n);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = wrapIndex(i - 1, n);
    const b = wrapIndex(i + 1, n);
    const dx = x[b] - x[a];
    const dy = y[b] - y[a];
    const l = Math.hypot(dx, dy) || 1;
    tx[i] = dx / l;
    ty[i] = dy / l;
    nx[i] = -ty[i];
    ny[i] = tx[i];
  }
  const kRaw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    kRaw[i] = curvature3(x, y, wrapIndex(i - 3, n), i, wrapIndex(i + 3, n));
  }
  const k = smooth(kRaw, 4);
  let sumK = 0;
  for (let i = 0; i < n; i++) sumK += k[i];
  const turnSign = sumK >= 0 ? 1 : -1;

  const { lineOff, lineK } = computeRacingLine(x, y, nx, ny, n, realDs, halfWidth);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, x[i]);
    minY = Math.min(minY, y[i]);
    maxX = Math.max(maxX, x[i]);
    maxY = Math.max(maxY, y[i]);
  }
  return { n, ds: realDs, length: total, x, y, tx, ty, nx, ny, k, lineOff, lineK, halfWidth, runoff, minX, minY, maxX, maxY, turnSign };
}

function curvature3(x: ArrayLike<number>, y: ArrayLike<number>, a: number, b: number, c: number): number {
  const ax = x[a], ay = y[a], bx = x[b], by = y[b], cx = x[c], cy = y[c];
  const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const ab = Math.hypot(bx - ax, by - ay);
  const bc = Math.hypot(cx - bx, cy - by);
  const ca = Math.hypot(ax - cx, ay - cy);
  const den = ab * bc * ca;
  return den < 1e-6 ? 0 : (2 * cross) / den;
}

function smooth(arr: Float32Array, radius: number, passes = 2): Float32Array {
  const n = arr.length;
  let src = arr;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let d = -radius; d <= radius; d++) s += src[wrapIndex(i + d, n)];
      out[i] = s / (2 * radius + 1);
    }
    src = out;
  }
  return src;
}

// Ideallinie über ein "elastisches Band": Punkte werden zur Mitte ihrer Nachbarn
// gezogen (minimiert Krümmung) und dabei auf die Streckenbreite begrenzt.
function computeRacingLine(x: Float32Array, y: Float32Array, nx: Float32Array, ny: Float32Array, n: number, ds: number, halfWidth: number) {
  const step = Math.max(1, Math.round(6 / ds));
  const m = Math.floor(n / step);
  const off = new Float32Array(m);
  const limit = halfWidth - 1.6;
  const cx = new Float32Array(m), cy = new Float32Array(m), cnx = new Float32Array(m), cny = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const s = i * step;
    cx[i] = x[s]; cy[i] = y[s]; cnx[i] = nx[s]; cny[i] = ny[s];
  }
  for (let it = 0; it < 900; it++) {
    for (let i = 0; i < m; i++) {
      const a = wrapIndex(i - 2, m);
      const b = wrapIndex(i + 2, m);
      const px = cx[i] + cnx[i] * off[i];
      const py = cy[i] + cny[i] * off[i];
      const ax = cx[a] + cnx[a] * off[a];
      const ay = cy[a] + cny[a] * off[a];
      const bx = cx[b] + cnx[b] * off[b];
      const by = cy[b] + cny[b] * off[b];
      const mx = (ax + bx) / 2 - px;
      const my = (ay + by) / 2 - py;
      let o = off[i] + (mx * cnx[i] + my * cny[i]) * 0.6;
      if (o > limit) o = limit;
      if (o < -limit) o = -limit;
      off[i] = o;
    }
  }
  // auf volle Auflösung interpolieren
  const lineOff = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / step;
    const a = Math.floor(f) % m;
    const b = (a + 1) % m;
    const t = f - Math.floor(f);
    lineOff[i] = off[a] * (1 - t) + off[b] * t;
  }
  const lx = new Float32Array(n), ly = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    lx[i] = x[i] + nx[i] * lineOff[i];
    ly[i] = y[i] + ny[i] * lineOff[i];
  }
  const kk = new Float32Array(n);
  for (let i = 0; i < n; i++) kk[i] = curvature3(lx, ly, wrapIndex(i - 5, n), i, wrapIndex(i + 5, n));
  const lineK = smooth(kk, 3);
  return { lineOff, lineK };
}

// Nächster Abtastpunkt, lokal gesucht ab einem Hinweisindex
export function nearestIndex(g: TrackGeometry, px: number, py: number, hint: number, range = 30): number {
  let best = hint;
  let bestD = Infinity;
  for (let d = -range; d <= range; d++) {
    const i = wrapIndex(hint + d, g.n);
    const dx = px - g.x[i];
    const dy = py - g.y[i];
    const dd = dx * dx + dy * dy;
    if (dd < bestD) {
      bestD = dd;
      best = i;
    }
  }
  return best;
}

export function nearestIndexGlobal(g: TrackGeometry, px: number, py: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < g.n; i++) {
    const dx = px - g.x[i];
    const dy = py - g.y[i];
    const dd = dx * dx + dy * dy;
    if (dd < bestD) {
      bestD = dd;
      best = i;
    }
  }
  return best;
}

// Position auf der Strecke für Bogenlänge s und seitlichen Versatz
export function pointAt(g: TrackGeometry, s: number, lateral: number) {
  const f = (((s % g.length) + g.length) % g.length) / g.ds;
  const a = Math.floor(f) % g.n;
  const b = (a + 1) % g.n;
  const t = f - Math.floor(f);
  const x = g.x[a] + (g.x[b] - g.x[a]) * t;
  const y = g.y[a] + (g.y[b] - g.y[a]) * t;
  const nx = g.nx[a] + (g.nx[b] - g.nx[a]) * t;
  const ny = g.ny[a] + (g.ny[b] - g.ny[a]) * t;
  const tx = g.tx[a] + (g.tx[b] - g.tx[a]) * t;
  const ty = g.ty[a] + (g.ty[b] - g.ty[a]) * t;
  return { x: x + nx * lateral, y: y + ny * lateral, tx, ty, nx, ny };
}

// Mindestkurvenradius (für Validierung/Statistik)
export function trackMetrics(g: TrackGeometry) {
  let minR = Infinity;
  let straight = 0;
  let corners = 0;
  let inCorner = false;
  let slow = 0;
  for (let i = 0; i < g.n; i++) {
    const ak = Math.abs(g.lineK[i]);
    if (ak > 1e-5) minR = Math.min(minR, 1 / ak);
    if (ak < 1 / 400) straight++;
    const c = ak > 1 / 150;
    if (c && !inCorner) {
      corners++;
      if (ak > 1 / 60) slow++;
    }
    inCorner = c;
  }
  return { minR, straightPct: straight / g.n, corners, slow };
}
