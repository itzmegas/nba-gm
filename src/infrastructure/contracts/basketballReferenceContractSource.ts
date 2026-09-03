import { createHash } from "node:crypto";
import { z } from "zod";
import { ContractSnapshotSourceUnavailableError } from "@/application/contracts/getFreshContractSnapshot";
import {
  CONTRACT_OPTION_KIND,
  CONTRACT_SEASON_GUARANTEE_KIND,
  type ContractOptionKind,
  type ContractSnapshot,
} from "@/domain/contracts/ContractSnapshot";
import {
  PLAYER_IDENTITY_PROVIDER,
  type PlayerIdentityCrosswalk,
} from "@/domain/playerIdentity/PlayerIdentityCrosswalk";

export const CONTRACT_SOURCE = {
  BASKETBALL_REFERENCE: "basketball-reference",
} as const;

export const BASKETBALL_REFERENCE_OPTION_KIND = {
  NONE: "none",
  PLAYER: "player",
  TEAM: "team",
} as const;

export const CONTRACT_MATCH_CLASSIFICATION = {
  AMBIGUOUS: "ambiguous",
  MATCHED: "matched",
  UNMATCHED: "unmatched",
} as const;

export const CONTRACT_INGESTION_WARNING = {
  SIX_SEASON_HORIZON: "six-season-horizon",
} as const;

const seasonLabelSchema = z.string().regex(/^\d{4}-\d{2}$/);
const sourceUrlSchema = z
  .url()
  .refine((url) => new URL(url).hostname === "www.basketball-reference.com", {
    error: "Expected a Basketball-Reference URL",
  });

const salarySchema = z.object({
  season: seasonLabelSchema,
  amount: z.number().int().nonnegative().nullable(),
  optionKind: z.enum(BASKETBALL_REFERENCE_OPTION_KIND),
});

const playerContractSchema = z.object({
  playerSlug: z.string().regex(/^[a-z0-9]+$/),
  playerUrl: sourceUrlSchema,
  fullName: z.string().min(1),
  teamAbbreviation: z.string().regex(/^[A-Z]{2,3}$/),
  salaries: z.array(salarySchema).min(1),
  remainingGuaranteedAmount: z.number().int().nonnegative().nullable(),
  contractNotes: z.array(z.string().min(1)).nullable(),
});

const cacheIdentitySchema = z.object({
  source: z.literal(CONTRACT_SOURCE.BASKETBALL_REFERENCE),
  teamAbbreviation: z.string().regex(/^[A-Z]{2,3}$/),
  season: seasonLabelSchema,
});

const requestIdentitySchema = z.object({
  teamAbbreviation: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,3}$/),
  season: seasonLabelSchema,
});

export const basketballReferenceContractSnapshotSchema = z.object({
  metadata: z.object({
    sourceUrl: sourceUrlSchema,
    observedAt: z.iso.datetime(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    cacheIdentity: cacheIdentitySchema,
  }),
  contracts: z.array(playerContractSchema).min(1),
  warnings: z.array(z.enum(CONTRACT_INGESTION_WARNING)),
});

const classificationSchema = z.object({
  classification: z.enum(CONTRACT_MATCH_CLASSIFICATION),
  playerSlug: z.string().min(1),
  fullName: z.string().min(1),
  espnId: z.number().int().positive().nullable(),
  candidateEspnIds: z.array(z.number().int().positive()),
});

export type BasketballReferenceContractSnapshot = z.infer<
  typeof basketballReferenceContractSnapshotSchema
>;
export type BasketballReferencePlayerContract = z.infer<typeof playerContractSchema>;
export type ContractDryRunClassification = z.infer<typeof classificationSchema>;

export interface BasketballReferenceFetchInput {
  teamAbbreviation: string;
  season: string;
  signal?: AbortSignal;
  observedAt?: Date;
}

const BASE_URL = "https://www.basketball-reference.com";
const USER_AGENT = "nba-gm-contract-ingestion-spike/0.1 (+https://github.com/itzmegas/nba-gm)";

function decodeHtml(value: string): string {
  const entities: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f\d]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) => entities[name] ?? entity);
}

function textContent(html: string): string {
  return decodeHtml(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tableById(html: string, id: string): string {
  const match = html.match(
    new RegExp(`<table\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/table>`, "i")
  );
  if (!match) throw new Error(`Basketball-Reference response is missing table #${id}`);
  return match[0];
}

function optionalTableById(html: string, id: string): string | null {
  const match = html.match(
    new RegExp(`<table\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/table>`, "i")
  );
  return match?.[0] ?? null;
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]) : null;
}

function cellByStat(row: string, stat: string): string | null {
  const cells = row.match(/<(?:th|td)\b[^>]*>[\s\S]*?<\/(?:th|td)>/gi) ?? [];
  return cells.find((cell) => attribute(cell, "data-stat") === stat) ?? null;
}

