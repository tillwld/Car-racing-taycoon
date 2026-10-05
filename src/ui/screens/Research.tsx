import { useLoadedGame } from '../store';
import { Bar, Btn, Money } from '../components/common';
import { RESEARCH, RESEARCH_BRANCHES, RESEARCH_BY_ID, STAT_LABELS, type ResearchNode } from '../../data/catalog';
import { devSlots, researchCost, researchTime } from '../../game/carModel';
import { startResearch } from '../../game/state';
import type { CarStats } from '../../types';

function effectText(r: ResearchNode) {
  const parts: string[] = [];
  if (r.stats) for (const [k, v] of Object.entries(r.stats)) parts.push(`+${v} ${STAT_LABELS[k as keyof CarStats]}`);
  if (r.fuelSave) parts.push(`−${Math.round(r.fuelSave * 100)} % Verbrauch`);
  if (r.pitBonus) parts.push(`−${r.pitBonus.toLocaleString('de-DE')} s Boxenstopp`);
  if (r.stability) parts.push('weniger Fahrfehler');
  if (r.grip) parts.push(`+${(r.grip * 100).toLocaleString('de-DE')} % Reifengrip`);
  return parts.join(' · ');
}

export default function Research() {
  const { game: g, update } = useLoadedGame();
  const active = g.developments.filter((d) => d.kind === 'research');
  const slots = devSlots(g).research;
  const done = RESEARCH.filter((r) => g.research[r.id]).length;
  const branches = Object.keys(RESEARCH_BRANCHES) as ResearchNode['branch'][];

  return (
    <>
      <section className="grid g3">
        <div className="card stat-tile">
          <span className="eyebrow">Fortschritt</span>
          <span className="big-num">{done}<span className="muted" style={{ fontSize: 18 }}>/{RESEARCH.length}</span></span>
          <Bar value={done} max={RESEARCH.length} />
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Labor</span>
          <span className="big-num">{active.length}/{slots}</span>
          <span className="sub">gleichzeitige Projekte (mehr ab Werksfabrik)</span>
        </div>
        <div className="card stack" style={{ gap: 6 }}>
          <span className="eyebrow">Laufend</span>
          {active.length === 0 && <span className="muted">Kein Projekt aktiv.</span>}
          {active.map((d) => (
            <div key={d.id} className="stack" style={{ gap: 4 }}>
              <div className="row between" style={{ fontSize: 14 }}>
                <b>{d.label}</b>
                <span className="muted">noch {d.remaining} R</span>
              </div>
              <Bar value={d.total - d.remaining} max={d.total} />
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <div className="card-h">
          <h3>Forschungsbaum</h3>
          <span className="muted" style={{ fontSize: 13 }}>Forschung wirkt dauerhaft – auch nach einem Chassiswechsel. Ein guter Datenanalyst macht sie günstiger und schneller.</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {branches.map((b) => (
            <div key={b} className="research-col">
              <div className="eyebrow">{RESEARCH_BRANCHES[b]}</div>
              {RESEARCH.filter((r) => r.branch === b).map((r) => {
                const isDone = !!g.research[r.id];
                const dev = active.find((d) => d.target === r.id);
                const prereqOk = r.requires.every((q) => g.research[q]);
                const cost = researchCost(g, r.cost);
                const time = researchTime(g, r.time);
                return (
                  <div key={r.id} className={`rnode ${isDone ? 'done' : ''} ${!prereqOk && !isDone ? 'locked' : ''} ${dev ? 'active' : ''}`}>
                    <div className="row between">
                      <b>{r.name}</b>
                      {isDone && <span className="pill good">fertig</span>}
                    </div>
                    <span className="muted" style={{ fontSize: 12.5 }}>{r.desc}</span>
                    <span style={{ fontSize: 12.5 }}>{effectText(r)}</span>
                    {!prereqOk && !isDone && <span className="warn" style={{ fontSize: 12 }}>Benötigt: {r.requires.map((q) => RESEARCH_BY_ID[q].name).join(', ')}</span>}
                    {dev && (
                      <>
                        <Bar value={dev.total - dev.remaining} max={dev.total} />
                        <span className="muted" style={{ fontSize: 12 }}>noch {dev.remaining} Rennen</span>
                      </>
                    )}
                    {!isDone && !dev && (
                      <Btn variant="sm" disabled={!prereqOk || active.length >= slots || g.money < cost} onClick={() => update((s) => startResearch(s, r.id))}>
                        <Money v={cost} compact /> · {time} R
                      </Btn>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
