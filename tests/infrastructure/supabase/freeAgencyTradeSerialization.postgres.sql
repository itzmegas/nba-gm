-- This phase runs only after migrations 022 and 023 have passed their own assertions.
CREATE TABLE free_agency_trade_prestate(snapshot JSONB NOT NULL);
INSERT INTO free_agency_trade_prestate(snapshot)
SELECT jsonb_build_object(
  'identities', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
    FROM game_contract_identities x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
  'agreements', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
    FROM game_contract_agreements x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
  'seasons', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id, x.season_label)
    FROM game_contract_seasons x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
  'provenance', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id)
    FROM game_contract_provenance x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
  'sourceSnapshots', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
    FROM contract_source_snapshot_versions x WHERE x.id = '50000000-0000-4000-8000-000000000001'), '[]'::jsonb),
  'legacyTerms', COALESCE((SELECT jsonb_agg(to_jsonb(x) - 'team_id' - 'updated_at' ORDER BY x.game_id, x.player_id)
    FROM contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
  'runtimeTerms', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
    FROM game_runtime_contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb)
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT execute_trade_transactional(
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"30000000-0000-4000-8000-000000000001","from_team_id":"20000000-0000-4000-8000-000000000001"},{"asset_type":"player","asset_id":"30000000-0000-4000-8000-000000000002","from_team_id":"20000000-0000-4000-8000-000000000002"}]'::jsonb
);
RESET ROLE;

DO $$
DECLARE v_before JSONB; v_after JSONB;
BEGIN
  IF (SELECT team_id FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001') <> '20000000-0000-4000-8000-000000000002'
     OR (SELECT team_id FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000002') <> '20000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'Trade did not transfer both roster owners in opposite directions';
  END IF;
  IF (SELECT team_id FROM contracts WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001') <> '20000000-0000-4000-8000-000000000002'
     OR (SELECT team_id FROM contracts WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000002') <> '20000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'Trade did not transfer both legacy contract owners';
  END IF;

  SELECT snapshot INTO v_before FROM free_agency_trade_prestate;
  SELECT jsonb_build_object(
    'identities', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
      FROM game_contract_identities x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
    'agreements', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
      FROM game_contract_agreements x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
    'seasons', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id, x.season_label)
      FROM game_contract_seasons x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
    'provenance', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id)
      FROM game_contract_provenance x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
    'sourceSnapshots', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
      FROM contract_source_snapshot_versions x WHERE x.id = '50000000-0000-4000-8000-000000000001'), '[]'::jsonb),
    'legacyTerms', COALESCE((SELECT jsonb_agg(to_jsonb(x) - 'team_id' - 'updated_at' ORDER BY x.game_id, x.player_id)
      FROM contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb),
    'runtimeTerms', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
      FROM game_runtime_contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000001'), '[]'::jsonb)
  ) INTO v_after;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'Trade changed complete imported or simulated contract snapshots';
  END IF;
END $$;
SELECT 'GREEN: both roster and legacy contract directions transferred; complete canonical and simulated snapshots unchanged' AS trade_snapshot_proof;
