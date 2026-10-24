"use client";

import { useT } from "@/application/providers/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  hasPostseasonChampion,
  isPlayoffsReady,
  isTeamEliminated,
  POSTSEASON_PHASE,
  type PostseasonState,
} from "@/domain/entities/Postseason";
import type { Team } from "@/domain/entities/Team";

interface PostseasonStatusProps {
  state: PostseasonState;
  selectedTeamId: string;
  teams: Team[];
}

export function PostseasonStatus({ state, selectedTeamId, teams }: PostseasonStatusProps) {
  const t = useT();
  const qualification = state.qualification.find((seed) => seed.teamId === selectedTeamId);
  const playoffSeed = state.playoffSeeds.find((seed) => seed.teamId === selectedTeamId);
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name ?? id;
  return (
    <Card>
      <CardContent className="space-y-3" aria-live="polite">
        <Badge variant="secondary">
          {t("postseason", isPlayoffsReady(state) ? "ready" : state.phase)}
        </Badge>
        {state.phase === POSTSEASON_PHASE.REGULAR_SEASON && (
          <p>{t("postseason", "regularDescription")}</p>
        )}
        {isPlayoffsReady(state) && <p>{t("postseason", "readyDescription")}</p>}
        {qualification && (
          <p>
            {t("postseason", "qualification")}: #{qualification.seed} ·{" "}
            {t("postseason", qualification.conference)}
          </p>
        )}
        {playoffSeed && (
          <p>
            {t("postseason", "playoffSeed")}: #{playoffSeed.seed}
          </p>
        )}
        {isTeamEliminated(state, selectedTeamId) && (
          <p>{t("postseason", hasPostseasonChampion(state) ? "eliminatedShort" : "eliminated")}</p>
        )}
        {hasPostseasonChampion(state) && state.championTeamId && (
          <div className="space-y-2">
            <p className="text-xl font-bold">
              {t("postseason", "champion")}: {teamName(state.championTeamId)}
            </p>
            {state.runnerUpTeamId && (
              <p>
                {t("postseason", "runnerUp")}: {teamName(state.runnerUpTeamId)}
              </p>
            )}
            <p className="text-muted-foreground">{t("postseason", "noRollover")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
