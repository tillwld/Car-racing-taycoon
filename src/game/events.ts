// Zufallsereignisse zwischen den Rennen. Jede Entscheidung hat Konsequenzen.
// Alle Texte der Ereignisse sind m()-Texte (liegen im Spielstand und werden erst beim Anzeigen mit tx() übersetzt).
import { PART_KEYS, TIERS } from '../data/catalog';
import { m, t } from '../i18n';
import type { GameEvent, GameState, PartKey, Sponsor, StaffRole } from '../types';
import { genId, makeSponsor } from './generators';
import { academyCost, book, cat, discoverTalent, news, playerDrivers, signAcademy } from './state';
import { chance, clamp, pick, rand } from './util';
import { TRACK_BY_ID } from '../data/tracks';

type Gen = (s: GameState) => GameEvent | null;

/** Betrag an die Rennklasse anpassen (auf Tausender gerundet) */
const scaled = (s: GameState, v: number) => Math.round((v * TIERS[s.tier].money) / 1000) * 1000;

/** Verlängerungsangebot eines zufriedenen Sponsors (auch von der Managerin vor Vertragsende ausgelöst) */
export function extendEvent(s: GameState, sp: Sponsor): GameEvent {
  void s;
  return {
    id: genId('ev'),
    kind: 'extend',
    title: m('events.extend.title', { name: sp.name }),
    text: m('events.extend.text', { name: sp.name }),
    choices: [
      { label: m('events.extend.accept.label'), detail: m('events.extend.accept.detail', { amount: Math.round(sp.perRace * 1.1) }), effect: 'accept' },
      { label: m('events.extend.decline.label'), detail: m('events.extend.decline.detail'), effect: 'decline' },
    ],
    data: { sponsorId: sp.id },
  };
}

