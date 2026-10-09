// Werbung: Zwischenwerbung nach dem Ergebnis eines Rennens und beim Saisonwechsel, Belohnungswerbung nur auf Wunsch des Spielers.
// Alle Aufrufe laufen über platform.ts (Portal-SDK). Ohne SDK, mit Werbeblocker oder bei Fehlern passiert einfach nichts.
import { platform } from './platform';

let blocked = false;
let busy = false;
type Placement = 'race_result' | 'season_change';
let queued: Placement | null = null;

/** Solange true, werden keine Zwischenwerbungen gezeigt (während eines Rennens oder einer Fahrt) */
export function setAdsBlocked(b: boolean) {
  blocked = b;
}

export const adsBlocked = () => blocked;

export const rewardedSupported = () => !!platform.ads.rewarded;
export const interstitialSupported = () => !!platform.ads.interstitial;

/** Zwischenwerbung an einer ruhigen Stelle (nach Ergebnis, Saisonwechsel). Wartet, bis sie vorbei ist. Wirft nie. */
export async function playInterstitial(placement: Placement): Promise<boolean> {
  if (blocked || busy || !platform.ads.interstitial) return false;
  busy = true;
  try {
    return await platform.showInterstitial(placement);
  } catch {
    return false;
  } finally {
    busy = false;
  }
}

/** Belohnungswerbung: true nur, wenn die Werbung vollständig angesehen wurde */
export async function playRewarded(placement: 'sponsor_bonus' | 'repair_discount'): Promise<boolean> {
  if (busy || !platform.ads.rewarded) return false;
  busy = true;
  try {
    return await platform.showRewarded(placement);
  } catch {
    return false;
  } finally {
    busy = false;
  }
}

/**
 * Zwischenwerbung vormerken und zeigen, sobald keine Fahrt mehr läuft. So kann der Ergebnisbildschirm erst ganz verschwinden
 * (die Rennansicht meldet „Fahrt beendet“), und die Werbung erscheint nie mitten in einem Rennen.
 */
export function scheduleInterstitial(placement: Placement) {
  queued = placement;
  runQueuedInterstitial();
}

export function runQueuedInterstitial() {
  if (!queued || blocked) return;
  const p = queued;
  queued = null;
  void playInterstitial(p);
}
