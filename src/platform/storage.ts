// Speicher des Spiels. Beim Start werden alle Schlüssel in EINEM Aufruf vom Portal geladen (bridge.storage) und im Arbeitsspeicher
// gehalten; Lesen ist danach synchron. Schreiben geht in den Arbeitsspeicher, in localStorage (Ausweichlösung) und gesammelt in einem
// einzigen Aufruf an das Portal. Ohne Portal-SDK oder bei Fehlern im Portal-Speicher bleibt localStorage.
import { onPauseChange, platform } from './platform';

const cache = new Map<string, string>();
const dirty = new Set<string>();
const removed = new Set<string>();
let hydrated = false;
let platformOk = false;
let timer = 0;
let flushing: Promise<boolean> | null = null;
let hooked = false;

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string): boolean {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}
function lsDel(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    /* nichts zu tun */
  }
}

/** Zeitstempel eines gespeicherten Spielstands (steht am Ende des JSON), 0 wenn keiner da ist */
function savedAtOf(v: string | null): number {
  if (!v) return 0;
  const m = /"savedAt":(\d+)\}?\s*$/.exec(v.slice(-80));
  return m ? Number(m[1]) : 0;
}

function hook() {
  if (hooked || typeof document === 'undefined') return;
  hooked = true;
  const onHide = () => {
    if (document.visibilityState === 'hidden') void store.flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', () => void store.flush());
  onPauseChange((p) => p && void store.flush());
}

function schedule() {
  if (!platform.sdk || timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    void store.flush();
  }, 400);
}

export const store = {
  /** Alle Schlüssel mit einem einzigen Aufruf laden. Von zwei Quellen gewinnt bei Spielständen der neuere Zeitstempel, sonst der Portal-Speicher. */
  async hydrate(keys: string[]): Promise<'platform' | 'local'> {
    const remote = platform.sdk ? await platform.storageRead(keys) : null;
    platformOk = remote !== null;
    for (const k of keys) {
      const p = remote?.[k] ?? null;
      const l = lsGet(k);
      let pick = p ?? l;
      if (p !== null && l !== null && p !== l) {
        const pa = savedAtOf(p);
        const la = savedAtOf(l);
        if (pa || la) pick = la > pa ? l : p;
        if (pick === l) dirty.add(k); // lokal neuer: später zum Portal übertragen
      } else if (p === null && l !== null && platformOk) dirty.add(k);
      if (pick !== null) cache.set(k, pick);
    }
    hydrated = true;
    hook();
    if (dirty.size) schedule();
    return platformOk ? 'platform' : 'local';
  },

  get(key: string): string | null {
    return hydrated ? (cache.get(key) ?? null) : lsGet(key);
  },

  /** true, wenn mindestens ein Speicherort den Wert angenommen hat */
  set(key: string, value: string): boolean {
    cache.set(key, value);
    removed.delete(key);
    const local = lsSet(key, value);
    if (platform.sdk) {
      dirty.add(key);
      schedule();
    }
    return local || (platform.sdk && platformOk);
  },

  remove(key: string) {
    cache.delete(key);
    dirty.delete(key);
    lsDel(key);
    if (platform.sdk) {
      removed.add(key);
      schedule();
    }
  },

  /** Gesammelte Änderungen jetzt in einem Aufruf an das Portal schreiben */
  flush(): Promise<boolean> {
    if (!platform.sdk || (!dirty.size && !removed.size)) return Promise.resolve(true);
    if (flushing) return flushing;
    window.clearTimeout(timer);
    timer = 0;
    const entries: Record<string, string> = {};
    for (const k of dirty) {
      const v = cache.get(k);
      if (v !== undefined) entries[k] = v;
    }
    const deletes = [...removed];
    dirty.clear();
    removed.clear();
    flushing = platform
      .storageWrite(entries, deletes)
      .then((ok) => {
        platformOk = ok;
        if (!ok) {
          // Beim nächsten Schreiben erneut versuchen; lokal ist alles schon gesichert
          for (const k of Object.keys(entries)) dirty.add(k);
          for (const k of deletes) removed.add(k);
        }
        return ok;
      })
      .finally(() => {
        flushing = null;
      });
    return flushing;
  },

  backend(): 'platform' | 'local' {
    return platform.sdk && platformOk ? 'platform' : 'local';
  },
};
