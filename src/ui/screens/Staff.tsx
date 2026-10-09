import { useState } from 'react';
import { useLoadedGame } from '../store';
import { Bar, Btn, Money } from '../components/common';
import { StationIntro } from '../components/Station';
import { STAFF_KEYS, STAFF_ROLES } from '../../data/catalog';
import { fireStaff, hireStaff } from '../../game/state';
import { pitCrewTime } from '../../game/carModel';
import type { StaffRole } from '../../types';
import { t, tx } from '../../i18n';

// Womit man anfangen sollte: die ersten zwei bringen am meisten
const PRIORITY: Partial<Record<StaffRole, boolean>> = { mechanic: true, raceEngineer: true };
const ORDER: StaffRole[] = ['mechanic', 'raceEngineer', 'chiefMechanic', 'engineEngineer', 'aeroEngineer', 'dataAnalyst'];

export default function StaffScreen() {
  const { game: g, update } = useLoadedGame();
  const [openRole, setOpenRole] = useState<StaffRole | null>(null);
  const crew = pitCrewTime(g);
  const total = Object.values(g.staff).reduce((a, s) => a + (s?.salary ?? 0), 0);
  const roles = ORDER.filter((r) => STAFF_KEYS.includes(r));
  return (
    <>
      <StationIntro
        id="staff"
        icon="staff"
        lead={t('staff.intro.lead')}
        items={[
          { title: t('staff.intro.fillTitle'), text: t('staff.intro.fillText') },
          { title: t('staff.intro.skillTitle'), text: t('staff.intro.skillText') },
          { title: t('staff.intro.effectTitle'), text: t('staff.intro.effectText') },
          { title: t('staff.intro.costTitle'), text: t('staff.intro.costText') },
        ]}
        tip={t('staff.intro.tip')}
      />

      <div className="grid g3 keep">
        <div className="card stat-tile">
          <span className="eyebrow">{t('staff.tile.salaries')}</span>
          <span className="big-num"><Money v={total} compact /></span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('staff.tile.pitStop')}</span>
          <span className="big-num">{t('staff.tile.seconds', { v: crew.base })}</span>
          <span className="sub">{t('staff.tile.errorRate', { p: crew.error })}</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('staff.tile.filled')}</span>
          <span className="big-num">{Object.keys(g.staff).length}/{STAFF_KEYS.length}</span>
        </div>
      </div>

      <section className="stack" style={{ gap: 8 }}>
        {roles.map((r) => {
          const cur = g.staff[r];
          const market = g.staffMarket.filter((x) => x.role === r).sort((a, b) => b.skill - a.skill);
          const open = openRole === r;
          return (
            <div key={r} className="card stack" style={{ gap: 10 }}>
              <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <h3>{STAFF_ROLES[r].label}</h3>
                    {cur ? <span className="pill good">{t('staff.filled')}</span> : <span className="pill warn">{t('staff.vacant')}</span>}
                    {!cur && PRIORITY[r] && <span className="pill team">{t('staff.hireFirst')}</span>}
                  </div>
                  <p className="muted" style={{ fontSize: 13.5, marginTop: 2 }}><b>{STAFF_ROLES[r].desc}.</b> {STAFF_ROLES[r].effect}.</p>
                </div>
                <Btn variant={cur ? 'sm' : 'sm primary'} onClick={() => setOpenRole(open ? null : r)}>
                  {open ? t('staff.closeCandidates') : cur ? t('staff.replaceCount', { n: market.length }) : t('staff.viewCandidates', { n: market.length })}
                </Btn>
              </div>
              {cur && (
                <div className="row between" style={{ gap: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--panel-2)' }}>
                  <div style={{ minWidth: 0 }}>
                    <b>{cur.name}</b> <span className="muted" style={{ fontSize: 13 }}>· {cur.trait ? tx(cur.trait) : cur.country}</span>
                    <div className="muted" style={{ fontSize: 12.5 }}>{t('staff.salary')} <Money v={cur.salary} />{t('staff.perRace')}</div>
                  </div>
                  <div style={{ width: 140 }}>
                    <div className="row between" style={{ fontSize: 12.5 }}><span className="muted">{t('staff.skill')}</span><b>{cur.skill}</b></div>
                    <Bar value={cur.skill} />
                  </div>
                  <Btn variant="sm danger" onClick={() => update((s) => fireStaff(s, r))}>{t('staff.fire')} (<Money v={cur.salary * 2} compact />)</Btn>
                </div>
              )}
              {open && (
                <div className="stack" style={{ gap: 6 }}>
                  <div className="eyebrow">{t('staff.candidates')}</div>
                  {market.map((st) => (
                    <div key={st.id} className="row between" style={{ fontSize: 14, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <b>{st.name}</b> <span className="muted">· {t('staff.skillN', { n: st.skill })}{st.trait ? ` · ${tx(st.trait)}` : ''}</span>
                        <div className="muted" style={{ fontSize: 12.5 }}><Money v={st.salary} />{t('staff.perRace')} · {t('staff.signingFee')} <Money v={st.salary * 2} compact /></div>
                      </div>
                      <Btn variant={cur && cur.skill >= st.skill ? 'sm' : 'sm primary'} disabled={g.money < st.salary * 2} onClick={() => { update((s) => hireStaff(s, st.id)); setOpenRole(null); }}>
                        {cur ? t('staff.replace') : t('staff.hire')}
                      </Btn>
                    </div>
                  ))}
                  {market.length === 0 && <span className="muted">{t('staff.noCandidates')}</span>}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
