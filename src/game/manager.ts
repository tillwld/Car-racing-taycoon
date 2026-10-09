// Die Managerin: ein Postfach im Spiel. Sie warnt rechtzeitig vor auslaufenden Verträgen und beantwortet Fragen zum Spiel.
// Es gibt keinen Online-Dienst dahinter: Die Antworten kommen aus einer Wissensbasis und passen sich dem Spielstand an.
import { POINTS, TIERS } from '../data/catalog';
import { LANGS, m, mp, t, tIn } from '../i18n';
import { labelsFor, reverseKeys } from '../race/keys';
import { PIT_KMH } from '../race/params';
import type { GameState } from '../types';
import { extendEvent } from './events';
import { news, playerDrivers } from './state';
import { AUFBAU, aufbauHintMsg, aufbauWhyMsg, features, incomePerSec, joinMsgs, nextPlot, plotNameMsg } from './tycoon';

export const MANAGER = { name: 'Katrin Vogel', first: 'Katrin' };

/** Ein Knopf unter einer Nachricht: führt zu einem Bildschirm des Spiels */
export interface ManagerAction {
  screen: string; // entspricht den Bildschirmen der App (z. B. 'drivers', 'sponsors', 'dashboard')
  /** m()-Text, beim Anzeigen mit tx() auflösen */
  label: string;
}

export interface ManagerMsg {
  id: string;
  from: 'manager' | 'player';
  /** Nachrichten der Managerin sind m()-Texte (beim Anzeigen mit tx() auflösen), eigene Fragen des Spielers normaler Text */
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

function push(s: GameState, msg: Omit<ManagerMsg, 'id' | 'season' | 'round'>) {
  const b = box(s);
  b.messages.push({ ...msg, id: `m${s.nextId++}`, season: s.season, round: s.round });
  if (b.messages.length > MAX_MESSAGES) b.messages.splice(0, b.messages.length - MAX_MESSAGES);
}

/** Nachricht der Managerin an den Spieler (text und Aktions-Labels als m()-Texte) */
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
  const msg = box(s).messages.find((x) => x.id === id);
  if (msg) msg.ack = true;
}

/** Die erste Nachricht: stellt die Managerin vor. */
export function ensureManager(s: GameState) {
  const b = box(s);
  if (b.messages.length) return;
  managerSay(s, m('mgr.welcome', { name: MANAGER.name }));
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

/** Restlaufzeit als Satzteil ("läuft in 3 Rennen aus") für m()-Texte */
const leftMsg = (n: number) => (n <= 0 ? m('mgr.warn.leftExpired') : n === 1 ? m('mgr.warn.leftNext') : mp('mgr.warn.leftIn', n));

/**
 * Nach jedem Rennen aufrufen: schickt eine Warnung, wenn ein Vertrag (Fahrer oder Sponsor) bald endet.
 * Mehrere Verträge zur gleichen Zeit kommen in einer gemeinsamen Nachricht.
 */
export function warnContracts(s: GameState) {
  const b = box(s);
  const f = features(s);
  const lines: string[] = []; // m()-Texte, je Vertrag eine Zeile
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
      lines.push(m('mgr.warn.driverLine', { name: r.name, left: leftMsg(r.left), extra: f.drivers ? m('mgr.warn.driverExtraLounge') : m('mgr.warn.driverExtraNoLounge') }));
      news(s, m('mgr.warn.newsDriver', { name: r.name, left: leftMsg(r.left) }), 'bad');
    } else {
      sponsors = true;
      const sp = s.sponsors.find((x) => x.id === r.id)!;
      let extra = m('mgr.warn.sponsorExtraNew');
      if (level === WARN_AT[0] && sp.satisfaction >= 55 && !s.pendingEvents.some((e) => e.kind === 'extend' && e.data.sponsorId === sp.id)) {
        s.pendingEvents.push(extendEvent(s, sp));
        extra = m('mgr.warn.sponsorExtraOffer');
      } else if (level === WARN_AT[0] && sp.satisfaction < 55) extra = m('mgr.warn.sponsorExtraUnhappy');
      lines.push(m('mgr.warn.sponsorLine', { name: r.name, left: leftMsg(r.left), extra }));
      news(s, m('mgr.warn.newsSponsor', { name: r.name, left: leftMsg(r.left) }), 'neutral');
    }
  }
  if (!lines.length) return;
  const actions: ManagerAction[] = [];
  if (drivers && f.drivers) actions.push({ screen: 'drivers', label: m('mgr.action.drivers') });
  if (sponsors && f.sponsors) actions.push({ screen: 'sponsors', label: m('mgr.action.sponsorLounge') });
  managerSay(s, m('mgr.warn.intro', { lines: joinMsgs(lines) }), { urgent: true, actions });
}

