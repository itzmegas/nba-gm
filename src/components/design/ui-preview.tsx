"use client";

import {
  ArrowDown,
  ArrowUpRight,
  Check,
  CircleAlert,
  Columns3,
  LayoutDashboard,
  LoaderCircle,
  Palette,
  Search,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { TeamThemeApplier } from "@/components/theme/team-theme-applier";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  AppTable,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
} from "@/components/ui/app-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTableHeader } from "@/components/ui/sortable-table-header";
import { TEAM_COLORS } from "@/domain/constants/team-colors";

// Illustrative fixtures belong only to this development catalog, never a saved game.
const SAMPLE_PLAYERS = [
  { name: "Alex Morgan", number: "8", position: "PG", salary: "$12,500,000", rating: 88 },
  {
    name: "Jordan Williams-Smith",
    number: "24",
    position: "SF",
    salary: "$8,250,000",
    rating: 81,
  },
  { name: "Casey Davis", number: "0", position: "C", salary: "Unknown", rating: undefined },
];

const SWATCHES = [
  { name: "Canvas", token: "--background" },
  { name: "Panel", token: "--card" },
  { name: "Raised", token: "--muted" },
  { name: "Franchise", token: "--primary" },
  { name: "Selection", token: "--cs-soft" },
  { name: "Positive", token: "--cs-positive" },
];

const TABLE_VIEW = { OVERVIEW: "overview", CONTRACTS: "contracts" } as const;
type TableView = (typeof TABLE_VIEW)[keyof typeof TABLE_VIEW];
const DASHBOARD_STATE = {
  ACTIVE: "Active",
  END: "Season end",
  LOADING: "Loading",
  ERROR: "Error",
} as const;
type DashboardState = (typeof DASHBOARD_STATE)[keyof typeof DASHBOARD_STATE];

// Consume the existing provider here so in-page links also dismiss the mobile drawer.
function PreviewNavigationLink({
  href,
  onClick,
  ...props
}: ComponentProps<"a"> & { href: string }) {
  const { setOpenMobile } = useSidebar();
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpenMobile(false);
      }}
    />
  );
}

