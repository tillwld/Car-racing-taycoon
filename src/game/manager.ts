// Die Managerin: ein Postfach im Spiel. Sie warnt rechtzeitig vor auslaufenden Verträgen und beantwortet Fragen zum Spiel.
// Es gibt keinen Online-Dienst dahinter: Die Antworten kommen aus einer Wissensbasis und passen sich dem Spielstand an.
import { POINTS, TIERS } from '../data/catalog';
import { labelsFor, reverseKeys } from '../race/keys';
import { PIT_KMH } from '../race/params';
import type { GameState } from '../types';
import { extendEvent } from './events';
import { news, playerDrivers } from './state';
import { AUFBAU, aufbauPath, features, incomePerSec, nextPlot, PLOTS } from './tycoon';

export const MANAGER = { name: 'Katrin Vogel', first: 'Katrin' };

/** Ein Knopf unter einer Nachricht: führt zu einem Bildschirm des Spiels */
export interface ManagerAction {
  screen: string; // entspricht den Bildschirmen der App (z. B. 'drivers', 'sponsors', 'dashboard')
  label: string;
}

export interface ManagerMsg {
  id: string;
  from: 'manager' | 'player';
  text: string;
  season: number;
  round: number;
  /** Wichtige Nachricht: erscheint zusätzlich als Hinweisfenster, bis sie bestätigt wird */
  urgent?: boolean;
  ack?: boolean;
  actions?: ManagerAction[];
}

export interface ManagerBox {
  messages: ManagerMsg[];
  unread: number;
  /** Schon verschickte Vertragswarnungen, damit sie nicht doppelt kommen */
  warned: Record<string, boolean>;
}

const MAX_MESSAGES = 80;

const emptyBox = (): ManagerBox => ({ messages: [], unread: 0, warned: {} });

/** Lesezugriff (ohne Änderung am Spielstand) */
export function managerBox(g: GameState): ManagerBox {
  const b = g.flags.manager as ManagerBox | undefined;
  return b && Array.isArray(b.messages) ? b : emptyBox();
}

function box(s: GameState): ManagerBox {
  const cur = s.flags.manager as ManagerBox | undefined;
  if (!cur || !Array.isArray(cur.messages)) s.flags.manager = emptyBox();
  const b = s.flags.manager as ManagerBox;
  b.warned = b.warned ?? {};
  b.unread = b.unread ?? 0;
  return b;
}

function push(s: GameState, m: Omit<ManagerMsg, 'id' | 'season' | 'round'>) {
  const b = box(s);
  b.messages.push({ ...m, id: `m${s.nextId++}`, season: s.season, round: s.round });
  if (b.messages.length > MAX_MESSAGES) b.messages.splice(0, b.messages.length - MAX_MESSAGES);
}

/** Nachricht der Managerin an den Spieler */
export function managerSay(s: GameState, text: string, opts: { urgent?: boolean; actions?: ManagerAction[] } = {}) {
  push(s, { from: 'manager', text, urgent: opts.urgent, actions: opts.actions });
  box(s).unread++;
}

/** Eigene Frage des Spielers ins Postfach schreiben */
export function managerAsk(s: GameState, text: string) {
  push(s, { from: 'player', text: text.trim().slice(0, 300) });
}

/** Antwort der Managerin auf die letzte Frage (wird vom Chat mit kurzer Verzögerung aufgerufen) */
export function managerReply(s: GameState, question: string) {
  const a = answer(s, question);
  push(s, { from: 'manager', text: a.text, actions: a.actions });
}

export function markManagerRead(s: GameState) {
  const b = box(s);
  if (b.unread) b.unread = 0;
}

export function ackManager(s: GameState, id: string) {
  const m = box(s).messages.find((x) => x.id === id);
  if (m) m.ack = true;
}

/** Die erste Nachricht: stellt die Managerin vor. */
export function ensureManager(s: GameState) {
  const b = box(s);
  if (b.messages.length) return;
  managerSay(
    s,
    `Hallo, ich bin ${MANAGER.name}, deine Managerin. Wenn du Fragen zum Spiel hast, schreib mir einfach. Außerdem sage ich dir rechtzeitig Bescheid, bevor Verträge von Fahrern oder Sponsoren auslaufen.`,
  );
}

