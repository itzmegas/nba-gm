-- This context proof runs against schema.sql through migration 024, before 025.
INSERT INTO auth.users(id) VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
INSERT INTO teams(id, nba_id, name, city, abbreviation)
VALUES
  ('20000000-0000-4000-8000-000000000001', 1, 'Alpha', 'Alpha', 'AAA'),
  ('20000000-0000-4000-8000-000000000002', 2, 'Beta', 'Beta', 'BBB');
INSERT INTO players(id, team_id, first_name, last_name, full_name, years_of_experience)
VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Canonical', 'Runtime', 'Canonical Runtime', 4),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Canonical', 'Standard', 'Canonical Standard', 4),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'Legacy', 'Only', 'Legacy Only', 4),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'Foreign', 'Roster', 'Foreign Roster', 4),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'Explicit', 'Free Agent', 'Explicit Free Agent', 4),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'Roster', 'Six', 'Roster Six', 4),
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 'Roster', 'Seven', 'Roster Seven', 4),
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', 'Roster', 'Eight', 'Roster Eight', 4),
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', 'Roster', 'Nine', 'Roster Nine', 4),
  ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', 'Roster', 'Ten', 'Roster Ten', 4),
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 'Roster', 'Eleven', 'Roster Eleven', 4),
  ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', 'Roster', 'Twelve', 'Roster Twelve', 4),
  ('30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000001', 'Roster', 'Thirteen', 'Roster Thirteen', 4),
  ('30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000001', 'Roster', 'Fourteen', 'Roster Fourteen', 4),
  ('30000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000001', 'Roster', 'Fifteen', 'Roster Fifteen', 4),
  ('30000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000001', 'Roster', 'Sixteen', 'Roster Sixteen', 4),
  ('30000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000001', 'Roster', 'Seventeen', 'Roster Seventeen', 4),
  ('30000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000002', 'Trade', 'Salary', 'Trade Salary', 4),
  ('30000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000002', 'Runtime', 'Only', 'Runtime Only', 4);
INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Unknown canonical salary', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-02', 'initializing'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Overlay payroll', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-02', 'initializing'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Unknown legacy salary', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-02', 'initializing');

INSERT INTO game_contract_materializations(game_id, source, season, source_version_ids)
SELECT g.id, 'fixture', '2026-27', ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 30))
FROM games g WHERE g.id IN (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003'
);

INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', NULL, true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000002', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000002', true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', NULL, true),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', true),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000005', NULL, true);

INSERT INTO game_contract_identities(game_id, player_id, team_id, resolution_status, contract_type,
  provenance_quality, source_method, estimated, cap_treatment)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'observed-standard', 'standard', 'observed', 'fixture', false, 'standard-cap-and-matching'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'observed-standard', 'standard', 'observed', 'fixture', false, 'standard-cap-and-matching'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'observed-standard', 'standard', 'observed', 'fixture', false, 'standard-cap-and-matching'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'observed-standard', 'standard', 'observed', 'fixture', false, 'standard-cap-and-matching');

INSERT INTO game_contract_agreements(game_id, player_id, team_id, start_season_label, end_season_label,
  contract_type, provenance_quality, source_method, cap_treatment)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '2026-27', '2026-27', 'standard', 'observed', 'fixture', 'standard-cap-and-matching'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '2026-27', '2026-27', 'standard', 'observed', 'fixture', 'standard-cap-and-matching'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '2026-27', '2026-27', 'standard', 'observed', 'fixture', 'standard-cap-and-matching'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '2026-27', '2026-27', 'standard', 'observed', 'fixture', 'standard-cap-and-matching');
INSERT INTO game_contract_seasons(agreement_id, game_id, season_label, start_year, end_year, salary_amount,
  option_kind, guarantee_kind)
SELECT a.id, a.game_id, '2026-27', 2026, 2027,
  CASE
    WHEN a.game_id = '40000000-0000-4000-8000-000000000001' THEN NULL
    WHEN a.player_id = '30000000-0000-4000-8000-000000000001' THEN 100000000
    WHEN a.player_id = '30000000-0000-4000-8000-000000000002' THEN 20000000
    ELSE 100000000
  END,
  'none', 'guaranteed'
FROM game_contract_agreements a;
INSERT INTO contract_source_snapshot_versions(id, source, team, season, source_url, observed_at,
  fetched_at, content_hash, payload)
VALUES ('50000000-0000-4000-8000-000000000001', 'fixture', 'AAA', '2026-27',
  'https://example.invalid/source-snapshot', now(), now(), repeat('b', 64),
  '{"imported":"source-snapshot-payload"}'::jsonb);
