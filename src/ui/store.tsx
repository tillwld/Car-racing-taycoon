import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameState } from '../types';
import { loadGame, parseSave, saveGame, serialize } from '../game/save';
import { cloud } from '../game/cloud';
import { newAchievements } from '../game/state';
import { applyOffline, claimMissions, hasPendingMissions, incomePerSec } from '../game/tycoon';
import { sound } from '../audio/sound';
import { store } from '../platform/storage';
import { t, tx } from '../i18n';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'ach';
}

interface Ctx {
  game: GameState | null;
  update: (fn: (s: GameState) => string | null | void) => string | null;
  setGame: (g: GameState | null) => void;
  get: () => GameState | null;
  toast: (text: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
  saveOk: boolean;
  /** Zustand des Speicherns: im Browser und (im Artifact) im dauerhaften Speicher */
  saveInfo: SaveInfo;
  /** false, solange noch geprüft wird, ob es im Artifact-Speicher einen Spielstand gibt (höchstens ein paar Sekunden) */
  cloudChecked: boolean;
  /** Sofort in den dauerhaften Speicher schreiben */
  syncNow: () => Promise<boolean>;
  /** Spielstand aus dem dauerhaften Speicher holen und übernehmen */
  restoreFromCloud: () => Promise<boolean>;
  /** Pausiert das passive Einkommen (z. B. während eines Rennens) */
  setIncomePaused: (p: boolean) => void;
}

export interface SaveInfo {
  local: boolean;
  /** off = kein dauerhafter Speicher verfügbar, wait = schreibt/prüft gerade, ok = gesichert, error = fehlgeschlagen */
  cloud: 'off' | 'wait' | 'ok' | 'error';
  at: number; // letzter erfolgreicher Zeitpunkt im Browser
  cloudAt: number; // letzter erfolgreicher Zeitpunkt im dauerhaften Speicher
  cloudNewer: boolean; // dort liegt ein neuerer Stand, der nicht automatisch geladen wurde
}

const GameCtx = createContext<Ctx | null>(null);

function clone<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}

