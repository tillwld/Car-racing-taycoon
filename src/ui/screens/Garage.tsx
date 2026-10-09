import { useState } from 'react';
import { useLoadedGame } from '../store';
import { Block, StationIntro, SubTabs } from '../components/Station';
import { Bar, Btn, Money } from '../components/common';
import { CHASSIS, CHASSIS_BY_ID, CONDITION_LABELS, FACILITY, PARTS, PART_KEYS, STAT_LABELS, TIERS } from '../../data/catalog';
import { carRating, devSlots, partCost, partTime, playerCarStats } from '../../game/carModel';
import { buyChassis, facilityCost, repair, repairCost, startFacilityUpgrade, startPartUpgrade } from '../../game/state';
import type { CarStats, ConditionKey, PartKey } from '../../types';
import { fmtNum, fmtPct, t, tp } from '../../i18n';

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
        lead={t('garage.intro.lead')}
        items={[
          { title: t('garage.intro.checkTitle'), text: t('garage.intro.checkText') },
          { title: t('garage.intro.repairTitle'), text: t('garage.intro.repairText') },
          { title: t('garage.intro.upgradeTitle'), text: t('garage.intro.upgradeText') },
          { title: t('garage.intro.buildTitle'), text: t('garage.intro.buildText') },
        ]}
        tip={t('garage.intro.tip')}
      />

      <div className="grid g3 keep">
        <div className="card stat-tile">
          <span className="eyebrow">{t('garage.tile.rating')}</span>
          <span className="big-num">{rating}</span>
          <span className="sub">{base?.name}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('garage.tile.condition')}</span>
          <span className="big-num" style={{ color: condAvg < 0.6 ? 'var(--bad)' : condAvg < 0.8 ? 'var(--warn)' : undefined }}>{fmtPct(condAvg)}</span>
          <span className="sub">{totalRepair > 0 ? <>{t('garage.tile.repair')} <Money v={totalRepair} compact /></> : t('garage.tile.allOk')}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('garage.tile.development')}</span>
          <span className="big-num">{partsBusy.length}/{slots.parts}</span>
          <span className="sub">{t('garage.tile.slotsBusy')}{facDev ? ` · ${t('garage.tile.factoryBuilding')}` : ''}</span>
        </div>
      </div>

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'car', l: t('garage.tab.car'), hint: t('garage.tab.carHint') },
          { v: 'parts', l: t('garage.tab.parts'), hint: t('garage.tab.partsHint'), badge: partsBusy.length ? t('garage.tab.running', { n: partsBusy.length }) : undefined },
          { v: 'build', l: t('garage.tab.build'), hint: t('garage.tab.buildHint') },
        ]}
      />

      {tab === 'car' && (
      <section className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 12 }}>
          <div className="card-h">
            <div>
              <div className="eyebrow">{t('garage.car.eyebrow')}</div>
              <h2>{base?.name}</h2>
            </div>
            <div className="rating" style={{ textAlign: 'right' }}>{rating}<small>{t('garage.tile.rating')}</small></div>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>{t('garage.car.legend')}</p>
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
              <span className="muted">{t('garage.car.weight')}</span>
              <span />
              <span className="v">{t('garage.car.kg', { n: st.weight })}</span>
            </div>
          </div>
        </div>

        <div className="card stack" style={{ gap: 12 }}>
          <div className="card-h">
            <div>
              <div className="eyebrow">{t('garage.tile.condition')}</div>
              <h3>{t('garage.car.maintTitle')}</h3>
            </div>
            <Btn variant="primary" disabled={totalRepair <= 0} onClick={() => update((s) => repair(s, condKeys))}>
              {t('garage.car.repairAll')} · <Money v={totalRepair} compact />
            </Btn>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>{t('garage.car.wearNote')}</p>
          {condKeys.map((k) => {
            const v = g.car.condition[k];
            const c = repairCost(g, k);
            return (
              <div key={k} className="stack" style={{ gap: 4 }}>
                <div className="row between" style={{ fontSize: 14 }}>
                  <span>{CONDITION_LABELS[k]}</span>
                  <span className="row" style={{ gap: 10 }}>
                    <span className="num">{fmtPct(v)}</span>
                    <Btn variant="sm" disabled={c <= 0} onClick={() => update((s) => repair(s, [k]))}>
                      {c > 0 ? <Money v={c} compact /> : t('garage.car.ok')}
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
            <div className="eyebrow">{t('garage.tile.development')}</div>
            <h3>{t('garage.parts.title')}</h3>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            {t('garage.parts.slots', { busy: partsBusy.length, total: slots.parts, facility: FACILITY[g.facility - 1].name, cap })}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t('garage.parts.note')}</p>
        {PART_KEYS.map((p: PartKey) => {
          const lvl = g.car.parts[p];
          const dev = partsBusy.find((d) => d.target === p);
          const cost = partCost(g, p);
          const time = partTime(g, p);
          const eff = PARTS[p].effect;
          const effText = Object.entries(eff)
            .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${fmtNum(v as number, Number.isInteger(v) ? 0 : 1)} ${STAT_LABELS[k as keyof CarStats]}`)
            .join(' · ');
          return (
            <div key={p} className="part-row">
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 10 }}>
                  <b>{PARTS[p].label}</b>
                  <span className="muted" style={{ fontSize: 13 }}>{t('garage.parts.level', { n: lvl })}</span>
                  {dev && <span className="pill team">{tp('garage.parts.inDev', dev.remaining)}</span>}
                </div>
                <div className="levels" aria-label={t('garage.parts.levelOf', { n: lvl })}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={i < lvl ? 'on' : dev && i === lvl ? 'dev' : i >= cap ? 'cap' : ''} />
                  ))}
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{t('garage.parts.perLevel', { desc: PARTS[p].desc, effects: effText })}</div>
              </div>
              <div style={{ textAlign: 'right', display: 'grid', gap: 4, justifyItems: 'end' }}>
                <Btn variant="primary sm" disabled={!!dev || lvl >= cap || g.money < cost || partsBusy.length >= slots.parts} onClick={() => update((s) => startPartUpgrade(s, p))}>
                  {lvl >= cap ? t('garage.parts.max') : t('garage.parts.develop')}
                </Btn>
                {lvl < cap && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    <Money v={cost} compact /> · {tp('garage.parts.races', time)}
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
          <div className="eyebrow">{t('garage.build.factory')}</div>
          <h3>{t('garage.build.levelTitle', { name: FACILITY[g.facility - 1].name, level: g.facility })}</h3>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            <li>{t('garage.build.partsUpTo', { cap })}</li>
            <li>{t('garage.build.slotsLine', { dev: tp('garage.build.devSlots', slots.parts), research: tp('garage.build.researchSlots', slots.research) })}</li>
          </ul>
          {next ? (
            <>
              <div className="sep" />
              <b>{t('garage.build.nextLevel', { name: next.name })}</b>
              <span className="muted" style={{ fontSize: 14 }}>
                {t('garage.build.partsUpTo', { cap: next.partCap })}
                {next.level === 3 ? `, ${t('garage.build.extraDev')}` : ''}
                {next.level === 4 ? `, ${t('garage.build.extraResearch')}` : ''} · {tp('garage.build.buildTime', next.time)}
              </span>
              {facDev ? (
                <span className="pill team">{tp('garage.build.underConstruction', facDev.remaining)}</span>
              ) : (
                <Btn variant="primary" disabled={g.money < facilityCost(g)} onClick={() => update((s) => startFacilityUpgrade(s))}>
                  {t('garage.build.upgrade')} · <Money v={facilityCost(g)} compact />
                </Btn>
              )}
            </>
          ) : (
            <span className="pill good">{t('garage.build.fullyBuilt')}</span>
          )}
        </div>

        <div className="card stack" style={{ gap: 10 }}>
          <div className="eyebrow">{t('garage.chassis.eyebrow')}</div>
          <h3>{t('garage.chassis.title')}</h3>
          <p className="muted" style={{ fontSize: 13 }}>{t('garage.chassis.note')}</p>
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
                    {t('garage.chassis.rating', { n: carRating({ ...c.base }) })} · {locked ? t('garage.chassis.from', { tier: TIERS[c.tier]?.name }) : c.description}
                  </div>
                </div>
                {owned ? (
                  <span className="pill good">{t('garage.chassis.inUse')}</span>
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
