import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  CONTRACT_OPTION_KIND,
  CONTRACT_SEASON_GUARANTEE_KIND,
} from "@/domain/contracts/ContractSnapshot";
import type { PlayerIdentityCrosswalk } from "@/domain/playerIdentity/PlayerIdentityCrosswalk";
import {
  BASKETBALL_REFERENCE_OPTION_KIND,
  buildContractDryRunReport,
  CONTRACT_INGESTION_WARNING,
  CONTRACT_MATCH_CLASSIFICATION,
  classifyContractPlayers,
  fetchBasketballReferenceTeamContracts,
  mapBasketballReferenceContractSnapshot,
  parseBasketballReferenceContractPage,
} from "@/infrastructure/contracts/basketballReferenceContractSource";

const fixtureUrl = new URL("./__fixtures__/lakers-contracts-minimal.html", import.meta.url);
const observedAt = new Date("2026-08-24T12:00:00.000Z");

async function parseFixture() {
  const html = await readFile(fixtureUrl, "utf8");
  return parseBasketballReferenceContractPage(html, {
    teamAbbreviation: "LAL",
    season: "2026-27",
    observedAt,
  });
}

describe("BasketballReferenceContractSource", () => {
  it("parses salaries, per-season options, guarantees, notes, and provenance", async () => {
    const snapshot = await parseFixture();
    const luka = snapshot.contracts.find(({ playerSlug }) => playerSlug === "doncilu01");
    const hardy = snapshot.contracts.find(({ playerSlug }) => playerSlug === "hardyja02");
    const knecht = snapshot.contracts.find(({ playerSlug }) => playerSlug === "knechda01");
    const looney = snapshot.contracts.find(({ playerSlug }) => playerSlug === "looneke01");

    expect(snapshot.metadata).toMatchObject({
      sourceUrl: "https://www.basketball-reference.com/contracts/LAL.html",
      observedAt: observedAt.toISOString(),
      cacheIdentity: {
        source: "basketball-reference",
        teamAbbreviation: "LAL",
        season: "2026-27",
      },
    });
    expect(snapshot.metadata.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.warnings).toEqual([CONTRACT_INGESTION_WARNING.SIX_SEASON_HORIZON]);
    expect(luka).toMatchObject({
      fullName: "Luka Dončić",
      playerUrl: "https://www.basketball-reference.com/players/d/doncilu01.html",
      remainingGuaranteedAmount: 103_584_000,
      contractNotes: [
        "2028-29 is a player option.",
        "Signed 3-yr/$161M contract extension August 2, 2025.",
      ],
    });
    expect(luka?.salaries[2]).toEqual({
      season: "2028-29",
      amount: 57_768_000,
      optionKind: BASKETBALL_REFERENCE_OPTION_KIND.PLAYER,
    });
    expect(hardy?.salaries[1].optionKind).toBe(BASKETBALL_REFERENCE_OPTION_KIND.TEAM);
    expect(knecht?.salaries.slice(0, 2).map(({ optionKind }) => optionKind)).toEqual([
      BASKETBALL_REFERENCE_OPTION_KIND.TEAM,
      BASKETBALL_REFERENCE_OPTION_KIND.TEAM,
    ]);
    expect(looney?.salaries[1]).toEqual({
      season: "2027-28",
      amount: null,
      optionKind: BASKETBALL_REFERENCE_OPTION_KIND.NONE,
    });
  });

  it("maps six source seasons without inventing agreement or season guarantees", async () => {
    const contracts = mapBasketballReferenceContractSnapshot(await parseFixture(), {
      doncilu01: "3945274",
    });
    const luka = contracts.find(({ provenance }) => provenance.sourcePlayerId === "doncilu01");
    const looney = contracts.find(({ provenance }) => provenance.sourcePlayerId === "looneke01");

    expect(luka).toMatchObject({
      playerId: "3945274",
      teamId: null,
      agreement: {
        startSeasonLabel: null,
        endSeasonLabel: null,
        remainingGuaranteedAmount: 103_584_000,
      },
      provenance: {
        source: "basketball-reference",
        notes: expect.arrayContaining(["2028-29 is a player option."]),
      },
    });
    expect(luka?.agreement.seasons).toHaveLength(6);
    expect(luka?.agreement.seasons[2]).toEqual({
      seasonLabel: "2028-29",
      startYear: 2028,
      endYear: 2029,
      salaryAmount: 57_768_000,
      optionKind: CONTRACT_OPTION_KIND.PLAYER,
      guaranteeKind: CONTRACT_SEASON_GUARANTEE_KIND.UNKNOWN,
    });
    expect(looney?.agreement.seasons[1]).toMatchObject({
      salaryAmount: null,
      optionKind: CONTRACT_OPTION_KIND.NONE,
      guaranteeKind: CONTRACT_SEASON_GUARANTEE_KIND.UNKNOWN,
    });
    expect(
      contracts.find(({ provenance }) => provenance.sourcePlayerId === "hardyja02")?.agreement
        .seasons[1].optionKind
    ).toBe(CONTRACT_OPTION_KIND.TEAM);
    expect(luka?.agreement.seasons.every(({ guaranteeKind }) => guaranteeKind === "unknown")).toBe(
      true
    );
  });

  it("reports source-neutral coverage and proves the dry-run has no write operation", async () => {
    const contracts = mapBasketballReferenceContractSnapshot(await parseFixture());
    expect(buildContractDryRunReport(contracts)).toEqual({
      contractCount: 5,
      maximumSeasonCount: 6,
      aggregateGuaranteeCount: 4,
      unknownAgreementBoundaryCount: 5,
      writeOperationCount: 0,
    });
  });

  it("preserves missing salary and guarantee data without guessing", async () => {
    const snapshot = await parseFixture();
    const manon = snapshot.contracts.find(({ playerSlug }) => playerSlug === "manonch01");
    expect(manon).toMatchObject({
      fullName: "Chris Mañon",
      remainingGuaranteedAmount: null,
      contractNotes: ["Signed two-way contract July 3, 2026."],
    });
    expect(manon?.salaries.every(({ amount }) => amount === null)).toBe(true);
  });

  it("preserves unavailable notes as null", async () => {
    const html = (await readFile(fixtureUrl, "utf8")).replace(
      /<!-- <table id="payroll-notes">[\s\S]*?<\/table> -->/,
      ""
    );
    const snapshot = parseBasketballReferenceContractPage(html, {
      teamAbbreviation: "LAL",
      season: "2026-27",
      observedAt,
    });
    expect(snapshot.contracts.every(({ contractNotes }) => contractNotes === null)).toBe(true);
  });

  it("classifies only through the explicit slug-to-ESPN crosswalk", async () => {
    const candidates: Readonly<Record<string, readonly string[]>> = {
      doncilu01: ["3945274"],
      hardyja02: ["5104157", "9999999"],
      knechda01: ["4397299"],
      looneke01: ["3155535"],
    };
    const crosswalk: PlayerIdentityCrosswalk = {
      resolve: (_provider, externalId) => candidates[externalId] ?? [],
    };
    const classifications = classifyContractPlayers(await parseFixture(), crosswalk);
    const bySlug = Object.fromEntries(classifications.map((entry) => [entry.playerSlug, entry]));

    expect(bySlug.doncilu01).toMatchObject({
      classification: CONTRACT_MATCH_CLASSIFICATION.MATCHED,
      espnId: 3945274,
    });
    expect(bySlug.hardyja02).toMatchObject({
      classification: CONTRACT_MATCH_CLASSIFICATION.AMBIGUOUS,
      espnId: null,
      candidateEspnIds: [5104157, 9999999],
    });
    expect(bySlug.manonch01).toMatchObject({
      classification: CONTRACT_MATCH_CLASSIFICATION.UNMATCHED,
      espnId: null,
    });
  });

  it("performs exactly one abortable request with an honest user agent", async () => {
    const html = await readFile(fixtureUrl, "utf8");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(html));
    const controller = new AbortController();

    await fetchBasketballReferenceTeamContracts({
      teamAbbreviation: "LAL",
      season: "2026-27",
      signal: controller.signal,
      observedAt,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.basketball-reference.com/contracts/LAL.html",
      expect.objectContaining({
        signal: controller.signal,
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("nba-gm") }),
      })
    );
    fetchMock.mockRestore();
  });
});
