import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { RaceFocus, Screen } from '../../App';
import { useLoadedGame } from '../store';
import { Bar, Btn, FlagStrip, Icon, Money, Seg, Switch, TrackShape, TyreBadge, WeatherIcon } from '../components/common';
import { TRACK_BY_ID } from '../../data/tracks';
import { COMPOUNDS, COMPOUND_KEYS, OVERTAKE_LABELS, STYLE_LABELS, TIERS, WEATHER_LABELS } from '../../data/catalog';
import type { Compound, GameState, RaceResult, Setup, Strategy } from '../../types';
import { ensureWeekend, finishQuali, gainSetupKnowledge, makeRaceConfig, outcomeFromEngine, applyRaceResult, practiceFeedback, simulateQualiLaps, trackGeometry, shortName } from '../../game/weekend';
import { staffSkill } from '../../game/carModel';
import { trackMetrics } from '../../race/trackGeometry';
import { RaceEngine, type RaceConfig } from '../../race/engine';
import { setupQuality } from '../../race/params';
import type { RaceViewResult } from '../race/RaceView';
import { lapTime, money } from '../../game/util';
import { teamById } from '../../game/season';
import { goalText } from '../../game/generators';
import { features, queueTip, type Features } from '../../game/tycoon';

const RaceView = lazy(() => import('../race/RaceView'));

type Session = { mode: 'practice' | 'quali' | 'race'; config: RaceConfig; humanId: string | null; focusId: string; title: string } | null;

