// Die drei Planungs-Stationen rund ums Rennen: Prüfstand (Training + Abstimmung), Reifenlager (Reifen, Sprit,
// Boxenstopps) und Boxenmauer (Fahrstil und Taktik). Jede Station zeigt nur ihr eigenes Thema.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { RaceFocus } from '../../App';
import { useLoadedGame } from '../store';
import { Bar, Btn, Icon, Seg, Switch, TyreBadge } from '../components/common';
import { Block, StationIntro, SubTabs } from '../components/Station';
import { TrackStrip } from './RaceParts';
import { TRACK_BY_ID } from '../../data/tracks';
import { COMPOUNDS, COMPOUND_KEYS, OVERTAKE_LABELS, STYLE_LABELS } from '../../data/catalog';
import type { Compound, GameState, Setup, Strategy } from '../../types';
import { setupQuality } from '../../race/params';
import { lapTime } from '../../game/util';
import { t, tx, useLang } from '../../i18n';

type Props = {
  g: GameState;
  focus: RaceFocus;
  hasTeammate: boolean;
  canRace: boolean;
  d1: string;
  d2: string;
  onPracticeDrive: () => void;
  onPracticeSim: () => void;
};

export default function RaceStation(props: Props) {
  useLang();
  const { g, focus } = props;
  const w = g.weekend!;
  const { update } = useLoadedGame();
  const [setup, setSetup] = useState<Setup>(w.strategy.setup);
  const [s1, setS1] = useState<Strategy>(w.strategy);
  const [s2, setS2] = useState<Strategy>(w.teammateStrategy);
  const [driver, setDriver] = useState<'d1' | 'd2'>('d1');

  // Änderungen kurz gesammelt speichern; beim Verlassen der Station sofort, damit nichts verloren geht
  const latest = useRef({ setup, s1, s2 });
  latest.current = { setup, s1, s2 };
  const dirty = useRef(false);
  const first = useRef(true);
  const upd = useRef(update);
  upd.current = update;
  const flush = () => {
    if (!dirty.current) return;
    dirty.current = false;
    const { setup: su, s1: a, s2: b } = latest.current;
    upd.current((s) => {
      if (!s.weekend || s.weekend.season !== w.season || s.weekend.round !== w.round) return;
      s.weekend.strategy = { ...a, setup: su };
      s.weekend.teammateStrategy = { ...b, setup: su };
    });
  };
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
    const tm = setTimeout(flush, 250);
    return () => clearTimeout(tm);
  }, [setup, s1, s2]);
  useEffect(() => () => flush(), []);

  const cur = driver === 'd1' ? s1 : s2;
  const setCur = (p: Partial<Strategy>) => (driver === 'd1' ? setS1({ ...s1, ...p }) : setS2({ ...s2, ...p }));
  const driverSwitch = props.hasTeammate ? (
    <div className="row" style={{ gap: 8 }}>
      <span className="muted" style={{ fontSize: 13 }}>{t('racest.planFor')}</span>
      <Seg value={driver} onChange={setDriver} options={[{ v: 'd1', l: props.d1.split(' ').slice(-1)[0] }, { v: 'd2', l: props.d2.split(' ').slice(-1)[0] }]} />
    </div>
  ) : null;

  return (
    <>
      {focus === 'setup' && <Pruefstand {...props} setup={setup} setSetup={setSetup} />}
      {focus === 'tyres' && <Reifenlager {...props} cur={cur} setCur={setCur} driverSwitch={driverSwitch} isD1={driver === 'd1'} />}
      {focus === 'tactics' && <Boxenmauer {...props} cur={cur} setCur={setCur} driverSwitch={driverSwitch} driver={driver} />}
    </>
  );
}

