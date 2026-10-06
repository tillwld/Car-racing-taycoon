import { useState } from 'react';
import { useLoadedGame } from '../store';
import { Bar, Btn, Money } from '../components/common';
import { StationIntro, SubTabs } from '../components/Station';
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

const BRANCH_HINT: Record<ResearchNode['branch'], string> = {
  engine: 'Mehr Leistung und Beschleunigung, geringerer Spritverbrauch.',
  aero: 'Mehr Abtrieb und Topspeed: schneller in Kurven und auf Geraden.',
  chassis: 'Besseres Handling und Bremsen: das Auto liegt ruhiger und lenkt präziser.',
  tyres: 'Mehr Grip, weniger Verschleiß und weniger Fahrfehler.',
  pit: 'Schnellere Boxenstopps und weniger Fehler am Rad.',
};

export default function Research() {
  const { game: g, update } = useLoadedGame();
  const [branch, setBranch] = useState<ResearchNode['branch']>('engine');
  const active = g.developments.filter((d) => d.kind === 'research');
  const slots = devSlots(g).research;
  const done = RESEARCH.filter((r) => g.research[r.id]).length;
  const branches = Object.keys(RESEARCH_BRANCHES) as ResearchNode['branch'][];

  return (
    <>
      <StationIntro
        id="lab"
        icon="research"
        lead="Im Labor entwickelst du neue Technik. Sie wirkt dauerhaft, auch wenn du später das Chassis wechselst."
        items={[
          { title: 'Einen Zweig wählen', text: 'Es gibt fünf Zweige: Motor, Aerodynamik, Fahrwerk, Reifen und Boxencrew. Wähle oben den Zweig, den du verbessern willst.' },
          { title: 'Projekt starten', text: 'Jedes Projekt kostet Geld und braucht Zeit, gemessen in Rennen. Es läuft im Hintergrund weiter.' },
          { title: 'Reihenfolge beachten', text: 'Manche Projekte setzen andere voraus. Gesperrte Projekte siehst du ausgegraut, mit dem Hinweis, was fehlt.' },
          { title: 'Schneller forschen', text: 'Ein Datenanalyst im Personalbüro macht Forschung günstiger und schneller.' },
        ]}
        tip="Tipp: Starte immer ein Projekt, bevor du ein Rennen fährst. Die Zeit läuft nur in Rennen."
      />

      <div className="grid g3 keep">
        <div className="card stat-tile">
          <span className="eyebrow">Fortschritt</span>
          <span className="big-num">{done}<span className="muted" style={{ fontSize: 18 }}>/{RESEARCH.length}</span></span>
          <Bar value={done} max={RESEARCH.length} />
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">Laufende Projekte</span>
          <span className="big-num">{active.length}/{slots}</span>
          <span className="sub">gleichzeitig möglich (mehr ab Werksfabrik)</span>
        </div>
        <div className="card stack" style={{ gap: 6 }}>
          <span className="eyebrow">Gerade in Arbeit</span>
          {active.length === 0 && <span className="muted">Kein Projekt aktiv.</span>}
          {active.map((d) => (
            <div key={d.id} className="stack" style={{ gap: 4 }}>
              <div className="row between" style={{ fontSize: 14 }}>
                <b>{d.label}</b>
                <span className="muted">noch {d.remaining} Rennen</span>
              </div>
              <Bar value={d.total - d.remaining} max={d.total} />
            </div>
          ))}
        </div>
      </div>

      <SubTabs
        value={branch}
        onChange={setBranch}
        tabs={branches.map((b) => ({
          v: b,
          l: RESEARCH_BRANCHES[b],
          hint: BRANCH_HINT[b],
          badge: `${RESEARCH.filter((r) => r.branch === b && g.research[r.id]).length}/${RESEARCH.filter((r) => r.branch === b).length}`,
        }))}
      />

      <section className="stack" style={{ gap: 8 }}>
        {RESEARCH.filter((r) => r.branch === branch).map((r) => {
          const isDone = !!g.research[r.id];
          const dev = active.find((d) => d.target === r.id);
          const prereqOk = r.requires.every((q) => g.research[q]);
          const cost = researchCost(g, r.cost);
          const time = researchTime(g, r.time);
          return (
            <div key={r.id} className={`card rnode-card ${isDone ? 'done' : ''}`} style={{ opacity: !prereqOk && !isDone ? 0.6 : 1 }}>
              <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <b style={{ fontSize: 16 }}>{r.name}</b>
                    {isDone && <span className="pill good">fertig</span>}
                    {dev && <span className="pill team">in Arbeit</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{r.desc}</div>
                  <div style={{ fontSize: 13.5, marginTop: 2 }}>Bringt: <b>{effectText(r)}</b></div>
                  {!prereqOk && !isDone && <div className="warn" style={{ fontSize: 13, marginTop: 2 }}>Zuerst nötig: {r.requires.map((q) => RESEARCH_BY_ID[q].name).join(', ')}</div>}
                  {dev && (
                    <div style={{ marginTop: 6, maxWidth: 320 }}>
                      <Bar value={dev.total - dev.remaining} max={dev.total} />
                      <span className="muted" style={{ fontSize: 12 }}>noch {dev.remaining} Rennen</span>
                    </div>
                  )}
                </div>
                {!isDone && !dev && (
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end', flexShrink: 0 }}>
                    <Btn variant="primary sm" disabled={!prereqOk || active.length >= slots || g.money < cost} onClick={() => update((s) => startResearch(s, r.id))}>
                      Entwickeln
                    </Btn>
                    <span className="muted" style={{ fontSize: 12.5 }}><Money v={cost} compact /> · {time} {time === 1 ? 'Rennen' : 'Rennen'}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
