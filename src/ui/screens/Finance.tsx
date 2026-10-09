import { useState } from 'react';
import { useLoadedGame } from '../store';
import { Money } from '../components/common';
import { StationIntro, SubTabs } from '../components/Station';
import { sponsorIncomePerRace, totalSalaries } from '../../game/state';
import { money } from '../../game/util';
import { lazyRecord, t, tx } from '../../i18n';
import type { LedgerEntry } from '../../types';

const CAT: Record<LedgerEntry['category'], string> = lazyRecord('fin.cat', ['sponsor', 'prize', 'bonus', 'event', 'salary', 'staff', 'travel', 'repair', 'upgrade', 'research', 'purchase', 'facility', 'other'] as const);

export default function Finance() {
  const { game: g } = useLoadedGame();
  const [tab, setTab] = useState<'overview' | 'areas' | 'ledger'>('overview');
  const season = g.ledger.filter((l) => l.season === g.season);
  const income = season.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0);
  const expenses = season.filter((l) => l.amount < 0).reduce((a, l) => a - l.amount, 0);
  const byCat = new Map<string, number>();
  for (const l of season) byCat.set(l.category, (byCat.get(l.category) ?? 0) + l.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const sal = totalSalaries(g);
  const fixed = sal.drivers + sal.staff + sal.academy + sal.travel;
  const sponsor = sponsorIncomePerRace(g);

  // Ergebnis pro Rennwochenende (alle Saisons, letzte 14)
  const keys: string[] = [];
  const net = new Map<string, number>();
  for (const l of g.ledger) {
    const k = `${l.season}-${l.round}`;
    if (!net.has(k)) keys.push(k);
    net.set(k, (net.get(k) ?? 0) + l.amount);
  }
  const series = keys.slice(-14).map((k) => ({ k, v: net.get(k)! }));
  const maxAbs = Math.max(1, ...series.map((s) => Math.abs(s.v)));
  const W = 640, H = 200, pad = 28;
  const bw = series.length ? (W - pad * 2) / series.length : 0;
  const y0 = H / 2;

  return (
    <>
      <StationIntro
        id="finance"
        icon="finance"
        lead={t('fin.intro.lead')}
        items={[
          { title: t('fin.intro.overviewTitle'), text: t('fin.intro.overviewText') },
          { title: t('fin.intro.areasTitle'), text: t('fin.intro.areasText') },
          { title: t('fin.intro.ledgerTitle'), text: t('fin.intro.ledgerText') },
        ]}
        tip={t('fin.intro.tip')}
      />

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'overview', l: t('fin.tab.overview'), hint: t('fin.tab.overviewHint') },
          { v: 'areas', l: t('fin.tab.areas'), hint: t('fin.tab.areasHint') },
          { v: 'ledger', l: t('fin.tab.ledger'), hint: t('fin.tab.ledgerHint') },
        ]}
      />

      {tab === 'overview' && (
      <section className="grid g4">
        <div className="card stat-tile">
          <span className="eyebrow">{t('fin.tile.balance')}</span>
          <span className="big-num" style={{ color: g.money < 0 ? 'var(--bad)' : undefined }}><Money v={g.money} compact /></span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('fin.tile.income', { season: g.season })}</span>
          <span className="big-num good"><Money v={income} compact /></span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('fin.tile.expenses', { season: g.season })}</span>
          <span className="big-num bad"><Money v={-expenses} compact /></span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('fin.tile.profit')}</span>
          <span className="big-num"><Money v={income - expenses} sign compact /></span>
        </div>
      </section>
      )}

      {tab === 'overview' && (
      <section className="grid g1" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>{t('fin.chart.title')}</h3></div>
          {series.length === 0 ? (
            <p className="muted">{t('fin.chart.empty')}</p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="spark" style={{ height: 'auto' }} role="img" aria-label={t('fin.chart.aria')}>
              <line x1={pad} x2={W - pad} y1={y0} y2={y0} stroke="var(--line-2)" />
              <text x={pad - 4} y={14} fill="var(--muted)" fontSize="11" textAnchor="start">+{money(maxAbs, true)}</text>
              <text x={pad - 4} y={H - 4} fill="var(--muted)" fontSize="11" textAnchor="start">−{money(maxAbs, true)}</text>
              {series.map((s, i) => {
                const h = (Math.abs(s.v) / maxAbs) * (H / 2 - 22);
                const x = pad + i * bw + bw * 0.18;
                return (
                  <g key={s.k}>
                    <rect x={x} width={bw * 0.64} y={s.v >= 0 ? y0 - h : y0} height={Math.max(1, h)} rx="2" fill={s.v >= 0 ? 'var(--good)' : 'var(--bad)'} opacity="0.85">
                      <title>{t('fin.chart.bar', { season: s.k.split('-')[0], race: +s.k.split('-')[1] + 1, v: s.v })}</title>
                    </rect>
                  </g>
                );
              })}
            </svg>
          )}
          <div className="sep" />
          <div className="stack" style={{ gap: 4, fontSize: 14 }}>
            <div className="row between"><span className="muted">{t('fin.line.sponsors')}</span><Money v={sponsor} /></div>
            <div className="row between"><span className="muted">{t('fin.line.driverSalaries')}</span><Money v={-sal.drivers} /></div>
            <div className="row between"><span className="muted">{t('fin.line.staffSalaries')}</span><Money v={-sal.staff} /></div>
            {sal.academy > 0 && <div className="row between"><span className="muted">{t('fin.line.academy')}</span><Money v={-sal.academy} /></div>}
            <div className="row between"><span className="muted">{t('fin.line.travel')}</span><Money v={-sal.travel} /></div>
            <div className="sep" />
            <div className="row between"><b>{t('fin.line.recurring')}</b><Money v={sponsor - fixed} sign /></div>
          </div>
        </div>
      </section>
      )}

      {tab === 'areas' && (
      <section className="grid g1" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>{t('fin.areas.title', { season: g.season })}</h3></div>
          <div className="stack" style={{ gap: 6 }}>
            {cats.length === 0 && <p className="muted">{t('fin.areas.empty')}</p>}
            {cats.map(([c, v]) => (
              <div key={c} className="stack" style={{ gap: 3 }}>
                <div className="row between" style={{ fontSize: 14 }}>
                  <span>{CAT[c as LedgerEntry['category']]}</span>
                  <Money v={v} sign />
                </div>
                <div className={`bar ${v >= 0 ? 'good' : 'bad'}`}>
                  <i style={{ width: `${Math.min(100, (Math.abs(v) / Math.max(income, expenses, 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {tab === 'ledger' && (
      <section className="card">
        <div className="card-h"><h3>{t('fin.ledger.title')}</h3></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t('fin.ledger.colRound')}</th><th>{t('fin.ledger.colEntry')}</th><th>{t('fin.ledger.colCat')}</th><th className="num">{t('fin.ledger.colAmount')}</th></tr></thead>
            <tbody>
              {[...g.ledger].reverse().slice(0, 40).map((l, i) => (
                <tr key={i}>
                  <td className="muted num" style={{ textAlign: 'left' }}>{t('fin.ledger.rowId', { season: l.season, race: l.round + 1 })}</td>
                  <td>{tx(l.label)}</td>
                  <td className="muted">{CAT[l.category]}</td>
                  <td className="num"><Money v={l.amount} sign /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </>
  );
}
