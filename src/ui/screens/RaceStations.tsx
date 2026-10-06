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
      <span className="muted" style={{ fontSize: 13 }}>Plan für</span>
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
  const t = TRACK_BY_ID[w.trackId];
  const [tab, setTab] = useState<'training' | 'setup'>('training');
  const quality = setupQuality(setup, { ...t, ideal: w.setupHint });
  const sliders: { k: keyof Setup; l: string; what: string; lo: string; hi: string }[] = [
    { k: 'wing', l: 'Flügel', what: 'Mehr Abtrieb hält dich in Kurven auf der Straße, kostet aber Tempo auf den Geraden.', lo: 'wenig Abtrieb · Topspeed', hi: 'viel Abtrieb · Kurvenspeed' },
    { k: 'gearing', l: 'Übersetzung', what: 'Kurz beschleunigt besser aus Kurven, lang bringt mehr Höchstgeschwindigkeit.', lo: 'kurz · Beschleunigung', hi: 'lang · Endgeschwindigkeit' },
    { k: 'suspension', l: 'Fahrwerk', what: 'Weich schont die Reifen, hart reagiert direkter und präziser.', lo: 'weich · reifenschonend', hi: 'hart · präzise' },
  ];
  return (
    <>
      <StationIntro
        id="setup"
        icon="wrench"
        lead="Im Prüfstand bereitest du dein Auto auf die nächste Strecke vor. Zuerst sammelst du Daten, dann stellst du das Auto ein."
        items={[
          { title: 'Training fahren', text: 'Fahre selbst Runden oder lass sie simulieren. Jede Runde erhöht das Setup-Wissen deines Ingenieurs.' },
          { title: 'Empfehlung abwarten', text: 'Mit mehr Wissen wird die grüne Markierung an den Reglern genauer. Sie zeigt die ideale Einstellung.' },
          { title: 'Auto einstellen', text: 'Stelle Flügel, Übersetzung und Fahrwerk ein, oder übernimm mit einem Klick die Empfehlung.' },
          { title: 'Passung prüfen', text: 'Der Wert „Passt zur Empfehlung“ zeigt, wie gut du getroffen hast. Je höher, desto schneller bist du.' },
        ]}
        tip="Tipp: Einmal Training simulieren und die Empfehlung übernehmen reicht für den Anfang."
      />
      <TrackStrip w={w} />
      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'training', l: 'Training', hint: 'Sammle Daten für die Abstimmung. Nach dem Qualifying ist das Training beendet.', badge: `${Math.round(w.setupKnowledge)} %` },
          { v: 'setup', l: 'Abstimmung', hint: 'Stelle dein Auto auf diese Strecke ein. Änderungen werden automatisch gespeichert.', badge: `${Math.round(quality * 100)} %` },
        ]}
      />

      {tab === 'training' && (
        <Block title="Training" hint="Je mehr Runden, desto besser kennt dein Ingenieur die Strecke.">
          <div className="stack" style={{ gap: 4 }}>
            <div className="row between" style={{ fontSize: 13 }}>
              <span className="muted">Setup-Wissen</span>
              <span className="num">{Math.round(w.setupKnowledge)} %</span>
            </div>
            <Bar value={w.setupKnowledge} tone={w.setupKnowledge > 70 ? 'good' : undefined} />
          </div>
          {w.practiceBest > 0 && <span className="muted" style={{ fontSize: 13 }}>Bestzeit: <span className="num">{lapTime(w.practiceBest)}</span></span>}
          {w.practiceLog.length > 0 && (
            <div className="stack hint-card" style={{ gap: 4, fontSize: 13.5 }}>
              <span className="eyebrow">Rückmeldung des Ingenieurs</span>
              {w.practiceLog.map((l, i) => (
                <span key={i}>„{l}“</span>
              ))}
            </div>
          )}
          {w.qualiDone && <span className="muted" style={{ fontSize: 13 }}>Das Qualifying ist schon gefahren. Das Training ist für dieses Wochenende beendet.</span>}
          <div className="row">
            <Btn variant="primary" icon="play" disabled={w.qualiDone || !canRace} onClick={onPracticeDrive}>Selbst fahren</Btn>
            <Btn icon="sim" disabled={w.qualiDone || !canRace} onClick={onPracticeSim}>Simulieren</Btn>
          </div>
        </Block>
      )}

      {tab === 'setup' && (
        <Block
          title="Fahrzeugabstimmung"
          hint="Der grüne Strich an jedem Regler ist die Empfehlung deines Ingenieurs."
          right={<Btn variant="sm primary" onClick={() => setSetup({ ...w.setupHint })}>Empfehlung übernehmen</Btn>}
        >
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
              <span className="muted" style={{ fontSize: 12.5 }}>{sl.what}</span>
            </div>
          ))}
          <div className="row between" style={{ fontSize: 14 }}>
            <span className="muted">Passt zur Empfehlung (Setup-Wissen {Math.round(w.setupKnowledge)} %)</span>
            <b className={quality > 0.85 ? 'good' : quality > 0.65 ? 'warn' : 'bad'}>{Math.round(quality * 100)} %</b>
          </div>
        </Block>
      )}
    </>
  );
}

