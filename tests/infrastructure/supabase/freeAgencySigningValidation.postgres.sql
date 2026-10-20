-- Run after the offer becomes due, while all three competing requests are pending.
CREATE FUNCTION pg_temp.signing_snapshot() RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_object_agg(name, rows) FROM (
    SELECT 'roster' AS name, jsonb_agg(to_jsonb(s) ORDER BY id) AS rows FROM game_player_states s
    UNION ALL SELECT 'runtime', jsonb_agg(to_jsonb(r) ORDER BY id) FROM game_runtime_contracts r
    UNION ALL SELECT 'offers', jsonb_agg(to_jsonb(o) ORDER BY id) FROM free_agency_pending_offers o
    UNION ALL SELECT 'identities', jsonb_agg(to_jsonb(i) ORDER BY game_id, player_id) FROM game_contract_identities i
    UNION ALL SELECT 'agreements', jsonb_agg(to_jsonb(a) ORDER BY id) FROM game_contract_agreements a
    UNION ALL SELECT 'seasons', jsonb_agg(to_jsonb(s) ORDER BY id) FROM game_contract_seasons s
    UNION ALL SELECT 'provenance', jsonb_agg(to_jsonb(p) ORDER BY agreement_id) FROM game_contract_provenance p
    UNION ALL SELECT 'sources', jsonb_agg(to_jsonb(s) ORDER BY id) FROM contract_source_snapshot_versions s
    UNION ALL SELECT 'legacy', jsonb_agg(to_jsonb(c) ORDER BY id) FROM contracts c
  ) snapshots
$$;

CREATE FUNCTION pg_temp.expect_signing_failure(expected TEXT,
  target_game UUID DEFAULT '40000000-0000-4000-8000-000000000002',
  target_offer UUID DEFAULT '60000000-0000-4000-8000-000000000004'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE before_state JSONB := pg_temp.signing_snapshot(); actual TEXT;
BEGIN
  BEGIN
    PERFORM resolve_free_agency_offer(target_game, target_offer);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual = MESSAGE_TEXT;
  END;
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Expected signing failure %, got %', expected, actual;
  END IF;
  IF pg_temp.signing_snapshot() IS DISTINCT FROM before_state THEN
    RAISE EXCEPTION 'Failed signing changed roster, offers, runtime or imported snapshot';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

DO $$
DECLARE actual TEXT;
BEGIN
  BEGIN
    UPDATE free_agency_pending_offers SET resolution_reason = NULL WHERE status = 'rejected';
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual = RETURNED_SQLSTATE;
  END;
  IF actual IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Terminal reason NULL bypassed CHECK: %', actual; END IF;
  actual := NULL;
  BEGIN
    UPDATE game_runtime_contracts SET source_offer_id = '60000000-0000-4000-8000-000000000004'
    WHERE player_id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual = RETURNED_SQLSTATE;
  END;
  IF actual IS DISTINCT FROM '23503' THEN RAISE EXCEPTION 'Source offer player binding bypassed FK: %', actual; END IF;
END $$;

-- A submitted offer cannot mask incomplete salaries at resolution either.
INSERT INTO free_agency_pending_offers(id, request_id, owner_id, game_id, player_id, team_id,
  season, annual_salary, years, due_date)
SELECT gen_random_uuid(), gen_random_uuid(), user_id, id, '30000000-0000-4000-8000-000000000005',
  selected_team_id, '2026-27', 42000000, 1, simulation_date
FROM games WHERE id IN ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003');
SELECT pg_temp.expect_signing_failure(
  CASE WHEN game_id = '40000000-0000-4000-8000-000000000001'::uuid
    THEN 'Canonical current-season standard salary context is incomplete'
    ELSE 'Legacy current-season salary context is incomplete' END, game_id, id)
FROM free_agency_pending_offers WHERE game_id IN
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003');
DELETE FROM free_agency_pending_offers WHERE game_id IN
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003');

-- Prove rollback AFTER runtime insertion and roster assignment, not just before writes.
CREATE FUNCTION pg_temp.reject_signing_terminalization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    IF NOT EXISTS (SELECT 1 FROM game_runtime_contracts WHERE source_offer_id = NEW.id)
       OR (SELECT team_id FROM game_player_states WHERE game_id = NEW.game_id AND player_id = NEW.player_id)
          IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'Injected failure did not reach post-write state';
    END IF;
    RAISE EXCEPTION 'Injected failure after runtime and roster writes';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER signing_rollback_probe AFTER UPDATE ON free_agency_pending_offers
  FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_signing_terminalization();
SELECT pg_temp.expect_signing_failure('Injected failure after runtime and roster writes');
DROP TRIGGER signing_rollback_probe ON free_agency_pending_offers;

-- Pending offers reserve neither roster room nor cap room. Recheck both at resolution.
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
VALUES ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000017',
  '20000000-0000-4000-8000-000000000001', true);
