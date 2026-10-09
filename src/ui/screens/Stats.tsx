import { useLoadedGame } from '../store';
import { StationIntro } from '../components/Station';
import { Icon, Money } from '../components/common';
import { ACHIEVEMENTS, TIERS } from '../../data/catalog';
import { TRACKS } from '../../data/tracks';
import { lapTime } from '../../game/util';
import { fmtNum, t, useLang } from '../../i18n';

export default function StatsScreen() {
  const { game: g } = useLoadedGame();
  useLang();
  const s = g.stats;
  const tiles: [string, string | number][] = [
    [t('stats.tile.races'), s.races],
    [t('stats.tile.racesDriven'), s.racesDriven],
    [t('stats.tile.wins'), s.wins],
    [t('stats.tile.podiums'), s.podiums],
    [t('stats.tile.poles'), s.poles],
    [t('stats.tile.fastestLaps'), s.fastestLaps],
    [t('stats.tile.points'), s.points],
    [t('stats.tile.titles'), s.titles],
    [t('stats.tile.teamTitles'), s.teamTitles],
    [t('stats.tile.dnfs'), s.dnfs],
    [t('stats.tile.overtakes'), s.overtakes],
    [t('stats.tile.pitStops'), s.pitStops],
    [t('stats.tile.bestPitStop'), s.bestPitStop ? t('stats.seconds', { v: s.bestPitStop }) : '–'],
    [t('stats.tile.km'), fmtNum(Math.round(s.km))],
    [t('stats.tile.upgrades'), s.upgradesDone],
    [t('stats.tile.research'), s.researchDone],
  ];
  const unlocked = ACHIEVEMENTS.filter((a) => g.achievements[a.id]).length;
  return (
    <>
      <StationIntro
        id="stats"
        icon="stats"
        lead={t('stats.intro.lead')}
        items={[
          { title: t('stats.intro.numbersTitle'), text: t('stats.intro.numbersText') },
          { title: t('stats.intro.timesTitle'), text: t('stats.intro.timesText') },
          { title: t('stats.intro.achTitle'), text: t('stats.intro.achText') },
        ]}
      />

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
          <div className="card-h"><h3>{t('stats.finances')}</h3></div>
          <div className="stack" style={{ gap: 6, fontSize: 14 }}>
            <div className="row between"><span className="muted">{t('stats.income')}</span><Money v={s.income} /></div>
            <div className="row between"><span className="muted">{t('stats.expenses')}</span><Money v={-s.expenses} /></div>
            <div className="row between"><b>{t('stats.balance')}</b><Money v={s.income - s.expenses} sign /></div>
          </div>
          <div className="sep" style={{ margin: '14px 0' }} />
          <div className="card-h"><h3>{t('stats.bestLaps')}</h3></div>
          <div className="stack" style={{ gap: 4, fontSize: 14 }}>
            {TRACKS.map((trk) => (
              <div key={trk.id} className="row between">
                <span>{trk.name}</span>
                <span className="num">{lapTime(s.bestLaps[trk.id])}</span>
              </div>
            ))}
          </div>
          {g.history.length > 0 && (
            <>
              <div className="sep" style={{ margin: '14px 0' }} />
              <div className="card-h"><h3>{t('stats.archive')}</h3></div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>{t('stats.col.season')}</th><th>{t('stats.col.tier')}</th><th className="num">{t('stats.col.team')}</th><th className="num">{t('stats.col.driver')}</th><th className="num">{t('stats.col.points')}</th><th>{t('stats.col.champion')}</th></tr></thead>
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
            <h3>{t('stats.achievements')}</h3>
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
