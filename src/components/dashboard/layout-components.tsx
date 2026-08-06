"use client";

import {
  ArrowLeftRight,
  Bell,
  Calendar,
  DollarSign,
  Globe,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { getMonthEnd, useAdvanceRange } from "@/application/hooks/simulation";
import { useAdvanceDay } from "@/application/hooks/simulation/useAdvanceDay";
import { useCurrentTeamGame } from "@/application/hooks/simulation/useCurrentTeamGame";
import { useTeams } from "@/application/hooks/teams/useTeams";
import {
  BATCH_SIMULATION_MODE,
  type BatchSimulationMode,
  useBatchSimulationStore,
} from "@/application/stores/useBatchSimulationStore";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SCHEDULED_GAME_STATUS } from "@/domain/entities/ScheduledGame";
import { formatSeasonLabel } from "@/domain/entities/Season";

const simulationDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

interface DashboardNavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: DashboardNavItem[] = [
  { label: "Dashboard", path: "", icon: LayoutDashboard },
  { label: "Roster", path: "/roster", icon: Users },
  { label: "Liga", path: "/league", icon: Globe },
  { label: "Traspasos", path: "/trades", icon: ArrowLeftRight },
  { label: "Agencia Libre", path: "/free-agency", icon: DollarSign },
  { label: "Calendario", path: "/schedule", icon: Calendar },
  { label: "Ajustes", path: "/settings", icon: Settings },
];

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
  const { data: teams } = useTeams();
  const dashboardBasePath = `/games/${gameId}/dashboard`;

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);
  const advanceDay = useAdvanceDay();
  const advanceRange = useAdvanceRange();
  const batchActive = useBatchSimulationStore((state) => state.isActive);
  const batchMode = useBatchSimulationStore((state) => state.mode);
  const completedDays = useBatchSimulationStore((state) => state.completedDays);
  const totalDays = useBatchSimulationStore((state) => state.totalDays);
  const batchError = useBatchSimulationStore((state) => state.error);
  const currentGame = useCurrentTeamGame(gameId, selectedTeamId, simulationDate);
  const opponentId = currentGame.data
    ? currentGame.data.homeTeamId === selectedTeamId
      ? currentGame.data.awayTeamId
      : currentGame.data.homeTeamId
    : undefined;
  const opponent = teams?.find((team) => team.id === opponentId);
  const matchup = currentGame.data
    ? `${currentGame.data.homeTeamId === selectedTeamId ? "vs" : "@"} ${opponent?.abbreviation ?? "---"}`
    : "Día libre";
  const monthEnd = getMonthEnd(simulationDate, seasonYear);
  const monthDays = Math.max(
    0,
    Math.round((Date.parse(`${monthEnd}T00:00:00Z`) - simulationDate.getTime()) / 86_400_000)
  );
  const startBatch = (mode: BatchSimulationMode) => {
    if (advanceDay.isPending) return;
    const total = mode === BATCH_SIMULATION_MODE.MONTH ? monthDays : null;
    if (useBatchSimulationStore.getState().startBatch(mode, total)) {
      advanceRange.mutate({ gameId, simulationDate, mode, seasonYear });
    }
  };

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <Link
          href={dashboardBasePath}
          className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent"
        >
          {selectedTeam?.logoUrl ? (
            <Image
              src={selectedTeam.logoUrl}
              alt="Logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md object-contain"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary/10 text-xs font-bold text-sidebar-primary">
              {selectedTeam?.abbreviation || "NBA"}
            </div>
          )}
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">
              {selectedTeam?.name || "Equipo"}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              {selectedTeam?.city || "Franquicia"}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarMenu>
          {NAV_ITEMS.map((item) => {
            const href = `${dashboardBasePath}${item.path}`;
            const isRoot = item.path === "";
            const isActive = isRoot
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                  <Link href={href}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="min-h-11 px-1 text-xs group-data-[collapsible=icon]:hidden">
          <p className="font-medium capitalize">{simulationDateFormatter.format(simulationDate)}</p>
          <p className={currentGame.isError ? "text-destructive" : "text-muted-foreground"}>
            {currentGame.isPending
              ? "Cargando…"
              : currentGame.isError
                ? "No se pudo cargar el partido."
                : matchup}
            {currentGame.data?.status === SCHEDULED_GAME_STATUS.COMPLETED &&
              ` · Final ${currentGame.data.homeScore}-${currentGame.data.awayScore}`}
          </p>
        </div>
        <Button
          className="w-full justify-center group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-0"
          onClick={() => advanceDay.mutate({ gameId, simulationDate })}
          disabled={advanceDay.isPending || batchActive || advanceRange.isPending}
          
        >
          <Calendar className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">
            {advanceDay.isPending ? "Simulando…" : "Simular Día ▶"}
          </span>
        </Button>
        <div className="grid grid-cols-2 gap-1 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => startBatch(BATCH_SIMULATION_MODE.MONTH)}
            disabled={advanceDay.isPending || batchActive || advanceRange.isPending}
          >
            {batchMode === BATCH_SIMULATION_MODE.MONTH ? "Simulando mes…" : "Simular Mes"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => startBatch(BATCH_SIMULATION_MODE.SEASON)}
            disabled={advanceDay.isPending || batchActive || advanceRange.isPending}
          >
            {batchMode === BATCH_SIMULATION_MODE.SEASON
              ? "Simulando temporada…"
              : "Simular Temporada"}
          </Button>
        </div>
        {batchActive && (
          <p className="text-xs text-muted-foreground">
            {completedDays} días completados{totalDays === null ? "" : ` de ${totalDays}`}
          </p>
        )}
        {(batchError || advanceDay.isError) && (
          <p className="text-xs text-destructive">No se pudo avanzar la simulación.</p>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

interface DashboardHeaderProps {
  gameId: string;
  gameName: string;
  selectedTeamId: string;
  seasonYear: number;
}

export function DashboardHeader({
  gameId,
  gameName,
  selectedTeamId,
  seasonYear,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const { data: teams } = useTeams();
  const dashboardBasePath = `/games/${gameId}/dashboard`;

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);

  // Determinar la sección activa para el breadcrumb
  const activeItem = NAV_ITEMS.slice()
    .reverse()
    .find((item) => {
      const href = `${dashboardBasePath}${item.path}`;
      return item.path === ""
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);
    });

  const isHome = activeItem?.path === "" || !activeItem;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex flex-1 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={dashboardBasePath}>GM</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {!isHome && activeItem && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{activeItem.label}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-end sm:flex flex-col">
          <span className="text-xs text-muted-foreground">
            Temporada {formatSeasonLabel(seasonYear)}
          </span>
          <span className="text-xs font-medium leading-none">
            {selectedTeam ? `GM · ${selectedTeam.city}` : "GM Invitado"}
          </span>
        </div>
        <Separator
          orientation="vertical"
          className="hidden sm:block h-4 data-[orientation=vertical]:h-4"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Menú de partida">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="truncate">{gameName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">
                <LogOut className="h-4 w-4" />
                Salir y cambiar de partida
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon-sm" className="relative">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>
      </div>
    </header>
  );
}
