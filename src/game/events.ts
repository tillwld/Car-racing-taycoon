// Zufallsereignisse zwischen den Rennen. Jede Entscheidung hat Konsequenzen.
import { PARTS, PART_KEYS, STAFF_ROLES, TIERS } from '../data/catalog';
import type { GameEvent, GameState, PartKey, Sponsor, StaffRole } from '../types';
import { genId, makeSponsor } from './generators';
import { academyCost, book, discoverTalent, news, playerDrivers, signAcademy } from './state';
import { chance, clamp, pick, rand } from './util';
import { TRACK_BY_ID } from '../data/tracks';

type Gen = (s: GameState) => GameEvent | null;

const m = (s: GameState, v: number) => Math.round((v * TIERS[s.tier].money) / 1000) * 1000;
const eur = (v: number) => `${v.toLocaleString('de-DE')} €`;

/** Verlängerungsangebot eines zufriedenen Sponsors (auch von der Managerin vor Vertragsende ausgelöst) */
export function extendEvent(s: GameState, sp: Sponsor): GameEvent {
  void s;
  return {
    id: genId('ev'),
    kind: 'extend',
    title: `${sp.name} möchte verlängern`,
    text: `${sp.name} ist zufrieden und bietet eine Verlängerung um 7 Rennen zu 10 % besseren Konditionen an.`,
    choices: [
      { label: 'Verlängern', detail: `${eur(Math.round(sp.perRace * 1.1))} pro Rennen`, effect: 'accept' },
      { label: 'Auslaufen lassen', detail: 'Platz für neue Sponsoren', effect: 'decline' },
    ],
    data: { sponsorId: sp.id },
  };
}

