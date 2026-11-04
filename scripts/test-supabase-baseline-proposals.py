"""Transactional synthetic proposal probes; never deploys a proposal."""

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTAINER = "supabase_db_courtside-baseline-step2"
CMD = ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
       "-X", "-qAt", "-v", "ON_ERROR_STOP=1"]


def run(sql):
    return subprocess.run(CMD, input=sql, text=True, capture_output=True, timeout=60)


def ok(sql):
    result = run(sql)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def body(name):
    text = (ROOT / "supabase/proposals" / name).read_text()
    assert text.count("BEGIN;") == 1 and text.count("COMMIT;") == 1
    return text.replace("BEGIN;", "", 1).replace("COMMIT;", "", 1)


remote = json.loads((ROOT / "supabase/baseline/remote-catalog.json").read_text())
tables = [r["name"] for r in remote["relations"] if r["kind"] == "r"]
data_sql = "SELECT jsonb_build_object(" + ",".join(
    "'%s',(SELECT jsonb_agg(x ORDER BY x::text) FROM (SELECT to_jsonb(t) x FROM public.\"%s\" t) s)" % (t, t)
    for t in tables) + ");"


def digest():
    data = ok(data_sql)
    schema = ok((ROOT / "supabase/baseline/catalog.sql").read_text())
    return hashlib.sha256((data + schema).encode()).hexdigest()


before = digest()
fixtures = """
INSERT INTO auth.users(id) VALUES ('b7000000-0000-4000-8000-000000000001'),('b7000000-0000-4000-8000-000000000002');
INSERT INTO teams(id,nba_id,name,city,abbreviation) VALUES ('b7100000-0000-4000-8000-000000000001',-999701,'Probe','Probe','PRB');
INSERT INTO players(id,nba_id,first_name,last_name,full_name) VALUES ('b7200000-0000-4000-8000-000000000001',-999701,'Probe','Player','Probe Player');
INSERT INTO games(id,user_id,name,selected_team_id,season_year,simulation_date) VALUES
('b7300000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000001','Probe one','b7100000-0000-4000-8000-000000000001',2026,'2026-10-01'),
('b7300000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000002','Probe two','b7100000-0000-4000-8000-000000000001',2026,'2026-10-01');
INSERT INTO contracts(id,player_id,team_id,game_id,start_year,end_year,salary_y1) VALUES
('b7400000-0000-4000-8000-000000000001','b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-000000000001','b7300000-0000-4000-8000-000000000001',2026,2027,0),
('b7400000-0000-4000-8000-000000000002','b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-000000000001','b7300000-0000-4000-8000-000000000002',2026,2027,1000000);
"""
helper = "SELECT string_agg(has_function_privilege('anon',oid,'EXECUTE')::text,',' ORDER BY proname) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('initialize_game_schedule','seed_game_data','seed_game_pick_inventory');"
security = """
SET LOCAL ROLE anon;
SELECT 'before-anon='||count(*) FROM contracts;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='b7000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT 'before-owner='||count(*) FROM contracts;
RESET ROLE;
"""
reads = """
SET LOCAL request.jwt.claim.sub='';
SET LOCAL ROLE anon;
SELECT 'after-anon='||count(*) FROM contracts;
SELECT 'anon-teams='||count(*) FROM teams;
SELECT 'anon-players='||count(*) FROM players;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='b7000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT 'after-owner='||count(*) FROM contracts;
SET LOCAL request.jwt.claim.sub='b7000000-0000-4000-8000-000000000002';
SELECT 'after-other-owner='||count(*) FROM contracts;
RESET ROLE;
"""
result = ok("BEGIN;" + fixtures + security + helper + body("057_restrict_legacy_reads.sql") + reads + helper + "ROLLBACK;")
assert result.splitlines() == ["before-anon=2", "before-owner=2", "true,true,true", "after-anon=0", "anon-teams=0", "anon-players=0", "after-owner=1", "after-other-owner=1", "false,false,false"], result
assert digest() == before

required = body("058_contract_game_required.sql")
assert ok("BEGIN;" + required + "SELECT attnotnull FROM pg_attribute WHERE attrelid='contracts'::regclass AND attname='game_id';ROLLBACK;") == "t"
assert digest() == before
reject_null = """
DO $$ DECLARE old_rows jsonb; BEGIN
 SELECT jsonb_agg(to_jsonb(c) ORDER BY id) INTO old_rows FROM contracts c;
 BEGIN
  INSERT INTO contracts(player_id,team_id,start_year,end_year) VALUES ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-000000000001',2026,2027);
  RAISE EXCEPTION 'NULL insert unexpectedly succeeded';
 EXCEPTION WHEN not_null_violation THEN
  IF SQLSTATE <> '23502' OR SQLERRM <> 'null value in column "game_id" of relation "contracts" violates not-null constraint' THEN RAISE; END IF;
 END;
 IF old_rows IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contracts c) THEN RAISE EXCEPTION 'Rejected insert changed data'; END IF;
END $$;
"""
assert ok("BEGIN;" + fixtures + required + reject_null + "ROLLBACK;") == ""
assert digest() == before
null_row = "UPDATE contracts SET game_id=NULL WHERE id='b7400000-0000-4000-8000-000000000001';"
failed = run("BEGIN;" + fixtures + null_row + required + "ROLLBACK;")
assert failed.returncode == 3, (failed.returncode, failed.stderr)
assert failed.stderr == "ERROR:  Contracts with NULL game_id require an explicitly approved disposition\nCONTEXT:  PL/pgSQL function inline_code_block line 3 at RAISE\n", failed.stderr
assert digest() == before
print("Proposal access, ownership, NULL refusal, exact errors and full rollback hashes passed.")
