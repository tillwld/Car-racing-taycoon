// Spielstand im Browser (localStorage) mit Absicherung für private Fenster und blockierten Speicher.
import type { GameState } from '../types';
import { DEFAULT_SETTINGS, SAVE_VERSION, emptyStats } from './state';
import { MISSIONS, PLOTS } from './tycoon';
import { TIPS } from '../data/tips';

const KEY = 'apex-rennstall-save';
const SETTINGS_KEY = 'apex-rennstall-settings';

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGame(s: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s.settings));
    return true;
  } catch {
    return false;
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
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
