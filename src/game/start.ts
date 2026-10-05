// Schnellstart: Ein neues Team bekommt sofort ein Auto, zwei Fahrer und einen Sponsor, damit es ohne Menüs losgehen kann.
import type { GameState, Settings } from '../types';
import { createGame, driverRequiredRep, type TeamSetup } from './state';
import { driverRating } from './generators';
import { queueTip, START_MONEY } from './tycoon';

export function createQuickGame(setup: TeamSetup, settings?: Settings): GameState {
  const s = createGame(setup, settings);
  s.money = START_MONEY;
  s.car.chassisId = 'kestrel';

  // Zwei bezahlbare Fahrer: die besten, deren Gehalt noch im Rahmen liegt
  const pool = s.driverMarket
    .map((id) => s.drivers[id])
    .filter((d) => d && !d.academy && s.reputation + 30 >= driverRequiredRep(s, d))
    .sort((a, b) => driverRating(b) - driverRating(a));
  const cheap = pool.filter((d) => d.salary <= 11000);
  const picks = [...cheap, ...pool.filter((d) => !cheap.includes(d)).sort((a, b) => a.salary - b.salary)].slice(0, 2);
  picks.sort((a, b) => driverRating(b) - driverRating(a));
  for (const d of picks) {
    d.teamId = 'player';
    d.contract = 12;
    s.team.driverIds.push(d.id);
  }
  s.driverMarket = s.driverMarket.filter((id) => !s.team.driverIds.includes(id));

  // Der leichteste Hauptsponsor, ohne Unterschriftsprämie
  const offer = s.sponsorOffers.find((o) => o.slot === 'main' && s.reputation >= o.minReputation) ?? s.sponsorOffers.find((o) => o.slot === 'main');
  if (offer) {
    s.sponsors.push({ ...offer, satisfaction: 70, misses: 0 });
    s.sponsorOffers = s.sponsorOffers.filter((o) => o.id !== offer.id);
  }

  s.flags.missions = {};
  queueTip(s, 'welcome');
  return s;
}
