import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { estimatePlayerAttributes } from "@/domain/ratings/estimatePlayerAttributes";
import type {
  PlayerRatingSourceSnapshot,
  SourcePlayerRating,
} from "@/domain/ratings/PlayerRatingSourceCache";
import { reconcilePlayerAttributes } from "@/infrastructure/ratings/reconcilePlayerAttributes";
import { reviewedNba2kRatingAliases } from "@/infrastructure/ratings/reviewedNba2kRatingAliases";

const player = {
  playerId: "00000000-0000-4000-8000-000000000001",
  fullName: "Test Player",
  espnId: 123,
  teamAbbreviation: "BOS",
  height: "6' 4\"",
  position: "G",
};
const secondId = "00000000-0000-4000-8000-000000000002";
const source: SourcePlayerRating = {
  slug: "test-player",
  name: player.fullName,
  team: "Boston Celtics",
  teamType: "curr",
  gameVersion: "2K27",
  lastUpdated: "2026-10-23T00:00:00Z",
  overall: 81,
  attributes: estimatePlayerAttributes("synthetic-source", "PG"),
  height: "6'4\"",
};

function snapshot(
  players: readonly SourcePlayerRating[] = [source],
  excludedPlayers: PlayerRatingSourceSnapshot["excludedPlayers"] = []
): PlayerRatingSourceSnapshot {
  return {
    source: "nba2kapi",
    sourceUrl: "https://api.nba2kapi.com/api/players/bulk?teamType=curr",
    gameVersion: "2K27",
    observedAt: "2026-10-23T00:00:00Z",
    requestCount: 1,
    contentHash: createHash("sha256")
      .update(JSON.stringify({ players, excludedPlayers }))
      .digest("hex"),
    players,
    excludedPlayers,
  };
}

