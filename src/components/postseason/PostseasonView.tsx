"use client";

import { useState } from "react";
import { usePostseason } from "@/application/hooks/postseason/usePostseason";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useT } from "@/application/providers/I18nProvider";
import { GameBoxScoreContent } from "@/components/games/GameBoxScore";
import { PostseasonStatus } from "@/components/postseason/PostseasonStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  PostseasonConference,
  PostseasonGame,
  PostseasonState,
} from "@/domain/entities/Postseason";
import type { Team } from "@/domain/entities/Team";

const FIRST_ROUND = [
  [1, 8],
  [4, 5],
  [2, 7],
  [3, 6],
] as const;
const ROUNDS = [
  { label: "firstRound", round: 1, slots: [1, 2, 3, 4] },
  { label: "semifinals", round: 2, slots: [1, 2] },
  { label: "conferenceFinals", round: 3, slots: [1] },
] as const;

interface PostseasonViewProps {
  gameId: string;
  selectedTeamId: string;
}

interface BracketProps {
  state: PostseasonState;
  teams: Team[];
  onSelectGame: (game: PostseasonGame) => void;
}

interface SeriesSlotProps extends BracketProps {
  conference: PostseasonConference;
  round: number;
  slot: number;
}

function SeriesSlot({ state, teams, onSelectGame, conference, round, slot }: SeriesSlotProps) {
  const t = useT();
  const series = state.series.find(
    (series) =>
      series.conference === conference && series.round === round && series.bracketSlot === slot
  );
  const seedFor = (seed: number) =>
    state.playoffSeeds.find((entry) => entry.conference === conference && entry.seed === seed)
      ?.teamId ??
    (seed <= 6
      ? state.qualification.find((entry) => entry.conference === conference && entry.seed === seed)
          ?.teamId
      : undefined);
  const previousWinner = (previousSlot: number, previousConference = conference) =>
    state.series.find(
      (entry) =>
        entry.conference === previousConference &&
        entry.round === round - 1 &&
        entry.bracketSlot === previousSlot
    )?.winnerTeamId;
  const seeds = round === 1 ? FIRST_ROUND[slot - 1] : undefined;
  const homeId =
    series?.homeTeamId ??
    (seeds
      ? seedFor(seeds[0])
      : previousWinner(round === 4 ? 1 : slot * 2 - 1, round === 4 ? "East" : conference));
  const awayId =
    series?.awayTeamId ??
    (seeds
      ? seedFor(seeds[1])
      : previousWinner(round === 4 ? 1 : slot * 2, round === 4 ? "West" : conference));
  const games = state.games
    .filter((game) => series && game.seriesId === series.id)
    .sort((a, b) => (a.gameNumber ?? 0) - (b.gameNumber ?? 0));
  return (
    <Card size="sm" className="w-full" data-bracket-slot={`${conference}-${round}-${slot}`}>
      <CardContent className="space-y-3">
        {[homeId, awayId].map((id, index) => {
          const seed =
            state.playoffSeeds.find((seed) => seed.teamId === id)?.seed ?? seeds?.[index];
          const won = !!id && series?.winnerTeamId === id;
          return (
            <div
              key={index === 0 ? "home" : "away"}
              className={`flex items-center gap-2 ${won ? "font-bold text-primary" : ""}`}
            >
              {seed && <span className="text-xs text-muted-foreground">#{seed}</span>}
              <span className="min-w-0 flex-1">
                {id ? (teams.find((team) => team.id === id)?.name ?? id) : t("postseason", "tbd")}
              </span>
              {won && <Badge variant="outline">{t("postseason", "winner")}</Badge>}
              <span className="font-mono font-bold tabular-nums">
                {series ? (index === 0 ? series.homeWins : series.awayWins) : "—"}
                <span className="sr-only"> {t("postseason", "wins")}</span>
              </span>
            </div>
          );
        })}
        {games.length > 0 && (
          <details>
            <summary className="cursor-pointer rounded-sm py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring">
              {t("postseason", "games")}
            </summary>
            <GameResults games={games} teams={teams} onSelectGame={onSelectGame} />
          </details>
        )}
      </CardContent>
    </Card>
  );
}

interface GameResultsProps {
  games: PostseasonGame[];
  teams: Team[];
  onSelectGame: (game: PostseasonGame) => void;
}

function GameResults({ games, teams, onSelectGame }: GameResultsProps) {
  const t = useT();
  const name = (id: string) => teams.find((team) => team.id === id)?.abbreviation ?? id;
  return (
    <ul className="space-y-2 pt-2">
      {games.map((game) => (
        <li key={game.id} className="space-y-1 text-xs">
          <p>
            <time dateTime={game.gameDate}>{game.gameDate}</time> ·{" "}
            {game.stage
              ? t("postseason", game.stage)
              : `${t("postseason", "game")} ${game.gameNumber}`}
          </p>
          <p>
            {name(game.awayTeamId)} {game.awayScore ?? "—"} @ {name(game.homeTeamId)}{" "}
            {game.homeScore ?? "—"}
          </p>
          {game.winnerTeamId && (
            <p className="font-semibold">
              {t("postseason", "winner")}: {name(game.winnerTeamId)}
            </p>
          )}
          {game.status === "completed" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelectGame(game)}
              aria-label={`${t("postseason", "boxScore")} · ${name(game.awayTeamId)} @ ${name(game.homeTeamId)} · ${game.gameDate}`}
            >
              {t("boxScore", "title")}
            </Button>
          ) : (
            <span className="text-muted-foreground">{t("postseason", "scheduled")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function PlayoffBracket(props: BracketProps) {
  const t = useT();
  return (
    <div className="space-y-6">
      <p className="font-semibold">{t("postseason", "bestOfSeven")}</p>
      <p className="text-sm text-muted-foreground">{t("postseason", "homeCourt")}</p>
      {(["East", "West"] as const).map((conference) => (
        <section key={conference} aria-label={t("postseason", conference)} className="space-y-3">
          <h2 className="text-lg font-bold">{t("postseason", conference)}</h2>
          <section
            aria-label={`${t("postseason", conference)} · ${t("postseason", "title")}`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Horizontal bracket scrolling must be keyboard accessible.
            tabIndex={0}
            className="overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="grid min-w-240 grid-cols-3 gap-6 p-1">
              {ROUNDS.map(({ label, round, slots }) => (
                <div key={label} className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">{t("postseason", label)}</h3>
                  <div className="flex flex-1 flex-col justify-around gap-4">
                    {slots.map((slot) => (
                      <SeriesSlot
                        key={slot}
                        {...props}
                        conference={conference}
                        round={round}
                        slot={slot}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      ))}
      <section aria-label={t("postseason", "Finals")} className="max-w-lg space-y-3">
        <h2 className="text-lg font-bold">{t("postseason", "Finals")}</h2>
        <SeriesSlot {...props} conference="Finals" round={4} slot={1} />
      </section>
    </div>
  );
}

export function PostseasonView({ gameId, selectedTeamId }: PostseasonViewProps) {
  const t = useT();
  const query = usePostseason(gameId);
  const teams = useTeams();
  const [selectedGame, setSelectedGame] = useState<PostseasonGame | null>(null);
  if (query.isPending || teams.isPending) return <output>{t("common", "loading")}</output>;
  if (query.isError || teams.isError || !query.data || !teams.data)
    return (
      <div role="alert" className="space-y-3">
        <p>{t("postseason", "loadFailed")}</p>
        <Button
          onClick={() => {
            void query.refetch();
            void teams.refetch();
          }}
        >
          {t("postseason", "retry")}
        </Button>
      </div>
    );
  const state = query.data;
  const name = (id: string) => teams.data.find((team) => team.id === id)?.name ?? id;
  return (
    <div className="space-y-6">
      <PostseasonStatus state={state} selectedTeamId={selectedTeamId} teams={teams.data} />
      {state.games.some((game) => game.stage !== null) && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-lg font-bold">{t("postseason", "playIn")}</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {(["East", "West"] as const).map((conference) => (
                <section
                  key={conference}
                  aria-label={`${t("postseason", "playIn")} · ${t("postseason", conference)}`}
                >
                  <h3 className="font-semibold">{t("postseason", conference)}</h3>
                  <GameResults
                    games={state.games
                      .filter((game) => game.stage !== null && game.conference === conference)
                      .sort((a, b) => a.gameDate.localeCompare(b.gameDate))}
                    teams={teams.data}
                    onSelectGame={setSelectedGame}
                  />
                </section>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {state.phase !== "regular_season" && (
        <PlayoffBracket state={state} teams={teams.data} onSelectGame={setSelectedGame} />
      )}
      <Dialog open={selectedGame !== null} onOpenChange={(open) => !open && setSelectedGame(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-5xl"
        >
          <DialogHeader>
            <DialogTitle>
              {t("boxScore", "title")} · {selectedGame?.gameDate}
            </DialogTitle>
          </DialogHeader>
          {selectedGame && (
            <div className="min-h-0 overflow-y-auto">
              <GameBoxScoreContent
                key={selectedGame.id}
                gameId={gameId}
                fixtureId={selectedGame.id}
                homeLabel={name(selectedGame.homeTeamId)}
                awayLabel={name(selectedGame.awayTeamId)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
