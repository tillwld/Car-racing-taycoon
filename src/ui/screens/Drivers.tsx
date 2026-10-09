import { useMemo, useState } from 'react';
import { useLoadedGame } from '../store';
import { StationIntro, SubTabs } from '../components/Station';
import { Bar, Btn, CountryTag, Helmet, Modal, Money, Seg } from '../components/common';
import { DriverStatsBlock } from '../components/DriverCard';
import { driverRating } from '../../game/generators';
import { academyCost, driverRequiredRep, promoteAcademy, releaseCost, releaseDriver, renewDriver, signAcademy, signDriver, signingFee } from '../../game/state';
import { shortName } from '../../game/weekend';
import { computeStandings } from '../../game/season';
import type { Driver } from '../../types';
import { t, tp, tx } from '../../i18n';

export default function Drivers() {
  const { game: g, update } = useLoadedGame();
  const [sort, setSort] = useState<'rating' | 'salary' | 'age'>('rating');
  const [replace, setReplace] = useState<{ id: string; academy: boolean } | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<Driver | null>(null);
  const [tab, setTab] = useState<'team' | 'market' | 'academy'>('team');
  const st = computeStandings(g);
  const mine = g.team.driverIds.map((id) => g.drivers[id]).filter(Boolean);
  const academy = g.academy.map((id) => g.drivers[id]).filter(Boolean);
  const market = useMemo(() => {
    const list = g.driverMarket.map((id) => g.drivers[id]).filter(Boolean);
    return list.sort((a, b) => (sort === 'rating' ? driverRating(b) - driverRating(a) : sort === 'salary' ? a.salary - b.salary : a.age - b.age));
  }, [g.driverMarket, g.drivers, sort]);

  const trySign = (d: Driver, academyPromo = false) => {
    if (g.team.driverIds.length >= 2) setReplace({ id: d.id, academy: academyPromo });
    else update((s) => (academyPromo ? promoteAcademy(s, d.id) : signDriver(s, d.id)));
  };

  return (
    <>
      <StationIntro
        id="lounge"
        icon="drivers"
        lead={t('drivers.intro.lead')}
        items={[
          { title: t('drivers.intro.teamTitle'), text: t('drivers.intro.teamText') },
          { title: t('drivers.intro.renewTitle'), text: t('drivers.intro.renewText') },
          { title: t('drivers.intro.marketTitle'), text: t('drivers.intro.marketText') },
          { title: t('drivers.intro.academyTitle'), text: t('drivers.intro.academyText') },
        ]}
        tip={t('drivers.intro.tip')}
      />

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'team', l: t('drivers.tab.team'), hint: t('drivers.tab.teamHint'), badge: mine.length < 2 ? `${mine.length}/2` : undefined },
          { v: 'market', l: t('drivers.tab.market'), hint: t('drivers.tab.marketHint'), badge: market.length },
          { v: 'academy', l: t('drivers.tab.academy'), hint: t('drivers.tab.academyHint'), badge: `${academy.length}/3` },
        ]}
      />

      {tab === 'team' && (
      <section className="grid g2">
        {mine.map((d, i) => {
          const ds = st.drivers.find((x) => x.driverId === d.id);
          return (
            <div key={d.id} className="card driver-card">
              <div className="driver-head">
                <Helmet color={g.team.color} color2={g.team.color2} label={shortName(d)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="eyebrow">{i === 0 ? t('drivers.team.driver1') : t('drivers.team.driver2')}</div>
                  <h3>{d.name}</h3>
                  <div className="row" style={{ gap: 6, fontSize: 13 }}>
                    <CountryTag code={d.country} />
                    <span className="muted">{t('drivers.age', { n: d.age })} · {tp('drivers.careerRaces', d.careerRaces)} · {tp('drivers.careerWins', d.careerWins)}</span>
                  </div>
                </div>
                <div className="rating">{driverRating(d)}<small>{t('drivers.rating')}</small></div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                {d.traits.map((tr) => <span key={tr} className="pill">{tx(tr)}</span>)}
              </div>
              <DriverStatsBlock d={d} />
              <div className="grid g2 keep" style={{ gap: 10 }}>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="eyebrow">{t('drivers.team.morale')}</span>
                  <Bar value={d.morale} tone={d.morale < 40 ? 'bad' : d.morale < 65 ? 'warn' : 'good'} />
                </div>
                <div className="stack" style={{ gap: 2, fontSize: 13 }}>
                  <span className="eyebrow">{t('drivers.team.season')}</span>
                  <span>{tp('drivers.points', ds?.points ?? 0)} · {tp('drivers.podiums', ds?.podiums ?? 0)}</span>
                </div>
              </div>
              <div className="row between" style={{ fontSize: 14 }}>
                <span>{t('drivers.team.contract')} <b className={d.contract <= 2 ? 'warn' : ''}>{tp('drivers.races', d.contract)}</b></span>
                <span>{t('drivers.team.salary')} <Money v={d.salary} />{t('drivers.perRace')}</span>
              </div>
              <div className="row">
                <Btn variant="sm" onClick={() => update((s) => renewDriver(s, d.id, 7))}>{t('drivers.team.renew7')}</Btn>
                <Btn variant="sm" onClick={() => update((s) => renewDriver(s, d.id, 14))}>{t('drivers.team.renew14')}</Btn>
                {i === 1 && (
                  <Btn variant="sm ghost" onClick={() => update((s) => { s.team.driverIds = [s.team.driverIds[1], s.team.driverIds[0]]; })}>
                    {t('drivers.team.makeFirst')}
                  </Btn>
                )}
                <Btn variant="sm danger" onClick={() => setConfirmRelease(d)}>{t('drivers.release')}</Btn>
              </div>
            </div>
          );
        })}
        {mine.length < 2 && (
          <div className="card stack" style={{ placeContent: 'center', textAlign: 'center', minHeight: 200 }}>
            <h3>{t('drivers.team.openSeat')}</h3>
            <p className="muted">{t('drivers.team.openSeatText')}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Btn variant="primary sm" onClick={() => setTab('market')}>{t('drivers.team.toMarket')}</Btn>
              <Btn variant="sm" onClick={() => setTab('academy')}>{t('drivers.team.toAcademy')}</Btn>
            </div>
          </div>
        )}
      </section>
      )}

      {tab === 'academy' && (
      <section className="card">
        <div className="card-h">
          <div>
            <div className="eyebrow">{t('drivers.academy.eyebrow')}</div>
            <h3>{t('drivers.academy.title', { count: academy.length })}</h3>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>{t('drivers.academy.note')} <Money v={academyCost(g)} compact /></span>
        </div>
        {academy.length === 0 && <p className="muted">{t('drivers.academy.empty')}</p>}
        <div className="grid gauto">
          {academy.map((d) => (
            <div key={d.id} className="card flat stack" style={{ gap: 8 }}>
              <div className="row between">
                <b>{d.name}</b>
                <span className="rating" style={{ fontSize: 20 }}>{driverRating(d)} <span className="muted" style={{ fontSize: 13 }}>→ {d.talent}</span></span>
              </div>
              <span className="muted" style={{ fontSize: 13 }}>{t('drivers.age', { n: d.age })} · {d.country}</span>
              <DriverStatsBlock d={d} compact />
              <div className="row">
                <Btn variant="sm primary" onClick={() => trySign(d, true)}>{t('drivers.academy.promote')}</Btn>
                <Btn variant="sm ghost" onClick={() => update((s) => releaseDriver(s, d.id))}>{t('drivers.academy.letGo')}</Btn>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {tab === 'market' && (
      <section className="card">
        <div className="card-h">
          <div>
            <div className="eyebrow">{t('drivers.market.eyebrow')}</div>
            <h3>{t('drivers.market.title')}</h3>
          </div>
          <Seg value={sort} onChange={setSort} options={[{ v: 'rating', l: t('drivers.market.sortRating') }, { v: 'salary', l: t('drivers.market.sortSalary') }, { v: 'age', l: t('drivers.market.sortAge') }]} />
        </div>
        <div className="grid gauto">
          {market.map((d) => {
            const req = driverRequiredRep(g, d);
            const tooGood = g.reputation + 30 < req;
            return (
              <div key={d.id} className="card flat stack" style={{ gap: 8 }}>
                <div className="row between">
                  <div style={{ minWidth: 0 }}>
                    <b>{d.name}</b>
                    <div className="muted" style={{ fontSize: 13 }}>{d.country} · {t('drivers.age', { n: d.age })}</div>
                  </div>
                  <div className="rating">{driverRating(d)}<small>{d.talentKnown ? t('drivers.market.talent', { n: d.talent }) : t('drivers.rating')}</small></div>
                </div>
                {d.traits.length > 0 && <div className="row" style={{ gap: 4 }}>{d.traits.map((tr) => <span key={tr} className="pill">{tx(tr)}</span>)}</div>}
                <DriverStatsBlock d={d} compact />
                <div className="row between" style={{ fontSize: 13 }}>
                  <span className="muted">{t('drivers.market.salary')} <Money v={d.salary} />{t('drivers.perRace')}</span>
                  <span className="muted">{t('drivers.market.fee')} <Money v={signingFee(d)} compact /></span>
                </div>
                {tooGood && <span className="warn" style={{ fontSize: 12.5 }}>{t('drivers.market.tooGood', { rep: req - 30 })}</span>}
                <div className="row">
                  <Btn variant="primary sm" disabled={tooGood || g.money < signingFee(d)} onClick={() => trySign(d)}>{t('drivers.market.sign')}</Btn>
                  {d.age <= 20 && (
                    <Btn variant="sm" disabled={g.academy.length >= 3 || g.money < academyCost(g)} onClick={() => update((s) => signAcademy(s, d.id))}>
                      {t('drivers.market.toAcademy')}
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {replace && (
        <Modal onClose={() => setReplace(null)}>
          <h2>{t('drivers.replace.title')}</h2>
          <p className="muted">{t('drivers.replace.text')}</p>
          <div className="stack">
            {mine.map((d) => (
              <button
                key={d.id}
                type="button"
                className="choice"
                onClick={() => {
                  update((s) => (replace.academy ? promoteAcademy(s, replace.id, d.id) : signDriver(s, replace.id, d.id)));
                  setReplace(null);
                }}
              >
                <b>{d.name}</b>
                <span>{t('drivers.replace.info', { rating: driverRating(d) })} <Money v={releaseCost(d)} /></span>
              </button>
            ))}
          </div>
          <Btn variant="ghost" onClick={() => setReplace(null)}>{t('drivers.cancel')}</Btn>
        </Modal>
      )}
      {confirmRelease && (
        <Modal onClose={() => setConfirmRelease(null)}>
          <h2>{t('drivers.confirm.title', { name: confirmRelease.name })}</h2>
          <p className="muted">{t('drivers.confirm.fee')} <Money v={releaseCost(confirmRelease)} />. {t('drivers.confirm.warn')}</p>
          <div className="row">
            <Btn variant="danger" onClick={() => { update((s) => releaseDriver(s, confirmRelease.id)); setConfirmRelease(null); }}>{t('drivers.release')}</Btn>
            <Btn variant="ghost" onClick={() => setConfirmRelease(null)}>{t('drivers.cancel')}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
