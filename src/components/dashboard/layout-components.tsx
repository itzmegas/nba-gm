"use client";

import {
  ArrowLeftRight,
  Bell,
  Calendar,
  ChevronLeft,
  DollarSign,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useTeamStore } from "@/application/stores/useTeamStore";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Roster", href: "/dashboard/roster", icon: Users },
  { label: "Traspasos", href: "/dashboard/trades", icon: ArrowLeftRight },
  { label: "Agencia Libre", href: "/dashboard/free-agency", icon: DollarSign },
  { label: "Calendario", href: "/dashboard/schedule", icon: Calendar },
  { label: "Ajustes", href: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const { data: teams } = useTeams();

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);

  return (
    <div
      className={`flex flex-col h-full bg-card border-r transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}
    >
      {/* Team Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b">
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            {selectedTeam?.logoUrl ? (
              <img
                src={selectedTeam.logoUrl}
                alt="Logo"
                className="w-8 h-8 object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                {selectedTeam?.abbreviation || "NBA"}
              </div>
            )}
            <span className="font-bold truncate">
              {selectedTeam?.name || "The Association"}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={isCollapsed ? "mx-auto" : ""}
        >
          {isCollapsed ? (
            <Menu className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${isCollapsed ? "justify-center" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Simulation Control */}
      <div className="p-4 border-t">
        <Button className="w-full" size={isCollapsed ? "icon" : "default"}>
          {isCollapsed ? (
            <Calendar className="h-4 w-4" />
          ) : (
            <span className="flex items-center justify-center w-full">
              Simular Día ▶
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

export function DashboardHeader() {
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const { data: teams } = useTeams();

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);

  // Fecha simulada hardcodeada por ahora (esto debería venir de un GameStore)
  const gameDate = "22 de Octubre, 2024";

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <div className="text-sm font-medium text-muted-foreground hidden sm:block">
          Día 1 / Temporada 24-25
        </div>
        <div className="hidden sm:block w-px h-4 bg-border" />
        <div className="font-semibold">{gameDate}</div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end hidden md:flex">
          <span className="text-xs text-muted-foreground">General Manager</span>
          <span className="font-medium text-sm leading-none">
            {selectedTeam ? `GM de ${selectedTeam.city}` : "GM Invitado"}
          </span>
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </Button>
      </div>
    </header>
  );
}
