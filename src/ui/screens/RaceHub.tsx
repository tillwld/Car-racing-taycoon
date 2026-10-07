import { lazy, Suspense, useEffect, useState } from 'react';
import type { RaceFocus, Screen } from '../../App';
import { useLoadedGame } from '../store';
import { Bar, Btn, FlagStrip, Money, TrackShape } from '../components/common';
import { StationIntro } from '../components/Station';
import RaceStation from './RaceStations';
import { Forecast, TrackTraits } from './RaceParts';
import { TRACK_BY_ID } from '../../data/tracks';
import { COMPOUNDS, STYLE_LABELS, TIERS, WEATHER_LABELS } from '../../data/catalog';
import type { GameState, RaceResult } from '../../types';
import { ensureWeekend, finishQuali, gainSetupKnowledge, makeRaceConfig, outcomeFromEngine, applyRaceResult, practiceFeedback, simulateQualiLaps, shortName } from '../../game/weekend';
import { staffSkill } from '../../game/carModel';
import { RaceEngine, type RaceConfig } from '../../race/engine';
import { setupQuality } from '../../race/params';
import type { RaceViewResult } from '../race/RaceView';
import { lapTime, money } from '../../game/util';
import { teamById } from '../../game/season';
import { goalText } from '../../game/generators';
import { features, queueTip } from '../../game/tycoon';

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
      s.flags.practiced = true;
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
      if (s.stats.races === 2) queueTip(s, 'quali');
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
        st.flags.practiced = true;
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

  const overlays = (
    <>
      {session && (
        <Suspense fallback={<div className="race-root"><div className="center-msg" style={{ fontSize: 22 }}>Rennstrecke wird geladen …</div></div>}>
        <RaceView
          config={session.config}
          humanId={session.humanId}
          focusId={session.focusId}
          title={session.title}
          settings={g.settings}
          qualiLaps={2}
          features={{ pit: true, fuel: true, damage: true, tyres: true }}
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

  const strat = w.strategy;
  const quality = setupQuality(strat.setup, { ...t, ideal: w.setupHint });
  const prep: { label: string; value: string; where: string; tone?: string }[] = [];
  if (f.setup) prep.push({ label: 'Abstimmung', value: `${Math.round(quality * 100)} % passend`, where: 'Ändern im Prüfstand', tone: quality > 0.85 ? 'good' : quality > 0.65 ? 'warn' : 'bad' });
  if (f.tyres) prep.push({ label: 'Reifen und Stopps', value: `${COMPOUNDS[strat.startCompound].label} · ${strat.stops.length === 1 ? '1 Stopp' : `${strat.stops.length} Stopps`} · Tank ${Math.round(strat.fuel * 100)} %`, where: 'Ändern im Reifenlager' });
  if (f.tactics) prep.push({ label: 'Taktik', value: `${STYLE_LABELS[strat.style]} · Aggressivität ${strat.aggression}`, where: 'Ändern an der Boxenmauer' });
  const n0 = f.training ? 1 : 0;

  if (focus) {
    return (
      <>
        <RaceStation
          key={`${w.season}-${w.round}-${focus}`}
          g={g}
          focus={focus}
          hasTeammate={!!d2}
          canRace={canRace}
          d1={d1?.name ?? 'Fahrer 1'}
          d2={d2?.name ?? 'Fahrer 2'}
          onPracticeDrive={() => startSession('practice', true)}
          onPracticeSim={simPractice}
        />
        {overlays}
      </>
    );
  }

  return (
    <>
      {!beginner && (
        <StationIntro
          id="truck"
          icon="race"
          lead="Der Transporter ist dein Rennwochenende. Hier startest du Qualifying und Rennen."
          items={[
            { title: 'Vorbereiten', text: 'Auto, Reifen und Taktik stellst du an den eigenen Stationen ein. Unten siehst du eine Zusammenfassung davon.' },
            { title: 'Qualifying', text: 'Zwei fliegende Runden entscheiden über deinen Startplatz. Wer vorn startet, hat freie Bahn.' },
            { title: 'Rennen', text: 'Fahre selbst, schau zu oder lass das Rennen in Sekunden berechnen.' },
            { title: 'Ergebnis', text: 'Danach gibt es Preisgeld, Sponsorgeld und Punkte. Das Geld steckst du in neue Bereiche.' },
          ]}
          tip="Tipp: Selbst fahren bringt am meisten, simulieren geht am schnellsten."
        />
      )}

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
              <li>Das Startfeld wird automatisch ermittelt, das Qualifying schaltest du nach dem zweiten Rennen frei.</li>
              <li>Gas <kbd>W</kbd>, Bremse <kbd>S</kbd>, Lenken <kbd>A</kbd> <kbd>D</kbd>, Boost <kbd>Leertaste</kbd>. Am Handy erscheinen Tasten auf dem Bildschirm.</li>
              <li>Beim Start gehen fünf Lichter an. Gib erst Gas, wenn sie ausgehen. Zu früh ist ein Fehlstart.</li>
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
          {f.training && (
            <div className={`step ${w.practiceDone ? 'done' : !w.qualiDone ? 'current' : ''}`}>
              <span className="n">1 · Training</span>
              <p className="muted" style={{ fontSize: 14 }}>Das Training fährst du im Prüfstand. Dort sammelt dein Ingenieur Daten für die Abstimmung.</p>
              <div className="stack" style={{ gap: 4 }}>
                <div className="row between" style={{ fontSize: 13 }}>
                  <span className="muted">Setup-Wissen</span>
                  <span className="num">{Math.round(w.setupKnowledge)} %</span>
                </div>
                <Bar value={w.setupKnowledge} tone={w.setupKnowledge > 70 ? 'good' : undefined} />
              </div>
              <span className={`pill ${w.practiceDone ? 'good' : ''}`}>{w.practiceDone ? 'erledigt' : 'optional · im Prüfstand'}</span>
            </div>
          )}

          <div className={`step ${w.qualiDone ? 'done' : 'current'}`}>
            <span className="n">{n0 + 1} · Qualifying</span>
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
            <span className="n">{n0 + 2} · Rennen</span>
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

      {!beginner && prep.length > 0 && (
        <section className="card stack" style={{ gap: 8 }}>
          <div>
            <h3>Vorbereitung</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>So gehst du ins Rennen. Ändern kannst du das an den jeweiligen Stationen auf dem Gelände.</p>
          </div>
          {prep.map((r) => (
            <div key={r.label} className="row between prep-row">
              <div style={{ minWidth: 0 }}>
                <b>{r.label}</b>
                <div className="muted" style={{ fontSize: 12.5 }}>{r.where}</div>
              </div>
              <span className={r.tone ?? ''} style={{ textAlign: 'right' }}>{r.value}</span>
            </div>
          ))}
        </section>
      )}

      {overlays}
    </>
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
