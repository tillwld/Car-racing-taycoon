import { t } from '../i18n';
import type { GameState, Team } from '../types';
import { playerCarStats } from './carModel';

export interface DriverStanding {
  driverId: string;
  name: string;
  teamId: string;
  points: number;
  wins: number;
  podiums: number;
  fastest: number;
  poles: number;
  best: number;
  results: (number | null)[];
}

export interface TeamStanding {
  teamId: string;
  name: string;
  short: string;
  color: string;
  points: number;
  wins: number;
  podiums: number;
}

export function allTeams(s: GameState): Team[] {
  const p: Team = { ...s.team, carStats: s.car.chassisId ? playerCarStats(s) : s.team.carStats };
  return [p, ...s.aiTeams];
}

export function teamById(s: GameState, id: string): Team | undefined {
  if (id === 'player') return allTeams(s)[0];
  return s.aiTeams.find((tm) => tm.id === id);
}

export function computeStandings(s: GameState) {
  const teams = allTeams(s);
  const dmap = new Map<string, DriverStanding>();
  const tmap = new Map<string, TeamStanding>();
  for (const team of teams) {
    tmap.set(team.id, { teamId: team.id, name: team.name, short: team.short, color: team.color, points: 0, wins: 0, podiums: 0 });
    for (const id of team.driverIds) {
      const d = s.drivers[id];
      if (!d) continue;
      dmap.set(id, { driverId: id, name: d.name, teamId: team.id, points: 0, wins: 0, podiums: 0, fastest: 0, poles: 0, best: 99, results: [] });
    }
  }
  const rounds = s.results.length;
  s.results.forEach((r, ri) => {
    for (const e of r.entries) {
      let ds = dmap.get(e.driverId);
      if (!ds) {
        const d = s.drivers[e.driverId];
        ds = { driverId: e.driverId, name: d?.name ?? t('season.formerDriver'), teamId: e.teamId, points: 0, wins: 0, podiums: 0, fastest: 0, poles: 0, best: 99, results: [] };
        dmap.set(e.driverId, ds);
      }
      while (ds.results.length < ri) ds.results.push(null);
      ds.results.push(e.dnf ? 0 : e.pos);
      ds.points += e.points;
      if (!e.dnf && e.pos === 1) ds.wins++;
      if (!e.dnf && e.pos <= 3) ds.podiums++;
      if (e.fastest) ds.fastest++;
      if (e.grid === 1) ds.poles++;
      if (!e.dnf) ds.best = Math.min(ds.best, e.pos);
      const ts = tmap.get(e.teamId);
      if (ts) {
        ts.points += e.points;
        if (!e.dnf && e.pos === 1) ts.wins++;
        if (!e.dnf && e.pos <= 3) ts.podiums++;
      }
    }
  });
  for (const ds of dmap.values()) while (ds.results.length < rounds) ds.results.push(null);
  const drivers = [...dmap.values()]
    .filter((d) => d.results.some((x) => x !== null) || teams.some((tm) => tm.driverIds.includes(d.driverId)))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.best - b.best);
  const teamList = [...tmap.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
  return { drivers, teams: teamList };
}

export function playerTeamPosition(s: GameState) {
  const st = computeStandings(s);
  return st.teams.findIndex((tm) => tm.teamId === 'player') + 1;
}
