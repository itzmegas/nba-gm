"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { createT } from "@/application/i18n/createT";
import type { Locale } from "@/application/i18n/types";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { playerProfileHref } from "@/components/league/navigation";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { ReleasePlayerButton } from "@/components/roster/release-player-button";
import {
  AppTable,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
} from "@/components/ui/app-table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SortableTableHeader } from "@/components/ui/sortable-table-header";
import { TableActions } from "@/components/ui/table-actions";
import { CONTRACT_IDENTITY_RESOLUTION_STATUS } from "@/domain/contracts/GameContract";
import { CONTRACT_ORIGIN } from "@/domain/entities/Contract";
import type { PlayerAttributes } from "@/domain/entities/PlayerAttributes";
import { formatSalarySeasonLabel, getYearsRemaining } from "@/domain/entities/Season";

export function formatRosterSalary(
  amount: number | null | undefined,
  locale: Locale = "en"
): string {
  if (amount === null || amount === undefined) return createT(locale)("dashboard", "unknownValue");
  const millions = amount >= 1_000_000;
  const formatted = new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: millions ? 1 : 0,
    maximumFractionDigits: millions ? 1 : 3,
  }).format(millions ? amount / 1_000_000 : amount);
  return millions ? `${formatted}M` : formatted;
}

export function getRosterContractClassification(
  rosterPlayer: RosterPlayer,
  locale: Locale = "en"
): {
  label: string;
  title: string;
} {
  const t = createT(locale);
  const state = rosterPlayer.gameContract;
  if (rosterPlayer.contract?.origin === CONTRACT_ORIGIN.SIMULATED_AGREEMENT) {
    return {
      label: t("dashboard", "contractStandard"),
      title: t("dashboard", "simulatedContractDescription"),
    };
  }
  if (state?.contractType === "two-way")
    return {
      label: t("dashboard", "contractTwoWay"),
      title: t("dashboard", "twoWayContractDescription"),
    };
  if (state?.estimated)
    return {
      label: t("dashboard", "contractEstimated"),
      title: t("dashboard", "estimatedContractDescription"),
    };
  if (
    state?.resolutionStatus === CONTRACT_IDENTITY_RESOLUTION_STATUS.OBSERVED_STANDARD &&
    state.contractType === "standard" &&
    state.provenanceQuality === "observed"
  ) {
    return {
      label: t("dashboard", "contractStandard"),
      title: t("dashboard", "observedContractDescription"),
    };
  }
  return {
    label: t("dashboard", "unknownValue"),
    title: t("dashboard", "unknownContractDescription"),
  };
}

export function shouldRenderRosterPlayer(rosterPlayer: RosterPlayer): boolean {
  return (
    rosterPlayer.contract?.origin === CONTRACT_ORIGIN.SIMULATED_AGREEMENT ||
    rosterPlayer.gameContract?.resolutionStatus !==
      CONTRACT_IDENTITY_RESOLUTION_STATUS.INACTIVE_EXCLUDED
  );
}

function getContractYearsLeft(baseSeasonYear: number, endYear: number): number {
  return getYearsRemaining(baseSeasonYear, endYear);
}

export function getContractStatus(
  rosterPlayer: RosterPlayer,
  baseSeasonYear: number,
  locale: Locale
) {
  const t = createT(locale);
  const { contract } = rosterPlayer;
  if (!contract)
    return {
      label: t("dashboard", "contractUnavailable"),
      variant: "outline" as const,
      icon: AlertTriangle,
    };

  const yearsLeft = getContractYearsLeft(baseSeasonYear, contract.endYear);

  if (contract.isPlayerOption)
    return {
      label: t("dashboard", "contractPlayerOption"),
      variant: "secondary" as const,
      icon: Clock,
    };
  if (contract.isTeamOption)
    return {
      label: t("dashboard", "contractTeamOption"),
      variant: "secondary" as const,
      icon: Clock,
    };
  if (yearsLeft === 1)
    return {
      label: t("dashboard", "contractExpiring"),
      variant: "destructive" as const,
      icon: AlertTriangle,
    };
  if (contract.isGuaranteed === false)
    return {
      label: t("dashboard", "contractNonGuaranteed"),
      variant: "outline" as const,
      icon: AlertTriangle,
    };
  if (contract.isGuaranteed !== true)
    return {
      label: t("dashboard", "contractGuaranteeUnknown"),
      variant: "outline" as const,
      icon: AlertTriangle,
    };

  return {
    label: t("dashboard", "contractGuaranteed"),
    variant: "default" as const,
    icon: CheckCircle2,
  };
}

