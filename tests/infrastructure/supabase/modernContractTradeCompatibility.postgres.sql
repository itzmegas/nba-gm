-- Modern contract trade compatibility regression matrix.
-- Self-contained synthetic fixture; runs inside an already-bootstrapped disposable PostgreSQL instance.
-- Covers canonical-only eligibility, source precedence, invalid assets, transactional rollback,
-- repeat ownership, and immutable canonical snapshots. Rollback at the end leaves no persisted state.
BEGIN;

INSERT INTO auth.users(id) VALUES ('c0000000-0000-4000-8000-000000000001');

INSERT INTO teams(id, nba_id, name, city, abbreviation, conference)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 1001, 'Alpha', 'Test', 'ALP', 'East'),
  ('c1000000-0000-4000-8000-000000000002', 1002, 'Beta',  'Test', 'BET', 'East'),
  ('c1000000-0000-4000-8000-000000000003', 1003, 'Gamma','Test', 'GAM', 'West'),
  ('c1000000-0000-4000-8000-000000000004', 1004, 'Delta','Test', 'DLT', 'West');

INSERT INTO players(id, nba_id, team_id, first_name, last_name, full_name, position, years_of_experience, is_active)
SELECT ('c2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       2000+n, 'c1000000-0000-4000-8000-000000000001', 'Synthetic', n::text, 'Synthetic '||n,
       CASE WHEN n%3=0 THEN 'C' WHEN n%3=1 THEN 'G' ELSE 'F' END, 4, true
FROM generate_series(1,12) n;

INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES
  ('c3000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001',
   'Modern compatibility','c1000000-0000-4000-8000-000000000001',2026,'modern','2026-10-01','initializing'),
  ('c3000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001',
   'Historical compatibility','c1000000-0000-4000-8000-000000000003',1995,'jordan','1995-10-01','initializing');

-- Modern roster ownership.
INSERT INTO game_player_states(id, game_id, player_id, team_id)
VALUES
  ('c3100000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001'),
  ('c3100000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001'),
  ('c3100000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001'),
  ('c3100000-0000-4000-8000-000000000004','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000001'),
  ('c3100000-0000-4000-8000-000000000005','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000005','c1000000-0000-4000-8000-000000000001'),
  ('c3100000-0000-4000-8000-000000000006','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000006','c1000000-0000-4000-8000-000000000002'),
  ('c3100000-0000-4000-8000-000000000007','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000007','c1000000-0000-4000-8000-000000000002'),
  ('c3100000-0000-4000-8000-000000000008','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000008','c1000000-0000-4000-8000-000000000002'),
  ('c3100000-0000-4000-8000-000000000009','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000009','c1000000-0000-4000-8000-000000000002'),
  ('c3100000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000010','c1000000-0000-4000-8000-000000000002'),
  ('c3100000-0000-4000-8000-000000000011','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000011','c1000000-0000-4000-8000-000000000002'),
  ('c3100000-0000-4000-8000-000000000012','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000012','c1000000-0000-4000-8000-000000000002');

-- Historical roster ownership.
INSERT INTO game_player_states(id, game_id, player_id, team_id)
VALUES
  ('c3200000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000011','c1000000-0000-4000-8000-000000000003'),
  ('c3200000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000012','c1000000-0000-4000-8000-000000000004');

-- Canonical agreements: p1 valid, p2 missing salary, p3 excluded cap treatment, p4 identity-only (no agreement).
INSERT INTO game_contract_agreements(id, game_id, player_id, team_id, contract_type, provenance_quality, source_method, estimated, cap_treatment)
VALUES
  ('c4000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','standard','observed','test',false,'standard-cap-and-matching'),
  ('c4000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','standard','observed','test',false,'standard-cap-and-matching'),
  ('c4000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001','standard','observed','test',false,'excluded-two-way'),
  ('c4000000-0000-4000-8000-000000000004','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000007','c1000000-0000-4000-8000-000000000002','standard','observed','test',false,'standard-cap-and-matching'),
  ('c4000000-0000-4000-8000-000000000005','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000008','c1000000-0000-4000-8000-000000000002','standard','observed','test',false,'standard-cap-and-matching');

INSERT INTO game_contract_seasons(id, agreement_id, game_id, season_label, start_year, end_year, salary_amount, option_kind, guarantee_kind)
VALUES
  ('c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','2026-27',2026,2027,10000000,'none','guaranteed'),
  ('c4100000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001','2026-27',2026,2027,null,'none','guaranteed'),
  ('c4100000-0000-4000-8000-000000000003','c4000000-0000-4000-8000-000000000004','c3000000-0000-4000-8000-000000000001','2026-27',2026,2027,8000000,'none','guaranteed'),
  ('c4100000-0000-4000-8000-000000000004','c4000000-0000-4000-8000-000000000005','c3000000-0000-4000-8000-000000000001','2026-27',2026,2027,9000000,'none','guaranteed');

-- Identity-only coverage for p4.
INSERT INTO game_contract_identities(game_id, player_id, team_id, resolution_status, contract_type, provenance_quality, source_method, estimated, cap_treatment, exclusion_evidence)
VALUES ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000001','observed-standard','standard','observed','test',false,'standard-cap-and-matching',null);

UPDATE games SET status='active' WHERE id IN ('c3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002');

-- Runtime contracts: p6 runtime-only, p7 runtime+canonical.
INSERT INTO game_runtime_contracts(id, game_id, player_id, origin_kind, start_year, end_year, annual_salary)
VALUES
  ('c5000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000006','simulated-agreement',2026,2028,5000000),
  ('c5000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000007','simulated-agreement',2026,2028,7000000);

-- Legacy contracts: p5 historical, p8 canonical+legacy.
INSERT INTO contracts(id, player_id, team_id, game_id, start_year, end_year, salary_y1, salary_y2, salary_y3, salary_y4, salary_y5)
VALUES
  ('c6000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000011','c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000002',1995,1997,3000000,3200000,0,0,0),
  ('c6000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000012','c1000000-0000-4000-8000-000000000004','c3000000-0000-4000-8000-000000000002',1995,1997,4000000,4200000,0,0,0),
  ('c6000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000008','c1000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001',2026,2028,6000000,6200000,6400000,0,0);

-- Draft picks: years outside the auto-generated 7-season windows to avoid unique collisions.
INSERT INTO draft_picks(id, draft_year, draft_round, original_team_id, protection)
VALUES
  ('c7000000-0000-4000-8000-000000000001',2033,1,'c1000000-0000-4000-8000-000000000001',null),
  ('c7000000-0000-4000-8000-000000000002',2034,2,'c1000000-0000-4000-8000-000000000001',null),
  ('c7000000-0000-4000-8000-000000000003',2002,1,'c1000000-0000-4000-8000-000000000003',null);

INSERT INTO game_pick_inventory(id, game_id, draft_pick_id, owner_team_id, is_transferable)
VALUES
  ('c8000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',true),
  ('c8000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001',false),
  ('c8000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000002','c7000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000003',true);

CREATE OR REPLACE FUNCTION test_trade_state(p_game_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'roster', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.player_id),'[]'::jsonb) FROM game_player_states r WHERE r.game_id = p_game_id),
    'agreements', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb) FROM game_contract_agreements a WHERE a.game_id = p_game_id),
    'seasons', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.agreement_id, s.season_label),'[]'::jsonb) FROM game_contract_seasons s WHERE s.game_id = p_game_id),
    'runtime', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) FROM game_runtime_contracts r WHERE r.game_id = p_game_id),
    'legacy', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb) FROM contracts c WHERE c.game_id = p_game_id),
    'picks', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM game_pick_inventory p WHERE p.game_id = p_game_id),
    'trades', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) FROM executed_trades t WHERE t.game_id = p_game_id),
    'snapshots', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) FROM trade_asset_snapshots s JOIN executed_trades t ON t.id = s.executed_trade_id WHERE t.game_id = p_game_id)
  );