function parseMoneyCell(cell: string | null): number | null {
  if (!cell) return null;
  const csk = attribute(cell, "csk");
  if (csk && /^\d+$/.test(csk)) return Number(csk);
  const digits = textContent(cell).replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function parseOptionKind(
  cell: string | null
): (typeof BASKETBALL_REFERENCE_OPTION_KIND)[keyof typeof BASKETBALL_REFERENCE_OPTION_KIND] {
  const className = cell ? attribute(cell, "class") : null;
  if (className?.split(/\s+/).includes("salary-pl")) {
    return BASKETBALL_REFERENCE_OPTION_KIND.PLAYER;
  }
  if (className?.split(/\s+/).includes("salary-tm")) {
    return BASKETBALL_REFERENCE_OPTION_KIND.TEAM;
  }
  return BASKETBALL_REFERENCE_OPTION_KIND.NONE;
}

function mapBasketballReferenceOptionKind(
  optionKind: BasketballReferencePlayerContract["salaries"][number]["optionKind"]
): ContractOptionKind {
  switch (optionKind) {
    case BASKETBALL_REFERENCE_OPTION_KIND.PLAYER:
      return CONTRACT_OPTION_KIND.PLAYER;
    case BASKETBALL_REFERENCE_OPTION_KIND.TEAM:
      return CONTRACT_OPTION_KIND.TEAM;
    case BASKETBALL_REFERENCE_OPTION_KIND.NONE:
      return CONTRACT_OPTION_KIND.NONE;
  }
}

function parseSeasonLabel(seasonLabel: string): { startYear: number; endYear: number } {
  const [startYearText, endYearSuffix] = seasonLabel.split("-");
  const startYear = Number(startYearText);
  const century = Math.floor(startYear / 100) * 100;
  let endYear = century + Number(endYearSuffix);
  if (endYear < startYear) endYear += 100;
  return { startYear, endYear };
}

export function mapBasketballReferenceContractSnapshot(
  snapshot: BasketballReferenceContractSnapshot,
  resolvedPlayerIds: Readonly<Record<string, string>> = {}
): ContractSnapshot[] {
  return snapshot.contracts.map((contract) => ({
    playerId: resolvedPlayerIds[contract.playerSlug] ?? null,
    teamId: null,
    agreement: {
      startSeasonLabel: null,
      endSeasonLabel: null,
      seasons: contract.salaries.map((salary) => ({
        seasonLabel: salary.season,
        ...parseSeasonLabel(salary.season),
        salaryAmount: salary.amount,
        optionKind: mapBasketballReferenceOptionKind(salary.optionKind),
        guaranteeKind: CONTRACT_SEASON_GUARANTEE_KIND.UNKNOWN,
      })),
      remainingGuaranteedAmount: contract.remainingGuaranteedAmount,
    },
    provenance: {
      source: CONTRACT_SOURCE.BASKETBALL_REFERENCE,
      sourceUrl: contract.playerUrl,
      sourcePlayerId: contract.playerSlug,
      observedAt: snapshot.metadata.observedAt,
      notes: contract.contractNotes,
    },
  }));
}

export interface ContractDryRunReport {
  contractCount: number;
  maximumSeasonCount: number;
  aggregateGuaranteeCount: number;
  unknownAgreementBoundaryCount: number;
  writeOperationCount: 0;
}

export function buildContractDryRunReport(
  contracts: readonly ContractSnapshot[]
): ContractDryRunReport {
  return {
    contractCount: contracts.length,
    maximumSeasonCount: Math.max(0, ...contracts.map(({ agreement }) => agreement.seasons.length)),
    aggregateGuaranteeCount: contracts.filter(
      ({ agreement }) => agreement.remainingGuaranteedAmount !== null
    ).length,
    unknownAgreementBoundaryCount: contracts.filter(
      ({ agreement }) => agreement.startSeasonLabel === null && agreement.endSeasonLabel === null
    ).length,
    writeOperationCount: 0,
  };
}

function parseSeasonColumns(table: string): ReadonlyArray<{ stat: string; season: string }> {
  const headers = table.match(/<th\b[^>]*>[\s\S]*?<\/th>/gi) ?? [];
  return headers.flatMap((header) => {
    const stat = attribute(header, "data-stat");
    const season = attribute(header, "aria-label");
    return stat && /^y\d+$/.test(stat) && season && seasonLabelSchema.safeParse(season).success
      ? [{ stat, season }]
      : [];
  });
}

function parseNotes(html: string): ReadonlyMap<string, string[]> {
  const notesTable = optionalTableById(html, "payroll-notes");
  const notes = new Map<string, string[]>();
  if (!notesTable) return notes;

  for (const row of notesTable.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const playerCell = cellByStat(row, "player");
    const notesCell = cellByStat(row, "notes");
    const href = playerCell ? attribute(playerCell.match(/<a\b[^>]*>/i)?.[0] ?? "", "href") : null;
    const slug = href?.match(/\/players\/[a-z]\/([a-z0-9]+)\.html$/i)?.[1];
    if (!slug || !notesCell) continue;
    const items = [...notesCell.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) =>
      textContent(match[1])
    );
    notes.set(slug, items.length > 0 ? items : [textContent(notesCell)]);
  }

  return notes;
}