const GENERATORS: Gen[] = [
  (s) => {
    const sp = makeSponsor(s, 'secondary');
    const reward = scaled(s, rand(25000, 45000));
    const target = pick([5, 8, 10]);
    return {
      id: genId('ev'),
      kind: 'sponsorBonus',
      title: m('events.sponsorBonus.title'),
      text: m('events.sponsorBonus.text', { name: sp.name, reward, target }),
      choices: [
        { label: m('events.sponsorBonus.accept.label'), detail: m('events.sponsorBonus.accept.detail', { reward }), effect: 'accept' },
        { label: m('events.sponsorBonus.decline.label'), detail: m('events.sponsorBonus.decline.detail'), effect: 'decline' },
      ],
      data: { name: sp.name, reward, target },
    };
  },
  (s) => {
    const ds = playerDrivers(s).filter((d) => d.morale < 85);
    if (!ds.length) return null;
    const d = pick(ds);
    const raise = Math.round((d.salary * 0.25) / 500) * 500 || 1000;
    return {
      id: genId('ev'),
      kind: 'salaryDemand',
      title: m('events.salaryDemand.title', { name: d.name }),
      text: m('events.salaryDemand.text', { name: d.name, raise }),
      choices: [
        { label: m('events.salaryDemand.accept.label'), detail: m('events.salaryDemand.accept.detail', { raise }), effect: 'accept' },
        { label: m('events.salaryDemand.half.label'), detail: m('events.salaryDemand.half.detail'), effect: 'half' },
        { label: m('events.salaryDemand.decline.label'), detail: m('events.salaryDemand.decline.detail'), effect: 'decline' },
      ],
      data: { driverId: d.id, raise },
    };
  },
  (s) => {
    const cost = scaled(s, 40000);
    return {
      id: genId('ev'),
      kind: 'engineFailure',
      title: m('events.engineFailure.title'),
      text: m('events.engineFailure.text'),
      choices: [
        { label: m('events.engineFailure.replace.label'), detail: m('events.engineFailure.replace.detail', { cost }), effect: 'replace', cost },
        { label: m('events.engineFailure.patch.label'), detail: m('events.engineFailure.patch.detail'), effect: 'patch' },
      ],
      data: { cost },
    };
  },
  (s) => {
    if (s.academy.length >= 3) return null;
    return {
      id: genId('ev'),
      kind: 'talent',
      title: m('events.talent.title'),
      text: m('events.talent.text'),
      choices: [
        { label: m('events.talent.academy.label'), detail: m('events.talent.academy.detail', { cost: academyCost(s) }), effect: 'academy', cost: academyCost(s) },
        { label: m('events.talent.watch.label'), detail: m('events.talent.watch.detail'), effect: 'watch' },
      ],
      data: {},
    };
  },
  (s) => {
    const part = pick(PART_KEYS);
    const cost = scaled(s, 50000);
    return {
      id: genId('ev'),
      kind: 'tech',
      title: m('events.tech.title'),
      text: m('events.tech.text', { part: cat('part', part, 'label') }),
      choices: [
        { label: m('events.tech.invest.label'), detail: m('events.tech.invest.detail', { cost }), effect: 'invest', cost },
        { label: m('events.tech.decline.label'), detail: m('events.tech.decline.detail'), effect: 'decline' },
      ],
      data: { part, cost },
    };
  },
  (s) => {
    const next = s.calendar[s.round];
    if (!next) return null;
    const cost = scaled(s, 15000);
    return {
      id: genId('ev'),
      kind: 'weather',
      title: m('events.weather.title'),
      text: m('events.weather.text', { track: TRACK_BY_ID[next].name }),
      choices: [
        { label: m('events.weather.test.label'), detail: m('events.weather.test.detail', { cost }), effect: 'test', cost },
        { label: m('events.weather.ignore.label'), detail: m('events.weather.ignore.detail'), effect: 'ignore' },
      ],
      data: { cost },
    };
  },
  (s) => {
    const cost = scaled(s, 28000);
    return {
      id: genId('ev'),
      kind: 'testCrash',
      title: m('events.testCrash.title'),
      text: m('events.testCrash.text'),
      choices: [
        { label: m('events.testCrash.repair.label'), detail: m('events.testCrash.repair.detail', { cost }), effect: 'repair', cost },
        { label: m('events.testCrash.later.label'), detail: m('events.testCrash.later.detail'), effect: 'later' },
      ],
      data: { cost },
    };
  },
  () => ({
    id: genId('ev'),
    kind: 'media',
    title: m('events.media.title'),
    text: m('events.media.text'),
    choices: [
      { label: m('events.media.humble.label'), detail: m('events.media.humble.detail'), effect: 'humble' },
      { label: m('events.media.bold.label'), detail: m('events.media.bold.detail'), effect: 'bold' },
    ],
    data: {},
  }),
  (s) => {
    const cost = scaled(s, 20000);
    return {
      id: genId('ev'),
      kind: 'fans',
      title: m('events.fans.title'),
      text: m('events.fans.text'),
      choices: [
        { label: m('events.fans.host.label'), detail: m('events.fans.host.detail', { cost }), effect: 'host', cost },
        { label: m('events.fans.decline.label'), detail: m('events.fans.decline.detail'), effect: 'decline' },
      ],
      data: { cost },
    };
  },
  (s) => {
    const roles = (Object.keys(s.staff) as StaffRole[]).filter((r) => (s.staff[r]?.skill ?? 0) >= 50);
    if (!roles.length) return null;
    const role = pick(roles);
    const st = s.staff[role]!;
    const raise = Math.round((st.salary * 0.3) / 250) * 250;
    const roleName = cat('staffRole', role, 'label');
    return {
      id: genId('ev'),
      kind: 'poach',
      title: m('events.poach.title'),
      text: m('events.poach.text', { name: st.name, role: roleName }),
      choices: [
        { label: m('events.poach.keep.label'), detail: m('events.poach.keep.detail', { raise }), effect: 'keep' },
        { label: m('events.poach.release.label'), detail: m('events.poach.release.detail', { role: roleName, fee: st.salary * 3 }), effect: 'release' },
      ],
      data: { role, raise },
    };
  },
  (s) => {
    const sp = s.sponsors.find((x) => x.races <= 2 && x.satisfaction >= 55);
    return sp ? extendEvent(s, sp) : null;
  },
];

export function maybeGenerateEvents(s: GameState) {
  // Ereignisse setzen Wissen über viele Funktionen voraus: erst nach den ersten Rennen
  if (s.stats.races < 3) return;
  // Verlängerungsangebot hat Vorrang
  const ext = GENERATORS[GENERATORS.length - 1](s);
  if (ext && chance(0.8)) {
    s.pendingEvents.push(ext);
    return;
  }
  if (!chance(0.55)) return;
  for (let i = 0; i < 6; i++) {
    const ev = pick(GENERATORS.slice(0, -1))(s);
    if (ev && !s.pendingEvents.some((e) => e.kind === ev.kind)) {
      s.pendingEvents.push(ev);
      return;
    }
  }
}

