// 3D-Darstellung des Rennens mit three.js: tiefe Verfolgerkamera hinter dem Auto, Strecke, Randsteine, Bande,
// Boxengasse, Kulisse, Fahrzeuge, Wetter und Partikel. Die Physik bleibt in der 2D-Engine (x, y in Metern):
// Engine-Koordinate (x, y) wird zu 3D-Position (x, 0, y).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CarSim, RaceEngine } from './engine';
import { PIT } from './params';
import { nearestIndexGlobal, pointAt, wrapIndex, type TrackGeometry } from './trackGeometry';
import type { TrackDef, WeatherKind } from '../types';
import { COMPOUNDS } from '../data/catalog';
import * as T from './three/textures';
import { buildCar, makeSharedAssets, type CarParts, type SharedCarAssets } from './three/carModel';

export interface Render3DOptions {
  camera: 'chase' | 'high' | 'cockpit';
  showLine: boolean;
  quality: 'low' | 'high';
}

interface Frame {
  x: number;
  y: number;
  nx: number;
  ny: number;
}
type Prof = number | ((k: number) => number);
const ev = (p: Prof, k: number) => (typeof p === 'number' ? p : p(k));

const SCENERY: Record<TrackDef['scenery'], { ground: string; runoff: string; hill: string; trees: string[] }> = {
  park: { ground: '#4d7f3e', runoff: '#6a9456', hill: '#4a6e47', trees: ['#2f6b34', '#3a7a3a', '#2a5c30', '#4a8a40'] },
  forest: { ground: '#3b6a36', runoff: '#58804a', hill: '#2f5236', trees: ['#1d4a2a', '#245a30', '#1a3f25', '#2c5e35'] },
  harbor: { ground: '#6d767c', runoff: '#80898e', hill: '#5a6770', trees: ['#3a5a40'] },
  dry: { ground: '#b69a62', runoff: '#c8ad77', hill: '#a98c5a', trees: ['#7d8a45', '#6f7c3d', '#8a9550'] },
};

interface SkyPreset {
  top: string;
  hor: string;
  sun: number;
  hemi: number;
  fogNear: number;
  fogFar: number;
  rain: number;
  env: number;
}
const SKY: Record<WeatherKind, SkyPreset> = {
  sunny: { top: '#3d7fd6', hor: '#bddff4', sun: 2.5, hemi: 0.9, fogNear: 260, fogFar: 2400, rain: 0, env: 0.4 },
  cloudy: { top: '#7388a0', hor: '#c6ced6', sun: 1.0, hemi: 1.15, fogNear: 180, fogFar: 1900, rain: 0, env: 0.35 },
  lightRain: { top: '#5f6f80', hor: '#a5b0ba', sun: 0.55, hemi: 1.05, fogNear: 70, fogFar: 950, rain: 0.45, env: 0.3 },
  heavyRain: { top: '#454f5c', hor: '#8a949e', sun: 0.3, hemi: 0.95, fogNear: 35, fogFar: 540, rain: 1, env: 0.3 },
};

