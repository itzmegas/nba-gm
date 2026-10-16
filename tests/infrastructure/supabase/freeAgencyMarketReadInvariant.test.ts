import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../scripts/migrations/031_free_agency_market_read.sql", import.meta.url),
  "utf8"
);

describe("free-agency market read boundary", () => {
  it("mirrors migration 031 exactly once", () => {
    const marker = "-- Canonical schema mirror for migration 031. Keep byte-identical below.\n";
    const endMarker = "-- End canonical schema mirror for migration 031.\n";
    const start = schema.indexOf(marker);
    const end = schema.indexOf(endMarker, start + marker.length);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(schema.indexOf(marker, start + marker.length)).toBe(-1);
    expect(end).toBeGreaterThan(start);
    expect(schema.indexOf(endMarker, end + endMarker.length)).toBe(-1);
    expect(`${schema.slice(start + marker.length, end).trimEnd()}\n`).toBe(migration);
  });

  it("exposes only the authenticated read RPC and retains private finance helpers", () => {
    expect(migration).toContain("CREATE FUNCTION public.get_free_agency_market(p_game_id UUID)");
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'authenticated'");
    expect(migration).toContain("user_id = auth.uid() AND deleted_at IS NULL");
    expect(migration).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(migration).toContain(
      "public.get_free_agency_financial_context(p_game_id, p.id, g.selected_team_id)"
    );
    expect(migration).toContain("FROM PUBLIC, anon, service_role");
    expect(migration).toContain("TO authenticated");
    expect(migration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.get_free_agency_financial_context"
    );
    expect(migration).not.toMatch(/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM/iu);
  });

  it("keeps enrollment, activity, teamlessness, contract absence, and stable ordering explicit", () => {
    expect(migration).toContain("e.evidence_kind = 'simulation-bootstrap-enrollment'");
    expect(migration).toContain("s.is_active AND s.team_id IS NULL");
    expect(migration).toContain("p.years_of_experience BETWEEN 0 AND 99");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM public.contracts");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM public.game_contract_agreements");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts");
    expect(migration).toContain("ORDER BY p.id");
    expect(migration).toContain("ORDER BY o.created_at DESC, o.id DESC");
    expect(migration).toContain("'player_name'");
    expect(migration).toContain("'team_name'");
  });
});
