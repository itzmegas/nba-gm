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
        # Canonical SQL already lacks these observed permissive baseline policies.
        for table in ("teams", "players", "contracts"):
            sql(f'CREATE POLICY "Allow public read access to {table}" ON {table} FOR SELECT USING (true);')
        if not args.baseline:
            for proposal in ("057_restrict_legacy_reads.sql", "058_contract_game_required.sql"):
                sql((ROOT / "supabase/proposals" / proposal).read_text())
            for call in ("initialize_game_schedule(NULL::uuid)", "seed_game_data(NULL::uuid,NULL::uuid)",
                         "seed_game_pick_inventory(NULL::uuid)"):
                result = sql("\\set VERBOSITY verbose\nSET ROLE anon; SELECT public." + call + ";", False)
                assert result.returncode == 3 and "42501" in result.stderr, result.stderr
            print("PASS: actual revoked helper calls return 42501 (vanilla PostgreSQL only)")
        fixture = (ROOT / "tests/infrastructure/supabase/step31-gameplay.sql").read_text()
        print(sql(f"\\set corrected {'false' if args.baseline else 'true'}\n" + fixture).stdout)
    finally:
        docker("rm", "-f", container)


if __name__ == "__main__":
    main()