$$;

CREATE OR REPLACE FUNCTION expect_trade_failure(
  p_game_id UUID,
  p_team_a_id UUID,
  p_team_b_id UUID,
  p_assets JSONB,
  p_expected_message TEXT,
  p_game_id_for_state UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_actual_game_id UUID := coalesce(p_game_id_for_state, p_game_id);
BEGIN
  v_before := test_trade_state(v_actual_game_id);
  BEGIN
    PERFORM execute_trade_transactional(p_game_id, p_team_a_id, p_team_b_id, p_assets);
    RAISE EXCEPTION 'Expected trade to fail with "%", but it succeeded', p_expected_message;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%' || p_expected_message || '%' THEN
      RAISE EXCEPTION 'Expected message "%", got "%"', p_expected_message, SQLERRM;
    END IF;
  END;
  v_after := test_trade_state(v_actual_game_id);
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'Rejected trade mutated persisted state for %', p_expected_message;
  END IF;
END $$;

SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;

-- 1. Canonical-only modern trade with known current-season salary.
SELECT execute_trade_transactional(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000001","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb
);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000001') = 'c1000000-0000-4000-8000-000000000002', 'canonical-only player transferred';
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000006') = 'c1000000-0000-4000-8000-000000000001', 'runtime-only player transferred back';
  ASSERT NOT EXISTS (SELECT 1 FROM contracts WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000001'), 'no legacy contract invented for canonical-only player';
  ASSERT (SELECT count(*) FROM executed_trades WHERE game_id='c3000000-0000-4000-8000-000000000001') = 1, 'one trade recorded';
END $$;

-- Capture immutable canonical state after a successful trade.
CREATE TEMP TABLE canonical_after_trade AS SELECT test_trade_state('c3000000-0000-4000-8000-000000000001') AS value;

-- 2. Negative eligibility cases.
SET LOCAL ROLE authenticated;
-- Missing current-season salary (NULL).
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000002","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Player contract is missing'
);
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000003","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Player contract is missing'
);
-- Identity-only coverage (no agreement).
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000004","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Player contract is missing'
);
-- No coverage at all.
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000005","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Player contract is missing'
);
RESET ROLE;

