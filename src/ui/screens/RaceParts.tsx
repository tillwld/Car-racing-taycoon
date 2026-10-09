// Gemeinsame Bausteine der Renn-Stationen: Streckenmerkmale, Wetterprognose und die schmale Streckenzeile
import { useMemo } from 'react';
import { FlagStrip, WeatherIcon } from '../components/common';
import { TRACK_BY_ID } from '../../data/tracks';
import { WEATHER_LABELS } from '../../data/catalog';
import type { GameState } from '../../types';
import { trackGeometry } from '../../game/weekend';
import { trackMetrics } from '../../race/trackGeometry';
import { t, tp, useLang } from '../../i18n';

export function TrackTraits({ trackId }: { trackId: string }) {
  useLang();
  const trk = TRACK_BY_ID[trackId];
  const tm = useMemo(() => trackMetrics(trackGeometry(trk)), [trackId]);
  const chips: { l: string; tone?: string }[] = [];
  chips.push({ l: t('raceparts.traits.length', { km: trackGeometry(trk).length / 1000 }) });
  if (tm.straightPct > 0.74) chips.push({ l: t('raceparts.traits.straights') });
  if (tm.minR < 18) chips.push({ l: t('raceparts.traits.tight') });
  if (tm.corners >= 14) chips.push({ l: t('raceparts.traits.manyCorners') });
  if (trk.ideal.wing >= 60) chips.push({ l: t('raceparts.traits.fast') });
  if (trk.tyreWear >= 1.15) chips.push({ l: t('raceparts.traits.tyreWear'), tone: 'warn' });
  if (trk.brakeWear >= 1.2) chips.push({ l: t('raceparts.traits.brakeWear'), tone: 'warn' });
  if (trk.street) chips.push({ l: t('raceparts.traits.street'), tone: 'bad' });
  return (
    <div className="row" style={{ gap: 6 }}>
      {chips.map((c) => (
        <span key={c.l} className={`pill ${c.tone ?? ''}`}>{c.l}</span>
      ))}
    </div>
  );
}

export function Forecast({ w }: { w: NonNullable<GameState['weekend']> }) {
  useLang();
  const segs = w.forecast;
  const label = (at: number) => t(at === 0 ? 'raceparts.forecast.start' : at < 0.4 ? 'raceparts.forecast.firstThird' : at < 0.7 ? 'raceparts.forecast.mid' : 'raceparts.forecast.final');
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row between">
        <span className="eyebrow">{t('raceparts.forecast.title')}</span>
        <span className="muted" style={{ fontSize: 12 }}>{t('raceparts.forecast.accuracy', { v: w.forecastConfidence })}</span>
      </div>
      <div className="weather-row">
        {segs.map((s, i) => (
          <div key={i} className="weather-seg">
            <WeatherIcon kind={s.kind} />
            <b style={{ fontSize: 12 }}>{WEATHER_LABELS[s.kind]}</b>
            <span className="muted">{label(s.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Schmale Kopfzeile für Prüfstand, Reifenlager und Boxenmauer: für welche Strecke planst du gerade? */
export function TrackStrip({ w, weather }: { w: NonNullable<GameState['weekend']>; weather?: boolean }) {
  useLang();
  const trk = TRACK_BY_ID[w.trackId];
  return (
    <section className="card stack track-strip" style={{ gap: 8 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <FlagStrip colors={trk.flag} />
          <div>
            <span className="eyebrow">{t('raceparts.strip.planning')}</span>
            <h3 style={{ margin: 0 }}>{tp('raceparts.strip.title', w.laps, { name: trk.name })}</h3>
          </div>
        </div>
      </div>
      <TrackTraits trackId={trk.id} />
      {weather && <Forecast w={w} />}
    </section>
  );
}
