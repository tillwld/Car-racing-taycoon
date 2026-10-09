import { useState } from 'react';
import type { Screen } from '../../App';
import { useLoadedGame } from '../store';
import { Bar, Btn, FlagStrip, Helmet, Icon, Logo, Money, TrackShape, WeatherIcon } from '../components/common';
import { StationIntro, SubTabs } from '../components/Station';
import { TRACK_BY_ID } from '../../data/tracks';
import { CHASSIS_BY_ID, CONDITION_LABELS, FACILITY, TIERS, WEATHER_LABELS } from '../../data/catalog';
import { carRating, devSlots, playerCarStats } from '../../game/carModel';
import { computeStandings } from '../../game/season';
import { lapsFor, shortName } from '../../game/weekend';
import { driverRating } from '../../game/generators';
import { sponsorIncomePerRace, totalSalaries } from '../../game/state';
import { aufbauPath, features } from '../../game/tycoon';
import { fmtPct, t, tp, tx } from '../../i18n';
import { AdButton } from '../components/AdButton';
import { rewardedSupported } from '../../platform/ads';
import { canClaimSponsorBonus, grantSponsorBonus, sponsorBonusAmount } from '../../game/adRewards';

export default function Dashboard({ go }: { go: (s: Screen) => void }) {
  const { game: g, update, toast } = useLoadedGame();
  const [tab, setTab] = useState<'today' | 'team' | 'news'>('today');
  const [allSteps, setAllSteps] = useState(false);
  const f = features(g);
  const trackId = g.calendar[g.round];
  const track = trackId ? TRACK_BY_ID[trackId] : null;
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

  const path = aufbauPath(g);
  const builtCount = path.filter((x) => x.state === 'built').length;
  const nextStep = path.find((x) => x.state === 'next');

  const alerts: { text: string; to: Screen; tone: 'bad' | 'warn' }[] = [];
  if (f.drivers && g.team.driverIds.length < 2) alerts.push({ text: t('dash.alert.freeCockpit'), to: 'drivers', tone: 'bad' });
  for (const id of f.drivers ? g.team.driverIds : []) {
    const d = g.drivers[id];
    if (d && d.contract <= 3) alerts.push({ text: d.contract <= 1 ? t('dash.alert.driverContractLast', { name: d.name }) : tp('dash.alert.driverContract', d.contract, { name: d.name }), to: 'drivers', tone: d.contract <= 1 ? 'bad' : 'warn' });
  }
  for (const sp of f.sponsors ? g.sponsors : []) if (sp.races <= 3) alerts.push({ text: sp.races <= 1 ? t('dash.alert.sponsorContractLast', { name: sp.name }) : tp('dash.alert.sponsorContract', sp.races, { name: sp.name }), to: 'sponsors', tone: sp.races <= 1 ? 'bad' : 'warn' });
  for (const [k, v] of f.garage ? Object.entries(g.car.condition) : []) if (v < 0.7) alerts.push({ text: t('dash.alert.condition', { part: CONDITION_LABELS[k as keyof typeof CONDITION_LABELS], v }), to: 'garage', tone: v < 0.45 ? 'bad' : 'warn' });
  if (f.sponsors && !g.sponsors.some((s) => s.slot === 'main')) alerts.push({ text: t('dash.alert.noMainSponsor'), to: 'sponsors', tone: 'bad' });
  if (f.staff && !g.staff.mechanic) alerts.push({ text: t('dash.alert.noMechanic'), to: 'staff', tone: 'warn' });
  if (f.garage && partsBusy < slots.parts && g.money > 150000) alerts.push({ text: t('dash.alert.devSlotFree'), to: 'garage', tone: 'warn' });
  if (f.research && resBusy < slots.research && g.money > 150000) alerts.push({ text: t('dash.alert.labFree'), to: 'research', tone: 'warn' });
  if (g.money < 0) alerts.unshift({ text: t('dash.alert.overdrawn'), to: 'finance', tone: 'bad' });

  return (
    <>
      <StationIntro
        id="office"
        icon="dashboard"
        lead={t('dash.intro.lead')}
        items={[
          { title: t('dash.intro.todayTitle'), text: t('dash.intro.todayText') },
          { title: t('dash.intro.buildTitle'), text: t('dash.intro.buildText') },
          { title: t('dash.intro.teamTitle'), text: t('dash.intro.teamText') },
          { title: t('dash.intro.newsTitle'), text: t('dash.intro.newsText') },
        ]}
        tip={t('dash.intro.tip')}
      />

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'today', l: t('dash.tab.today'), hint: t('dash.tab.todayHint'), badge: alerts.length || undefined },
          { v: 'team', l: t('dash.tab.team'), hint: t('dash.tab.teamHint') },
          { v: 'news', l: t('dash.tab.news'), hint: t('dash.tab.newsHint') },
        ]}
      />

      {tab === 'today' && (
      <>
      {track && (
        <section className="card hero-race">
          <div className="stack" style={{ gap: 12 }}>
            <div className="row">
              <span className="eyebrow">{t('dash.nextRace', { round: g.round + 1, total: g.calendar.length })}</span>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <FlagStrip colors={track.flag} />
              <h1>{track.name}</h1>
            </div>
            <p className="muted" style={{ maxWidth: 560 }}>{track.description}</p>
            <div className="row" style={{ gap: 14 }}>
              <span className="pill">{tp('dash.laps', lapsFor(g))}</span>
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
                <span className="muted" style={{ fontSize: 13 }}>{t('dash.rainRisk', { p: track.rainChance })}</span>
              )}
            </div>
            <div className="row">
              <Btn variant="primary big" icon="flag" onClick={() => go('race')}>
                {g.weekend ? t('dash.continueWeekend') : t('dash.toWeekend')}
              </Btn>
            </div>
          </div>
          <TrackShape trackId={track.id} />
        </section>
      )}

      <section className="card stack" style={{ gap: 10 }}>
        <div className="card-h" style={{ marginBottom: 0 }}>
          <div>
            <h3>{t('dash.build.title')}</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {nextStep ? t('dash.build.progress', { built: builtCount, total: path.length }) : t('dash.build.allDone')}
            </p>
          </div>
          <Btn variant="sm ghost" onClick={() => setAllSteps(!allSteps)}>{allSteps ? t('dash.build.less') : t('dash.build.all')}</Btn>
        </div>
        <div className="aufbau">
          {path
            .filter((x) => allSteps || x.state === 'next')
            .map((x) => (
              <div key={x.id} className={`aufbau-step ${x.state}`}>
                <span className="dot">{x.state === 'built' ? <Icon name="check" size={13} /> : path.indexOf(x) + 1}</span>
                <div>
                  <b>{x.name}</b>
                  <small>{x.state === 'next' ? `${x.why}${x.text ? ` · ${x.text}` : ''}` : x.state === 'built' ? t('dash.build.built') : t('dash.build.later')}</small>
                </div>
                {x.state === 'next' && <span className="pill team">{t('dash.build.nextPill')}</span>}
              </div>
            ))}
        </div>
      </section>

      <section className="grid g4">
        <div className="card stat-tile">
          <span className="eyebrow">{t('dash.tile.budget')}</span>
          <span className="big-num"><Money v={g.money} compact /></span>
          <span className="sub">{g.round > 0 || g.history.length ? <>{t('dash.tile.lastRace')} <Money v={lastProfit} sign compact /></> : t('dash.tile.noRaceYet')}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('dash.tile.reputation')}</span>
          <span className="big-num">{Math.round(g.reputation)}<span className="muted" style={{ fontSize: 18 }}>/100</span></span>
          <Bar value={g.reputation} />
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('dash.tile.championship')}</span>
          <span className="big-num">{g.results.length ? `P${teamPos}` : '–'}<span className="muted" style={{ fontSize: 16 }}> {t('dash.tile.teamSuffix')}</span></span>
          <span className="sub">{t('dash.tile.pointsDrivers', { points: tp('dash.points', st.teams[teamPos - 1]?.points ?? 0), pos: g.results.length ? myStand.map((d) => `P${st.drivers.indexOf(d) + 1}`).join(' / ') : t('dash.tile.noRaceShort') })}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('dash.tile.perRace')}</span>
          <span className="big-num" style={{ fontSize: 26 }}><Money v={income} compact /></span>
          <span className="sub">{t('dash.tile.sponsorsFixed')} <Money v={-costs} compact /></span>
        </div>
      </section>

      <section className="grid g1">
        <div className="card stack" style={{ gap: 10 }}>
          <div className="card-h">
            <h3>{t('dash.todo.title')}</h3>
            <span className="muted" style={{ fontSize: 13 }}>{alerts.length ? tp('dash.todo.count', alerts.length) : t('dash.todo.allGood')}</span>
          </div>
          {alerts.length === 0 && <p className="muted">{t('dash.todo.none')}</p>}
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
              <div className="eyebrow">{t('dash.dev.title')}</div>
              {g.developments.map((d) => (
                <div key={d.id} className="stack" style={{ gap: 4 }}>
                  <div className="row between" style={{ fontSize: 14 }}>
                    <span>{tx(d.label)}</span>
                    <span className="muted">{tp('dash.dev.remaining', d.remaining)}</span>
                  </div>
                  <Bar value={d.total - d.remaining} max={d.total} />
                </div>
              ))}
            </>
          )}
        </div>
      </section>
      {rewardedSupported() && (
        <section className="card stack" style={{ gap: 8 }}>
          <div className="card-h">
            <h3>{t('ads.sponsorBonus.title')}</h3>
          </div>
          {canClaimSponsorBonus(g) ? (
            <AdButton
              placement="sponsor_bonus"
              label={t('ads.sponsorBonus.button', { amount: sponsorBonusAmount(g) })}
              hint={`${t('ads.sponsorBonus.hint')} ${t('ads.optional')}`}
              onReward={() => {
                let amount = 0;
                update((st) => {
                  amount = grantSponsorBonus(st);
                });
                toast(t('ads.sponsorBonus.granted', { amount }), 'good');
              }}
              onFail={() => toast(t('ads.failed'), 'bad')}
            />
          ) : (
            <p className="muted">{t('ads.sponsorBonus.used')}</p>
          )}
        </section>
      )}
      </>
      )}

      {tab === 'team' && (
      <section className="grid g1">
        <div className="card stack" style={{ gap: 14 }}>
          <div className="card-h">
            <h3>{t('dash.team.title')}</h3>
            {f.garage && <Btn variant="sm ghost" onClick={() => go('garage')}>{t('dash.team.workshop')}</Btn>}
          </div>
          <div className="row" style={{ gap: 14 }}>
            <Logo kind={g.team.logo} color={g.team.color} color2={g.team.color2} short={g.team.short} size={64} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 26 }}>{g.team.name}</h2>
              <div className="muted" style={{ fontSize: 14 }}>{CHASSIS_BY_ID[g.car.chassisId]?.name} · {FACILITY[g.facility - 1].name}</div>
            </div>
            <div className="rating" style={{ marginLeft: 'auto', textAlign: 'right' }}>{rating}<small>{t('dash.team.car')}</small></div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row between" style={{ fontSize: 13 }}>
              <span className="muted">{t('dash.team.condition')}</span>
              <span className="num">{fmtPct(condAvg)}</span>
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
                    {i === 0 ? t('dash.team.driver1') : t('dash.team.driver2')} · {tp('dash.points', ds?.points ?? 0)} · {tp('dash.team.contract', d.contract)}
                  </div>
                </div>
                <div className="rating">{driverRating(d)}<small>{t('dash.team.rating')}</small></div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {tab === 'news' && (
      <section className="card">
        <div className="card-h">
          <h3>{t('dash.news.title')}</h3>
        </div>
        <div className="news">
          {g.news.slice(0, 8).map((n) => (
            <div key={n.id} className={`news-item ${n.tone}`}>
              <i />
              <span>{tx(n.text)}</span>
            </div>
          ))}
        </div>
      </section>
      )}
    </>
  );
}
