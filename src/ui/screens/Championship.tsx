import { useState } from 'react';
import { useLoadedGame } from '../store';
import { StationIntro } from '../components/Station';
import { Seg } from '../components/common';
import { computeStandings, teamById } from '../../game/season';
import { TRACK_BY_ID } from '../../data/tracks';
import { TIERS } from '../../data/catalog';
import { lapTime } from '../../game/util';
import { shortName } from '../../game/weekend';
import { t, tx, useLang } from '../../i18n';

export default function Championship() {
  const { game: g } = useLoadedGame();
  useLang();
  const [tab, setTab] = useState<'drivers' | 'teams' | 'results'>('drivers');
  const st = computeStandings(g);
  const leaderPts = st.drivers[0]?.points ?? 0;
  const remaining = g.calendar.length - g.results.length;
  return (
    <>
      <StationIntro
        id="championship"
        icon="championship"
        lead={t('champ.intro.lead')}
        items={[
          { title: t('champ.intro.driversTitle'), text: t('champ.intro.driversText') },
          { title: t('champ.intro.teamsTitle'), text: t('champ.intro.teamsText') },
          { title: t('champ.intro.resultsTitle'), text: t('champ.intro.resultsText') },
        ]}
        tip={t('champ.intro.tip')}
      />

      <section className="card row between">
        <div>
          <div className="eyebrow">{t('champ.eyebrow', { tier: TIERS[g.tier].name, season: g.season })}</div>
          <h2>{t('champ.progress', { done: g.results.length, total: g.calendar.length })}</h2>
          <p className="muted" style={{ fontSize: 14 }}>{t('champ.pointsInfo', { pts: remaining * 26 })}</p>
        </div>
        <Seg value={tab} onChange={setTab} options={[{ v: 'drivers', l: t('champ.tab.drivers') }, { v: 'teams', l: t('champ.tab.teams') }, { v: 'results', l: t('champ.tab.results') }]} />
      </section>

      {tab === 'drivers' && (
        <section className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('champ.col.pos')}</th>
                  <th>{t('champ.col.driver')}</th>
                  <th className="num">{t('champ.col.points')}</th>
                  <th className="num">{t('champ.col.gap')}</th>
                  <th className="num">{t('champ.col.wins')}</th>
                  <th className="num">{t('champ.col.podiums')}</th>
                  <th className="num">{t('champ.col.poles')}</th>
                  <th className="num">{t('champ.col.fastest')}</th>
                  {g.calendar.map((id, i) => (
                    <th key={i} className="num" title={TRACK_BY_ID[id].name}>{TRACK_BY_ID[id].short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {st.drivers.map((d, i) => {
                  const team = teamById(g, d.teamId);
                  return (
                    <tr key={d.driverId} className={d.teamId === 'player' ? 'me' : ''}>
                      <td className="pos">{i + 1}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="team-chip" style={{ background: team?.color ?? '#777' }} />
                        {d.name} <span className="muted" style={{ fontSize: 12 }}>{team?.short}</span>
                      </td>
                      <td className="num"><b>{d.points}</b></td>
                      <td className="num muted">{i === 0 ? '' : `−${leaderPts - d.points}`}</td>
                      <td className="num">{d.wins || ''}</td>
                      <td className="num">{d.podiums || ''}</td>
                      <td className="num">{d.poles || ''}</td>
                      <td className="num">{d.fastest || ''}</td>
                      {g.calendar.map((_, ri) => {
                        const r = d.results[ri];
                        return (
                          <td key={ri} className="num" style={{ color: r === 1 ? 'var(--warn)' : r && r <= 3 ? 'var(--text)' : 'var(--muted)' }}>
                            {r === undefined || r === null ? '' : r === 0 ? t('champ.dnfMark') : r}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'teams' && (
        <section className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>{t('champ.col.pos')}</th><th>{t('champ.col.team')}</th><th className="num">{t('champ.col.teamPoints')}</th><th className="num">{t('champ.col.wins')}</th><th className="num">{t('champ.col.podiums')}</th><th>{t('champ.col.drivers')}</th></tr>
              </thead>
              <tbody>
                {st.teams.map((tm, i) => {
                  const team = teamById(g, tm.teamId);
                  return (
                    <tr key={tm.teamId} className={tm.teamId === 'player' ? 'me' : ''}>
                      <td className="pos">{i + 1}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><span className="team-chip" style={{ background: tm.color }} />{tm.name}</td>
                      <td className="num"><b>{tm.points}</b></td>
                      <td className="num">{tm.wins || ''}</td>
                      <td className="num">{tm.podiums || ''}</td>
                      <td className="muted" style={{ fontSize: 13 }}>{team?.driverIds.map((id) => g.drivers[id]?.name).filter(Boolean).join(', ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'results' && (
        <section className="grid gauto">
          {g.results.length === 0 && <p className="muted">{t('champ.noRaces')}</p>}
          {g.results.map((r) => {
            const trk = TRACK_BY_ID[r.trackId];
            const fast = r.entries.find((e) => e.fastest);
            return (
              <div key={r.round} className="card stack" style={{ gap: 6 }}>
                <div className="row between">
                  <b>R{r.round + 1} · {trk.name}</b>
                  {r.playerDrove && <span className="pill team">{t('champ.drovePill')}</span>}
                </div>
                {r.entries.slice(0, 3).map((e) => {
                  const d = g.drivers[e.driverId];
                  const team = teamById(g, e.teamId);
                  return (
                    <div key={e.driverId} className="row" style={{ fontSize: 14, gap: 8 }}>
                      <span className="pos" style={{ width: 22 }}>{e.pos}</span>
                      <span className="team-chip" style={{ background: team?.color, marginRight: 0 }} />
                      {d?.name ?? '–'}
                    </div>
                  );
                })}
                {r.entries.filter((e) => e.teamId === 'player').map((e) => (
                  <div key={e.driverId} className="row" style={{ fontSize: 14, gap: 8, fontWeight: 600 }}>
                    <span className="pos" style={{ width: 22 }} title={e.dnf ? tx(e.dnfReason) || undefined : undefined}>{e.dnf ? t('champ.dnfMark') : e.pos}</span>
                    {g.drivers[e.driverId] ? shortName(g.drivers[e.driverId]) : ''} <span className="muted" style={{ fontWeight: 400 }}>· {t('champ.startPos', { grid: e.grid })}</span>
                  </div>
                ))}
                {fast && <span className="purple" style={{ fontSize: 13 }}>{t('champ.fastestLap', { name: g.drivers[fast.driverId]?.name ?? '–', time: lapTime(fast.bestLap) })}</span>}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
