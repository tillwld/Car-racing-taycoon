import type { Screen } from '../../App';
import { useLoadedGame } from '../store';
import { Btn, FlagStrip, TrackShape } from '../components/common';
import { TRACK_BY_ID } from '../../data/tracks';
import { lapTime } from '../../game/util';

export default function Calendar({ go }: { go: (s: Screen) => void }) {
  const { game: g } = useLoadedGame();
  return (
    <section className="card">
      <div className="card-h">
        <h3>Saison {g.season}</h3>
        <span className="muted" style={{ fontSize: 13 }}>{g.calendar.length} Rennwochenenden mit Training, Qualifying und Rennen</span>
      </div>
      <div className="timeline">
        {g.calendar.map((id, i) => {
          const t = TRACK_BY_ID[id];
          const res = g.results.find((r) => r.round === i);
          const mine = res?.entries.filter((e) => e.teamId === 'player') ?? [];
          const next = i === g.round;
          return (
            <div key={i} className={`round ${next ? 'next' : ''} ${res ? 'done' : ''}`}>
              <span className="pos">{i + 1}</span>
              <TrackShape trackId={id} showStart={false} />
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <FlagStrip colors={t.flag} />
                  <b>{t.name}</b>
                  <span className="muted" style={{ fontSize: 13 }}>{t.country}</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {res
                    ? `Ergebnis: ${mine.map((e) => (e.dnf ? 'Ausfall' : `P${e.pos}`)).join(' / ')}`
                    : `Regenrisiko ${Math.round(t.rainChance * 100)} % · Reifenverschleiß ${t.tyreWear >= 1.15 ? 'hoch' : t.tyreWear <= 0.85 ? 'niedrig' : 'mittel'}`}
                  {g.stats.bestLaps[id] ? ` · Deine Bestzeit ${lapTime(g.stats.bestLaps[id])}` : ''}
                </div>
              </div>
              {next ? (
                <Btn variant="primary sm" onClick={() => go('race')}>Los</Btn>
              ) : res ? (
                <span className="pill good">gefahren</span>
              ) : (
                <span className="pill">offen</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
