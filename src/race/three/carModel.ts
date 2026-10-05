// Low-Poly-Rennwagen aus einfachen Formen. Karosserie und Frontflügel haben Vertexfarben (Teamfarben),
// Räder sind eigene Gruppen, damit sie sich drehen und einlenken können.
import * as THREE from 'three';

interface Sec {
  x: number;
  yb: number;
  yt: number;
  hw: number;
  zc?: number;
}

class Acc {
  pos: number[] = [];
  col: number[] = [];

  private tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, center: THREE.Vector3, color: THREE.Color) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(center);
    if (n.dot(mid) < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) {
      this.pos.push(p.x, p.y, p.z);
      this.col.push(color.r, color.g, color.b);
    }
  }

  /** Körper aus Querschnitten (Loft); jede Fläche zeigt nach außen */
  loft(secs: Sec[], hex: string) {
    const color = new THREE.Color(hex);
    const ring = secs.map((s) => {
      const zc = s.zc ?? 0;
      return [
        new THREE.Vector3(s.x, s.yb, zc - s.hw),
        new THREE.Vector3(s.x, s.yb, zc + s.hw),
        new THREE.Vector3(s.x, s.yt, zc + s.hw),
        new THREE.Vector3(s.x, s.yt, zc - s.hw),
      ];
    });
    const center = new THREE.Vector3();
    for (const s of secs) center.add(new THREE.Vector3(s.x, (s.yb + s.yt) / 2, s.zc ?? 0));
    center.multiplyScalar(1 / secs.length);
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        this.tri(a[k], a[k2], b[k], center, color);
        this.tri(a[k2], b[k2], b[k], center, color);
      }
    }
    const cap = (r: THREE.Vector3[]) => {
      this.tri(r[0], r[1], r[2], center, color);
      this.tri(r[0], r[2], r[3], center, color);
    };
    cap(ring[0]);
    cap(ring[ring.length - 1]);
  }

  box(x0: number, x1: number, yb: number, yt: number, zc: number, hw: number, hex: string) {
    this.loft([{ x: x0, yb, yt, hw, zc }, { x: x1, yb, yt, hw, zc }], hex);
  }

  /** Dünner Stab zwischen zwei Punkten */
  bar(a: [number, number, number], b: [number, number, number], t: number, hex: string) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const geo = new THREE.BoxGeometry(len, t, t).toNonIndexed();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), vb.clone().sub(va).normalize());
    m.compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    const p = geo.getAttribute('position');
    const color = new THREE.Color(hex);
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.col.push(color.r, color.g, color.b);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

export interface Wheel {
  root: THREE.Group;
  steer: THREE.Group;
  spin: THREE.Group;
  ring: THREE.Mesh;
  radius: number;
  front: boolean;
}

export interface CarParts {
  root: THREE.Group;
  tilt: THREE.Group;
  body: THREE.Mesh;
  wing: THREE.Mesh;
  helmet: THREE.Mesh;
  brakeLight: THREE.Mesh;
  flame: THREE.Mesh;
  blob: THREE.Mesh;
  wheels: Wheel[];
  ringColor: string;
  dispose: () => void;
}

export interface SharedCarAssets {
  bodyMat: THREE.MeshStandardMaterial;
  tireMat: THREE.MeshStandardMaterial;
  rimMat: THREE.MeshStandardMaterial;
  spokeMat: THREE.MeshStandardMaterial;
  blobMat: THREE.MeshBasicMaterial;
  flameMat: THREE.MeshBasicMaterial;
  tireGeo: Record<'front' | 'rear', THREE.CylinderGeometry>;
  rimGeo: Record<'front' | 'rear', THREE.CylinderGeometry>;
  ringGeo: Record<'front' | 'rear', THREE.RingGeometry>;
  spokeGeo: Record<'front' | 'rear', THREE.BufferGeometry>;
  helmetGeo: THREE.SphereGeometry;
  blobGeo: THREE.PlaneGeometry;
  flameGeo: THREE.ConeGeometry;
  lightGeo: THREE.BoxGeometry;
  dispose: () => void;
}

const DIM = {
  front: { r: 0.33, w: 0.36, x: 1.55, z: 0.84 },
  rear: { r: 0.36, w: 0.46, x: -1.5, z: 0.85 },
};

