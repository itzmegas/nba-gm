"use client";

import {
  ArrowLeftRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  DollarSign,
  Globe,
  LayoutDashboard,
  LogOut,
  Pause,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, ComponentType } from "react";
import { body, display } from "@/app/ui-preview/fonts";
import { useOffseason } from "@/application/hooks/offseason/useOffseason";
import { usePostseason } from "@/application/hooks/postseason/usePostseason";
import { getMonthEnd, useAdvanceRange } from "@/application/hooks/simulation";
import { useAdvanceDay } from "@/application/hooks/simulation/useAdvanceDay";
import { useCurrentTeamGame } from "@/application/hooks/simulation/useCurrentTeamGame";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import {
  BATCH_SIMULATION_MODE,
  type BatchSimulationMode,
  useBatchSimulationStore,
} from "@/application/stores/useBatchSimulationStore";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  hasPostseasonChampion,
  isPlayoffsReady,
  isTeamEliminated,
} from "@/domain/entities/Postseason";
import { SCHEDULED_GAME_STATUS } from "@/domain/entities/ScheduledGame";
import { formatSeasonLabel } from "@/domain/entities/Season";

function getSimulationDateFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface DashboardNavItem {
  key:
    | "dashboard"
    | "roster"
    | "league"
    | "trades"
    | "freeAgency"
    | "calendar"
    | "settings"
    | "postseason";
  path: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: DashboardNavItem[] = [
  { key: "dashboard", path: "", icon: LayoutDashboard },
  { key: "calendar", path: "/schedule", icon: Calendar },
  { key: "postseason", path: "/postseason", icon: Trophy },
  { key: "roster", path: "/roster", icon: Users },
  { key: "league", path: "/league", icon: Globe },
  { key: "trades", path: "/trades", icon: ArrowLeftRight },
  { key: "freeAgency", path: "/free-agency", icon: DollarSign },
  { key: "settings", path: "/settings", icon: Settings },
];

function SidebarNavigationLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const { setOpenMobile } = useSidebar();
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpenMobile(false);
      }}
    />
  );
}

interface DashboardSidebarProps {
  gameId: string;
  selectedTeamId: string;
  simulationDate: Date;
  seasonYear: number;
}

