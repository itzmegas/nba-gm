import type { LeagueStanding } from "@/domain/entities/LeagueStanding";
import type { Team } from "@/domain/entities/Team";

export function selectConferenceStandings(
  standings: LeagueStanding[],
  teams: Team[],
  teamId: string
) {
  const conference = teams.find((team) => team.id === teamId)?.conference;
  if (!conference) return [];
  return selectLeagueStandings(
    standings,
    teams.filter((team) => team.conference === conference)
  );
}

export function selectLeagueStandings(standings: LeagueStanding[], teams: Team[]) {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  return standings
    .filter((standing) => teamsById.has(standing.teamId))
    .sort((a, b) => {
      // shortcut: ties use wins and abbreviation; add NBA tiebreakers when head-to-head records are modeled.
      const aPct = a.wins / (a.wins + a.losses || 1);
      const bPct = b.wins / (b.wins + b.losses || 1);
      return (
        bPct - aPct ||
        b.wins - a.wins ||
        (teamsById.get(a.teamId)?.abbreviation ?? "").localeCompare(
          teamsById.get(b.teamId)?.abbreviation ?? "",
          "en"
        )
      );
    });
}
