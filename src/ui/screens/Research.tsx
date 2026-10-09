import { useState } from 'react';
import { useLoadedGame } from '../store';
import { Bar, Btn, Money } from '../components/common';
import { StationIntro, SubTabs } from '../components/Station';
import { RESEARCH, RESEARCH_BRANCHES, RESEARCH_BY_ID, STAT_LABELS, type ResearchNode } from '../../data/catalog';
import { devSlots, researchCost, researchTime } from '../../game/carModel';
import { startResearch } from '../../game/state';
import type { CarStats } from '../../types';
import { lazyRecord, t, tp, tx } from '../../i18n';

function effectText(r: ResearchNode) {
  const parts: string[] = [];
  if (r.stats) for (const [k, v] of Object.entries(r.stats)) parts.push(`+${v} ${STAT_LABELS[k as keyof CarStats]}`);
  if (r.fuelSave) parts.push(t('research.eff.fuel', { p: r.fuelSave }));
  if (r.pitBonus) parts.push(t('research.eff.pit', { x: r.pitBonus }));
  if (r.stability) parts.push(t('research.eff.stability'));
  if (r.grip) parts.push(t('research.eff.grip', { x: r.grip * 100 }));
  return parts.join(' · ');
}

const BRANCH_HINT: Record<ResearchNode['branch'], string> = lazyRecord('research.branchHint', ['engine', 'aero', 'chassis', 'tyres', 'pit'] as const);

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
        lead={t('research.intro.lead')}
        items={[
          { title: t('research.intro.branchTitle'), text: t('research.intro.branchText') },
          { title: t('research.intro.startTitle'), text: t('research.intro.startText') },
          { title: t('research.intro.orderTitle'), text: t('research.intro.orderText') },
          { title: t('research.intro.fasterTitle'), text: t('research.intro.fasterText') },
        ]}
        tip={t('research.intro.tip')}
      />

      <div className="grid g3 keep">
        <div className="card stat-tile">
          <span className="eyebrow">{t('research.tile.progress')}</span>
          <span className="big-num">{done}<span className="muted" style={{ fontSize: 18 }}>/{RESEARCH.length}</span></span>
          <Bar value={done} max={RESEARCH.length} />
        </div>
        <div className="card stat-tile">
          <span className="eyebrow">{t('research.tile.running')}</span>
          <span className="big-num">{active.length}/{slots}</span>
          <span className="sub">{t('research.tile.runningSub')}</span>
        </div>
        <div className="card stack" style={{ gap: 6 }}>
          <span className="eyebrow">{t('research.tile.active')}</span>
          {active.length === 0 && <span className="muted">{t('research.tile.noneActive')}</span>}
          {active.map((d) => (
            <div key={d.id} className="stack" style={{ gap: 4 }}>
              <div className="row between" style={{ fontSize: 14 }}>
                <b>{tx(d.label)}</b>
                <span className="muted">{tp('research.remaining', d.remaining)}</span>
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
                    {isDone && <span className="pill good">{t('research.done')}</span>}
                    {dev && <span className="pill team">{t('research.inProgress')}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{r.desc}</div>
                  <div style={{ fontSize: 13.5, marginTop: 2 }}>{t('research.gives')} <b>{effectText(r)}</b></div>
                  {!prereqOk && !isDone && <div className="warn" style={{ fontSize: 13, marginTop: 2 }}>{t('research.requiresFirst', { list: r.requires.map((q) => RESEARCH_BY_ID[q].name).join(', ') })}</div>}
                  {dev && (
                    <div style={{ marginTop: 6, maxWidth: 320 }}>
                      <Bar value={dev.total - dev.remaining} max={dev.total} />
                      <span className="muted" style={{ fontSize: 12 }}>{tp('research.remaining', dev.remaining)}</span>
                    </div>
                  )}
                </div>
                {!isDone && !dev && (
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end', flexShrink: 0 }}>
                    <Btn variant="primary sm" disabled={!prereqOk || active.length >= slots || g.money < cost} onClick={() => update((s) => startResearch(s, r.id))}>
                      {t('research.develop')}
                    </Btn>
                    <span className="muted" style={{ fontSize: 12.5 }}><Money v={cost} compact /> · {tp('research.races', time)}</span>
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
