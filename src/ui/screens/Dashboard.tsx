import type { Screen } from '../../App';
import { useLoadedGame } from '../store';
import { Bar, Btn, FlagStrip, Helmet, Icon, Logo, Money, TrackShape, WeatherIcon } from '../components/common';
import { TRACK_BY_ID } from '../../data/tracks';
import { CHASSIS_BY_ID, CONDITION_LABELS, FACILITY, TIERS, WEATHER_LABELS } from '../../data/catalog';
import { carRating, devSlots, playerCarStats } from '../../game/carModel';
import { computeStandings } from '../../game/season';
import { lapsFor, shortName } from '../../game/weekend';
import { driverRating } from '../../game/generators';
import { sponsorIncomePerRace, totalSalaries } from '../../game/state';
import { features } from '../../game/tycoon';

export default function Dashboard({ go }: { go: (s: Screen) => void }) {
  const { game: g } = useLoadedGame();
  const f = features(g);
  const trackId = g.calendar[g.round];
  const t = trackId ? TRACK_BY_ID[trackId] : null;
  const stats = playerCarStats(g);
  const rating = carRating(stats);
  const st = computeStandings(g);
  const teamPos = st.teams.findIndex((x) => x.teamId === 'player') + 1;
  const myStand = st.drivers.filter((d) => d.teamId === 'player');
  const cond = Object.values(g.car.condition);
  const condAvg = cond.reduce((a, b) => a + b, 0) / cond.length;
  const sal = totalSalaries(g);
  const income = sponsorIncomePerRace(g);
  const costs = sal.drivers + sal.staff + sal.academy + sal.travel;
  const lastRaceLedger = g.ledger.filter((l) => l.season === g.season && l.round === g.round - 1);
  const lastProfit = lastRaceLedger.reduce((a, l) => a + l.amount, 0);
  const forecast = g.weekend && trackId && g.weekend.trackId === trackId ? g.weekend.forecast : null;
  const slots = devSlots(g);
  const partsBusy = g.developments.filter((d) => d.kind === 'part').length;
  const resBusy = g.developments.filter((d) => d.kind === 'research').length;

  const alerts: { text: string; to: Screen; tone: 'bad' | 'warn' }[] = [];
  if (f.drivers && g.team.driverIds.length < 2) alerts.push({ text: 'Ein Cockpit ist frei – verpflichte einen zweiten Fahrer.', to: 'drivers', tone: 'bad' });
  for (const id of f.drivers ? g.team.driverIds : []) {
    const d = g.drivers[id];
    if (d && d.contract <= 2) alerts.push({ text: `Vertrag von ${d.name} läuft in ${d.contract} Rennen aus.`, to: 'drivers', tone: 'warn' });
  }
  for (const [k, v] of f.garage ? Object.entries(g.car.condition) : []) if (v < 0.7) alerts.push({ text: `${CONDITION_LABELS[k as keyof typeof CONDITION_LABELS]} nur noch bei ${Math.round(v * 100)} % – Reparatur empfohlen.`, to: 'garage', tone: v < 0.45 ? 'bad' : 'warn' });
  if (f.sponsors && !g.sponsors.some((s) => s.slot === 'main')) alerts.push({ text: 'Kein Hauptsponsor – dir entgehen Einnahmen.', to: 'sponsors', tone: 'bad' });
  if (f.staff && !g.staff.mechanic) alerts.push({ text: 'Ohne Mechaniker dauern Boxenstopps sehr lange.', to: 'staff', tone: 'warn' });
  if (f.garage && partsBusy < slots.parts && g.money > 150000) alerts.push({ text: 'Ein Entwicklungsplatz ist frei – starte ein Upgrade.', to: 'garage', tone: 'warn' });
  if (f.research && resBusy < slots.research && g.money > 150000) alerts.push({ text: 'Das Forschungslabor ist frei.', to: 'research', tone: 'warn' });
  if (g.money < 0) alerts.unshift({ text: 'Dein Konto ist im Minus! Spare bei Personal oder hole Sponsoren.', to: 'finance', tone: 'bad' });

  return (
    <>
      {t && (
        <section className="card hero-race">
          <div className="stack" style={{ gap: 12 }}>
            <div className="row">
              <span className="eyebrow">Nächstes Rennen · Runde {g.round + 1} von {g.calendar.length}</span>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <FlagStrip colors={t.flag} />
              <h1>{t.name}</h1>
            </div>
            <p className="muted" style={{ maxWidth: 560 }}>{t.description}</p>
            <div className="row" style={{ gap: 14 }}>
              <span className="pill">{lapsFor(g)} Runden</span>
              <span className="pill">{TIERS[g.tier].name}</span>
              {forecast ? (
                <span className="row" style={{ gap: 4 }}>
                  {forecast.map((f, i) => (
                    <span key={i} style={{ width: 24, height: 24, display: 'inline-block' }} title={WEATHER_LABELS[f.kind]}>
                      <WeatherIcon kind={f.kind} />
                    </span>
                  ))}
                </span>
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>Regenrisiko {Math.round(t.rainChance * 100)} %</span>
              )}
            </div>
            <div className="row">
              <Btn variant="primary big" icon="flag" onClick={() => go('race')}>
                {g.weekend ? 'Rennwochenende fortsetzen' : 'Zum Rennwochenende'}
              </Btn>
            </div>
          </div>
          <TrackShape trackId={t.id} />
        </section>
      )}

      <section className="grid g4">
        <div className="card stat-tile">
          <span className="eyebrow">Budget</span>
          <span className="big-num"><Money v={g.money} compact /></span>
          <span className="sub">{g.round > 0 || g.history.length ? <>Letztes Rennen <Money v={lastProfit} sign compact /></> : 'Noch kein Rennen gefahren'}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Reputation</span>
          <span className="big-num">{Math.round(g.reputation)}<span className="muted" style={{ fontSize: 18 }}>/100</span></span>
          <Bar value={g.reputation} />
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Meisterschaft</span>
          <span className="big-num">{g.results.length ? `P${teamPos}` : '–'}<span className="muted" style={{ fontSize: 16 }}> Team</span></span>
          <span className="sub">{st.teams[teamPos - 1]?.points ?? 0} Punkte · Fahrer {g.results.length ? myStand.map((d) => `P${st.drivers.indexOf(d) + 1}`).join(' / ') : 'noch kein Rennen'}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Pro Rennen</span>
          <span className="big-num" style={{ fontSize: 26 }}><Money v={income} compact /></span>
          <span className="sub">Sponsoren · Fixkosten <Money v={-costs} compact /></span>
        </div>
      </section>

      <section className="grid g2">
        <div className="card stack" style={{ gap: 14 }}>
          <div className="card-h">
            <h3>Team</h3>
            {f.garage && <Btn variant="sm ghost" onClick={() => go('garage')}>Werkstatt</Btn>}
          </div>
          <div className="row" style={{ gap: 14 }}>
            <Logo kind={g.team.logo} color={g.team.color} color2={g.team.color2} short={g.team.short} size={64} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 26 }}>{g.team.name}</h2>
              <div className="muted" style={{ fontSize: 14 }}>{CHASSIS_BY_ID[g.car.chassisId]?.name} · {FACILITY[g.facility - 1].name}</div>
            </div>
            <div className="rating" style={{ marginLeft: 'auto', textAlign: 'right' }}>{rating}<small>Auto</small></div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row between" style={{ fontSize: 13 }}>
              <span className="muted">Fahrzeugzustand</span>
              <span className="num">{Math.round(condAvg * 100)} %</span>
            </div>
            <Bar value={condAvg * 100} tone={condAvg < 0.6 ? 'bad' : condAvg < 0.8 ? 'warn' : 'good'} />
          </div>
          <div className="sep" />
          {g.team.driverIds.map((id, i) => {
            const d = g.drivers[id];
            if (!d) return null;
            const ds = st.drivers.find((x) => x.driverId === id);
            return (
              <div key={id} className="row" style={{ gap: 12 }}>
                <Helmet color={g.team.color} color2={g.team.color2} label={shortName(d)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{d.name}</b>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {i === 0 ? 'Fahrer 1 · von dir gesteuert' : 'Fahrer 2'} · {ds?.points ?? 0} Punkte · Vertrag {d.contract} Rennen
                  </div>
                </div>
                <div className="rating">{driverRating(d)}<small>Wert</small></div>
              </div>
            );
          })}
        </div>

        <div className="card stack" style={{ gap: 10 }}>
          <div className="card-h">
            <h3>To-do</h3>
            <span className="muted" style={{ fontSize: 13 }}>{alerts.length ? `${alerts.length} Hinweise` : 'Alles im grünen Bereich'}</span>
          </div>
          {alerts.length === 0 && <p className="muted">Keine offenen Punkte. Zeit für das nächste Rennen.</p>}
          {alerts.slice(0, 6).map((a, i) => (
            <button key={i} type="button" className="choice" style={{ gridTemplateColumns: 'auto 1fr auto', display: 'grid', alignItems: 'center', gap: 10 }} onClick={() => go(a.to)}>
              <span className={a.tone}><Icon name="info" size={18} /></span>
              <span style={{ color: 'var(--text)' }}>{a.text}</span>
              <Icon name="right" size={16} />
            </button>
          ))}
          {g.developments.length > 0 && (
            <>
              <div className="sep" />
              <div className="eyebrow">In Entwicklung</div>
              {g.developments.map((d) => (
                <div key={d.id} className="stack" style={{ gap: 4 }}>
                  <div className="row between" style={{ fontSize: 14 }}>
                    <span>{d.label}</span>
                    <span className="muted">noch {d.remaining} {d.remaining === 1 ? 'Rennen' : 'Rennen'}</span>
                  </div>
                  <Bar value={d.total - d.remaining} max={d.total} />
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <h3>Fahrerlager-News</h3>
        </div>
        <div className="news">
          {g.news.slice(0, 8).map((n) => (
            <div key={n.id} className={`news-item ${n.tone}`}>
              <i />
              <span>{n.text}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