export function parseBasketballReferenceContractPage(
  html: string,
  input: Omit<BasketballReferenceFetchInput, "signal">
): BasketballReferenceContractSnapshot {
  const identity = requestIdentitySchema.parse(input);
  const { teamAbbreviation } = identity;
  const sourceUrl = `${BASE_URL}/contracts/${encodeURIComponent(teamAbbreviation)}.html`;
  const contractTable = tableById(html, "contracts");
  const seasons = parseSeasonColumns(contractTable);
  if (seasons.length === 0) throw new Error("Basketball-Reference response has no salary seasons");
  const notesBySlug = parseNotes(html);
  const contracts: BasketballReferencePlayerContract[] = [];

  for (const row of contractTable.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const playerCell = cellByStat(row, "player");
    const anchor = playerCell?.match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0] ?? null;
    const href = anchor ? attribute(anchor, "href") : null;
    const playerSlug = href?.match(/\/players\/[a-z]\/([a-z0-9]+)\.html$/i)?.[1];
    if (!anchor || !href || !playerSlug) continue;

    contracts.push({
      playerSlug,
      playerUrl: new URL(href, BASE_URL).toString(),
      fullName: textContent(anchor),
      teamAbbreviation,
      salaries: seasons.map(({ stat, season }) => {
        const cell = cellByStat(row, stat);
        return { season, amount: parseMoneyCell(cell), optionKind: parseOptionKind(cell) };
      }),
      remainingGuaranteedAmount: parseMoneyCell(cellByStat(row, "remain_gtd")),
      contractNotes: notesBySlug.get(playerSlug) ?? null,
    });
  }

  return basketballReferenceContractSnapshotSchema.parse({
    metadata: {
      sourceUrl,
      observedAt: (input.observedAt ?? new Date()).toISOString(),
      contentHash: createHash("sha256").update(html).digest("hex"),
      cacheIdentity: {
        source: CONTRACT_SOURCE.BASKETBALL_REFERENCE,
        teamAbbreviation,
        season: identity.season,
      },
    },
    contracts,
    warnings: seasons.length >= 6 ? [CONTRACT_INGESTION_WARNING.SIX_SEASON_HORIZON] : [],
  });
}

export async function fetchBasketballReferenceTeamContracts(
  input: BasketballReferenceFetchInput
): Promise<BasketballReferenceContractSnapshot> {
  const { teamAbbreviation } = requestIdentitySchema.parse(input);
  const url = `${BASE_URL}/contracts/${encodeURIComponent(teamAbbreviation)}.html`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": USER_AGENT },
      signal: input.signal,
    });
  } catch (error) {
    throw new ContractSnapshotSourceUnavailableError(
      `Basketball-Reference request failed for ${teamAbbreviation}`,
      { cause: error }
    );
  }
  if (!response.ok) {
    throw new ContractSnapshotSourceUnavailableError(
      `Basketball-Reference returned ${response.status} for ${teamAbbreviation}`
    );
  }
  return parseBasketballReferenceContractPage(await response.text(), input);
}

export function classifyContractPlayers(
  snapshot: BasketballReferenceContractSnapshot,
  crosswalk: PlayerIdentityCrosswalk
): ContractDryRunClassification[] {
  return snapshot.contracts.map((contract) => {
    const candidates = crosswalk
      .resolve(
        PLAYER_IDENTITY_PROVIDER.BASKETBALL_REFERENCE,
        contract.playerSlug,
        PLAYER_IDENTITY_PROVIDER.ESPN
      )
      .map(Number);
    const classification =
      candidates.length === 0
        ? CONTRACT_MATCH_CLASSIFICATION.UNMATCHED
        : candidates.length === 1
          ? CONTRACT_MATCH_CLASSIFICATION.MATCHED
          : CONTRACT_MATCH_CLASSIFICATION.AMBIGUOUS;
    return classificationSchema.parse({
      classification,
      playerSlug: contract.playerSlug,
      fullName: contract.fullName,
      espnId: candidates.length === 1 ? candidates[0] : null,
      candidateEspnIds: candidates,
    });
  });
}
