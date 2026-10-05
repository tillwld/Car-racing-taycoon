import type { Driver, DriverStats } from '../../types';
import { StatLine } from './common';

export const DRIVER_STAT_LABELS: Record<keyof DriverStats, string> = {
  speed: 'Geschwindigkeit',
  braking: 'Bremsen',
  cornering: 'Kurvenfahrt',
  reaction: 'Reaktion',
  consistency: 'Konstanz',
  aggression: 'Aggressivität',
  wet: 'Regen',
  tyreMgmt: 'Reifenmanagement',
  experience: 'Erfahrung',
};

export function DriverStatsBlock({ d, compact }: { d: Driver; compact?: boolean }) {
  const keys: (keyof DriverStats)[] = compact ? ['speed', 'cornering', 'braking', 'consistency', 'aggression', 'wet'] : ['speed', 'braking', 'cornering', 'reaction', 'consistency', 'aggression', 'wet', 'tyreMgmt', 'experience'];
  return (
    <div className="stack" style={{ gap: 4 }}>
      {keys.map((k) => (
        <StatLine key={k} label={DRIVER_STAT_LABELS[k]} value={d.stats[k]} ghost={k !== 'aggression' && k !== 'experience' && d.talentKnown ? d.talent : undefined} />
      ))}
      {!compact && (
        <div className="statline">
          <span className="muted">Talent</span>
          <span className="muted" style={{ fontSize: 12 }}>{d.talentKnown ? 'Potenzial (heller Balken)' : 'Datenanalyst nötig'}</span>
          <span className="v">{d.talentKnown ? d.talent : '?'}</span>
        </div>
      )}
    </div>
  );
}
