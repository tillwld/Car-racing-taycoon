import { useState } from 'react';
import { useLoadedGame } from '../store';
import { Block, StationIntro, SubTabs } from '../components/Station';
import { Bar, Btn, Money } from '../components/common';
import { CHASSIS, CHASSIS_BY_ID, CONDITION_LABELS, FACILITY, PARTS, PART_KEYS, STAT_LABELS } from '../../data/catalog';
import { carRating, devSlots, partCost, partTime, playerCarStats } from '../../game/carModel';
import { buyChassis, facilityCost, repair, repairCost, startFacilityUpgrade, startPartUpgrade } from '../../game/state';
import type { CarStats, ConditionKey, PartKey } from '../../types';

export default function Garage() {
  const { game: g, update } = useLoadedGame();
  const st = playerCarStats(g);
  const base = CHASSIS_BY_ID[g.car.chassisId];
  const rating = carRating(st);
  const cap = FACILITY[g.facility - 1].partCap;
  const slots = devSlots(g);
  const partsBusy = g.developments.filter((d) => d.kind === 'part');
  const keys: (keyof CarStats)[] = ['power', 'accel', 'topSpeed', 'braking', 'handling', 'aero', 'tyreCare', 'reliability'];
  const condKeys = Object.keys(g.car.condition) as ConditionKey[];
  const totalRepair = condKeys.reduce((a, k) => a + repairCost(g, k), 0);
  const facDev = g.developments.find((d) => d.kind === 'facility');
  const next = FACILITY[g.facility];
  const [tab, setTab] = useState<'car' | 'parts' | 'build'>('car');
  const condAvg = condKeys.reduce((a, k) => a + g.car.condition[k], 0) / condKeys.length;

  return (
    <>
      <StationIntro
        id="garage"
        icon="garage"
        lead="Hier machst du dein Auto schneller und hältst es heil. Alles kostet Geld, dafür wirkt es dauerhaft."
        items={[
          { title: 'Auto prüfen', text: 'Du siehst alle Werte deines Wagens und wie stark Upgrades und Forschung sie verbessern.' },
          { title: 'Reparieren', text: 'Nach Rennen sind Teile verschlissen. Eine Reparatur hält das Auto schnell und zuverlässig.' },
          { title: 'Bauteile verbessern', text: 'Upgrades für Motor, Bremsen, Reifen und mehr. Sie brauchen Geld und Zeit, gemessen in Rennen.' },
          { title: 'Ausbauen und Chassis', text: 'Die Fabrik erlaubt höhere Stufen. Ein neues Chassis ist die große Investition für mehr Grundtempo.' },
        ]}
        tip="Tipp: Fang mit Motor und Bremsen an und repariere vor jedem Rennen, wenn der Zustand unter 80 % liegt."
      />

      <div className="grid g3 keep">
        <div className="card stat-tile">
          <span className="eyebrow">Gesamtwert</span>
          <span className="big-num">{rating}</span>
          <span className="sub">{base?.name}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Zustand</span>
          <span className="big-num" style={{ color: condAvg < 0.6 ? 'var(--bad)' : condAvg < 0.8 ? 'var(--warn)' : undefined }}>{Math.round(condAvg * 100)} %</span>
          <span className="sub">{totalRepair > 0 ? <>Reparatur <Money v={totalRepair} compact /></> : 'Alles in Ordnung'}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Entwicklung</span>
          <span className="big-num">{partsBusy.length}/{slots.parts}</span>
          <span className="sub">Plätze belegt{facDev ? ' · Fabrik im Bau' : ''}</span>
        </div>
      </div>

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'car', l: 'Auto & Zustand', hint: 'Wie schnell ist dein Auto, und was muss repariert werden?' },
          { v: 'parts', l: 'Upgrades', hint: 'Bauteile verbessern: Jede Stufe macht das Auto etwas besser.', badge: partsBusy.length ? `${partsBusy.length} läuft` : undefined },
          { v: 'build', l: 'Ausbau & Chassis', hint: 'Große Investitionen: die Werkstatt zur Fabrik ausbauen oder ein besseres Chassis kaufen.' },
        ]}
      />

      {tab === 'car' && (
      <section className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 12 }}>
          <div className="card-h">
            <div>
              <div className="eyebrow">Rennfahrzeug</div>
              <h2>{base?.name}</h2>
            </div>
            <div className="rating" style={{ textAlign: 'right' }}>{rating}<small>Gesamtwert</small></div>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>Heller Balken = Grundwert des Chassis, voller Balken = mit Upgrades, Forschung und Personal.</p>
          <div className="stack" style={{ gap: 6 }}>
            {keys.map((k) => (
              <div key={k} className="statline">
                <span className="muted">{STAT_LABELS[k]}</span>
                <div className="bar">
                  <i style={{ width: `${Math.min(100, st[k])}%` }} />
                  <i style={{ width: `${Math.min(100, base?.base[k] ?? 0)}%`, background: 'color-mix(in srgb, var(--text) 30%, transparent)' }} />
                </div>
                <span className="v">{Math.round(st[k])}</span>
              </div>
            ))}
            <div className="statline">
              <span className="muted">Gewicht</span>
              <span />
              <span className="v">{st.weight} kg</span>
            </div>
          </div>
        </div>

        <div className="card stack" style={{ gap: 12 }}>
          <div className="card-h">
            <div>
              <div className="eyebrow">Zustand</div>
              <h3>Wartung &amp; Reparatur</h3>
            </div>
            <Btn variant="primary" disabled={totalRepair <= 0} onClick={() => update((s) => repair(s, condKeys))}>
              Alles reparieren · <Money v={totalRepair} compact />
            </Btn>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>Verschleiß und Schäden machen das Auto langsamer und erhöhen das Ausfallrisiko. Ein guter Chefmechaniker senkt die Kosten.</p>
          {condKeys.map((k) => {
            const v = g.car.condition[k];
            const c = repairCost(g, k);
            return (
              <div key={k} className="stack" style={{ gap: 4 }}>
                <div className="row between" style={{ fontSize: 14 }}>
                  <span>{CONDITION_LABELS[k]}</span>
                  <span className="row" style={{ gap: 10 }}>
                    <span className="num">{Math.round(v * 100)} %</span>
                    <Btn variant="sm" disabled={c <= 0} onClick={() => update((s) => repair(s, [k]))}>
                      {c > 0 ? <Money v={c} compact /> : 'OK'}
                    </Btn>
                  </span>
                </div>
                <Bar value={v * 100} tone={v < 0.5 ? 'bad' : v < 0.8 ? 'warn' : 'good'} />
              </div>
            );
          })}
        </div>
      </section>
      )}

      {tab === 'parts' && (
      <section className="card">
        <div className="card-h">
          <div>
            <div className="eyebrow">Entwicklung</div>
            <h3>Bauteile verbessern</h3>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            Plätze: {partsBusy.length}/{slots.parts} · Maximalstufe mit {FACILITY[g.facility - 1].name}: {cap}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Upgrades kosten Geld und brauchen Entwicklungszeit (gemessen in Rennen). Fertige Teile wirken sofort im nächsten Rennen.</p>
        {PART_KEYS.map((p: PartKey) => {
          const lvl = g.car.parts[p];
          const dev = partsBusy.find((d) => d.target === p);
          const cost = partCost(g, p);
          const time = partTime(g, p);
          const eff = PARTS[p].effect;
          const effText = Object.entries(eff)
            .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${STAT_LABELS[k as keyof CarStats]}`)
            .join(' · ');
          return (
            <div key={p} className="part-row">
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 10 }}>
                  <b>{PARTS[p].label}</b>
                  <span className="muted" style={{ fontSize: 13 }}>Stufe {lvl}</span>
                  {dev && <span className="pill team">in Entwicklung · noch {dev.remaining} R</span>}
                </div>
                <div className="levels" aria-label={`Stufe ${lvl} von 10`}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={i < lvl ? 'on' : dev && i === lvl ? 'dev' : i >= cap ? 'cap' : ''} />
                  ))}
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{PARTS[p].desc} Pro Stufe: {effText}</div>
              </div>
              <div style={{ textAlign: 'right', display: 'grid', gap: 4, justifyItems: 'end' }}>
                <Btn variant="primary sm" disabled={!!dev || lvl >= cap || g.money < cost || partsBusy.length >= slots.parts} onClick={() => update((s) => startPartUpgrade(s, p))}>
                  {lvl >= cap ? 'Max.' : 'Entwickeln'}
                </Btn>
                {lvl < cap && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    <Money v={cost} compact /> · {time} {time === 1 ? 'Rennen' : 'Rennen'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>
      )}

      {tab === 'build' && (
      <section className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 10 }}>
          <div className="eyebrow">Fabrik</div>
          <h3>{FACILITY[g.facility - 1].name} (Stufe {g.facility}/4)</h3>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            <li>Bauteile bis Stufe {cap}</li>
            <li>{slots.parts} Entwicklungsplatz{slots.parts > 1 ? 'e' : ''} · {slots.research} Forschungsprojekt{slots.research > 1 ? 'e' : ''} gleichzeitig</li>
          </ul>
          {next ? (
            <>
              <div className="sep" />
              <b>Nächste Stufe: {next.name}</b>
              <span className="muted" style={{ fontSize: 14 }}>
                Bauteile bis Stufe {next.partCap}
                {next.level === 3 ? ', zweiter Entwicklungsplatz' : ''}
                {next.level === 4 ? ', zweites Forschungsprojekt' : ''} · Bauzeit {next.time} Rennen
              </span>
              {facDev ? (
                <span className="pill team">Im Bau · noch {facDev.remaining} Rennen</span>
              ) : (
                <Btn variant="primary" disabled={g.money < facilityCost(g)} onClick={() => update((s) => startFacilityUpgrade(s))}>
                  Ausbauen · <Money v={facilityCost(g)} compact />
                </Btn>
              )}
            </>
          ) : (
            <span className="pill good">Voll ausgebaut</span>
          )}
        </div>

        <div className="card stack" style={{ gap: 10 }}>
          <div className="eyebrow">Chassis-Markt</div>
          <h3>Neues Chassis kaufen</h3>
          <p className="muted" style={{ fontSize: 13 }}>Der Entwicklungsstand der Bauteile bleibt erhalten. Dein altes Chassis wird für 40 % verkauft.</p>
          {CHASSIS.map((c) => {
            const owned = g.car.chassisId === c.id;
            const locked = c.tier > g.tier;
            const old = CHASSIS_BY_ID[g.car.chassisId];
            const net = c.price - (old ? Math.round(old.price * 0.4) : 0);
            return (
              <div key={c.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', opacity: locked ? 0.5 : 1 }}>
                <div style={{ minWidth: 0 }}>
                  <b>{c.name}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Wert {carRating({ ...c.base })} · {locked ? `ab ${['Formel Nachwuchs', 'Continental Series', 'Weltmeisterschaft'][c.tier]}` : c.description}
                  </div>
                </div>
                {owned ? (
                  <span className="pill good">Im Einsatz</span>
                ) : (
                  <Btn variant="sm" disabled={locked || g.money < net} onClick={() => update((s) => buyChassis(s, c.id))}>
                    <Money v={c.price} compact />
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      </section>
      )}
    </>
  );
}