export function resolveEvent(s: GameState, id: string, effect: string): string | null {
  const ev = s.pendingEvents.find((e) => e.id === id);
  if (!ev) return null;
  const d = ev.data;
  const pay = (v: number, label: string) => {
    if (s.money < v) return false;
    book(s, label, -v, 'event');
    return true;
  };
  switch (ev.kind) {
    case 'sponsorBonus':
      if (effect === 'accept') s.flags.challenge = { target: d.target, reward: d.reward, penalty: 3, name: d.name };
      break;
    case 'salaryDemand': {
      const dr = s.drivers[d.driverId];
      if (!dr) break;
      if (effect === 'accept') {
        dr.salary += d.raise;
        dr.morale = clamp(dr.morale + 20, 0, 100);
      } else if (effect === 'half') {
        dr.salary += Math.round(d.raise / 2 / 500) * 500;
        dr.morale = clamp(dr.morale + 8, 0, 100);
      } else {
        dr.morale = clamp(dr.morale - 18, 0, 100);
        dr.stats.consistency = Math.max(15, dr.stats.consistency - 3);
        news(s, m('events.news.upset', { name: dr.name }), 'bad');
      }
      break;
    }
    case 'engineFailure':
      if (effect === 'replace') {
        if (!pay(d.cost, m('events.ledger.newEngine'))) return t('events.err.budget');
        s.car.condition.engine = 1;
      } else {
        s.car.condition.engine = Math.max(0.1, s.car.condition.engine - 0.3);
        s.flags.engineRisk = true;
      }
      break;
    case 'talent': {
      const tal = discoverTalent(s);
      if (effect === 'academy') {
        const err = signAcademy(s, tal.id);
        if (err) return err;
      } else news(s, m('events.news.onMarket', { name: tal.name }), 'neutral');
      break;
    }
    case 'tech':
      if (effect === 'invest') {
        if (!pay(d.cost, m('events.ledger.techIdea'))) return t('events.err.budget');
        if (Math.random() < 0.7) {
          const p = d.part as PartKey;
          s.car.parts[p] = Math.min(10, s.car.parts[p] + 1);
          news(s, m('events.news.breakthrough', { part: cat('part', p, 'label'), level: s.car.parts[p] }), 'good');
        } else news(s, m('events.news.ideaFailed'), 'bad');
      }
      break;
    case 'weather':
      s.flags.forceRain = true;
      if (effect === 'test') {
        if (!pay(d.cost, m('events.ledger.rainTest'))) return t('events.err.budget');
        s.flags.setupBonus = 20;
      }
      break;
    case 'testCrash':
      if (effect === 'repair') {
        if (!pay(d.cost, m('events.ledger.crashRepair'))) return t('events.err.budget');
      } else {
        s.car.condition.frontWing = Math.max(0.1, s.car.condition.frontWing - 0.4);
        s.car.condition.suspension = Math.max(0.1, s.car.condition.suspension - 0.2);
      }
      break;
    case 'media':
      if (effect === 'humble') s.reputation = clamp(s.reputation + 1, 0, 100);
      else {
        s.reputation = clamp(s.reputation + 4, 0, 100);
        s.flags.bold = true;
      }
      break;
    case 'fans':
      if (effect === 'host') {
        if (!pay(d.cost, m('events.ledger.fanDay'))) return t('events.err.budget');
        s.reputation = clamp(s.reputation + 3, 0, 100);
      } else s.reputation = clamp(s.reputation - 1, 0, 100);
      break;
    case 'poach': {
      const st = s.staff[d.role as StaffRole];
      if (!st) break;
      if (effect === 'keep') st.salary += d.raise;
      else {
        book(s, m('events.ledger.transferFee', { name: st.name }), st.salary * 3, 'event');
        delete s.staff[d.role as StaffRole];
        news(s, m('events.news.poached', { name: st.name }), 'bad');
      }
      break;
    }
    case 'extend': {
      const sp = s.sponsors.find((x) => x.id === d.sponsorId);
      if (sp && effect === 'accept') {
        sp.races += 7;
        sp.perRace = Math.round((sp.perRace * 1.1) / 1000) * 1000;
        news(s, m('events.news.extended', { name: sp.name }), 'good');
      }
      break;
    }
  }
  s.pendingEvents = s.pendingEvents.filter((e) => e.id !== id);
  return null;
}
