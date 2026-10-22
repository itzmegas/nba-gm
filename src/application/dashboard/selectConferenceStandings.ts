import type { LeagueStanding } from "@/domain/entities/LeagueStanding";
import type { Team } from "@/domain/entities/Team";

export function selectConferenceStandings(
  standings: LeagueStanding[],
  teams: Team[],
  teamId: string
) {
  const conference = teams.find((team) => team.id === teamId)?.conference;
  if (!conference) return [];
  const conferenceTeams = new Map(
    teams.filter((team) => team.conference === conference).map((team) => [team.id, team])
  );
  return standings
    .filter((standing) => conferenceTeams.has(standing.teamId))
    .sort((a, b) => {
      // shortcut: ties use wins and abbreviation; add NBA tiebreakers when head-to-head records are modeled.
      const aPct = a.wins / (a.wins + a.losses || 1);
      const bPct = b.wins / (b.wins + b.losses || 1);
      return (
        bPct - aPct ||
        b.wins - a.wins ||
        (conferenceTeams.get(a.teamId)?.abbreviation ?? "").localeCompare(
          conferenceTeams.get(b.teamId)?.abbreviation ?? "",
          "en"
        )
      );
    });
}
