// Erzeugt Cover (512x512, 1080x1920, 1920x1080) und vier Screenshots aus dem gebauten Portal-Spiel (dist-portal/) nach store/.
// Aufruf: npm run build:portal && node scripts/make-store-assets.mjs
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(new URL('..', import.meta.url).pathname);
const dist = join(root, 'dist-portal');
const out = join(root, 'store');
mkdirSync(out, { recursive: true });
if (!existsSync(join(dist, 'index.html'))) throw new Error('dist-portal fehlt: erst npm run build:portal');

// Spielstand mit der echten Spiellogik erzeugen
const tmp = mkdtempSync(join(tmpdir(), 'store-'));
await build({
  stdin: { contents: `export { createQuickGame } from './src/game/start'; export { TIPS } from './src/data/tips';`, resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: join(tmp, 'g.mjs'), logLevel: 'silent',
});
const { createQuickGame, TIPS } = await import(pathToFileURL(join(tmp, 'g.mjs')).href);
rmSync(tmp, { recursive: true, force: true });
const g = createQuickGame({ name: 'Nova Racing', short: 'NOV', color: '#e4572e', color2: '#ffffff', logo: 'shield', region: 'europe' });
g.stats.races = 6; g.money = 640000; g.reputation = 34;
for (const id of ['kiosk', 'fanshop', 'workshop', 'sponsorLounge', 'setupLab', 'grandstand', 'tireDepot']) g.plots[id] = 1;
g.plots.kiosk = 3; g.plots.fanshop = 2;
for (const k of Object.keys(TIPS)) g.tipsSeen[k] = true;
g.flags.tipQueue = [];
const save = JSON.stringify({ ...g, savedAt: Date.now() });

// kleiner Dateiserver für dist-portal
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = join(dist, decodeURIComponent((req.url || '/').split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!p.startsWith(dist) || !existsSync(p) || !statSync(p).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(8123, r));
const base = 'http://localhost:8123/';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'en-US' });
await ctx.addInitScript((s) => { localStorage.setItem('apex-rennstall-save', s); localStorage.setItem('apex-rennstall-lang', 'en'); }, save);
const page = await ctx.newPage();
await page.route('https://bridge.playgama.com/**', (r) => r.abort());
await page.goto(base);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /continue/i }).first().click();
await page.waitForTimeout(4000);
await page.screenshot({ path: join(out, 'screenshot-1-team-grounds.png') });

const dismiss = async () => {
  for (let i = 0; i < 6 && (await page.locator('.modal-bg').count()); i++) {
    const x = page.locator('.modal-bg .modal-x').first();
    if (await x.count()) await x.click(); else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
};
const open = async (re) => {
  await dismiss();
  await page.getByRole('button', { name: /quick access/i }).click();
  await page.waitForTimeout(300);
  await page.locator('.hub-quick-item', { hasText: re }).first().click();
  await page.waitForTimeout(1400);
};
const back = async () => { await page.locator('.panel-head button', { hasText: /back to/i }).click(); await page.waitForTimeout(400); };

// Werkstatt
await open(/workshop/i);
await page.screenshot({ path: join(out, 'screenshot-3-garage.png') });
await back();

// Ergebnis: Rennen simulieren (schnell), Ergebnisbildschirm aufnehmen, weiter
await open(/team truck/i);
await page.getByRole('button', { name: /simulate race/i }).first().click();
await page.waitForSelector('text=/Result · Round/', { timeout: 280000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: join(out, 'screenshot-4-result.png') });
await page.getByRole('button', { name: /^continue$/i }).first().click();
await page.waitForTimeout(1500);

// Rennen: selbst fahren, kurz nach dem Start
await open(/team truck/i);
await page.getByRole('button', { name: /drive the race/i }).first().click();
await page.waitForSelector('.race-root', { timeout: 60000 });
await page.waitForSelector('.lights', { state: 'detached', timeout: 300000 });
await page.keyboard.down('w');
await page.waitForTimeout(25000);
await page.screenshot({ path: join(out, 'screenshot-2-race.png') });
await page.keyboard.up('w');
const raceShot = readFileSync(join(out, 'screenshot-2-race.png')).toString('base64');

// Cover
const idx = readFileSync(join(dist, 'index.html'), 'utf8');
const css = idx.match(/href="(\.\/assets\/[^"]+\.css)"/)[1];
const NAME = (readFileSync(join(root, 'src/config.ts'), 'utf8').match(/GAME_NAME = '([^']+)'/) || [])[1] || 'Game';
const [first, ...rest] = NAME.split(' ');
const coverHtml = (w, h) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${base}${css.slice(2)}"><style>
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#0b1114}
.c{position:relative;width:${w}px;height:${h}px;overflow:hidden;font-family:var(--font-display)}
.c img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 62%;filter:saturate(1.15) contrast(1.05)}
.c:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,12,14,.15) 0%,rgba(8,12,14,.05) 35%,rgba(8,12,14,.78) 100%)}
.t{position:absolute;left:0;right:0;bottom:${Math.round(h * 0.07)}px;z-index:2;text-align:center;color:#fff;text-transform:uppercase;text-shadow:0 6px 30px rgba(0,0,0,.6)}
.t b{display:block;font-weight:800;font-size:${Math.round(Math.min(w, h * 1.2) * 0.17)}px;line-height:.92;letter-spacing:.02em}
.t b em{font-style:normal;color:#ff6a3d}
.t span{display:block;margin-top:${Math.round(h * 0.02)}px;font-weight:700;font-size:${Math.round(Math.min(w, h * 1.2) * 0.04)}px;letter-spacing:.32em}
</style></head><body><div class="c"><img src="data:image/png;base64,${raceShot}"><div class="t"><b>${first}${rest.length ? `<br><em>${rest.join(' ')}</em>` : ''}</b><span>Race · Build · Win</span></div></div></body></html>`;
for (const [w, h, name] of [[512, 512, 'cover-512x512.png'], [1080, 1920, 'cover-1080x1920.png'], [1920, 1080, 'cover-1920x1080.png']]) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: h });
  await p.route(`${base}__cover.html`, (r) => r.fulfill({ contentType: 'text/html', body: coverHtml(w, h) }));
  await p.goto(`${base}__cover.html`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(out, name) });
  await p.close();
}
await browser.close();
server.close();
console.log('Fertig:', out);