const ATTRIBUTE_COLUMNS = [
  { key: "closeShot", label: "CLOSE" },
  { key: "midRangeShot", label: "MID" },
  { key: "threePointShot", label: "3PT" },
  { key: "freeThrow", label: "FT" },
  { key: "drawFoul", label: "FOUL" },
  { key: "ballHandle", label: "HANDLE" },
  { key: "passAccuracy", label: "PASS" },
  { key: "interiorDefense", label: "INT D" },
  { key: "perimeterDefense", label: "PER D" },
  { key: "steal", label: "STL" },
  { key: "block", label: "BLK" },
  { key: "offensiveRebound", label: "OREB" },
  { key: "defensiveRebound", label: "DREB" },
  { key: "stamina", label: "STA" },
] as const satisfies readonly { key: keyof PlayerAttributes; label: string }[];

const SORT_VALUES = {
  jerseyNumber: ({ player }: RosterPlayer) =>
    player.jerseyNumber?.trim() ? Number(player.jerseyNumber) : null,
  player: ({ player }: RosterPlayer) => player.fullName,
  position: ({ player }: RosterPlayer) => player.position,
  height: ({ player }: RosterPlayer) => {
    const parts = player.height?.match(/^(\d+)\s*'\s*(\d+)\s*"?$/);
    return parts ? Number(parts[1]) * 12 + Number(parts[2]) : null;
  },
  salary: ({ contract }: RosterPlayer) => contract?.salaryY1,
  overall: ({ ratings }: RosterPlayer) => ratings?.overall,
  endYear: ({ contract }: RosterPlayer) => contract?.endYear,
  salaryY2: ({ contract }: RosterPlayer) => contract?.salaryY2,
  salaryY3: ({ contract }: RosterPlayer) => contract?.salaryY3,
  salaryY4: ({ contract }: RosterPlayer) => contract?.salaryY4,
};

export const ROSTER_TABLE_VIEW = {
  OVERVIEW: "overview",
  RATINGS: "ratings",
  CONTRACTS: "contracts",
} as const;
export type RosterTableView = (typeof ROSTER_TABLE_VIEW)[keyof typeof ROSTER_TABLE_VIEW];

type SortColumn = keyof typeof SORT_VALUES | keyof PlayerAttributes;

function getSortValue(row: RosterPlayer, column: SortColumn) {
  if (column in SORT_VALUES) return SORT_VALUES[column as keyof typeof SORT_VALUES](row);
  return row.ratings?.attributes[column as keyof PlayerAttributes];
}

interface RosterTableProps {
  gameId: string;
  players: RosterPlayer[];
  seasonYear: number;
  leagueTeamId?: string;
  leagueReturnQuery?: string;
  canRelease?: boolean;
  onSelectPlayer?: (playerId: string) => void;
  selectedPlayerId?: string;
  view?: RosterTableView;
}

export function RosterTable({
  gameId,
  players,
  seasonYear,
  leagueTeamId,
  leagueReturnQuery,
  canRelease = false,
  onSelectPlayer,
  selectedPlayerId,
  view = ROSTER_TABLE_VIEW.RATINGS,
}: RosterTableProps) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [sort, setSort] = useState<{ column: SortColumn; ascending: boolean }>({
    column: "salary",
    ascending: false,
  });
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });

  const sorted = players.filter(shouldRenderRosterPlayer).sort((a, b) => {
    const sa = getSortValue(a, sort.column);
    const sb = getSortValue(b, sort.column);
    const missingA = sa == null || sa === "" || (typeof sa === "number" && !Number.isFinite(sa));
    const missingB = sb == null || sb === "" || (typeof sb === "number" && !Number.isFinite(sb));
    if (missingA || missingB) return Number(missingA) - Number(missingB);
    const comparison =
      typeof sa === "number" && typeof sb === "number"
        ? sa - sb
        : collator.compare(String(sa), String(sb));
    return sort.ascending ? comparison : -comparison;
  });

  function header(column: SortColumn, label: ReactNode, className: string) {
    return (
      <SortableTableHeader
        key={column}
        className={className}
        ascending={sort.column === column ? sort.ascending : undefined}
        onSort={() =>
          setSort({
            column,
            ascending:
              sort.column === column
                ? !sort.ascending
                : column === "player" ||
                  column === "position" ||
                  column === "height" ||
                  column === "jerseyNumber",
          })
        }
      >
        {label}
      </SortableTableHeader>
    );
  }

  return (
    <AppTable>
      <AppTableHeader>
        <AppTableRow>
          {header("jerseyNumber", "#", "w-8")}
          {header("player", t("dashboard", "rosterPlayer"), "[&>button]:justify-start")}
          {header("position", t("dashboard", "rosterPosition"), "w-16 text-center")}
          {view === ROSTER_TABLE_VIEW.RATINGS &&
            header(
              "height",
              t("dashboard", "rosterHeight"),
              "w-20 text-center hidden md:table-cell"
            )}
          {header(
            "salary",
            `${t("dashboard", "rosterSalary")} ${formatSalarySeasonLabel(seasonYear)}`,
            "min-w-36 whitespace-nowrap text-right [&>button]:justify-end"
          )}
          {view !== ROSTER_TABLE_VIEW.CONTRACTS &&
            header(
              "overall",
              <abbr title={t("playerAttributes", "overall")} className="cursor-help no-underline">
                OVR
              </abbr>,
              "min-w-16 border-x border-primary/20 bg-primary/10 px-3 py-3 text-center font-bold"
            )}
          {view === ROSTER_TABLE_VIEW.RATINGS &&
            ATTRIBUTE_COLUMNS.map(({ key, label }) =>
              header(
                key,
                <abbr title={t("playerAttributes", key)} className="cursor-help no-underline">
                  {label}
                </abbr>,
                "px-3 text-center whitespace-nowrap"
              )
            )}
          {view !== ROSTER_TABLE_VIEW.RATINGS &&
            header("endYear", t("dashboard", "rosterDuration"), "text-center")}
          {view === ROSTER_TABLE_VIEW.CONTRACTS && (
            <>
              {(["salaryY2", "salaryY3", "salaryY4"] as const).map((key, index) =>
                header(
                  key,
                  `${t("dashboard", "rosterSalary")} ${formatSalarySeasonLabel(seasonYear + index + 1)}`,
                  "whitespace-nowrap text-right [&>button]:justify-end"
                )
              )}
              <AppTableHead>{t("dashboard", "rosterStatus")}</AppTableHead>
            </>
          )}
          <AppTableHead className="text-right">{t("dashboard", "rosterActions")}</AppTableHead>
        </AppTableRow>
      </AppTableHeader>
      <tbody>
        {sorted.map((rosterPlayer) => {
          const { player, contract } = rosterPlayer;
          const classification = getRosterContractClassification(rosterPlayer, locale);

          return (
            <AppTableRow
              key={player.id}
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest("button, [role=menu]"))
                  return;
                if (onSelectPlayer) onSelectPlayer(player.id);
                else
                  router.push(
                    playerProfileHref(gameId, player.id, leagueTeamId, leagueReturnQuery)
                  );
              }}
              data-state={selectedPlayerId === player.id ? "selected" : undefined}
              className={onSelectPlayer ? "cursor-pointer" : undefined}
            >
              {/* Número camiseta */}
              <AppTableCell className="text-muted-foreground font-mono text-xs">
                {player.jerseyNumber ? `${player.jerseyNumber}` : "—"}
              </AppTableCell>

              {/* Nombre y Foto */}
              <AppTableCell>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-sm overflow-hidden bg-muted/50 flex items-center justify-center shrink-0">
                    <PlayerHeadshot
                      src={player.headshotUrl}
                      alt={player.fullName}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <button
                      type="button"
                      className="font-semibold whitespace-nowrap hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                      aria-pressed={onSelectPlayer ? selectedPlayerId === player.id : undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (onSelectPlayer) onSelectPlayer(player.id);
                        else
                          router.push(
                            playerProfileHref(gameId, player.id, leagueTeamId, leagueReturnQuery)
                          );
                      }}
                    >
                      {player.fullName}
                    </button>
                    <Badge variant="outline" title={classification.title}>
                      {classification.label}
                    </Badge>
                    {rosterPlayer.ratings?.estimated && (
                      <Badge variant="outline">{t("playerAttributes", "estimated")}</Badge>
                    )}
                  </div>
                </div>
              </AppTableCell>

              {/* Posición */}
              <AppTableCell className="px-2 text-center">
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {player.position ?? "—"}
                </span>
              </AppTableCell>

              {/* Altura */}
              {view === ROSTER_TABLE_VIEW.RATINGS && (
                <AppTableCell className="text-center text-muted-foreground hidden md:table-cell">
                  {player.height ?? "—"}
                </AppTableCell>
              )}

              {/* Salario Y1 */}
              <AppTableCell className="min-w-36 whitespace-nowrap text-right font-mono font-semibold">
                {formatRosterSalary(contract?.salaryY1, locale)}
              </AppTableCell>
              {view !== ROSTER_TABLE_VIEW.CONTRACTS && (
                <AppTableCell className="px-3 text-center font-mono tabular-nums">
                  <span className="inline-block min-w-8 rounded-sm border border-primary/20 bg-primary/10 px-1.5 py-1 font-bold">
                    {rosterPlayer.ratings?.overall ?? "—"}
                  </span>
                </AppTableCell>
              )}

              {view === ROSTER_TABLE_VIEW.RATINGS &&
                ATTRIBUTE_COLUMNS.map(({ key }) => (
                  <AppTableCell key={key} className="px-3 text-center font-mono tabular-nums">
                    {rosterPlayer.ratings?.attributes[key] ?? "—"}
                  </AppTableCell>
                ))}
              {view !== ROSTER_TABLE_VIEW.RATINGS && (
                <AppTableCell className="text-center font-mono whitespace-nowrap">
                  {contract
                    ? `${getYearsRemaining(seasonYear, contract.endYear)}${t("dashboard", "yearsShort")}`
                    : "—"}
                </AppTableCell>
              )}
              {view === ROSTER_TABLE_VIEW.CONTRACTS && (
                <>
                  {(["salaryY2", "salaryY3", "salaryY4"] as const).map((key) => (
                    <AppTableCell key={key} className="text-right font-mono whitespace-nowrap">
                      {formatRosterSalary(contract?.[key], locale)}
                    </AppTableCell>
                  ))}
                  <AppTableCell className="whitespace-nowrap">
                    {getContractStatus(rosterPlayer, seasonYear, locale).label}
                  </AppTableCell>
                </>
              )}
              <AppTableCell className="text-right">
                <TableActions label={`${t("dashboard", "rosterActions")} — ${player.fullName}`}>
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(
                        playerProfileHref(gameId, player.id, leagueTeamId, leagueReturnQuery)
                      )
                    }
                  >
                    {t("dashboard", "viewPlayer")}
                  </DropdownMenuItem>
                  {canRelease && (
                    <ReleasePlayerButton gameId={gameId} rosterPlayer={rosterPlayer} asMenuItem />
                  )}
                </TableActions>
              </AppTableCell>
            </AppTableRow>
          );
        })}
      </tbody>
    </AppTable>
  );
}