INSERT INTO game_contract_provenance(agreement_id, game_id, source, source_url, source_player_id,
  source_snapshot_version_id, observed_at, notes)
SELECT id, game_id, 'fixture', 'https://example.invalid/source-snapshot', player_id::TEXT,
  '50000000-0000-4000-8000-000000000001', now(), '["immutable-note"]'::jsonb
FROM game_contract_agreements WHERE game_id = '40000000-0000-4000-8000-000000000002';
INSERT INTO contracts(game_id, player_id, team_id, start_year, end_year, salary_y1)
VALUES
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 2026, 2027, 100000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 2026, 2027, 15000000),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 2026, 2027, NULL);
INSERT INTO contracts(game_id, player_id, team_id, start_year, end_year, salary_y1)
VALUES
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000001', 2026, 2027, 1000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000002', 2026, 2027, 130000000);
INSERT INTO game_runtime_contracts(game_id, player_id, origin_kind, start_year, end_year, annual_salary)
VALUES
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001',
    'simulated-agreement', 2026, 2026, 10000000),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000020',
    'simulated-agreement', 2026, 2026, 5000000);

UPDATE games SET status = 'active'
WHERE id IN ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003');
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT enroll_simulated_free_agents('40000000-0000-4000-8000-000000000001', ARRAY['30000000-0000-4000-8000-000000000005'::uuid]);
SELECT enroll_simulated_free_agents('40000000-0000-4000-8000-000000000002', ARRAY['30000000-0000-4000-8000-000000000005'::uuid]);
SELECT enroll_simulated_free_agents('40000000-0000-4000-8000-000000000003', ARRAY['30000000-0000-4000-8000-000000000005'::uuid]);
RESET ROLE;

-- BASELINE_RED: migration 020 accepts unknown canonical and legacy salary context,
-- and rejects a legal runtime-overlay offer because canonical/legacy charges are doubled.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT submit_free_agency_offer('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000001', '2026-27', 42000000, 1);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM free_agency_pending_offers WHERE request_id = '60000000-0000-4000-8000-000000000001' AND status = 'pending') THEN
    RAISE EXCEPTION 'Baseline expected pending offer despite unknown canonical salary context';
  END IF;
END $$;
DELETE FROM free_agency_pending_offers WHERE request_id = '60000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_message TEXT;
BEGIN
  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', '2026-27', 42000000, 1);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
  END;
  IF v_message IS DISTINCT FROM 'Offer exceeds cap room' THEN
    RAISE EXCEPTION 'Baseline should demonstrate the old double-counted cap calculation, got %', v_message;
  END IF;
END $$;
DO $$
DECLARE v_message TEXT;
BEGIN
  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000003', '2026-27', 42000000, 1);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
  END;
  IF v_message IS NOT NULL THEN RAISE EXCEPTION 'Baseline expected pending offer despite unknown legacy salary context, got %', v_message; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM free_agency_pending_offers WHERE request_id = '60000000-0000-4000-8000-000000000003' AND status = 'pending') THEN
    RAISE EXCEPTION 'Baseline missing legacy-salary negative control offer';
  END IF;
END $$;
DELETE FROM free_agency_pending_offers WHERE request_id = '60000000-0000-4000-8000-000000000003';

-- AFTER_MIGRATION_025
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_context RECORD;
BEGIN
  SELECT f.* INTO v_context
  FROM public.get_free_agency_financial_context(
    '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005'
  ) f;
  IF v_context.payroll <> 56000000 OR v_context.cap_room <> 114111480
     OR v_context.roster_count <> 14 OR v_context.minimum_salary <> 2625627
     OR v_context.maximum_salary <> 42527870 THEN
    RAISE EXCEPTION 'Shared authoritative context mismatch: %', row_to_json(v_context);
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000001', '2026-27', 42000000, 1);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Canonical current-season standard salary context is incomplete' THEN
    RAISE EXCEPTION 'Canonical salary gap did not fail closed: state %, message %', v_state, v_message;
  END IF;
  v_state := NULL; v_message := NULL;
  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000003', '2026-27', 42000000, 1);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Legacy current-season salary context is incomplete' THEN
    RAISE EXCEPTION 'Legacy salary gap did not fail closed: state %, message %', v_state, v_message;
  END IF;
END $$;