INSERT INTO contracts(game_id, player_id, team_id, start_year, end_year, salary_y1)
VALUES ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000017',
  '20000000-0000-4000-8000-000000000001', 2026, 2026, 1000000);
SELECT pg_temp.expect_signing_failure('Roster maximum reached');
DELETE FROM contracts WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000017';
DELETE FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000017';

UPDATE free_agency_pending_offers SET annual_salary = 2625626
WHERE id = '60000000-0000-4000-8000-000000000004';
SELECT pg_temp.expect_signing_failure('Salary outside verified minimum and maximum');
UPDATE free_agency_pending_offers SET annual_salary = 42527871
WHERE id = '60000000-0000-4000-8000-000000000004';
SELECT pg_temp.expect_signing_failure('Salary outside verified minimum and maximum');
UPDATE free_agency_pending_offers SET annual_salary = 9007199254740992
WHERE id = '60000000-0000-4000-8000-000000000004';
SELECT pg_temp.expect_signing_failure('Stored offer terms are outside supported bounds');
UPDATE free_agency_pending_offers SET annual_salary = 42000000, season = '2027-28'
WHERE id = '60000000-0000-4000-8000-000000000004';
SELECT pg_temp.expect_signing_failure('Offer season must match the supported game financial season');
UPDATE free_agency_pending_offers SET season = '2026-27', years = 5
WHERE id = '60000000-0000-4000-8000-000000000004';

BEGIN;
UPDATE contracts SET salary_y1 = 200000000
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000003';
UPDATE free_agency_pending_offers SET annual_salary = 2625627
WHERE id = '60000000-0000-4000-8000-000000000004';
SELECT resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM game_runtime_contracts
      WHERE source_offer_id = '60000000-0000-4000-8000-000000000004' AND annual_salary = 2625627) THEN
    RAISE EXCEPTION 'Verified minimum exception did not permit resolution with zero cap room';
  END IF;
END $$;
ROLLBACK;

UPDATE games SET status = 'archived' WHERE id = '40000000-0000-4000-8000-000000000002';
SELECT pg_temp.expect_signing_failure('Owned active modern game required');
UPDATE games SET status = 'deleted', deleted_at = now() WHERE id = '40000000-0000-4000-8000-000000000002';
SELECT pg_temp.expect_signing_failure('Owned active modern game required');
UPDATE games SET status = 'active', deleted_at = NULL WHERE id = '40000000-0000-4000-8000-000000000002';

BEGIN;
INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
  'No materialization', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-03', 'active');
DO $$
DECLARE actual TEXT;
BEGIN
  BEGIN
    PERFORM get_free_agency_financial_context('40000000-0000-4000-8000-000000000004',
      '30000000-0000-4000-8000-000000000005');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual = MESSAGE_TEXT;
  END;
  IF actual IS DISTINCT FROM 'Materialized contract coverage required' THEN
    RAISE EXCEPTION 'Unmaterialized game finance context was not rejected: %', actual;
  END IF;
END $$;
ROLLBACK;

-- A complete successful transaction must also disappear on caller rollback.
CREATE TEMP TABLE signing_transaction_before AS SELECT pg_temp.signing_snapshot() AS snapshot;
BEGIN;
SELECT resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM game_runtime_contracts
      WHERE source_offer_id = '60000000-0000-4000-8000-000000000004' AND end_year = 2030)
     OR (SELECT count(*) FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002'
       AND status = 'pending') <> 0 THEN
    RAISE EXCEPTION 'Five-year signing did not commit all in-transaction state';
  END IF;
END $$;
ROLLBACK;
DO $$ BEGIN
  IF pg_temp.signing_snapshot() IS DISTINCT FROM (SELECT snapshot FROM signing_transaction_before) THEN
    RAISE EXCEPTION 'Caller rollback did not restore the exact pre-signing snapshot';
  END IF;
  IF EXISTS (SELECT 1 FROM game_runtime_contracts
      WHERE source_offer_id = '60000000-0000-4000-8000-000000000004')
     OR (SELECT count(*) FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002'
       AND status = 'pending') <> 3 THEN
    RAISE EXCEPTION 'Caller rollback retained signing mutations';
  END IF;
END $$;
SELECT 'GREEN: post-write failure rollback, caller rollback, roster and term revalidation' AS proof;