// ---------- Reifenlager ----------
function Reifenlager({ g, cur, setCur, driverSwitch, isD1 }: Props & { cur: Strategy; setCur: (p: Partial<Strategy>) => void; driverSwitch: ReactNode; isD1: boolean }) {
  const w = g.weekend!;
  const t = TRACK_BY_ID[w.trackId];
  const [tab, setTab] = useState<'plan' | 'compounds'>('plan');
  const laps = w.laps;
  const scale = Math.max(laps, 6);
  const tyreLife = (c: Compound) => Math.max(1, (COMPOUNDS[c].life * scale) / t.tyreWear);
  const fuelLaps = cur.fuel * laps;
  const lapsOnStart = cur.stops.length ? cur.stops[0].lap : laps;
  const startLifeWarn = ['soft', 'medium', 'hard'].includes(cur.startCompound) && tyreLife(cur.startCompound) < lapsOnStart - 0.5;
  return (
    <>
      <StationIntro
        id="tyres"
        icon="pit"
        lead="Im Reifenlager planst du Reifen, Sprit und Boxenstopps für das Rennen."
        items={[
          { title: 'Startreifen wählen', text: 'Weiche Reifen sind schnell, halten aber kürzer. Harte halten länger. Bei Regen brauchst du Intermediate oder Regenreifen.' },
          { title: 'Tankmenge einstellen', text: 'Mehr Sprit ist sicher, macht das Auto aber schwerer und langsamer.' },
          { title: 'Boxenstopps planen', text: 'Lege fest, in welcher Runde du auf welche Mischung wechselst. Du kannst bis zu drei Stopps einplanen.' },
          { title: 'Mischungen vergleichen', text: 'Der zweite Reiter zeigt, wie lange jede Mischung auf dieser Strecke hält.' },
        ]}
        tip="Tipp: Der Reiter „Mischungen“ zeigt, wie lange jeder Reifen hält. Plane deinen Stopp vor diesem Wert."
      />
      <TrackStrip w={w} weather />
      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'plan', l: 'Plan', hint: 'Startreifen, Tankmenge und Boxenstopps für dein Rennen.' },
          { v: 'compounds', l: 'Mischungen', hint: 'Wie lange hält welcher Reifen auf dieser Strecke?' },
        ]}
      />

      {tab === 'plan' && (
        <>
          {driverSwitch}
          <Block title="Startreifen" hint="Mit diesem Reifen startest du ins Rennen.">
            <div className="tyre-pick">
              {COMPOUND_KEYS.map((c) => (
                <button key={c} type="button" className={cur.startCompound === c ? 'on' : ''} onClick={() => setCur({ startCompound: c })}>
                  <TyreBadge c={c} />
                  {COMPOUNDS[c].label}
                </button>
              ))}
            </div>
            {startLifeWarn && <span className="warn" style={{ fontSize: 13 }}>Diese Mischung hält vermutlich nicht bis zum ersten Stopp.</span>}
          </Block>

          <Block title="Tankmenge" hint="Wie viel Sprit du mit ins Rennen nimmst.">
            <div className="field">
              <div className="row between">
                <label htmlFor="fuel">Tank</label>
                <span className="num" style={{ fontSize: 13 }}>{Math.round(cur.fuel * 100)} % · {fuelLaps.toFixed(1)} Runden</span>
              </div>
              <input id="fuel" type="range" min={80} max={125} value={Math.round(cur.fuel * 100)} onChange={(e) => setCur({ fuel: +e.target.value / 100 })} />
              <span className="muted" style={{ fontSize: 12.5 }}>
                {cur.fuel < 1 ? 'Zu wenig für das ganze Rennen: ein Tankstopp ist nötig.' : cur.fuel < 1.04 ? 'Knapp kalkuliert: bei Vollgas musst du Sprit sparen.' : 'Mehr Sprit = schwerer und langsamer, aber sicher.'}
              </span>
            </div>
          </Block>

          <Block
            title="Boxenstopps"
            hint="Wann kommst du an die Box und welche Reifen bekommst du?"
            right={
              <Btn variant="sm" disabled={cur.stops.length >= 3} onClick={() => setCur({ stops: [...cur.stops, { lap: Math.min(laps, (cur.stops[cur.stops.length - 1]?.lap ?? 1) + Math.max(1, Math.floor(laps / 3))), compound: 'medium' }] })}>
                Stopp hinzufügen
              </Btn>
            }
          >
            {cur.stops.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Kein geplanter Stopp. Bei Wetterwechsel reagiert das Team automatisch, wenn das in der Boxenmauer aktiviert ist.</span>}
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
            {isD1 && <p className="muted" style={{ fontSize: 12.5 }}>Wenn du selbst fährst, entscheidest du über Boxenstopps in der Runde mit der Taste P oder BOX. Dieser Plan gilt, wenn dein Fahrer übernimmt.</p>}
          </Block>
        </>
      )}

      {tab === 'compounds' && (
        <Block title="Reifen auf dieser Strecke" hint="Die Runden gelten für normale Fahrweise auf trockener Bahn.">
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
        lead="An der Boxenmauer gibst du deinen Fahrern die Taktik vor. Das gilt vor allem, wenn der Computer fährt."
        items={[
          { title: 'Fahrstil wählen', text: 'Schonend spart Reifen, Sprit und Material. Angriff ist schneller, riskanter und verschleißt mehr.' },
          { title: 'Zweikämpfe festlegen', text: 'Aggressivität und Überholstrategie bestimmen, wie mutig dein Fahrer überholt und verteidigt.' },
          { title: 'Auf Wetter reagieren', text: 'Mit dem Schalter wechselt das Team bei Regen oder Trockenheit automatisch auf passende Reifen.' },
          { title: 'Pro Fahrer planen', text: 'Oben wählst du, für welchen Fahrer du die Taktik einstellst.' },
        ]}
        tip="Tipp: Starte mit „Ausgewogen“. Auf Strecken mit viel Reifenverschleiß lohnt sich „Schonend“."
      />
      <TrackStrip w={w} weather />
      {driverSwitch}

      <Block title="Fahrstil" hint="Wie schnell und wie schonend fährt dein Fahrer?">
        <div className="field" id="strat-tactics">
          <Seg value={cur.style} onChange={(v) => setCur({ style: v })} options={(Object.keys(STYLE_LABELS) as (keyof typeof STYLE_LABELS)[]).map((k) => ({ v: k, l: STYLE_LABELS[k] }))} />
          <span className="muted" style={{ fontSize: 12.5 }}>Schonend spart Reifen, Sprit und Material. Angriff ist schneller, riskanter und verschleißt mehr.</span>
        </div>
      </Block>

      <Block title="Zweikämpfe" hint="Wie mutig überholt und verteidigt dein Fahrer?">
        <div className="field">
          <div className="row between">
            <label htmlFor="aggr">Aggressivität</label>
            <span className="num" style={{ fontSize: 13 }}>{cur.aggression}</span>
          </div>
          <input id="aggr" type="range" min={0} max={100} value={cur.aggression} onChange={(e) => setCur({ aggression: +e.target.value })} />
          <div className="row between muted" style={{ fontSize: 11.5 }}>
            <span>vorsichtig</span>
            <span>riskant</span>
          </div>
        </div>
        <div className="field">
          <span className="lbl">Überholstrategie</span>
          <Seg value={cur.overtake} onChange={(v) => setCur({ overtake: v })} options={(Object.keys(OVERTAKE_LABELS) as (keyof typeof OVERTAKE_LABELS)[]).map((k) => ({ v: k, l: OVERTAKE_LABELS[k] }))} />
        </div>
      </Block>

      <Block title="Wetter" hint="Was passiert, wenn es anfängt zu regnen oder wieder abtrocknet?">
        <Switch id={`weather-${driver}`} on={cur.reactToWeather} onChange={(v) => setCur({ reactToWeather: v })} label="Bei Wetterwechsel automatisch auf passende Reifen wechseln" />
      </Block>
    </>
  );
}
