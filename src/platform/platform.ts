// Alle Aufrufe der Portal-SDK (Playgama Bridge) stehen in dieser einen Datei. Der Rest des Spiels kennt nur das `platform`-Objekt.
// Ein weiteres Portal (CrazyGames, Poki …) lässt sich ergänzen, indem ein weiterer Adapter dieselbe Schnittstelle `PlatformAdapter`
// erfüllt und in `pickAdapter()` ausgewählt wird. Ohne SDK (lokal, Artifact, Test) läuft der Adapter `localAdapter` ohne Fehler.

export interface AdSupport {
  interstitial: boolean;
  rewarded: boolean;
}

export interface PlatformAdapter {
  /** Kennung des Portals, z. B. 'playgama', oder 'local' ohne SDK */
  readonly id: string;
  /** true, wenn eine Portal-SDK erfolgreich gestartet wurde */
  readonly sdk: boolean;
  /** Sprachcode des Portals (z. B. 'de'), sonst null */
  readonly language: string | null;
  init(): Promise<void>;
  /** Das Spiel ist spielbar (Titelbildschirm steht) */
  gameReady(): void;
  /** Rennen läuft (true) oder ist vorbei/abgebrochen (false) */
  gameplay(active: boolean): void;
  /** Ladefortschritt in Prozent an das Portal melden */
  loadingProgress(percent: number): void;
  /** Speicher: mehrere Schlüssel in einem Aufruf lesen/schreiben. Der Rückgabewert sagt, ob der Plattformspeicher benutzt wurde. */
  storageRead(keys: string[]): Promise<Record<string, string | null> | null>;
  storageWrite(entries: Record<string, string>, deletes?: string[]): Promise<boolean>;
  readonly ads: AdSupport;
  /** Zwischenwerbung zeigen. true = wurde gezeigt und geschlossen. Wirft nie. */
  showInterstitial(placement?: string): Promise<boolean>;
  /** Belohnungswerbung zeigen. true nur, wenn der Spieler sie vollständig angesehen hat. Wirft nie. */
  showRewarded(placement?: string): Promise<boolean>;
}

// ---------- Pause und Ton (gemeinsamer Zustand für alle Adapter) ----------
export interface PauseSources {
  /** Tab im Hintergrund oder Fenster nicht sichtbar */
  hidden: boolean;
  /** Das Portal verlangt Pause */
  portal: boolean;
  /** Eine Werbung läuft gerade */
  ad: boolean;
}

const pause: PauseSources = { hidden: false, portal: false, ad: false };
let audioEnabled = true;
const pauseListeners = new Set<(paused: boolean) => void>();
const audioListeners = new Set<(enabled: boolean) => void>();

export const isPaused = () => pause.hidden || pause.portal || pause.ad;
export const isPlatformAudioEnabled = () => audioEnabled;
export const pauseSources = (): Readonly<PauseSources> => pause;

function emitPause(before: boolean) {
  const now = isPaused();
  if (now !== before) for (const cb of [...pauseListeners]) cb(now);
}

export function setPauseSource(key: keyof PauseSources, value: boolean) {
  if (pause[key] === value) return;
  const before = isPaused();
  pause[key] = value;
  emitPause(before);
}

export function setPlatformAudio(enabled: boolean) {
  if (audioEnabled === enabled) return;
  audioEnabled = enabled;
  for (const cb of [...audioListeners]) cb(enabled);
}

/** Wird aufgerufen, sobald sich der Pausenzustand ändert (Tab versteckt, Portal-Pause, Werbung). Gibt eine Abmeldefunktion zurück. */
export function onPauseChange(cb: (paused: boolean) => void): () => void {
  pauseListeners.add(cb);
  return () => void pauseListeners.delete(cb);
}

/** Wird aufgerufen, wenn das Portal den Ton an- oder ausschaltet */
export function onPlatformAudioChange(cb: (enabled: boolean) => void): () => void {
  audioListeners.add(cb);
  return () => void audioListeners.delete(cb);
}

let visibilityHooked = false;
function hookVisibility() {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  const apply = () => setPauseSource('hidden', document.visibilityState === 'hidden');
  document.addEventListener('visibilitychange', apply);
  window.addEventListener('pagehide', () => setPauseSource('hidden', true));
  window.addEventListener('pageshow', apply);
  apply();
}

