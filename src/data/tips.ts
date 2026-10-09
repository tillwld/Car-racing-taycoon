import { lazyArray, loc } from '../i18n';

// Erklärungen, die beim Freischalten neuer Funktionen eingeblendet werden. Jede Erklärung erscheint einmal
// und lässt sich später über die Hilfe wieder öffnen.
// Die Texte liegen in src/i18n/{de,en}/data.ts: `tips.<id>.title|lead|next` und `tips.<id>.points.<n>`.
// Title, lead, points und next sind Getter und übersetzen bei jedem Zugriff in der aktuellen Sprache.
export interface Tip {
  title: string;
  icon: string;
  lead: string;
  points: string[];
  /** Optionaler Hinweis, was als Nächstes zu tun ist */
  next?: string;
}

/** Aufbau einer Erklärung: Symbol, Anzahl der Aufzählungspunkte und ob es einen „Als Nächstes“-Hinweis gibt */
const TIP_DEFS: Record<string, { icon: string; points: number; next?: boolean }> = {
  welcome: { icon: 'flag', points: 4, next: true },
  freedrive: { icon: 'race', points: 4, next: true },
  income: { icon: 'finance', points: 4 },
  race_intro: { icon: 'flag', points: 5 },
  after_race: { icon: 'medal', points: 4 },
  quali: { icon: 'race', points: 3 },
  pit: { icon: 'pit', points: 4 },

  plot_kiosk: { icon: 'finance', points: 2, next: true },
  plot_fanshop: { icon: 'sponsors', points: 1 },
  plot_grandstand: { icon: 'flag', points: 1 },
  plot_media: { icon: 'dashboard', points: 1 },
  plot_workshop: { icon: 'garage', points: 3, next: true },
  plot_setupLab: { icon: 'wrench', points: 5, next: true },
  plot_tireDepot: { icon: 'pit', points: 4, next: true },
  plot_pitwall: { icon: 'dashboard', points: 4 },
  plot_lab: { icon: 'research', points: 3 },
  plot_staffOffice: { icon: 'staff', points: 5 },
  plot_lounge: { icon: 'drivers', points: 4 },
  plot_sponsorLounge: { icon: 'sponsors', points: 3 },
};

function makeTip(id: string, d: { icon: string; points: number; next?: boolean }): Tip {
  const base: Tip & { id: string } = {
    id,
    title: '',
    icon: d.icon,
    lead: '',
    points: lazyArray(`tips.${id}.points`, d.points),
    ...(d.next ? { next: '' } : {}),
  };
  return loc('tips', base, d.next ? ['title', 'lead', 'next'] : ['title', 'lead']);
}

export const TIPS: Record<string, Tip> = Object.fromEntries(Object.entries(TIP_DEFS).map(([id, d]) => [id, makeTip(id, d)]));

export const GENERAL_TIPS = ['welcome', 'income', 'freedrive', 'race_intro', 'after_race', 'quali', 'pit'];
