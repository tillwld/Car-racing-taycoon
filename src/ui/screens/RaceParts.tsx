// Gemeinsame Bausteine der Renn-Stationen: Streckenmerkmale, Wetterprognose und die schmale Streckenzeile
import { useMemo } from 'react';
import { FlagStrip, WeatherIcon } from '../components/common';
import { TRACK_BY_ID } from '../../data/tracks';
import { WEATHER_LABELS } from '../../data/catalog';
import type { GameState } from '../../types';
import { trackGeometry } from '../../game/weekend';
import { trackMetrics } from '../../race/trackGeometry';

export function TrackTraits({ trackId }: { trackId: string }) {
  const t = TRACK_BY_ID[trackId];
  const m = useMemo(() => trackMetrics(trackGeometry(t)), [trackId]);
  const chips: { l: string; tone?: string }[] = [];
  chips.push({ l: `${(trackGeometry(t).length / 1000).toFixed(2)} km` });
  if (m.straightPct > 0.74) chips.push({ l: 'Lange Geraden' });
  if (m.minR < 18) chips.push({ l: 'Enge Kurven' });
  if (m.corners >= 14) chips.push({ l: 'Viele Kurven' });
  if (t.ideal.wing >= 60) chips.push({ l: 'Schnelle Kurven' });
  if (t.tyreWear >= 1.15) chips.push({ l: 'Hoher Reifenverschleiß', tone: 'warn' });
  if (t.brakeWear >= 1.2) chips.push({ l: 'Hoher Bremsverschleiß', tone: 'warn' });
  if (t.street) chips.push({ l: 'Stadtkurs: Mauern', tone: 'bad' });
  return (
    <div className="row" style={{ gap: 6 }}>
      {chips.map((c) => (
        <span key={c.l} className={`pill ${c.tone ?? ''}`}>{c.l}</span>
      ))}
    </div>
  );
}

export function Forecast({ w }: { w: NonNullable<GameState['weekend']> }) {
  const segs = w.forecast;
  const label = (at: number) => (at === 0 ? 'Start' : at < 0.4 ? 'Erstes Drittel' : at < 0.7 ? 'Rennmitte' : 'Schlussphase');
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row between">
        <span className="eyebrow">Wetterprognose</span>
        <span className="muted" style={{ fontSize: 12 }}>Treffsicherheit {Math.round(w.forecastConfidence * 100)} %</span>
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
  const t = TRACK_BY_ID[w.trackId];
  return (
    <section className="card stack track-strip" style={{ gap: 8 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <FlagStrip colors={t.flag} />
          <div>
            <span className="eyebrow">Du planst für</span>
            <h3 style={{ margin: 0 }}>{t.name} · {w.laps} Runden</h3>
          </div>
        </div>
      </div>
      <TrackTraits trackId={t.id} />
      {weather && <Forecast w={w} />}
    </section>
  );
}
