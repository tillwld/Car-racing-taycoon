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
import { gapTime, lapTime } from '../../game/util';
import { teamById } from '../../game/season';
import { goalText } from '../../game/generators';
import { features, queueTip } from '../../game/tycoon';
import { fmtNum, m, t, tp, tx, useLang } from '../../i18n';
import { AdButton } from '../components/AdButton';
import { rewardedSupported, scheduleInterstitial } from '../../platform/ads';
import { grantRepairDiscount, repairDiscountActive } from '../../game/adRewards';

const RaceView = lazy(() => import('../race/RaceView'));

type Session = { mode: 'practice' | 'quali' | 'race'; config: RaceConfig; humanId: string | null; focusId: string; title: string } | null;

export default function RaceHub({ go, onRacing, focus }: { go: (s: Screen) => void; onRacing: (b: boolean) => void; focus?: RaceFocus }) {
  useLang();
  const { game: g, update, toast, get } = useLoadedGame();
  const [session, setSession] = useState<Session>(null);
  const [busy, setBusy] = useState<{ label: string; p: number } | null>(null);
  const [result, setResult] = useState<{ res: RaceResult; repBefore: number; ledger: { label: string; amount: number }[] } | null>(null);

  useEffect(() => {
    if (!g.weekend && g.round < g.calendar.length && !g.seasonEnd) update((s) => void ensureWeekend(s));
  }, [g.weekend, g.round, g.seasonEnd]);
  useEffect(() => onRacing(!!session || !!busy || !!result), [session, busy, result]);
  useEffect(() => () => onRacing(false), []);

  if (result) return <RaceResultView g={g} data={result} onClose={() => { setResult(null); scheduleInterstitial('race_result'); go('dashboard'); }} />;
  if (g.round >= g.calendar.length || g.seasonEnd) {
    return (
      <div className="card">
        <h2>{t('racehub.seasonOver.title')}</h2>
        <p className="muted">{t('racehub.seasonOver.text')}</p>
      </div>
    );
  }
  const w = g.weekend;
  if (!w) return <div className="card">{t('racehub.preparing')}</div>;
  const trk = TRACK_BY_ID[w.trackId];
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
      toast(t('racehub.toast.needDriver'), 'bad');
      return;
    }
    let cfg: RaceConfig;
    if (mode === 'race') {
      if (!wk.qualiDone) {
        toast(t('racehub.toast.qualiFirst'), 'bad');
        return;
      }
      cfg = makeRaceConfig(cur, 'race', drive ? p1.id : null);
    } else cfg = makeRaceConfig(cur, mode, p1.id, [p1.id]);
    setSession({ mode, config: cfg, humanId: drive ? p1.id : null, focusId: p1.id, title: `${trk.name} · ${t(mode === 'race' ? 'racehub.mode.race' : mode === 'quali' ? 'racehub.mode.quali' : 'racehub.mode.practice')}` });
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
    toast(t('racehub.toast.practiceSim'), 'good');
  };

  const simQuali = async (skip: string[] = [], humanTimes: Record<string, number> = {}) => {
    setBusy({ label: t('racehub.busy.quali'), p: 0.3 });
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
    setBusy({ label: t('racehub.busy.race'), p: 0 });
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
      setBusy({ label: t('racehub.busy.race'), p: eng.progress() });
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
    return [m('racehub.lapMsg', { time: lapTime(lt) }), ...fb.slice(0, 1)];
  };

  const overlays = (
    <>
      {session && (
        <Suspense fallback={<div className="race-root"><div className="center-msg" style={{ fontSize: 22 }}>{t('racehub.loading')}</div></div>}>
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
  const quality = setupQuality(strat.setup, { ...trk, ideal: w.setupHint });
  const prep: { label: string; value: string; where: string; tone?: string }[] = [];
  if (f.setup) prep.push({ label: t('racehub.prep.setup'), value: t('racehub.prep.setupValue', { q: quality }), where: t('racehub.prep.setupWhere'), tone: quality > 0.85 ? 'good' : quality > 0.65 ? 'warn' : 'bad' });
  if (f.tyres) prep.push({ label: t('racehub.prep.tyres'), value: tp('racehub.prep.tyresValue', strat.stops.length, { tyre: COMPOUNDS[strat.startCompound].label, fuel: strat.fuel }), where: t('racehub.prep.tyresWhere') });
  if (f.tactics) prep.push({ label: t('racehub.prep.tactics'), value: t('racehub.prep.tacticsValue', { style: STYLE_LABELS[strat.style], aggr: strat.aggression }), where: t('racehub.prep.tacticsWhere') });
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
          d1={d1?.name ?? t('racehub.driver1')}
          d2={d2?.name ?? t('racehub.driver2')}
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
          lead={t('racehub.intro.lead')}
          items={[
            { title: t('racehub.intro.prepareTitle'), text: t('racehub.intro.prepareText') },
            { title: t('racehub.intro.qualiTitle'), text: t('racehub.intro.qualiText') },
            { title: t('racehub.intro.raceTitle'), text: t('racehub.intro.raceText') },
            { title: t('racehub.intro.resultTitle'), text: t('racehub.intro.resultText') },
          ]}
          tip={t('racehub.intro.tip')}
        />
      )}

      <section className="card hero-race">
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow">{tp('racehub.hero.eyebrow', w.laps, { round: g.round + 1, tier: TIERS[g.tier].name })}</span>
          <div className="row" style={{ gap: 12 }}>
            <FlagStrip colors={trk.flag} />
            <h1>{trk.name}</h1>
          </div>
          <p className="muted" style={{ maxWidth: 620 }}>{trk.description}</p>
          <TrackTraits trackId={trk.id} />
          <Forecast w={w} />
        </div>
        <TrackShape trackId={trk.id} />
      </section>

      {beginner ? (
        <section className="card beginner-card">
          <div className="stack" style={{ gap: 10 }}>
            <span className="eyebrow">{t('racehub.beginner.eyebrow')}</span>
            <h2>{t('racehub.beginner.title')}</h2>
            <ul className="tip-list">
              <li>{t('racehub.beginner.grid')}</li>
              <li>{t('racehub.beginner.throttle')} <kbd>W</kbd>, {t('racehub.beginner.brake')} <kbd>S</kbd>, {t('racehub.beginner.steer')} <kbd>A</kbd> <kbd>D</kbd>, {t('racehub.beginner.boost')} <kbd>{t('racehub.beginner.space')}</kbd>. {t('racehub.beginner.touch')}</li>
              <li>{t('racehub.beginner.lights')}</li>
              <li>{t('racehub.beginner.prize')}</li>
            </ul>
          </div>
          <div className="stack">
            <Btn variant="primary big" icon="flag" disabled={!canRace} onClick={() => startRace(true)}>{t('racehub.btn.driveRace')}</Btn>
            <div className="row">
              <Btn icon="play" disabled={!canRace} onClick={() => startRace(false)}>{t('racehub.btn.watch')}</Btn>
              <Btn icon="sim" disabled={!canRace} onClick={simRace}>{t('racehub.btn.simRace')}</Btn>
            </div>
          </div>
        </section>
      ) : (
        <section className="steps">
          {f.training && (
            <div className={`step ${w.practiceDone ? 'done' : !w.qualiDone ? 'current' : ''}`}>
              <span className="n">1 · {t('racehub.step.practice')}</span>
              <p className="muted" style={{ fontSize: 14 }}>{t('racehub.step.practiceText')}</p>
              <div className="stack" style={{ gap: 4 }}>
                <div className="row between" style={{ fontSize: 13 }}>
                  <span className="muted">{t('racehub.step.setupKnowledge')}</span>
                  <span className="num">{t('racehub.pct', { n: Math.round(w.setupKnowledge) })}</span>
                </div>
                <Bar value={w.setupKnowledge} tone={w.setupKnowledge > 70 ? 'good' : undefined} />
              </div>
              <span className={`pill ${w.practiceDone ? 'good' : ''}`}>{w.practiceDone ? t('racehub.step.done') : t('racehub.step.optional')}</span>
            </div>
          )}

          <div className={`step ${w.qualiDone ? 'done' : 'current'}`}>
            <span className="n">{n0 + 1} · {t('racehub.step.quali')}</span>
            {!w.qualiDone ? (
              <>
                <p className="muted" style={{ fontSize: 14 }}>{t('racehub.step.qualiText')}</p>
                <div className="row">
                  <Btn variant="primary" icon="play" disabled={!canRace} onClick={() => startSession('quali', true)}>{t('racehub.btn.driveSelf')}</Btn>
                  <Btn icon="sim" disabled={!canRace} onClick={() => simQuali()}>{t('racehub.btn.simulate')}</Btn>
                </div>
              </>
            ) : (
              <GridPreview g={g} />
            )}
          </div>

          <div className={`step ${w.qualiDone ? 'current' : ''}`}>
            <span className="n">{n0 + 2} · {t('racehub.step.race')}</span>
            <p className="muted" style={{ fontSize: 14 }}>{t('racehub.step.raceText', { name: d1 ? d1.name : t('racehub.driver1') })}</p>
            <div className="stack">
              <Btn variant="primary big" icon="flag" disabled={!canRace} onClick={() => startRace(true)}>{t('racehub.btn.driveRace')}</Btn>
              <div className="row">
                <Btn icon="play" disabled={!canRace} onClick={() => startRace(false)}>{t('racehub.btn.watch')}</Btn>
                <Btn icon="sim" disabled={!canRace} onClick={simRace}>{t('racehub.btn.simRace')}</Btn>
              </div>
              {!w.qualiDone && <span className="muted" style={{ fontSize: 12 }}>{t('racehub.step.noQuali')}</span>}
            </div>
          </div>
        </section>
      )}

      {!beginner && prep.length > 0 && (
        <section className="card stack" style={{ gap: 8 }}>
          <div>
            <h3>{t('racehub.prepCard.title')}</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{t('racehub.prepCard.text')}</p>
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
            <span className="num">{r.pos === 1 ? lapTime(pole) : gapTime(w.qualiTimes[r.id] - pole)}</span>
          </div>
        );
      })}
    </div>
  );
}

