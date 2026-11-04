"""Independent canonical-source comparison in a synthetic disposable local DB."""

import json
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REMOTE = json.loads((ROOT / "supabase/baseline/remote-catalog.json").read_text())
DATABASE = "baseline_canonical_" + uuid.uuid4().hex


def sql(text, database=DATABASE):
    result = subprocess.run(["docker", "exec", "-i", "supabase_db_courtside-baseline-step2",
                             "psql", "-U", "postgres", "-d", database, "-X", "-qAt",
                             "-v", "ON_ERROR_STOP=1"], input=text, text=True,
                            capture_output=True, timeout=120)
    assert result.returncode == 0, result.stderr
    return result.stdout


def normalize(value):
    if isinstance(value, dict):
        return {k: normalize(v) for k, v in value.items()}
    if isinstance(value, list):
        return sorted((normalize(v) for v in value), key=lambda v: json.dumps(v, sort_keys=True))
    return value


sql(f"CREATE DATABASE {DATABASE} TEMPLATE template0;", "postgres")
try:
    setup = """
    ALTER SCHEMA public OWNER TO postgres;
    CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE SCHEMA supabase_migrations;
    CREATE TABLE supabase_migrations.schema_migrations(version text,name text,statements text[]);
    SET search_path=public,pg_catalog,extensions;
    """
    for d in REMOTE["defaults"]:
        if d["owner"] == "postgres":
            role = "PUBLIC" if d["grantee"] == "PUBLIC" else '"' + d["grantee"] + '"'
            target = {"r": "TABLES", "f": "FUNCTIONS", "S": "SEQUENCES"}[d["type"]]
            setup += f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT {d["privilege"]} ON {target} TO {role};\n'
    sql(setup + (ROOT / "scripts/schema.sql").read_text())
    local = json.loads(sql((ROOT / "supabase/baseline/catalog.sql").read_text()))
    for section in ["functions", "triggers", "enums", "sequences"]:
        assert normalize(REMOTE[section]) == normalize(local[section]), section
    live_constraints = {(c["table"], c["name"]): c for c in REMOTE["constraints"]}
    canonical_constraints = {(c["table"], c["name"]): c for c in local["constraints"]}
    for key in live_constraints.keys() & canonical_constraints.keys():
        assert live_constraints[key] == canonical_constraints[key], key
    assert live_constraints.keys() - canonical_constraints.keys() == {("scheduled_games", "scheduled_games_unique_matchup")}
    assert canonical_constraints.keys() - live_constraints.keys() == {("scheduled_games", "scheduled_games_game_id_game_date_home_team_id_away_team_id_key")}
    assert len(REMOTE["policies"]) - len(local["policies"]) == 3
    print("Canonical full function/ACL, trigger, enum, sequence and constraint comparisons passed.")
finally:
    sql(f"DROP DATABASE {DATABASE};", "postgres")
