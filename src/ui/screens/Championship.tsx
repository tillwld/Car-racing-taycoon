import { useState } from 'react';
import { useLoadedGame } from '../store';
import { Seg } from '../components/common';
import { computeStandings, teamById } from '../../game/season';
import { TRACK_BY_ID } from '../../data/tracks';
import { TIERS } from '../../data/catalog';
import { lapTime } from '../../game/util';
import { shortName } from '../../game/weekend';

export default function Championship() {
  const { game: g } = useLoadedGame();
  const [tab, setTab] = useState<'drivers' | 'teams' | 'results'>('drivers');
  const st = computeStandings(g);
  const leaderPts = st.drivers[0]?.points ?? 0;
  const remaining = g.calendar.length - g.results.length;
  return (
    <>
      <section className="card row between">
        <div>
          <div className="eyebrow">{TIERS[g.tier].name} · Saison {g.season}</div>
          <h2>{g.results.length} von {g.calendar.length} Rennen gefahren</h2>
          <p className="muted" style={{ fontSize: 14 }}>Punkte: 25-18-15-12-10-8-6-4-2-1, plus 1 Punkt für die schnellste Runde in den Top 10. Noch {remaining * 26} Punkte pro Fahrer zu vergeben.</p>
        </div>
        <Seg value={tab} onChange={setTab} options={[{ v: 'drivers', l: 'Fahrer' }, { v: 'teams', l: 'Teams' }, { v: 'results', l: 'Rennen' }]} />
      </section>

      {tab === 'drivers' && (
        <section className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Fahrer</th>
                  <th className="num">Pkt</th>
                  <th className="num">Abst.</th>
                  <th className="num">Siege</th>
                  <th className="num">Podien</th>
                  <th className="num">Poles</th>
                  <th className="num">SR</th>
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
                            {r === undefined || r === null ? '' : r === 0 ? 'A' : r}
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
                <tr><th>Pos</th><th>Team</th><th className="num">Punkte</th><th className="num">Siege</th><th className="num">Podien</th><th>Fahrer</th></tr>
              </thead>
              <tbody>
                {st.teams.map((t, i) => {
                  const team = teamById(g, t.teamId);
                  return (
                    <tr key={t.teamId} className={t.teamId === 'player' ? 'me' : ''}>
                      <td className="pos">{i + 1}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><span className="team-chip" style={{ background: t.color }} />{t.name}</td>
                      <td className="num"><b>{t.points}</b></td>
                      <td className="num">{t.wins || ''}</td>
                      <td className="num">{t.podiums || ''}</td>
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
          {g.results.length === 0 && <p className="muted">Noch keine Rennen gefahren.</p>}
          {g.results.map((r) => {
            const t = TRACK_BY_ID[r.trackId];
            const fast = r.entries.find((e) => e.fastest);
            return (
              <div key={r.round} className="card stack" style={{ gap: 6 }}>
                <div className="row between">
                  <b>R{r.round + 1} · {t.name}</b>
                  {r.playerDrove && <span className="pill team">selbst gefahren</span>}
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
                    <span className="pos" style={{ width: 22 }}>{e.dnf ? 'A' : e.pos}</span>
                    {g.drivers[e.driverId] ? shortName(g.drivers[e.driverId]) : ''} <span className="muted" style={{ fontWeight: 400 }}>· Start P{e.grid}</span>
                  </div>
                ))}
                {fast && <span className="purple" style={{ fontSize: 13 }}>Schnellste Runde: {g.drivers[fast.driverId]?.name} {lapTime(fast.bestLap)}</span>}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
