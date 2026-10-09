import { useState, type ReactNode } from 'react';
import { useLoadedGame } from '../store';
import { StationIntro, SubTabs } from '../components/Station';
import { Bar, Btn, Money } from '../components/common';
import { goalText } from '../../game/generators';
import { cancelSponsor, signSponsor, sponsorIncomePerRace, sponsorSlots } from '../../game/state';
import type { Sponsor } from '../../types';
import { t, tp, tx } from '../../i18n';

function SponsorCard({ s, children, locked }: { s: Sponsor; children?: ReactNode; locked?: boolean }) {
  return (
    <div className="card stack" style={{ gap: 10, opacity: locked ? 0.55 : 1 }}>
      <div className="row between" style={{ flexWrap: 'nowrap' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'nowrap', minWidth: 0 }}>
          <span className="team-chip" style={{ background: s.color, height: 30 }} />
          <div style={{ minWidth: 0 }}>
            <b>{s.name}</b>
            <div className="muted" style={{ fontSize: 12.5 }}>{tx(s.industry)} · {s.slot === 'main' ? t('sponsors.card.main') : t('sponsors.card.partner')}</div>
          </div>
        </div>
        <span className="big-num" style={{ fontSize: 24 }}><Money v={s.perRace} compact /></span>
      </div>
      <div style={{ fontSize: 14 }}>{t('sponsors.card.goal')} <b>{tx(goalText(s.goal))}</b></div>
      <div className="muted" style={{ fontSize: 13 }}>
        {t('sponsors.card.safe')} · {t('sponsors.card.goalBonus')} <Money v={s.goalBonus} compact /> · {t('sponsors.card.signing')} <Money v={s.signingBonus} compact /> · {tp('sponsors.card.runs', s.races)}
      </div>
      {children}
    </div>
  );
}

export default function Sponsors() {
  const { game: g, update } = useLoadedGame();
  const [tab, setTab] = useState<'mine' | 'offers'>('mine');
  const slots = sponsorSlots(g);
  const main = g.sponsors.filter((s) => s.slot === 'main');
  const sec = g.sponsors.filter((s) => s.slot === 'secondary');
  const open = g.sponsorOffers.filter((s) => g.reputation >= s.minReputation).length;
  return (
    <>
      <StationIntro
        id="sponsors"
        icon="sponsors"
        lead={t('sponsors.intro.lead')}
        items={[
          { title: t('sponsors.intro.offersTitle'), text: t('sponsors.intro.offersText') },
          { title: t('sponsors.intro.goalsTitle'), text: t('sponsors.intro.goalsText') },
          { title: t('sponsors.intro.keepTitle'), text: t('sponsors.intro.keepText') },
          { title: t('sponsors.intro.growTitle'), text: t('sponsors.intro.growText') },
        ]}
        tip={t('sponsors.intro.tip')}
      />

      <div className="grid g3 keep">
        <div className="card stat-tile">
          <span className="eyebrow">{t('sponsors.tile.guaranteed')}</span>
          <span className="big-num"><Money v={sponsorIncomePerRace(g)} compact /></span>
          <span className="sub">{t('sponsors.tile.plusBonuses')}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('sponsors.tile.slots')}</span>
          <span className="big-num">{main.length + sec.length}/{slots.main + slots.secondary}</span>
          <span className="sub">{t('sponsors.tile.slotsLine', { partners: tp('sponsors.tile.partners', slots.secondary) })}{g.reputation < 45 ? ` (${t('sponsors.tile.thirdAt')})` : ''}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('sponsors.tile.reputation')}</span>
          <span className="big-num">{Math.round(g.reputation)}</span>
          <span className="sub">{t('sponsors.tile.reputationSub')}</span>
        </div>
      </div>

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'mine', l: t('sponsors.tab.mine'), hint: t('sponsors.tab.mineHint'), badge: g.sponsors.length },
          { v: 'offers', l: t('sponsors.tab.offers'), hint: t('sponsors.tab.offersHint'), badge: open },
        ]}
      />

      {tab === 'mine' && (
        <section className="stack" style={{ gap: 10 }}>
          {g.sponsors.length === 0 && (
            <div className="hint-card">
              <b>{t('sponsors.mine.emptyTitle')}</b>
              <span className="muted">{t('sponsors.mine.emptyText')}</span>
              <div><Btn variant="primary sm" onClick={() => setTab('offers')}>{t('sponsors.mine.viewOffers')}</Btn></div>
            </div>
          )}
          <div className="grid gauto">
            {g.sponsors.map((s) => (
              <SponsorCard key={s.id} s={s}>
                <div className="stack" style={{ gap: 4 }}>
                  <div className="row between" style={{ fontSize: 13 }}>
                    <span className="muted">{t('sponsors.mine.satisfaction')}</span>
                    <span>{s.misses > 0 ? <span className="warn">{t('sponsors.mine.missed', { n: s.misses })}</span> : t('sponsors.mine.satisfied')}</span>
                  </div>
                  <Bar value={s.satisfaction} tone={s.satisfaction < 35 ? 'bad' : s.satisfaction < 60 ? 'warn' : 'good'} />
                </div>
                <Btn variant="sm danger" onClick={() => update((st) => cancelSponsor(st, s.id))}>{t('sponsors.mine.cancel')}</Btn>
              </SponsorCard>
            ))}
          </div>
        </section>
      )}

      {tab === 'offers' && (
        <section className="stack" style={{ gap: 10 }}>
          {g.sponsorOffers.length === 0 && <p className="muted">{t('sponsors.offers.none')}</p>}
          <div className="grid gauto">
            {g.sponsorOffers.map((s) => {
              const locked = g.reputation < s.minReputation;
              const full = s.slot === 'main' ? main.length >= slots.main : sec.length >= slots.secondary;
              return (
                <SponsorCard key={s.id} s={s} locked={locked}>
                  {locked && <span className="bad" style={{ fontSize: 13 }}>{t('sponsors.offers.needs', { n: s.minReputation })}</span>}
                  <Btn variant="primary sm" disabled={locked || full} onClick={() => update((st) => signSponsor(st, s.id))}>
                    {full ? (s.slot === 'main' ? t('sponsors.offers.mainFull') : t('sponsors.offers.partnersFull')) : t('sponsors.offers.sign')}
                  </Btn>
                </SponsorCard>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
