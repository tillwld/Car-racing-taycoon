import type { Screen } from '../../App';
import { useLoadedGame } from '../store';
import { StationIntro } from '../components/Station';
import { Btn, FlagStrip, TrackShape } from '../components/common';
import { TRACK_BY_ID } from '../../data/tracks';
import { lapTime } from '../../game/util';
import { t, tp, useLang } from '../../i18n';

export default function Calendar({ go }: { go: (s: Screen) => void }) {
  const { game: g } = useLoadedGame();
  useLang();
  return (
    <>
    <StationIntro
      id="calendar"
      icon="calendar"
      lead={t('cal.intro.lead')}
      items={[
        { title: t('cal.intro.nextTitle'), text: t('cal.intro.nextText') },
        { title: t('cal.intro.resultsTitle'), text: t('cal.intro.resultsText') },
        { title: t('cal.intro.tracksTitle'), text: t('cal.intro.tracksText') },
      ]}
    />
    <section className="card">
      <div className="card-h">
        <h3>{t('cal.season', { season: g.season })}</h3>
        <span className="muted" style={{ fontSize: 13 }}>{tp('cal.weekends', g.calendar.length)}</span>
      </div>
      <div className="timeline">
        {g.calendar.map((id, i) => {
          const trk = TRACK_BY_ID[id];
          const res = g.results.find((r) => r.round === i);
          const mine = res?.entries.filter((e) => e.teamId === 'player') ?? [];
          const next = i === g.round;
          return (
            <div key={i} className={`round ${next ? 'next' : ''} ${res ? 'done' : ''}`}>
              <span className="pos">{i + 1}</span>
              <TrackShape trackId={id} showStart={false} />
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <FlagStrip colors={trk.flag} />
                  <b>{trk.name}</b>
                  <span className="muted" style={{ fontSize: 13 }}>{trk.country}</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {res
                    ? t('cal.result', { list: mine.map((e) => (e.dnf ? t('cal.dnf') : `P${e.pos}`)).join(' / ') })
                    : t('cal.rainWear', { rain: trk.rainChance, wear: t(trk.tyreWear >= 1.15 ? 'cal.wear.high' : trk.tyreWear <= 0.85 ? 'cal.wear.low' : 'cal.wear.mid') })}
                  {g.stats.bestLaps[id] ? ` · ${t('cal.bestTime', { time: lapTime(g.stats.bestLaps[id]) })}` : ''}
                </div>
              </div>
              {next ? (
                <Btn variant="primary sm" onClick={() => go('race')}>{t('cal.go')}</Btn>
              ) : res ? (
                <span className="pill good">{t('cal.done')}</span>
              ) : (
                <span className="pill">{t('cal.open')}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
    </>
  );
}
