"""Small structural/regression checks; no remote access or database mutation."""

import hashlib
import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("check", ROOT / "scripts/check-supabase-baseline.py")
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


class BaselineTest(unittest.TestCase):
    def test_exact_payloads(self):
        provenance = json.loads((ROOT / "supabase/baseline/provenance.json").read_text())
        remote_path = ROOT / "supabase/baseline/remote-catalog.json"
        self.assertEqual(hashlib.sha256(remote_path.read_bytes()).hexdigest(), provenance["catalog_sha256"])
        remote = json.loads(remote_path.read_text())
        for migration in provenance["migrations"]:
            data = (ROOT / "supabase/migrations" / migration["file"]).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), migration["sha256"])
            self.assertEqual(hashlib.md5(data).hexdigest(), migration["md5"])
            self.assertEqual(len(data), migration["bytes"])
            row = next(r for r in remote["history"] if r["version"] == migration["version"])
            self.assertEqual(data, row["statements"][0].encode())

    def test_drift_is_not_hidden(self):
        before = {"functions": [{"name": "helper", "acl": [{"grantee": "anon"}],
                                 "definition": "SECURITY DEFINER"}]}
        after = {"functions": [{"name": "helper", "acl": [], "definition": "SECURITY DEFINER"}]}
        self.assertIn("functions", check.differences(before, after))
        self.assertIn("functions", check.differences(before, {"functions": []}))
        self.assertEqual({}, check.differences(before, before))

    def test_column_order_and_defaults_are_compared(self):
        a = {"relations": [{"columns": [{"name": "id", "default": "gen_random_uuid()"},
                                          {"name": "game_id", "default": None}]}]}
        b = json.loads(json.dumps(a))
        b["relations"][0]["columns"].reverse()
        self.assertIn("relations", check.differences(a, b))
        b = json.loads(json.dumps(a))
        b["relations"][0]["columns"][0]["default"] = "extensions.gen_random_uuid()"
        self.assertIn("relations", check.differences(a, b))

    def test_candidate_is_observed_state_only(self):
        sql = (ROOT / "supabase/migrations/20261102170000_reconcile_legacy_through_056.sql").read_text()
        self.assertIn('CREATE INDEX idx_scheduled_games_team', sql)
        self.assertNotIn('ALTER COLUMN "game_id" SET NOT NULL', sql)
        self.assertNotIn('DROP POLICY', sql)
        self.assertNotIn('FOR ROLE "supabase_admin"', sql)
        self.assertLess(sql.index('CREATE UNIQUE INDEX game_runtime_contracts_id_game_player_unique'),
                        sql.index('ADD CONSTRAINT "free_agency_pending_offers_resolved_contract_game_player_fkey"'))


if __name__ == "__main__":
    unittest.main()