// ---------- Verträge ----------
export interface ContractRow {
  kind: 'driver' | 'sponsor';
  id: string;
  name: string;
  left: number; // verbleibende Rennen
}

export function contractRows(g: GameState): ContractRow[] {
  const rows: ContractRow[] = [];
  for (const d of playerDrivers(g)) rows.push({ kind: 'driver', id: d.id, name: d.name, left: d.contract });
  for (const sp of g.sponsors) rows.push({ kind: 'sponsor', id: sp.id, name: sp.name, left: sp.races });
  return rows.sort((a, b) => a.left - b.left);
}

/** Warnstufen: bei höchstens 3 Rennen Restlaufzeit und noch einmal bei höchstens 1 Rennen */
export const WARN_AT = [3, 1];

const leftText = (n: number) => (n <= 0 ? 'ist ausgelaufen' : n === 1 ? 'läuft nach dem nächsten Rennen aus' : `läuft in ${n} Rennen aus`);

/**
 * Nach jedem Rennen aufrufen: schickt eine Warnung, wenn ein Vertrag (Fahrer oder Sponsor) bald endet.
 * Mehrere Verträge zur gleichen Zeit kommen in einer gemeinsamen Nachricht.
 */
export function warnContracts(s: GameState) {
  const b = box(s);
  const f = features(s);
  const lines: string[] = [];
  let drivers = false;
  let sponsors = false;
  for (const r of contractRows(s)) {
    // Stufe 3 gilt bei 2 bis 3 Rennen Restlaufzeit, Stufe 1 bei höchstens 1 Rennen. Nach einer Verlängerung beginnt es von vorn.
    const level = r.left <= 0 ? 0 : r.left <= WARN_AT[1] ? WARN_AT[1] : r.left <= WARN_AT[0] ? WARN_AT[0] : null;
    if (level === null) {
      for (const l of WARN_AT) delete b.warned[`${r.kind}:${r.id}:${l}`];
      continue;
    }
    if (level === 0) continue;
    const key = `${r.kind}:${r.id}:${level}`;
    if (b.warned[key]) continue;
    b.warned[key] = true;
    if (r.kind === 'driver') {
      drivers = true;
      lines.push(`• ${r.name} (Fahrer): Der Vertrag ${leftText(r.left)}. ${f.drivers ? 'Verlängere ihn in der Fahrerlounge unter „Mein Team“, sonst verlässt er das Team.' : 'Dafür brauchst du die Fahrerlounge, sonst verlässt er das Team.'}`);
      news(s, `Der Vertrag von ${r.name} ${leftText(r.left)}.`, 'bad');
    } else {
      sponsors = true;
      const sp = s.sponsors.find((x) => x.id === r.id)!;
      let extra = 'Neue Angebote findest du in der Sponsoren-Lounge.';
      if (level === WARN_AT[0] && sp.satisfaction >= 55 && !s.pendingEvents.some((e) => e.kind === 'extend' && e.data.sponsorId === sp.id)) {
        s.pendingEvents.push(extendEvent(s, sp));
        extra = 'Sie sind zufrieden und haben ein Verlängerungsangebot geschickt.';
      } else if (level === WARN_AT[0] && sp.satisfaction < 55) extra = 'Sie sind nicht ganz zufrieden: Erreiche ihr Ziel, dann verlängern sie vielleicht. Sonst such rechtzeitig einen Ersatz.';
      lines.push(`• ${r.name} (Sponsor): Der Vertrag ${leftText(r.left)}. ${extra}`);
      news(s, `Der Sponsorenvertrag mit ${r.name} ${leftText(r.left)}.`, 'neutral');
    }
  }
  if (!lines.length) return;
  const actions: ManagerAction[] = [];
  if (drivers && f.drivers) actions.push({ screen: 'drivers', label: 'Zur Fahrerlounge' });
  if (sponsors && f.sponsors) actions.push({ screen: 'sponsors', label: 'Zur Sponsoren-Lounge' });
  managerSay(s, `Kurze Vertragswarnung:\n${lines.join('\n')}`, { urgent: true, actions });
}

/** Wurde ein Vertrag schon beendet? (Fahrer verlässt das Team, Sponsor läuft aus): Info an das Postfach */
export function tellContractEnded(s: GameState, text: string) {
  managerSay(s, text);
}