// ---------- Prüfstand ----------
function Pruefstand({ g, canRace, onPracticeDrive, onPracticeSim, setup, setSetup }: Props & { setup: Setup; setSetup: (s: Setup) => void }) {
  const w = g.weekend!;
  const trk = TRACK_BY_ID[w.trackId];
  const [tab, setTab] = useState<'training' | 'setup'>('training');
  const quality = setupQuality(setup, { ...trk, ideal: w.setupHint });
  const sliders: { k: keyof Setup; l: string; what: string; lo: string; hi: string }[] = [
    { k: 'wing', l: t('racest.setup.wing'), what: t('racest.setup.wingWhat'), lo: t('racest.setup.wingLo'), hi: t('racest.setup.wingHi') },
    { k: 'gearing', l: t('racest.setup.gearing'), what: t('racest.setup.gearingWhat'), lo: t('racest.setup.gearingLo'), hi: t('racest.setup.gearingHi') },
    { k: 'suspension', l: t('racest.setup.suspension'), what: t('racest.setup.suspensionWhat'), lo: t('racest.setup.suspensionLo'), hi: t('racest.setup.suspensionHi') },
  ];
  return (
    <>
      <StationIntro
        id="setup"
        icon="wrench"
        lead={t('racest.setup.intro.lead')}
        items={[
          { title: t('racest.setup.intro.i1Title'), text: t('racest.setup.intro.i1Text') },
          { title: t('racest.setup.intro.i2Title'), text: t('racest.setup.intro.i2Text') },
          { title: t('racest.setup.intro.i3Title'), text: t('racest.setup.intro.i3Text') },
          { title: t('racest.setup.intro.i4Title'), text: t('racest.setup.intro.i4Text') },
        ]}
        tip={t('racest.setup.intro.tip')}
      />
      <TrackStrip w={w} />
      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'training', l: t('racest.setup.tabTraining'), hint: t('racest.setup.tabTrainingHint'), badge: t('racest.pct', { n: Math.round(w.setupKnowledge) }) },
          { v: 'setup', l: t('racest.setup.tabSetup'), hint: t('racest.setup.tabSetupHint'), badge: t('racest.pct', { n: Math.round(quality * 100) }) },
        ]}
      />

      {tab === 'training' && (
        <Block title={t('racest.training.title')} hint={t('racest.training.hint')}>
          <div className="stack" style={{ gap: 4 }}>
            <div className="row between" style={{ fontSize: 13 }}>
              <span className="muted">{t('racest.setup.knowledge')}</span>
              <span className="num">{t('racest.pct', { n: Math.round(w.setupKnowledge) })}</span>
            </div>
            <Bar value={w.setupKnowledge} tone={w.setupKnowledge > 70 ? 'good' : undefined} />
          </div>
          {w.practiceBest > 0 && <span className="muted" style={{ fontSize: 13 }}>{t('racest.training.best')} <span className="num">{lapTime(w.practiceBest)}</span></span>}
          {w.practiceLog.length > 0 && (
            <div className="stack hint-card" style={{ gap: 4, fontSize: 13.5 }}>
              <span className="eyebrow">{t('racest.training.feedback')}</span>
              {w.practiceLog.map((l, i) => (
                <span key={i}>{t('racest.quote', { text: tx(l) })}</span>
              ))}
            </div>
          )}
          {w.qualiDone && <span className="muted" style={{ fontSize: 13 }}>{t('racest.training.qualiDone')}</span>}
          <div className="row">
            <Btn variant="primary" icon="play" disabled={w.qualiDone || !canRace} onClick={onPracticeDrive}>{t('racest.btn.driveSelf')}</Btn>
            <Btn icon="sim" disabled={w.qualiDone || !canRace} onClick={onPracticeSim}>{t('racest.btn.simulate')}</Btn>
          </div>
        </Block>
      )}

      {tab === 'setup' && (
        <Block
          title={t('racest.setup.title')}
          hint={t('racest.setup.hint')}
          right={<Btn variant="sm primary" onClick={() => setSetup({ ...w.setupHint })}>{t('racest.setup.apply')}</Btn>}
        >
          {sliders.map((sl) => (
            <div key={sl.k} className="field">
              <div className="row between">
                <label htmlFor={`set-${sl.k}`}>{sl.l}</label>
                <span className="num" style={{ fontSize: 13 }}>{setup[sl.k]} <span className="muted">· {t('racest.setup.recommendation')} {w.setupHint[sl.k]}</span></span>
              </div>
              <div style={{ position: 'relative' }}>
                <input id={`set-${sl.k}`} type="range" min={0} max={100} value={setup[sl.k]} onChange={(e) => setSetup({ ...setup, [sl.k]: +e.target.value })} />
                <span aria-hidden="true" style={{ position: 'absolute', top: -4, left: `calc(${w.setupHint[sl.k]}% - 1px)`, width: 2, height: 8, background: 'var(--good)' }} />
              </div>
              <div className="row between muted" style={{ fontSize: 12 }}>
                <span>{sl.lo}</span>
                <span>{sl.hi}</span>
              </div>
              <span className="muted" style={{ fontSize: 12.5 }}>{sl.what}</span>
            </div>
          ))}
          <div className="row between" style={{ fontSize: 14 }}>
            <span className="muted">{t('racest.setup.fit', { n: Math.round(w.setupKnowledge) })}</span>
            <b className={quality > 0.85 ? 'good' : quality > 0.65 ? 'warn' : 'bad'}>{t('racest.pct', { n: Math.round(quality * 100) })}</b>
          </div>
        </Block>
      )}
    </>
  );
}

