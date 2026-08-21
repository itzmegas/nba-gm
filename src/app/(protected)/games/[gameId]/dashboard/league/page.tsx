"use client";

import { Globe, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useGame } from "@/application/hooks/games/useGame";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useT } from "@/application/providers/I18nProvider";
import { RosterTable } from "@/components/roster/roster-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeaguePageProps {
  params: Promise<{ gameId: string }>;
}

export default function LeaguePage({ params }: LeaguePageProps) {
  const { gameId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [teamSearch, setTeamSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const { data: game, isLoading: isLoadingGame } = useGame(gameId);
  const { data: teams, isLoading: isLoadingTeams } = useTeams();
  const requestedTeamId = searchParams.get("teamId");
  const fallbackTeamId =
    teams?.find((team) => team.id === game?.selectedTeamId)?.id ?? teams?.[0]?.id;
  const selectedTeamId =
    teams?.find((team) => team.id === requestedTeamId)?.id ?? fallbackTeamId ?? null;
  const selectedTeam = teams?.find((team) => team.id === selectedTeamId);
  const { data: rosterPlayers, isLoading: isLoadingRoster } = useRoster(gameId, selectedTeamId);
  const t = useT();

  useEffect(() => {
    if (!teams || !game || !selectedTeamId || requestedTeamId === selectedTeamId) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("teamId", selectedTeamId);
    router.replace(`?${nextParams.toString()}`);
  }, [game, requestedTeamId, router, searchParams, selectedTeamId, teams]);

  const normalizedTeamSearch = teamSearch.trim().toLowerCase();
  const filteredTeams = (teams ?? []).filter((team) =>
    [team.name, team.city, team.abbreviation].some((value) =>
      value.toLowerCase().includes(normalizedTeamSearch)
    )
  );
  const filteredPlayers = (rosterPlayers ?? []).filter(({ player }) =>
    player.fullName.toLowerCase().includes(playerSearch.trim().toLowerCase())
  );

  if (isLoadingGame || isLoadingTeams || !game) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">{t("common", "loading")}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("dashboard", "league")}</h1>
          <p className="text-muted-foreground">{t("dashboard", "currentSeasonGames")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard", "selectTeam")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={teamSearch}
              onChange={(event) => setTeamSearch(event.target.value)}
              placeholder={t("dashboard", "searchTeam")}
              className="pl-9"
            />
          </div>
          <Select
            value={selectedTeamId ?? undefined}
            onValueChange={(teamId) => {
              const nextParams = new URLSearchParams(searchParams.toString());
              nextParams.set("teamId", teamId);
              router.replace(`?${nextParams.toString()}`);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("dashboard", "chooseTeam")} />
            </SelectTrigger>
            <SelectContent>
              {filteredTeams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.city} {team.name} ({team.abbreviation})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filteredTeams.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("dashboard", "noMatchingTeams")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>
              {selectedTeam
                ? `${selectedTeam.city} ${selectedTeam.name}`
                : t("dashboard", "rosterFallback")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("dashboard", "season")} {game.seasonYear}
            </p>
          </div>
          <Badge variant="outline">
            {rosterPlayers?.length ?? 0} {t("dashboard", "playersCount")}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 p-0 pb-4">
          <div className="px-6">
            <Input
              value={playerSearch}
              onChange={(event) => setPlayerSearch(event.target.value)}
              placeholder={t("dashboard", "rosterSearch")}
              aria-label={t("dashboard", "rosterSearch")}
            />
          </div>
          {isLoadingRoster ? (
            <p className="px-6 py-12 text-center text-muted-foreground">{t("common", "loading")}</p>
          ) : !rosterPlayers?.length ? (
            <p className="px-6 py-12 text-center text-muted-foreground">
              {t("dashboard", "noPlayersRoster")}
            </p>
          ) : !filteredPlayers.length ? (
            <p className="px-6 py-12 text-center text-muted-foreground">
              {t("dashboard", "noMatchingTeams")}
            </p>
          ) : (
            <RosterTable
              gameId={gameId}
              players={filteredPlayers}
              seasonYear={game.seasonYear}
              leagueTeamId={selectedTeamId ?? undefined}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
