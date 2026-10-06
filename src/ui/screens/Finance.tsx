import { useState } from 'react';
import { useLoadedGame } from '../store';
import { Money } from '../components/common';
import { StationIntro, SubTabs } from '../components/Station';
import { sponsorIncomePerRace, totalSalaries } from '../../game/state';
import { money } from '../../game/util';
import type { LedgerEntry } from '../../types';

const CAT: Record<LedgerEntry['category'], string> = {
  sponsor: 'Sponsoren',
  prize: 'Preisgeld',
  bonus: 'Sponsorboni',
  event: 'Ereignisse',
  salary: 'Fahrer',
  staff: 'Mitarbeiter',
  travel: 'Reisekosten',
  repair: 'Reparaturen',
  upgrade: 'Upgrades',
  research: 'Forschung',
  purchase: 'Fahrzeugkauf',
  facility: 'Fabrikausbau',
  other: 'Sonstiges',
};

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
        lead="Hier siehst du, wohin dein Geld fließt und woher es kommt. Ändern kannst du hier nichts, es ist deine Übersicht."
        items={[
          { title: 'Überblick', text: 'Kontostand, Einnahmen und Ausgaben dieser Saison, dazu eine Bilanz pro Rennwochenende.' },
          { title: 'Nach Bereich', text: 'Zeigt, wofür du am meisten ausgibst: Gehälter, Reparaturen, Upgrades und so weiter.' },
          { title: 'Buchungen', text: 'Die einzelnen Buchungen der letzten Rennen, damit du jede Zahl nachvollziehen kannst.' },
        ]}
        tip="Tipp: Liegt der Wert „Laufend pro Rennen“ im Minus, verdienen deine Sponsoren zu wenig. Hol dir einen besseren Sponsor oder spare bei Personal."
      />

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'overview', l: 'Überblick', hint: 'Kontostand, Saisonbilanz und die laufenden Kosten pro Rennen.' },
          { v: 'areas', l: 'Nach Bereich', hint: 'Woher dein Geld in dieser Saison kam und wofür du es ausgegeben hast.' },
          { v: 'ledger', l: 'Buchungen', hint: 'Die letzten 40 einzelnen Buchungen.' },
        ]}
      />

      {tab === 'overview' && (
      <section className="grid g4">
        <div className="card stat-tile">
          <span className="eyebrow">Kontostand</span>
          <span className="big-num" style={{ color: g.money < 0 ? 'var(--bad)' : undefined }}><Money v={g.money} compact /></span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Einnahmen Saison {g.season}</span>
          <span className="big-num good"><Money v={income} compact /></span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Ausgaben Saison {g.season}</span>
          <span className="big-num bad"><Money v={-expenses} compact /></span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Gewinn / Verlust</span>
          <span className="big-num"><Money v={income - expenses} sign compact /></span>
        </div>
      </section>
      )}

      {tab === 'overview' && (
      <section className="grid g1" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>Bilanz pro Rennwochenende</h3></div>
          {series.length === 0 ? (
            <p className="muted">Noch keine Buchungen.</p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="spark" style={{ height: 'auto' }} role="img" aria-label="Gewinn und Verlust pro Rennen">
              <line x1={pad} x2={W - pad} y1={y0} y2={y0} stroke="var(--line-2)" />
              <text x={pad - 4} y={14} fill="var(--muted)" fontSize="11" textAnchor="start">+{money(maxAbs, true)}</text>
              <text x={pad - 4} y={H - 4} fill="var(--muted)" fontSize="11" textAnchor="start">−{money(maxAbs, true)}</text>
              {series.map((s, i) => {
                const h = (Math.abs(s.v) / maxAbs) * (H / 2 - 22);
                const x = pad + i * bw + bw * 0.18;
                return (
                  <g key={s.k}>
                    <rect x={x} width={bw * 0.64} y={s.v >= 0 ? y0 - h : y0} height={Math.max(1, h)} rx="2" fill={s.v >= 0 ? 'var(--good)' : 'var(--bad)'} opacity="0.85">
                      <title>{`Saison ${s.k.split('-')[0]}, Rennen ${+s.k.split('-')[1] + 1}: ${money(s.v)}`}</title>
                    </rect>
                  </g>
                );
              })}
            </svg>
          )}
          <div className="sep" />
          <div className="stack" style={{ gap: 4, fontSize: 14 }}>
            <div className="row between"><span className="muted">Sponsoren (garantiert)</span><Money v={sponsor} /></div>
            <div className="row between"><span className="muted">Fahrergehälter</span><Money v={-sal.drivers} /></div>
            <div className="row between"><span className="muted">Mitarbeitergehälter</span><Money v={-sal.staff} /></div>
            {sal.academy > 0 && <div className="row between"><span className="muted">Akademie</span><Money v={-sal.academy} /></div>}
            <div className="row between"><span className="muted">Reisekosten</span><Money v={-sal.travel} /></div>
            <div className="sep" />
            <div className="row between"><b>Laufend pro Rennen (ohne Preisgeld)</b><Money v={sponsor - fixed} sign /></div>
          </div>
        </div>
      </section>
      )}

      {tab === 'areas' && (
      <section className="grid g1" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>Nach Bereich (Saison {g.season})</h3></div>
          <div className="stack" style={{ gap: 6 }}>
            {cats.length === 0 && <p className="muted">Noch keine Buchungen in dieser Saison.</p>}
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
        <div className="card-h"><h3>Letzte Buchungen</h3></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Saison/Rennen</th><th>Buchung</th><th>Bereich</th><th className="num">Betrag</th></tr></thead>
            <tbody>
              {[...g.ledger].reverse().slice(0, 40).map((l, i) => (
                <tr key={i}>
                  <td className="muted num" style={{ textAlign: 'left' }}>S{l.season} · R{l.round + 1}</td>
                  <td>{l.label}</td>
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
