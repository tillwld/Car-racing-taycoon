import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameState } from '../types';
import { loadGame, saveGame } from '../game/save';
import { newAchievements } from '../game/state';
import { applyOffline, claimMissions, hasPendingMissions, incomePerSec } from '../game/tycoon';
import { sound } from '../audio/sound';

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
  /** Pausiert das passive Einkommen (z. B. während eines Rennens) */
  setIncomePaused: (p: boolean) => void;
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

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'ach' ? 4200 : 3200);
  }, []);

  const flushAchievements = useCallback(() => {
    while (newAchievements.length) {
      const a = newAchievements.shift()!;
      toast(`Erfolg: ${a}`, 'ach');
      sound.achievement();
    }
  }, [toast]);

  const doSave = useCallback(() => {
    const cur = ref.current;
    if (!cur || cur === savedRef.current) return;
    savedRef.current = cur;
    setSaveOk(saveGame(cur));
  }, []);
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
      if (!cur) return 'Kein Spielstand';
      const draft = clone(cur);
      const err = fn(draft);
      if (typeof err === 'string' && err) {
        toast(err, 'bad');
        sound.error();
        newAchievements.length = 0;
        return err;
      }
      ref.current = draft;
      setGameState(draft);
      flushAchievements();
      scheduleSave();
      return null;
    },
    [toast, flushAchievements, scheduleSave],
  );

  const setGame = useCallback((g: GameState | null) => {
    ref.current = g;
    setGameState(g);
    flushAchievements();
    scheduleSave();
  }, [flushAchievements, scheduleSave]);

  // Der Einkommens-Takt ändert den Spielstand jede Sekunde: dafür reicht ein Speichern alle paar Sekunden
  useEffect(() => {
    const id = setInterval(doSave, 4000);
    const onHide = () => doSave();
    const onVis = () => {
      if (document.hidden) doSave();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [doSave]);

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

  return <GameCtx.Provider value={{ game, update, setGame, toast, toasts, saveOk, setIncomePaused, get: () => ref.current }}>{children}</GameCtx.Provider>;
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
