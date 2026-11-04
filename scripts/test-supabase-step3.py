"""Synthetic SQL integration on the loopback-only baseline; all changes roll back."""

import json
import os
import runpy
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ["DOCKER_HOST"] = "unix:///var/run/docker.sock"
os.environ.pop("DOCKER_CONTEXT", None)
container = "supabase_db_courtside-baseline-step2"
inspection = json.loads(subprocess.check_output(
    ["docker", "inspect", container], text=True))[0]
assert inspection["State"]["Running"]
assert inspection["NetworkSettings"]["Ports"]["5432/tcp"] == [
    {"HostIp": "127.0.0.1", "HostPort": "55322"}]
assert inspection["Config"]["Labels"]["com.supabase.cli.project"] == "courtside-baseline-step2"

# Reuse the established catalog/data hash, exact proposal loader and NULL probes.
probe = runpy.run_path(str(ROOT / "scripts/test-supabase-baseline-proposals.py"))
ok, body, digest = (probe[name] for name in ("ok", "body", "digest"))
before = digest()
corrections = body("057_restrict_legacy_reads.sql") + body("058_contract_game_required.sql")
access = (ROOT / "tests/infrastructure/supabase/step3-access.sql").read_text()
fixture = probe["fixtures"]

# The same assertion must expose the known baseline leak before corrections.
red = probe["run"]("BEGIN;" + fixture + access + "ROLLBACK;")
assert red.returncode == 3 and "anonymous contracts leaked" in red.stderr, red.stderr
assert digest() == before
print("RED: unchanged baseline leaks anonymous contracts (expected).")
ok("BEGIN;" + fixture + corrections + access + "ROLLBACK;")
assert digest() == before
print("PASS: anonymous reads, both owners, cross-user update/delete/helpers and service role.")
print("UNAVAILABLE: denied anon EXECUTE runtime probe crashed PostgreSQL; ACL checks passed, no retry.")

# Independent verifier regressions: check the actual trigger/constraint errors,
# not an assumed RLS error, and prove rejected statements preserve fixture data.
for correction in ("", corrections):
    for role, statement, state, message in (
        ("authenticated", "INSERT INTO contracts(player_id,team_id,game_id,start_year,end_year) VALUES "
         "('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-000000000001',"
         "'b7300000-0000-4000-8000-000000000002',2026,2027)",
         "P0001", "Legacy contract identity and salary are authoritative"),
        ("authenticated", "UPDATE contracts SET game_id='b7300000-0000-4000-8000-000000000002' "
         "WHERE id='b7400000-0000-4000-8000-000000000001'",
         "P0001", "Legacy contract identity and salary are authoritative"),
        ("service_role", "UPDATE contracts SET game_id=NULL WHERE id='b7400000-0000-4000-8000-000000000001'",
         "23502", 'null value in column "game_id" of relation "contracts" violates not-null constraint'),
    ):
        if role == "service_role" and not correction:
            continue
        query = probe["data_sql"].removeprefix("SELECT ").removesuffix(";")
        ok("BEGIN;" + fixture + correction + "CREATE TEMP TABLE prior AS SELECT " + query + " AS value;"
           "SET LOCAL request.jwt.claim.sub='b7000000-0000-4000-8000-000000000001';"
           f"SET LOCAL ROLE {role}; DO $$ BEGIN BEGIN {statement};"
           " RAISE EXCEPTION 'write unexpectedly accepted';"
           f" EXCEPTION WHEN SQLSTATE '{state}' THEN ASSERT SQLERRM='{message}', SQLERRM; END; END $$;"
           "RESET ROLE; DO $$ BEGIN ASSERT (" + query + ") IS NOT DISTINCT FROM (SELECT value FROM prior),"
           " 'rejected write changed data'; END $$; ROLLBACK;")
        assert digest() == before
print("PASS: cross-owner insert/reassignment and corrected NULL update reject without data changes.")

# Existing transactional trade fixture, against the reconstructed final schema,
# not just its original migration-boundary bootstrap.
ownership = (ROOT / "tests/infrastructure/supabase/freeAgencyContractOwnership.postgres.sql").read_text()
setup = ownership.split("\nDO $$", 1)[0]
trade = (ROOT / "tests/infrastructure/supabase/freeAgencyTradeSerialization.postgres.sql").read_text()
for name, correction in (("baseline", ""), ("corrected", corrections)):
    output = ok("BEGIN;" + correction + setup + trade + "ROLLBACK;")
    assert "GREEN:" in output
    assert digest() == before
    print(f"PASS: {name} final-schema legacy/modern/runtime trade invariants.")

workflow = (ROOT / "tests/infrastructure/supabase/step3-workflows.sql").read_text()
outputs = []
for name, correction in (("baseline", ""), ("corrected", corrections)):
    outputs.append(ok("BEGIN;" + correction + workflow + "ROLLBACK;"))
    assert digest() == before
    print(f"PASS: {name} final-schema creation, roster promotion, seed, schedule, materialization.")
assert outputs[0] == outputs[1], "Unrequested workflow output changed"
print("PASS: baseline/corrected workflow stdout identical; full public data/catalog hashes preserved.")

offseason = (ROOT / "tests/infrastructure/supabase/offseasonEntry.postgres.sql").read_text().split("-- AFTER_MIGRATION_053")[0]
offseason += """
INSERT INTO postseason_results SELECT game_id,season_year,id,home_team_id,away_team_id,DATE '2027-06-10' FROM postseason_series;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM enter_offseason('c3000000-0000-4000-8000-000000000001',2026);
 PERFORM prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026);
 ASSERT (SELECT count(*) FROM game_offseasons)=1, 'offseason entry';
 PERFORM get_free_agency_market('c3000000-0000-4000-8000-000000000001');
 PERFORM advance_simulation_day('c3000000-0000-4000-8000-000000000001','2027-06-10');
 ASSERT (SELECT simulation_date FROM games)='2027-06-10', 'terminal simulation must not advance';
END $$;
RESET ROLE;
"""
for name, correction in (("baseline", ""), ("corrected", corrections)):
    ok("BEGIN;" + correction + offseason + "ROLLBACK;")
    assert digest() == before
    print(f"PASS: {name} final-schema offseason preparation, market and terminal simulation.")
