// Prozedurale Texturen für die 3D-Rennansicht: keine Bilddateien nötig.
import * as THREE from 'three';

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(c: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat !== false) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 4;
  return t;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Körnige Fläche (Asphalt, Gras, Sand): Grundfarbe mit Rauschen und weichen Flecken */
export function noiseTexture(base: string, amp: number, aniso = 4, seed = 1, size = 256) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const r = rng(seed);
  // große weiche Flecken
  for (let i = 0; i < 40; i++) {
    const x = r() * size, y = r() * size, rad = 20 + r() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const v = r() < 0.5 ? 0 : 255;
    g.addColorStop(0, `rgba(${v},${v},${v},${amp * 0.0014})`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Feinkorn
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amp;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { aniso });
}

/** Randstein: rot-weiße Streifen quer zur Fahrtrichtung (Länge entlang v) */
export function kerbTexture() {
  const c = makeCanvas(32, 128);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e9e9e9';
  ctx.fillRect(0, 0, 32, 128);
  ctx.fillStyle = '#d4232f';
  ctx.fillRect(0, 0, 32, 64);
  return finish(c, { aniso: 4 });
}

export function checkerTexture(cols: number, rows: number) {
  const c = makeCanvas(cols * 16, rows * 16);
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#101214' : '#f4f4f4';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  const t = finish(c, { repeat: false, aniso: 4 });
  return t;
}

export function bannerTexture(text: string, bg: string, fg: string) {
  const c = makeCanvas(512, 128);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = -2; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 80, 128);
    ctx.lineTo(i * 80 + 60, 0);
    ctx.lineTo(i * 80 + 90, 0);
    ctx.lineTo(i * 80 + 30, 128);
    ctx.fill();
  }
  ctx.fillStyle = fg;
  let fs = 74;
  ctx.font = `800 ${fs}px "Saira Condensed", "Arial Narrow", Arial, sans-serif`;
  while (fs > 28 && ctx.measureText(text).width > 470) {
    fs -= 4;
    ctx.font = `800 ${fs}px "Saira Condensed", "Arial Narrow", Arial, sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  return finish(c, { repeat: false, aniso: 4 });
}

/** Bremsschild: 1 bis 3 senkrechte Streifen */
export function boardTexture(n: number) {
  const c = makeCanvas(128, 192);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, 128, 192);
  ctx.strokeStyle = '#1b1f23';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 186);
  ctx.fillStyle = n === 1 ? '#d4232f' : '#1b1f23';
  const w = 18;
  const gap = 14;
  const total = n * w + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(64 - total / 2 + i * (w + gap) + w / 2, 96);
    ctx.rotate(0.38);
    ctx.fillRect(-w / 2, -80, w, 160);
    ctx.restore();
  }
  return finish(c, { repeat: false, aniso: 4 });
}

export function fenceTexture() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(200,210,218,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(64, 64);
  ctx.moveTo(64, 0); ctx.lineTo(0, 64);
  ctx.stroke();
  const t = finish(c, { aniso: 2 });
  return t;
}

export function crowdTexture() {
  const c = makeCanvas(256, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(0, 0, 256, 64);
  const r = rng(77);
  const cols = ['#c9544b', '#4a74b8', '#d9b45a', '#cfcfcf', '#4f9a70', '#9c6fb0', '#d98a54', '#86b4cf'];
  for (let i = 0; i < 520; i++) {
    ctx.fillStyle = cols[Math.floor(r() * cols.length)];
    ctx.fillRect(r() * 256, r() * 64, 4, 4);
  }
  return finish(c, { aniso: 2 });
}

export function softDotTexture() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return finish(c, { repeat: false });
}

/** Namensschild für Sprites */
export function tagTexture(text: string, bg: string, fg: string) {
  const c = makeCanvas(160, 44);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  const r = 10;
  ctx.beginPath();
  ctx.moveTo(r, 2);
  ctx.arcTo(158, 2, 158, 42, r);
  ctx.arcTo(158, 42, 2, 42, r);
  ctx.arcTo(2, 42, 2, 2, r);
  ctx.arcTo(2, 2, 158, 2, r);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = '700 26px "Chivo Mono", ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 80, 24);
  return finish(c, { repeat: false, aniso: 1 });
}

/** Bande: Reifenstapel oder Betonmauer mit rot-weißem Streifen. u läuft über die Höhe, v entlang der Strecke */
export function barrierTexture(street: boolean) {
  const c = makeCanvas(256, 64);
  const ctx = c.getContext('2d')!;
  if (street) {
    ctx.fillStyle = '#b8bfc4';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 2, 64);
    for (let x = 0; x < 256; x += 32) {
      ctx.fillStyle = (x / 32) % 2 ? '#d4232f' : '#f1f1f1';
      ctx.fillRect(x, 38, 32, 20);
    }
  } else {
    ctx.fillStyle = '#14161a';
    ctx.fillRect(0, 0, 256, 64);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 8; col++) {
        const cx = col * 32 + 16 + (row % 2 ? 16 : 0);
        const cy = 11 + row * 21;
        ctx.strokeStyle = '#3b4148';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 11, 8.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#0a0b0d';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 4.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.fillStyle = 'rgba(240,240,240,0.85)';
    for (let x = 0; x < 256; x += 96) ctx.fillRect(x, 0, 22, 64);
  }
  // Die Textur ist quer gezeichnet: 90° gedreht, damit die lange Seite entlang der Strecke liegt
  const rot = makeCanvas(64, 256);
  const rc = rot.getContext('2d')!;
  rc.translate(0, 256);
  rc.rotate(-Math.PI / 2);
  rc.drawImage(c, 0, 0);
  return finish(rot, { aniso: 4 });
}