-- 3. Historical-era exclusion: canonical agreement must not enable a historical game trade.
SET LOCAL ROLE authenticated;
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000004',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000011","from_team_id":"c1000000-0000-4000-8000-000000000003"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000012","from_team_id":"c1000000-0000-4000-8000-000000000004"}]'::jsonb,
  'Player contract is missing',
  'c3000000-0000-4000-8000-000000000002'
);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000002' AND player_id='c2000000-0000-4000-8000-000000000011') = 'c1000000-0000-4000-8000-000000000003', 'historical roster unchanged after rejection';
END $$;

-- 4. Legacy-only historical trade.
SET LOCAL ROLE authenticated;
SELECT execute_trade_transactional(
  'c3000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000004',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000011","from_team_id":"c1000000-0000-4000-8000-000000000003"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000012","from_team_id":"c1000000-0000-4000-8000-000000000004"}]'::jsonb
);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT team_id FROM contracts WHERE game_id='c3000000-0000-4000-8000-000000000002' AND player_id='c2000000-0000-4000-8000-000000000011') = 'c1000000-0000-4000-8000-000000000004', 'legacy contract transferred';
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000002' AND player_id='c2000000-0000-4000-8000-000000000011') = 'c1000000-0000-4000-8000-000000000004', 'historical roster transferred';
END $$;