export default function RaceHub({ go, onRacing, focus }: { go: (s: Screen) => void; onRacing: (b: boolean) => void; focus?: RaceFocus }) {
  const { game: g, update, toast, get } = useLoadedGame();
  const [session, setSession] = useState<Session>(null);
  const [busy, setBusy] = useState<{ label: string; p: number } | null>(null);
  const [result, setResult] = useState<{ res: RaceResult; repBefore: number; ledger: { label: string; amount: number }[] } | null>(null);

  useEffect(() => {
    if (!g.weekend && g.round < g.calendar.length && !g.seasonEnd) update((s) => void ensureWeekend(s));
  }, [g.weekend, g.round, g.seasonEnd]);
  useEffect(() => onRacing(!!session || !!busy || !!result), [session, busy, result]);
  useEffect(() => () => onRacing(false), []);

  if (result) return <RaceResultView g={g} data={result} onClose={() => { setResult(null); go('dashboard'); }} />;
  if (g.round >= g.calendar.length || g.seasonEnd) {
    return (
      <div className="card">
        <h2>Saison beendet</h2>
        <p className="muted">Alle Rennen dieser Saison sind gefahren.</p>
      </div>
    );
  }
  const w = g.weekend;
  if (!w) return <div className="card">Rennwochenende wird vorbereitet …</div>;
  const t = TRACK_BY_ID[w.trackId];
  const d1 = g.drivers[g.team.driverIds[0]];
  const d2 = g.drivers[g.team.driverIds[1]];
  const canRace = !!d1;
  const f = features(g);
  const beginner = !f.training && !f.quali;

  const startSession = (mode: 'practice' | 'quali' | 'race', drive: boolean) => {
    const cur = get()!;
    const wk = cur.weekend;
    const p1 = cur.drivers[cur.team.driverIds[0]];
    if (!p1 || !wk) {
      toast('Du brauchst mindestens einen Fahrer.', 'bad');
      return;
    }
    let cfg: RaceConfig;
    if (mode === 'race') {
      if (!wk.qualiDone) {
        toast('Erst das Qualifying abschließen.', 'bad');
        return;
      }
      cfg = makeRaceConfig(cur, 'race', drive ? p1.id : null);
    } else cfg = makeRaceConfig(cur, mode, p1.id, [p1.id]);
    setSession({ mode, config: cfg, humanId: drive ? p1.id : null, focusId: p1.id, title: `${t.name} · ${mode === 'race' ? 'Rennen' : mode === 'quali' ? 'Qualifying' : 'Training'}` });
  };

  // Ohne Qualifying wird der Startplatz automatisch berechnet
  const startRace = async (drive: boolean) => {
    if (!get()!.weekend?.qualiDone) await simQuali();
    startSession('race', drive);
  };

  const simPractice = () => {
    const eng = staffSkill(g, 'raceEngineer');
    update((s) => {
      const amount = 28 + eng * 0.25;
      gainSetupKnowledge(s, amount);
      const wk = s.weekend!;
      wk.practiceDone = true;
      wk.practiceLog = practiceFeedback(s);
    });
    toast('Training simuliert – die Ingenieure haben Daten gesammelt.', 'good');
  };

  const simQuali = async (skip: string[] = [], humanTimes: Record<string, number> = {}) => {
    setBusy({ label: 'Qualifying läuft …', p: 0.3 });
    await new Promise((r) => setTimeout(r, 30));
    const times = { ...simulateQualiLaps(get()!, skip), ...humanTimes };
    update((s) => finishQuali(s, times, Object.keys(humanTimes).length > 0));
    setBusy(null);
  };

  const finishRace = (eng: RaceEngine, rainy: boolean, drove: boolean) => {
    const repBefore = get()!.reputation;
    const out = outcomeFromEngine(eng, drove, rainy);
    let res: RaceResult | null = null;
    update((s) => {
      res = applyRaceResult(s, out);
      if (s.results.length >= 1 && s.stats.races >= 2) s.tutorialDone = true;
      if (s.stats.races === 1) queueTip(s, 'after_race');
    });
    if (res) {
      const led = (get()!.flags.lastRaceLedger ?? []) as { label: string; amount: number }[];
      setResult({ res, repBefore, ledger: led.map((l) => ({ label: l.label, amount: l.amount })) });
    }
  };

  const simRace = async () => {
    if (!w.qualiDone) {
      await simQuali();
    }
    setBusy({ label: 'Rennen wird simuliert …', p: 0 });
    await new Promise((r) => setTimeout(r, 30));
    const cfg = makeRaceConfig(get()!, 'race', null);
    const eng = new RaceEngine(cfg);
    eng.autopilotHuman = true;
    let rainy = false;
    const over = () => eng.phase === 'finished';
    while (!over() && eng.time < 3000) {
      for (let i = 0; i < 500 && !over(); i++) {
        eng.step(1 / 30);
        if (eng.wetness > 0.3) rainy = true;
      }
      setBusy({ label: 'Rennen wird simuliert …', p: eng.progress() });
      await new Promise((r) => setTimeout(r, 0));
    }
    setBusy(null);
    finishRace(eng, rainy, false);
  };

  const onSessionExit = (r: RaceViewResult) => {
    const s = session;
    setSession(null);
    if (!s || r.kind === 'abort') return;
    if (r.kind === 'practice') {
      update((st) => {
        const wk = st.weekend!;
        wk.practiceDone = true;
        const best = r.laps.length ? Math.min(...r.laps) : 0;
        if (best && (!wk.practiceBest || best < wk.practiceBest)) wk.practiceBest = best;
        wk.practiceLog = practiceFeedback(st);
        if (best && (!st.stats.bestLaps[wk.trackId] || best < st.stats.bestLaps[wk.trackId])) st.stats.bestLaps[wk.trackId] = best;
      });
    } else if (r.kind === 'quali') {
      const id = s.humanId!;
      const best = r.best > 0 ? r.best : 999;
      simQuali([id], { [id]: best });
    } else if (r.kind === 'race') {
      finishRace(r.engine, r.rainy, r.playerDrove);
    }
  };

  const onLap = (lt: number) => {
    if (session?.mode !== 'practice') return;
    const eng = staffSkill(get()!, 'raceEngineer');
    let fb: string[] = [];
    update((s) => {
      gainSetupKnowledge(s, 9 + eng * 0.08);
      fb = practiceFeedback(s);
    });
    return [`Runde ${lapTime(lt)}`, ...fb.slice(0, 1)];
  };

  return (
    <>
      <section className="card hero-race">
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow">Runde {g.round + 1} · {TIERS[g.tier].name} · {w.laps} Runden</span>
          <div className="row" style={{ gap: 12 }}>
            <FlagStrip colors={t.flag} />
            <h1>{t.name}</h1>
          </div>
          <p className="muted" style={{ maxWidth: 620 }}>{t.description}</p>
          <TrackTraits trackId={t.id} />
          <Forecast w={w} />
        </div>
        <TrackShape trackId={t.id} />
      </section>

      {beginner ? (
        <section className="card beginner-card">
          <div className="stack" style={{ gap: 10 }}>
            <span className="eyebrow">Dein erstes Rennen</span>
            <h2>Starte durch: Du fährst selbst</h2>
            <ul className="tip-list">
              <li>Das Startfeld wird automatisch ermittelt, das Qualifying schaltest du nach dem ersten Rennen frei.</li>
              <li>Gas <kbd>W</kbd>, Bremse <kbd>S</kbd>, Lenken <kbd>A</kbd> <kbd>D</kbd>, Boost <kbd>Leertaste</kbd>. Am Handy erscheinen Tasten auf dem Bildschirm.</li>
              <li>Je weiter vorn du ins Ziel kommst, desto mehr Preisgeld bekommst du. Das Geld brauchst du für neue Gebäude.</li>
            </ul>
          </div>
          <div className="stack">
            <Btn variant="primary big" icon="flag" disabled={!canRace} onClick={() => startRace(true)}>Rennen selbst fahren</Btn>
            <div className="row">
              <Btn icon="play" disabled={!canRace} onClick={() => startRace(false)}>Zuschauen</Btn>
              <Btn icon="sim" disabled={!canRace} onClick={simRace}>Rennen simulieren</Btn>
            </div>
          </div>
        </section>
      ) : (
        <section className="steps">
          {f.training ? (
            <div className={`step ${w.practiceDone ? 'done' : !w.qualiDone ? 'current' : ''}`}>
              <span className="n">1 · Training</span>
              <p className="muted" style={{ fontSize: 14 }}>Runden sammeln, damit der Renningenieur die ideale Abstimmung findet.</p>
              <div className="stack" style={{ gap: 4 }}>
                <div className="row between" style={{ fontSize: 13 }}>
                  <span className="muted">Setup-Wissen</span>
                  <span className="num">{Math.round(w.setupKnowledge)} %</span>
                </div>
                <Bar value={w.setupKnowledge} tone={w.setupKnowledge > 70 ? 'good' : undefined} />
              </div>
              {w.practiceBest > 0 && <span className="muted" style={{ fontSize: 13 }}>Bestzeit: <span className="num">{lapTime(w.practiceBest)}</span></span>}
              {w.practiceLog.length > 0 && (
                <div className="stack" style={{ gap: 4, fontSize: 13 }}>
                  {w.practiceLog.map((l, i) => (
                    <span key={i}>„{l}“</span>
                  ))}
                </div>
              )}
              <div className="row">
                <Btn variant="primary" icon="play" disabled={w.qualiDone || !canRace} onClick={() => startSession('practice', true)}>Selbst fahren</Btn>
                <Btn icon="sim" disabled={w.qualiDone || !canRace} onClick={simPractice}>Simulieren</Btn>
              </div>
            </div>
          ) : (
            <LockedCard title="Training" text="Im Training lernt dein Ingenieur die beste Abstimmung für die Strecke. Baue dafür den Prüfstand auf dem Gelände." />
          )}

          <div className={`step ${w.qualiDone ? 'done' : w.practiceDone || !f.training ? 'current' : ''}`}>
            <span className="n">2 · Qualifying</span>
            {!w.qualiDone ? (
              <>
                <p className="muted" style={{ fontSize: 14 }}>Zwei fliegende Runden. Die schnellste entscheidet über deinen Startplatz. Wer vorn startet, hat freie Bahn.</p>
                <div className="row">
                  <Btn variant="primary" icon="play" disabled={!canRace} onClick={() => startSession('quali', true)}>Selbst fahren</Btn>
                  <Btn icon="sim" disabled={!canRace} onClick={() => simQuali()}>Simulieren</Btn>
                </div>
              </>
            ) : (
              <GridPreview g={g} />
            )}
          </div>

          <div className={`step ${w.qualiDone ? 'current' : ''}`}>
            <span className="n">3 · Rennen</span>
            <p className="muted" style={{ fontSize: 14 }}>Fahre selbst als {d1 ? d1.name : 'Fahrer 1'}, schau zu oder lass das Rennen in Sekunden durchrechnen.</p>
            <div className="stack">
              <Btn variant="primary big" icon="flag" disabled={!canRace} onClick={() => startRace(true)}>Rennen selbst fahren</Btn>
              <div className="row">
                <Btn icon="play" disabled={!canRace} onClick={() => startRace(false)}>Zuschauen</Btn>
                <Btn icon="sim" disabled={!canRace} onClick={simRace}>Rennen simulieren</Btn>
              </div>
              {!w.qualiDone && <span className="muted" style={{ fontSize: 12 }}>Ohne Qualifying wird der Startplatz automatisch berechnet.</span>}
            </div>
          </div>
        </section>
      )}

      <StrategyPanel key={`${w.season}-${w.round}`} g={g} f={f} focus={focus} hasTeammate={!!d2} d1={d1?.name ?? 'Fahrer 1'} d2={d2?.name ?? 'Fahrer 2'} />

      {session && (
        <Suspense fallback={<div className="race-root"><div className="center-msg" style={{ fontSize: 22 }}>Rennstrecke wird geladen …</div></div>}>
        <RaceView
          config={session.config}
          humanId={session.humanId}
          focusId={session.focusId}
          title={session.title}
          settings={g.settings}
          qualiLaps={2}
          features={{ pit: true, fuel: f.tyres, damage: f.garage, tyres: f.tyres }}
          intro={g.stats.races === 0}
          onSettings={(p) => update((s) => void Object.assign(s.settings, p))}
          onExit={onSessionExit}
          onLap={onLap}
        />
        </Suspense>
      )}
      {busy && (
        <div className="sim-progress">
          <div className="modal" style={{ width: 'min(420px,100%)' }}>
            <h3>{busy.label}</h3>
            <Bar value={busy.p * 100} />
          </div>
        </div>
      )}
    </>
  );
}

function LockedCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="step locked">
      <span className="n"><Icon name="lock" size={14} /> {title}</span>
      <p className="muted" style={{ fontSize: 14 }}>{text}</p>
      <span className="pill">Gesperrt</span>
    </div>
  );
}

function TrackTraits({ trackId }: { trackId: string }) {
  const t = TRACK_BY_ID[trackId];
  const m = useMemo(() => trackMetrics(trackGeometry(t)), [trackId]);
  const chips: { l: string; tone?: string }[] = [];
  chips.push({ l: `${(trackGeometry(t).length / 1000).toFixed(2)} km` });
  if (m.straightPct > 0.74) chips.push({ l: 'Lange Geraden' });
  if (m.minR < 18) chips.push({ l: 'Enge Kurven' });
  if (m.corners >= 14) chips.push({ l: 'Viele Kurven' });
  if (t.ideal.wing >= 60) chips.push({ l: 'Schnelle Kurven' });
  if (t.tyreWear >= 1.15) chips.push({ l: 'Hoher Reifenverschleiß', tone: 'warn' });
  if (t.brakeWear >= 1.2) chips.push({ l: 'Hoher Bremsverschleiß', tone: 'warn' });
  if (t.street) chips.push({ l: 'Stadtkurs: Mauern', tone: 'bad' });
  return (
    <div className="row" style={{ gap: 6 }}>
      {chips.map((c) => (
        <span key={c.l} className={`pill ${c.tone ?? ''}`}>{c.l}</span>
      ))}
    </div>
  );
}