const CAM = {
  chase: { dist: 8.4, h: 2.55, look: 20, ly: 0.7, fov: 68, lag: 6 },
  high: { dist: 12.5, h: 5.6, look: 27, ly: 0.2, fov: 64, lag: 5 },
  cockpit: { dist: 0, h: 1.12, look: 40, ly: 1.0, fov: 80, lag: 30 },
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---------- Partikel ----------
class Particles {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private a0: Float32Array;
  private s0: Float32Array;
  private head = 0;
  uniforms: { uScale: { value: number } };

  constructor(private n: number, additive: boolean, private gravity: number, private grow: number) {
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n).fill(1);
    this.a0 = new Float32Array(n);
    this.s0 = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.uniforms = { uScale: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vC; varying float vA;
        void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=max(1.0, aSize*uScale/max(0.5,-mv.z)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ float d=length(gl_PointCoord-vec2(0.5)); float a=smoothstep(0.5,0.05,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(vC,a); }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, c: THREE.Color, alpha: number) {
    const i = this.head;
    this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life;
    this.s0[i] = size; this.a0[i] = alpha;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.max[i]);
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] += this.gravity * dt;
      if (this.pos[i * 3 + 1] < 0.05 && this.gravity < 0) {
        this.pos[i * 3 + 1] = 0.05;
        this.vel[i * 3 + 1] *= -0.3;
      }
      this.alpha[i] = this.a0[i] * t;
      this.size[i] = this.s0[i] * (1 + (1 - t) * this.grow);
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface CarVis {
  parts: CarParts;
  tag: THREE.Sprite;
  h: number;
  yaw: number;
  roll: number;
  pitch: number;
  wheelA: number;
  ring: string;
}

export class RaceRenderer3D {
  canvas: HTMLCanvasElement;
  eng: RaceEngine;
  geo: TrackGeometry;
  track: TrackDef;
  opts: Render3DOptions;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(68, 1, 0.5, 5000);
  w = 1;
  h = 1;

  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private sky!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private fog = new THREE.Fog('#bddff4', 260, 2400);
  private cur = { top: new THREE.Color(), hor: new THREE.Color(), sun: 2.5, hemi: 0.9, fogNear: 260, fogFar: 2400, rain: 0, env: 0.4 };
  private asphaltMat!: THREE.MeshStandardMaterial;
  private carVis = new Map<string, CarVis>();
  private assets!: SharedCarAssets;
  private smoke!: Particles;
  private sparks!: Particles;
  private skidMesh!: THREE.Mesh;
  private skidPos!: Float32Array;
  private skidCol!: Float32Array;
  private skidTick = 0;
  private skidLen = -1;
  private dprScale = 1;
  private frameEma = 0;
  private slowFrames = 0;
  private lastScaleChange = 0;
  private rain!: THREE.Mesh;
  private rainPos!: Float32Array;
  private rainOff!: Float32Array;
  private pitBoxes: { idx: number; color: string; x: number; y: number; tx: number; ty: number; blend: number }[] = [];
  private crewBody!: THREE.InstancedMesh;
  private crewHead!: THREE.InstancedMesh;
  private lampRed!: THREE.Mesh;
  private lampGreen!: THREE.Mesh;
  private pitGuide!: THREE.Mesh;
  private pitGuideMat!: THREE.MeshBasicMaterial;
  private pitDummy = new THREE.Object3D();
  private lineDots: THREE.Points | null = null;
  private lineKey = 0;
  private soft!: THREE.Texture;
  private time = 0;
  private camInit = false;
  private camH = 0;
  private camPos = new THREE.Vector3();
  private camPrev = new THREE.Vector3();
  private camVel = new THREE.Vector3();
  private fov = 68;
  private shake = 0;
  private lastMode = '';
  private miniPath: Path2D | null = null;
  private tmp = new THREE.Vector3();
  private tmpColor = new THREE.Color();
  private lost = false;
  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
  };

  constructor(canvas: HTMLCanvasElement, eng: RaceEngine, opts: Render3DOptions) {
    this.canvas = canvas;
    this.eng = eng;
    this.geo = eng.geo;
    this.track = eng.cfg.track;
    this.opts = opts;
    const high = opts.quality === 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = high;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas.addEventListener('webglcontextlost', this.onLost);
    this.scene.fog = this.fog;
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.soft = T.softDotTexture();
    this.buildLights();
    this.buildSky();
    this.buildGround();
    this.buildTrack();
    this.buildBarriers();
    this.buildPit();
    this.buildStartLine();
    this.buildBoards();
    this.buildBanners();
    this.buildScenery();
    this.buildCars();
    this.buildEffects();
    this.applyWeather(eng.weatherNow, 99);
    this.resize();
    // Alle Shader vorab übersetzen (inklusive Regen), damit nichts während der Fahrt nachlädt
    try {
      const wasRain = this.rain.visible;
      this.rain.visible = true;
      this.renderer.compile(this.scene, this.camera);
      this.rain.visible = wasRain;
    } catch {
      /* Kompilieren ist nur eine Optimierung */
    }
  }

  // ---------- Aufbau ----------
  private buildLights() {
    this.hemi = new THREE.HemisphereLight('#c4dcff', '#6b6a52', 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d8', 2.5);
    this.sun.castShadow = this.opts.quality === 'high';
    const sc = this.sun.shadow.camera;
    sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 260;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun, this.sun.target);
  }

  private buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0.55, 0.42, 0.38).normalize() }, sunAmt: { value: 1 } },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform float sunAmt; varying vec3 vP;
        void main(){ vec3 d=normalize(vP); float t=smoothstep(-0.02,0.6,d.y); vec3 c=mix(hor,top,t);
          float s=pow(max(dot(d,sunDir),0.0),2500.0)*sunAmt; float g=pow(max(dot(d,sunDir),0.0),14.0)*0.14*sunAmt;
          c+=vec3(1.0,0.93,0.78)*(s*1.4+g); gl_FragColor=vec4(c,1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3500, 24, 14), this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  private buildGround() {
    const sc = SCENERY[this.track.scenery];
    const tex = T.noiseTexture(sc.ground, 38, 8, hashStr(this.track.id), 256);
    tex.repeat.set(9000 / 16, 9000 / 16);
    const geo = new THREE.PlaneGeometry(9000, 9000);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    mesh.position.set((this.geo.minX + this.geo.maxX) / 2, -0.04, (this.geo.minY + this.geo.maxY) / 2);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private frames(i0: number, i1: number): Frame[] {
    const g = this.geo;
    const out: Frame[] = [];
    for (let i = i0; i <= i1; i++) {
      const k = wrapIndex(i, g.n);
      out.push({ x: g.x[k], y: g.y[k], nx: g.nx[k], ny: g.ny[k] });
    }
    return out;
  }

  /** Band entlang einer Folge von Rahmen. u/v in Metern geteilt durch uLen/vLen, Fläche zeigt zur Normale. */
  private ribbon(fr: Frame[], la: Prof, lb: Prof, ya: Prof, yb: Prof, vLen: number, uLen = vLen, normal?: (f: Frame) => [number, number, number]): THREE.BufferGeometry {
    const n = fr.length;
    const geo = new THREE.BufferGeometry();
    if (n < 2) return geo;
    const pos = new Float32Array(n * 6);
    const uv = new Float32Array(n * 4);
    const nrm = new Float32Array(n * 6);
    let v = 0;
    for (let k = 0; k < n; k++) {
      const f = fr[k];
      if (k > 0) v += Math.hypot(f.x - fr[k - 1].x, f.y - fr[k - 1].y);
      const a = ev(la, k), b = ev(lb, k), y0 = ev(ya, k), y1 = ev(yb, k);
      pos.set([f.x + f.nx * a, y0, f.y + f.ny * a, f.x + f.nx * b, y1, f.y + f.ny * b], k * 6);
      uv.set([0, v / vLen, Math.hypot(b - a, y1 - y0) / uLen, v / vLen], k * 4);
      const nn = normal ? normal(f) : [0, 1, 0];
      nrm.set([nn[0], nn[1], nn[2], nn[0], nn[1], nn[2]], k * 6);
    }
    // Windung so wählen, dass die Vorderseite zur Normale zeigt
    const A0 = new THREE.Vector3(pos[0], pos[1], pos[2]);
    const B0 = new THREE.Vector3(pos[3], pos[4], pos[5]);
    const A1 = new THREE.Vector3(pos[6], pos[7], pos[8]);
    const cr = new THREE.Vector3().subVectors(A1, A0).cross(new THREE.Vector3().subVectors(B0, A0));
    const front = cr.x * nrm[0] + cr.y * nrm[1] + cr.z * nrm[2] > 0;
    const idx: number[] = [];
    for (let k = 0; k < n - 1; k++) {
      const a0 = 2 * k, b0 = 2 * k + 1, a1 = 2 * k + 2, b1 = 2 * k + 3;
      if (front) idx.push(a0, a1, b0, b0, a1, b1);
      else idx.push(a0, b0, a1, b0, b1, a1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    return geo;
  }

  private overlayMat(map: THREE.Texture | null, color: string, offset: number, extra: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({ map, color, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, ...extra });
  }

  private buildTrack() {
    const g = this.geo;
    const n = g.n;
    const hw = g.halfWidth;
    const wall = hw + this.track.runoff;
    const sc = SCENERY[this.track.scenery];
    const all = this.frames(0, n);

    // Auslaufzone
    const rTex = T.noiseTexture(this.track.street ? '#5a636a' : sc.runoff, 44, 8, 5, 256);
    const runoff = new THREE.Mesh(this.ribbon(all, -wall, wall, 0.0, 0.0, 16), this.overlayMat(rTex, '#ffffff', -1));
    runoff.receiveShadow = true;
    this.scene.add(runoff);

    // Fahrbahn
    const aTex = T.noiseTexture(this.track.surface, 30, 8, 11, 256);
    this.asphaltMat = this.overlayMat(aTex, '#ffffff', -2, { roughness: 0.92 });
    const surface = new THREE.Mesh(this.ribbon(all, -hw, hw, 0.012, 0.012, 14), this.asphaltMat);
    surface.receiveShadow = true;
    this.scene.add(surface);

    // Gummiabrieb auf der Ideallinie
    const lo = (k: number) => g.lineOff[wrapIndex(k, n)];
    const rubber = new THREE.Mesh(this.ribbon(all, (k) => lo(k) - 1.7, (k) => lo(k) + 1.7, 0.02, 0.02, 10), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    this.scene.add(rubber);

    // Kantenlinien
    const white = this.overlayMat(null, '#f0f0f0', -4);
    const eL = this.ribbon(all, -hw + 0.08, -hw + 0.48, 0.03, 0.03, 10);
    const eR = this.ribbon(all, hw - 0.48, hw - 0.08, 0.03, 0.03, 10);
    this.scene.add(new THREE.Mesh(eL, white), new THREE.Mesh(eR, white));

    // Randsteine in Kurven
    const corner = (i: number) => Math.abs(g.k[wrapIndex(i, n)]) > 1 / 160;
    let s0 = 0;
    while (s0 < n && corner(s0)) s0++;
    const kerbGeos: THREE.BufferGeometry[] = [];
    let start = -1;
    for (let j = 0; j <= n; j++) {
      const i = s0 + j;
      const c = j < n && corner(i);
      if (c && start < 0) start = i;
      if (!c && start >= 0) {
        if (i - start >= 3) {
          const fr = this.frames(start, i);
          kerbGeos.push(this.ribbon(fr, hw - 0.1, hw + 1.35, 0.034, 0.034, 4));
          kerbGeos.push(this.ribbon(fr, -hw - 1.35, -hw + 0.1, 0.034, 0.034, 4));
        }
        start = -1;
      }
    }
    if (kerbGeos.length) {
      const kerbTex = T.kerbTexture();
      const km = new THREE.Mesh(mergeGeometries(kerbGeos, false)!, this.overlayMat(kerbTex, '#ffffff', -4));
      km.receiveShadow = true;
      this.scene.add(km);
    }
  }

  /** Liegt der Streckenindex im Bereich der Boxengasse (mit Rand in Metern)? */
  private inPitZone(i: number, margin = 0) {
    const g = this.geo;
    const rel = this.eng.pitRelOf(i * g.ds);
    return rel <= this.eng.pitLen + margin || rel >= g.length - margin;
  }

  private buildBarriers() {
    const g = this.geo;
    const n = g.n;
    const e = this.eng;
    const street = this.track.street;
    const h = street ? 1.15 : 1.0;
    const bTex = T.barrierTexture(street);
    const wallMat = new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.85 });
    const topMat = new THREE.MeshStandardMaterial({ color: street ? '#c9d0d4' : '#1e2125', roughness: 0.8 });
    const fenceMat = new THREE.MeshStandardMaterial({ map: T.fenceTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
    const wallGeos: THREE.BufferGeometry[] = [];
    const topGeos: THREE.BufferGeometry[] = [];
    const fenceGeos: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const fr = this.frames(0, n);
      const lat = (k: number) => side * (e.outerWallAt(k * g.ds, side) - 0.3);
      const inward = (f: Frame): [number, number, number] => [-side * f.nx, 0, -side * f.ny];
      wallGeos.push(this.ribbon(fr, lat, lat, 0, h, 6, h, inward));
      topGeos.push(this.ribbon(fr, lat, (k) => lat(k) + side * 0.9, h, h, 6));
      if (!street) {
        const fl = (k: number) => side * (e.outerWallAt(k * g.ds, side) + 0.9);
        fenceGeos.push(this.ribbon(fr, fl, fl, 0, 3.4, 1.7, 1.7, inward));
      }
    }
    const addMerged = (geos: THREE.BufferGeometry[], mat: THREE.Material, shadow: boolean) => {
      if (!geos.length) return;
      const m = new THREE.Mesh(mergeGeometries(geos, false)!, mat);
      m.receiveShadow = shadow;
      m.castShadow = shadow;
      this.scene.add(m);
    };
    addMerged(wallGeos, wallMat, true);
    addMerged(topGeos, topMat, true);
    addMerged(fenceGeos, fenceMat, false);
  }

  // ---------- Boxengasse ----------
  // Querschnitt auf der Boxenseite: Strecke | Grünstreifen | Boxenmauer | Fahrspur | Arbeitsspur | Garagen | Außenmauer.
  // Zufahrt und Ausfahrt sind Keile, die an der Streckenkante beginnen bzw. enden.
  private buildPit() {
    const g = this.geo;
    const e = this.eng;
    const hw = g.halfWidth;
    const side = e.pitSide;
    const eL = PIT.entryLen;
    const xL = PIT.exitLen;
    const tot = e.pitLen;
    const xs = tot - xL;
    const i0 = Math.round(e.pitIn / g.ds);
    const fr = this.frames(i0, i0 + Math.ceil(tot / g.ds) + 1);
    const relK = (k: number) => (i0 + k) * g.ds - e.pitIn;
    const sm = (t: number) => {
      const x = clamp(t, 0, 1);
      return x * x * (3 - 2 * x);
    };
    const wedge = (k: number) => {
      const r = relK(k);
      return r < eL ? sm(r / eL) : r > xs ? sm(1 - (r - xs) / xL) : 1;
    };
    const inner = (k: number) => side * (hw - 0.2 + (PIT.wall + 0.5) * wedge(k));
    const outer = (k: number) => side * (hw + 0.5 + (PIT.door - 0.5) * wedge(k));

    // Fahrbahn der Boxengasse
    const pitTex = T.noiseTexture('#454b51', 24, 8, 21, 256);
    const laneMat = this.overlayMat(pitTex, '#ffffff', -3);
    const laneMesh = new THREE.Mesh(this.ribbon(fr, inner, outer, 0.016, 0.016, 12), laneMat);
    laneMesh.receiveShadow = true;
    this.scene.add(laneMesh);
    // Markierungen: gelbe Trennlinie zwischen Fahr- und Arbeitsspur, weiße Randlinie
    const yellow = this.overlayMat(null, '#f2d34a', -5);
    const white = this.overlayMat(null, '#f0f0f0', -5);
    const mid = side * (hw + (PIT.fast + PIT.work) / 2);
    const midFr = fr.filter((_, k) => relK(k) > eL + 6 && relK(k) < xs - 6);
    this.scene.add(new THREE.Mesh(this.ribbon(midFr, mid - 0.09, mid + 0.09, 0.03, 0.03, 6), yellow));
    this.scene.add(new THREE.Mesh(this.ribbon(fr, (k) => outer(k) - side * 0.34, (k) => outer(k) - side * 0.14, 0.03, 0.03, 6), white));
    // Boxenmauer zwischen Strecke und Gasse
    const wallFr = fr.filter((_, k) => relK(k) >= eL && relK(k) <= xs);
    const wl = side * (hw + PIT.wall);
    const inward = (f: Frame): [number, number, number] => [-side * f.nx, 0, -side * f.ny];
    const pw = new THREE.Mesh(
      mergeGeometries([this.ribbon(wallFr, wl, wl, 0, 1.05, 6, 1, inward), this.ribbon(wallFr, wl, wl + side * 0.5, 1.05, 1.05, 6), this.ribbon(wallFr, wl + side * 0.5, wl + side * 0.5, 1.05, 0, 6, 1, (f) => [side * f.nx, 0, side * f.ny])], false)!,
      new THREE.MeshStandardMaterial({ color: '#b9c0c6', roughness: 0.8 }),
    );
    pw.castShadow = true;
    pw.receiveShadow = true;
    this.scene.add(pw);
    // rot-weiße Kante an der Mauer
    const sk = this.overlayMat(T.kerbTexture(), '#ffffff', -5);
    this.scene.add(new THREE.Mesh(this.ribbon(wallFr, wl - side * 0.95, wl - side * 0.1, 0.034, 0.034, 4), sk));

    // Garagen und Boxenfelder der Teams
    const boxes = new Map<number, { color: string; name: string; fg: string }>();
    const lumOf = (hex: string) => {
      const h = hex.replace('#', '');
      return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255;
    };
    for (const c of e.cars) if (!boxes.has(c.cfg.boxIndex)) boxes.set(c.cfg.boxIndex, { color: c.cfg.color, name: c.cfg.name.split(' ').slice(-1)[0].toUpperCase(), fg: lumOf(c.cfg.color) > 0.6 ? '#111' : '#fff' });
    const bodyGeo = new THREE.BoxGeometry(20, 4.2, 6.4);
    bodyGeo.translate(0, 2.1, 0);
    const roofGeo = new THREE.BoxGeometry(21, 0.4, 7.2);
    roofGeo.translate(0, 4.4, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#7d878e', roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#2a2f34', roughness: 0.7 });
    const doorMat = new THREE.MeshStandardMaterial({ color: '#16191c', roughness: 0.9 });
    const padGeo = new THREE.PlaneGeometry(6.6, 3.4);
    padGeo.rotateX(-Math.PI / 2);
    const signGeo = new THREE.PlaneGeometry(7.6, 1.9);
    this.pitBoxes = [];
    boxes.forEach((info, idx) => {
      const s = e.boxS(idx);
      const p = pointAt(g, s, side * (hw + PIT.door + 3.4));
      const grp = new THREE.Group();
      grp.position.set(p.x, 0, p.y);
      grp.rotation.y = -Math.atan2(p.ty, p.tx);
      const b = new THREE.Mesh(bodyGeo, bodyMat);
      b.castShadow = true;
      b.receiveShadow = true;
      const r = new THREE.Mesh(roofGeo, roofMat);
      r.castShadow = true;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(20.2, 0.7, 0.2), new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.5 }));
      stripe.position.set(0, 3.55, -side * 3.25);
      const door = new THREE.Mesh(new THREE.BoxGeometry(16, 2.9, 0.2), doorMat);
      door.position.set(0, 1.45, -side * 3.22);
      const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: T.bannerTexture(info.name, info.color, info.fg) }));
      sign.scale.set(0.8, 0.8, 1);
      sign.position.set(0, 3.6, -side * 3.38);
      sign.rotation.y = side > 0 ? Math.PI : 0;
      grp.add(b, r, stripe, door, sign);
      this.scene.add(grp);
      // Haltefeld in der Arbeitsspur
      const pp = pointAt(g, s, side * (hw + PIT.work));
      const pad = new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
      pad.position.set(pp.x, 0.036, pp.y);
      pad.rotation.y = -Math.atan2(pp.ty, pp.tx);
      this.scene.add(pad);
      this.pitBoxes.push({ idx, color: info.color, x: pp.x, y: pp.y, tx: pp.tx, ty: pp.ty, blend: 0 });
    });
    // Boxencrew: sechs Mechaniker je Box (vier Reifen, zwei Wagenheber), als Instanzen
    const crewN = this.pitBoxes.length * 6;
    const bodyG = new THREE.CylinderGeometry(0.27, 0.31, 0.95, 8);
    bodyG.translate(0, 0.5, 0);
    const headG = new THREE.SphereGeometry(0.19, 8, 6);
    headG.translate(0, 1.2, 0);
    this.crewBody = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ roughness: 0.6 }), Math.max(1, crewN));
    this.crewHead = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ color: '#f1f3f4', roughness: 0.4 }), Math.max(1, crewN));
    this.crewBody.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crewHead.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crewBody.frustumCulled = false;
    this.crewHead.frustumCulled = false;
    this.crewBody.castShadow = this.opts.quality === 'high';
    const tc = new THREE.Color();
    this.pitBoxes.forEach((b, bi) => {
      tc.set(b.color);
      for (let k = 0; k < 6; k++) this.crewBody.setColorAt(bi * 6 + k, tc);
    });
    this.scene.add(this.crewBody, this.crewHead);

    // Ausfahrtsampel (rot/grün) an der Boxenmauer vor der Einmündung
    const hold = pointAt(g, e.pitIn + xs - 2, side * (hw + PIT.wall + 0.6));
    const light = new THREE.Group();
    light.position.set(hold.x, 0, hold.y);
    light.rotation.y = -Math.atan2(hold.ty, hold.tx);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.0, 6), new THREE.MeshStandardMaterial({ color: '#2a2f34', roughness: 0.7 }));
    pole.position.y = 1.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.05, 0.5), new THREE.MeshStandardMaterial({ color: '#15181b', roughness: 0.6 }));
    head.position.y = 3.2;
    this.lampRed = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    this.lampGreen = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0x35ff6a }));
    this.lampRed.position.set(-0.2, 3.4, 0);
    this.lampGreen.position.set(-0.2, 3.0, 0);
    light.add(pole, head, this.lampRed, this.lampGreen);
    this.scene.add(light);

    // Schilder an der Einfahrt
    const signMat = (t: string, bg: string, fg: string) => new THREE.MeshBasicMaterial({ map: T.bannerTexture(t, bg, fg), side: THREE.DoubleSide });
    const mkSign = (rel: number, lat: number, y: number, w: number, hgt: number, mat: THREE.Material) => {
      const p = pointAt(g, e.pitIn + rel, lat);
      const grp = new THREE.Group();
      grp.position.set(p.x, 0, p.y);
      grp.rotation.y = -Math.atan2(p.ty, p.tx);
      const post = new THREE.CylinderGeometry(0.06, 0.06, y, 6);
      post.translate(0, y / 2, 0);
      const pm = new THREE.MeshStandardMaterial({ color: '#3a4046', roughness: 0.7 });
      for (const z of [-w / 2 + 0.2, w / 2 - 0.2]) {
        const m = new THREE.Mesh(post, pm);
        m.position.z = z;
        grp.add(m);
      }
      const board = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), mat);
      board.position.set(0, y, 0);
      board.rotation.y = -Math.PI / 2;
      grp.add(board);
      this.scene.add(grp);
    };
    mkSign(-70, side * (hw + 2.4), 3.2, 6.4, 1.6, signMat('BOXENEINFAHRT', '#101418', '#ffd23a'));
    mkSign(-12, side * (hw + 2.4), 2.4, 3.6, 0.9, signMat('LIMIT 80', '#ffffff', '#c8161d'));

    // Leitstreifen auf der Zufahrt: leuchtet grün, solange ein Boxenstopp angefordert ist
    const guideFr = fr.filter((_, k) => relK(k) >= -4 && relK(k) <= eL + 4);
    const gMid = (k: number) => (inner(k) + outer(k)) / 2;
    this.pitGuideMat = new THREE.MeshBasicMaterial({ color: 0x3cff8a, transparent: true, opacity: 0.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 });
    this.pitGuide = new THREE.Mesh(this.ribbon(guideFr, (k) => gMid(k) - side * 0.5, (k) => gMid(k) + side * 0.5, 0.04, 0.04, 6), this.pitGuideMat);
    this.pitGuide.visible = false;
    this.scene.add(this.pitGuide);
  }

  /** Boxencrew, Wagenheber und Ausfahrtsampel jedes Bild nachführen */
  private updatePit(dt: number) {
    const e = this.eng;
    const cars = e.cars;
    const d = this.pitDummy;
    const g = this.geo;
    const side = e.pitSide;
    const hw = g.halfWidth;
    (this.lampRed.material as THREE.MeshBasicMaterial).color.setHex(e.exitRed ? 0xff2a2a : 0x3a0c0c);
    (this.lampGreen.material as THREE.MeshBasicMaterial).color.setHex(e.exitRed ? 0x0b3a18 : 0x35ff6a);
    const t = this.time;
    const rest = [-3.6, -2.2, -0.8, 0.8, 2.2, 3.6];
    const wheel: [number, number][] = [[1.5, -1.8], [1.5, 1.8], [-1.5, -1.8], [-1.5, 1.8], [3.4, 0], [-3.4, 0]];
    this.pitBoxes.forEach((b, bi) => {
      let target = 0;
      let car: CarSim | null = null;
      for (const c of cars) {
        if (c.cfg.boxIndex !== b.idx || c.pit === 'none' || c.pitDrive) continue;
        let a = 0;
        if (c.pit === 'stopped') {
          const el = c.pitTotal - c.pitTimer;
          a = Math.max(0.05, Math.min(1, el / 0.5, c.pitTimer / 0.5));
          car = c;
        } else if (c.pit === 'toBox') {
          const toBox = c.pitStopRel - c.pitRel;
          a = clamp((30 - toBox) / 30, 0, 1) * 0.35;
        } else if (c.pit === 'exit') a = clamp(1 - (c.pitRel - c.pitStopRel) / 12, 0, 1) * 0.35;
        target = Math.max(target, a);
      }
      b.blend += (target - b.blend) * Math.min(1, dt * 9);
      const work = b.blend;
      // Ruheposition: vor dem Garagentor
      const base = pointAt(g, e.boxS(b.idx), side * (hw + PIT.door - 0.7));
      for (let k = 0; k < 6; k++) {
        const hx = base.x + base.tx * rest[k];
        const hy = base.y + base.ty * rest[k];
        let x = hx, y = hy, bob = 0;
        if (car && work > 0.01) {
          const c = car;
          const cx = Math.cos(c.h), cz = Math.sin(c.h);
          const [al, ac] = wheel[k];
          const wx = c.x + cx * al - cz * ac;
          const wy = c.y + cz * al + cx * ac;
          const m = Math.min(1, work);
          x = hx + (wx - hx) * m;
          y = hy + (wy - hy) * m;
          bob = k < 4 ? Math.sin(t * 38 + k * 1.7) * 0.035 * m : 0;
        } else if (work > 0.01) {
          // Auto kommt: Mechaniker treten an die Arbeitsspur
          const wx = hx - base.nx * side * 2.2;
          const wy = hy - base.ny * side * 2.2;
          x = hx + (wx - hx) * Math.min(1, work * 2.2);
          y = hy + (wy - hy) * Math.min(1, work * 2.2);
        }
        d.position.set(x, bob, y);
        d.rotation.set(0, 0, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        this.crewBody.setMatrixAt(bi * 6 + k, d.matrix);
        this.crewHead.setMatrixAt(bi * 6 + k, d.matrix);
      }
    });
    this.crewBody.instanceMatrix.needsUpdate = true;
    this.crewHead.instanceMatrix.needsUpdate = true;
    if (this.crewBody.instanceColor) this.crewBody.instanceColor.needsUpdate = true;
  }

  /** Leitstreifen zur Zufahrt, wenn der beobachtete Fahrer einen Stopp angefordert hat */
  private updatePitGuide(f: CarSim) {
    const show = !!f.pitReq && f.pit === 'none' && f.cfg.human && this.eng.cfg.mode === 'race';
    this.pitGuide.visible = show;
    if (show) this.pitGuideMat.opacity = 0.35 + 0.3 * Math.sin(this.time * 6);
  }

  private buildStartLine() {
    const g = this.geo;
    const hw = g.halfWidth;
    const p0 = pointAt(g, 0, 0);
    const a = Math.atan2(p0.ty, p0.tx);
    const grp = new THREE.Group();
    grp.position.set(p0.x, 0, p0.y);
    grp.rotation.y = -a;
    // Zielstrich
    const cols = Math.max(4, Math.round((hw * 2) / 0.8));
    const plane = new THREE.PlaneGeometry(1.6, hw * 2);
    plane.rotateX(-Math.PI / 2);
    const line = new THREE.Mesh(plane, new THREE.MeshStandardMaterial({ map: T.checkerTexture(2, cols), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
    line.position.y = 0.036;
    grp.add(line);
    // Torbrücke
    const mat = new THREE.MeshStandardMaterial({ color: '#8d979e', roughness: 0.5, metalness: 0.5 });
    const span = hw + 2;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 1), mat);
      post.position.set(0, 4, s * span);
      post.castShadow = true;
      grp.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.7, span * 2 + 1), new THREE.MeshStandardMaterial({ color: '#1e2327', roughness: 0.6 }));
    beam.position.y = 7.4;
    beam.castShadow = true;
    grp.add(beam);
    const label = T.bannerTexture('START · ZIEL', '#14181b', '#f4f4f4');
    for (const f of [-1, 1]) {
      const bp = new THREE.Mesh(new THREE.PlaneGeometry(span * 2 - 1, 1.5), new THREE.MeshBasicMaterial({ map: label }));
      bp.position.set(f * 0.72, 7.4, 0);
      bp.rotation.y = f > 0 ? Math.PI / 2 : -Math.PI / 2;
      grp.add(bp);
    }
    this.scene.add(grp);
    // Startaufstellung
    const marks: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 16; i++) {
      const s = g.length - 14 - i * 9 + 3;
      const lat = (i % 2 === 0 ? -1 : 1) * Math.min(3, hw - 2) * -g.turnSign;
      const p = pointAt(g, s, lat);
      const b = new THREE.BoxGeometry(0.18, 0.01, 2.8);
      b.rotateY(-Math.atan2(p.ty, p.tx));
      b.translate(p.x, 0.036, p.y);
      marks.push(b);
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(marks, false)!, this.overlayMat(null, '#f0f0f0', -5)));
  }

  private buildBoards() {
    // Bremsschilder (3 – 2 – 1 Streifen) 150 / 100 / 50 m vor jeder deutlichen Kurve
    const g = this.geo;
    const n = g.n;
    const wall = g.halfWidth + this.track.runoff;
    const strong = (i: number) => Math.abs(g.lineK[wrapIndex(i, n)]) > 1 / 95;
    const entries: number[] = [];
    for (let i = 0; i < n; i++) if (strong(i) && !strong(i - 1)) entries.push(i);
    const exits = new Map<number, number>();
    for (const e of entries) {
      let j = e;
      while (strong(j) && j - e < n) j++;
      exits.set(e, j);
    }
    const sorted = [...entries].sort((a, b) => a - b);
    const tex = [1, 2, 3].map((k) => T.boardTexture(k));
    const boardGeo = new THREE.PlaneGeometry(1.7, 2.5);
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6);
    postGeo.translate(0, 0.6, 0);
    const postMat = new THREE.MeshStandardMaterial({ color: '#3a4046', roughness: 0.7 });
    const mats = tex.map((t) => new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.7 }));
    sorted.forEach((e, k) => {
      const prev = sorted[(k - 1 + sorted.length) % sorted.length];
      const prevExit = exits.get(prev) ?? prev;
      const gapM = ((((e - prevExit) % n) + n) % n) * g.ds;
      if (gapM < 110) return;
      const outside = -Math.sign(g.lineK[wrapIndex(e + 5, n)] || 1);
      for (const [dist, num] of [[150, 3], [100, 2], [50, 1]] as const) {
        if (dist > gapM - 20) continue;
        const i = wrapIndex(e - Math.round(dist / g.ds), n);
        const off = Math.min(g.halfWidth + 3.6, wall - 2) * outside;
        if (outside === this.eng.pitSide && this.inPitZone(i, 40)) continue;
        const grp = new THREE.Group();
        grp.position.set(g.x[i] + g.nx[i] * off, 0, g.y[i] + g.ny[i] * off);
        grp.rotation.y = Math.atan2(-g.tx[i], -g.ty[i]);
        const b = new THREE.Mesh(boardGeo, mats[num - 1]);
        b.position.y = 2.4;
        b.castShadow = true;
        grp.add(new THREE.Mesh(postGeo, postMat), b);
        this.scene.add(grp);
      }
    });
  }

  private buildBanners() {
    const g = this.geo;
    const n = g.n;
    const wall = g.halfWidth + this.track.runoff;
    const texts: { t: string; bg: string; fg: string }[] = [{ t: 'APEX RENNSTALL', bg: '#101418', fg: '#ff6a1a' }, { t: this.track.name.toUpperCase(), bg: this.track.flag[0], fg: '#ffffff' }];
    const seen = new Set<string>();
    for (const c of this.eng.cars) {
      if (seen.has(c.cfg.teamId)) continue;
      seen.add(c.cfg.teamId);
      const lum = (() => {
        const h = c.cfg.color.replace('#', '');
        return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255;
      })();
      texts.push({ t: c.cfg.name.split(' ').slice(-1)[0].toUpperCase(), bg: c.cfg.color, fg: lum > 0.6 ? '#111' : '#fff' });
      if (texts.length >= 8) break;
    }
    const mats = texts.map((x) => new THREE.MeshStandardMaterial({ map: T.bannerTexture(x.t, x.bg, x.fg), roughness: 0.6, side: THREE.DoubleSide }));
    const geo = new THREE.PlaneGeometry(7, 1.75);
    const step = Math.round(150 / g.ds);
    let count = 0;
    for (let i = 20; i < n; i += step) {
      const straight = Math.abs(g.k[i]) < 1 / 260;
      if (!straight) continue;
      const side = count % 2 ? 1 : -1;
      if (side === this.eng.pitSide && this.inPitZone(i, 40)) {
        count++;
        continue;
      }
      const lat = side * (wall + (this.track.street ? 0.6 : 1.6));
      const m = new THREE.Mesh(geo, mats[count % mats.length]);
      m.position.set(g.x[i] + g.nx[i] * lat, this.track.street ? 1.9 : 1.6, g.y[i] + g.ny[i] * lat);
      m.rotation.y = Math.atan2(-side * g.nx[i], -side * g.ny[i]);
      this.scene.add(m);
      count++;
    }
  }

  /** Zufallspunkte in Streckennähe, außerhalb der Bande und der Boxengasse */
  private scatter(count: number, minOut: number, maxOut: number, rnd: () => number, far = 0.25): { x: number; y: number }[] {
    const g = this.geo;
    const wall = g.halfWidth + this.track.runoff;
    const pts: { x: number; y: number }[] = [];
    let tries = 0;
    while (pts.length < count && tries < count * 8) {
      tries++;
      let x: number, y: number;
      if (rnd() < far) {
        const pad = 600;
        x = g.minX - pad + rnd() * (g.maxX - g.minX + pad * 2);
        y = g.minY - pad + rnd() * (g.maxY - g.minY + pad * 2);
      } else {
        const i = Math.floor(rnd() * g.n);
        const side = rnd() < 0.5 ? -1 : 1;
        const lat = side * (wall + minOut + rnd() * (maxOut - minOut));
        x = g.x[i] + g.nx[i] * lat;
        y = g.y[i] + g.ny[i] * lat;
      }
      const j = nearestIndexGlobal(g, x, y);
      const d = Math.hypot(x - g.x[j], y - g.y[j]);
      if (d < wall + minOut) continue;
      const sideLat = (x - g.x[j]) * g.nx[j] + (y - g.y[j]) * g.ny[j];
      if (sideLat * this.eng.pitSide > 0 && this.inPitZone(j, 60) && d < g.halfWidth + PIT.barrier + 34) continue;
      pts.push({ x, y });
    }
    return pts;
  }

  private buildScenery() {
    const g = this.geo;
    const sc = SCENERY[this.track.scenery];
    const rnd = rng(hashStr(this.track.id) ^ 0x9e3779b9);
    const high = this.opts.quality === 'high';
    const dummy = new THREE.Object3D();
    const wall = g.halfWidth + this.track.runoff;

    // Ferne Hügel als Horizont
    const cx = (g.minX + g.maxX) / 2, cy = (g.minY + g.maxY) / 2;
    const R = Math.hypot(g.maxX - g.minX, g.maxY - g.minY) / 2 + 900;
    const hillMat = new THREE.MeshStandardMaterial({ color: sc.hill, roughness: 1, flatShading: true });
    const hills = Math.max(10, high ? 22 : 12);
    for (let i = 0; i < hills; i++) {
      const a = (i / hills) * Math.PI * 2 + rnd() * 0.2;
      const r = R + rnd() * 700;
      const rad = 260 + rnd() * 420;
      const hh = 70 + rnd() * 220;
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, hh, 6 + Math.floor(rnd() * 3)), hillMat);
      m.position.set(cx + Math.cos(a) * r, hh / 2 - 6, cy + Math.sin(a) * r);
      m.rotation.y = rnd() * 3;
      this.scene.add(m);
    }

    if (this.track.scenery === 'harbor') {
      // Containerstapel und Lagerhallen
      const cGeo = new THREE.BoxGeometry(12, 2.6, 2.4);
      cGeo.translate(0, 1.3, 0);
      const pts = this.scatter(high ? 120 : 60, 14, 110, rnd, 0.15);
      const levels = pts.map(() => 1 + Math.floor(rnd() * 3));
      const total = levels.reduce((a, b) => a + b, 0);
      const inst = new THREE.InstancedMesh(cGeo, new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.3 }), total);
      const pal = ['#c0392b', '#2a6fb0', '#e08a1e', '#7c8a92', '#2e8b57', '#d9d9d9', '#8e44ad'].map((c) => new THREE.Color(c));
      let k = 0;
      pts.forEach((p, i) => {
        const rot = Math.floor(rnd() * 4) * (Math.PI / 2) + (rnd() - 0.5) * 0.1;
        for (let l = 0; l < levels[i]; l++) {
          dummy.position.set(p.x, l * 2.6, p.y);
          dummy.rotation.set(0, rot, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          inst.setMatrixAt(k, dummy.matrix);
          inst.setColorAt(k, pal[Math.floor(rnd() * pal.length)]);
          k++;
        }
      });
      inst.castShadow = high;
      this.scene.add(inst);
      const wGeo = new THREE.BoxGeometry(58, 13, 24);
      wGeo.translate(0, 6.5, 0);
      const wp = this.scatter(7, 70, 220, rnd, 0.2);
      const wi = new THREE.InstancedMesh(wGeo, new THREE.MeshStandardMaterial({ color: '#9fa9b0', roughness: 0.8 }), wp.length);
      wp.forEach((p, i) => {
        dummy.position.set(p.x, 0, p.y);
        dummy.rotation.set(0, rnd() * Math.PI, 0);
        dummy.updateMatrix();
        wi.setMatrixAt(i, dummy.matrix);
      });
      wi.castShadow = high;
      this.scene.add(wi);
    } else if (this.track.scenery === 'dry') {
      const rockGeo = new THREE.DodecahedronGeometry(1.8, 0);
      const bushGeo = new THREE.IcosahedronGeometry(1.2, 0);
      bushGeo.translate(0, 0.9, 0);
      const rp = this.scatter(high ? 260 : 120, 8, 120, rnd, 0.35);
      const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: '#8a6f4d', roughness: 1, flatShading: true }), rp.length);
      rp.forEach((p, i) => {
        dummy.position.set(p.x, 0.4, p.y);
        dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        const s = 0.6 + rnd() * 2.2;
        dummy.scale.set(s, s * 0.6, s);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      });
      rocks.castShadow = high;
      this.scene.add(rocks);
      const bp = this.scatter(high ? 220 : 100, 6, 90, rnd, 0.3);
      const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), bp.length);
      bp.forEach((p, i) => {
        dummy.position.set(p.x, 0, p.y);
        dummy.rotation.set(0, rnd() * 3, 0);
        const s = 0.7 + rnd() * 1.4;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        bushes.setMatrixAt(i, dummy.matrix);
        bushes.setColorAt(i, this.tmpColor.set(sc.trees[Math.floor(rnd() * sc.trees.length)]));
      });
      this.scene.add(bushes);
    } else {
      // Nadel- und Laubbäume
      const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6);
      trunkGeo.translate(0, 1.3, 0);
      const pineGeo = mergeGeometries([
        new THREE.ConeGeometry(2.2, 3.8, 7).translate(0, 3.8, 0),
        new THREE.ConeGeometry(1.7, 3.2, 7).translate(0, 5.6, 0),
        new THREE.ConeGeometry(1.15, 2.6, 7).translate(0, 7.2, 0),
      ], false)!;
      const roundGeo = new THREE.IcosahedronGeometry(2.6, 1);
      roundGeo.scale(1, 0.9, 1);
      roundGeo.translate(0, 5.4, 0);
      const count = high ? 760 : 260;
      const pts = this.scatter(count, 4, 120, rnd, 0.3);
      const roundShare = this.track.scenery === 'park' ? 0.5 : 0.1;
      const kinds: number[] = pts.map(() => (rnd() < roundShare ? 1 : 0));
      const nRound = kinds.reduce((a, b) => a + b, 0);
      const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 1 }), pts.length);
      const pines = new THREE.InstancedMesh(pineGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), pts.length - nRound);
      const rounds = new THREE.InstancedMesh(roundGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), nRound);
      let ip = 0, ir = 0;
      pts.forEach((p, i) => {
        const s = 0.8 + rnd() * 0.95;
        dummy.position.set(p.x, 0, p.y);
        dummy.rotation.set(0, rnd() * 6, 0);
        dummy.scale.set(s, s * (0.9 + rnd() * 0.3), s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        const c = this.tmpColor.set(sc.trees[Math.floor(rnd() * sc.trees.length)]);
        if (kinds[i]) {
          rounds.setMatrixAt(ir, dummy.matrix);
          rounds.setColorAt(ir++, c);
        } else {
          pines.setMatrixAt(ip, dummy.matrix);
          pines.setColorAt(ip++, c);
        }
      });
      for (const m of [trunks, pines, rounds]) {
        m.castShadow = high;
        this.scene.add(m);
      }
    }

    // Tribünen an langsamen Kurven und an der Start-Ziel-Geraden
    const placements: { x: number; y: number; a: number }[] = [];
    const rs = rng(hashStr(this.track.id) ^ 0x51ed);
    for (let i = 0; i < g.n; i += 6) {
      const k = Math.abs(g.k[i]);
      const startStand = i === 0 || i === Math.round(60 / g.ds) * 3;
      if ((k > 1 / 45 && rs() < 0.3) || startStand) {
        const side = startStand ? -g.turnSign : -Math.sign(g.k[i] || 1);
        const off = wall + 10;
        const x = g.x[i] + g.nx[i] * off * side;
        const y = g.y[i] + g.ny[i] * off * side;
        if (placements.some((p) => Math.hypot(p.x - x, p.y - y) < 50)) continue;
        placements.push({ x, y, a: Math.atan2(side * g.nx[i], side * g.ny[i]) });
      }
    }
    if (placements.length) this.buildStands(placements);
  }

  private buildStands(pl: { x: number; y: number; a: number }[]) {
    const steps: THREE.BufferGeometry[] = [];
    const risers: THREE.BufferGeometry[] = [];
    for (let j = 0; j < 5; j++) {
      const hgt = (j + 1) * 1.5;
      const b = new THREE.BoxGeometry(34, hgt, 3);
      b.translate(0, hgt / 2, j * 3 + 1.5);
      steps.push(b);
      const r = new THREE.PlaneGeometry(34, 1.5);
      r.rotateY(Math.PI); // Fläche zeigt zur Strecke (−z)
      r.translate(0, hgt - 0.75, j * 3 - 0.03);
      risers.push(r);
    }
    const roof = new THREE.BoxGeometry(35, 0.35, 17);
    roof.translate(0, 9.6, 7.5);
    steps.push(roof);
    for (const px of [-16.5, 16.5]) {
      const post = new THREE.BoxGeometry(0.5, 9.6, 0.5);
      post.translate(px, 4.8, 15);
      steps.push(post);
    }
    const stepsGeo = mergeGeometries(steps.map((s) => (s.index ? s.toNonIndexed() : s)), false)!;
    const riserGeo = mergeGeometries(risers.map((s) => (s.index ? s.toNonIndexed() : s)), false)!;
    const crowd = T.crowdTexture();
    crowd.repeat.set(4, 1);
    const sm = new THREE.InstancedMesh(stepsGeo, new THREE.MeshStandardMaterial({ color: '#8b949b', roughness: 0.85 }), pl.length);
    const rm = new THREE.InstancedMesh(riserGeo, new THREE.MeshStandardMaterial({ map: crowd, roughness: 0.9, side: THREE.DoubleSide }), pl.length);
    const d = new THREE.Object3D();
    pl.forEach((p, i) => {
      d.position.set(p.x, 0, p.y);
      d.rotation.set(0, p.a, 0);
      d.updateMatrix();
      sm.setMatrixAt(i, d.matrix);
      rm.setMatrixAt(i, d.matrix);
    });
    sm.castShadow = this.opts.quality === 'high';
    this.scene.add(sm, rm);
  }

  private buildCars() {
    this.assets = makeSharedAssets(this.soft);
    for (const c of this.eng.cars) {
      const parts = buildCar(c.cfg.color, c.cfg.color2, this.assets);
      this.scene.add(parts.root);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.tagTexture(c.cfg.short, 'rgba(10,14,18,0.78)', '#e8eef1'), sizeAttenuation: false, transparent: true, depthWrite: false }));
      tag.center.set(0.5, 0);
      this.scene.add(tag);
      this.carVis.set(c.cfg.id, { parts, tag, h: c.h, yaw: 0, roll: 0, pitch: 0, wheelA: 0, ring: '' });
    }
  }

  private buildEffects() {
    this.smoke = new Particles(700, false, 0.4, 1.8);
    this.sparks = new Particles(260, true, -9, 0);
    this.scene.add(this.smoke.points, this.sparks.points);
    // Reifenspuren
    const cap = 900 * 2;
    this.skidPos = new Float32Array(cap * 4 * 3);
    this.skidCol = new Float32Array(cap * 4 * 4);
    const idx: number[] = [];
    for (let i = 0; i < cap; i++) idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.skidPos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(this.skidCol, 4));
    sg.setIndex(idx);
    sg.setDrawRange(0, 0);
    this.skidMesh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.skidMesh.frustumCulled = false;
    this.scene.add(this.skidMesh);
    // Regen: schmale Streifen, die sich zur Kamera drehen
    const n = 1500;
    this.rainOff = new Float32Array(n * 3);
    this.rainPos = new Float32Array(n * 12);
    const rcol = new Float32Array(n * 16);
    const ridx: number[] = [];
    for (let i = 0; i < n; i++) {
      this.rainOff[i * 3] = (Math.random() - 0.5) * 70;
      this.rainOff[i * 3 + 1] = Math.random() * 32;
      this.rainOff[i * 3 + 2] = (Math.random() - 0.5) * 70;
      // oben durchsichtig, unten hell
      rcol.set([0.8, 0.86, 0.95, 0.0, 0.8, 0.86, 0.95, 0.0, 0.8, 0.86, 0.95, 0.5, 0.8, 0.86, 0.95, 0.5], i * 16);
      ridx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    rg.setAttribute('color', new THREE.BufferAttribute(rcol, 4));
    rg.setIndex(ridx);
    this.rain = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  // ---------- Schnittstelle zur Rennansicht ----------
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.renderer.setPixelRatio(Math.max(0.5, Math.min(window.devicePixelRatio || 1, this.opts.quality === 'high' ? 1.5 : 1.25) * this.dprScale));
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  updateRacingLine(car: CarSim) {
    const g = this.geo;
    const prof = car.ai.profile;
    const cnt = Math.floor(g.n / 3);
    // Geometrie nur einmal anlegen, danach nur die Farben (Bremszonen) in place aktualisieren: keine Speicher- und GPU-Zuweisungen pro Sekunde
    if (!this.lineDots) {
      const pos = new Float32Array(cnt * 3);
      for (let k = 0; k < cnt; k++) {
        const i = k * 3;
        pos[k * 3] = g.x[i] + g.nx[i] * g.lineOff[i];
        pos[k * 3 + 1] = 0.09;
        pos[k * 3 + 2] = g.y[i] + g.ny[i] * g.lineOff[i];
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cnt * 3), 3));
      this.lineDots = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, map: this.soft, alphaTest: 0.05 }));
      this.lineDots.frustumCulled = false;
      this.scene.add(this.lineDots);
    }
    const col = this.lineDots.geometry.getAttribute('color') as THREE.BufferAttribute;
    const arr = col.array as Float32Array;
    let changed = false;
    for (let k = 0; k < cnt; k++) {
      const i = k * 3;
      const j = wrapIndex(i + 6, g.n);
      const brake = prof[j] < prof[i] - 0.8;
      const r = brake ? 1 : 0.314, gg = brake ? 0.275 : 0.902, b = brake ? 0.275 : 0.549;
      if (arr[k * 3] !== r || arr[k * 3 + 1] !== gg || arr[k * 3 + 2] !== b) {
        arr[k * 3] = r;
        arr[k * 3 + 1] = gg;
        arr[k * 3 + 2] = b;
        changed = true;
      }
    }
    if (changed) col.needsUpdate = true;
    this.lineKey++;
  }

  private applyWeather(kind: WeatherKind, dt: number) {
    const p = SKY[kind];
    const k = Math.min(1, dt * 0.7);
    this.cur.top.lerp(this.tmpColor.set(p.top), k);
    this.cur.hor.lerp(this.tmpColor.set(p.hor), k);
    this.cur.sun += (p.sun - this.cur.sun) * k;
    this.cur.hemi += (p.hemi - this.cur.hemi) * k;
    this.cur.fogNear += (p.fogNear - this.cur.fogNear) * k;
    this.cur.fogFar += (p.fogFar - this.cur.fogFar) * k;
    this.cur.rain += (p.rain - this.cur.rain) * k;
    this.cur.env += (p.env - this.cur.env) * k;
    this.skyMat.uniforms.top.value.copy(this.cur.top);
    this.skyMat.uniforms.hor.value.copy(this.cur.hor);
    this.skyMat.uniforms.sunAmt.value = Math.max(0, (this.cur.sun - 0.6) / 1.9);
    this.fog.color.copy(this.cur.hor);
    this.fog.near = this.cur.fogNear;
    this.fog.far = this.cur.fogFar;
    this.sun.intensity = this.cur.sun;
    this.hemi.intensity = this.cur.hemi;
    this.scene.environmentIntensity = this.cur.env;
    const wet = this.eng.wetness;
    this.asphaltMat.color.setScalar(1 - wet * 0.42);
    this.asphaltMat.roughness = 0.92 - wet * 0.58;
  }

  render(focus: CarSim | null, dt: number) {
    if (this.lost) return;
    const eng = this.eng;
    const f = focus ?? eng.cars[0];
    if (!f) return;
    dt = clamp(dt, 0, 0.1);
    this.adaptQuality(dt);
    this.time += dt;
    this.applyWeather(eng.weatherNow, dt);
    this.updateCamera(f, dt);
    this.updateCars(f, dt);
    this.updatePit(dt);
    this.updatePitGuide(f);
    this.updateEffects(f, dt);
    this.updateSun(f);
    this.renderer.render(this.scene, this.camera);
  }

  /** Läuft das Spiel zu langsam, wird die Auflösung (und zuletzt der Schattenwurf) schrittweise gesenkt, damit die Fahrt flüssig bleibt */
  private adaptQuality(dt: number) {
    if (dt <= 0) return;
    this.frameEma += (dt - this.frameEma) * 0.08;
    this.lastScaleChange += dt;
    if (this.frameEma > 0.026) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 70 && this.lastScaleChange > 2.5) {
      this.slowFrames = 0;
      this.lastScaleChange = 0;
      if (this.dprScale > 0.56) {
        this.dprScale = Math.max(0.55, this.dprScale - 0.18);
        this.resize();
      } else if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
        this.sun.castShadow = false;
        this.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
          else if (m) m.needsUpdate = true;
        });
      }
    }
  }

  private updateSun(f: CarSim) {
    this.sun.position.set(f.x + 42, 74, f.y + 30);
    this.sun.target.position.set(f.x, 0, f.y);
    this.sky.position.copy(this.camera.position);
  }

  private updateCamera(f: CarSim, dt: number) {
    const mode = this.opts.camera;
    const cfg = CAM[mode];
    if (!this.camInit || mode !== this.lastMode) {
      this.camH = f.h;
      this.camInit = true;
      this.lastMode = mode;
      this.camPrev.set(f.x, 0, f.y);
    }
    const dh = wrapAngle(f.h - this.camH);
    this.camH += dh * (1 - Math.exp(-dt * cfg.lag));
    const vmax = Math.max(40, f.cfg.car.vmax);
    const sp = clamp(f.speed / vmax, 0, 1.2);
    const fovT = cfg.fov + sp * (mode === 'cockpit' ? 8 : 14) + (f.boost ? 4 : 0);
    this.fov += (fovT - this.fov) * (1 - Math.exp(-dt * 4));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    const fx = Math.cos(this.camH);
    const fz = Math.sin(this.camH);
    // Erschütterungen: Randsteine, Gras, Einschläge
    const rough = (f.offTrack === 2 ? 1 : f.offTrack === 1 ? 0.35 : 0) * Math.min(1, f.speed / 30);
    this.shake += ((rough + (hasHit(this.eng) ? 1.5 : 0)) - this.shake) * Math.min(1, dt * 10);
    const sx = (Math.sin(this.time * 61) + Math.sin(this.time * 37)) * 0.5 * this.shake * 0.05;
    const sy = (Math.sin(this.time * 53) + Math.sin(this.time * 71)) * 0.5 * this.shake * 0.04;
    if (mode === 'cockpit') {
      this.camPos.set(f.x - fx * 0.1, cfg.h + sy, f.y - fz * 0.1);
      this.camera.position.copy(this.camPos);
      this.tmp.set(f.x + fx * cfg.look, cfg.ly, f.y + fz * cfg.look);
    } else {
      const dist = cfg.dist + f.speed * 0.012;
      const h = cfg.h + sp * 0.35;
      this.camPos.set(f.x - fx * dist, h + sy, f.y - fz * dist);
      this.camera.position.set(this.camPos.x - fz * sx, this.camPos.y, this.camPos.z + fx * sx);
      this.tmp.set(f.x + fx * cfg.look, cfg.ly, f.y + fz * cfg.look);
    }
    this.camera.lookAt(this.tmp);
    // Neigung in Kurven
    const vis = this.carVis.get(f.cfg.id);
    if (vis) this.camera.rotateZ(clamp(-vis.yaw * 0.025, -0.07, 0.07));
    this.camVel.copy(this.camera.position).sub(this.camPrev).multiplyScalar(dt > 0 ? 1 / dt : 0);
    this.camPrev.copy(this.camera.position);
  }

  private updateCars(focus: CarSim, dt: number) {
    const cockpit = this.opts.camera === 'cockpit';
    const cam = this.camera.position;
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    for (const c of this.eng.cars) {
      const v = this.carVis.get(c.cfg.id);
      if (!v) continue;
      const p = v.parts;
      p.root.position.set(c.x, 0, c.y);
      p.root.rotation.y = -c.h;
      if (dt > 0) {
        const dh = wrapAngle(c.h - v.h) / dt;
        v.yaw += (clamp(dh, -3, 3) - v.yaw) * Math.min(1, dt * 8);
      }
      v.h = c.h;
      const latAcc = v.yaw * c.speed;
      const rollT = -clamp(latAcc * 0.0021, -0.07, 0.07);
      const pitchT = -c.brake * Math.min(1, c.speed / 30) * 0.04 + c.throttle * 0.014 * (c.speed < 45 ? 1 : 0.4);
      const k = Math.min(1, dt * 7);
      v.roll += (rollT - v.roll) * k;
      v.pitch += (pitchT - v.pitch) * k;
      p.tilt.rotation.set(v.roll, 0, v.pitch);
      // Wagenheber: Auto hebt sich während des Reifenwechsels
      let lift = 0;
      if (c.pit === 'stopped' && c.pitTotal > 0) lift = 0.13 * clamp(Math.min((c.pitTotal - c.pitTimer) / 0.45, c.pitTimer / 0.45), 0, 1);
      p.tilt.position.y = lift;
      v.wheelA += (c.speed * dt) / 0.34;
      for (const w of p.wheels) {
        w.spin.rotation.z = -v.wheelA;
        if (w.front) w.steer.rotation.y = -c.steer * 0.42;
      }
      const braking = c.brake > 0.2 && c.speed > 2;
      (p.brakeLight.material as THREE.MeshBasicMaterial).color.setHex(braking ? 0xff2a2a : 0x4a0a0a);
      p.flame.visible = c.boost;
      if (c.boost) p.flame.scale.set(0.7 + Math.random() * 0.6, 0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4);
      const dmg = c.damage.frontWing;
      p.wing.scale.z = 1 - dmg * 0.55;
      p.wing.rotation.z = -dmg * 0.1;
      p.wing.visible = dmg < 0.97;
      const col = COMPOUNDS[c.tyre.compound].color;
      if (col !== v.ring) {
        v.ring = col;
        for (const w of p.wheels) (w.ring.material as THREE.MeshBasicMaterial).color.set(col);
      }
      // Eigenes Auto im Cockpit: Karosserie ausblenden, Flügel und Vorderräder bleiben sichtbar
      const own = c === focus && cockpit;
      p.body.visible = !own;
      p.helmet.visible = !own;
      p.brakeLight.visible = !own;
      for (const w of p.wheels) w.root.visible = !(own && !w.front);
      // Namensschild
      const d = Math.hypot(c.x - cam.x, c.y - cam.z);
      const show = c !== focus && !c.dnf && d > 8 && d < 80;
      v.tag.visible = show;
      if (show) {
        v.tag.position.set(c.x, 1.9, c.y);
        const sy = (d < 40 ? 0.034 : 0.026) * 2 * tanHalf;
        v.tag.scale.set(sy * 3.6, sy, 1);
      }
    }
  }

  private updateEffects(f: CarSim, dt: number) {
    const eng = this.eng;
    const cam = this.camera.position;
    const scale = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.smoke.uniforms.uScale.value = scale;
    this.sparks.uniforms.uScale.value = scale;

    // Gischt, Staub und Reifenrauch hinter nahen Autos
    let emitted = 0;
    const white = this.tmpColor;
    for (const c of eng.cars) {
      if (c.dnf || emitted > 14) continue;
      const d = Math.hypot(c.x - cam.x, c.y - cam.z);
      if (d > 90) continue;
      const fx = Math.cos(c.h), fz = Math.sin(c.h);
      if (eng.wetness > 0.15 && c.speed > 22) {
        for (let i = 0; i < 1; i++) {
          white.set('#dfe8f0');
          const side = (Math.random() - 0.5) * 1.6;
          this.smoke.emit(c.x - fx * 2.6 - fz * side, 0.35, c.y - fz * 2.6 + fx * side, -fx * c.speed * 0.12 + (Math.random() - 0.5), 1.2 + Math.random(), -fz * c.speed * 0.12 + (Math.random() - 0.5), 0.7, 1.05, white, Math.min(0.22, eng.wetness * 0.3));
          emitted++;
        }
      }
      if (c.offTrack === 2 && c.speed > 8) {
        white.set(this.track.street ? '#9aa1a6' : this.track.scenery === 'dry' ? '#c9b07a' : '#7e8f66');
        const side = (Math.random() - 0.5) * 1.8;
        this.smoke.emit(c.x - fx * 1.6 - fz * side, 0.2, c.y - fz * 1.6 + fx * side, -fx * c.speed * 0.1, 1.4, -fz * c.speed * 0.1, 0.9, 1.4, white, 0.5);
        emitted++;
      }
      if (c.slide > 0.45 && c.speed > 12) {
        white.set('#e2e2e2');
        for (const s of [-0.85, 0.85]) this.smoke.emit(c.x - fx * 1.5 - fz * s, 0.25, c.y - fz * 1.5 + fx * s, -fx * 2, 0.8, -fz * 2, 0.7, 1.3, white, 0.32);
        emitted++;
      }
    }
    this.smoke.update(dt);

    // Funken aus der Engine
    const col = this.tmpColor.set('#ffcf6b');
    for (let i = 0; i < Math.min(40, eng.sparks.length); i++) {
      const s = eng.sparks[i];
      if (s.life > 0.45) this.sparks.emit(s.x, 0.3, s.y, s.vx * 0.5, 2 + Math.random() * 3, s.vy * 0.5, 0.45, 0.16, col, 1);
    }
    this.sparks.update(dt);

    // Reifenspuren: ohne temporäre Arrays direkt in die Puffer schreiben, die Fläche nur gelegentlich auffrischen
    const skids = eng.skids;
    this.skidTick++;
    if (this.skidTick % 4 === 0 || skids.length !== this.skidLen) {
      this.skidLen = skids.length;
      const m = Math.min(skids.length, 900);
      const sp = this.skidPos, sc = this.skidCol;
      let q = 0;
      for (let i = 0; i < m; i++) {
        const s = skids[skids.length - m + i];
        if (s.life <= 0) continue;
        const cx = Math.cos(s.h), cy = Math.sin(s.h);
        const nx = -cy, ny = cx;
        const al = Math.min(1, s.life) * 0.5;
        for (let side = -0.8; side < 1; side += 1.6) {
          const ax = s.x - cx * 1.6 + nx * side, ay = s.y - cy * 1.6 + ny * side;
          const bx = s.x - cx * 0.2 + nx * side, by = s.y - cy * 0.2 + ny * side;
          const o = q * 12;
          sp[o] = ax - nx * 0.17; sp[o + 1] = 0.045; sp[o + 2] = ay - ny * 0.17;
          sp[o + 3] = ax + nx * 0.17; sp[o + 4] = 0.045; sp[o + 5] = ay + ny * 0.17;
          sp[o + 6] = bx - nx * 0.17; sp[o + 7] = 0.045; sp[o + 8] = by - ny * 0.17;
          sp[o + 9] = bx + nx * 0.17; sp[o + 10] = 0.045; sp[o + 11] = by + ny * 0.17;
          const co = q * 16;
          for (let k = 0; k < 4; k++) {
            sc[co + k * 4] = 0.02;
            sc[co + k * 4 + 1] = 0.02;
            sc[co + k * 4 + 2] = 0.02;
            sc[co + k * 4 + 3] = al;
          }
          q++;
        }
      }
      this.skidMesh.geometry.setDrawRange(0, q * 6);
      (this.skidMesh.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.skidMesh.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // Regen
    const intensity = this.cur.rain;
    this.rain.visible = intensity > 0.03;
    if (this.rain.visible) {
      const n = this.rainOff.length / 3;
      const act = Math.round(n * Math.min(1, intensity));
      const cvx = this.camVel.x, cvz = this.camVel.z;
      for (let i = 0; i < act; i++) {
        let ox = this.rainOff[i * 3] - cvx * dt, oy = this.rainOff[i * 3 + 1] - 28 * dt, oz = this.rainOff[i * 3 + 2] - cvz * dt;
        if (oy < 0) oy += 32;
        if (ox < -35) ox += 70; else if (ox > 35) ox -= 70;
        if (oz < -35) oz += 70; else if (oz > 35) oz -= 70;
        this.rainOff[i * 3] = ox; this.rainOff[i * 3 + 1] = oy; this.rainOff[i * 3 + 2] = oz;
        const x = cam.x + ox, y = oy, z = cam.z + oz;
        // Breite quer zur Blickrichtung
        const dx = cam.x - x, dz = cam.z - z;
        const dl = Math.hypot(dx, dz) || 1;
        const wx = (-dz / dl) * 0.025, wz = (dx / dl) * 0.025;
        const len = 1.5 + intensity * 0.5;
        const rp = this.rainPos, ro = i * 12;
        rp[ro] = x - wx; rp[ro + 1] = y + len; rp[ro + 2] = z - wz;
        rp[ro + 3] = x + wx; rp[ro + 4] = y + len; rp[ro + 5] = z + wz;
        rp[ro + 6] = x - wx; rp[ro + 7] = y; rp[ro + 8] = z - wz;
        rp[ro + 9] = x + wx; rp[ro + 10] = y; rp[ro + 11] = z + wz;
      }
      this.rain.geometry.setDrawRange(0, act * 6);
      (this.rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    if (this.lineDots) this.lineDots.visible = this.opts.showLine;
    void f;
  }

  // Minikarte in einen eigenen Canvas zeichnen
  renderMini(canvas: HTMLCanvasElement, focus: CarSim | null) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const g = this.geo;
    if (!this.miniPath) {
      const p = new Path2D();
      for (let i = 0; i <= g.n; i += 4) {
        const ii = wrapIndex(i, g.n);
        if (i === 0) p.moveTo(g.x[ii], g.y[ii]);
        else p.lineTo(g.x[ii], g.y[ii]);
      }
      p.closePath();
      this.miniPath = p;
    }
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
    ctx.stroke(this.miniPath);
    ctx.strokeStyle = 'rgba(232,238,241,0.85)';
    ctx.lineWidth = 2.6 / sc;
    ctx.stroke(this.miniPath);
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

  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const x of list) {
        for (const key of Object.keys(x)) {
          const val = (x as any)[key];
          if (val && val.isTexture) val.dispose();
        }
        x.dispose();
      }
    });
    for (const v of this.carVis.values()) v.parts.dispose();
    this.assets.dispose();
    this.soft.dispose();
    (this.scene.environment as THREE.Texture | null)?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

// Stärkere Einschläge in der Engine lassen die Kamera kurz wackeln
function hasHit(e: RaceEngine) {
  return e.collisionsThisFrame > 3;
}
