// Knopf für Belohnungswerbung: freiwillig, klar als Werbung beschriftet, Belohnung nur nach vollständigem Ansehen.
import { useState, type ReactNode } from 'react';
import { t, useLang } from '../../i18n';
import { playRewarded, rewardedSupported } from '../../platform/ads';

export function AdButton({
  placement,
  label,
  hint,
  disabled,
  onReward,
  onFail,
}: {
  placement: 'sponsor_bonus' | 'repair_discount';
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  /** Wird nur aufgerufen, wenn die Werbung vollständig angesehen wurde */
  onReward: () => void;
  onFail?: () => void;
}) {
  useLang();
  const [busy, setBusy] = useState(false);
  if (!rewardedSupported()) return null; // ohne Werbung auf diesem Portal gibt es auch keinen Knopf
  const click = async () => {
    if (busy || disabled) return;
    setBusy(true);
    const ok = await playRewarded(placement);
    setBusy(false);
    if (ok) onReward();
    else onFail?.();
  };
  return (
    <div className="ad-box">
      <button type="button" className="btn ad-btn" disabled={busy || disabled} onClick={click}>
        <span className="ad-tag">{t('ads.tag')}</span>
        <span>{busy ? t('ads.watching') : label}</span>
      </button>
      {hint && <p className="muted ad-hint">{hint}</p>}
    </div>
  );
}
