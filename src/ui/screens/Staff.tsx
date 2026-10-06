import { useState } from 'react';
import { useLoadedGame } from '../store';
import { Bar, Btn, Money } from '../components/common';
import { StationIntro } from '../components/Station';
import { STAFF_KEYS, STAFF_ROLES } from '../../data/catalog';
import { fireStaff, hireStaff } from '../../game/state';
import { pitCrewTime } from '../../game/carModel';
import type { StaffRole } from '../../types';

// Womit man anfangen sollte: die ersten zwei bringen am meisten
const PRIORITY: Partial<Record<StaffRole, string>> = { mechanic: 'Zuerst einstellen', raceEngineer: 'Zuerst einstellen' };
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
        lead="Gute Mitarbeiter machen dein Team besser. Jeder hat eine feste Aufgabe und kostet Gehalt pro Rennen."
        items={[
          { title: 'Stellen besetzen', text: 'Pro Aufgabe gibt es eine Stelle. Bewerber siehst du mit Können, Gehalt und Antrittsgeld.' },
          { title: 'Das richtige Können wählen', text: 'Je höher das Können, desto stärker der Effekt, aber auch das Gehalt. Du kannst jederzeit ersetzen.' },
          { title: 'Wirkung verstehen', text: 'Unter jeder Stelle steht, was sie bringt: schnellere Stopps, günstigere Reparaturen, schnellere Entwicklung …' },
          { title: 'Kosten im Blick', text: 'Gehälter werden bei jedem Rennen abgezogen. Oben siehst du die Summe.' },
        ]}
        tip="Tipp: Fang mit Mechaniker und Renningenieur an. Die bringen am meisten für wenig Geld."
      />

      <div className="grid g3 keep">
        <div className="card stat-tile">
          <span className="eyebrow">Gehälter pro Rennen</span>
          <span className="big-num"><Money v={total} compact /></span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Boxenstopp (Standzeit)</span>
          <span className="big-num">{crew.base.toFixed(1)} s</span>
          <span className="sub">Fehlerquote {Math.round(crew.error * 100)} %</span>
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Stellen besetzt</span>
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
                    {cur ? <span className="pill good">besetzt</span> : <span className="pill warn">unbesetzt</span>}
                    {!cur && PRIORITY[r] && <span className="pill team">{PRIORITY[r]}</span>}
                  </div>
                  <p className="muted" style={{ fontSize: 13.5, marginTop: 2 }}><b>{STAFF_ROLES[r].desc}.</b> {STAFF_ROLES[r].effect}.</p>
                </div>
                <Btn variant={cur ? 'sm' : 'sm primary'} onClick={() => setOpenRole(open ? null : r)}>
                  {open ? 'Bewerber schließen' : cur ? `Ersetzen (${market.length})` : `Bewerber ansehen (${market.length})`}
                </Btn>
              </div>
              {cur && (
                <div className="row between" style={{ gap: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--panel-2)' }}>
                  <div style={{ minWidth: 0 }}>
                    <b>{cur.name}</b> <span className="muted" style={{ fontSize: 13 }}>· {cur.trait ?? cur.country}</span>
                    <div className="muted" style={{ fontSize: 12.5 }}>Gehalt <Money v={cur.salary} />/Rennen</div>
                  </div>
                  <div style={{ width: 140 }}>
                    <div className="row between" style={{ fontSize: 12.5 }}><span className="muted">Können</span><b>{cur.skill}</b></div>
                    <Bar value={cur.skill} />
                  </div>
                  <Btn variant="sm danger" onClick={() => update((s) => fireStaff(s, r))}>Entlassen (<Money v={cur.salary * 2} compact />)</Btn>
                </div>
              )}
              {open && (
                <div className="stack" style={{ gap: 6 }}>
                  <div className="eyebrow">Bewerber</div>
                  {market.map((st) => (
                    <div key={st.id} className="row between" style={{ fontSize: 14, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <b>{st.name}</b> <span className="muted">· Können {st.skill}{st.trait ? ` · ${st.trait}` : ''}</span>
                        <div className="muted" style={{ fontSize: 12.5 }}><Money v={st.salary} />/Rennen · Antrittsgeld <Money v={st.salary * 2} compact /></div>
                      </div>
                      <Btn variant={cur && cur.skill >= st.skill ? 'sm' : 'sm primary'} disabled={g.money < st.salary * 2} onClick={() => { update((s) => hireStaff(s, st.id)); setOpenRole(null); }}>
                        {cur ? 'Ersetzen' : 'Einstellen'}
                      </Btn>
                    </div>
                  ))}
                  {market.length === 0 && <span className="muted">Aktuell keine Bewerber. Der Markt erneuert sich nach den Rennen.</span>}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
