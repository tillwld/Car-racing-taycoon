import { useEffect, useRef, useState } from 'react';
import { RaceEngine, type CarSim, type PitRequest, type RaceConfig } from '../../race/engine';
import { RaceRenderer } from '../../race/renderer';
import { RaceRenderer3D } from '../../race/renderer3d';
import { bindKeyboard, isTouchDevice, newControls, readInput } from '../../race/input';
import { computeProfile } from '../../race/ai';
import { bestCompoundFor, PIT } from '../../race/params';
import { sound } from '../../audio/sound';
import { COMPOUNDS, COMPOUND_KEYS, WEATHER_LABELS } from '../../data/catalog';
import type { Compound, Settings } from '../../types';
import { Icon, TyreBadge, WeatherIcon } from '../components/common';
import { lapTime } from '../../game/util';

export type RaceViewResult =
  | { kind: 'race'; engine: RaceEngine; rainy: boolean; playerDrove: boolean }
  | { kind: 'quali'; best: number }
  | { kind: 'practice'; laps: number[] }
  | { kind: 'abort' };

interface Props {
  config: RaceConfig;
  humanId: string | null;
  focusId: string;
  title: string;
  settings: Settings;
  qualiLaps?: number;
  /** Welche Rennfunktionen schon freigeschaltet sind (Boxenstopp, Sprit- und Schadensanzeige) */
  features?: { pit: boolean; fuel: boolean; damage: boolean; tyres?: boolean };
  /** Steuerungs-Hinweis zu Beginn einblenden */
  intro?: boolean;
  /** Bezeichnung der Session statt „Training“ (z. B. Teststrecke) */
  sessionLabel?: string;
  onSettings: (p: Partial<Settings>) => void;
  onExit: (r: RaceViewResult) => void;
  onLap?: (t: number) => string[] | void;
}

interface Hud {
  pos: number;
  total: number;
  lap: number;
  laps: number;
  cur: number;
  last: number;
  best: number;
  speed: number;
  gear: number;
  rpm: number;
  tyre: { c: Compound; wear: number; temp: number };
  fuelLaps: number;
  ers: number;
  damage: number[];
  slip: number;
  weather: string;
  wetness: number;
  tower: { id: string; pos: number; short: string; color: string; gap: string; me: boolean; pit: boolean; out: boolean }[];
  msgs: { text: string; kind: string; t: number }[];
  lights: number;
  phase: string;
  pitReq: PitRequest | null;
  inPit: boolean;
  pit: PitHud | null;
  finished: boolean;
  sectors: { t: number; cls: string }[];
  delta: number | null;
  offTrack: boolean;
  timedLaps: number;
  wrongWay: boolean;
  corner: { dir: number; dist: number; speed: number; brakeNow: boolean; urgency: number } | null;
}

/** Anzeige zur Boxengasse: Anfahrt, Limiter, Standzeit, Ausfahrt */
interface PitHud {
  phase: 'call' | 'lane' | 'stop' | 'exit' | 'wait';
  dist: number; // Meter bis zur Einfahrt (0 = jetzt einbiegen)
  side: number; // +1 rechts, -1 links
  timer: number;
  total: number;
  compound: Compound;
}

const STEP = 1 / 60;

type Rend = {
  opts: any;
  resize: () => void;
  updateRacingLine: (c: CarSim) => void;
  render: (f: CarSim | null, dt: number) => void;
  renderMini: (c: HTMLCanvasElement, f: CarSim | null) => void;
  dispose?: () => void;
};
const ALL_FEATURES = { pit: true, fuel: true, damage: true, tyres: true };
const CAMERAS = ['chase', 'high', 'cockpit'] as const;
const CAMERA_LABEL = { chase: 'Verfolger', high: 'Weit', cockpit: 'Cockpit' } as const;

