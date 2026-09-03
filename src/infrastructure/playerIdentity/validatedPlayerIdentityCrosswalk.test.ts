import { describe, expect, it } from "vitest";
import { PLAYER_IDENTITY_PROVIDER } from "@/domain/playerIdentity/PlayerIdentityCrosswalk";
import {
  createPlayerIdentityCrosswalk,
  unresolvedPlayerIdentities,
  validatedPlayerIdentityCrosswalk,
} from "@/infrastructure/playerIdentity/validatedPlayerIdentityCrosswalk";

const bref = PLAYER_IDENTITY_PROVIDER.BASKETBALL_REFERENCE;
const espn = PLAYER_IDENTITY_PROVIDER.ESPN;

function binding(canonicalName: string, brefSlug: string, espnId: string) {
  return {
    canonicalName,
    identities: [
      { provider: bref, externalId: brefSlug },
      { provider: espn, externalId: espnId },
    ],
  };
}

describe("validatedPlayerIdentityCrosswalk", () => {
  it("validates provider identities and resolves exact bindings", () => {
    const crosswalk = createPlayerIdentityCrosswalk([binding("Player One", "player01", "101")]);
    expect(crosswalk.resolve(bref, "player01", espn)).toEqual(["101"]);
    expect(crosswalk.resolve(bref, "missing01", espn)).toEqual([]);
    expect(() =>
      createPlayerIdentityCrosswalk([{ canonicalName: "Invalid", identities: [] }])
    ).toThrow();
  });

  it("rejects duplicate source identities", () => {
    expect(() =>
      createPlayerIdentityCrosswalk([
        binding("Player One", "player01", "101"),
        binding("Player Two", "player01", "102"),
      ])
    ).toThrow(/basketball-reference:player01/);
  });

  it("rejects duplicate target identities", () => {
    expect(() =>
      createPlayerIdentityCrosswalk([
        binding("Player One", "player01", "101"),
        binding("Player Two", "player02", "101"),
      ])
    ).toThrow(/espn:101/);
  });

  it("rejects duplicate providers within one binding", () => {
    expect(() =>
      createPlayerIdentityCrosswalk([
        {
          canonicalName: "Player One",
          identities: [
            { provider: bref, externalId: "player01" },
            { provider: bref, externalId: "player02" },
          ],
        },
      ])
    ).toThrow(/Duplicate provider basketball-reference/);
  });

  it("contains manually approved Lakers identities including accent-sensitive records", () => {
    expect(validatedPlayerIdentityCrosswalk.resolve(bref, "doncilu01", espn)).toEqual(["3945274"]);
    expect(validatedPlayerIdentityCrosswalk.resolve(bref, "manonch01", espn)).toEqual(["4702972"]);
    expect(validatedPlayerIdentityCrosswalk.resolve(bref, "reaveau01", espn)).toEqual(["4066457"]);
  });

  it("contains the manually verified suffix-sensitive Nick Smith Jr. identity", () => {
    expect(validatedPlayerIdentityCrosswalk.resolve(bref, "smithni01", espn)).toEqual(["4683686"]);
  });

  it("documents Arthur Kaluma as unresolved without guessing an ESPN ID", () => {
    expect(validatedPlayerIdentityCrosswalk.resolve(bref, "kalumar01", espn)).toEqual([]);
    expect(unresolvedPlayerIdentities).toContainEqual(
      expect.objectContaining({
        canonicalName: "Arthur Kaluma",
        sourceExternalId: "kalumar01",
        targetProvider: espn,
        observedOn: "2026-08-24",
      })
    );
    expect(unresolvedPlayerIdentities[0].reason).toMatch(/no ESPN ID is proven/);
  });
});
