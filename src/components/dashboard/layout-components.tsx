"use client";

import {
  ArrowLeftRight,
  Bell,
  Calendar,
  DollarSign,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useTeams } from "@/application/hooks/teams/useTeams";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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

interface DashboardNavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: DashboardNavItem[] = [
  { label: "Dashboard", path: "", icon: LayoutDashboard },
  { label: "Roster", path: "/roster", icon: Users },
  { label: "Traspasos", path: "/trades", icon: ArrowLeftRight },
  { label: "Agencia Libre", path: "/free-agency", icon: DollarSign },
  { label: "Calendario", path: "/schedule", icon: Calendar },
  { label: "Ajustes", path: "/settings", icon: Settings },
];

interface DashboardSidebarProps {
  gameId: string;
  selectedTeamId: string;
}

export function DashboardSidebar({
  gameId,
  selectedTeamId,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { data: teams } = useTeams();
  const dashboardBasePath = `/games/${gameId}/dashboard`;

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);

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
              {selectedTeam?.name || "The Association"}
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
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                >
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
        <Button className="w-full justify-center group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-0">
          <Calendar className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">
            Simular Día ▶
          </span>
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

interface DashboardHeaderProps {
  gameId: string;
  selectedTeamId: string;
}

export function DashboardHeader({
  gameId,
  selectedTeamId,
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
        <Separator
          orientation="vertical"
          className="mr-2 h-4 data-[orientation=vertical]:h-4"
        />
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
          <span className="text-xs text-muted-foreground">Temporada 24-25</span>
          <span className="text-xs font-medium leading-none">
            {selectedTeam ? `GM · ${selectedTeam.city}` : "GM Invitado"}
          </span>
        </div>
        <Separator
          orientation="vertical"
          className="hidden sm:block h-4 data-[orientation=vertical]:h-4"
        />
        <Button variant="ghost" size="icon-sm" className="relative">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>
      </div>
    </header>
  );
}