// ---------- Antworten ----------
export interface Answer {
  text: string;
  actions?: ManagerAction[];
}

interface Topic {
  id: string;
  keys: string[];
  /** Als Beispielfrage in der Auswahl über dem Eingabefeld */
  ask?: string;
  reply: (g: GameState) => Answer;
}

/** Kleinschreibung, ohne Umlaute und Akzente (ä → a, ue → u), damit „Prüfstand“, „Pruefstand“ und „Prufstand“ gleich zählen */
export function norm(t: string): string {
  return t
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(a|o|u)e/g, '$1')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const k = (g: GameState, a: Parameters<typeof labelsFor>[1]) => labelsFor(reverseKeys(g.settings.keys).map, a);
const go = (screen: string, label: string): ManagerAction => ({ screen, label });

const TOPICS: Topic[] = [
  {
    id: 'next',
    ask: 'Was soll ich als Nächstes tun?',
    keys: ['als nachstes', 'nachster schritt', 'was soll ich', 'was tun', 'wie weiter', 'wie fang', 'was mache ich', 'was kann ich', 'tipp', 'loslegen', 'anfang'],
    reply: (g) => {
      const next = aufbauPath(g).find((x) => x.state === 'next');
      const lines: string[] = [];
      const t = g.calendar[g.round];
      if (g.round < g.calendar.length && !g.seasonEnd) lines.push('• Fahre das nächste Rennen am Team-Transporter. Preisgeld, Sponsorengeld und Punkte bringen dich weiter.');
      if (next) lines.push(`• Baue als Nächstes: ${next.name}. ${next.why}${next.text ? ` (${next.text})` : ' Stell dich dafür auf die leuchtende Fläche.'}`);
      else lines.push('• Alle Bereiche sind gebaut. Baue die Einnahmequellen aus und werde Meister.');
      lines.push('• Die Aufträge oben links zeigen dir jeweils das nächste Ziel.');
      return { text: `Das würde ich jetzt tun:\n${lines.join('\n')}`, actions: [go('dashboard', 'Zum Büro')] };
    },
  },
  {
    id: 'money',
    ask: 'Wie verdiene ich Geld?',
    keys: ['geld', 'verdien', 'einnahmen', 'einkommen', 'kohle', 'budget', 'pleite', 'minus', 'reich'],
    reply: (g) => ({
      text: `Dein Geld kommt aus mehreren Quellen:\n• Anlagen wie Kiosk, Fanshop, Tribüne und Mediazentrum verdienen jede Sekunde von allein. Jetzt sind es ${incomePerSec(g).toFixed(1).replace('.', ',')} € pro Sekunde. Ein Klick aufs Budget oben zeigt die Aufschlüsselung.\n• Sponsoren zahlen bei jedem Rennen.\n• Preisgeld gibt es für gute Plätze.\n• Auf der Teststrecke bringen saubere Runden und neue Bestzeiten Geld.\n• Aufträge zahlen Belohnungen.\nBaue die Einnahmequellen aus, das zahlt sich am meisten aus.`,
    }),
  },
  {
    id: 'build',
    ask: 'Wie baue ich neue Gebäude?',
    keys: ['bauen', 'baue ', 'wie baue', 'flache', 'kauffl', 'gebaude', 'kaufen', 'leuchtend', 'ausbau', 'betreten'],
    reply: (g) => ({
      text: `So baust du: Lauf auf dem Gelände zu einer leuchtenden Fläche und bleib kurz darauf stehen, schon wird gebaut. Wer nur darüber läuft, kauft nichts. Fertige Gebäude betrittst du mit ${k(g, 'interact').split(' / ')[0]}. Du kannst auch auf ein Ziel klicken, dann läuft deine Figur hin. Alle Stationen findest du außerdem im Schnellzugriff oben rechts.`,
    }),
  },
  {
    id: 'unlock',
    ask: 'Warum ist etwas noch gesperrt?',
    keys: ['freischalt', 'gesperrt', 'wann kann', 'nacheinander', 'reihenfolge', 'noch nicht', 'warum kann ich nicht', 'nicht baubar', 'fehlt'],
    reply: (g) => {
      const next = nextPlot(g);
      const list = AUFBAU.filter((a) => (g.plots[a.id] ?? 0) < 1)
        .slice(0, 4)
        .map((a) => `• ${PLOTS[a.id].name}: ab ${a.races === 0 ? 'sofort' : a.races === 1 ? '1 Rennen' : `${a.races} Rennen`}`)
        .join('\n');
      const now = next ? aufbauPath(g).find((x) => x.id === next)! : null;
      return {
        text: now
          ? `Es wird immer nur die nächste Fläche freigeschaltet. Dafür brauchst du die vorherige Anlage und eine Mindestzahl gefahrener Rennen.\nJetzt an der Reihe: ${now.name}${now.text ? ` (${now.text})` : ''}.\nDanach folgt:\n${list}\nIm Büro unter „Dein Aufbau“ siehst du alles.`
          : 'Du hast schon alle Bereiche gebaut. Es gibt nichts mehr freizuschalten.',
        actions: [go('dashboard', 'Zum Büro')],
      };
    },
  },
  {
    id: 'controls',
    ask: 'Wie steuere ich das Auto?',
    keys: ['steuer', 'tasten', 'taste', 'bedien', 'lenken', 'wasd', 'gas', 'bremse', 'bremsen', 'boost', 'tastatur', 'handy', 'touch', 'controller'],
    reply: (g) => ({
      text: `Im Rennen:\n• Gas: ${k(g, 'up')}\n• Bremse und Rückwärts: ${k(g, 'down')}\n• Lenken: ${k(g, 'left')} und ${k(g, 'right')}\n• Boost: ${k(g, 'boost')}\n• Boxenstopp anfordern oder absagen: ${k(g, 'pit')}\n• Kamera: ${k(g, 'camera')}, Ideallinie: ${k(g, 'line')}, Zeitenliste: ${k(g, 'tower')}, Zurücksetzen: ${k(g, 'reset')}\nAm Handy erscheinen Tasten auf dem Bildschirm. Alle Tasten kannst du in den Einstellungen ändern.`,
      actions: [go('settings', 'Zu den Einstellungen')],
    }),
  },
  {
    id: 'start',
    ask: 'Wie funktioniert der Rennstart?',
    keys: ['rennstart', 'ampel', 'lichter', 'reaktion', 'fehlstart', 'start vom rennen', 'wie starte ich im rennen', 'losfahren'],
    reply: (g) => ({
      text: `Beim Start gehen nacheinander fünf Lichter an. Wenn alle leuchten und dann plötzlich ausgehen, gibst du Gas (${k(g, 'up')}). Deine Reaktionszeit siehst du danach eingeblendet: unter 0,25 Sekunden ist perfekt.\nVorsicht: Wer schon vor „Lichter aus“ aufs Gas geht, begeht einen Fehlstart und steht danach noch gut anderthalb Sekunden still. Die Gegner starten zu leicht unterschiedlichen Zeiten.\nBeim Zuschauen oder Simulieren übernimmt dein Team den Start.`,
    }),
  },
  {
    id: 'pit',
    ask: 'Wie funktioniert ein Boxenstopp?',
    keys: ['boxenstopp', 'boxengasse', 'boxen', 'pit', 'nachtanken', 'reifenwechsel', 'wechseln', 'box '],
    reply: (g) => ({
      text: `So läuft ein Boxenstopp:\n1. Drücke ${k(g, 'pit')}, um den Stopp anzumelden. Mit derselben Taste sagst du ihn wieder ab.\n2. Im Boxenmenü wählst du die Reifen (1 bis 5), Nachtanken (${k(g, 'pitFuel')}) und Reparatur (${k(g, 'pitRepair')}).\n3. Fahre in der nächsten Runde in die Boxengasse. Die Einfahrt ist markiert, Schilder zeigen den Weg. In der Gasse gilt ein Tempolimit von ${PIT_KMH} km/h.\n4. Das Team arbeitet, die Ausfahrtsampel gibt dich frei.\nIn der letzten Runde lohnt sich ein Stopp nicht mehr.`,
    }),
  },
  {
    id: 'tyres',
    ask: 'Welche Reifen soll ich nehmen?',
    keys: ['reifen', 'mischung', 'soft', 'medium', 'hard', 'inter', 'wet', 'verschleiss', 'grip'],
    reply: (g) => ({
      text: `Reifen:\n• Soft: viel Grip, aber schneller verschlissen.\n• Medium: der Mittelweg.\n• Hard: hält lange, hat weniger Grip.\n• Intermediate und Wet brauchst du, sobald die Strecke nass ist.\nIm Reifenlager${features(g).tyres ? '' : ' (kommt später)'} planst du Startreifen, Tankmenge und Stopps schon vor dem Rennen. Dort steht auch, wie lange jede Mischung auf der Strecke hält. Im Rennen zeigt dir das Auto-Panel unten Abnutzung und Temperatur.`,
    }),
  },
  {
    id: 'fuel',
    keys: ['sprit', 'tank', 'benzin', 'kraftstoff', 'verbrauch'],
    reply: () => ({
      text: 'Sprit: Mehr Tankfüllung macht das Auto schwerer und langsamer, zu wenig zwingt dich zum Nachtanken. Im Rennen siehst du unten im Auto-Panel, für wie viele Runden der Sprit noch reicht. Im Reifenlager legst du die Tankmenge vorher fest.',
    }),
  },
  {
    id: 'damage',
    ask: 'Wie repariere ich mein Auto?',
    keys: ['schaden', 'repar', 'kaputt', 'unfall', 'defekt', 'zustand'],
    reply: (g) => ({
      text: `Schäden machen das Auto langsamer und unzuverlässiger. Du kannst sie auf zwei Wegen beheben:\n• Im Rennen beim Boxenstopp: Taste ${k(g, 'pitRepair')} im Boxenmenü.\n• Nach dem Rennen in der Werkstatt unter „Auto & Zustand“. Das kostet Geld, ein Chefmechaniker macht es günstiger.\nIm Rennen siehst du die fünf Bauteile als Kästchen im Auto-Panel: Motor, Getriebe, Bremsen, Frontflügel, Fahrwerk.`,
      actions: features(g).garage ? [go('garage', 'Zur Werkstatt')] : undefined,
    }),
  },
  {
    id: 'quali',
    keys: ['quali', 'qualifying', 'startplatz', 'startaufstellung', 'pole', 'startposition'],
    reply: (g) => ({
      text: features(g).quali
        ? 'Im Qualifying fährst du zwei fliegende Runden. Die schnellste entscheidet über deinen Startplatz. Wer vorn startet, hat im Rennen freie Bahn und weniger Gedränge. Du kannst selbst fahren oder simulieren.'
        : 'Das Qualifying schaltet sich nach dem zweiten Rennen frei. Bis dahin wird dein Startplatz automatisch berechnet.',
    }),
  },
  {
    id: 'setup',
    ask: 'Was bringt die Fahrzeugabstimmung?',
    keys: ['abstimm', 'setup', 'flugel', 'ubersetzung', 'fahrwerk', 'prufstand', 'training', 'wissen', 'ingenieur'],
    reply: (g) => ({
      text: `Im Prüfstand${features(g).setup ? '' : ' (den baust du später)'} sammelst du im Training Daten. Je mehr Setup-Wissen dein Ingenieur hat, desto genauer wird die grüne Empfehlung an den Reglern für Flügel, Übersetzung und Fahrwerk. Stellst du das Auto passend ein, bist du schneller. „Empfehlung übernehmen“ erledigt das mit einem Klick.`,
    }),
  },
  {
    id: 'tactics',
    keys: ['taktik', 'fahrstil', 'aggress', 'uberhol', 'boxenmauer', 'strategie'],
    reply: () => ({
      text: 'An der Boxenmauer stellst du Fahrstil, Aggressivität und Überholstrategie ein. Das gilt vor allem für den Fahrer, den der Computer steuert. Schonend spart Reifen, Sprit und Material, Angriff ist schneller, aber riskanter. Die Reifen- und Stoppplanung machst du im Reifenlager.',
    }),
  },
  {
    id: 'contracts',
    ask: 'Wann laufen meine Verträge aus?',
    keys: ['vertrag', 'vertrage', 'laufzeit', 'auslauf', 'verlanger', 'ablauf', 'verlasst'],
    reply: (g) => {
      const rows = contractRows(g);
      if (!rows.length) return { text: 'Aktuell laufen keine Verträge. Verpflichte Fahrer in der Fahrerlounge und Sponsoren in der Sponsoren-Lounge.' };
      const lines = rows.map((r) => `• ${r.name} (${r.kind === 'driver' ? 'Fahrer' : 'Sponsor'}): noch ${r.left} ${r.left === 1 ? 'Rennen' : 'Rennen'}`).join('\n');
      return {
        text: `Deine Verträge:\n${lines}\nIch melde mich, wenn ein Vertrag nur noch 3 Rennen oder 1 Rennen läuft. Fahrer verlängerst du in der Fahrerlounge, bei Sponsoren kommt meist ein Angebot, wenn sie zufrieden sind.`,
        actions: [...(features(g).drivers ? [go('drivers', 'Zur Fahrerlounge')] : []), ...(features(g).sponsors ? [go('sponsors', 'Zu den Sponsoren')] : [])],
      };
    },
  },
  {
    id: 'sponsors',
    ask: 'Wie funktionieren Sponsoren?',
    keys: ['sponsor', 'hauptsponsor', 'partner', 'zielbonus'],
    reply: (g) => ({
      text: 'Sponsoren zahlen dir bei jedem Rennen Geld. Dafür erwarten sie ein Ziel, zum Beispiel einen Platz unter den ersten Zehn. Erreichst du es, gibt es einen Bonus und der Sponsor ist zufrieden. Verfehlst du es zu oft, steigt er aus. Ein Hauptsponsor bringt das meiste Geld, dazu passen mehrere Partner. Mit besserem Ruf kommen größere Sponsoren.',
      actions: features(g).sponsors ? [go('sponsors', 'Zur Sponsoren-Lounge')] : undefined,
    }),
  },
  {
    id: 'drivers',
    keys: ['fahrer', 'transfer', 'akademie', 'nachwuchs', 'cockpit', 'talent'],
    reply: (g) => ({
      text: 'Fahrer 1 steuerst du selbst, Fahrer 2 fährt der Computer. In der Fahrerlounge verlängerst du Verträge, findest auf dem Transfermarkt neue Fahrer und förderst junge Talente in der Akademie. Stärkere Fahrer verlangen mehr Gehalt und einen besseren Ruf deines Teams. Ein leeres Cockpit kostet Punkte und Preisgeld.',
      actions: features(g).drivers ? [go('drivers', 'Zur Fahrerlounge')] : undefined,
    }),
  },
  {
    id: 'staff',
    keys: ['mitarbeiter', 'personal', 'mechaniker', 'datenanalyst', 'analyst', 'chefmechaniker', 'gehalt', 'einstell', 'bewerber'],
    reply: (g) => ({
      text: 'Im Personalbüro besetzt du sechs Stellen: Mechaniker, Renningenieur, Chefmechaniker, Motoren-Ingenieur, Aerodynamiker und Datenanalyst. Mechaniker (schnellere Boxenstopps) und Renningenieur (bessere Abstimmung) bringen am Anfang am meisten. Je höher das Können, desto stärker die Wirkung, aber auch das Gehalt pro Rennen.',
      actions: features(g).staff ? [go('staff', 'Zum Personalbüro')] : undefined,
    }),
  },
  {
    id: 'garage',
    keys: ['upgrade', 'teile', 'chassis', 'motor', 'werkstatt', 'auto verbessern', 'schneller machen', 'fabrik'],
    reply: (g) => ({
      text: 'In der Werkstatt verbesserst du dein Auto: Upgrades für Motor, Bremsen, Reifen, Fahrwerk, Aerodynamik, Getriebe und Kühlung kosten Geld und brauchen Entwicklungszeit, gemessen in Rennen. Dazu kommen Reparatur, der Ausbau der Fabrik und später ein besseres Chassis.',
      actions: features(g).garage ? [go('garage', 'Zur Werkstatt')] : undefined,
    }),
  },
  {
    id: 'research',
    keys: ['forschung', 'labor', 'entwickl', 'technik'],
    reply: (g) => ({
      text: 'Im Forschungslabor entwickelst du dauerhaft wirkende Technik in fünf Zweigen: Motor, Aerodynamik, Fahrwerk, Reifen und Boxencrew. Jedes Projekt kostet Geld und Zeit, gemessen in Rennen. Manche Projekte setzen andere voraus. Ein Datenanalyst macht die Forschung günstiger und schneller.',
      actions: features(g).research ? [go('research', 'Zum Forschungslabor')] : undefined,
    }),
  },
  {
    id: 'finance',
    keys: ['finanz', 'bilanz', 'kosten', 'ausgaben', 'buchung', 'abrechnung'],
    reply: (g) => ({
      text: 'Die Finanzen findest du im Büro. Sie zeigen Kontostand, Einnahmen und Ausgaben der Saison, die Bilanz pro Rennwochenende und alle einzelnen Buchungen. Fixkosten pro Rennen sind Gehälter und Reisekosten. Liegt dein Konto im Minus, spare beim Personal oder hole bessere Sponsoren.',
      actions: features(g).finance ? [go('finance', 'Zu den Finanzen')] : undefined,
    }),
  },
  {
    id: 'reputation',
    keys: ['ruf', 'reputation', 'ansehen', 'beliebt'],
    reply: () => ({
      text: 'Deine Reputation zeigt, wie angesehen dein Team ist. Sie steigt mit guten Ergebnissen und erfüllten Sponsorenzielen und sinkt bei schwachen Rennen oder verfehlten Zielen. Mit hohem Ruf kommen bessere Sponsoren und Fahrer zu dir und du kannst in die nächste Klasse aufsteigen.',
    }),
  },
  {
    id: 'season',
    ask: 'Wie funktioniert die Meisterschaft?',
    keys: ['meisterschaft', 'saison', 'punkte', 'aufstieg', 'klasse', 'liga', 'tabelle', 'pokal', 'titel', 'platz'],
    reply: (g) => ({
      text: `In jedem Rennen gibt es Punkte für die ersten Zehn: ${POINTS.join(' - ')}, plus 1 Punkt für die schnellste Runde in den Top 10. Die Punkte beider Fahrer zählen für die Teamwertung. Eine Saison hat ${g.calendar.length} Rennen. Wer am Ende unter den ersten drei Teams ist, darf in die nächste Klasse aufsteigen. Es gibt drei Klassen: ${TIERS.map((t) => t.name).join(', ')}. Alle Tabellen findest du in der Pokalvitrine.`,
      actions: [go('championship', 'Zur Pokalvitrine')],
    }),
  },
  {
    id: 'weather',
    keys: ['wetter', 'regen', 'nass', 'trocken', 'prognose', 'sturm'],
    reply: () => ({
      text: 'Das Wetter kann sich im Rennen ändern, die Strecke wird dann schrittweise nass und trocknet langsam wieder ab. Die Wetterprognose steht im Transporter und im Reifenlager, ihre Treffsicherheit ist begrenzt. Bei Nässe brauchst du Intermediate oder Wet. In der Boxenmauer kannst du einstellen, dass dein Team bei Wetterwechsel automatisch passende Reifen wählt.',
    }),
  },
  {
    id: 'testtrack',
    keys: ['teststrecke', 'freie fahrt', 'testen', 'uben', 'ausprobieren'],
    reply: () => ({
      text: 'Die Teststrecke am unteren Rand des Geländes ist jederzeit offen. Dort fährst du frei und bekommst Geld für saubere Runden und neue Bestzeiten. Perfekt zum Üben und um etwas dazuzuverdienen. Es werden bis zu sechs Runden pro Fahrt bezahlt.',
    }),
  },
  {
    id: 'missions',
    keys: ['auftrag', 'auftrage', 'mission', 'aufgabe'],
    reply: () => ({
      text: 'Die Aufträge oben links führen dich durch das Spiel und zahlen Belohnungen. Ein Klick auf einen Auftrag lässt deine Figur zum Ziel laufen.',
    }),
  },
  {
    id: 'race',
    keys: ['simulier', 'zuschauen', 'automatisch fahren', 'selbst fahren', 'rennwochenende', 'transporter'],
    reply: () => ({
      text: 'Am Team-Transporter startest du Qualifying und Rennen. Du kannst selbst fahren, zuschauen oder das Ganze in Sekunden simulieren lassen. Selbst fahren bringt meist das beste Ergebnis, Simulieren ist am schnellsten. Nach dem Rennen gibt es Preisgeld, Sponsorgeld und Punkte.',
      actions: [go('race', 'Zum Transporter')],
    }),
  },
  {
    id: 'save',
    ask: 'Wird mein Spielstand gespeichert?',
    keys: ['speicher', 'spielstand', 'verlier', 'cloud', 'sichern', 'laden', 'backup', 'weg'],
    reply: () => ({
      text: 'Dein Spielstand wird laufend automatisch im Browser gespeichert. Läuft das Spiel als Artifact in claude.ai, liegt zusätzlich eine Kopie im dauerhaften Speicher. Unter Einstellungen kannst du ihn außerdem als Datei sichern und später wieder laden.',
      actions: [go('settings', 'Zu den Einstellungen')],
    }),
  },
  {
    id: 'offline',
    keys: ['offline', 'abwesen', 'geschlossen', 'wahrend ich weg', 'zuruck'],
    reply: () => ({
      text: 'Wenn du das Spiel schließt, verdienen deine Anlagen bis zu einer Stunde lang zur Hälfte weiter. Beim nächsten Start sammelst du das Geld ein.',
    }),
  },
  {
    id: 'view',
    keys: ['kamera', 'ideallinie', 'linie', 'einstellung', 'grafik', 'ton', 'sound', 'musik', 'ansicht'],
    reply: (g) => ({
      text: `Kamera (${k(g, 'camera')}), Ideallinie (${k(g, 'line')}) und Zeitenliste (${k(g, 'tower')}) schaltest du im Rennen um. Die Einstellungen (Ton, Kurvenhinweise, Bremsassistent, Tasten) findest du oben rechts im Zahnrad.`,
      actions: [go('settings', 'Zu den Einstellungen')],
    }),
  },
  {
    id: 'who',
    keys: ['wer bist', 'wer bist du', 'wie heisst', 'dein name', 'manager', 'managerin', 'katrin'],
    reply: () => ({
      text: `Ich bin ${MANAGER.name}, deine Managerin. Ich beantworte Fragen zum Spiel, zum Beispiel zu Bauen, Rennen, Boxenstopps, Fahrern, Sponsoren und Finanzen. Und ich warne dich, bevor Verträge auslaufen.`,
    }),
  },
  {
    id: 'thanks',
    keys: ['danke', 'super', 'prima', 'toll', 'klasse gemacht', 'perfekt'],
    reply: () => ({ text: 'Sehr gern! Wenn du noch etwas wissen willst, schreib mir einfach.' }),
  },
  {
    id: 'hello',
    keys: ['hallo', 'hi', 'hey', 'moin', 'servus', 'guten tag', 'guten morgen', 'huhu'],
    reply: () => ({ text: `Hallo! Schön, dass du dich meldest. Was möchtest du wissen? Frag mich zum Beispiel, was du als Nächstes tun sollst oder wie ein Boxenstopp funktioniert.` }),
  },
];