export function makeSharedAssets(softDot: THREE.Texture): SharedCarAssets {
  const tireGeo = {} as SharedCarAssets['tireGeo'];
  const rimGeo = {} as SharedCarAssets['rimGeo'];
  const ringGeo = {} as SharedCarAssets['ringGeo'];
  const spokeGeo = {} as SharedCarAssets['spokeGeo'];
  for (const k of ['front', 'rear'] as const) {
    const d = DIM[k];
    const t = new THREE.CylinderGeometry(d.r, d.r, d.w, 22);
    t.rotateX(Math.PI / 2);
    tireGeo[k] = t;
    const r = new THREE.CylinderGeometry(d.r * 0.64, d.r * 0.64, d.w + 0.03, 16);
    r.rotateX(Math.PI / 2);
    rimGeo[k] = r;
    ringGeo[k] = new THREE.RingGeometry(d.r * 0.7, d.r * 0.93, 24);
    // drei Speichen als Drehmarke
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.BoxGeometry(d.r * 1.22, 0.05, 0.02);
      b.rotateZ((i * Math.PI) / 3);
      parts.push(b.toNonIndexed());
    }
    const merged = new THREE.BufferGeometry();
    const pos: number[] = [];
    for (const p of parts) {
      const a = p.getAttribute('position');
      for (let i = 0; i < a.count; i++) pos.push(a.getX(i), a.getY(i), a.getZ(i));
    }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.computeVertexNormals();
    spokeGeo[k] = merged;
  }
  const helmetGeo = new THREE.SphereGeometry(0.15, 12, 8);
  const blobGeo = new THREE.PlaneGeometry(6.4, 3.2);
  blobGeo.rotateX(-Math.PI / 2);
  const flameGeo = new THREE.ConeGeometry(0.16, 1.5, 8);
  flameGeo.rotateZ(Math.PI / 2); // Spitze nach hinten (−x)
  flameGeo.translate(-0.75, 0, 0);
  const lightGeo = new THREE.BoxGeometry(0.05, 0.13, 0.34);
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.25 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.92, metalness: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#9aa3aa', roughness: 0.35, metalness: 0.8 });
  const spokeMat = new THREE.MeshStandardMaterial({ color: '#2a2e32', roughness: 0.6, metalness: 0.3 });
  const blobMat = new THREE.MeshBasicMaterial({ map: softDot, color: '#000000', transparent: true, opacity: 0.5, depthWrite: false });
  const flameMat = new THREE.MeshBasicMaterial({ color: '#7fc4ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  return {
    bodyMat, tireMat, rimMat, spokeMat, blobMat, flameMat, tireGeo, rimGeo, ringGeo, spokeGeo, helmetGeo, blobGeo, flameGeo, lightGeo,
    dispose() {
      for (const k of ['front', 'rear'] as const) {
        tireGeo[k].dispose();
        rimGeo[k].dispose();
        ringGeo[k].dispose();
        spokeGeo[k].dispose();
      }
      helmetGeo.dispose();
      blobGeo.dispose();
      flameGeo.dispose();
      lightGeo.dispose();
      bodyMat.dispose();
      tireMat.dispose();
      rimMat.dispose();
      spokeMat.dispose();
      blobMat.dispose();
      flameMat.dispose();
    },
  };
}

const CARBON = '#1a1d20';

