"""Disposable, synthetic SQL validation; never consumes application connection settings."""

import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = {**os.environ, "DOCKER_HOST": "unix:///var/run/docker.sock"}
ENV.pop("DOCKER_CONTEXT", None)


def docker(*args, input=None, check=True):
    return subprocess.run(["docker", *args], input=input, text=True, capture_output=True,
                          env=ENV, check=check, timeout=180)


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", action="store_true", help="Run gameplay without either proposal for comparison")
    parser.add_argument("--modern-contract-trade-compatibility", action="store_true",
                        help="Apply only the modern contract trade compatibility migration")
    args = parser.parse_args()
    # shortcut: Supabase-image denied-RPC crash probes are prohibited; crash evidence lives in
    # /tmp/opencode/nba-gm-step31-cq2eHp and Engram observation 3022. Vanilla-only from here.
    container = docker("run", "--pull=never", "--network", "none", "--tmpfs",
                       "/var/lib/postgresql/data:rw,noexec,nosuid,size=512m",
                       "-e", "POSTGRES_PASSWORD=step31-synthetic-only", "-d", "postgres:17-alpine").stdout.strip()
    try:
        for _ in range(100):
            if docker("exec", container, "sh", "-c",
                      "grep -qx postgres /proc/1/comm && pg_isready -U postgres", check=False).returncode == 0:
                break
            time.sleep(.1)
        else:
            logs = docker("logs", "--tail", "30", container)
            raise RuntimeError("Disposable PostgreSQL did not become ready\n" + logs.stdout + logs.stderr)

        def sql(text, check=True):
            result = docker("exec", "-i", container, "psql", "-X", "-q", "-A", "-t",
                            "-v", "ON_ERROR_STOP=1", "-U", "postgres", input=text, check=False)
            if check and result.returncode:
                print(result.stdout)
                raise RuntimeError(result.stderr)
            return result

        print(sql("SELECT version(); SHOW shared_preload_libraries;").stdout)
        sql((ROOT / "tests/infrastructure/supabase/freeAgencyWriteIntegrityPostgresBootstrap.sql").read_text())
        sql("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;")
        sql((ROOT / "scripts/schema.sql").read_text())
        if args.modern_contract_trade_compatibility or not args.baseline:
            sql((ROOT / "supabase/migrations/20261104190000_modern_contract_trade_compatibility.sql").read_text())
        # Canonical SQL already lacks these observed permissive baseline policies.
        for table in ("teams", "players", "contracts"):
            sql(f'CREATE POLICY "Allow public read access to {table}" ON {table} FOR SELECT USING (true);')
        if not args.baseline and not args.modern_contract_trade_compatibility:
            for proposal in ("057_restrict_legacy_reads.sql", "058_contract_game_required.sql"):
                sql((ROOT / "supabase/proposals" / proposal).read_text())
            for call in ("initialize_game_schedule(NULL::uuid)", "seed_game_data(NULL::uuid,NULL::uuid)",
                         "seed_game_pick_inventory(NULL::uuid)"):
                result = sql("\\set VERBOSITY verbose\nSET ROLE anon; SELECT public." + call + ";", False)
                assert result.returncode == 3 and "42501" in result.stderr, result.stderr
            print("PASS: actual revoked helper calls return 42501 (vanilla PostgreSQL only)")
        fixture = (ROOT / "tests/infrastructure/supabase/step31-gameplay.sql").read_text()
        corrected = not args.baseline and not args.modern_contract_trade_compatibility
        print(sql(f"\\set corrected {'true' if corrected else 'false'}\n" + fixture).stdout)

        if args.modern_contract_trade_compatibility or not args.baseline:
            regression = (ROOT / "tests/infrastructure/supabase/modernContractTradeCompatibility.postgres.sql").read_text()
            print(sql(regression).stdout)
            run_concurrent_trade_test(container, sql)
    finally:
        docker("rm", "-f", container)