/** Wurde ein Vertrag schon beendet? (Fahrer verlässt das Team, Sponsor läuft aus): Info an das Postfach (text als m()-Text) */
export function tellContractEnded(s: GameState, text: string) {
  managerSay(s, text);
}

// ---------- Antworten ----------
export interface Answer {
  /** m()-Text, beim Anzeigen mit tx() auflösen */
  text: string;
  actions?: ManagerAction[];
}

/**
 * Ein Thema der Wissensbasis. Suchwörter (Schlüssel mgr.kb.<id>.keys, Komma-getrennt, je Sprache) und Beispielfrage (mgr.kb.<id>.ask)
 * stehen im Wörterbuch, die Antwort baut reply() als m()-Text aus dem Spielstand (Schlüssel mgr.kb.<id>.reply und Varianten).
 */
interface Topic {
  id: string;
  /** Hat eine Beispielfrage (Schlüssel mgr.kb.<id>.ask) für die Auswahl über dem Eingabefeld */
  ask?: boolean;
  reply: (g: GameState) => Answer;
}

/** Kleinschreibung, ohne Umlaute und Akzente (ä → a, ue → u), damit „Prüfstand“, „Pruefstand“ und „Prufstand“ gleich zählen */
export function norm(s: string): string {
  return s
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
/** Knopf zu einem Bildschirm; das Label ist ein m()-Text */
const go = (screen: string, label: string): ManagerAction => ({ screen, label });

const TOPICS: Topic[] = [
  {
    id: 'next',
    ask: true,
    reply: (g) => {
      const next = nextPlot(g);
      const lines: string[] = [];
      if (g.round < g.calendar.length && !g.seasonEnd) lines.push(m('mgr.kb.next.race'));
      if (next) lines.push(m('mgr.kb.next.build', { name: plotNameMsg(next), why: aufbauWhyMsg(next), hint: aufbauHintMsg(g, next) }));
      else lines.push(m('mgr.kb.next.allBuilt'));
      lines.push(m('mgr.kb.next.missions'));
      return { text: m('mgr.kb.next.reply', { lines: joinMsgs(lines) }), actions: [go('dashboard', m('mgr.action.office'))] };
    },
  },
  {
    id: 'money',
    ask: true,
    reply: (g) => ({ text: m('mgr.kb.money.reply', { income: incomePerSec(g) }) }),
  },
  {
    id: 'build',
    ask: true,
    reply: (g) => ({ text: m('mgr.kb.build.reply', { key: k(g, 'interact').split(' / ')[0] }) }),
  },
  {
    id: 'unlock',
    ask: true,
    reply: (g) => {
      const next = nextPlot(g);
      if (!next) return { text: m('mgr.kb.unlock.done'), actions: [go('dashboard', m('mgr.action.office'))] };
      const list = AUFBAU.filter((a) => (g.plots[a.id] ?? 0) < 1)
        .slice(0, 4)
        .map((a) => m('mgr.kb.unlock.row', { name: plotNameMsg(a.id), req: a.races === 0 ? m('mgr.kb.unlock.now') : mp('mgr.kb.unlock.races', a.races) }));
      return {
        text: m('mgr.kb.unlock.reply', { name: plotNameMsg(next), hint: m('mgr.hint', { text: aufbauHintMsg(g, next) }), list: joinMsgs(list) }),
        actions: [go('dashboard', m('mgr.action.office'))],
      };
    },
  },
  {
    id: 'controls',
    ask: true,
    reply: (g) => ({
      text: m('mgr.kb.controls.reply', {
        up: k(g, 'up'),
        down: k(g, 'down'),
        left: k(g, 'left'),
        right: k(g, 'right'),
        boost: k(g, 'boost'),
        pit: k(g, 'pit'),
        camera: k(g, 'camera'),
        line: k(g, 'line'),
        tower: k(g, 'tower'),
        reset: k(g, 'reset'),
      }),
      actions: [go('settings', m('mgr.action.settings'))],
    }),
  },
  {
    id: 'start',
    ask: true,
    reply: (g) => ({ text: m('mgr.kb.start.reply', { up: k(g, 'up'), limit: 0.25 }) }),
  },
  {
    id: 'pit',
    ask: true,
    reply: (g) => ({ text: m('mgr.kb.pit.reply', { pit: k(g, 'pit'), fuel: k(g, 'pitFuel'), repair: k(g, 'pitRepair'), kmh: PIT_KMH }) }),
  },
  {
    id: 'tyres',
    ask: true,
    reply: (g) => ({ text: m('mgr.kb.tyres.reply', { later: features(g).tyres ? '' : m('mgr.kb.tyres.later') }) }),
  },
  {
    id: 'fuel',
    reply: () => ({ text: m('mgr.kb.fuel.reply') }),
  },
  {
    id: 'damage',
    ask: true,
    reply: (g) => ({
      text: m('mgr.kb.damage.reply', { repair: k(g, 'pitRepair') }),
      actions: features(g).garage ? [go('garage', m('mgr.action.garage'))] : undefined,
    }),
  },
  {
    id: 'quali',
    reply: (g) => ({ text: features(g).quali ? m('mgr.kb.quali.reply') : m('mgr.kb.quali.locked') }),
  },
  {
    id: 'setup',
    ask: true,
    reply: (g) => ({ text: m('mgr.kb.setup.reply', { later: features(g).setup ? '' : m('mgr.kb.setup.later') }) }),
  },
  {
    id: 'tactics',
    reply: () => ({ text: m('mgr.kb.tactics.reply') }),
  },
  {
    id: 'contracts',
    ask: true,
    reply: (g) => {
      const rows = contractRows(g);
      if (!rows.length) return { text: m('mgr.kb.contracts.none') };
      const lines = rows.map((r) => mp('mgr.kb.contracts.row', r.left, { name: r.name, kind: r.kind === 'driver' ? m('mgr.kb.contracts.kindDriver') : m('mgr.kb.contracts.kindSponsor') }));
      return {
        text: m('mgr.kb.contracts.reply', { lines: joinMsgs(lines) }),
        actions: [...(features(g).drivers ? [go('drivers', m('mgr.action.drivers'))] : []), ...(features(g).sponsors ? [go('sponsors', m('mgr.action.sponsors'))] : [])],
      };
    },
  },
  {
    id: 'sponsors',
    ask: true,
    reply: (g) => ({
      text: m('mgr.kb.sponsors.reply'),
      actions: features(g).sponsors ? [go('sponsors', m('mgr.action.sponsorLounge'))] : undefined,
    }),
  },
  {
    id: 'drivers',
    reply: (g) => ({
      text: m('mgr.kb.drivers.reply'),
      actions: features(g).drivers ? [go('drivers', m('mgr.action.drivers'))] : undefined,
    }),
  },
  {
    id: 'staff',
    reply: (g) => ({
      text: m('mgr.kb.staff.reply'),
      actions: features(g).staff ? [go('staff', m('mgr.action.staff'))] : undefined,
    }),
  },
  {
    id: 'garage',
    reply: (g) => ({
      text: m('mgr.kb.garage.reply'),
      actions: features(g).garage ? [go('garage', m('mgr.action.garage'))] : undefined,
    }),
  },
  {
    id: 'research',
    reply: (g) => ({
      text: m('mgr.kb.research.reply'),
      actions: features(g).research ? [go('research', m('mgr.action.research'))] : undefined,
    }),
  },
  {
    id: 'finance',
    reply: (g) => ({
      text: m('mgr.kb.finance.reply'),
      actions: features(g).finance ? [go('finance', m('mgr.action.finance'))] : undefined,
    }),
  },
  {
    id: 'reputation',
    reply: () => ({ text: m('mgr.kb.reputation.reply') }),
  },
  {
    id: 'season',
    ask: true,
    reply: (g) => ({
      text: m('mgr.kb.season.reply', { points: POINTS.join(' - '), races: g.calendar.length, tiers: TIERS.map((tier) => tier.name).join(', ') }),
      actions: [go('championship', m('mgr.action.championship'))],
    }),
  },
  {
    id: 'weather',
    reply: () => ({ text: m('mgr.kb.weather.reply') }),
  },
  {
    id: 'testtrack',
    reply: () => ({ text: m('mgr.kb.testtrack.reply') }),
  },
  {
    id: 'missions',
    reply: () => ({ text: m('mgr.kb.missions.reply') }),
  },
  {
    id: 'race',
    reply: () => ({ text: m('mgr.kb.race.reply'), actions: [go('race', m('mgr.action.race'))] }),
  },
  {
    id: 'save',
    ask: true,
    reply: () => ({ text: m('mgr.kb.save.reply'), actions: [go('settings', m('mgr.action.settings'))] }),
  },
  {
    id: 'offline',
    reply: () => ({ text: m('mgr.kb.offline.reply') }),
  },
  {
    id: 'view',
    reply: (g) => ({
      text: m('mgr.kb.view.reply', { camera: k(g, 'camera'), line: k(g, 'line'), tower: k(g, 'tower') }),
      actions: [go('settings', m('mgr.action.settings'))],
    }),
  },
  {
    id: 'who',
    reply: () => ({ text: m('mgr.kb.who.reply', { name: MANAGER.name }) }),
  },
  {
    id: 'thanks',
    reply: () => ({ text: m('mgr.kb.thanks.reply') }),
  },
  {
    id: 'hello',
    reply: () => ({ text: m('mgr.kb.hello.reply') }),
  },
];

/** Beispielfragen für die Schnellauswahl, in der aktuellen Sprache */
export function quickQuestions(): string[] {
  return TOPICS.filter((topic) => topic.ask).map((topic) => t(`mgr.kb.${topic.id}.ask`));
}

/** Themen, deren Beispielfragen als Vorschläge erscheinen, wenn die Managerin eine Frage nicht versteht */
const FALLBACK_HINTS = ['next', 'start', 'pit', 'contracts'];

/** Suchwörter eines Themas aus beiden Sprachen (normalisiert, ohne Doppelte), damit man in jeder Sprache fragen kann */
function topicKeys(id: string): string[] {
  const out = new Set<string>();
  for (const lang of LANGS) {
    for (const raw of tIn(lang, `mgr.kb.${id}.keys`).split(',')) {
      const nk = norm(raw);
      if (nk) out.add(nk);
    }
  }
  return [...out];
}

/** Wissensbasis durchsuchen: das Thema mit den meisten und längsten Treffern gewinnt. Die Antwort ist ein m()-Text (aktuelle Sprache beim Anzeigen). */
export function answer(g: GameState, text: string): Answer {
  const q = ` ${norm(text)} `;
  if (q.trim().length < 2) return { text: m('mgr.answer.short', { example: m('mgr.kb.pit.ask') }) };
  let best: Topic | null = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    let score = 0;
    for (const nk of topicKeys(topic.id)) {
      // Sehr kurze Schlüssel nur als ganzes Wort zählen (sonst trifft „hi“ in „nachtanken“)
      const hit = nk.length <= 3 ? q.includes(` ${nk} `) : q.includes(nk);
      if (hit) score += nk.length + (nk.includes(' ') ? 4 : 0);
    }
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  if (!best) {
    const hints = FALLBACK_HINTS.map((id) => m('mgr.bullet', { text: m(`mgr.kb.${id}.ask`) }));
    return { text: m('mgr.answer.fallback', { hints: joinMsgs(hints) }) };
  }
  return best.reply(g);
}
