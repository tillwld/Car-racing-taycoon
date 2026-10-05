// Boxengasse auf der Minikarte: gelbe Linie entlang der Gasse und ein „P“ an der Einfahrt.
import type { RaceEngine } from './engine';
import { pointAt } from './trackGeometry';

const cache = new WeakMap<RaceEngine, Path2D>();

/** Der Zeichenkontext muss bereits in Streckenkoordinaten skaliert sein; sc ist der Maßstab (Pixel je Meter). */
export function drawMiniPit(ctx: CanvasRenderingContext2D, eng: RaceEngine, sc: number) {
  const g = eng.geo;
  const side = eng.pitSide;
  let path = cache.get(eng);
  if (!path) {
    path = new Path2D();
    for (let d = 0; d <= eng.pitLen; d += 12) {
      const p = pointAt(g, eng.pitIn + d, side * (g.halfWidth + 9));
      if (d === 0) path.moveTo(p.x, p.y);
      else path.lineTo(p.x, p.y);
    }
    cache.set(eng, path);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,210,70,0.95)';
  ctx.lineWidth = 3.2 / sc;
  ctx.stroke(path);
  // „P“ vor der Einfahrt, etwas abseits der Strecke
  const e = pointAt(g, eng.pitIn - 10, side * (g.halfWidth + 9 + 11 / sc));
  ctx.fillStyle = '#ffd246';
  ctx.beginPath();
  ctx.arc(e.x, e.y, 6.5 / sc, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#14181b';
  ctx.font = `800 ${9 / sc}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', e.x, e.y + 0.4 / sc);
  ctx.restore();
}
