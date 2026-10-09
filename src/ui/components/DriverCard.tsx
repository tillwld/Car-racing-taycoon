import type { Driver, DriverStats } from '../../types';
import { StatLine } from './common';
import { lazyRecord, t } from '../../i18n';

export const DRIVER_STAT_LABELS: Record<keyof DriverStats, string> = lazyRecord('driverCard.stat', ['speed', 'braking', 'cornering', 'reaction', 'consistency', 'aggression', 'wet', 'tyreMgmt', 'experience'] as const);

export function DriverStatsBlock({ d, compact }: { d: Driver; compact?: boolean }) {
  const keys: (keyof DriverStats)[] = compact ? ['speed', 'cornering', 'braking', 'consistency', 'aggression', 'wet'] : ['speed', 'braking', 'cornering', 'reaction', 'consistency', 'aggression', 'wet', 'tyreMgmt', 'experience'];
  return (
    <div className="stack" style={{ gap: 4 }}>
      {keys.map((k) => (
        <StatLine key={k} label={DRIVER_STAT_LABELS[k]} value={d.stats[k]} ghost={k !== 'aggression' && k !== 'experience' && d.talentKnown ? d.talent : undefined} />
      ))}
      {!compact && (
        <div className="statline">
          <span className="muted">{t('driverCard.talent')}</span>
          <span className="muted" style={{ fontSize: 12 }}>{d.talentKnown ? t('driverCard.potential') : t('driverCard.needAnalyst')}</span>
          <span className="v">{d.talentKnown ? d.talent : '?'}</span>
        </div>
      )}
    </div>
  );
}
