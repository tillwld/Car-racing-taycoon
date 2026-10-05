import { useMemo, useState } from 'react';
import { useLoadedGame } from '../store';
import { Bar, Btn, CountryTag, Helmet, Modal, Money, Seg } from '../components/common';
import { DriverStatsBlock } from '../components/DriverCard';
import { driverRating } from '../../game/generators';
import { academyCost, driverRequiredRep, promoteAcademy, releaseCost, releaseDriver, renewDriver, signAcademy, signDriver, signingFee } from '../../game/state';
import { shortName } from '../../game/weekend';
import { computeStandings } from '../../game/season';
import type { Driver } from '../../types';

export default function Drivers() {
  const { game: g, update } = useLoadedGame();
  const [sort, setSort] = useState<'rating' | 'salary' | 'age'>('rating');
  const [replace, setReplace] = useState<{ id: string; academy: boolean } | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<Driver | null>(null);
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
      <section className="grid g2">
        {mine.map((d, i) => {
          const ds = st.drivers.find((x) => x.driverId === d.id);
          return (
            <div key={d.id} className="card driver-card">
              <div className="driver-head">
                <Helmet color={g.team.color} color2={g.team.color2} label={shortName(d)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="eyebrow">{i === 0 ? 'Fahrer 1 · selbst gesteuert' : 'Fahrer 2'}</div>
                  <h3>{d.name}</h3>
                  <div className="row" style={{ gap: 6, fontSize: 13 }}>
                    <CountryTag code={d.country} />
                    <span className="muted">{d.age} Jahre · {d.careerRaces} Rennen · {d.careerWins} Siege</span>
                  </div>
                </div>
                <div className="rating">{driverRating(d)}<small>Wert</small></div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                {d.traits.map((t) => <span key={t} className="pill">{t}</span>)}
              </div>
              <DriverStatsBlock d={d} />
              <div className="grid g2 keep" style={{ gap: 10 }}>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="eyebrow">Moral</span>
                  <Bar value={d.morale} tone={d.morale < 40 ? 'bad' : d.morale < 65 ? 'warn' : 'good'} />
                </div>
                <div className="stack" style={{ gap: 2, fontSize: 13 }}>
                  <span className="eyebrow">Saison</span>
                  <span>{ds?.points ?? 0} Punkte · {ds?.podiums ?? 0} Podien</span>
                </div>
              </div>
              <div className="row between" style={{ fontSize: 14 }}>
                <span>Vertrag: <b className={d.contract <= 2 ? 'warn' : ''}>{d.contract} Rennen</b></span>
                <span>Gehalt: <Money v={d.salary} />/R</span>
              </div>
              <div className="row">
                <Btn variant="sm" onClick={() => update((s) => renewDriver(s, d.id, 7))}>+7 Rennen verlängern</Btn>
                <Btn variant="sm" onClick={() => update((s) => renewDriver(s, d.id, 14))}>+14</Btn>
                {i === 1 && (
                  <Btn variant="sm ghost" onClick={() => update((s) => { s.team.driverIds = [s.team.driverIds[1], s.team.driverIds[0]]; })}>
                    Zu Fahrer 1 machen
                  </Btn>
                )}
                <Btn variant="sm danger" onClick={() => setConfirmRelease(d)}>Entlassen</Btn>
              </div>
            </div>
          );
        })}
        {mine.length < 2 && (
          <div className="card stack" style={{ placeContent: 'center', textAlign: 'center', minHeight: 200 }}>
            <h3>Cockpit frei</h3>
            <p className="muted">Verpflichte unten einen Fahrer vom Markt oder befördere ein Talent aus der Akademie.</p>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <div className="eyebrow">Nachwuchs</div>
            <h3>Akademie ({academy.length}/3)</h3>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>Talente entwickeln sich schneller und kosten wenig. Aufnahme: <Money v={academyCost(g)} compact /></span>
        </div>
        {academy.length === 0 && <p className="muted">Noch keine Talente. Junge Fahrer auf dem Markt (bis 20 Jahre) kannst du direkt aufnehmen – oder du entdeckst eins über ein Ereignis.</p>}
        <div className="grid gauto">
          {academy.map((d) => (
            <div key={d.id} className="card flat stack" style={{ gap: 8 }}>
              <div className="row between">
                <b>{d.name}</b>
                <span className="rating" style={{ fontSize: 20 }}>{driverRating(d)} <span className="muted" style={{ fontSize: 13 }}>→ {d.talent}</span></span>
              </div>
              <span className="muted" style={{ fontSize: 13 }}>{d.age} Jahre · {d.country}</span>
              <DriverStatsBlock d={d} compact />
              <div className="row">
                <Btn variant="sm primary" onClick={() => trySign(d, true)}>Ins Cockpit befördern</Btn>
                <Btn variant="sm ghost" onClick={() => update((s) => releaseDriver(s, d.id))}>Freigeben</Btn>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <div className="eyebrow">Transfermarkt</div>
            <h3>Verfügbare Fahrer</h3>
          </div>
          <Seg value={sort} onChange={setSort} options={[{ v: 'rating', l: 'Stärke' }, { v: 'salary', l: 'Gehalt' }, { v: 'age', l: 'Alter' }]} />
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
                    <div className="muted" style={{ fontSize: 13 }}>{d.country} · {d.age} Jahre</div>
                  </div>
                  <div className="rating">{driverRating(d)}<small>{d.talentKnown ? `Talent ${d.talent}` : 'Wert'}</small></div>
                </div>
                {d.traits.length > 0 && <div className="row" style={{ gap: 4 }}>{d.traits.map((t) => <span key={t} className="pill">{t}</span>)}</div>}
                <DriverStatsBlock d={d} compact />
                <div className="row between" style={{ fontSize: 13 }}>
                  <span className="muted">Gehalt <Money v={d.salary} />/R</span>
                  <span className="muted">Prämie <Money v={signingFee(d)} compact /></span>
                </div>
                {tooGood && <span className="warn" style={{ fontSize: 12.5 }}>Wechselt erst ab Reputation {req - 30}.</span>}
                <div className="row">
                  <Btn variant="primary sm" disabled={tooGood || g.money < signingFee(d)} onClick={() => trySign(d)}>Verpflichten</Btn>
                  {d.age <= 20 && (
                    <Btn variant="sm" disabled={g.academy.length >= 3 || g.money < academyCost(g)} onClick={() => update((s) => signAcademy(s, d.id))}>
                      In die Akademie
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {replace && (
        <Modal onClose={() => setReplace(null)}>
          <h2>Wen ersetzen?</h2>
          <p className="muted">Beide Cockpits sind besetzt. Der ersetzte Fahrer erhält eine Abfindung.</p>
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
                <span>Wert {driverRating(d)} · Abfindung <Money v={releaseCost(d)} /></span>
              </button>
            ))}
          </div>
          <Btn variant="ghost" onClick={() => setReplace(null)}>Abbrechen</Btn>
        </Modal>
      )}
      {confirmRelease && (
        <Modal onClose={() => setConfirmRelease(null)}>
          <h2>{confirmRelease.name} entlassen?</h2>
          <p className="muted">Die Abfindung beträgt <Money v={releaseCost(confirmRelease)} />. Ohne zwei Fahrer verlierst du Punkte und Preisgeld.</p>
          <div className="row">
            <Btn variant="danger" onClick={() => { update((s) => releaseDriver(s, confirmRelease.id)); setConfirmRelease(null); }}>Entlassen</Btn>
            <Btn variant="ghost" onClick={() => setConfirmRelease(null)}>Abbrechen</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