/** Beispielfragen für die Schnellauswahl */
export const QUICK_QUESTIONS: string[] = TOPICS.filter((t) => t.ask).map((t) => t.ask as string);

const FALLBACK_HINTS = ['Was soll ich als Nächstes tun?', 'Wie funktioniert der Rennstart?', 'Wie funktioniert ein Boxenstopp?', 'Wann laufen meine Verträge aus?'];

/** Wissensbasis durchsuchen: das Thema mit den meisten und längsten Treffern gewinnt */
export function answer(g: GameState, text: string): Answer {
  const q = ` ${norm(text)} `;
  if (q.trim().length < 2) return { text: 'Schreib mir gern eine Frage, zum Beispiel: „Wie funktioniert ein Boxenstopp?“' };
  let best: Topic | null = null;
  let bestScore = 0;
  for (const t of TOPICS) {
    let score = 0;
    for (const key of t.keys) {
      const nk = norm(key);
      if (!nk) continue;
      // Sehr kurze Schlüssel nur als ganzes Wort zählen (sonst trifft „hi“ in „nachtanken“)
      const hit = nk.length <= 3 ? q.includes(` ${nk} `) : q.includes(nk);
      if (hit) score += nk.length + (nk.includes(' ') ? 4 : 0);
    }
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  if (!best) {
    return { text: `Da bin ich mir nicht sicher, das habe ich leider nicht verstanden. Frag mich zum Beispiel:\n${FALLBACK_HINTS.map((h) => `• ${h}`).join('\n')}\nOder wähle unten eine der Beispielfragen.` };
  }
  return best.reply(g);
}