describe("reconcilePlayerAttributes", () => {
  it("imports a unique name corroborated by team without sharing mutable attributes", () => {
    const [result] = reconcilePlayerAttributes(snapshot(), [player]);
    expect(result).toMatchObject({
      origin: "nba2kapi",
      matchMethod: "name-and-team",
      sourceSlug: source.slug,
      sourceOverall: 81,
      generatorVersion: null,
      attributes: source.attributes,
    });
    expect(result.evidence).toMatchObject({
      espnId: 123,
      rosterTeam: "BOS",
      sourceTeam: source.team,
    });
    result.attributes.ballHandle = 0;
    expect(source.attributes.ballHandle).not.toBe(0);
  });

  it.each(
    reviewedNba2kRatingAliases
  )("uses reviewed stable identity $espnId, not a generic nickname rule", (alias) => {
    const [result] = reconcilePlayerAttributes(
      snapshot([{ ...source, slug: alias.sourceSlug, name: alias.sourceName }]),
      [
        {
          ...player,
          fullName: alias.canonicalName,
          espnId: alias.espnId,
          teamAbbreviation: null,
          height: null,
        },
      ]
    );
    expect(result).toMatchObject({
      origin: "nba2kapi",
      matchMethod: "reviewed-espn-alias",
      sourceSlug: alias.sourceSlug,
    });
    expect(result.evidence.aliasReviewDate).toBe("2026-10-23");
  });

  it("does not apply an alias to the wrong ESPN ID or an unexpected source name", () => {
    const alias = reviewedNba2kRatingAliases[0];
    const correctSource = snapshot([{ ...source, slug: alias.sourceSlug, name: alias.sourceName }]);
    const [wrongId] = reconcilePlayerAttributes(correctSource, [
      { ...player, fullName: alias.canonicalName },
    ]);
    expect(wrongId.origin).toBe("estimated");
    const [wrongSource] = reconcilePlayerAttributes(
      snapshot([{ ...source, slug: alias.sourceSlug, name: "Unrelated Player" }]),
      [{ ...player, fullName: alias.canonicalName, espnId: alias.espnId }]
    );
    expect(wrongSource).toMatchObject({
      origin: "estimated",
      matchMethod: "uncorroborated-identity",
    });
  });

  it("does not import on a name alone when corroboration is absent", () => {
    const [result] = reconcilePlayerAttributes(snapshot(), [
      { ...player, teamAbbreviation: "MIA", height: null },
    ]);
    expect(result).toMatchObject({ origin: "estimated", matchMethod: "uncorroborated-identity" });
  });

  it("corroborates free agents by unique name and a valid matching height", () => {
    const [result] = reconcilePlayerAttributes(snapshot(), [{ ...player, teamAbbreviation: null }]);
    expect(result).toMatchObject({ origin: "nba2kapi", matchMethod: "name-and-height" });
    const [invalidHeight] = reconcilePlayerAttributes(snapshot([{ ...source, height: "0" }]), [
      { ...player, height: "0", teamAbbreviation: null },
    ]);
    expect(invalidHeight.origin).toBe("estimated");
  });

  it("accepts the existing NBA seed feet-inches format without accepting invalid inches", () => {
    const [legacy] = reconcilePlayerAttributes(snapshot(), [
      { ...player, height: "6-4", teamAbbreviation: null },
    ]);
    expect(legacy.matchMethod).toBe("name-and-height");
    const [invalid] = reconcilePlayerAttributes(snapshot([{ ...source, height: "6-12" }]), [
      { ...player, height: "6-12", teamAbbreviation: null },
    ]);
    expect(invalid.origin).toBe("estimated");
  });

  it("normalizes the LA Clippers team label without loosening player identity", () => {
    const [result] = reconcilePlayerAttributes(
      snapshot([{ ...source, team: "Los Angeles Clippers" }]),
      [{ ...player, teamAbbreviation: "LAC", height: null }]
    );
    expect(result.matchMethod).toBe("name-and-team");
  });

  it("estimates every ambiguous same-name target rather than choosing the first", () => {
    const result = reconcilePlayerAttributes(snapshot(), [
      player,
      { ...player, playerId: secondId, espnId: 456 },
    ]);
    expect(
      result.every((row) => row.origin === "estimated" && row.matchMethod === "ambiguous-identity")
    ).toBe(true);
  });

  it("does not let an alias and a different target both claim the same source", () => {
    const alias = reviewedNba2kRatingAliases[0];
    const result = reconcilePlayerAttributes(
      snapshot([{ ...source, slug: alias.sourceSlug, name: alias.sourceName }]),
      [
        { ...player, fullName: alias.canonicalName, espnId: alias.espnId },
        { ...player, playerId: secondId, fullName: alias.sourceName, espnId: 456 },
      ]
    );
    expect(result.every((row) => row.matchMethod === "ambiguous-identity")).toBe(true);
  });

  it("rejects ambiguous source names and duplicate canonical ESPN identities", () => {
    const duplicateSource = reconcilePlayerAttributes(
      snapshot([source, { ...source, slug: "other-slug" }]),
      [player]
    );
    expect(duplicateSource[0].matchMethod).toBe("ambiguous-identity");
    const duplicateEspn = reconcilePlayerAttributes(snapshot(), [
      player,
      { ...player, playerId: secondId, fullName: "Other Player" },
    ]);
    expect(duplicateEspn.every((row) => row.matchMethod === "ambiguous-identity")).toBe(true);
  });

  it("labels complete deterministic estimates with their actual reason and generator", () => {
    const [result] = reconcilePlayerAttributes(snapshot(), [
      { ...player, fullName: "Missing Player" },
    ]);
    expect(result).toMatchObject({
      origin: "estimated",
      matchMethod: "missing-source",
      sourceSlug: null,
      sourceOverall: null,
      generatorVersion: "replacement-v1",
      attributes: estimatePlayerAttributes(player.playerId, player.position),
    });
    const [incomplete] = reconcilePlayerAttributes(
      snapshot(
        [{ ...source, slug: "other", name: "Other Player" }],
        [{ slug: source.slug, name: player.fullName, invalidAttributes: ["stamina"] }]
      ),
      [player]
    );
    expect(incomplete).toMatchObject({
      origin: "estimated",
      matchMethod: "incomplete-attributes",
      sourceSlug: null,
    });
  });

  it("fails closed for duplicate or invalid canonical player IDs", () => {
    expect(() => reconcilePlayerAttributes(snapshot(), [player, player])).toThrow(
      "Duplicate roster player IDs"
    );
    expect(() => reconcilePlayerAttributes(snapshot(), [{ ...player, playerId: "bad" }])).toThrow();
  });
});
