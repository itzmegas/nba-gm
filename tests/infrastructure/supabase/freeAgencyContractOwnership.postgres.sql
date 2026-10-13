-- This setup is executed against the full canonical schema before migration 022.
INSERT INTO auth.users(id) VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
INSERT INTO teams(id, nba_id, name, city, abbreviation)
VALUES
  ('20000000-0000-4000-8000-000000000001', 1, 'Alpha', 'Alpha', 'AAA'),
  ('20000000-0000-4000-8000-000000000002', 2, 'Beta', 'Beta', 'BBB');
INSERT INTO players(id, team_id, first_name, last_name, full_name, years_of_experience)
VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'One', 'Player', 'One Player', 4),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Two', 'Player', 'Two Player', 3),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'Three', 'Player', 'Three Player', 2),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'Four', 'Player', 'Four Player', 1),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'Five', 'Player', 'Five Player', 1),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', 'Six', 'Player', 'Six Player', 1);
INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Ownership fixture', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-02', 'initializing'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Owned target', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-02', 'initializing'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Other owner target', '20000000-0000-4000-8000-000000000002', 2026, 'modern', '2026-10-02', 'initializing');
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', true),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', true);
INSERT INTO game_contract_identities(game_id, player_id, team_id, resolution_status, contract_type,
  provenance_quality, source_method, estimated, cap_treatment)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'observed-standard', 'standard', 'observed', 'fixture', false, 'standard-cap-and-matching'),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'observed-standard', 'standard', 'observed', 'fixture', false, 'standard-cap-and-matching'),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'observed-standard', 'standard', 'observed', 'fixture', false, 'standard-cap-and-matching');
INSERT INTO game_contract_agreements(game_id, player_id, team_id, contract_type, provenance_quality,
  source_method, cap_treatment)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'standard', 'observed', 'fixture', 'standard-cap-and-matching'),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'standard', 'observed', 'fixture', 'standard-cap-and-matching');
INSERT INTO game_contract_seasons(agreement_id, game_id, season_label, start_year, end_year,
  salary_amount, option_kind, guarantee_kind)
SELECT id, game_id, '2026-27', 2026, 2027,
  CASE WHEN player_id = '30000000-0000-4000-8000-000000000001' THEN 5000000 ELSE 6000000 END,
  'none', 'guaranteed'
FROM game_contract_agreements WHERE game_id = '40000000-0000-4000-8000-000000000001';
INSERT INTO contract_source_snapshot_versions(id, source, team, season, source_url, observed_at,
  fetched_at, content_hash, payload)
VALUES ('50000000-0000-4000-8000-000000000001', 'fixture', 'AAA', '2026-27',
  'https://example.invalid/contracts', now(), now(), repeat('a', 64), '{"raw":"immutable-source"}'::jsonb);
INSERT INTO game_contract_provenance(agreement_id, game_id, source, source_url, source_player_id,
  source_snapshot_version_id, observed_at, notes)
SELECT id, game_id, 'fixture', 'https://example.invalid/contracts',
  CASE WHEN player_id = '30000000-0000-4000-8000-000000000001' THEN 'imported-one' ELSE 'imported-two' END,
  '50000000-0000-4000-8000-000000000001', now(), '["source-note"]'::jsonb
FROM game_contract_agreements WHERE game_id = '40000000-0000-4000-8000-000000000001';
INSERT INTO contracts(game_id, player_id, team_id, start_year, end_year, salary_y1)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 2026, 2027, 5000000),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 2026, 2027, 6000000);
INSERT INTO game_runtime_contracts(game_id, player_id, origin_kind, start_year, end_year, annual_salary)
VALUES ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004',
  'simulated-agreement', 2026, 2028, 7000000);

DO $$
DECLARE v_state TEXT;
BEGIN
  BEGIN
    UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000002'
    WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN foreign_key_violation THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM '23503' THEN
    RAISE EXCEPTION 'Expected actual historical team-bound FK violation, got %', v_state;
  END IF;
END;
$$;
SELECT 'RED: old team-bound FK produced SQLSTATE 23503' AS ownership_negative_control;

-- AFTER_MIGRATION_022
UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000002'
WHERE game_id = '40000000-0000-4000-8000-000000000001'
  AND player_id = '30000000-0000-4000-8000-000000000001';
DO $$
DECLARE v_rejected BOOLEAN := false;
BEGIN
  IF (SELECT team_id FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001') <> '20000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'Roster transfer did not follow the new game/player FK';
  END IF;
  IF (SELECT team_id FROM game_contract_identities WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001') <> '20000000-0000-4000-8000-000000000001'
     OR (SELECT team_id FROM game_contract_agreements WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001') <> '20000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'Imported team provenance changed during roster transfer';
  END IF;
  BEGIN
    DELETE FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN foreign_key_violation THEN v_rejected := true;
  END;
  IF NOT v_rejected OR NOT EXISTS (SELECT 1 FROM game_player_states
      WHERE game_id = '40000000-0000-4000-8000-000000000001'
        AND player_id = '30000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Contract ownership migration lost its restrictive delete protection';
  END IF;
END;
$$;
SELECT 'GREEN: roster team transfer succeeded and restrictive imported-row delete remains' AS ownership_migration_proof;
UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000001'
WHERE game_id = '40000000-0000-4000-8000-000000000001'
  AND player_id = '30000000-0000-4000-8000-000000000001';
