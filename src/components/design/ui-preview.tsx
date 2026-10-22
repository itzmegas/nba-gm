"use client";

import { Check, LayoutDashboard, LoaderCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { TeamThemeApplier } from "@/components/theme/team-theme-applier";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TEAM_COLORS } from "@/domain/constants/team-colors";

const DIRECTIONS = { CURRENT: "current", PROPOSED: "proposed" } as const;
type Direction = (typeof DIRECTIONS)[keyof typeof DIRECTIONS];
const SAMPLE_PLAYERS = [
  { name: "Alex Morgan", number: "8", position: "PG", salary: "$12,500,000" },
  { name: "Jordan Williams-Smith", number: "24", position: "SF", salary: "$8,250,000" },
  { name: "Casey Davis", number: "0", position: "C", salary: "Unknown" },
];

export function UiPreview() {
  const [team, setTeam] = useState("CHI");
  const [direction, setDirection] = useState<Direction>(DIRECTIONS.PROPOSED);
  const [selected, setSelected] = useState(SAMPLE_PLAYERS[0].name);

  useEffect(() => {
    document.documentElement.dataset.uiPreview = direction;
    return () => {
      delete document.documentElement.dataset.uiPreview;
    };
  }, [direction]);

  return (
    <SidebarProvider lang="en">
      <TeamThemeApplier teamAbbreviation={team} />
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground group-data-[collapsible=icon]:size-8">
            {team}
          </span>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="font-semibold">The Association</p>
            <p className="text-xs text-muted-foreground">Visual sample · Not a saved game</p>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <nav aria-label="Sample navigation">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Overview">
                  <a href="#preview-overview">
                    <LayoutDashboard aria-hidden="true" />
                    <span>Overview</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive tooltip="Roster">
                  <a href="#preview-roster" aria-current="page">
                    <Users aria-hidden="true" />
                    <span>Roster</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </nav>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex min-h-14 flex-wrap items-center gap-3 border-b px-4 py-2">
          <SidebarTrigger />
          <span className="flex-1 text-sm font-semibold">UI / UX · Stage 1</span>
          <ThemeToggle />
        </header>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
          <section id="preview-overview" aria-labelledby="preview-title" className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Franchise office
              </p>
              <h1 id="preview-title" className="text-2xl font-bold tracking-tight">
                Visual foundation
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Fictional players and financial data. No game actions or changes are saved.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Franchise
                <select
                  value={team}
                  onChange={(event) => setTeam(event.target.value)}
                  className="min-h-11 rounded-md border bg-card px-3 text-card-foreground"
                >
                  {Object.keys(TEAM_COLORS).map((abbreviation) => (
                    <option key={abbreviation} value={abbreviation}>
                      {abbreviation}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="flex flex-wrap gap-3 text-sm">
                <legend className="mb-1 font-medium">Direction</legend>
                {Object.values(DIRECTIONS).map((value) => (
                  <label key={value} className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      name="direction"
                      value={value}
                      checked={direction === value}
                      onChange={() => setDirection(value)}
                    />
                    {value === DIRECTIONS.CURRENT ? "Current tokens" : "Proposed tokens"}
                  </label>
                ))}
              </fieldset>
            </div>
          </section>
          <Card>
            <CardHeader>
              <CardTitle>Sample payroll</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">$120,000,000</p>
                <p className="text-sm text-muted-foreground">
                  Illustrative team total, not player salary
                </p>
              </div>
              <Button asChild>
                <a href="#preview-states">Review interaction states</a>
              </Button>
            </CardContent>
          </Card>
          <section id="preview-roster" aria-labelledby="roster-title" className="space-y-3">
            <h2 id="roster-title" className="text-lg font-semibold">
              Sample roster rows
            </h2>
            <output className="block text-sm text-muted-foreground">Selected: {selected}</output>
            <div className="overflow-x-auto rounded-lg border p-1">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Fictional roster. Select a player to compare row states.
                </caption>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3 py-2">
                      #
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Player / selection
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Position
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Sample salary
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_PLAYERS.map((player) => (
                    <tr
                      key={player.name}
                      data-slot="preview-row"
                      data-selected={selected === player.name}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-3 font-mono text-muted-foreground">{player.number}</td>
                      <td className="min-w-64 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <PlayerHeadshot
                            alt=""
                            className="preview-headshot size-16 shrink-0 rounded-full bg-muted object-cover"
                          />
                          <Button
                            variant="ghost"
                            aria-label={`Select ${player.name}`}
                            aria-pressed={selected === player.name}
                            onClick={() => setSelected(player.name)}
                            className="min-h-11 h-auto min-w-0 shrink justify-start whitespace-normal text-left"
                          >
                            {player.name}
                            {selected === player.name && <Check aria-hidden="true" />}
                          </Button>
                        </div>
                      </td>
                      <td className="px-3 py-3">{player.position}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {player.salary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section id="preview-states" aria-labelledby="states-title" className="space-y-3">
            <h2 id="states-title" className="text-lg font-semibold">
              Interaction states
            </h2>
            <p className="text-sm text-muted-foreground">
              Hover, press and Tab through the controls. Selection has a check mark and a side rule;
              focus has a separate outline. Pending and disabled examples below are inactive.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" disabled>
                Unavailable
              </Button>
              <Button disabled aria-busy="true">
                <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
                Updating…
              </Button>
            </div>
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