export default function RaceView({ config, humanId, focusId, title, settings, qualiLaps = 2, features = ALL_FEATURES, intro = false, sessionLabel = 'Training', onSettings, onExit, onLap }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const engRef = useRef<RaceEngine | null>(null);
  const rendRef = useRef<Rend | null>(null);
  const introRef = useRef(intro);
  const featRef = useRef(features);
  featRef.current = features;
  const ctrl = useRef(newControls());
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const focusRef = useRef(focusId);
  const rainyRef = useRef(false);
  const lapsRef = useRef<number[]>([]);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [pitOpen, setPitOpen] = useState(false);
  const [showTower, setShowTower] = useState(false);
  const [done, setDone] = useState(false);
  const [autopilot, setAutopilot] = useState(humanId === null);
  const [ff, setFf] = useState(false);
  const [showIntro, setShowIntro] = useState(intro);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const touch = settings.touchControls === 'on' || (settings.touchControls === 'auto' && isTouchDevice());
  const spectate = humanId === null;

  // Engine + Renderer + Spielschleife
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const eng = new RaceEngine(config);
    engRef.current = eng;
    if (spectate) eng.autopilotHuman = true;
    let rend: Rend;
    let is3d = true;
    try {
      rend = new RaceRenderer3D(canvasRef.current!, eng, { camera: settings.camera, showLine: settings.showLine && !spectate, quality: settings.quality });
    } catch (err) {
      // Ohne WebGL: einfache Draufsicht
      console.warn('3D nicht verfügbar, wechsle zur Draufsicht', err);
      is3d = false;
      const fresh = document.createElement('canvas');
      fresh.className = canvasRef.current!.className;
      canvasRef.current!.replaceWith(fresh);
      (canvasRef as { current: HTMLCanvasElement | null }).current = fresh;
      rend = new RaceRenderer(fresh, eng, { camera: 'rotate', viewDist: settings.camera === 'high' ? 'far' : 'normal', showLine: settings.showLine && !spectate, quality: settings.quality });
    }
    rendRef.current = rend;
    if ((import.meta as any).env?.DEV) (window as any).__rend = rend;
    rend.resize();
    const human = eng.human;
    if (human) {
      computeProfile(eng, human, 0.96, 0.92);
      rend.updateRacingLine(human);
    }
    sound.startEngine();
    let lastLights = 0;
    eng.onEvent = (e) => {
      const isMe = e.carId && e.carId === focusRef.current;
      switch (e.type) {
        case 'lightsOut':
          sound.go();
          break;
        case 'collision':
        case 'wall':
          if (isMe) sound.collision(e.data);
          break;
        case 'pitStop':
          if (isMe) sound.pitStop();
          break;
        case 'flag':
          sound.flag();
          break;
        case 'lap':
          if (e.carId === eng.humanId) {
            lapsRef.current.push(e.data);
            const fb = onLap?.(e.data);
            if (fb) for (const m of fb) eng.msg(m, 'info');
          }
          break;
      }
    };
    const unbind = bindKeyboard(ctrl.current, (a) => action(a));
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudT = 0;
    let lineT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;
      if (!pausedRef.current) {
        eng.humanInput = readInput(ctrl.current);
        if (introRef.current && eng.phase === 'racing' && eng.humanInput.throttle > 0) {
          introRef.current = false;
          setTimeout(() => setShowIntro(false), 6000);
        }
        acc += dt * speedRef.current;
        let n = 0;
        while (acc >= STEP && n < 600) {
          eng.step(STEP);
          acc -= STEP;
          n++;
          if (eng.wetness > 0.3) rainyRef.current = true;
        }
        if (eng.phase === 'countdown') {
          const l = Math.min(5, Math.floor(eng.time / 0.8));
          if (l > lastLights) {
            lastLights = l;
            sound.countdown();
          }
        }
      }
      const focus = eng.byId[focusRef.current] ?? eng.cars[0];
      if (is3d) rend.opts.camera = settingsRef.current.camera;
      rend.opts.showLine = settingsRef.current.showLine && !spectate;
      lineT -= dt;
      if (human && lineT <= 0) {
        computeProfile(eng, human, 0.96, 0.92);
        if (rend.opts.showLine) rend.updateRacingLine(human);
        lineT = 1;
      }
      rend.render(focus, pausedRef.current ? 0 : dt);
      // Motorsound
      const rpm = gearInfo(focus).rpm;
      sound.updateEngine(rpm, focus.throttle, focus.slide + (focus.offTrack === 2 ? 0.3 : 0), !pausedRef.current && !focus.dnf);
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.1;
        setHud(makeHud(eng, focus, settingsRef.current.cornerHints));
        if (miniRef.current) rend.renderMini(miniRef.current, focus);
        // Ende der Session
        if (config.mode === 'race' && eng.phase === 'finished') setDone(true);
        if (config.mode === 'race' && eng.human && eng.human.finished && !eng.autopilotHuman) {
          eng.autopilotHuman = true;
          setAutopilot(true);
          setDone(true);
        }
        if (config.mode === 'quali' && eng.human && eng.human.lapTimes.length >= qualiLaps) setDone(true);
        if (config.mode === 'race' && eng.human && eng.human.dnf) setDone(true);
      }
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => rend.resize());
    ro.observe(rootRef.current!);
    const vis = () => {
      if (document.hidden) setPause(true);
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      unbind();
      ro.disconnect();
      document.removeEventListener('visibilitychange', vis);
      sound.stopEngine();
      eng.onEvent = undefined;
      rend.dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPause(p: boolean) {
    pausedRef.current = p;
    setPaused(p);
  }

  function action(a: string) {
    const eng = engRef.current;
    if (!eng) return;
    if (a === 'pause') setPause(!pausedRef.current);
    else if (a === 'pit') togglePit();
    else if (a.startsWith('pit:')) pitOption(a.slice(4));
    else if (a === 'camera') cycleCamera();
    else if (a === 'mute') onSettings({ muted: !settingsRef.current.muted });
    else if (a === 'tower') setShowTower((v) => !v);
    else if (a === 'line') onSettings({ showLine: !settingsRef.current.showLine });
    else if (a === 'reset') resetCar();
  }

  function cycleCamera() {
    const cur = settingsRef.current.camera;
    onSettings({ camera: CAMERAS[(CAMERAS.indexOf(cur) + 1) % CAMERAS.length] });
  }

  function defaultPit(): PitRequest {
    const eng = engRef.current!;
    const c = eng.human!;
    const planned = c.cfg.strategy.stops[c.stopIndex];
    const isWetNeeded = eng.wetness > 0.28;
    const compound = isWetNeeded ? bestCompoundFor(eng.wetness) : planned?.compound && !['inter', 'wet'].includes(planned.compound) ? planned.compound : c.tyre.compound === 'soft' ? 'medium' : 'soft';
    const need = Math.max(0, (eng.raceDist - c.dist) / eng.raceDist);
    return { compound: isWetNeeded ? compound : compound, repair: c.damage.frontWing > 0.15 || c.damage.suspension > 0.15, refuel: c.fuel < need * 1.02 };
  }

  function togglePit() {
    const eng = engRef.current;
    if (!eng || config.mode !== 'race' || !eng.human || eng.human.pit !== 'none' || eng.human.finished) return;
    const c = eng.human;
    if (c.pitReq) {
      eng.requestPit(c.cfg.id, null);
      setPitOpen(false);
      eng.msg('Boxenstopp abgesagt.', 'info');
    } else {
      if (c.lapsDone >= eng.cfg.laps - 1) {
        eng.msg('Letzte Runde – ein Boxenstopp lohnt sich nicht mehr.', 'info');
        return;
      }
      const req = defaultPit();
      eng.requestPit(c.cfg.id, req);
      setPitOpen(!!featRef.current.tyres);
      const side = eng.pitSide > 0 ? 'rechts' : 'links';
      eng.msg(`Box, Box! Die Boxengasse liegt ${side}. Neue Reifen: ${COMPOUNDS[req.compound].label}.`, 'warn');
    }
  }

  // Tastatur im Boxenmenü: 1–5 Reifenmischung, F Nachtanken, E Reparatur
  function pitOption(k: string) {
    const eng = engRef.current;
    const c = eng?.human;
    if (!eng || !c || !c.pitReq || c.pit !== 'none' || !featRef.current.tyres) return;
    if (k === 'fuel') updatePit({ refuel: !c.pitReq.refuel });
    else if (k === 'repair') updatePit({ repair: !c.pitReq.repair });
    else {
      const comp = COMPOUND_KEYS[Number(k) - 1];
      if (comp) updatePit({ compound: comp });
    }
  }

  function updatePit(p: Partial<PitRequest>) {
    const eng = engRef.current;
    const c = eng?.human;
    if (!eng || !c || !c.pitReq) return;
    c.pitReq = { ...c.pitReq, ...p };
    setHud(makeHud(eng, eng.byId[focusRef.current], settingsRef.current.cornerHints));
  }

  function finish() {
    const eng = engRef.current!;
    if (config.mode === 'race') {
      setFf(true);
      setTimeout(() => {
        eng.autopilotHuman = true;
        eng.fastForward(1500);
        onExit({ kind: 'race', engine: eng, rainy: rainyRef.current || eng.wetness > 0.3, playerDrove: !spectate });
      }, 30);
    } else if (config.mode === 'quali') {
      const h = eng.human;
      onExit({ kind: 'quali', best: h && isFinite(h.bestLap) ? h.bestLap : 0 });
    } else onExit({ kind: 'practice', laps: [...lapsRef.current] });
  }

  function handOver() {
    const eng = engRef.current!;
    eng.autopilotHuman = true;
    setAutopilot(true);
    setPause(false);
    eng.msg('Der Fahrer übernimmt.', 'info');
  }

  function resetCar() {
    const eng = engRef.current;
    if (!eng || !eng.human || eng.autopilotHuman || eng.phase !== 'racing') return;
    eng.resetCar(eng.human.cfg.id);
    setPause(false);
  }

  function takeBack() {
    const eng = engRef.current!;
    if (spectate || !eng.human || eng.human.finished) return;
    eng.autopilotHuman = false;
    setAutopilot(false);
    speedRef.current = 1;
    setSimSpeed(1);
  }

  function retire() {
    const eng = engRef.current!;
    if (eng.human && !eng.human.finished) {
      eng.human.dnf = true;
      eng.human.dnfReason = 'Aufgegeben';
    }
    setPause(false);
    finish();
  }

  function setSpeed(v: number) {
    speedRef.current = v;
    setSimSpeed(v);
  }

  const touchHandlers = (key: 'tUp' | 'tDown' | 'tLeft' | 'tRight' | 'tBoost') => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      ctrl.current[key] = true;
      sound.ensure();
      e.preventDefault();
    },
    onPointerUp: () => (ctrl.current[key] = false),
    onPointerCancel: () => (ctrl.current[key] = false),
    onLostPointerCapture: () => (ctrl.current[key] = false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const h = hud;
  const isRace = config.mode === 'race';
  const human = engRef.current?.human;
  const canDrive = !spectate && !!human && !human.finished && !human.dnf;

  return (
    <div className="race-root" ref={rootRef}>
      <canvas ref={canvasRef} className="world" />
      <div className="vignette" aria-hidden="true" />
      <div className="hud">
        {h && (
          <>
            <div className="hud-top">
              {isRace && (
                <div className="hud-box hud-pos" aria-label="Position">
                  <b>P{h.pos}</b>
                  <span>/{h.total}</span>
                </div>
              )}
              <div className="hud-box hud-lap">
                <small>{isRace ? 'Runde' : config.mode === 'quali' ? 'Qualifying' : sessionLabel}</small>
                <b className="num">{isRace ? `${Math.min(h.lap, h.laps)}/${h.laps}` : config.mode === 'quali' ? `${Math.min(h.timedLaps + (h.lap > 0 ? 1 : 0), qualiLaps)}/${qualiLaps}` : `${h.timedLaps}`}</b>
              </div>
              <div className="hud-box hud-times">
                <span className="k">Akt.</span>
                <span>{h.lap > 0 || isRace ? lapTime(h.cur) : 'Aufwärmrunde'}</span>
                <span className="k">Letzte</span>
                <span>{lapTime(h.last)}</span>
                <span className="k">Beste</span>
                <span className="purple">{lapTime(h.best)}</span>
              </div>
              <div className="hud-box" style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={WEATHER_LABELS[h.weather as keyof typeof WEATHER_LABELS]}>
                <span style={{ width: 26, height: 26, display: 'inline-block' }}>
                  <WeatherIcon kind={h.weather as any} />
                </span>
                <span className="num" style={{ fontSize: 12 }}>{Math.round(h.wetness * 100)}%</span>
              </div>
              <div className="hud-right">
                <div className="hud-box" style={{ padding: 2 }}>
                  <canvas ref={miniRef} className="minimap" />
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <button type="button" className="hud-btn" aria-label="Pause" onClick={() => setPause(true)}>
                    <Icon name="pause" />
                  </button>
                  <button type="button" className="hud-btn" aria-label={settings.muted ? 'Ton an' : 'Ton aus'} onClick={() => onSettings({ muted: !settings.muted })}>
                    <Icon name={settings.muted ? 'mute' : 'sound'} />
                  </button>
                  {isRace && (
                    <button type="button" className="hud-btn" aria-label="Zeitenliste" onClick={() => setShowTower((v) => !v)}>
                      <Icon name="list" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {isRace && (
              <div className={`hud-box tower ${showTower ? 'show' : ''}`}>
                {h.tower.map((r) => (
                  <div
                    key={r.id}
                    className={`r ${r.me ? 'me' : ''} ${r.pit ? 'pit' : ''} ${r.out ? 'out' : ''}`}
                    onClick={() => spectate && (focusRef.current = r.id)}
                    style={{ cursor: spectate ? 'pointer' : 'default' }}
                  >
                    <span className="p">{r.pos}</span>
                    <span className="c" style={{ background: r.color }} />
                    <span>{r.short}</span>
                    <span className="g">{r.gap}</span>
                  </div>
                ))}
              </div>
            )}

            {h.corner && !h.inPit && !h.pit && h.phase !== 'countdown' && (
              <div className={`corner-box ${h.corner.brakeNow ? 'brake' : h.corner.urgency > 0.4 ? 'soon' : ''}`} aria-live="off">
                <span className="corner-arrow" style={{ transform: `scaleX(${h.corner.dir > 0 ? 1 : -1})` }} aria-label={h.corner.dir > 0 ? 'Rechtskurve' : 'Linkskurve'}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 20V12a5 5 0 0 1 5-5h7M15 3l4 4-4 4" />
                  </svg>
                </span>
                <span className="corner-txt">
                  <b>{h.corner.brakeNow ? 'BREMSEN' : h.corner.urgency > 0 ? `Bremsen in ${Math.round(h.corner.dist)} m` : `Kurve in ${Math.round(h.corner.dist)} m`}</b>
                  <small>Kurvenspeed ca. {Math.round(h.corner.speed * 3.6)} km/h</small>
                </span>
                <span className="corner-bar"><i style={{ width: `${Math.round(h.corner.urgency * 100)}%` }} /></span>
              </div>
            )}
            {settings.cornerHints && h.corner?.brakeNow && !autopilot && canDrive && <div className="brake-flash" aria-hidden="true" />}

            {h.pit && (
              <div className={`pit-box ${h.pit.phase}`} aria-live="polite">
                <span className="pit-ico" style={{ transform: h.pit.phase === 'call' ? `scaleX(${h.pit.side})` : undefined }}>
                  {h.pit.phase === 'call' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h13M13 6l6 6-6 6" />
                    </svg>
                  ) : h.pit.phase === 'stop' ? (
                    <b>{h.pit.timer.toFixed(1)}</b>
                  ) : (
                    <b>80</b>
                  )}
                </span>
                <span className="pit-txt">
                  {h.pit.phase === 'call' && (
                    <>
                      <b>{h.pit.dist > 0 ? `BOX in ${Math.max(10, Math.round(h.pit.dist / 10) * 10)} m` : `JETZT ${h.pit.side > 0 ? 'RECHTS' : 'LINKS'} EINBIEGEN`}</b>
                      <small>
                        {h.pit.dist > 0
                          ? `Halte dich ${h.pit.side > 0 ? 'rechts' : 'links'} und fahr in die Boxengasse. Dort gilt Tempo 80.`
                          : 'Die Boxengasse zweigt jetzt von der Strecke ab.'}
                      </small>
                    </>
                  )}
                  {h.pit.phase === 'lane' && (
                    <>
                      <b>Boxengasse · Limiter 80 km/h</b>
                      <small>Dein Team wartet an der Box. Du musst nichts tun.</small>
                    </>
                  )}
                  {h.pit.phase === 'stop' && (
                    <>
                      <b>Boxenstopp läuft</b>
                      <small>Neue Reifen: {COMPOUNDS[h.pit.compound].label}</small>
                    </>
                  )}
                  {h.pit.phase === 'wait' && (
                    <>
                      <b>Ausfahrt rot</b>
                      <small>Verkehr auf der Strecke – gleich geht es weiter.</small>
                    </>
                  )}
                  {h.pit.phase === 'exit' && (
                    <>
                      <b>Ausfahrt frei</b>
                      <small>Limiter endet an der Linie. Dann Gas geben und auf den Verkehr achten.</small>
                    </>
                  )}
                </span>
                {h.pit.phase === 'stop' && <span className="corner-bar"><i style={{ width: `${Math.round((1 - h.pit.timer / Math.max(0.1, h.pit.total)) * 100)}%` }} /></span>}
              </div>
            )}

            <div className="radio" aria-live="polite">
              {h.msgs.map((m, i) => (
                <div key={`${m.t}-${i}`} className={m.kind}>
                  {m.text}
                </div>
              ))}
            </div>

            {showIntro && !autopilot && canDrive && !h.pit && (
              <div className="intro-box" role="note">
                <b>So fährst du</b>
                {touch ? (
                  <div className="intro-keys">
                    <span>◀ ▶ links unten: Lenken</span>
                    <span>▲ grün: Gas</span>
                    <span>▼ rot: Bremse</span>
                    <span>⚡ Boost</span>
                  </div>
                ) : (
                  <div className="intro-keys">
                    <span><kbd>W</kbd> / <kbd>↑</kbd> Gas</span>
                    <span><kbd>S</kbd> / <kbd>↓</kbd> Bremse</span>
                    <span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd> Lenken</span>
                    <span><kbd>Leertaste</kbd> Boost</span>
                    <span><kbd>C</kbd> Kamera</span>
                  </div>
                )}
                <small>Bremse vor den Kurven. An der Strecke stehen Schilder mit 3 – 2 – 1 Strichen (150, 100, 50 m).</small>
              </div>
            )}

            {h.phase === 'countdown' && (
              <div className="lights" aria-label="Startampel">
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} className={i < h.lights ? 'on' : ''} />
                ))}
              </div>
            )}
            {h.wrongWay && canDrive && !autopilot ? (
              <div className="center-msg" style={{ fontSize: 26, top: '22%', color: 'var(--bad)' }}>Falsche Richtung · R = zurücksetzen</div>
            ) : (
              h.offTrack && !h.inPit && canDrive && !autopilot && <div className="center-msg" style={{ fontSize: 24, top: '22%', color: 'var(--warn)' }}>Neben der Strecke</div>
            )}
            {done && isRace && <div className="center-msg">Zielflagge</div>}
            {done && config.mode === 'quali' && <div className="center-msg" style={{ fontSize: 'clamp(28px,6vw,52px)' }}>Bestzeit {lapTime(h.best)}</div>}
            {h.delta !== null && !isRace && h.lap > 0 && (
              <div className="center-msg" style={{ fontSize: 20, top: '18%', color: h.delta <= 0 ? 'var(--good)' : 'var(--bad)' }}>
                {h.delta <= 0 ? '−' : '+'}
                {Math.abs(h.delta).toFixed(2)}
              </div>
            )}

            <div className={`hud-bottom ${touch ? 'touch-on' : ''}`}>
              <div className="hud-box speedo">
                <div className="v">{Math.round(h.speed * 3.6)}</div>
                <div className="u">KM/H <span className="gear">{h.gear}</span></div>
                <div className="rpm">
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={`${h.rpm * 10 > i ? 'on' : ''} ${i >= 7 ? 'y' : ''} ${i >= 9 ? 'r' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="hud-box car-state">
                <div className="line">
                  <span className="k">Reifen</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <TyreBadge c={h.tyre.c} sm />
                    <span className="bar" style={{ flex: 1 }}>
                      <i style={{ width: `${(1 - h.tyre.wear) * 100}%`, background: h.tyre.wear > 0.7 ? 'var(--bad)' : h.tyre.wear > 0.5 ? 'var(--warn)' : 'var(--good)' }} />
                    </span>
                  </span>
                  <span className="v">{Math.round(h.tyre.temp)}°</span>
                </div>
                {isRace && features.fuel && (
                  <div className="line">
                    <span className="k">Sprit</span>
                    <span className="bar">
                      <i style={{ width: `${Math.min(100, (h.fuelLaps / Math.max(1, h.laps)) * 100)}%`, background: h.fuelLaps < h.laps - h.lap + 0.6 ? 'var(--bad)' : 'var(--info)' }} />
                    </span>
                    <span className="v">{h.fuelLaps.toFixed(1)}</span>
                  </div>
                )}
                <div className="line">
                  <span className="k">Boost</span>
                  <span className="bar">
                    <i style={{ width: `${h.ers * 100}%`, background: 'var(--info)' }} />
                  </span>
                  <span className="v" title="Windschatten">{h.slip > 0.2 ? 'WS' : ''}</span>
                </div>
                {features.damage && (
                  <div className="line">
                    <span className="k">Schaden</span>
                    <span className="dmg" title="Motor, Getriebe, Bremsen, Frontflügel, Fahrwerk">
                      {h.damage.map((d, i) => (
                        <i key={i} style={{ background: d > 0.6 ? 'var(--bad)' : d > 0.25 ? 'var(--warn)' : 'var(--good)' }} />
                      ))}
                    </span>
                    <span className="v">{h.pitReq ? 'BOX' : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {pitOpen && h.pitReq && !h.inPit && features.tyres && (
              <div className="hud-box pit-panel">
                <div className="row between">
                  <b className="display" style={{ fontSize: 18 }}>Boxenstopp geplant</b>
                  <button type="button" className="hud-btn" style={{ width: 32, height: 32 }} aria-label="Schließen" onClick={() => setPitOpen(false)}>
                    <Icon name="close" />
                  </button>
                </div>
                <div className="tyre-pick">
                  {COMPOUND_KEYS.map((c, i) => (
                    <button key={c} type="button" className={h.pitReq?.compound === c ? 'on' : ''} onClick={() => updatePit({ compound: c })}>
                      <TyreBadge c={c} sm />
                      {COMPOUNDS[c].label.replace('Intermediate', 'Inter')}
                      {!touch && <kbd>{i + 1}</kbd>}
                    </button>
                  ))}
                </div>
                <label className="row" style={{ fontSize: 14 }}>
                  <input type="checkbox" checked={h.pitReq.repair} onChange={(e) => updatePit({ repair: e.target.checked })} /> Schäden reparieren {!touch && <kbd>E</kbd>}
                </label>
                <label className="row" style={{ fontSize: 14 }}>
                  <input type="checkbox" checked={h.pitReq.refuel} onChange={(e) => updatePit({ refuel: e.target.checked })} /> Nachtanken {!touch && <kbd>F</kbd>}
                </label>
                <button type="button" className="btn danger sm" onClick={togglePit}>
                  Stopp absagen
                </button>
              </div>
            )}

            {spectate || autopilot ? (
              <div className="touch" style={{ height: 'auto' }}>
                <div className="tz r" style={{ gap: 8 }}>
                  {[1, 2, 4, 8].map((v) => (
                    <button key={v} type="button" className={`tbtn small ${simSpeed === v ? 'on' : ''}`} onClick={() => setSpeed(v)}>
                      {v}×
                    </button>
                  ))}
                  {!spectate && canDrive && (
                    <button type="button" className="tbtn small" style={{ width: 'auto', padding: '0 12px' }} onClick={takeBack}>
                      Selbst fahren
                    </button>
                  )}
                  {isRace && (
                    <button type="button" className="tbtn small" style={{ width: 'auto', padding: '0 12px', background: 'var(--team)', color: 'var(--team-ink)' }} onClick={finish}>
                      Ergebnis
                    </button>
                  )}
                </div>
              </div>
            ) : (
              touch && (
                <div className="touch">
                  <div className="tz l">
                    <button type="button" className="tbtn" aria-label="Links lenken" {...touchHandlers('tLeft')}>
                      <Icon name="left" />
                    </button>
                    <button type="button" className="tbtn" aria-label="Rechts lenken" {...touchHandlers('tRight')}>
                      <Icon name="right" />
                    </button>
                  </div>
                  <div className="tz r">
                    <div style={{ display: 'grid', gap: 10 }}>
                      {isRace && (
                        <button type="button" className={`tbtn small ${h.pitReq ? 'on' : ''}`} onClick={togglePit}>
                          BOX
                        </button>
                      )}
                      <button type="button" className="tbtn small boost" aria-label="Boost" {...touchHandlers('tBoost')}>
                        <Icon name="bolt" />
                      </button>
                    </div>
                    <button type="button" className="tbtn brake" aria-label="Bremse" {...touchHandlers('tDown')}>
                      <Icon name="down" />
                    </button>
                    <button type="button" className="tbtn gas" aria-label="Gas" {...touchHandlers('tUp')}>
                      <Icon name="up" />
                    </button>
                  </div>
                </div>
              )
            )}
            {done && (
              <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, 0)', display: 'grid', gap: 8 }}>
                <button type="button" className="btn primary big" onClick={finish}>
                  {isRace ? 'Zum Ergebnis' : 'Session beenden'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {paused && (
        <div className="pause-menu">
          <div className="modal">
            <div>
              <div className="eyebrow">{title}</div>
              <h2>Pause</h2>
            </div>
            <div className="stack">
              <button type="button" className="btn primary big" onClick={() => setPause(false)}>
                Weiterfahren
              </button>
              {canDrive && !autopilot && (
                <button type="button" className="btn block" onClick={resetCar}>
                  Auto auf die Strecke zurücksetzen
                </button>
              )}
              {isRace && canDrive && !autopilot && (
                <button type="button" className="btn block" onClick={handOver}>
                  Fahrer übernehmen lassen
                </button>
              )}
              {isRace && (
                <button type="button" className="btn block" onClick={() => { setPause(false); finish(); }}>
                  Rest des Rennens simulieren
                </button>
              )}
              {!isRace && (
                <button type="button" className="btn block" onClick={() => { setPause(false); finish(); }}>
                  Session beenden{config.mode === 'quali' ? ' (beste Runde zählt)' : ''}
                </button>
              )}
              {isRace && canDrive && (
                <button type="button" className="btn danger block" onClick={retire}>
                  Aufgeben
                </button>
              )}
              {!isRace && (
                <button type="button" className="btn ghost block" onClick={() => onExit({ kind: 'abort' })}>
                  Abbrechen ohne Wertung
                </button>
              )}
            </div>
            <div className="sep" />
            <div className="row">
              <button type="button" className="btn sm" onClick={cycleCamera}>
                Kamera: {CAMERA_LABEL[settings.camera]}
              </button>
              <button type="button" className="btn sm" onClick={() => onSettings({ cornerHints: !settings.cornerHints })}>
                Kurvenhilfe: {settings.cornerHints ? 'An' : 'Aus'}
              </button>
              <button type="button" className="btn sm" onClick={() => onSettings({ showLine: !settings.showLine })}>
                Ideallinie: {settings.showLine ? 'An' : 'Aus'}
              </button>
            </div>
            <div className="keys">
              <kbd>W / ↑</kbd><span>Gas</span>
              <kbd>S / ↓</kbd><span>Bremse (im Stand: rückwärts)</span>
              <kbd>A D / ← →</kbd><span>Lenken</span>
              <kbd>Leertaste</kbd><span>Boost (Energie für Überholmanöver)</span>
              {isRace && (<><kbd>P</kbd><span>Boxenstopp anfordern oder absagen</span></>)}
              {isRace && features.tyres && (<><kbd>1 – 5 · F · E</kbd><span>im Boxenmenü: Reifen · Nachtanken · Reparatur</span></>)}
              <kbd>R</kbd><span>Auto auf die Strecke zurücksetzen</span>
              <kbd>C</kbd><span>Kamera wechseln (Verfolger · Weit · Cockpit)</span>
              <kbd>L · T</kbd><span>Ideallinie · Zeitenliste</span>
              <kbd>Esc</kbd><span>Pause</span>
            </div>
          </div>
        </div>
      )}
      {ff && (
        <div className="sim-progress">
          <div className="modal" style={{ textAlign: 'center' }}>
            <h3>Rennen wird zu Ende gefahren …</h3>
          </div>
        </div>
      )}
    </div>
  );
}

function gearInfo(c: CarSim) {
  const vmax = c.cfg.car.vmax;
  const span = vmax / 7.4;
  const g = Math.max(1, Math.min(8, 1 + Math.floor(Math.max(0, c.speed) / span)));
  const within = (Math.max(0, c.speed) - (g - 1) * span) / span;
  const rpm = Math.max(0.15, Math.min(1, 0.35 + within * 0.65)) * (c.speed < 0.5 ? 0.4 : 1);
  return { gear: c.speed < 0.3 && c.throttle === 0 ? 0 : g, rpm };
}

// Vorschau auf die nächste Kurve aus dem Geschwindigkeitsprofil des Autos
function cornerPreview(eng: RaceEngine, c: CarSim): Hud['corner'] {
  const g = eng.geo;
  const prof = c.ai.profile;
  if (!prof || prof[0] === 0 || c.pit !== 'none') return null;
  const v = c.speed;
  const n = g.n;
  const maxScan = Math.round(420 / g.ds);
  let brakeIdx = -1;
  for (let k = 0; k < maxScan; k++) {
    const i = (c.idx + k) % n;
    if (prof[i] < v - 2.5) {
      brakeIdx = k;
      break;
    }
  }
  // Scheitelpunkt: niedrigste Zielgeschwindigkeit der folgenden 160 m
  let apexK = -1;
  let vMin = Infinity;
  const startK = brakeIdx >= 0 ? brakeIdx : 0;
  for (let k = startK; k < Math.min(maxScan + 80, startK + Math.round(160 / g.ds)); k++) {
    const i = (c.idx + k) % n;
    if (prof[i] < vMin) {
      vMin = prof[i];
      apexK = k;
    }
  }
  if (brakeIdx < 0) {
    // keine Bremsung nötig: nächste deutliche Kurve suchen
    for (let k = 0; k < maxScan; k++) {
      const i = (c.idx + k) % n;
      if (Math.abs(g.lineK[i]) > 1 / 120) {
        const dir = Math.sign(g.lineK[i]);
        return { dir, dist: k * g.ds, speed: prof[i], brakeNow: false, urgency: 0 };
      }
    }
    return null;
  }
  const ai = (c.idx + apexK) % n;
  const dir = Math.sign(g.lineK[ai]) || 1;
  const dist = brakeIdx * g.ds;
  const brakeNow = brakeIdx <= 2 || prof[c.idx] < v - 2;
  const urgency = Math.max(0, Math.min(1, 1 - dist / Math.max(60, v * 2.5)));
  return { dir, dist, speed: vMin, brakeNow, urgency };
}

function pitHud(eng: RaceEngine, c: CarSim): PitHud | null {
  if (eng.cfg.mode !== 'race' || !c.cfg.human) return null;
  const side = eng.pitSide;
  const compound = c.pitReq?.compound ?? c.tyre.compound;
  if (c.pit === 'stopped') return { phase: 'stop', dist: 0, side, timer: Math.max(0, c.pitTimer), total: c.pitTotal, compound };
  if (c.pit === 'exit') return { phase: eng.exitRed && c.speed < 1.5 ? 'wait' : 'exit', dist: 0, side, timer: 0, total: 0, compound };
  if (c.pit !== 'none') return { phase: 'lane', dist: 0, side, timer: 0, total: 0, compound };
  if (c.pitReq && !c.finished) {
    const L = eng.geo.length;
    if (eng.pitRelOf(c.s) < PIT.entryLen) return { phase: 'call', dist: 0, side, timer: 0, total: 0, compound };
    const toIn = (((eng.pitIn - c.s) % L) + L) % L;
    if (toIn < 650) return { phase: 'call', dist: toIn, side, timer: 0, total: 0, compound };
  }
  return null;
}

function makeHud(eng: RaceEngine, focus: CarSim, hints: boolean): Hud {
  const L = eng.geo.length;
  const order = eng.order();
  const leader = order[0];
  const gi = gearInfo(focus);
  const lapNow = Math.max(0, Math.floor(focus.dist / L)) + 1;
  const tower = order.map((c, i) => {
    let gap = '';
    if (c.dnf) gap = 'AUS';
    else if (c.pit !== 'none') gap = 'BOX';
    else if (i === 0) gap = c.finished ? 'ZIEL' : 'Führt';
    else {
      const lapsBehind = Math.floor((leader.dist - c.dist) / L);
      if (lapsBehind >= 1 && !leader.finished) gap = `+${lapsBehind} Rd`;
      else gap = `+${eng.gapTo(c, leader).toFixed(1)}`;
    }
    return { id: c.cfg.id, pos: i + 1, short: c.cfg.short, color: c.cfg.color, gap, me: c === focus, pit: c.pit !== 'none', out: c.dnf };
  });
  const msgs = eng.messages.filter((m) => eng.time - m.t < 5 && m.t <= eng.time && (!m.carId || m.carId === focus.cfg.id || m.kind !== 'info')).slice(-3);
  const fuelPerLap = 1 / eng.cfg.laps;
  const cur = eng.phase === 'racing' && focus.lapsDone >= 0 && focus.dist >= 0 ? eng.time - focus.lapStart : 0;
  let delta: number | null = null;
  if (isFinite(focus.bestLap) && focus.dist >= 0 && focus.lapTimes.length) {
    const frac = (((focus.dist % L) + L) % L) / L;
    delta = cur - focus.bestLap * frac;
  }
  return {
    pos: focus.pos,
    total: eng.cars.length,
    lap: eng.cfg.mode === 'race' ? lapNow : focus.dist >= 0 ? 1 : 0,
    laps: eng.cfg.laps,
    cur,
    last: focus.lastLap,
    best: focus.bestLap,
    speed: focus.speed,
    gear: gi.gear,
    rpm: gi.rpm,
    tyre: { c: focus.tyre.compound, wear: focus.tyre.wear, temp: focus.tyre.temp },
    fuelLaps: Math.max(0, focus.fuel / fuelPerLap),
    ers: focus.ers,
    damage: [focus.damage.engine, focus.damage.gearbox, focus.damage.brakes, focus.damage.frontWing, focus.damage.suspension],
    slip: focus.slip,
    weather: eng.weatherNow,
    wetness: eng.wetness,
    tower,
    msgs: msgs.map((m) => ({ text: m.text, kind: m.kind, t: m.t })),
    lights: Math.min(5, Math.floor(eng.time / 0.8)),
    phase: eng.phase,
    pitReq: focus.pitReq,
    inPit: focus.pit !== 'none',
    pit: pitHud(eng, focus),
    finished: focus.finished,
    sectors: [],
    delta,
    offTrack: focus.offTrack === 2,
    timedLaps: focus.lapTimes.length,
    wrongWay: focus.speed > 3 && Math.cos(focus.h) * eng.geo.tx[focus.idx] + Math.sin(focus.h) * eng.geo.ty[focus.idx] < -0.3,
    corner: hints ? cornerPreview(eng, focus) : null,
  };
}
