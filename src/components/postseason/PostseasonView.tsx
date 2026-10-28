"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { usePostseason } from "@/application/hooks/postseason/usePostseason";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useT } from "@/application/providers/I18nProvider";
import { GameBoxScoreContent } from "@/components/games/GameBoxScore";
import { OffseasonPanel } from "@/components/offseason/OffseasonPanel";
import { PostseasonStatus } from "@/components/postseason/PostseasonStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  hasPostseasonChampion,
  type PostseasonConference,
  type PostseasonGame,
  type PostseasonState,
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

interface TeamRowProps {
  team: Team | undefined;
  id: string | null | undefined;
  seed: number | undefined;
  won: boolean;
  score: number | string;
  seriesWins?: boolean;
}

function TeamRow({ team, id, seed, won, score, seriesWins }: TeamRowProps) {
  const t = useT();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const name = team?.name ?? id ?? t("postseason", "tbd");
  return (
    <div className={`flex h-8 items-center gap-1.5 text-sm ${won ? "font-bold text-primary" : ""}`}>
      <span className="w-5 shrink-0 text-xs text-muted-foreground">{seed ? `#${seed}` : ""}</span>
      {team?.logoUrl && failedLogo !== team.logoUrl ? (
        <Image
          src={team.logoUrl}
          alt=""
          width={24}
          height={24}
          className="size-6 shrink-0 object-contain"
          onError={() => setFailedLogo(team.logoUrl ?? null)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold"
        >
          {team?.abbreviation ?? "—"}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate" title={name}>
        <span aria-hidden="true">{team?.abbreviation ?? name}</span>
        <span className="sr-only">{name}</span>
      </span>
      {won && (
        <span title={t("postseason", "winner")}>
          <span aria-hidden="true">✓</span>
          <span className="sr-only">{t("postseason", "winner")}</span>
        </span>
      )}
      <span className="font-mono font-bold tabular-nums">
        {score}
        {seriesWins && <span className="sr-only"> {t("postseason", "wins")}</span>}
      </span>
    </div>
  );
}

function PlayInBracket({ state, teams, onSelectGame }: BracketProps) {
  const t = useT();
  return (
    <div className="@container space-y-3">
      <h2 className="text-lg font-bold">{t("postseason", "playIn")}</h2>
      <div className="grid gap-6 @min-[64rem]:grid-cols-2">
        {(["West", "East"] as const).map((conference) => (
          <section
            key={conference}
            aria-label={`${t("postseason", "playIn")} · ${t("postseason", conference)}`}
            className="min-w-0 space-y-3"
          >
            <h3 className="text-lg font-bold">{t("postseason", conference)}</h3>
            <div className="grid gap-3 @min-[32rem]:grid-cols-2">
              {(["seven_eight", "nine_ten", "eighth_seed"] as const).map((stage) => (
                <section
                  key={stage}
                  aria-label={t("postseason", stage)}
                  className={`min-w-0 space-y-2 ${stage === "eighth_seed" ? "@min-[32rem]:col-start-2 @min-[32rem]:row-start-1 @min-[32rem]:row-span-2 @min-[32rem]:self-center" : "@min-[32rem]:col-start-1"} ${conference === "East" ? (stage === "eighth_seed" ? "@min-[64rem]:col-start-1" : "@min-[64rem]:col-start-2") : ""}`}
                >
                  <h4 className="text-sm font-semibold">{t("postseason", stage)}</h4>
                  {state.games
                    .filter((game) => game.conference === conference && game.stage === stage)
                    .map((game) => {
                      const winner =
                        game.status === "completed"
                          ? (game.winnerTeamId ??
                            (game.homeScore !== null &&
                            game.awayScore !== null &&
                            game.homeScore !== game.awayScore
                              ? game.homeScore > game.awayScore
                                ? game.homeTeamId
                                : game.awayTeamId
                              : null))
                          : null;
                      const name = (id: string) =>
                        teams.find((team) => team.id === id)?.abbreviation ?? id;
                      return (
                        <Card
                          key={game.id}
                          className="w-full gap-0 py-2"
                          data-play-in-game={game.id}
                        >
                          <CardContent className="space-y-1 px-2">
                            <time
                              className="text-xs text-muted-foreground"
                              dateTime={game.gameDate}
                            >
                              {game.gameDate}
                            </time>
                            {[game.homeTeamId, game.awayTeamId].map((id, index) => (
                              <TeamRow
                                key={id}
                                id={id}
                                team={teams.find((team) => team.id === id)}
                                seed={
                                  state.qualification.find(
                                    (entry) =>
                                      entry.teamId === id && entry.conference === conference
                                  )?.seed
                                }
                                won={winner === id}
                                score={
                                  game.status === "completed"
                                    ? ((index === 0 ? game.homeScore : game.awayScore) ?? "—")
                                    : "—"
                                }
                              />
                            ))}
                            {game.status === "completed" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-full text-xs"
                                aria-haspopup="dialog"
                                aria-label={`${t("postseason", "boxScore")} · ${name(game.awayTeamId)} @ ${name(game.homeTeamId)} · ${game.gameDate}`}
                                onClick={() => onSelectGame(game)}
                              >
                                {t("boxScore", "title")}
                              </Button>
                            ) : (
                              <p className="h-6 text-center text-xs text-muted-foreground">
                                {t("postseason", "scheduled")}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SeriesSlot({ state, teams, onSelectGame, conference, round, slot }: SeriesSlotProps) {
  const t = useT();
  const [gamesOpen, setGamesOpen] = useState(false);
  const gamesButton = useRef<HTMLButtonElement>(null);
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
    <Card className="h-28 w-full gap-0 py-2" data-bracket-slot={`${conference}-${round}-${slot}`}>
      <CardContent className="px-2">
        {[homeId, awayId].map((id, index) => {
          const seed =
            state.playoffSeeds.find((seed) => seed.teamId === id)?.seed ?? seeds?.[index];
          const won = !!id && series?.winnerTeamId === id;
          const team = teams.find((team) => team.id === id);
          return (
            <TeamRow
              key={index === 0 ? "home" : "away"}
              team={team}
              id={id}
              seed={seed}
              won={won}
              score={series ? (index === 0 ? series.homeWins : series.awayWins) : "—"}
              seriesWins
            />
          );
        })}
        <Button
          ref={gamesButton}
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-full text-xs"
          disabled={games.length === 0}
          aria-haspopup="dialog"
          onClick={() => setGamesOpen(true)}
        >
          {t("postseason", "games")}
        </Button>
        <Dialog open={gamesOpen} onOpenChange={setGamesOpen}>
          <DialogContent
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              gamesButton.current?.focus();
            }}
            className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)]"
          >
            <DialogHeader>
              <DialogTitle>
                {t("postseason", "games")}
                {" · "}
                {[homeId, awayId]
                  .map(
                    (id) =>
                      teams.find((team) => team.id === id)?.name ?? id ?? t("postseason", "tbd")
                  )
                  .join(" / ")}
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto">
              <GameResults
                games={games}
                teams={teams}
                onSelectGame={(game) => {
                  setGamesOpen(false);
                  onSelectGame(game);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
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
    <div className="@container space-y-6">
      <p className="font-semibold">{t("postseason", "bestOfSeven")}</p>
      <p className="text-sm text-muted-foreground">{t("postseason", "homeCourt")}</p>
      <div className="grid gap-6 @min-[72rem]:grid-cols-[3fr_1fr_3fr] @min-[72rem]:gap-3">
        {(["West", "East"] as const).map((conference) => (
          <section
            key={conference}
            aria-label={t("postseason", conference)}
            className={`min-w-0 space-y-3 ${conference === "East" ? "@min-[72rem]:order-3" : ""}`}
          >
            <h2 className="h-7 text-lg font-bold">{t("postseason", conference)}</h2>
            <div className="grid gap-6 @min-[36rem]:grid-cols-3 @min-[72rem]:gap-3">
              {ROUNDS.map(({ label, round, slots }) => (
                <div
                  key={label}
                  className={`flex min-w-0 flex-col gap-3 ${conference === "East" ? (round === 1 ? "@min-[72rem]:order-3" : round === 2 ? "@min-[72rem]:order-2" : "@min-[72rem]:order-1") : ""}`}
                >
                  <h3 className="flex h-10 items-center text-sm font-semibold">
                    {t("postseason", label)}
                  </h3>
                  <div className="flex flex-col gap-3 @min-[36rem]:grid @min-[36rem]:grid-rows-[repeat(8,4rem)] @min-[36rem]:gap-0">
                    {slots.map((slot) => (
                      <div
                        key={slot}
                        className="flex min-w-0 items-center"
                        style={{ gridRow: `${(slot - 1) * 2 ** round + 1} / span ${2 ** round}` }}
                      >
                        <SeriesSlot {...props} conference={conference} round={round} slot={slot} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <section
          aria-label={t("postseason", "Finals")}
          className="min-w-0 space-y-3 @min-[72rem]:order-2"
        >
          <h2 className="h-7 text-lg font-bold">{t("postseason", "Finals")}</h2>
          <div aria-hidden="true" className="hidden h-10 @min-[72rem]:block" />
          <div className="flex items-center @min-[72rem]:h-[32rem]">
            <SeriesSlot {...props} conference="Finals" round={4} slot={1} />
          </div>
        </section>
      </div>
    </div>
  );
}

export function PostseasonView({ gameId, selectedTeamId }: PostseasonViewProps) {
  const t = useT();
  const query = usePostseason(gameId);
  const teams = useTeams();
  const [selectedGame, setSelectedGame] = useState<PostseasonGame | null>(null);
  const [selectedView, setSelectedView] = useState<string | null>(null);
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
  const hasPlayIn = state.games.some((game) => game.stage !== null);
  const champion = hasPostseasonChampion(state);
  const views = [
    ...(state.phase !== "regular_season"
      ? [{ id: "playoffs", label: t("postseason", "bracket") }]
      : []),
    ...(hasPlayIn ? [{ id: "playIn", label: t("postseason", "playIn") }] : []),
    ...(champion ? [{ id: "planning", label: t("offseason", "title") }] : []),
  ];
  const activeView = views.some((view) => view.id === selectedView)
    ? selectedView
    : state.phase === "play_in" && hasPlayIn
      ? "playIn"
      : "playoffs";
  const name = (id: string) => teams.data.find((team) => team.id === id)?.name ?? id;
  return (
    <div className="space-y-6">
      <PostseasonStatus summary state={state} selectedTeamId={selectedTeamId} teams={teams.data} />
      {views.length > 0 && (
        <fieldset aria-label={t("postseason", "title")} className="flex flex-wrap gap-2">
          {views.map((view) => (
            <Button
              key={view.id}
              type="button"
              variant={activeView === view.id ? "default" : "outline"}
              aria-pressed={activeView === view.id}
              aria-controls={`postseason-${view.id}`}
              onClick={() => setSelectedView(view.id)}
            >
              {view.label}
            </Button>
          ))}
        </fieldset>
      )}
      {hasPlayIn && (
        <div id="postseason-playIn" hidden={activeView !== "playIn"}>
          <PlayInBracket state={state} teams={teams.data} onSelectGame={setSelectedGame} />
        </div>
      )}
      {state.phase !== "regular_season" && (
        <div id="postseason-playoffs" hidden={activeView !== "playoffs"}>
          <PlayoffBracket state={state} teams={teams.data} onSelectGame={setSelectedGame} />
        </div>
      )}
      {champion && (
        <div id="postseason-planning" hidden={activeView !== "planning"}>
          <OffseasonPanel gameId={gameId} selectedTeamId={selectedTeamId} />
        </div>
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