def run_concurrent_trade_test(container, sql):
    """Verify independent concurrent trades succeed and same-asset trades serialize."""
    import concurrent.futures

    auth_env = {
        "PGAPPNAME": "step31-concurrent",
    }

    def psql_input(statement):
        return subprocess.run(
            ["docker", "exec", "-i", container, "psql", "-X", "-q", "-A", "-t",
             "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
            input=statement, text=True, capture_output=True, env={**ENV, **auth_env}, timeout=60
        )

    setup = """
    BEGIN;
    INSERT INTO auth.users(id) VALUES ('d0000000-0000-4000-8000-000000000001');
    INSERT INTO teams(id, nba_id, name, city, abbreviation, conference)
    VALUES ('d1000000-0000-4000-8000-000000000001', 3001, 'Concurrent A', 'Test', 'CNA', 'East'),
           ('d1000000-0000-4000-8000-000000000002', 3002, 'Concurrent B', 'Test', 'CNB', 'East');
    INSERT INTO players(id, nba_id, team_id, first_name, last_name, full_name, position, years_of_experience, is_active)
    VALUES ('d2000000-0000-4000-8000-000000000001', 3001, 'd1000000-0000-4000-8000-000000000001', 'C', '1', 'C 1', 'G', 1, true),
           ('d2000000-0000-4000-8000-000000000002', 3002, 'd1000000-0000-4000-8000-000000000002', 'C', '2', 'C 2', 'F', 1, true),
           ('d2000000-0000-4000-8000-000000000003', 3003, 'd1000000-0000-4000-8000-000000000001', 'C', '3', 'C 3', 'C', 1, true),
           ('d2000000-0000-4000-8000-000000000004', 3004, 'd1000000-0000-4000-8000-000000000002', 'C', '4', 'C 4', 'G', 1, true);
    INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
    VALUES ('d3000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Concurrent','d1000000-0000-4000-8000-000000000001',2026,'modern','2026-10-01','initializing');
    INSERT INTO game_player_states(id, game_id, player_id, team_id)
    VALUES ('d3100000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001'),
           ('d3100000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002'),
           ('d3100000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001'),
           ('d3100000-0000-4000-8000-000000000004','d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000002');
    INSERT INTO game_contract_agreements(id, game_id, player_id, team_id, contract_type, provenance_quality, source_method, estimated, cap_treatment)
    VALUES ('d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','standard','observed','test',false,'standard-cap-and-matching'),
           ('d4000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','standard','observed','test',false,'standard-cap-and-matching'),
           ('d4000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','standard','observed','test',false,'standard-cap-and-matching'),
           ('d4000000-0000-4000-8000-000000000004','d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000002','standard','observed','test',false,'standard-cap-and-matching');
    INSERT INTO game_contract_seasons(id, agreement_id, game_id, season_label, start_year, end_year, salary_amount, option_kind, guarantee_kind)
    VALUES ('d4100000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','2026-27',2026,2027,1000000,'none','guaranteed'),
           ('d4100000-0000-4000-8000-000000000002','d4000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','2026-27',2026,2027,1000000,'none','guaranteed'),
           ('d4100000-0000-4000-8000-000000000003','d4000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000001','2026-27',2026,2027,1000000,'none','guaranteed'),
           ('d4100000-0000-4000-8000-000000000004','d4000000-0000-4000-8000-000000000004','d3000000-0000-4000-8000-000000000001','2026-27',2026,2027,1000000,'none','guaranteed');
    UPDATE games SET status='active' WHERE id='d3000000-0000-4000-8000-000000000001';
    COMMIT;
    """
    result = psql_input(setup)
    if result.returncode != 0:
        raise RuntimeError("Concurrent trade setup failed: " + result.stderr)

    trade_a = """
    BEGIN;
    SET LOCAL request.jwt.claim.role='authenticated';
    SET LOCAL request.jwt.claim.sub='d0000000-0000-4000-8000-000000000001';
    SET LOCAL ROLE authenticated;
    SELECT execute_trade_transactional(
      'd3000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000002',
      '[{"asset_type":"player","asset_id":"d2000000-0000-4000-8000-000000000001","from_team_id":"d1000000-0000-4000-8000-000000000001"},{"asset_type":"player","asset_id":"d2000000-0000-4000-8000-000000000002","from_team_id":"d1000000-0000-4000-8000-000000000002"}]'::jsonb
    );
    COMMIT;
    """
    trade_b = """
    BEGIN;
    SET LOCAL request.jwt.claim.role='authenticated';
    SET LOCAL request.jwt.claim.sub='d0000000-0000-4000-8000-000000000001';
    SET LOCAL ROLE authenticated;
    SELECT execute_trade_transactional(
      'd3000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000002',
      '[{"asset_type":"player","asset_id":"d2000000-0000-4000-8000-000000000003","from_team_id":"d1000000-0000-4000-8000-000000000001"},{"asset_type":"player","asset_id":"d2000000-0000-4000-8000-000000000004","from_team_id":"d1000000-0000-4000-8000-000000000002"}]'::jsonb
    );
    COMMIT;
    """

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_a = executor.submit(psql_input, trade_a)
        future_b = executor.submit(psql_input, trade_b)
        results = [future_a.result(), future_b.result()]

    if any(r.returncode != 0 for r in results):
        raise RuntimeError(
            "Concurrent independent trades failed:\n" +
            "\n".join(r.stderr for r in results if r.returncode != 0)
        )

    verify = """
    DO $$ BEGIN
      ASSERT (SELECT count(*) FROM executed_trades WHERE game_id='d3000000-0000-4000-8000-000000000001') = 2, 'two concurrent trades recorded';
      ASSERT (SELECT team_id FROM game_player_states WHERE game_id='d3000000-0000-4000-8000-000000000001' AND player_id='d2000000-0000-4000-8000-000000000001') = 'd1000000-0000-4000-8000-000000000002', 'independent trade A team-A player transferred';
      ASSERT (SELECT team_id FROM game_player_states WHERE game_id='d3000000-0000-4000-8000-000000000001' AND player_id='d2000000-0000-4000-8000-000000000003') = 'd1000000-0000-4000-8000-000000000002', 'independent trade B team-A player transferred';
      ASSERT (SELECT team_id FROM game_player_states WHERE game_id='d3000000-0000-4000-8000-000000000001' AND player_id='d2000000-0000-4000-8000-000000000002') = 'd1000000-0000-4000-8000-000000000001', 'independent trade A team-B player transferred';
      ASSERT (SELECT team_id FROM game_player_states WHERE game_id='d3000000-0000-4000-8000-000000000001' AND player_id='d2000000-0000-4000-8000-000000000004') = 'd1000000-0000-4000-8000-000000000001', 'independent trade B team-B player transferred';
    END $$;
    SELECT 'PASS: concurrent independent trades serialized cleanly' AS result;
    """
    print(psql_input(verify).stdout)


if __name__ == "__main__":
    main()