export function DashboardSidebar({
  gameId,
  selectedTeamId,
  simulationDate,
  seasonYear,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const locale = useLocale();
  const simulationDateFormatter = getSimulationDateFormatter(locale);
  const { data: teams } = useTeams();
  const dashboardBasePath = `/games/${gameId}/dashboard`;

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);
  const advanceDay = useAdvanceDay();
  const advanceRange = useAdvanceRange();
  const batchActive = useBatchSimulationStore((state) => state.isActive);
  const stopRequested = useBatchSimulationStore((state) => state.stopRequested);
  const batchMode = useBatchSimulationStore((state) => state.mode);
  const completedDays = useBatchSimulationStore((state) => state.completedDays);
  const totalDays = useBatchSimulationStore((state) => state.totalDays);
  const batchError = useBatchSimulationStore((state) => state.error);
  const currentGame = useCurrentTeamGame(gameId, selectedTeamId, simulationDate);
  const postseason = usePostseason(gameId);
  const championConfirmed = hasPostseasonChampion(postseason.data);
  const opponentId = currentGame.data
    ? currentGame.data.homeTeamId === selectedTeamId
      ? currentGame.data.awayTeamId
      : currentGame.data.homeTeamId
    : undefined;
  const opponent = teams?.find((team) => team.id === opponentId);
  const matchup = currentGame.data
    ? `${currentGame.data.homeTeamId === selectedTeamId ? "vs" : "@"} ${opponent?.abbreviation ?? "---"}`
    : t("dashboard", "freeDay");
  const monthEnd = getMonthEnd(simulationDate);
  const monthDays = Math.max(
    0,
    Math.round((Date.parse(`${monthEnd}T00:00:00Z`) - simulationDate.getTime()) / 86_400_000)
  );
  const startBatch = (mode: BatchSimulationMode) => {
    if (advanceDay.isPending || batchActive || championConfirmed) return;
    const total = mode === BATCH_SIMULATION_MODE.MONTH ? monthDays : null;
    if (useBatchSimulationStore.getState().startBatch(mode, total)) {
      advanceRange.mutate({ gameId, simulationDate, mode, seasonYear });
    }
  };

  const labelSeason =
    batchMode === BATCH_SIMULATION_MODE.SEASON
      ? t("dashboard", "simulatingSeason")
      : t("dashboard", "simulateSeason");

  const labelMonth =
    batchMode === BATCH_SIMULATION_MODE.MONTH
      ? t("dashboard", "simulatingMonth")
      : t("dashboard", "simulateMonth");

  const labelDay =
    batchActive && batchMode === null
      ? t("dashboard", "simulatingDay")
      : t("dashboard", "simulateDay");

  const labelBatch =
    batchMode === BATCH_SIMULATION_MODE.NEXT_GAME
      ? t("dashboard", "simulatingToGame")
      : batchMode === BATCH_SIMULATION_MODE.SEASON
        ? labelSeason
        : labelMonth;

  const labelPause = stopRequested
    ? t("dashboard", "pausingSimulation")
    : t("dashboard", "pauseSimulation");

  const progressPercent =
    totalDays !== null && totalDays > 0
      ? Math.min(100, Math.round((completedDays / totalDays) * 100))
      : null;
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader
        className={`${body.className} game-shell-sidebar p-4 pb-2 group-data-[collapsible=icon]:px-2`}
      >
        <SidebarNavigationLink
          href={dashboardBasePath}
          aria-label={selectedTeam?.name || t("dashboard", "teamFallback")}
          className="flex min-w-0 items-center gap-2 rounded-md border border-sidebar-border bg-card p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
        >
          {selectedTeam?.logoUrl ? (
            <Image
              src={selectedTeam.logoUrl}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 object-contain"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary/10 text-xs font-bold text-sidebar-primary">
              {selectedTeam?.abbreviation || t("dashboard", "nba")}
            </div>
          )}
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block text-sm font-semibold leading-tight break-words">
              {selectedTeam?.name || t("dashboard", "teamFallback")}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {selectedTeam?.conference === "East"
                ? t("dashboard", "easternConference")
                : selectedTeam?.conference === "West"
                  ? t("dashboard", "westernConference")
                  : "—"}
            </span>
          </span>
        </SidebarNavigationLink>
      </SidebarHeader>

      <SidebarContent
        className={`${body.className} game-shell-sidebar gap-4 py-4 group-data-[collapsible=icon]:overflow-y-auto`}
      >
        {[NAV_ITEMS.slice(0, 3), NAV_ITEMS.slice(3, 7), NAV_ITEMS.slice(7)].map((items, index) => (
          <SidebarGroup
            key={items[0].key}
            className={`shrink-0 px-4 py-0 group-data-[collapsible=icon]:px-2 ${index === 2 ? "mt-auto" : ""}`}
          >
            {index < 2 && (
              <SidebarGroupLabel className="h-auto pb-3 text-xs uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
                {t("dashboard", index === 0 ? "franchiseNavigation" : "frontOfficeNavigation")}
              </SidebarGroupLabel>
            )}
            <SidebarMenu className="gap-1.5">
              {items.map((item) => {
                const href = `${dashboardBasePath}${item.path}`;
                const isRoot = item.path === "";
                const isActive = isRoot
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);
                const Icon = item.icon;
                const label =
                  item.key === "postseason" ? t("postseason", "title") : t("dashboard", item.key);

                return (
                  <SidebarMenuItem
                    key={href}
                    className="w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                  >
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={label}
                      className="h-11 gap-3 rounded-sm text-sm text-muted-foreground [&_svg]:size-5 group-data-[collapsible=icon]:mx-auto! group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0!"
                    >
                      <SidebarNavigationLink
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon />
                        <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                      </SidebarNavigationLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter
        className={`${body.className} game-shell-sidebar gap-3 border-t border-sidebar-border p-3 group-data-[collapsible=icon]:px-1`}
      >
        <div className="space-y-1 px-1 text-xs group-data-[collapsible=icon]:hidden">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("dashboard", "simulationDate")}
          </p>
          <p className={`${display.className} text-xl font-semibold tabular-nums`}>
            {simulationDateFormatter.format(simulationDate)}
          </p>
          {postseason.data && (
            <div aria-live="polite" className="space-y-1">
              <Link
                className="font-semibold underline underline-offset-2"
                href={`${dashboardBasePath}/postseason`}
              >
                {t(
                  "postseason",
                  isPlayoffsReady(postseason.data) ? "ready" : postseason.data.phase
                )}
              </Link>
              {isTeamEliminated(postseason.data, selectedTeamId) && (
                <p>{t("postseason", "eliminatedShort")}</p>
              )}
              {championConfirmed && <p>{t("postseason", "noRollover")}</p>}
              {championConfirmed && (
                <OffseasonSidebarStatus gameId={gameId} seasonYear={seasonYear} />
              )}
            </div>
          )}
          <p className={currentGame.isError ? "text-destructive" : "text-muted-foreground"}>
            {currentGame.isPending
              ? t("common", "loading")
              : currentGame.isError
                ? t("dashboard", "unableToLoadGame")
                : matchup}
            {currentGame.data?.status === SCHEDULED_GAME_STATUS.COMPLETED &&
              ` · ${t("dashboard", "final")} ${currentGame.data.homeTeamId === selectedTeamId ? currentGame.data.homeScore : currentGame.data.awayScore}-${currentGame.data.homeTeamId === selectedTeamId ? currentGame.data.awayScore : currentGame.data.homeScore}`}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 group-data-[collapsible=icon]:flex-col">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  aria-label={labelDay}
                  className="min-w-0 flex-1 justify-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:p-0"
                  onClick={() => advanceDay.mutate({ gameId, simulationDate })}
                  disabled={
                    championConfirmed ||
                    advanceDay.isPending ||
                    batchActive ||
                    advanceRange.isPending
                  }
                >
                  <CalendarDays className="size-5" />
                  <span className="group-data-[collapsible=icon]:hidden">{labelDay}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{labelDay}</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("dashboard", "advanceSimulation")}
                  title={t("dashboard", "advanceSimulation")}
                  className="shrink-0 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8"
                  disabled={
                    championConfirmed ||
                    advanceDay.isPending ||
                    batchActive ||
                    advanceRange.isPending
                  }
                >
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end">
                <DropdownMenuLabel>{t("dashboard", "advanceSimulation")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={monthDays === 0}
                  onSelect={() => startBatch(BATCH_SIMULATION_MODE.MONTH)}
                >
                  <Calendar className="size-4" />
                  {labelMonth}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => startBatch(BATCH_SIMULATION_MODE.SEASON)}>
                  <CalendarRange className="size-4" />
                  {labelSeason}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {batchActive && batchMode !== null && (
            <div className="mt-2 flex flex-col gap-2 border-t pt-3 group-data-[collapsible=icon]:mt-1 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:pt-0">
              <div className="flex items-center gap-2 text-xs group-data-[collapsible=icon]:hidden">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="font-medium">{labelBatch}</span>
              </div>

              <output className="text-center text-xs text-muted-foreground tabular-nums group-data-[collapsible=icon]:hidden">
                {completedDays} {t("dashboard", "completedDays")}
                {totalDays === null ? "" : ` ${t("dashboard", "ofDays")} ${totalDays}`}
              </output>

              {totalDays !== null && totalDays > 0 && (
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted group-data-[collapsible=icon]:hidden"
                  role="progressbar"
                  aria-label={labelBatch}
                  aria-valuemin={0}
                  aria-valuemax={totalDays}
                  aria-valuenow={completedDays}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={labelPause}
                    className="w-full justify-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
                    onClick={() => useBatchSimulationStore.getState().requestStop()}
                    disabled={stopRequested}
                  >
                    <Pause className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">{labelPause}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{labelPause}</TooltipContent>
              </Tooltip>
            </div>
          )}

          {(batchError || advanceDay.isError) && (
            <p
              role="alert"
              className="text-xs text-destructive group-data-[collapsible=icon]:hidden"
            >
              {t("dashboard", "unableToAdvance")}
            </p>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function OffseasonSidebarStatus({
  gameId,
  seasonYear,
}: Pick<DashboardSidebarProps, "gameId" | "seasonYear">) {
  const t = useT();
  const offseason = useOffseason(gameId, seasonYear);
  if (!offseason.data) return null;
  return (
    <Link
      className="block font-semibold underline underline-offset-2"
      href={`/games/${gameId}/dashboard/postseason`}
    >
      {t("offseason", "entered")}
    </Link>
  );
}

interface DashboardHeaderProps {
  gameId: string;
  gameName: string;
  selectedTeamId: string;
  seasonYear: number;
  simulationDate: Date;
}

export function DashboardHeader({
  gameId,
  gameName,
  selectedTeamId,
  seasonYear,
  simulationDate,
}: DashboardHeaderProps) {
  const t = useT();
  const locale = useLocale();
  const { data: teams } = useTeams();
  const dashboardBasePath = `/games/${gameId}/dashboard`;

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);

  return (
    <header
      className={`${body.className} game-shell-header flex min-h-[88px] shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b px-4 py-4 md:px-6 min-[1700px]:px-12`}
    >
      <SidebarTrigger aria-label={t("dashboard", "toggleSidebar")} className="-ml-1" />
      <Link href={dashboardBasePath} className="hidden min-w-0 items-center gap-3 xl:flex">
        {selectedTeam?.logoUrl && (
          <Image
            src={selectedTeam.logoUrl}
            alt=""
            width={36}
            height={36}
            className="size-9 object-contain"
          />
        )}
        <span className="min-w-0">
          <span className="block text-xs uppercase tracking-widest text-muted-foreground">
            {t("dashboard", "myFranchise")}
          </span>
          <strong className="block text-sm font-semibold">
            {selectedTeam?.name || t("dashboard", "teamFallback")}
          </strong>
        </span>
      </Link>
      <dl className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="xl:border-l xl:pl-6">
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("dashboard", "season")}
          </dt>
          <dd className="mt-1 tabular-nums">
            {formatSeasonLabel(seasonYear)}{" "}
            <span className="ml-2 text-muted-foreground">{t("dashboard", "nba")}</span>
          </dd>
        </div>
        <div className="hidden border-l pl-6 sm:block">
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("dashboard", "simulationDate")}
          </dt>
          <dd className="mt-1 tabular-nums">
            {getSimulationDateFormatter(locale).format(simulationDate)}
          </dd>
        </div>
        <div className="hidden border-l pl-6 min-[1400px]:block">
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("dashboard", "yourRole")}
          </dt>
          <dd className="mt-1">{t("dashboard", "generalManager")}</dd>
        </div>
      </dl>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("dashboard", "gameMenu")}>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="truncate">{gameName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">
                <LogOut className="h-4 w-4" />
                {t("dashboard", "exitChangeGame")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
