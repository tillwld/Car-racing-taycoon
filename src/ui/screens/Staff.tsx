import { useLoadedGame } from '../store';
import { Bar, Btn, Money } from '../components/common';
import { STAFF_KEYS, STAFF_ROLES } from '../../data/catalog';
import { fireStaff, hireStaff } from '../../game/state';
import { pitCrewTime } from '../../game/carModel';

export default function StaffScreen() {
  const { game: g, update } = useLoadedGame();
  const crew = pitCrewTime(g);
  const total = Object.values(g.staff).reduce((a, s) => a + (s?.salary ?? 0), 0);
  return (
    <>
      <section className="grid g3">
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
          <span className="eyebrow">Besetzt</span>
          <span className="big-num">{Object.keys(g.staff).length}/{STAFF_KEYS.length}</span>
        </div>
      </section>
      <section className="grid g2">
        {STAFF_KEYS.map((r) => {
          const cur = g.staff[r];
          const market = g.staffMarket.filter((x) => x.role === r).sort((a, b) => b.skill - a.skill);
          return (
            <div key={r} className="card stack" style={{ gap: 10 }}>
              <div className="card-h" style={{ marginBottom: 0 }}>
                <div>
                  <div className="eyebrow">{STAFF_ROLES[r].desc}</div>
                  <h3>{STAFF_ROLES[r].label}</h3>
                </div>
                {cur ? <span className="pill good">besetzt</span> : <span className="pill warn">unbesetzt</span>}
              </div>
              <p className="muted" style={{ fontSize: 13 }}>{STAFF_ROLES[r].effect}</p>
              {cur && (
                <div className="stack" style={{ gap: 6, padding: 10, borderRadius: 8, background: 'var(--panel-2)' }}>
                  <div className="row between">
                    <b>{cur.name}</b>
                    <span className="muted" style={{ fontSize: 13 }}>{cur.trait ?? cur.country}</span>
                  </div>
                  <div className="statline">
                    <span className="muted">Können</span>
                    <Bar value={cur.skill} />
                    <span className="v">{cur.skill}</span>
                  </div>
                  <div className="row between" style={{ fontSize: 13 }}>
                    <span className="muted">Gehalt <Money v={cur.salary} />/R</span>
                    <Btn variant="sm danger" onClick={() => update((s) => fireStaff(s, r))}>Entlassen (<Money v={cur.salary * 2} compact />)</Btn>
                  </div>
                </div>
              )}
              <div className="eyebrow">Bewerber</div>
              {market.map((st) => (
                <div key={st.id} className="row between" style={{ fontSize: 14, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <b>{st.name}</b> <span className="muted">· Können {st.skill}{st.trait ? ` · ${st.trait}` : ''}</span>
                    <div className="muted" style={{ fontSize: 12.5 }}><Money v={st.salary} />/R · Antritt <Money v={st.salary * 2} compact /></div>
                  </div>
                  <Btn variant={cur && cur.skill >= st.skill ? 'sm' : 'sm primary'} disabled={g.money < st.salary * 2} onClick={() => update((s) => hireStaff(s, st.id))}>
                    {cur ? 'Ersetzen' : 'Einstellen'}
                  </Btn>
                </div>
              ))}
              {market.length === 0 && <span className="muted">Aktuell keine Bewerber. Der Markt erneuert sich nach den Rennen.</span>}
            </div>
          );
        })}
      </section>
    </>
  );
}
