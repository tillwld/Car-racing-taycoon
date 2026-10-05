import type { ReactNode } from 'react';
import { useLoadedGame } from '../store';
import { Bar, Btn, Money } from '../components/common';
import { goalText } from '../../game/generators';
import { cancelSponsor, signSponsor, sponsorIncomePerRace, sponsorSlots } from '../../game/state';
import type { Sponsor } from '../../types';

function SponsorCard({ s, children, locked }: { s: Sponsor; children?: ReactNode; locked?: boolean }) {
  return (
    <div className="card stack" style={{ gap: 10, opacity: locked ? 0.55 : 1 }}>
      <div className="row between" style={{ flexWrap: 'nowrap' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'nowrap', minWidth: 0 }}>
          <span className="team-chip" style={{ background: s.color, height: 30 }} />
          <div style={{ minWidth: 0 }}>
            <b>{s.name}</b>
            <div className="muted" style={{ fontSize: 12.5 }}>{s.industry} · {s.slot === 'main' ? 'Hauptsponsor' : 'Partner'}</div>
          </div>
        </div>
        <span className="big-num" style={{ fontSize: 24 }}><Money v={s.perRace} compact /></span>
      </div>
      <div style={{ fontSize: 14 }}>Ziel: <b>{goalText(s.goal)}</b></div>
      <div className="muted" style={{ fontSize: 13 }}>
        Zielbonus <Money v={s.goalBonus} compact /> · Unterschrift <Money v={s.signingBonus} compact /> · {s.races} Rennen
      </div>
      {children}
    </div>
  );
}

export default function Sponsors() {
  const { game: g, update } = useLoadedGame();
  const slots = sponsorSlots(g);
  const main = g.sponsors.filter((s) => s.slot === 'main');
  const sec = g.sponsors.filter((s) => s.slot === 'secondary');
  return (
    <>
      <section className="grid g3">
        <div className="card stat-tile">
          <span className="eyebrow">Garantiert pro Rennen</span>
          <span className="big-num"><Money v={sponsorIncomePerRace(g)} compact /></span>
          <span className="sub">plus Zielboni</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Plätze</span>
          <span className="big-num">{main.length + sec.length}/{slots.main + slots.secondary}</span>
          <span className="sub">1 Hauptsponsor · {slots.secondary} Partner{g.reputation < 45 ? ' (3 ab Reputation 45)' : ''}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Reputation</span>
          <span className="big-num">{Math.round(g.reputation)}</span>
          <span className="sub">Bessere Ergebnisse locken größere Sponsoren an</span>
        </div>
      </section>
      <section className="stack" style={{ gap: 10 }}>
        <h3>Aktive Verträge</h3>
        {g.sponsors.length === 0 && <p className="muted">Keine Sponsoren unter Vertrag.</p>}
        <div className="grid gauto">
          {g.sponsors.map((s) => (
            <SponsorCard key={s.id} s={s}>
              <div className="stack" style={{ gap: 4 }}>
                <div className="row between" style={{ fontSize: 13 }}>
                  <span className="muted">Zufriedenheit</span>
                  <span>{s.misses > 0 ? <span className="warn">{s.misses}× verfehlt</span> : 'zufrieden'}</span>
                </div>
                <Bar value={s.satisfaction} tone={s.satisfaction < 35 ? 'bad' : s.satisfaction < 60 ? 'warn' : 'good'} />
              </div>
              <Btn variant="sm danger" onClick={() => update((st) => cancelSponsor(st, s.id))}>Vertrag auflösen (−3 Reputation)</Btn>
            </SponsorCard>
          ))}
        </div>
      </section>
      <section className="stack" style={{ gap: 10 }}>
        <h3>Angebote</h3>
        <p className="muted" style={{ fontSize: 14 }}>Neue Angebote kommen nach den Rennen herein. Je anspruchsvoller das Ziel, desto mehr zahlt der Sponsor – verfehlst du es dreimal in Folge, springt er ab.</p>
        <div className="grid gauto">
          {g.sponsorOffers.map((s) => {
            const locked = g.reputation < s.minReputation;
            const full = s.slot === 'main' ? main.length >= slots.main : sec.length >= slots.secondary;
            return (
              <SponsorCard key={s.id} s={s} locked={locked}>
                {locked && <span className="bad" style={{ fontSize: 13 }}>Benötigt {s.minReputation} Reputation</span>}
                <Btn variant="primary sm" disabled={locked || full} onClick={() => update((st) => signSponsor(st, s.id))}>
                  {full ? (s.slot === 'main' ? 'Hauptsponsor-Platz belegt' : 'Alle Partnerplätze belegt') : 'Unterschreiben'}
                </Btn>
              </SponsorCard>
            );
          })}
        </div>
      </section>
    </>
  );
}
