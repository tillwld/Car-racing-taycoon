import { useLoadedGame } from '../store';
import { Icon, Money } from '../components/common';
import { ACHIEVEMENTS, TIERS } from '../../data/catalog';
import { TRACKS } from '../../data/tracks';
import { lapTime } from '../../game/util';

export default function StatsScreen() {
  const { game: g } = useLoadedGame();
  const s = g.stats;
  const tiles: [string, string | number][] = [
    ['Rennen', s.races],
    ['Selbst gefahren', s.racesDriven],
    ['Siege', s.wins],
    ['Podien', s.podiums],
    ['Pole Positions', s.poles],
    ['Schnellste Runden', s.fastestLaps],
    ['Punkte', s.points],
    ['Fahrertitel', s.titles],
    ['Teamtitel', s.teamTitles],
    ['Ausfälle', s.dnfs],
    ['Überholmanöver', s.overtakes],
    ['Boxenstopps', s.pitStops],
    ['Bester Stopp', s.bestPitStop ? `${s.bestPitStop.toFixed(1)} s` : '–'],
    ['Gefahrene km', Math.round(s.km).toLocaleString('de-DE')],
    ['Upgrades', s.upgradesDone],
    ['Forschung', s.researchDone],
  ];
  const unlocked = ACHIEVEMENTS.filter((a) => g.achievements[a.id]).length;
  return (
    <>
      <section className="grid g4 keep">
        {tiles.map(([l, v]) => (
          <div key={l} className="card stat-tile">
            <span className="eyebrow">{l}</span>
            <span className="big-num" style={{ fontSize: 28 }}>{v}</span>
          </div>
        ))}
      </section>
      <section className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>Finanzen gesamt</h3></div>
          <div className="stack" style={{ gap: 6, fontSize: 14 }}>
            <div className="row between"><span className="muted">Einnahmen</span><Money v={s.income} /></div>
            <div className="row between"><span className="muted">Ausgaben</span><Money v={-s.expenses} /></div>
            <div className="row between"><b>Bilanz</b><Money v={s.income - s.expenses} sign /></div>
          </div>
          <div className="sep" style={{ margin: '14px 0' }} />
          <div className="card-h"><h3>Beste Rundenzeiten</h3></div>
          <div className="stack" style={{ gap: 4, fontSize: 14 }}>
            {TRACKS.map((t) => (
              <div key={t.id} className="row between">
                <span>{t.name}</span>
                <span className="num">{lapTime(s.bestLaps[t.id])}</span>
              </div>
            ))}
          </div>
          {g.history.length > 0 && (
            <>
              <div className="sep" style={{ margin: '14px 0' }} />
              <div className="card-h"><h3>Saisonarchiv</h3></div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Saison</th><th>Klasse</th><th className="num">Team</th><th className="num">Fahrer</th><th className="num">Punkte</th><th>Meister</th></tr></thead>
                  <tbody>
                    {g.history.map((h) => (
                      <tr key={h.season}>
                        <td>{h.season}</td>
                        <td>{TIERS[h.tier].short}</td>
                        <td className="num">P{h.teamPos}</td>
                        <td className="num">P{h.driverPos}</td>
                        <td className="num">{h.points}</td>
                        <td className="muted">{h.championDriver}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Erfolge</h3>
            <span className="muted">{unlocked}/{ACHIEVEMENTS.length}</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {ACHIEVEMENTS.map((a) => {
              const on = !!g.achievements[a.id];
              return (
                <div key={a.id} className={`ach ${on ? 'on' : ''}`}>
                  <span className="medal"><Icon name={on ? 'medal' : 'flag'} size={20} /></span>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 14 }}>{a.name}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{a.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