DO $$
DECLARE v_state TEXT; v_message TEXT; v_offer free_agency_pending_offers%ROWTYPE; v_repeat free_agency_pending_offers%ROWTYPE;
BEGIN
  v_offer := submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', '2026-27', 42000000, 1);
  IF v_offer.status <> 'pending' THEN RAISE EXCEPTION 'Legal shared-context offer was not pending'; END IF;
  v_repeat := submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', '2026-27', 42000000, 1);
  IF v_repeat.id IS DISTINCT FROM v_offer.id THEN RAISE EXCEPTION 'Pending same-payload replay changed offer identity'; END IF;

  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', '2026-27', 41000000, 1);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Idempotency key reused with changed offer payload' THEN
    RAISE EXCEPTION 'Changed pending payload did not fail explicitly: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000005', '2026-27', 42527871, 1);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Salary outside verified minimum and maximum' THEN
    RAISE EXCEPTION 'Maximum-salary boundary was not enforced: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000006', '2026-27', 42000000, 6);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Invalid offer terms' THEN
    RAISE EXCEPTION 'Offer-term bounds were not enforced: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000007', '2027-28', 42000000, 1);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Offer season must match the supported game financial season' THEN
    RAISE EXCEPTION 'Unsupported offer season was not rejected: state %, message %', v_state, v_message;
  END IF;
END $$;

-- Direct access to the shared helper is denied even though the public RPC uses it internally.
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    PERFORM 1 FROM public.get_free_agency_financial_context('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM '42501' OR v_message NOT LIKE 'permission denied for function get_free_agency_financial_context%' THEN
    RAISE EXCEPTION 'Authenticated role invoked private finance helper: state %, message %', v_state, v_message;
  END IF;
END $$;
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    PERFORM 1 FROM public.get_free_agency_financial_context('40000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000005');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM '42501' OR v_message NOT LIKE 'permission denied for function get_free_agency_financial_context%' THEN
    RAISE EXCEPTION 'Anonymous role invoked private finance helper: state %, message %', v_state, v_message;
  END IF;
END $$;
RESET ROLE;

UPDATE free_agency_pending_offers
SET status = 'rejected', resolved_at = now(), resolved_date = '2026-10-02',
  resolution_reason = 'another_offer_accepted'
WHERE request_id = '60000000-0000-4000-8000-000000000002';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_state TEXT; v_message TEXT; v_pending public.free_agency_pending_offers%ROWTYPE;
BEGIN
  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', '2026-27', 42000000, 1);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Offer request has already been resolved' THEN
    RAISE EXCEPTION 'Same-payload terminal replay did not return explicit error: state %, message %', v_state, v_message;
  END IF;
  v_state := NULL; v_message := NULL;
  BEGIN
    PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', '2026-27', 41000000, 1);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Idempotency key reused with changed offer payload' THEN
    RAISE EXCEPTION 'Changed terminal payload did not return explicit error: state %, message %', v_state, v_message;
  END IF;
  v_pending := submit_free_agency_offer('40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000004',
    '2026-27', 42000000, 1);
  PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000005',
    '2026-27', 41000000, 1);
  PERFORM submit_free_agency_offer('40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000006',
    '2026-27', 40000000, 1);
  IF v_pending.status <> 'pending' OR
     (SELECT count(*) FROM list_pending_free_agency_offers('40000000-0000-4000-8000-000000000002')) <> 3 THEN
    RAISE EXCEPTION 'Pending-offer listing did not exclude terminal requests and retain pending ones';
  END IF;
  v_state := NULL; v_message := NULL;
  BEGIN
    UPDATE free_agency_pending_offers SET status = 'accepted'
    WHERE request_id = '60000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM '42501' OR v_message NOT LIKE 'permission denied for table free_agency_pending_offers%' THEN
    RAISE EXCEPTION 'Authenticated direct terminal-state mutation was not denied: state %, message %', v_state, v_message;
  END IF;
END $$;
RESET ROLE;
UPDATE contracts SET salary_y1 = 200000000
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000003';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000009', '2026-27', 2625627, 1);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM free_agency_pending_offers
      WHERE request_id = '60000000-0000-4000-8000-000000000009' AND status = 'pending') THEN
    RAISE EXCEPTION 'Verified minimum salary exception did not permit the offer with zero cap room';
  END IF;
END $$;
UPDATE free_agency_pending_offers
SET status = 'rejected', resolved_at = now(), resolved_date = '2026-10-02',
  resolution_reason = 'another_offer_accepted'
WHERE request_id = '60000000-0000-4000-8000-000000000009';
UPDATE contracts SET salary_y1 = 15000000
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000003';
SELECT 'GREEN: shared salary context, pending replay, terminal replay and pending-only listing passed' AS signing_context_proof;
