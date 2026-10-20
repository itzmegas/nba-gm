import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const contextMigration = readFileSync(
  new URL(
    "../../../scripts/migrations/025_free_agency_offer_resolution_state.sql",
    import.meta.url
  ),
  "utf8"
);
const signingMigration = readFileSync(
  new URL("../../../scripts/migrations/026_resolve_free_agency_offer.sql", import.meta.url),
  "utf8"
);
const tradeMigration = readFileSync(
  new URL("../../../scripts/migrations/024_free_agency_trade_serialization.sql", import.meta.url),
  "utf8"
);

function mirroredMigration(marker: string, endMarker: string): string {
  const start = schema.indexOf(marker);
  expect(schema.indexOf(marker, start + marker.length)).toBe(-1);
  const end = schema.indexOf(endMarker, start + marker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return `${schema.slice(start + marker.length, end).trimEnd()}\n`;
}

describe("free agency atomic signing migration", () => {
  it("mirrors migration 026 and accepts only game and offer identifiers", () => {
    expect(
      mirroredMigration(
        "-- Canonical schema mirror for migration 026. Keep byte-identical below.\n",
        "-- End canonical schema mirror for migration 026.\n"
      )
    ).toBe(signingMigration);
    expect(signingMigration).toMatch(
      /FUNCTION public\.resolve_free_agency_offer\(\s*p_game_id UUID,\s*p_offer_id UUID\s*\)/u
    );
    expect(signingMigration).not.toContain("p_team_id");
    expect(signingMigration).not.toContain("p_payroll");
    expect(signingMigration).not.toContain("p_expected_date");
  });

  it("is private, hardened, game-first, due-gated and atomically terminalizes competitors", () => {
    expect(signingMigration).toContain("SECURITY DEFINER");
    expect(signingMigration).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(signingMigration).toMatch(
      /REVOKE ALL ON FUNCTION public\.resolve_free_agency_offer\(UUID, UUID\)\s+FROM PUBLIC, anon, authenticated, service_role/u
    );
    const gameLock = signingMigration.indexOf("FROM public.games g");
    const gameForUpdate = signingMigration.indexOf("FOR UPDATE", gameLock);
    const offerLock = signingMigration.indexOf("FROM public.free_agency_pending_offers o");
    const playerLock = signingMigration.indexOf("FROM public.game_player_states s");
    expect(gameForUpdate).toBeGreaterThan(gameLock);
    expect(offerLock).toBeGreaterThan(gameForUpdate);
    expect(playerLock).toBeGreaterThan(offerLock);
    expect(signingMigration).toContain("v_game.simulation_date < v_offer.due_date");
    expect(signingMigration).toContain("source_offer_id");
    expect(signingMigration).toContain("another_offer_accepted");
    expect(signingMigration).toContain("selected_offer_accepted");
    expect(signingMigration).toContain("get_free_agency_financial_context");
  });

  it("keeps runtime-only trades supported without rewriting runtime agreement terms", () => {
    expect(tradeMigration).toContain(
      "game_runtime_contracts r WHERE r.game_id = p_game_id AND r.player_id = v_id"
    );
    expect(tradeMigration).not.toContain("UPDATE game_runtime_contracts");
    expect(tradeMigration).toContain(
      "FROM games WHERE id = p_game_id AND user_id = auth.uid() FOR UPDATE"
    );
    expect(contextMigration).toContain("source_offer_id");
  });
});
