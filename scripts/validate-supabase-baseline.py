"""Disposable local replay only. Never reads project credentials or links remotely."""

import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTAINER = "supabase_db_courtside-baseline-step2"
NETWORK = "courtside-baseline-step2-loopback"
CLI = ["bunx", "--no-install", "supabase", "--network-id", NETWORK]


def run(args, sql=None):
    return subprocess.run(args, cwd=ROOT, input=sql, text=True, check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180).stdout


def psql(sql):
    return run(["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
                "-X", "-At", "-v", "ON_ERROR_STOP=1"], sql)


def require_loopback():
    ports = json.loads(run(["docker", "inspect", CONTAINER, "--format", "{{json .NetworkSettings.Ports}}"] ))
    bindings = ports.get("5432/tcp")
    assert bindings and all(p == {"HostIp": "127.0.0.1", "HostPort": "55322"} for p in bindings), ports


if __name__ == "__main__":
    labels = json.loads(run(["docker", "inspect", CONTAINER, "--format", "{{json .Config.Labels}}"] ))
    assert labels["com.supabase.cli.project"] == "courtside-baseline-step2"
    assert 'project_id = "courtside-baseline-step2"' in (ROOT / "supabase/config.toml").read_text()
    network = json.loads(run(["docker", "network", "inspect", NETWORK]))[0]
    assert network["Options"]["com.docker.network.bridge.host_binding_ipv4"] == "127.0.0.1"
    require_loopback()
    run(CLI + ["db", "reset", "--local", "--no-seed", "--version", "20260206190014"])
    require_loopback()
    psql((ROOT / "supabase/baseline/upgrade-before.sql").read_text())
    rows = "SELECT jsonb_build_object(" + ",".join(
        f"'{t}',(SELECT jsonb_agg(to_jsonb(r)) FROM public.{t} r)" for t in ["teams", "players", "contracts"]) + ");"
    before = json.loads(psql(rows))
    run(CLI + ["migration", "up", "--local"])
    after = json.loads(psql(rows))
    for table, records in before.items():
        assert len(records) == len(after[table])
        for a, b in zip(records, after[table]):
            assert a == {k: b[k] for k in a}, table
    psql((ROOT / "supabase/baseline/upgrade-after.sql").read_text())
    unchanged = psql(rows)
    run(CLI + ["migration", "up", "--local"])
    assert psql(rows) == unchanged, "No-pending replay must not change rows"
    print("Populated upgrade preserves every original value; no-pending replay is unchanged.")
    run(CLI + ["db", "reset", "--local", "--no-seed"])
    require_loopback()
    query = (ROOT / "supabase/baseline/catalog.sql").read_text()
    with tempfile.TemporaryDirectory(prefix="courtside-baseline-") as scratch:
        snapshot = Path(scratch) / "local.json"
        snapshot.write_text(psql(query))
        print(run(["python3", "scripts/check-supabase-baseline.py",
                   "supabase/baseline/remote-catalog.json", str(snapshot)]))
    print(run(CLI + ["test", "db"]))
    require_loopback()
    print("Fresh replay, populated upgrade, no-pending replay and pgTAP passed.")