let toastId = 1;

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGameState] = useState<GameState | null>(() => {
    const g = loadGame();
    if (g) applyOffline(g);
    return g;
  });
  const ref = useRef<GameState | null>(game);
  const incomePaused = useRef(false);
  const accrued = useRef(0);
  const savedRef = useRef<GameState | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [saveOk, setSaveOk] = useState(true);
  const [saveInfo, setSaveInfo] = useState<SaveInfo>({ local: true, cloud: 'off', at: 0, cloudAt: 0, cloudNewer: false });
  const [cloudChecked, setCloudChecked] = useState(false);
  const touched = useRef(false); // der Spieler hat etwas verändert (Einkommens-Takt zählt nicht)
  const cloudOn = useRef(false);
  const cloudBusy = useRef(false);
  const cloudDirty = useRef(false);
  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRef = useRef<() => Promise<boolean>>(async () => false);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = toastId++;
    setToasts((list) => [...list.slice(-3), { id, text: tx(text), tone }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), tone === 'ach' ? 4200 : 3200);
  }, []);

  const flushAchievements = useCallback(() => {
    while (newAchievements.length) {
      const a = newAchievements.shift()!;
      toast(t('store.achievement', { name: a }), 'ach');
      sound.achievement();
    }
  }, [toast]);

  const scheduleCloud = useCallback((delay = 15000) => {
    if (!cloudOn.current || cloudTimer.current) return;
    cloudTimer.current = setTimeout(() => {
      cloudTimer.current = null;
      void syncRef.current();
    }, delay);
  }, []);

  const doSave = useCallback(() => {
    const cur = ref.current;
    if (!cur || cur === savedRef.current) return;
    savedRef.current = cur;
    const ok = saveGame(cur);
    setSaveOk(ok);
    setSaveInfo((i) => (i.local === ok ? i : { ...i, local: ok, at: ok ? Date.now() : i.at }));
    scheduleCloud();
  }, [scheduleCloud]);
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) return;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      doSave();
    }, 500);
  }, [doSave]);

  const update = useCallback(
    (fn: (s: GameState) => string | null | void) => {
      const cur = ref.current;
      if (!cur) return t('store.noGame');
      const draft = clone(cur);
      const err = fn(draft);
      if (typeof err === 'string' && err) {
        toast(err, 'bad');
        sound.error();
        newAchievements.length = 0;
        return err;
      }
      ref.current = draft;
      touched.current = true;
      setGameState(draft);
      flushAchievements();
      scheduleSave();
      return null;
    },
    [toast, flushAchievements, scheduleSave],
  );

  const setGame = useCallback((g: GameState | null) => {
    ref.current = g;
    touched.current = true;
    setGameState(g);
    flushAchievements();
    scheduleSave();
  }, [flushAchievements, scheduleSave]);

  // Der Einkommens-Takt ändert den Spielstand jede Sekunde: dafür reicht ein Speichern alle paar Sekunden
  useEffect(() => {
    const id = setInterval(doSave, 4000);
    const onHide = () => {
      doSave();
      void store.flush();
    };
    const onVis = () => {
      if (document.hidden) onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [doSave]);

  // Dauerhafter Speicher (nur im Artifact): schreiben, wenn sich etwas geändert hat, und beim Start den neueren Stand holen
  useEffect(() => {
    syncRef.current = async () => {
      if (!cloudOn.current) return false;
      if (cloudBusy.current) {
        cloudDirty.current = true;
        return false;
      }
      const cur = ref.current;
      if (!cur) return false;
      cloudBusy.current = true;
      cloudDirty.current = false;
      setSaveInfo((i) => ({ ...i, cloud: 'wait' }));
      const at = Date.now();
      const ok = await cloud.save(serialize(cur, at), at);
      cloudBusy.current = false;
      setSaveInfo((i) => ({ ...i, cloud: ok ? 'ok' : 'error', cloudAt: ok ? at : i.cloudAt, cloudNewer: ok ? false : i.cloudNewer }));
      if (cloudDirty.current) scheduleCloud();
      return ok;
    };
    let dead = false;
    const timeout = setTimeout(() => !dead && setCloudChecked(true), 2800);
    (async () => {
      const there = await cloud.available();
      if (dead) return;
      if (!there) {
        setCloudChecked(true);
        return;
      }
      cloudOn.current = true;
      setSaveInfo((i) => ({ ...i, cloud: 'wait' }));
      const r = await cloud.load();
      if (dead) return;
      const localAt = ref.current?.savedAt ?? 0;
      if (r && r.savedAt > localAt + 1000) {
        const g = parseSave(r.json);
        if (g && !touched.current) {
          applyOffline(g);
          ref.current = g;
          savedRef.current = g;
          setGameState(g);
          setSaveInfo((i) => ({ ...i, cloud: 'ok', cloudAt: r.savedAt }));
          toast(t('store.loadedFromCloud'), 'good');
        } else setSaveInfo((i) => ({ ...i, cloud: 'ok', cloudAt: r.savedAt, cloudNewer: !!g }));
      } else {
        setSaveInfo((i) => ({ ...i, cloud: 'ok', cloudAt: r?.savedAt ?? 0 }));
        if (ref.current) scheduleCloud(1500);
      }
      setCloudChecked(true);
    })();
    const onHide = () => {
      if (document.hidden) void syncRef.current();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      dead = true;
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncNow = useCallback(async () => {
    doSave();
    return syncRef.current();
  }, [doSave]);

  const restoreFromCloud = useCallback(async () => {
    const r = await cloud.load();
    const g = r ? parseSave(r.json) : null;
    if (!g) return false;
    applyOffline(g);
    ref.current = g;
    savedRef.current = null;
    touched.current = true;
    setGameState(g);
    setSaveInfo((i) => ({ ...i, cloud: 'ok', cloudAt: r!.savedAt, cloudNewer: false }));
    scheduleSave();
    return true;
  }, [scheduleSave]);

  // Passives Einkommen: einmal pro Sekunde, ohne den ganzen Spielstand zu kopieren
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(60, (now - last) / 1000);
      last = now;
      const cur = ref.current;
      if (!cur || !cur.created) return;
      if (incomePaused.current) {
        // Fahrt läuft: Einnahmen sammeln, aber noch nichts neu zeichnen
        accrued.current += incomePerSec(cur) * dt;
        return;
      }
      const gain = incomePerSec(cur) * dt + accrued.current;
      accrued.current = 0;
      const next: GameState = { ...cur, money: cur.money + gain, lastTick: now, stats: { ...cur.stats, income: cur.stats.income + gain, passive: cur.stats.passive + gain } };
      ref.current = next;
      setGameState(next);
      if (hasPendingMissions(next)) {
        const draft = clone(next);
        const lines = claimMissions(draft);
        ref.current = draft;
        setGameState(draft);
        flushAchievements();
        for (const l of lines) toast(l, 'good');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [toast, flushAchievements]);

  const setIncomePaused = useCallback((p: boolean) => {
    incomePaused.current = p;
  }, []);

  useEffect(() => {
    if (!game) return;
    sound.setMuted(game.settings.muted);
    sound.setVolume(game.settings.volume);
    const root = document.documentElement;
    root.style.setProperty('--team', game.team.color);
    root.style.setProperty('--team-2', game.team.color2);
    root.style.setProperty('--team-ink', inkFor(game.team.color));
  }, [game?.team.color, game?.team.color2, game?.settings.muted, game?.settings.volume]);

  return <GameCtx.Provider value={{ game, update, setGame, toast, toasts, saveOk, saveInfo, cloudChecked, syncNow, restoreFromCloud, setIncomePaused, get: () => ref.current }}>{children}</GameCtx.Provider>;
}

export function useGame() {
  const c = useContext(GameCtx);
  if (!c) throw new Error('GameProvider fehlt');
  return c;
}

export function useLoadedGame() {
  const c = useGame();
  return { ...c, game: c.game as GameState };
}

export function inkFor(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.58 ? '#0c1215' : '#ffffff';
}