const GENERATORS: Gen[] = [
  (s) => {
    const sp = makeSponsor(s, 'secondary');
    const reward = m(s, rand(25000, 45000));
    const target = pick([5, 8, 10]);
    return {
      id: genId('ev'),
      kind: 'sponsorBonus',
      title: 'Kurzfristiges Sponsorangebot',
      text: `${sp.name} bietet einen Sonderbonus von ${eur(reward)}, wenn ein Fahrer beim nächsten Rennen mindestens Platz ${target} erreicht. Verfehlt ihr das Ziel, leidet euer Ruf.`,
      choices: [
        { label: 'Annehmen', detail: `+${eur(reward)} bei Erfolg, −3 Reputation bei Misserfolg`, effect: 'accept' },
        { label: 'Ablehnen', detail: 'Keine Auswirkungen', effect: 'decline' },
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
      title: `${d.name} fordert mehr Gehalt`,
      text: `Nach den letzten Leistungen verlangt ${d.name} eine Gehaltserhöhung um ${eur(raise)} pro Rennen.`,
      choices: [
        { label: 'Erhöhung gewähren', detail: `+${eur(raise)} Gehalt pro Rennen, Moral steigt deutlich`, effect: 'accept' },
        { label: 'Leistungsbonus anbieten', detail: 'Halbe Erhöhung, Moral steigt leicht', effect: 'half' },
        { label: 'Ablehnen', detail: 'Moral sinkt, Konstanz leidet', effect: 'decline' },
      ],
      data: { driverId: d.id, raise },
    };
  },
  (s) => {
    const cost = m(s, 40000);
    return {
      id: genId('ev'),
      kind: 'engineFailure',
      title: 'Motorschaden bei Testfahrt',
      text: 'Bei einer Testfahrt vor dem nächsten Rennen ist der Motor hochgegangen. Die Mechaniker können ihn notdürftig flicken oder ein neues Aggregat einbauen.',
      choices: [
        { label: 'Neuen Motor einbauen', detail: `Kosten ${eur(cost)}, Motor wie neu`, effect: 'replace', cost },
        { label: 'Flicken und hoffen', detail: 'Kostenlos, Motorzustand −30 %, höheres Ausfallrisiko', effect: 'patch' },
      ],
      data: { cost },
    };
  },
  (s) => {
    if (s.academy.length >= 3) return null;
    return {
      id: genId('ev'),
      kind: 'talent',
      title: 'Nachwuchstalent entdeckt',
      text: 'Dein Scout hat bei einem Kartrennen ein außergewöhnliches Talent entdeckt. Andere Teams sind bereits interessiert.',
      choices: [
        { label: 'In die Akademie holen', detail: `Kosten ${eur(academyCost(s))}, entwickelt sich jedes Rennen`, effect: 'academy', cost: academyCost(s) },
        { label: 'Auf die Beobachtungsliste', detail: 'Erscheint auf dem Fahrermarkt', effect: 'watch' },
      ],
      data: {},
    };
  },
  (s) => {
    const part = pick(PART_KEYS);
    const cost = m(s, 50000);
    return {
      id: genId('ev'),
      kind: 'tech',
      title: 'Idee aus der Entwicklungsabteilung',
      text: `Ein Ingenieur hat eine vielversprechende Idee für das Bauteil „${PARTS[part].label}“. Mit etwas Budget könnte daraus sofort ein Upgrade werden – Erfolg ist aber nicht garantiert.`,
      choices: [
        { label: 'Investieren', detail: `Kosten ${eur(cost)}, 70 % Chance auf +1 Stufe`, effect: 'invest', cost },
        { label: 'Ablehnen', detail: 'Keine Kosten', effect: 'decline' },
      ],
      data: { part, cost },
    };
  },
  (s) => {
    const next = s.calendar[s.round];
    if (!next) return null;
    const cost = m(s, 15000);
    return {
      id: genId('ev'),
      kind: 'weather',
      title: 'Unwetterwarnung',
      text: `Für ${TRACK_BY_ID[next].name} ist Regen angesagt. Ein Regentest im Simulator würde dem Team helfen, das Auto für nasse Bedingungen abzustimmen.`,
      choices: [
        { label: 'Regentest durchführen', detail: `Kosten ${eur(cost)}, Regen sicher, +20 Setup-Wissen`, effect: 'test', cost },
        { label: 'Ignorieren', detail: 'Es wird trotzdem regnen', effect: 'ignore' },
      ],
      data: { cost },
    };
  },
  (s) => {
    const cost = m(s, 28000);
    return {
      id: genId('ev'),
      kind: 'testCrash',
      title: 'Unfall bei Werbefahrt',
      text: 'Bei einer Demofahrt für Sponsoren ist das Auto in die Streckenbegrenzung gerutscht. Frontflügel und Aufhängung sind beschädigt.',
      choices: [
        { label: 'Sofort reparieren', detail: `Kosten ${eur(cost)}`, effect: 'repair', cost },
        { label: 'Später reparieren', detail: 'Frontflügel −40 %, Fahrwerk −20 % Zustand', effect: 'later' },
      ],
      data: { cost },
    };
  },
  () => ({
    id: genId('ev'),
    kind: 'media',
    title: 'Pressekonferenz',
    text: 'Die Journalisten wollen wissen, was ihr euch für das nächste Rennen vornehmt.',
    choices: [
      { label: 'Bescheiden bleiben', detail: '+1 Reputation', effect: 'humble' },
      { label: 'Kampfansage', detail: '+4 Reputation, −5 bei einem Rennen ohne Punkte', effect: 'bold' },
    ],
    data: {},
  }),
  (s) => {
    const cost = m(s, 20000);
    return {
      id: genId('ev'),
      kind: 'fans',
      title: 'Fan-Tag in der Fabrik',
      text: 'Der Fanclub fragt, ob ihr einen Tag der offenen Tür organisiert.',
      choices: [
        { label: 'Fan-Tag ausrichten', detail: `Kosten ${eur(cost)}, +3 Reputation`, effect: 'host', cost },
        { label: 'Absagen', detail: '−1 Reputation', effect: 'decline' },
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
    return {
      id: genId('ev'),
      kind: 'poach',
      title: 'Abwerbeversuch',
      text: `Ein Konkurrenzteam will ${st.name} (${STAFF_ROLES[role].label}) abwerben.`,
      choices: [
        { label: 'Gehalt erhöhen', detail: `+${eur(raise)} pro Rennen`, effect: 'keep' },
        { label: 'Gehen lassen', detail: `${STAFF_ROLES[role].label} verlässt das Team, Ablöse ${eur(st.salary * 3)}`, effect: 'release' },
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
        news(s, `${dr.name} ist verärgert.`, 'bad');
      }
      break;
    }
    case 'engineFailure':
      if (effect === 'replace') {
        if (!pay(d.cost, 'Neuer Motor')) return 'Nicht genug Budget.';
        s.car.condition.engine = 1;
      } else {
        s.car.condition.engine = Math.max(0.1, s.car.condition.engine - 0.3);
        s.flags.engineRisk = true;
      }
      break;
    case 'talent': {
      const t = discoverTalent(s);
      if (effect === 'academy') {
        const err = signAcademy(s, t.id);
        if (err) return err;
      } else news(s, `${t.name} steht jetzt auf dem Fahrermarkt.`, 'neutral');
      break;
    }
    case 'tech':
      if (effect === 'invest') {
        if (!pay(d.cost, 'Entwicklungsidee')) return 'Nicht genug Budget.';
        if (Math.random() < 0.7) {
          const p = d.part as PartKey;
          s.car.parts[p] = Math.min(10, s.car.parts[p] + 1);
          news(s, `Durchbruch! ${PARTS[p].label} steigt auf Stufe ${s.car.parts[p]}.`, 'good');
        } else news(s, 'Die Idee hat leider nicht funktioniert.', 'bad');
      }
      break;
    case 'weather':
      s.flags.forceRain = true;
      if (effect === 'test') {
        if (!pay(d.cost, 'Regentest')) return 'Nicht genug Budget.';
        s.flags.setupBonus = 20;
      }
      break;
    case 'testCrash':
      if (effect === 'repair') {
        if (!pay(d.cost, 'Reparatur nach Unfall')) return 'Nicht genug Budget.';
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
        if (!pay(d.cost, 'Fan-Tag')) return 'Nicht genug Budget.';
        s.reputation = clamp(s.reputation + 3, 0, 100);
      } else s.reputation = clamp(s.reputation - 1, 0, 100);
      break;
    case 'poach': {
      const st = s.staff[d.role as StaffRole];
      if (!st) break;
      if (effect === 'keep') st.salary += d.raise;
      else {
        book(s, `Ablöse für ${st.name}`, st.salary * 3, 'event');
        delete s.staff[d.role as StaffRole];
        news(s, `${st.name} wechselt zur Konkurrenz.`, 'bad');
      }
      break;
    }
    case 'extend': {
      const sp = s.sponsors.find((x) => x.id === d.sponsorId);
      if (sp && effect === 'accept') {
        sp.races += 7;
        sp.perRace = Math.round((sp.perRace * 1.1) / 1000) * 1000;
        news(s, `${sp.name} verlängert.`, 'good');
      }
      break;
    }
  }
  s.pendingEvents = s.pendingEvents.filter((e) => e.id !== id);
  return null;
}