export function buildCar(col: string, col2: string, assets: SharedCarAssets): CarParts {
  const acc = new Acc();
  // Monocoque mit Nase
  const tub: Sec[] = [
    { x: 2.45, yb: 0.2, yt: 0.33, hw: 0.07 },
    { x: 1.75, yb: 0.17, yt: 0.46, hw: 0.16 },
    { x: 1.1, yb: 0.14, yt: 0.6, hw: 0.3 },
    { x: 0.35, yb: 0.14, yt: 0.64, hw: 0.34 },
    { x: -0.45, yb: 0.14, yt: 0.74, hw: 0.32 },
    { x: -1.3, yb: 0.15, yt: 0.62, hw: 0.24 },
    { x: -2.05, yb: 0.22, yt: 0.42, hw: 0.13 },
  ];
  acc.loft(tub, col);
  // Längsstreifen in der Zweitfarbe auf Nase und Cockpit
  acc.loft(tub.slice(0, 5).map((s) => ({ x: s.x, yb: s.yt - 0.02, yt: s.yt + 0.012, hw: Math.max(0.025, s.hw * 0.2) })), col2);
  // Seitenkästen
  for (const side of [-1, 1]) {
    acc.loft(
      [
        { x: 0.6, yb: 0.14, yt: 0.36, hw: 0.04, zc: side * 0.46 },
        { x: 0.1, yb: 0.12, yt: 0.52, hw: 0.2, zc: side * 0.58 },
        { x: -1.1, yb: 0.12, yt: 0.46, hw: 0.2, zc: side * 0.56 },
        { x: -1.85, yb: 0.14, yt: 0.3, hw: 0.08, zc: side * 0.4 },
      ],
      col,
    );
    // Lufteinlass dunkel
    acc.box(0.12, 0.34, 0.28, 0.46, side * 0.78, 0.01, CARBON);
  }
  // Airbox und Motorabdeckung
  acc.loft(
    [
      { x: -0.2, yb: 0.6, yt: 0.8, hw: 0.12 },
      { x: -0.5, yb: 0.62, yt: 1.02, hw: 0.17 },
      { x: -0.85, yb: 0.6, yt: 0.9, hw: 0.15 },
      { x: -1.7, yb: 0.45, yt: 0.58, hw: 0.07 },
    ],
    col,
  );
  // Boden und Diffusor
  acc.loft([{ x: -2.15, yb: 0.07, yt: 0.12, hw: 0.3 }, { x: -1.4, yb: 0.07, yt: 0.12, hw: 0.7 }, { x: 1.2, yb: 0.07, yt: 0.12, hw: 0.7 }, { x: 2.0, yb: 0.07, yt: 0.12, hw: 0.3 }], CARBON);
  // Heckflügel
  acc.box(-2.5, -2.12, 0.9, 0.95, 0, 0.8, col2);
  acc.box(-2.4, -2.18, 0.99, 1.02, 0, 0.78, col);
  acc.box(-2.6, -2.05, 0.46, 1.04, 0.8, 0.012, col);
  acc.box(-2.6, -2.05, 0.46, 1.04, -0.8, 0.012, col);
  acc.box(-2.3, -2.2, 0.42, 0.92, 0, 0.04, CARBON);
  // Aufhängung
  const arm = (x: number, y: number, z: number, s: number) => {
    acc.bar([x, y, s * 0.3], [x + 0.05, y + 0.02, s * z], 0.035, CARBON);
    acc.bar([x - 0.3, y + 0.1, s * 0.32], [x + 0.02, y + 0.08, s * z], 0.03, CARBON);
  };
  for (const s of [-1, 1]) {
    arm(1.52, 0.28, 0.72, s);
    arm(-1.5, 0.3, 0.74, s);
  }
  // Halo
  acc.bar([0.1, 0.7, 0.3], [0.65, 0.96, 0.13], 0.05, CARBON);
  acc.bar([0.1, 0.7, -0.3], [0.65, 0.96, -0.13], 0.05, CARBON);
  acc.bar([0.65, 0.96, 0.13], [0.8, 0.84, 0], 0.05, CARBON);
  acc.bar([0.65, 0.96, -0.13], [0.8, 0.84, 0], 0.05, CARBON);
  acc.bar([0.8, 0.84, 0], [0.92, 0.6, 0], 0.05, CARBON);
  const body = new THREE.Mesh(acc.geometry(), assets.bodyMat);
  body.castShadow = true;

  // Frontflügel als eigenes Teil (Schäden)
  const wa = new Acc();
  wa.box(2.32, 2.64, 0.1, 0.145, 0, 0.98, col2);
  wa.box(2.16, 2.42, 0.18, 0.21, 0, 0.92, col);
  wa.box(2.1, 2.66, 0.08, 0.32, 0.985, 0.012, col);
  wa.box(2.1, 2.66, 0.08, 0.32, -0.985, 0.012, col);
  wa.box(1.9, 2.4, 0.13, 0.22, 0, 0.05, CARBON);
  const wing = new THREE.Mesh(wa.geometry(), assets.bodyMat);
  wing.castShadow = true;

  const root = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(tilt);
  tilt.add(body, wing);

  const helmetMat = new THREE.MeshStandardMaterial({ color: col2, roughness: 0.3, metalness: 0.2 });
  const helmet = new THREE.Mesh(assets.helmetGeo, helmetMat);
  helmet.position.set(0.28, 0.8, 0);
  helmet.scale.set(1.1, 1, 0.95);
  tilt.add(helmet);

  const lightMat = new THREE.MeshBasicMaterial({ color: '#4a0a0a' });
  const brakeLight = new THREE.Mesh(assets.lightGeo, lightMat);
  brakeLight.position.set(-2.12, 0.52, 0);
  tilt.add(brakeLight);

  const flame = new THREE.Mesh(assets.flameGeo, assets.flameMat);
  flame.position.set(-2.4, 0.44, 0);
  flame.visible = false;
  tilt.add(flame);

  const wheels: Wheel[] = [];
  for (const k of ['front', 'rear'] as const) {
    const d = DIM[k];
    for (const s of [-1, 1]) {
      const wroot = new THREE.Group();
      wroot.position.set(d.x, d.r, s * d.z);
      const steer = new THREE.Group();
      const spin = new THREE.Group();
      wroot.add(steer);
      steer.add(spin);
      spin.add(new THREE.Mesh(assets.tireGeo[k], assets.tireMat));
      spin.add(new THREE.Mesh(assets.rimGeo[k], assets.rimMat));
      const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', side: THREE.DoubleSide });
      const ring = new THREE.Mesh(assets.ringGeo[k], ringMat);
      ring.position.z = s * (d.w / 2 + 0.004);
      spin.add(ring);
      const spokes = new THREE.Mesh(assets.spokeGeo[k], assets.spokeMat);
      spokes.position.z = s * (d.w / 2 + 0.02);
      spin.add(spokes);
      tilt.add(wroot);
      wheels.push({ root: wroot, steer, spin, ring, radius: d.r, front: k === 'front' });
    }
  }
  for (const w of wheels) (w.spin.children[0] as THREE.Mesh).castShadow = true;

  const blob = new THREE.Mesh(assets.blobGeo, assets.blobMat);
  blob.position.y = 0.03;
  blob.renderOrder = 1;
  root.add(blob);

  return {
    root, tilt, body, wing, helmet, brakeLight, flame, blob, wheels, ringColor: '',
    dispose() {
      body.geometry.dispose();
      wing.geometry.dispose();
      helmetMat.dispose();
      lightMat.dispose();
      for (const w of wheels) (w.ring.material as THREE.Material).dispose();
    },
  };
}