function RaceResultView({ g, data, onClose }: { g: GameState; data: { res: RaceResult; repBefore: number; ledger: { label: string; amount: number }[] }; onClose: () => void }) {
  useLang();
  const { update, toast } = useLoadedGame();
  const r = data.res;
  const trk = TRACK_BY_ID[r.trackId];
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
            <div className="eyebrow">{t('racehub.result.eyebrow', { round: r.round + 1, weather: WEATHER_LABELS[r.weather] })}</div>
            <h1>{trk.name}</h1>
          </div>
          <Btn variant="primary big" onClick={onClose}>{t('racehub.result.continue')}</Btn>
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
              <span className="big-num">{e.dnf ? t('racehub.result.dnf') : `P${e.pos}`}</span>
              <span className="muted" style={{ fontSize: 13 }}>{tp('racehub.result.points', e.points, { grid: e.grid })}{e.fastest ? ` · ${t('racehub.result.fastest')}` : ''}</span>
            </div>
          ))}
          <div className="stat-tile">
            <span className="eyebrow">{t('racehub.result.balance')}</span>
            <span className="big-num" style={{ fontSize: 26 }}><Money v={earned} sign compact /></span>
          </div>
          <div className="stat-tile">
            <span className="eyebrow">{t('racehub.result.reputation')}</span>
            <span className="big-num" style={{ fontSize: 26 }}>{Math.round(g.reputation)}</span>
            <span className={g.reputation >= data.repBefore ? 'good' : 'bad'} style={{ fontSize: 13 }}>{g.reputation >= data.repBefore ? '+' : ''}{fmtNum(g.reputation - data.repBefore, 1)}</span>
          </div>
        </div>
      </section>
      <section className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>{t('racehub.result.standings')}</h3></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>{t('racehub.result.colPos')}</th><th>{t('racehub.result.colDriver')}</th><th className="num">{t('racehub.result.colStart')}</th><th className="num">{t('racehub.result.colTime')}</th><th className="num">{t('racehub.result.colBest')}</th><th className="num">{t('racehub.result.colPts')}</th></tr>
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
                      <td className="num">{e.dnf ? <span className="bad">{tx(e.dnfReason) || t('racehub.result.dnf')}</span> : e.pos === 1 ? lapTime(e.time) : e.laps < r.entries[0].laps ? tp('racehub.result.lapsBehind', r.entries[0].laps - e.laps) : gapTime(e.time - winnerTime)}</td>
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
          <div className="card-h"><h3>{t('racehub.result.statement')}</h3></div>
          <div className="stack" style={{ gap: 0 }}>
            {ledger.map((l, i) => (
              <div key={i} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 14, flexWrap: 'nowrap' }}>
                <span style={{ minWidth: 0 }}>{tx(l.label)}</span>
                <Money v={l.amount} sign />
              </div>
            ))}
          </div>
          {g.sponsors.length > 0 && (
            <>
              <div className="sep" />
              <div className="eyebrow" style={{ margin: '8px 0' }}>{t('racehub.result.sponsorGoals')}</div>
              {g.sponsors.map((s) => (
                <div key={s.id} className="row between" style={{ fontSize: 14 }}>
                  <span>{s.name}: {tx(goalText(s.goal))}</span>
                  <span className={s.misses === 0 ? 'good' : 'bad'}>{s.misses === 0 ? t('racehub.result.met') : t('racehub.result.missed', { n: s.misses })}</span>
                </div>
              ))}
            </>
          )}
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>{t('racehub.result.balanceNow', { v: g.money })}</p>
        </div>
      </section>
      {mine.some((e) => e.dnf) && rewardedSupported() && (
        <section className="card stack" style={{ gap: 8 }}>
          {repairDiscountActive(g) ? (
            <p className="muted">{t('ads.repair.active')}</p>
          ) : (
            <AdButton
              placement="repair_discount"
              label={t('ads.repair.button')}
              hint={`${t('ads.repair.hint')} ${t('ads.optional')}`}
              onReward={() => {
                update((st) => void grantRepairDiscount(st));
                toast(t('ads.repair.granted'), 'good');
              }}
              onFail={() => toast(t('ads.failed'), 'bad')}
            />
          )}
        </section>
      )}
    </>
  );
}
