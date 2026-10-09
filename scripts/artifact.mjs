// Macht aus dem Single-File-Build eine Seite ohne eigenes HTML-Gerüst (für gehostete Einzelseiten).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const links = [...html.matchAll(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g)].map((m) => m[0]).join('\n');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
// Externe Skripte (z. B. die Portal-SDK) gehören nicht in die gehostete Einzelseite
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0].replace(/ crossorigin/g, '')).filter((x) => !/<script[^>]+src=["']https?:/i.test(x));
if (!scripts.length) throw new Error('Kein Skript im Build gefunden');
const page = [title, links, styles, '<div id="root"></div>', ...scripts].join('\n');
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/apex-rennstall.html', page);
console.log('artifact/apex-rennstall.html', (page.length / 1024).toFixed(0), 'KB');
