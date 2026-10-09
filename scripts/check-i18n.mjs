// Prüft die Sprachdateien: gleiche Schlüssel in de und en, gleiche Platzhalter, alle im Code benutzten Schlüssel vorhanden.
// Aufruf: node scripts/check-i18n.mjs [Schlüsselpräfix ...]   (mit Präfixen werden nur diese Schlüssel geprüft)
import { build } from 'esbuild';
import { readdirSync, readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const prefixes = process.argv.slice(2);
const tmp = mkdtempSync(join(tmpdir(), 'i18n-'));

async function load(name) {
  const out = join(tmp, `${name}.mjs`);
  await build({ entryPoints: [join(root, 'src/i18n', `${name}.ts`)], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' });
  return (await import(pathToFileURL(out).href))[name];
}

const de = await load('de');
const en = await load('en');
rmSync(tmp, { recursive: true, force: true });

const want = (k) => !prefixes.length || prefixes.some((p) => k.startsWith(p));
const ph = (s) => [...s.matchAll(/\{([a-zA-Z0-9_]+)(?::[a-zA-Z0-9]+)?\}/g)].map((m) => m[1]).filter((x) => x !== 'game').sort().join(',');
let errors = 0;
const err = (m) => { errors++; console.log('FEHLER', m); };

for (const k of Object.keys(de)) if (want(k) && !(k in en)) err(`en fehlt: ${k}`);
for (const k of Object.keys(en)) if (want(k) && !(k in de)) err(`de fehlt: ${k}`);
for (const k of Object.keys(de)) {
  if (!want(k) || !(k in en)) continue;
  if (typeof de[k] !== 'string' || typeof en[k] !== 'string') err(`kein Text: ${k}`);
  else if (ph(de[k]) !== ph(en[k])) err(`Platzhalter unterschiedlich bei ${k}: de {${ph(de[k])}} en {${ph(en[k])}}`);
  else if (!en[k].trim()) err(`en leer: ${k}`);
}

// Benutzte Schlüssel im Code
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (!p.includes('/src/i18n')) walk(p); }
    else if (/\.(ts|tsx)$/.test(f)) files.push(p);
  }
})(join(root, 'src'));
const used = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\b(t|tIn|m)\(\s*(?:'lang'\s*,\s*)?'([a-zA-Z0-9_.\-]+)'/g)) used.add(m[2]);
  for (const m of src.matchAll(/\b(tp|mp)\(\s*'([a-zA-Z0-9_.\-]+)'/g)) { used.add(`${m[2]}.one`); used.add(`${m[2]}.other`); }
}
for (const k of used) if (want(k) && !(k in de)) err(`im Code benutzt, aber nicht in de: ${k}`);
const unused = Object.keys(de).filter((k) => want(k) && !used.has(k));
console.log(`${Object.keys(de).length} Schlüssel de, ${Object.keys(en).length} en, ${used.size} im Code gefunden, ${unused.length} nicht direkt referenziert (dynamische Schlüssel möglich)`);
if (process.env.SHOW_UNUSED) console.log(unused.join('\n'));
console.log(errors ? `${errors} Fehler` : 'OK');
process.exit(errors ? 1 : 0);
