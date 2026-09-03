import { describe, expect, it } from "vitest";
import type { BasketballReferenceContractSnapshot } from "@/infrastructure/contracts/basketballReferenceContractSource";
import { NBA_TO_BASKETBALL_REFERENCE_TEAMS } from "@/infrastructure/contracts/basketballReferenceTeamMapping";
import {
  canonicalizePlayerName,
  reconcileContractPlayerIdentities,
} from "@/infrastructure/playerIdentity/reconcileContractPlayerIdentities";

const observedAt = "2026-08-24T12:00:00.000Z";
const snapshots: BasketballReferenceContractSnapshot[] = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
  ({ basketballReferenceAbbreviation }, index) => ({
    metadata: {
      sourceUrl: `https://www.basketball-reference.com/contracts/${basketballReferenceAbbreviation}.html`,
      observedAt,
      contentHash: String(index).padStart(64, "a"),
      cacheIdentity: {
        source: "basketball-reference",
        teamAbbreviation: basketballReferenceAbbreviation,
        season: "2025-26",
      },
    },
    contracts: [
      {
        playerSlug: `player${index}`,
        playerUrl: `https://www.basketball-reference.com/players/p/player${index}.html`,
        fullName: `Player ${index}`,
        teamAbbreviation: basketballReferenceAbbreviation,
        salaries: [{ season: "2025-26", amount: 1_000_000, optionKind: "none" }],
        remainingGuaranteedAmount: null,
        contractNotes: null,
      },
    ],
    warnings: [],
  })
);
const roster = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
  ({ nbaAbbreviation, basketballReferenceAbbreviation }, index) => ({
    playerId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    providerId: String(index + 1),
    fullName: `Player ${index}`,
    nbaTeam: nbaAbbreviation,
    sourceTeam: basketballReferenceAbbreviation,
  })
);

describe("reconcileContractPlayerIdentities", () => {
  it("reconciles fixture records for every NBA team with explicit evidence", () => {
    const result = reconcileContractPlayerIdentities(snapshots, roster);
    expect(result.unresolved).toEqual([]);
    expect(result.validated).toHaveLength(30);
    expect(new Set(result.validated.map(({ evidence }) => evidence.nbaTeam)).size).toBe(30);
  });

  it.each([
    ["Luka Dončić", "Luka Doncic"],
    ["Royce O’Neale", "Royce O'Neale"],
    ["Karl‐Anthony Towns", "Karl-Anthony Towns"],
  ])("matches safe canonical variants for %s", (sourceName, targetName) => {
    const source = structuredClone(snapshots[0]);
    const target = structuredClone(roster[0]);
    source.contracts[0].fullName = sourceName;
    target.fullName = targetName;
    expect(reconcileContractPlayerIdentities([source], [target]).validated).toHaveLength(1);
  });

  it("preserves suffix semantics and punctuation boundaries", () => {
    expect(canonicalizePlayerName("Nick Smith Jr.")).toBe(canonicalizePlayerName("Nick Smith JR"));
    expect(canonicalizePlayerName("Nick Smith Jr.")).not.toBe(canonicalizePlayerName("Nick Smith"));
    expect(canonicalizePlayerName("Gary Payton II")).not.toBe(
      canonicalizePlayerName("Gary Payton III")
    );
    expect(canonicalizePlayerName("De'Andre Hunter")).not.toBe(
      canonicalizePlayerName("De Andre Hunter")
    );
    expect(canonicalizePlayerName("Karl-Anthony Towns")).not.toBe(
      canonicalizePlayerName("Karl Anthony Towns")
    );
  });

  it("blocks duplicate canonical names on the same team", () => {
    const source = structuredClone(snapshots[0]);
    const duplicates = [structuredClone(roster[0]), structuredClone(roster[0])];
    duplicates[1].playerId = "different-player";
    duplicates[1].providerId = "different-provider";
    expect(reconcileContractPlayerIdentities([source], duplicates).unresolved[0]?.reason).toBe(
      "ambiguous-provider-records"
    );
  });

  it("blocks reused source and target provider IDs", () => {
    const reusedSource = [structuredClone(snapshots[0]), structuredClone(snapshots[0])];
    expect(
      reconcileContractPlayerIdentities(reusedSource, [roster[0]]).unresolved.every(
        ({ reason }) => reason === "duplicate-source-player"
      )
    ).toBe(true);
    const source = structuredClone(snapshots[0]);
    const targets = [structuredClone(roster[0]), structuredClone(roster[1])];
    targets[1].providerId = targets[0].providerId;
    expect(reconcileContractPlayerIdentities([source], targets).unresolved[0]?.reason).toBe(
      "duplicate-target-player"
    );
  });

  it("never matches a canonical name across teams", () => {
    const source = structuredClone(snapshots[0]);
    const target = structuredClone(roster[0]);
    target.sourceTeam = snapshots[1].contracts[0].teamAbbreviation;
    expect(reconcileContractPlayerIdentities([source], [target]).unresolved[0]?.reason).toBe(
      "no-exact-provider-record"
    );
  });

  it("retains explicit corroboration for curated exceptions", () => {
    const source = structuredClone(snapshots[0]);
    const target = structuredClone(roster[0]);
    source.contracts[0].fullName = "Different Provider Name";
    const result = reconcileContractPlayerIdentities(
      [source],
      [target],
      [
        {
          sourcePlayerId: source.contracts[0].playerSlug,
          targetProviderId: target.providerId,
          evidence: "Stable provider profile URLs agree on team and birth date",
        },
      ]
    );
    expect(result.validated[0]?.evidence.corroboration).toBe(
      "Stable provider profile URLs agree on team and birth date"
    );
  });
});
