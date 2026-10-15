import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../scripts/migrations/025_free_agency_offer_resolution_state.sql",
    import.meta.url
  ),
  "utf8"
);

describe("free-agency signing-context migration", () => {
  it("mirrors migration 025 independently of the future signing migration", () => {
    const marker = "-- Canonical schema mirror for migration 025. Keep byte-identical below.\n";
    const endMarker = "-- End canonical schema mirror for migration 025.\n";
    const start = schema.indexOf(marker);
    expect(schema.indexOf(marker, start + marker.length)).toBe(-1);
    const end = schema.indexOf(endMarker, start + marker.length);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(schema.indexOf(endMarker, end + endMarker.length)).toBe(-1);
    expect(`${schema.slice(start + marker.length, end).trimEnd()}\n`).toBe(migration);
    expect(migration).not.toContain("resolve_free_agency_offer(");
  });

  it("persists terminal offer state and ties runtime agreements to their source offer", () => {
    expect(migration).toContain("'pending', 'accepted', 'rejected'");
    expect(migration).toContain("resolved_contract_id");
    expect(migration).toContain("source_offer_id");
    expect(migration).toContain("FOREIGN KEY (source_offer_id, game_id, player_id)");
    expect(migration).toContain("Offer request has already been resolved");
    expect(migration).toContain("Idempotency key reused with changed offer payload");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION resolve_free_agency_offer");
  });

  it("shares fail-closed authoritative finances and keeps the helper private", () => {
    expect(migration).toContain("get_free_agency_financial_context");
    expect(migration).toContain("Canonical current-season standard salary context is incomplete");
    expect(migration).toContain("Legacy current-season salary context is incomplete");
    expect(migration).toContain("game_runtime_contracts");
    expect(migration).toContain("cap_treatment = 'standard-cap-and-matching'");
    expect(migration).toContain("FROM public.contracts c");
    expect(migration).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.get_free_agency_financial_context(UUID, UUID)"
    );
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
  });
});