function Forecast({ w }: { w: NonNullable<GameState['weekend']> }) {
  const segs = w.forecast;
  const label = (at: number) => (at === 0 ? 'Start' : at < 0.4 ? 'Erstes Drittel' : at < 0.7 ? 'Rennmitte' : 'Schlussphase');
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row between">
        <span className="eyebrow">Wetterprognose</span>
        <span className="muted" style={{ fontSize: 12 }}>Treffsicherheit {Math.round(w.forecastConfidence * 100)} %</span>
      </div>
      <div className="weather-row">
        {segs.map((s, i) => (
          <div key={i} className="weather-seg">
            <WeatherIcon kind={s.kind} />
            <b style={{ fontSize: 12 }}>{WEATHER_LABELS[s.kind]}</b>
            <span className="muted">{label(s.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GridPreview({ g }: { g: GameState }) {
  const w = g.weekend!;
  const pole = w.qualiTimes[w.grid[0]];
  const mine = g.team.driverIds;
  const rows = w.grid.map((id, i) => ({ id, pos: i + 1 }));
  const show = rows.filter((r) => r.pos <= 5 || mine.includes(r.id));
  return (
    <div className="stack" style={{ gap: 2, fontSize: 13 }}>
      {show.map((r) => {
        const d = g.drivers[r.id];
        const team = d ? teamById(g, d.teamId ?? '') : undefined;
        const me = mine.includes(r.id);
        return (
          <div key={r.id} className="row between" style={{ fontWeight: me ? 700 : 400, color: me ? 'var(--text)' : 'var(--muted)', flexWrap: 'nowrap' }}>
            <span className="row" style={{ gap: 6, flexWrap: 'nowrap', minWidth: 0 }}>
              <span className="pos" style={{ fontSize: 14, width: 26 }}>P{r.pos}</span>
              <span className="team-chip" style={{ background: team?.color ?? '#888', height: 14, marginRight: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d?.name}</span>
            </span>
            <span className="num">{r.pos === 1 ? lapTime(pole) : `+${(w.qualiTimes[r.id] - pole).toFixed(3)}`}</span>
          </div>
        );
      })}
    </div>
  );
}

function StrategyPanel({ g, f, focus, hasTeammate, d1, d2 }: { g: GameState; f: Features; focus?: RaceFocus; hasTeammate: boolean; d1: string; d2: string }) {
  const { update } = useLoadedGame();
  const w = g.weekend!;
  const t = TRACK_BY_ID[w.trackId];
  const [tab, setTab] = useState<'d1' | 'd2'>('d1');
  const [setup, setSetup] = useState<Setup>(w.strategy.setup);
  const [s1, setS1] = useState<Strategy>(w.strategy);
  const [s2, setS2] = useState<Strategy>(w.teammateStrategy);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const tm = setTimeout(() => {
      update((s) => {
        if (!s.weekend) return;
        s.weekend.strategy = { ...s1, setup };
        s.weekend.teammateStrategy = { ...s2, setup };
      });
    }, 250);
    return () => clearTimeout(tm);
  }, [setup, s1, s2]);

  useEffect(() => {
    if (focus) setTimeout(() => document.getElementById(`strat-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }, [focus]);

  const cur = tab === 'd1' ? s1 : s2;
  const setCur = (p: Partial<Strategy>) => (tab === 'd1' ? setS1({ ...s1, ...p }) : setS2({ ...s2, ...p }));
  const laps = w.laps;
  const scale = Math.max(laps, 6);
  const tyreLife = (c: Compound) => Math.max(1, (COMPOUNDS[c].life * scale) / t.tyreWear);
  const fuelLaps = cur.fuel * laps;
  const lapsOnStart = cur.stops.length ? cur.stops[0].lap : laps;
  const startLifeWarn = ['soft', 'medium', 'hard'].includes(cur.startCompound) && tyreLife(cur.startCompound) < lapsOnStart - 0.5;
  const knowQuality = setupQuality(setup, { ...t, ideal: w.setupHint });
  const sliders: { k: keyof Setup; l: string; lo: string; hi: string }[] = [
    { k: 'wing', l: 'Flügel', lo: 'wenig Abtrieb · Topspeed', hi: 'viel Abtrieb · Kurvenspeed' },
    { k: 'gearing', l: 'Übersetzung', lo: 'kurz · Beschleunigung', hi: 'lang · Endgeschwindigkeit' },
    { k: 'suspension', l: 'Fahrwerk', lo: 'weich · reifenschonend', hi: 'hart · präzise' },
  ];

  if (!f.setup && !f.tyres && !f.tactics) {
    return (
      <section className="card stack" style={{ gap: 10 }}>
        <div className="card-h">
          <h2><Icon name="lock" size={18} /> Abstimmung &amp; Strategie</h2>
          <span className="pill">Noch gesperrt</span>
        </div>
        <p className="muted">Hier stellst du später dein Auto auf die Strecke ein und planst Reifen, Boxenstopps und Taktik. Das schaltest du auf dem Gelände frei:</p>
        <ul className="tip-list">
          <li><b>Prüfstand</b>: Training und Fahrzeugabstimmung (nach der Werkstatt)</li>
          <li><b>Reifenlager</b>: Reifenwahl, Tankmenge und Boxenstopps</li>
          <li><b>Boxenmauer</b>: Fahrstil, Aggressivität und Überholstrategie</li>
        </ul>
      </section>
    );
  }

  return (
    <section className="card stack" style={{ gap: 16 }}>
      <div className="card-h">
        <h2>Abstimmung &amp; Strategie</h2>
        <span className="muted" style={{ fontSize: 13 }}>Änderungen werden automatisch übernommen.</span>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 12 }}>
          {f.setup ? (<>
          <div className="row between" id="strat-setup">
            <h3>Fahrzeugabstimmung</h3>
            <Btn variant="sm" onClick={() => setSetup({ ...w.setupHint })}>Empfehlung übernehmen</Btn>
          </div>
          {sliders.map((sl) => (
            <div key={sl.k} className="field">
              <div className="row between">
                <label htmlFor={`set-${sl.k}`}>{sl.l}</label>
                <span className="num" style={{ fontSize: 13 }}>{setup[sl.k]} <span className="muted">· Empfehlung {w.setupHint[sl.k]}</span></span>
              </div>
              <div style={{ position: 'relative' }}>
                <input id={`set-${sl.k}`} type="range" min={0} max={100} value={setup[sl.k]} onChange={(e) => setSetup({ ...setup, [sl.k]: +e.target.value })} />
                <span aria-hidden="true" style={{ position: 'absolute', top: -4, left: `calc(${w.setupHint[sl.k]}% - 1px)`, width: 2, height: 8, background: 'var(--good)' }} />
              </div>
              <div className="row between muted" style={{ fontSize: 11.5 }}>
                <span>{sl.lo}</span>
                <span>{sl.hi}</span>
              </div>
            </div>
          ))}
          <div className="row between" style={{ fontSize: 13 }}>
            <span className="muted">Passt zur Empfehlung (Setup-Wissen {Math.round(w.setupKnowledge)} %)</span>
            <span className={knowQuality > 0.85 ? 'good' : knowQuality > 0.65 ? 'warn' : 'bad'}>{Math.round(knowQuality * 100)} %</span>
          </div>
          </>) : (
            <LockedCard title="Fahrzeugabstimmung" text="Flügel, Übersetzung und Fahrwerk auf die Strecke einstellen. Baue dafür den Prüfstand." />
          )}
          {f.tyres && (<>
          <div className="sep" />
          <h3 id="strat-tyres">Reifen auf dieser Strecke</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Mischung</th><th>Einsatz</th><th className="num">Runden bis Abfall</th></tr>
              </thead>
              <tbody>
                {COMPOUND_KEYS.map((c) => (
                  <tr key={c}>
                    <td><span className="row" style={{ gap: 8 }}><TyreBadge c={c} sm /> {COMPOUNDS[c].label}</span></td>
                    <td className="muted" style={{ fontSize: 13 }}>{COMPOUNDS[c].desc}</td>
                    <td className="num">{['inter', 'wet'].includes(c) ? 'je nach Nässe' : `ca. ${tyreLife(c).toFixed(1)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>)}
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <div className="row between">
            <h3>Rennstrategie</h3>
            {hasTeammate && (f.tyres || f.tactics) && <Seg value={tab} onChange={setTab} options={[{ v: 'd1', l: d1.split(' ').slice(-1)[0] }, { v: 'd2', l: d2.split(' ').slice(-1)[0] }]} />}
          </div>
          {f.tyres ? (<>
          <div className="field" id="strat-tyres-plan">
            <span className="lbl">Startreifen</span>
            <div className="tyre-pick">
              {COMPOUND_KEYS.map((c) => (
                <button key={c} type="button" className={cur.startCompound === c ? 'on' : ''} onClick={() => setCur({ startCompound: c })}>
                  <TyreBadge c={c} />
                  {COMPOUNDS[c].label}
                </button>
              ))}
            </div>
            {startLifeWarn && <span className="warn" style={{ fontSize: 13 }}>Diese Mischung hält vermutlich nicht bis zum ersten Stopp.</span>}
          </div>
          <div className="field">
            <div className="row between">
              <label htmlFor="fuel">Tankmenge</label>
              <span className="num" style={{ fontSize: 13 }}>{Math.round(cur.fuel * 100)} % · {fuelLaps.toFixed(1)} Runden</span>
            </div>
            <input id="fuel" type="range" min={80} max={125} value={Math.round(cur.fuel * 100)} onChange={(e) => setCur({ fuel: +e.target.value / 100 })} />
            <span className="muted" style={{ fontSize: 12 }}>
              {cur.fuel < 1 ? 'Zu wenig für das ganze Rennen – ein Tankstopp ist nötig.' : cur.fuel < 1.04 ? 'Knapp kalkuliert: bei Vollgas musst du Sprit sparen.' : 'Mehr Sprit = schwerer und langsamer, aber sicher.'}
            </span>
          </div>
          <div className="field">
            <div className="row between">
              <span className="lbl">Boxenstopps</span>
              <Btn variant="sm" disabled={cur.stops.length >= 3} onClick={() => setCur({ stops: [...cur.stops, { lap: Math.min(laps, (cur.stops[cur.stops.length - 1]?.lap ?? 1) + Math.max(1, Math.floor(laps / 3))), compound: 'medium' }] })}>
                Stopp hinzufügen
              </Btn>
            </div>
            {cur.stops.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Kein geplanter Stopp. Bei Wetterwechsel reagiert das Team automatisch, wenn aktiviert.</span>}
            {cur.stops.map((st, i) => (
              <div key={i} className="row" style={{ gap: 8 }}>
                <span className="muted" style={{ fontSize: 13, width: 52 }}>Stopp {i + 1}</span>
                <select aria-label={`Runde Stopp ${i + 1}`} value={st.lap} style={{ width: 'auto' }} onChange={(e) => setCur({ stops: cur.stops.map((x, j) => (j === i ? { ...x, lap: +e.target.value } : x)) })}>
                  {Array.from({ length: laps }, (_, k) => k + 1).map((l) => (
                    <option key={l} value={l}>Runde {l}</option>
                  ))}
                </select>
                <select aria-label={`Reifen Stopp ${i + 1}`} value={st.compound} style={{ width: 'auto' }} onChange={(e) => setCur({ stops: cur.stops.map((x, j) => (j === i ? { ...x, compound: e.target.value as Compound } : x)) })}>
                  {COMPOUND_KEYS.map((c) => (
                    <option key={c} value={c}>{COMPOUNDS[c].label}</option>
                  ))}
                </select>
                <button type="button" className="btn sm ghost" aria-label="Stopp entfernen" onClick={() => setCur({ stops: cur.stops.filter((_, j) => j !== i) })}>
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>
          </>) : (
            <LockedCard title="Reifen, Sprit und Boxenstopps" text="Mischung, Tankmenge und Stopps selbst planen. Baue dafür das Reifenlager." />
          )}
          {f.tactics ? (<>
          <div className="field" id="strat-tactics">
            <span className="lbl">Fahrstil</span>
            <Seg value={cur.style} onChange={(v) => setCur({ style: v })} options={(Object.keys(STYLE_LABELS) as (keyof typeof STYLE_LABELS)[]).map((k) => ({ v: k, l: STYLE_LABELS[k] }))} />
            <span className="muted" style={{ fontSize: 12 }}>Schonend spart Reifen, Sprit und Material. Angriff ist schneller, riskanter und verschleißt mehr.</span>
          </div>
          <div className="field">
            <div className="row between">
              <label htmlFor="aggr">Aggressivität im Zweikampf</label>
              <span className="num" style={{ fontSize: 13 }}>{cur.aggression}</span>
            </div>
            <input id="aggr" type="range" min={0} max={100} value={cur.aggression} onChange={(e) => setCur({ aggression: +e.target.value })} />
          </div>
          <div className="field">
            <span className="lbl">Überholstrategie</span>
            <Seg value={cur.overtake} onChange={(v) => setCur({ overtake: v })} options={(Object.keys(OVERTAKE_LABELS) as (keyof typeof OVERTAKE_LABELS)[]).map((k) => ({ v: k, l: OVERTAKE_LABELS[k] }))} />
          </div>
          <Switch id={`weather-${tab}`} on={cur.reactToWeather} onChange={(v) => setCur({ reactToWeather: v })} label="Bei Wetterwechsel automatisch auf passende Reifen wechseln" />
          </>) : (
            <LockedCard title="Fahrstil und Taktik" text="Fahrstil, Aggressivität und Überholstrategie für den Computer-Fahrer. Baue dafür die Boxenmauer." />
          )}
          {tab === 'd1' && f.tyres && <p className="muted" style={{ fontSize: 12 }}>Wenn du selbst fährst, entscheidest du über Boxenstopps (Taste P oder BOX). Der Plan gilt, wenn dein Fahrer übernimmt.</p>}
        </div>
      </div>
    </section>
  );
}

function RaceResultView({ g, data, onClose }: { g: GameState; data: { res: RaceResult; repBefore: number; ledger: { label: string; amount: number }[] }; onClose: () => void }) {
  const r = data.res;
  const t = TRACK_BY_ID[r.trackId];
  const winnerTime = r.entries[0]?.time ?? 0;
  const ledger = data.ledger;
  const earned = ledger.reduce((a, l) => a + l.amount, 0);
  const mine = r.entries.filter((e) => e.teamId === 'player');
  const podium = r.entries.slice(0, 3);
  return (
    <>
      <section className="card stack" style={{ gap: 16 }}>
        <div className="row between">
          <div>
            <div className="eyebrow">Ergebnis · Runde {r.round + 1} · {WEATHER_LABELS[r.weather]}</div>
            <h1>{t.name}</h1>
          </div>
          <Btn variant="primary big" onClick={onClose}>Weiter</Btn>
        </div>
        <div className="results-podium">
          {[podium[1], podium[0], podium[2]].map((e, i) => {
            if (!e) return <div key={i} />;
            const d = g.drivers[e.driverId];
            const team = teamById(g, e.teamId);
            return (
              <div key={e.driverId} className={`podium-step p${e.pos}`} style={{ borderTop: `3px solid ${team?.color ?? '#888'}` }}>
                <span className="pp">{e.pos}</span>
                <b style={{ fontSize: 14 }}>{d?.name ?? '–'}</b>
                <span className="muted" style={{ fontSize: 12 }}>{team?.name}</span>
              </div>
            );
          })}
        </div>
        <div className="grid g4 keep">
          {mine.map((e) => (
            <div key={e.driverId} className="stat-tile">
              <span className="eyebrow">{g.drivers[e.driverId]?.name}</span>
              <span className="big-num">{e.dnf ? 'DNF' : `P${e.pos}`}</span>
              <span className="muted" style={{ fontSize: 13 }}>Start P{e.grid} · {e.points} Punkte{e.fastest ? ' · schnellste Runde' : ''}</span>
            </div>
          ))}
          <div className="stat-tile">
            <span className="eyebrow">Bilanz Rennwochenende</span>
            <span className="big-num" style={{ fontSize: 26 }}><Money v={earned} sign compact /></span>
          </div>
          <div className="stat-tile">
            <span className="eyebrow">Reputation</span>
            <span className="big-num" style={{ fontSize: 26 }}>{Math.round(g.reputation)}</span>
            <span className={g.reputation >= data.repBefore ? 'good' : 'bad'} style={{ fontSize: 13 }}>{g.reputation >= data.repBefore ? '+' : ''}{(g.reputation - data.repBefore).toFixed(1)}</span>
          </div>
        </div>
      </section>
      <section className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>Klassement</h3></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Pos</th><th>Fahrer</th><th className="num">Start</th><th className="num">Zeit</th><th className="num">Beste</th><th className="num">Pkt</th></tr>
              </thead>
              <tbody>
                {r.entries.map((e) => {
                  const d = g.drivers[e.driverId];
                  const team = teamById(g, e.teamId);
                  return (
                    <tr key={e.driverId} className={e.teamId === 'player' ? 'me' : ''}>
                      <td className="pos">{e.pos}</td>
                      <td>
                        <span className="team-chip" style={{ background: team?.color }} />
                        {d ? shortName(d) : '–'} <span className="muted" style={{ fontSize: 12 }}>{team?.short}</span>
                      </td>
                      <td className="num">{e.grid}</td>
                      <td className="num">{e.dnf ? <span className="bad">{e.dnfReason || 'DNF'}</span> : e.pos === 1 ? lapTime(e.time) : e.laps < r.entries[0].laps ? `+${r.entries[0].laps - e.laps} Rd` : `+${(e.time - winnerTime).toFixed(3)}`}</td>
                      <td className={`num ${e.fastest ? 'purple' : ''}`}>{lapTime(e.bestLap)}</td>
                      <td className="num">{e.points || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Abrechnung</h3></div>
          <div className="stack" style={{ gap: 0 }}>
            {ledger.map((l, i) => (
              <div key={i} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 14, flexWrap: 'nowrap' }}>
                <span style={{ minWidth: 0 }}>{l.label}</span>
                <Money v={l.amount} sign />
              </div>
            ))}
          </div>
          {g.sponsors.length > 0 && (
            <>
              <div className="sep" />
              <div className="eyebrow" style={{ margin: '8px 0' }}>Sponsorziele</div>
              {g.sponsors.map((s) => (
                <div key={s.id} className="row between" style={{ fontSize: 14 }}>
                  <span>{s.name}: {goalText(s.goal)}</span>
                  <span className={s.misses === 0 ? 'good' : 'bad'}>{s.misses === 0 ? 'erfüllt' : `${s.misses}× verfehlt`}</span>
                </div>
              ))}
            </>
          )}
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Kontostand: {money(g.money)}</p>
        </div>
      </section>
    </>
  );
}
