BEGIN;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT pg_temp.assert_true(generate_ai_free_agency_offers('40000000-0000-4000-8000-000000000002') = 1, 'AI did not submit');
CREATE TEMP TABLE market_before AS SELECT to_jsonb(o) AS offer FROM free_agency_pending_offers o WHERE offer_origin = 'ai';
SELECT pg_temp.assert_true(generate_ai_free_agency_offers('40000000-0000-4000-8000-000000000002') = 0, 'AI replay generated a second daily offer');
SELECT pg_temp.assert_true((SELECT offer = (SELECT to_jsonb(o) FROM free_agency_pending_offers o WHERE offer_origin = 'ai')
  FROM market_before), 'AI replay changed persisted terms');
SELECT pg_temp.assert_true((SELECT team_id = '20000000-0000-4000-8000-000000000002'
    AND due_date = '2026-10-03' AND ai_decision_date = '2026-10-02' AND annual_salary = 2625627 AND years = 1
  FROM free_agency_pending_offers WHERE offer_origin = 'ai'), 'AI controls invalid team/clock/terms');
SELECT pg_temp.assert_true(resolve_due_free_agency_market('40000000-0000-4000-8000-000000000002') = 0, 'Instant acceptance occurred');
UPDATE games SET simulation_date = '2026-10-03' WHERE id = '40000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert_true(resolve_due_free_agency_market('40000000-0000-4000-8000-000000000002') = 1, 'Due market did not sign');
SELECT pg_temp.assert_true((SELECT annual_salary = 42000000 AND offer_origin = 'human' FROM free_agency_pending_offers
  WHERE status = 'accepted'), 'Higher-scoring human offer did not win');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM game_runtime_contracts
  WHERE game_id = '40000000-0000-4000-8000-000000000002' AND player_id = '30000000-0000-4000-8000-000000000005'), 'Double signing');
SELECT pg_temp.assert_true(resolve_due_free_agency_market('40000000-0000-4000-8000-000000000002') = 0, 'Market replay signed twice');
ROLLBACK;

BEGIN;
UPDATE free_agency_pending_offers SET annual_salary = CASE WHEN request_id = '60000000-0000-4000-8000-000000000004' THEN 1 ELSE 2625627 END
WHERE status = 'pending' AND game_id = '40000000-0000-4000-8000-000000000002';
SELECT generate_ai_free_agency_offers('40000000-0000-4000-8000-000000000002');
UPDATE games SET simulation_date = '2026-10-03' WHERE id = '40000000-0000-4000-8000-000000000002';
SELECT resolve_due_free_agency_market('40000000-0000-4000-8000-000000000002');
SELECT pg_temp.assert_true((SELECT status = 'rejected' AND resolution_reason = 'offer_no_longer_legal'
    AND resolution_detail = 'Salary outside verified minimum and maximum'
  FROM free_agency_pending_offers WHERE request_id = '60000000-0000-4000-8000-000000000004'), 'Illegal offer was ranked or lost its rejection explanation');
SELECT pg_temp.assert_true((SELECT offer_origin = 'ai' AND annual_salary = 2625627 FROM free_agency_pending_offers
  WHERE status = 'accepted'), 'AI opportunity score did not beat the same legal human minimum');
SELECT pg_temp.assert_true((SELECT team_id = '20000000-0000-4000-8000-000000000002' FROM game_player_states
  WHERE game_id = '40000000-0000-4000-8000-000000000002' AND player_id = '30000000-0000-4000-8000-000000000005'), 'AI acquisition assigned incorrectly');
ROLLBACK;

BEGIN;
DELETE FROM free_agency_availability_enrollments WHERE game_id = '40000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert_true(generate_ai_free_agency_offers('40000000-0000-4000-8000-000000000002') = 0, 'AI inferred availability without enrollment');
ROLLBACK;
BEGIN;
UPDATE contracts SET salary_y1 = NULL WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000018';
SELECT pg_temp.expect_error($q$SELECT generate_ai_free_agency_offers('40000000-0000-4000-8000-000000000002')$q$,
  'Legacy current-season salary context is incomplete');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM free_agency_pending_offers WHERE offer_origin = 'ai'), 'Failed AI generation partially persisted');
ROLLBACK;
BEGIN;
SET ROLE authenticated;
SELECT pg_temp.assert_true(NOT has_function_privilege(current_user, 'generate_ai_free_agency_offers(uuid)', 'EXECUTE'), 'Client controls AI');
SELECT pg_temp.assert_true(NOT has_function_privilege(current_user, 'resolve_due_free_agency_market(uuid)', 'EXECUTE'), 'Client controls due resolution');
RESET ROLE;
ROLLBACK;

BEGIN;
UPDATE contracts SET salary_y1 = 1000000 WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000018';
SELECT generate_ai_free_agency_offers('40000000-0000-4000-8000-000000000002');
SELECT pg_temp.assert_true((SELECT annual_salary = 2888189 AND years = 1 FROM free_agency_pending_offers
  WHERE offer_origin = 'ai'), 'AI minimum uplift did not respect available cap room');
ROLLBACK;

BEGIN;
UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000002'
WHERE game_id = '40000000-0000-4000-8000-000000000002' AND player_id IN (
  SELECT player_id FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000002'
    AND team_id = '20000000-0000-4000-8000-000000000001' ORDER BY player_id LIMIT 12
);
SELECT pg_temp.assert_true(generate_ai_free_agency_offers('40000000-0000-4000-8000-000000000002') = 0,
  'AI offered above the same 15-player roster maximum');
ROLLBACK;

BEGIN;
UPDATE free_agency_pending_offers SET annual_salary = 2625627 WHERE status = 'pending';
CREATE TEMP TABLE tie_winner AS SELECT id FROM free_agency_pending_offers WHERE status = 'pending' ORDER BY id LIMIT 1;
UPDATE games SET simulation_date = '2026-10-03' WHERE id = '40000000-0000-4000-8000-000000000002';
SELECT resolve_due_free_agency_market('40000000-0000-4000-8000-000000000002');
SELECT pg_temp.assert_true((SELECT id = (SELECT id FROM tie_winner) FROM free_agency_pending_offers WHERE status = 'accepted'),
  'Equal-score, equal-team offers did not use stable offer identity');
ROLLBACK;
