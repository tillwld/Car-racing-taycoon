// Prüft dist-portal/ für Browsergame-Portale und packt es als ZIP (apex-rennstall-v1.0.0.zip) mit index.html im Hauptordner.
// Aufruf über: npm run build:portal
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;
const dir = join(root, 'dist-portal');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const SLUG = 'apex-rennstall';
const zipName = `${SLUG}-v${pkg.version}.zip`;

if (!existsSync(join(dir, 'index.html'))) throw new Error('dist-portal/index.html fehlt: erst bauen');

const files = [];
(function walk(d) {
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(dir);
const rel = (p) => relative(dir, p).split(sep).join('/');

// 1) Nur lateinische Dateinamen
const badNames = files.map(rel).filter((n) => !/^[A-Za-z0-9._\-\/]+$/.test(n));
if (badNames.length) throw new Error(`Dateinamen mit Sonderzeichen: ${badNames.join(', ')}`);

// 2) Keine Inhalte von außen: erlaubt ist nur das Playgama-Bridge-Skript (und reine Namensräume wie w3.org)
const allowed = [/^https:\/\/bridge\.playgama\.com\//, /^https?:\/\/www\.w3\.org\//, /^https:\/\/(?:reactjs|react)\.dev\b/, /^https:\/\/github\.com\//, /^https:\/\/threejs\.org\//, /^https:\/\/developer\.mozilla\.org\//, /^https:\/\/(?:www\.)?khronos\.org\//];
const external = new Map();
for (const f of files) {
  if (!/\.(html|css|js|mjs|json)$/.test(f)) continue;
  const txt = readFileSync(f, 'utf8');
  for (const m of txt.matchAll(/https?:\/\/[A-Za-z0-9.\-]+[^\s"'`)<>\\]*/g)) {
    const url = m[0];
    if (allowed.some((re) => re.test(url))) continue;
    external.set(`${rel(f)}  ${url.slice(0, 90)}`, true);
  }
}
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const scriptSrcs = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["'](https?:[^"']+)["']/g)].map((m) => m[1]);
const nonBridge = scriptSrcs.filter((u) => !u.startsWith('https://bridge.playgama.com/'));
if (nonBridge.length) throw new Error(`Externe Ressourcen in index.html: ${nonBridge.join(', ')}`);
if (/fonts\.(googleapis|gstatic)\.com/.test(files.map((f) => readFileSync(f, 'utf8')).join('\n'))) throw new Error('Google Fonts gefunden');
if (external.size) {
  console.log('Hinweis: weitere Adressen in Dateien (bitte prüfen, meist Kommentare/Namensräume):');
  for (const k of external.keys()) console.log('  ' + k);
}

// 3) ZIP schreiben (ohne Zusatzprogramme)
const parts = [];
const central = [];
let offset = 0;
const dosTime = (() => {
  const d = new Date('2026-01-01T00:00:00Z'); // fester Zeitstempel: gleiche Eingabe, gleiches ZIP
  return { time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1), date: ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate() };
})();
for (const f of files) {
  const name = Buffer.from(rel(f), 'utf8');
  const data = readFileSync(f);
  const comp = deflateRawSync(data, { level: 9 });
  const useDeflate = comp.length < data.length;
  const body = useDeflate ? comp : data;
  const crc = crc32(data) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8-Namen
  local.writeUInt16LE(useDeflate ? 8 : 0, 8);
  local.writeUInt16LE(dosTime.time, 10);
  local.writeUInt16LE(dosTime.date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  parts.push(local, name, body);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0);
  c.writeUInt16LE(20, 4);
  c.writeUInt16LE(20, 6);
  c.writeUInt16LE(0x0800, 8);
  c.writeUInt16LE(useDeflate ? 8 : 0, 10);
  c.writeUInt16LE(dosTime.time, 12);
  c.writeUInt16LE(dosTime.date, 14);
  c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(body.length, 20);
  c.writeUInt32LE(data.length, 24);
  c.writeUInt16LE(name.length, 28);
  c.writeUInt32LE(offset, 42);
  central.push(c, name);
  offset += local.length + name.length + body.length;
}
const cdSize = central.reduce((a, b) => a + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cdSize, 12);
end.writeUInt32LE(offset, 16);
writeFileSync(join(root, zipName), Buffer.concat([...parts, ...central, end]));
const total = files.reduce((a, f) => a + statSync(f).size, 0);
console.log(`${zipName}: ${files.length} Dateien, ${(total / 1024).toFixed(0)} KB entpackt, ${(statSync(join(root, zipName)).size / 1024).toFixed(0)} KB gepackt`);