// ---------- Hilfen ----------
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${what}: timeout`)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

// ---------- Adapter ohne SDK ----------
export const localAdapter: PlatformAdapter = {
  id: 'local',
  sdk: false,
  language: null,
  async init() {
    hookVisibility();
  },
  gameReady() {},
  gameplay() {},
  loadingProgress() {},
  async storageRead() {
    return null;
  },
  async storageWrite() {
    return false;
  },
  ads: { interstitial: false, rewarded: false },
  async showInterstitial() {
    return false;
  },
  async showRewarded() {
    return false;
  },
};

// ---------- Adapter für die Playgama Bridge ----------
interface BridgeEmitter {
  on(event: string, cb: (...args: any[]) => void): void;
  off(event: string, cb?: (...args: any[]) => void): void;
}
interface BridgeLike extends BridgeEmitter {
  initialize(): Promise<void>;
  setGameLoadingProgress?(percent: number): void;
  EVENT_NAME?: Record<string, string>;
  PLATFORM_MESSAGE?: Record<string, string>;
  INTERSTITIAL_STATE?: Record<string, string>;
  REWARDED_STATE?: Record<string, string>;
  platform: BridgeEmitter & {
    id: string;
    language: string;
    isAudioEnabled?: boolean;
    isPaused?: boolean;
    sendMessage(message: string, options?: unknown): Promise<unknown>;
  };
  storage: {
    get(key: string | string[], tryParseJson?: boolean): Promise<unknown>;
    set(key: string | string[], value: unknown): Promise<void>;
    delete(key: string | string[]): Promise<void>;
  };
  advertisement: BridgeEmitter & {
    isInterstitialSupported: boolean;
    isRewardedSupported: boolean;
    showInterstitial(placement?: string | null): void;
    showRewarded(placement?: string | null): void;
  };
}

const AD_TIMEOUT_MS = 90_000;

function bridgeAdapter(bridge: BridgeLike): PlatformAdapter {
  const ev = bridge.EVENT_NAME ?? {};
  const msg = bridge.PLATFORM_MESSAGE ?? {};
  const safe = (fn: () => unknown) => {
    try {
      fn();
    } catch {
      /* Plattformfehler dürfen das Spiel nie stoppen */
    }
  };
  const send = (message: string | undefined, fallback: string) => safe(() => void bridge.platform.sendMessage(message ?? fallback)?.catch?.(() => {}));

  const showAd = (kind: 'interstitial' | 'rewarded', placement?: string): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      const adv = bridge.advertisement;
      const supported = kind === 'interstitial' ? adv.isInterstitialSupported : adv.isRewardedSupported;
      if (!supported) return resolve(false);
      const eventName = (kind === 'interstitial' ? ev.INTERSTITIAL_STATE_CHANGED : ev.REWARDED_STATE_CHANGED) ?? `${kind}_state_changed`;
      const states = (kind === 'interstitial' ? bridge.INTERSTITIAL_STATE : bridge.REWARDED_STATE) ?? {};
      const S = { opened: states.OPENED ?? 'opened', closed: states.CLOSED ?? 'closed', failed: states.FAILED ?? 'failed', rewarded: states.REWARDED ?? 'rewarded' };
      let rewarded = false;
      let opened = false;
      let finished = false;
      let timer = 0;
      const finish = (ok: boolean) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        safe(() => adv.off(eventName, listener));
        setPauseSource('ad', false);
        resolve(ok);
      };
      const listener = (state: string) => {
        if (state === S.opened) {
          opened = true;
          setPauseSource('ad', true);
        } else if (state === S.rewarded) rewarded = true;
        else if (state === S.failed) finish(false);
        else if (state === S.closed) finish(kind === 'interstitial' ? opened : rewarded);
      };
      timer = window.setTimeout(() => finish(kind === 'interstitial' ? opened : rewarded), AD_TIMEOUT_MS);
      try {
        adv.on(eventName, listener);
        if (kind === 'interstitial') adv.showInterstitial(placement ?? null);
        else adv.showRewarded(placement ?? null);
      } catch {
        finish(false);
      }
    });

  const adapter: PlatformAdapter = {
    id: 'bridge',
    sdk: true,
    language: null,
    async init() {
      hookVisibility();
      await withTimeout(bridge.initialize(), 6000, 'bridge.initialize');
      (adapter as { id: string }).id = bridge.platform.id || 'bridge';
      (adapter as { language: string | null }).language = bridge.platform.language || null;
      if (bridge.platform.isAudioEnabled === false) setPlatformAudio(false);
      if (bridge.platform.isPaused === true) setPauseSource('portal', true);
      safe(() => bridge.platform.on(ev.PAUSE_STATE_CHANGED ?? 'pause_state_changed', (paused: boolean) => setPauseSource('portal', !!paused)));
      safe(() => bridge.platform.on(ev.AUDIO_STATE_CHANGED ?? 'audio_state_changed', (enabled: boolean) => setPlatformAudio(!!enabled)));
      const vis = ev.VISIBILITY_STATE_CHANGED ?? 'visibility_state_changed';
      const onVis = (state: string) => setPauseSource('hidden', state === 'hidden');
      safe(() => bridge.on(vis, onVis));
      safe(() => bridge.platform.on(vis, onVis));
    },
    gameReady: () => send(msg.GAME_READY, 'game_ready'),
    gameplay: (active) => (active ? send(msg.GAMEPLAY_STARTED, 'gameplay_started') : send(msg.GAMEPLAY_STOPPED, 'gameplay_stopped')),
    loadingProgress: (p) => safe(() => bridge.setGameLoadingProgress?.(Math.max(0, Math.min(100, Math.round(p))))),
    async storageRead(keys) {
      try {
        const res = await bridge.storage.get(keys, false);
        const out: Record<string, string | null> = {};
        keys.forEach((k, i) => {
          const v = Array.isArray(res) ? res[i] : (res as Record<string, unknown> | null)?.[k];
          out[k] = typeof v === 'string' ? v : v === undefined || v === null ? null : JSON.stringify(v);
        });
        return out;
      } catch {
        return null;
      }
    },
    async storageWrite(entries, deletes = []) {
      try {
        const keys = Object.keys(entries);
        if (keys.length) await bridge.storage.set(keys, keys.map((k) => entries[k]));
        if (deletes.length) await bridge.storage.delete(deletes);
        return true;
      } catch {
        return false;
      }
    },
    get ads(): AdSupport {
      try {
        return { interstitial: !!bridge.advertisement.isInterstitialSupported, rewarded: !!bridge.advertisement.isRewardedSupported };
      } catch {
        return { interstitial: false, rewarded: false };
      }
    },
    showInterstitial: (placement) => showAd('interstitial', placement),
    showRewarded: (placement) => showAd('rewarded', placement),
  };
  return adapter;
}

function pickAdapter(): PlatformAdapter {
  const w = typeof window !== 'undefined' ? (window as unknown as { bridge?: BridgeLike; playgamaBridge?: BridgeLike }) : {};
  const bridge = w.bridge ?? w.playgamaBridge;
  return bridge && typeof bridge.initialize === 'function' ? bridgeAdapter(bridge) : localAdapter;
}

let current: PlatformAdapter = localAdapter;
let initPromise: Promise<void> | null = null;

/** Portal-SDK starten. Schlägt der Start fehl (kein Skript, Zeitüberschreitung), läuft das Spiel ohne SDK weiter. */
export function initPlatform(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const adapter = pickAdapter();
    try {
      await adapter.init();
      current = adapter;
    } catch (e) {
      if (adapter !== localAdapter) console.warn('[platform] SDK not available, running without it:', e instanceof Error ? e.message : e);
      current = localAdapter;
      await localAdapter.init();
    }
  })();
  return initPromise;
}

/** Aktueller Adapter. Vor `initPlatform()` ist es der lokale Adapter ohne SDK. */
export const platform: PlatformAdapter = new Proxy({} as PlatformAdapter, {
  get(_t, prop: string) {
    const v = (current as unknown as Record<string, unknown>)[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(current) : v;
  },
});