// ---------- Reifenlager ----------
function Reifenlager({ g, cur, setCur, driverSwitch, isD1 }: Props & { cur: Strategy; setCur: (p: Partial<Strategy>) => void; driverSwitch: ReactNode; isD1: boolean }) {
  const w = g.weekend!;
  const trk = TRACK_BY_ID[w.trackId];
  const [tab, setTab] = useState<'plan' | 'compounds'>('plan');
  const laps = w.laps;
  const scale = Math.max(laps, 6);
  const tyreLife = (c: Compound) => Math.max(1, (COMPOUNDS[c].life * scale) / trk.tyreWear);
  const fuelLaps = cur.fuel * laps;
  const lapsOnStart = cur.stops.length ? cur.stops[0].lap : laps;
  const startLifeWarn = ['soft', 'medium', 'hard'].includes(cur.startCompound) && tyreLife(cur.startCompound) < lapsOnStart - 0.5;
  return (
    <>
      <StationIntro
        id="tyres"
        icon="pit"
        lead={t('racest.tyres.intro.lead')}
        items={[
          { title: t('racest.tyres.intro.i1Title'), text: t('racest.tyres.intro.i1Text') },
          { title: t('racest.tyres.intro.i2Title'), text: t('racest.tyres.intro.i2Text') },
          { title: t('racest.tyres.intro.i3Title'), text: t('racest.tyres.intro.i3Text') },
          { title: t('racest.tyres.intro.i4Title'), text: t('racest.tyres.intro.i4Text') },
        ]}
        tip={t('racest.tyres.intro.tip')}
      />
      <TrackStrip w={w} weather />
      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'plan', l: t('racest.tyres.tabPlan'), hint: t('racest.tyres.tabPlanHint') },
          { v: 'compounds', l: t('racest.tyres.tabCompounds'), hint: t('racest.tyres.tabCompoundsHint') },
        ]}
      />

      {tab === 'plan' && (
        <>
          {driverSwitch}
          <Block title={t('racest.tyres.startTitle')} hint={t('racest.tyres.startHint')}>
            <div className="tyre-pick">
              {COMPOUND_KEYS.map((c) => (
                <button key={c} type="button" className={cur.startCompound === c ? 'on' : ''} onClick={() => setCur({ startCompound: c })}>
                  <TyreBadge c={c} />
                  {COMPOUNDS[c].label}
                </button>
              ))}
            </div>
            {startLifeWarn && <span className="warn" style={{ fontSize: 13 }}>{t('racest.tyres.startWarn')}</span>}
          </Block>

          <Block title={t('racest.tyres.fuelTitle')} hint={t('racest.tyres.fuelHint')}>
            <div className="field">
              <div className="row between">
                <label htmlFor="fuel">{t('racest.tyres.fuelLabel')}</label>
                <span className="num" style={{ fontSize: 13 }}>{t('racest.tyres.fuelValue', { pct: cur.fuel, laps: fuelLaps })}</span>
              </div>
              <input id="fuel" type="range" min={80} max={125} value={Math.round(cur.fuel * 100)} onChange={(e) => setCur({ fuel: +e.target.value / 100 })} />
              <span className="muted" style={{ fontSize: 12.5 }}>
                {t(cur.fuel < 1 ? 'racest.tyres.fuelLow' : cur.fuel < 1.04 ? 'racest.tyres.fuelTight' : 'racest.tyres.fuelOk')}
              </span>
            </div>
          </Block>

          <Block
            title={t('racest.tyres.stopsTitle')}
            hint={t('racest.tyres.stopsHint')}
            right={
              <Btn variant="sm" disabled={cur.stops.length >= 3} onClick={() => setCur({ stops: [...cur.stops, { lap: Math.min(laps, (cur.stops[cur.stops.length - 1]?.lap ?? 1) + Math.max(1, Math.floor(laps / 3))), compound: 'medium' }] })}>
                {t('racest.tyres.addStop')}
              </Btn>
            }
          >
            {cur.stops.length === 0 && <span className="muted" style={{ fontSize: 13 }}>{t('racest.tyres.noStops')}</span>}
            {cur.stops.map((st, i) => (
              <div key={i} className="row" style={{ gap: 8 }}>
                <span className="muted" style={{ fontSize: 13, width: 52 }}>{t('racest.tyres.stopN', { n: i + 1 })}</span>
                <select aria-label={t('racest.tyres.stopLapLabel', { n: i + 1 })} value={st.lap} style={{ width: 'auto' }} onChange={(e) => setCur({ stops: cur.stops.map((x, j) => (j === i ? { ...x, lap: +e.target.value } : x)) })}>
                  {Array.from({ length: laps }, (_, k) => k + 1).map((l) => (
                    <option key={l} value={l}>{t('racest.tyres.lapN', { n: l })}</option>
                  ))}
                </select>
                <select aria-label={t('racest.tyres.stopTyreLabel', { n: i + 1 })} value={st.compound} style={{ width: 'auto' }} onChange={(e) => setCur({ stops: cur.stops.map((x, j) => (j === i ? { ...x, compound: e.target.value as Compound } : x)) })}>
                  {COMPOUND_KEYS.map((c) => (
                    <option key={c} value={c}>{COMPOUNDS[c].label}</option>
                  ))}
                </select>
                <button type="button" className="btn sm ghost" aria-label={t('racest.tyres.removeStop')} onClick={() => setCur({ stops: cur.stops.filter((_, j) => j !== i) })}>
                  <Icon name="close" />
                </button>
              </div>
            ))}
            {isD1 && <p className="muted" style={{ fontSize: 12.5 }}>{t('racest.tyres.manualNote')}</p>}
          </Block>
        </>
      )}

      {tab === 'compounds' && (
        <Block title={t('racest.tyres.tableTitle')} hint={t('racest.tyres.tableHint')}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>{t('racest.tyres.colCompound')}</th><th>{t('racest.tyres.colUse')}</th><th className="num">{t('racest.tyres.colLaps')}</th></tr>
              </thead>
              <tbody>
                {COMPOUND_KEYS.map((c) => (
                  <tr key={c}>
                    <td><span className="row" style={{ gap: 8 }}><TyreBadge c={c} sm /> {COMPOUNDS[c].label}</span></td>
                    <td className="muted" style={{ fontSize: 13 }}>{COMPOUNDS[c].desc}</td>
                    <td className="num">{['inter', 'wet'].includes(c) ? t('racest.tyres.wetDepends') : t('racest.tyres.approx', { n: tyreLife(c) })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      )}
    </>
  );
}

// ---------- Boxenmauer ----------
function Boxenmauer({ g, cur, setCur, driverSwitch, driver }: Props & { cur: Strategy; setCur: (p: Partial<Strategy>) => void; driverSwitch: ReactNode; driver: 'd1' | 'd2' }) {
  const w = g.weekend!;
  return (
    <>
      <StationIntro
        id="pitwall"
        icon="flag"
        lead={t('racest.tactics.intro.lead')}
        items={[
          { title: t('racest.tactics.intro.i1Title'), text: t('racest.tactics.intro.i1Text', { conserve: STYLE_LABELS.conserve, attack: STYLE_LABELS.attack }) },
          { title: t('racest.tactics.intro.i2Title'), text: t('racest.tactics.intro.i2Text') },
          { title: t('racest.tactics.intro.i3Title'), text: t('racest.tactics.intro.i3Text') },
          { title: t('racest.tactics.intro.i4Title'), text: t('racest.tactics.intro.i4Text') },
        ]}
        tip={t('racest.tactics.intro.tip', { balanced: STYLE_LABELS.balanced, conserve: STYLE_LABELS.conserve })}
      />
      <TrackStrip w={w} weather />
      {driverSwitch}

      <Block title={t('racest.tactics.styleTitle')} hint={t('racest.tactics.styleHint')}>
        <div className="field" id="strat-tactics">
          <Seg value={cur.style} onChange={(v) => setCur({ style: v })} options={(Object.keys(STYLE_LABELS) as (keyof typeof STYLE_LABELS)[]).map((k) => ({ v: k, l: STYLE_LABELS[k] }))} />
          <span className="muted" style={{ fontSize: 12.5 }}>{t('racest.tactics.styleNote', { conserve: STYLE_LABELS.conserve, attack: STYLE_LABELS.attack })}</span>
        </div>
      </Block>

      <Block title={t('racest.tactics.duelTitle')} hint={t('racest.tactics.duelHint')}>
        <div className="field">
          <div className="row between">
            <label htmlFor="aggr">{t('racest.tactics.aggression')}</label>
            <span className="num" style={{ fontSize: 13 }}>{cur.aggression}</span>
          </div>
          <input id="aggr" type="range" min={0} max={100} value={cur.aggression} onChange={(e) => setCur({ aggression: +e.target.value })} />
          <div className="row between muted" style={{ fontSize: 12 }}>
            <span>{t('racest.tactics.cautious')}</span>
            <span>{t('racest.tactics.risky')}</span>
          </div>
        </div>
        <div className="field">
          <span className="lbl">{t('racest.tactics.overtake')}</span>
          <Seg value={cur.overtake} onChange={(v) => setCur({ overtake: v })} options={(Object.keys(OVERTAKE_LABELS) as (keyof typeof OVERTAKE_LABELS)[]).map((k) => ({ v: k, l: OVERTAKE_LABELS[k] }))} />
        </div>
      </Block>

      <Block title={t('racest.tactics.weatherTitle')} hint={t('racest.tactics.weatherHint')}>
        <Switch id={`weather-${driver}`} on={cur.reactToWeather} onChange={(v) => setCur({ reactToWeather: v })} label={t('racest.tactics.weatherSwitch')} />
      </Block>
    </>
  );
}