-- 5. Runtime-only trade and runtime-over-canonical precedence.
SET LOCAL ROLE authenticated;
SELECT execute_trade_transactional(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000007","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb
);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000006') = 'c1000000-0000-4000-8000-000000000002', 'runtime-only player returned to team B';
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000007') = 'c1000000-0000-4000-8000-000000000001', 'runtime+canonical player transferred';
  ASSERT (SELECT count(*) FROM game_runtime_contracts WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000007' AND annual_salary=7000000) = 1, 'runtime terms unchanged';
END $$;

-- 5b. Canonical+legacy mixed source.
SET LOCAL ROLE authenticated;
SELECT execute_trade_transactional(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000007","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000008","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb
);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000008') = 'c1000000-0000-4000-8000-000000000001', 'canonical+legacy player transferred';
  ASSERT (SELECT team_id FROM contracts WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000008') = 'c1000000-0000-4000-8000-000000000001', 'legacy contract transferred with player';
END $$;

-- 6. Canonical agreement and season records remain immutable across all successful trades.
DO $$ BEGIN
  ASSERT (SELECT value->'agreements' FROM canonical_after_trade) =
         (SELECT jsonb_build_object('agreements', test_trade_state('c3000000-0000-4000-8000-000000000001')->'agreements')->'agreements'), 'agreements mutated';
  ASSERT (SELECT value->'seasons' FROM canonical_after_trade) =
         (SELECT jsonb_build_object('seasons', test_trade_state('c3000000-0000-4000-8000-000000000001')->'seasons')->'seasons'), 'seasons mutated';
END $$;

-- 7. Invalid-asset rejections.
SET LOCAL ROLE authenticated;
-- Invalid player (not in this game).
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000011","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Player ownership is stale or invalid'
);
-- Wrong owner.
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000001","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Player ownership is stale or invalid'
);
-- Duplicate asset (both teams must be represented for the duplicate check to be reached).
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000008","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Duplicate trade asset'
);
-- Cross-game asset (pick from historical game in modern trade).
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"pick","asset_id":"c8000000-0000-4000-8000-000000000003","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Draft pick ownership is stale or invalid'
);
-- Non-transferable pick.
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"pick","asset_id":"c8000000-0000-4000-8000-000000000002","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000006","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Draft pick ownership is stale or invalid'
);
-- Wrong-owner pick.
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000008","from_team_id":"c1000000-0000-4000-8000-000000000001"},
    {"asset_type":"pick","asset_id":"c8000000-0000-4000-8000-000000000001","from_team_id":"c1000000-0000-4000-8000-000000000002"}]'::jsonb,
  'Draft pick ownership is stale or invalid'
);
RESET ROLE;

-- 8. Transactional rollback: valid player followed by invalid pick must revert the player transfer.
SET LOCAL ROLE authenticated;
SELECT expect_trade_failure(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000001","from_team_id":"c1000000-0000-4000-8000-000000000002"},
    {"asset_type":"pick","asset_id":"c8000000-0000-4000-8000-000000000002","from_team_id":"c1000000-0000-4000-8000-000000000001"}]'::jsonb,
  'Draft pick ownership is stale or invalid'
);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000001') = 'c1000000-0000-4000-8000-000000000002', 'player transfer rolled back';
END $$;

-- 9. Repeat trade uses current roster owner, not stale imported agreement team.
SET LOCAL ROLE authenticated;
SELECT execute_trade_transactional(
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000001","from_team_id":"c1000000-0000-4000-8000-000000000002"},
    {"asset_type":"player","asset_id":"c2000000-0000-4000-8000-000000000008","from_team_id":"c1000000-0000-4000-8000-000000000001"}]'::jsonb
);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000001') = 'c1000000-0000-4000-8000-000000000001', 'repeat trade returned player to current owner';
END $$;

-- 10. Security and signature: ensure function retains SECURITY DEFINER, search_path, grants, and locking behavior.
DO $$
DECLARE
  v_proc_oid OID;
  v_is_definer BOOLEAN;
  v_search_path TEXT[];
BEGIN
  SELECT p.oid, p.prosecdef, p.proconfig
  INTO v_proc_oid, v_is_definer, v_search_path
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'execute_trade_transactional';

  ASSERT v_is_definer = true, 'function is SECURITY DEFINER';
  ASSERT v_search_path @> ARRAY['search_path=pg_catalog, public'], 'search_path is constrained';
  ASSERT has_function_privilege('authenticated', v_proc_oid, 'EXECUTE'), 'authenticated retains execute grant';
  ASSERT NOT has_function_privilege('anon', v_proc_oid, 'EXECUTE'), 'anon execute grant remains revoked';
  ASSERT NOT EXISTS (
    SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = v_proc_oid)) a
    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
  ), 'PUBLIC execute grant remains revoked';
END $$;

-- 11. Effective salary accounting uses the current roster owner, not imported agreement team.
DO $$ BEGIN
  ASSERT (SELECT team_id FROM game_contract_agreements WHERE id='c4000000-0000-4000-8000-000000000001') = 'c1000000-0000-4000-8000-000000000001', 'agreement provenance team unchanged';
  ASSERT (SELECT team_id FROM game_player_states WHERE game_id='c3000000-0000-4000-8000-000000000001' AND player_id='c2000000-0000-4000-8000-000000000001') = 'c1000000-0000-4000-8000-000000000001', 'current roster owner differs from imported provenance after repeat trade';
END $$;

SELECT 'PASS: modern contract trade compatibility regression matrix' AS result;
ROLLBACK;