export function UiPreview({ fontClassName = "" }: { fontClassName?: string }) {
  const [team, setTeam] = useState("SAC");
  const [dashboardState, setDashboardState] = useState<DashboardState>(DASHBOARD_STATE.ACTIVE);
  const [selected, setSelected] = useState(SAMPLE_PLAYERS[0].name);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("all");
  const [ascending, setAscending] = useState(true);
  const [view, setView] = useState<TableView>(TABLE_VIEW.OVERVIEW);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exampleValue, setExampleValue] = useState("");
  const dialogOpener = useRef<HTMLButtonElement>(null);

  const openDialog = (event: MouseEvent<HTMLButtonElement>) => {
    dialogOpener.current = event.currentTarget;
    setDialogOpen(true);
  };

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousPreview = root.dataset.uiPreview;
    const fontClasses = fontClassName.split(" ").filter(Boolean);
    const addedClasses = fontClasses.filter((name) => !root.classList.contains(name));
    root.classList.add(...addedClasses);
    root.dataset.uiPreview = "courtside";

    return () => {
      root.classList.remove(...addedClasses);
      if (previousPreview === undefined) delete root.dataset.uiPreview;
      else root.dataset.uiPreview = previousPreview;
    };
  }, [fontClassName]);

  const player = SAMPLE_PLAYERS.find((sample) => sample.name === selected) ?? SAMPLE_PLAYERS[0];
  const visiblePlayers = SAMPLE_PLAYERS.filter(
    (sample) =>
      sample.name.toLowerCase().includes(search.toLowerCase()) &&
      (position === "all" || sample.position === position)
  ).sort((a, b) => (ascending ? 1 : -1) * a.name.localeCompare(b.name));

  return (
    <SidebarProvider
      lang="en"
      style={{ "--sidebar-width": "216px", "--sidebar-width-icon": "76px" } as CSSProperties}
    >
      <TeamThemeApplier teamAbbreviation={team} />
      <a
        href="#preview-content"
        className="sr-only z-50 bg-card p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to catalog
      </a>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="gap-6 px-4 pt-7 pb-5 group-data-[collapsible=icon]:px-2">
          <PreviewNavigationLink
            href="#preview-overview"
            aria-label={`${team} franchise identity specimen`}
            className="flex flex-col items-center gap-2 rounded-lg py-2"
          >
            <span
              className="cs-team-mark cs-display size-28 shrink-0 text-3xl group-data-[collapsible=icon]:size-12 group-data-[collapsible=icon]:text-sm"
              aria-hidden="true"
            >
              {team}
            </span>
            <span className="group-data-[collapsible=icon]:hidden">
              <span className="block text-sm font-semibold">{team} Franchise</span>
              <span className="block text-xs tracking-widest text-muted-foreground">
                Placeholder crest
              </span>
            </span>
          </PreviewNavigationLink>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Catalog navigation">
            <SidebarGroup>
              <SidebarGroupLabel>FRANCHISE</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Dashboard specimen">
                    <PreviewNavigationLink
                      href="#preview-dashboard"
                      aria-label="Dashboard specimen"
                    >
                      <LayoutDashboard aria-hidden="true" />
                      <span>Dashboard specimen</span>
                    </PreviewNavigationLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Visual identity">
                    <PreviewNavigationLink href="#preview-overview" aria-label="Visual identity">
                      <LayoutDashboard aria-hidden="true" />
                      <span>Visual identity</span>
                    </PreviewNavigationLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive tooltip="Roster specimen">
                    <PreviewNavigationLink href="#preview-roster" aria-label="Roster specimen">
                      <Users aria-hidden="true" />
                      <span>Roster specimen</span>
                    </PreviewNavigationLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>DESIGN SYSTEM</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Components and states">
                    <PreviewNavigationLink
                      href="#preview-components"
                      aria-label="Components and states"
                    >
                      <Palette aria-hidden="true" />
                      <span>Components & states</span>
                    </PreviewNavigationLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Portals and overlays">
                    <PreviewNavigationLink
                      href="#preview-overlays"
                      aria-label="Portals and overlays"
                    >
                      <Columns3 aria-hidden="true" />
                      <span>Portals & overlays</span>
                    </PreviewNavigationLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </nav>
        </SidebarContent>
        <SidebarFooter className="border-t p-4 text-xs text-muted-foreground group-data-[collapsible=icon]:px-2">
          <div className="space-y-2 group-data-[collapsible=icon]:hidden">
            <p className="cs-eyebrow">Sample simulation date</p>
            <p className="text-sm font-semibold text-foreground">
              {dashboardState === DASHBOARD_STATE.END ? "Jun 24, 2027" : "Jan 18, 2027"}
            </p>
            <p>
              {dashboardState === DASHBOARD_STATE.END
                ? "Season complete · planning only"
                : "Regular season · fictional schedule"}
            </p>
            <Button disabled className="h-auto min-h-10 w-full whitespace-normal text-center">
              Simulation unavailable in catalog
            </Button>
          </div>
          <p className="flex items-center gap-2">
            <Shield className="size-4 shrink-0" aria-hidden="true" />
            <span className="group-data-[collapsible=icon]:hidden">Development only</span>
          </p>
          <span className="group-data-[collapsible=icon]:hidden">
            No game data is loaded or saved.
          </span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 overflow-hidden border border-sidebar-border">
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-4 border-b px-4 py-2">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div>
              <p className="cs-eyebrow text-muted-foreground">WORKSPACE</p>
              <p className="text-sm">
                Design system <span className="text-muted-foreground">/ Phase 01</span>
              </p>
            </div>
            <div className="hidden border-l pl-6 lg:block">
              <p className="cs-eyebrow text-muted-foreground">ENVIRONMENT</p>
              <p className="text-sm">Isolated visual sandbox</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Franchise
              <select
                value={team}
                onChange={(event) => setTeam(event.target.value)}
                className="min-h-10 rounded border bg-card px-2 text-sm text-foreground"
              >
                {Object.keys(TEAM_COLORS).map((abbreviation) => (
                  <option key={abbreviation}>{abbreviation}</option>
                ))}
              </select>
            </label>
            <ThemeToggle />
          </div>
        </header>
        <div
          id="preview-content"
          className="mx-auto flex w-full max-w-[1800px] flex-col gap-7 p-4 md:p-6 xl:p-8"
        >
          <section
            id="preview-overview"
            aria-labelledby="preview-title"
            className="space-y-5 scroll-mt-4"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="cs-eyebrow cs-ink mb-2">COURTSIDE / VISUAL FOUNDATION</p>
                <h1 id="preview-title" className="cs-display text-4xl leading-tight tracking-tight">
                  YOUR FRANCHISE. YOUR LEGACY.
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  OpenDesign language. Existing components. One isolated identity.
                </p>
              </div>
              <Badge variant="outline">PHASE 01 · NOT A SAVED GAME</Badge>
            </div>
            <div className="cs-hero grid gap-6 rounded-md border p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center xl:p-8">
              <span
                className="cs-team-mark cs-display size-24 text-3xl md:size-28"
                aria-hidden="true"
              >
                {team}
              </span>
              <div>
                <p className="cs-eyebrow cs-ink">FRANCHISE IDENTITY SPECIMEN</p>
                <h2 className="cs-display mt-2 text-5xl leading-none tracking-tight lg:text-6xl">
                  BUILT FOR THE LONG GAME
                </h2>
                <p className="mt-4 max-w-xl text-sm text-muted-foreground">
                  Fictional players and financial data. No game actions or changes are saved.
                </p>
              </div>
              <div className="border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                <p className="cs-eyebrow text-muted-foreground">DESIGN REFERENCE</p>
                <p className="cs-display cs-ink mt-2 text-5xl">01</p>
                <p className="mt-1 text-xs text-muted-foreground">Foundation before screens</p>
              </div>
            </div>
            <dl className="grid grid-cols-1 divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                {
                  label: "Sample payroll",
                  value: "$120.0M",
                  note: "Illustrative total, not spending permission",
                },
                { label: "Identity", value: "30", note: "Franchise themes · light and dark" },
                { label: "Game queries", value: "0", note: "No new data access in this catalog" },
              ].map((metric) => (
                <div key={metric.label} className="px-5 py-5 first:pl-0">
                  <dt className="cs-eyebrow text-muted-foreground">{metric.label}</dt>
                  <dd className="cs-display mt-2 text-4xl tabular-nums">{metric.value}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{metric.note}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            id="preview-dashboard"
            aria-labelledby="dashboard-title"
            className="scroll-mt-4 space-y-4"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="cs-eyebrow text-muted-foreground">
                  Fictional dashboard · no saved game
                </p>
                <h2 id="dashboard-title" className="cs-display text-3xl">
                  FRANCHISE AT A GLANCE
                </h2>
              </div>
              <fieldset className="cs-segment flex flex-wrap">
                <legend className="sr-only">Dashboard sample state</legend>
                {Object.values(DASHBOARD_STATE).map((state) => (
                  <button
                    key={state}
                    type="button"
                    aria-pressed={dashboardState === state}
                    onClick={() => setDashboardState(state)}
                  >
                    {state}
                  </button>
                ))}
              </fieldset>
            </div>
            {dashboardState === DASHBOARD_STATE.LOADING ? (
              <section
                aria-label="Loading dashboard sample"
                aria-busy="true"
                className="rounded-md border p-5"
              >
                <p>Loading fictional dashboard…</p>
                <Skeleton className="mt-3 h-20" />
              </section>
            ) : dashboardState === DASHBOARD_STATE.ERROR ? (
              <div role="alert" className="rounded-md border border-destructive p-5">
                <p>Illustrative error: dashboard unavailable. No request was made.</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => setDashboardState(DASHBOARD_STATE.ACTIVE)}
                >
                  Reset sample
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Next game</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dashboardState === DASHBOARD_STATE.END ? (
                      <>
                        <p className="font-semibold">No next game · season complete</p>
                        <p className="text-sm text-muted-foreground">
                          Illustrative season-end state. Planning does not start another season.
                        </p>
                        <a className="cs-ink font-semibold underline" href="#preview-postseason">
                          Postseason / offseason sample
                        </a>
                      </>
                    ) : (
                      <>
                        <p className="cs-display text-3xl">{team} vs Harbor Comets</p>
                        <p className="text-sm text-muted-foreground">
                          Jan 19 · 7:30 PM · fictional matchup
                        </p>
                        <a className="cs-ink font-semibold underline" href="#preview-calendar">
                          Calendar sample
                        </a>
                      </>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Nearby standings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol start={5} className="space-y-1 text-sm">
                      <li className="flex justify-between rounded p-2">
                        <span>5 · Harbor Comets</span>
                        <span>25–18</span>
                      </li>
                      <li
                        aria-current="true"
                        className="flex justify-between rounded border border-primary bg-accent p-2 font-semibold"
                      >
                        <span>6 · {team} · Your franchise</span>
                        <span>24–19</span>
                      </li>
                      <li className="flex justify-between rounded p-2">
                        <span>7 · Valley Owls</span>
                        <span>23–20</span>
                      </li>
                    </ol>
                    <a
                      className="cs-ink mt-3 inline-block font-semibold underline"
                      href="#preview-roster"
                    >
                      Roster sample
                    </a>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Salary commitments · illustrative</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      <strong className="cs-display text-3xl">$120.0M</strong> total · $116.0M
                      payroll + $4.0M release charges
                    </p>
                    <div
                      role="img"
                      aria-label="Sample salary bar: payroll 116 million plus release charges 4 million; cap 140, tax 170, first apron 180, second apron 190 million"
                      className="relative h-6 rounded bg-muted"
                    >
                      <div className="absolute inset-y-0 left-0 w-[58%] rounded-l bg-primary" />
                      <div className="absolute inset-y-0 left-[58%] w-[2%] bg-foreground" />
                      {[70, 85, 90, 95].map((percent) => (
                        <span
                          key={percent}
                          style={{ left: `${percent}%` }}
                          className="absolute inset-y-0 border-l-2 border-foreground"
                        />
                      ))}
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      {[
                        ["Cap", "$140M"],
                        ["Tax", "$170M"],
                        ["1st apron", "$180M"],
                        ["2nd apron", "$190M"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="font-semibold">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-xs text-muted-foreground">
                      Fictional thresholds, not NBA rules or spending permission. Bar scale: $200M.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Alerts · sample</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>Review expiring sample contracts before planning.</p>
                    <a className="cs-ink font-semibold underline" href="#preview-roster">
                      Review roster sample
                    </a>
                    <p className="text-xs text-muted-foreground">
                      Illustrative notice only; no transaction or simulation is available.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div id="preview-calendar" className="scroll-mt-4 rounded-md border p-4">
                <h3 className="font-semibold">Calendar representation</h3>
                <p className="text-muted-foreground">
                  Fictional Jan 19 · {team} vs Harbor Comets. No playable fixture.
                </p>
              </div>
              <div id="preview-postseason" className="scroll-mt-4 rounded-md border p-4">
                <h3 className="font-semibold">Postseason / offseason representation</h3>
                <p className="text-muted-foreground">
                  Illustrative results and planning access only. No next-season action.
                </p>
              </div>
            </div>
          </section>

          <section
            id="preview-roster"
            aria-labelledby="roster-title"
            className="scroll-mt-4 space-y-4"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="cs-eyebrow text-muted-foreground">
                  FRONT OFFICE / WORKSPACE SPECIMEN
                </p>
                <h2 id="roster-title" className="cs-display mt-1 text-3xl">
                  ROSTER & PLAYER IDENTITY
                </h2>
              </div>
              <output className="text-xs text-muted-foreground">Selected: {selected}</output>
            </div>
            <div className="grid items-start gap-5 min-[1200px]:grid-cols-[minmax(0,1fr)_296px]">
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>Sample roster</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Sortable rows, selection, unavailable values and shared primitives.
                  </p>
                </CardHeader>
                <div className="flex flex-wrap items-end gap-3 border-y px-6 py-4">
                  <div className="grid min-w-40 flex-1 gap-1.5">
                    <Label htmlFor="preview-search">Search players</Label>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="preview-search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search sample players"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="preview-position">Position</Label>
                    <Select value={position} onValueChange={setPosition}>
                      <SelectTrigger id="preview-position" className="min-w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All positions</SelectItem>
                        {["PG", "SF", "C"].map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <fieldset className="cs-segment flex flex-wrap">
                    <legend className="sr-only">Sample roster view</legend>
                    {Object.values(TABLE_VIEW).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={view === value}
                        onClick={() => setView(value)}
                        className="capitalize"
                      >
                        {value}
                      </button>
                    ))}
                  </fieldset>
                </div>
                <AppTable className="min-w-[620px]">
                  <caption className="sr-only">
                    Fictional roster. Select a player to compare row states.
                  </caption>
                  <AppTableHeader>
                    <AppTableRow>
                      <AppTableHead>#</AppTableHead>
                      <SortableTableHeader
                        ascending={ascending}
                        onSort={() => setAscending(!ascending)}
                        className="[&>button]:justify-start"
                      >
                        Player
                      </SortableTableHeader>
                      <AppTableHead>POS</AppTableHead>
                      <AppTableHead className="text-right">
                        {view === TABLE_VIEW.OVERVIEW ? "OVR" : "Status"}
                      </AppTableHead>
                      <AppTableHead className="text-right">Sample salary</AppTableHead>
                    </AppTableRow>
                  </AppTableHeader>
                  <tbody>
                    {visiblePlayers.map((sample) => (
                      <AppTableRow
                        key={sample.name}
                        data-state={selected === sample.name ? "selected" : undefined}
                      >
                        <AppTableCell className="text-muted-foreground tabular-nums">
                          {sample.number}
                        </AppTableCell>
                        <AppTableCell>
                          <div className="flex items-center gap-3">
                            <PlayerHeadshot
                              alt=""
                              className="size-11 shrink-0 rounded bg-muted object-cover object-top"
                            />
                            <button
                              type="button"
                              aria-label={`Select ${sample.name}`}
                              aria-pressed={selected === sample.name}
                              onClick={() => setSelected(sample.name)}
                              className="flex min-h-11 items-center gap-2 rounded text-left font-semibold hover:underline"
                            >
                              {sample.name}
                              {selected === sample.name && (
                                <Check aria-hidden="true" className="cs-ink size-4 shrink-0" />
                              )}
                            </button>
                          </div>
                        </AppTableCell>
                        <AppTableCell className="text-muted-foreground">
                          {sample.position}
                        </AppTableCell>
                        <AppTableCell className="text-right">
                          {view === TABLE_VIEW.OVERVIEW ? (
                            <span className="cs-rating relative">
                              <span aria-hidden="true">{sample.rating ?? "—"}</span>
                              <span className="sr-only">
                                {sample.rating
                                  ? `Overall rating ${sample.rating} out of 100`
                                  : "Overall rating unavailable"}
                              </span>
                            </span>
                          ) : (
                            <Badge variant="outline">
                              {sample.salary === "Unknown" ? "Unverified" : "Sample"}
                            </Badge>
                          )}
                        </AppTableCell>
                        <AppTableCell className="text-right whitespace-nowrap tabular-nums">
                          {sample.salary}
                        </AppTableCell>
                      </AppTableRow>
                    ))}
                    {visiblePlayers.length === 0 && (
                      <AppTableRow>
                        <AppTableCell
                          colSpan={5}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No sample players match these filters.
                        </AppTableCell>
                      </AppTableRow>
                    )}
                  </tbody>
                </AppTable>
                <div className="flex flex-wrap justify-between gap-2 px-6 py-3 text-xs text-muted-foreground">
                  <span>{visiblePlayers.length} illustrative players</span>
                  <span>Unknown is not zero.</span>
                </div>
              </Card>
              <Card className="cs-inspector" aria-label="Sample player inspector">
                <div className="flex items-center justify-between border-b px-5 py-3">
                  <span className="cs-eyebrow text-muted-foreground">PLAYER INSPECTOR</span>
                  <Badge variant="outline">SAMPLE</Badge>
                </div>
                <div className="cs-portrait relative flex justify-center overflow-hidden px-6 pt-5">
                  <span
                    className="cs-display absolute top-4 left-5 text-8xl text-foreground/5"
                    aria-hidden="true"
                  >
                    {player.number}
                  </span>
                  <PlayerHeadshot
                    alt=""
                    className="relative h-40 w-44 object-contain object-bottom"
                  />
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <p className="cs-eyebrow cs-ink">
                      #{player.number} · {player.position}
                    </p>
                    <h3 className="cs-display mt-2 text-3xl leading-none">{player.name}</h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Fictional identity · visual reference only
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-y py-4">
                    <span className="text-sm text-muted-foreground">Overall rating</span>
                    <span className="cs-display cs-ink text-3xl tabular-nums">
                      {player.rating ?? "—"}
                    </span>
                  </div>
                  <div>
                    <p className="cs-eyebrow text-muted-foreground">SAMPLE ANNUAL SALARY</p>
                    <p className="mt-1 text-xl tabular-nums">{player.salary}</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={openDialog}>
                    Inspect sample <ArrowUpRight aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </Card>
            </div>
          </section>

          <section
            id="preview-components"
            aria-labelledby="components-title"
            className="scroll-mt-4 space-y-4"
          >
            <div>
              <p className="cs-eyebrow text-muted-foreground">FOUNDATIONS / COMPONENT CATALOG</p>
              <h2 id="components-title" className="cs-display mt-1 text-3xl">
                BUILT FROM THE SAME PRIMITIVES
              </h2>
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Actions & interaction states</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={openDialog}>Primary action</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="link">Text link</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled>
                      Unavailable
                    </Button>
                    <Button disabled aria-busy="true">
                      <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" />
                      Updating…
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use Tab to inspect focus. Pressed, selected, disabled and pending are distinct
                    states.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Franchise</Badge>
                    <Badge variant="outline" className="cs-positive">
                      Available
                    </Badge>
                    <Badge variant="outline" className="cs-warning">
                      Estimated
                    </Badge>
                    <Badge variant="outline" className="cs-negative">
                      Unavailable
                    </Badge>
                    <span className="cs-rating">88</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Fields & validation</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="preview-name">Sample name</Label>
                    <Input
                      id="preview-name"
                      placeholder="Enter a name"
                      value={exampleValue}
                      onChange={(event) => setExampleValue(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="preview-locked">Disabled field</Label>
                    <Input id="preview-locked" value="Unavailable" disabled />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="preview-invalid">Invalid value specimen</Label>
                    <Input
                      id="preview-invalid"
                      aria-invalid="true"
                      aria-describedby="preview-invalid-help"
                      defaultValue="Invalid example"
                    />
                    <p id="preview-invalid-help" className="cs-negative text-xs">
                      Example validation message. No form is submitted.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Async & empty states</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <section aria-label="Loading specimen" aria-busy="true" className="space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <span className="sr-only">Loading sample content</span>
                  </section>
                  <div className="flex gap-3 rounded border p-3">
                    <CircleAlert
                      className="cs-negative mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-semibold">Error state specimen</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        A real screen would retain its existing error and retry behavior.
                      </p>
                    </div>
                  </div>
                  <p className="rounded border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No activity yet · empty state specimen
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Surfaces & type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    {SWATCHES.map((swatch) => (
                      <div key={swatch.token}>
                        <div
                          className="cs-token mb-2 h-9 rounded border"
                          style={{ background: `var(${swatch.token})` }}
                        />
                        <p className="text-xs">{swatch.name}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-4">
                    <p className="cs-display text-3xl">BARLOW CONDENSED</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Barlow for readable content. Display type for titles and metrics.
                    </p>
                    <p className="mt-2 text-2xl tabular-nums">82 / $12,500,000</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="preview-overlays" aria-labelledby="overlays-title" className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <span id="overlays-title">Portals & overlays</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Open these and the Position select to check typography, surfaces and focus outside
                  the page tree.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={openDialog}>
                  Open sample dialog
                </Button>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">Open sample drawer</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle className="cs-display text-[28px]">
                        Contract panel specimen
                      </SheetTitle>
                      <SheetDescription>
                        Visual sandbox only. No offer or agreement is created.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-5 px-6 pb-6">
                      <PlayerHeadshot alt="" className="h-44 w-full bg-muted object-contain" />
                      <p className="cs-display text-3xl">{player.name}</p>
                      <Label htmlFor="preview-drawer-note">Sample note</Label>
                      <Input id="preview-drawer-note" placeholder="Not persisted" />
                      <p className="text-sm text-muted-foreground">
                        The same semantic tokens reach this body portal. Close with Escape to return
                        focus to the opener.
                      </p>
                    </div>
                  </SheetContent>
                </Sheet>
                <Button asChild variant="ghost">
                  <a href="#preview-overview">
                    Back to foundation{" "}
                    <ArrowDown className="size-4 rotate-180" aria-hidden="true" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </section>
          <footer className="flex flex-wrap justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
            <span>COURTSIDE · PHASE 01 / VISUAL REVIEW</span>
            <Link href="/login" prefetch={false} className="underline underline-offset-4">
              Leave catalog
            </Link>
          </footer>
        </div>
      </SidebarInset>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            dialogOpener.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className="cs-display text-[28px]">Player identity specimen</DialogTitle>
          </DialogHeader>
          <DialogPrimitive.Description className="text-sm text-muted-foreground">
            Fictional player details for visual review. This is not a connected player profile.
          </DialogPrimitive.Description>
          <div className="flex flex-wrap items-center gap-5">
            <PlayerHeadshot alt="" className="size-28 rounded bg-muted object-contain" />
            <div>
              <p className="cs-eyebrow cs-ink">
                {player.position} · #{player.number}
              </p>
              <p className="cs-display mt-2 text-4xl">{player.name}</p>
              <p className="mt-2 text-sm tabular-nums">{player.salary}</p>
            </div>
          </div>
          <DialogPrimitive.Close asChild>
            <Button variant="outline">Close specimen</Button>
          </DialogPrimitive.Close>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
