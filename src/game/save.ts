// Spielstand im Browser (localStorage) mit Absicherung für private Fenster und blockierten Speicher.
import type { GameState } from '../types';
import { DEFAULT_SETTINGS, SAVE_VERSION, emptyStats } from './state';
import { MISSIONS, PLOTS } from './tycoon';
import { TIPS } from '../data/tips';
import { cloud } from './cloud';
import { store } from '../platform/storage';
import { LANG_KEY } from '../platform/prefs';

const KEY = 'apex-rennstall-save';
const BACKUP_KEY = 'apex-rennstall-save-backup';
const DELETED_KEY = 'apex-rennstall-save-deleted';
const SETTINGS_KEY = 'apex-rennstall-settings';
let lastBackup = 0;

/** Alle Schlüssel, die beim Start in einem Aufruf aus dem Plattformspeicher geladen werden */
export const STORAGE_KEYS = [KEY, BACKUP_KEY, DELETED_KEY, SETTINGS_KEY, LANG_KEY];

/** Spielstand als Text mit Zeitstempel (für Browser, Datei und Artifact-Speicher) */
export function serialize(s: GameState, savedAt = Date.now()): string {
  return JSON.stringify({ ...s, savedAt });
}

export function parseSave(json: string): GameState | null {
  try {
    return migrate(JSON.parse(json));
  } catch {
    return null;
  }
}

export function loadGame(): GameState | null {
  // Erst der aktuelle Stand, bei Beschädigung die Sicherheitskopie
  for (const key of [KEY, BACKUP_KEY]) {
    try {
      const raw = store.get(key);
      if (!raw) continue;
      const g = migrate(JSON.parse(raw));
      if (g) return g;
    } catch {
      /* nächste Kopie versuchen */
    }
  }
  return null;
}

export function saveGame(s: GameState): boolean {
  try {
    const now = Date.now();
    // Sicherheitskopie des vorherigen Stands, höchstens einmal pro Minute
    if (now - lastBackup > 60_000) {
      const prev = store.get(KEY);
      if (prev) store.set(BACKUP_KEY, prev);
      lastBackup = now;
    }
    const ok = store.set(KEY, serialize(s, now));
    store.set(SETTINGS_KEY, JSON.stringify(s.settings));
    return ok;
  } catch {
    return false;
  }
}

/** Bewusstes Löschen: Der Stand wandert in einen Papierkorb-Platz, damit man ihn wiederherstellen kann */
export function clearGame() {
  try {
    const raw = store.get(KEY);
    if (raw) store.set(DELETED_KEY, raw);
    store.remove(KEY);
    store.remove(BACKUP_KEY);
  } catch {
    /* nichts zu tun */
  }
  void cloud.clear();
}

export function deletedGame(): GameState | null {
  try {
    const raw = store.get(DELETED_KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function forgetDeletedGame() {
  try {
    store.remove(DELETED_KEY);
  } catch {
    /* nichts zu tun */
  }
}

/** Spielstand als Datei anbieten: im Artifact über den Speichern-Dialog von claude.ai, sonst als normaler Download */
export async function downloadSave(s: GameState): Promise<'saved' | 'declined' | 'error'> {
  const json = serialize(s);
  const slug = (s.team.short || 'team').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const filename = `apex-rennstall-${slug || 'team'}-saison${s.season}.json`;
  try {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<any> } }).claude;
    const dl = c && typeof c.use === 'function' ? await c.use('downloads') : null;
    if (dl) {
      await dl.save({ filename, data: json });
      return 'saved';
    }
  } catch (e) {
    if ((e as { code?: string })?.code === 'declined') return 'declined';
  }
  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    return 'saved';
  } catch {
    return 'error';
  }
}

export function loadSettings() {
  try {
    const raw = store.get(SETTINGS_KEY);
    if (raw) {
      const st = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      if (!['chase', 'high', 'cockpit'].includes(st.camera)) {
        // Einstellungen aus der alten Draufsicht-Version
        st.camera = 'chase';
        st.showLine = false;
      }
      delete st.viewDist;
      return st;
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function migrate(s: any): GameState | null {
  if (!s || typeof s !== 'object' || !s.team || !s.car) return null;
  s.created = s.created ?? true;
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) };
  s.stats = { ...emptyStats(), ...(s.stats ?? {}) };
  s.flags = s.flags ?? {};
  s.pendingEvents = s.pendingEvents ?? [];
  s.news = s.news ?? [];
  s.history = s.history ?? [];
  s.tipsSeen = s.tipsSeen ?? {};
  s.academy = s.academy ?? [];
  const old = (s.version ?? 0) < 4;
  s.plots = s.plots ?? {};
  s.lastTick = s.lastTick ?? Date.now();
  if (old) {
    // Spielstand aus der Menü-Version: alle Funktionen bleiben freigeschaltet, Einnahmequellen kann man nachbauen
    for (const id of Object.keys(PLOTS) as (keyof typeof PLOTS)[]) if (PLOTS[id].kind === 'feature') s.plots[id] = 1;
    s.flags.missions = Object.fromEntries(MISSIONS.map((m) => [m.id, true]));
    for (const id of Object.keys(TIPS)) s.tipsSeen[id] = true;
    s.tutorialDone = true;
    s.settings.showLine = false;
    s.settings.cornerHints = false;
  }
  if (!['chase', 'high', 'cockpit'].includes(s.settings.camera)) s.settings.camera = 'chase';
  delete (s.settings as any).viewDist;
  s.stats.passive = s.stats.passive ?? 0;
  if (s.weekend && (s.weekend.weather === undefined || s.weekend.setupHint === undefined)) s.weekend = null;
  s.version = SAVE_VERSION;
  return s as GameState;
}

export function exportSave(s: GameState): string {
  const json = JSON.stringify(s);
  return btoa(unescape(encodeURIComponent(json)));
}

export function importSave(text: string): GameState | null {
  try {
    const json = decodeURIComponent(escape(atob(text.trim())));
    return migrate(JSON.parse(json));
  } catch {
    try {
      return migrate(JSON.parse(text));
    } catch {
      return null;
    }
  }
}
