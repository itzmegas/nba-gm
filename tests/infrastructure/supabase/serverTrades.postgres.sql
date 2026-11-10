BEGIN;
CREATE FUNCTION pg_temp.trade_state() RETURNS TEXT LANGUAGE sql AS $$
 SELECT md5(jsonb_build_array(
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_pick_inventory t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_player_states t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM contracts t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_contract_agreements t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_contract_seasons t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_runtime_contracts t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM executed_trades t),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM trade_asset_snapshots t)
 )::TEXT)
$$;
CREATE FUNCTION pg_temp.reject_trade(assets JSONB, expected TEXT, legacy BOOLEAN DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE before_state TEXT := pg_temp.trade_state(); actual TEXT; diagnostic TEXT;
BEGIN
 BEGIN
  IF legacy THEN
   PERFORM execute_trade_transactional('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',assets);
  ELSE
   PERFORM execute_trade_authoritative('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',assets);
  END IF;
 EXCEPTION WHEN OTHERS THEN actual := SQLSTATE; diagnostic := SQLERRM; END;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Expected %, received % (%)', expected, actual, diagnostic; END IF;
 IF before_state IS DISTINCT FROM pg_temp.trade_state() THEN RAISE EXCEPTION 'Rejected trade mutated state'; END IF;
END $$;
CREATE FUNCTION pg_temp.assets(second_id TEXT DEFAULT 'a6000000-0000-4000-8000-000000000002', second_type TEXT DEFAULT 'pick')
RETURNS JSONB LANGUAGE sql AS $$ SELECT jsonb_build_array(
 jsonb_build_object('asset_type','pick','asset_id','a6000000-0000-4000-8000-000000000001','from_team_id','a1000000-0000-4000-8000-000000000001'),
 jsonb_build_object('asset_type',second_type,'asset_id',second_id,'from_team_id','a1000000-0000-4000-8000-000000000002')) $$;

SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
-- RED against the old chain; unknown hard-cap state must block every player transfer, including legacy RPC calls.
SELECT pg_temp.reject_trade(pg_temp.assets('a2000000-0000-4000-8000-000000000001','player'),'P2007');
SELECT pg_temp.reject_trade(pg_temp.assets('a2000000-0000-4000-8000-000000000001','player'),'P2007',true);
SELECT pg_temp.reject_trade(pg_temp.assets('a6000000-0000-4000-8000-000000000003'),'P2006');
SELECT pg_temp.reject_trade(pg_temp.assets('a6000000-0000-4000-8000-000000000099'),'P2006');
SELECT pg_temp.reject_trade(NULL,'P2001');
SELECT pg_temp.reject_trade('{}','P2001');
SELECT pg_temp.reject_trade('[null,1]','P2001');
SELECT pg_temp.reject_trade(pg_temp.assets() || jsonb_build_array(pg_temp.assets()->0),'P2001');
SELECT pg_temp.reject_trade(jsonb_set(pg_temp.assets(),'{1,asset_id}','"invalid"'),'P2001');
SELECT pg_temp.reject_trade(jsonb_set(pg_temp.assets(),'{1,from_team_id}','null'),'P2001');
SELECT pg_temp.reject_trade(jsonb_set(pg_temp.assets(),'{1,salary}','0'),'P2001');
SELECT pg_temp.reject_trade(jsonb_set(pg_temp.assets(),'{1,from_team_id}','"a1000000-0000-4000-8000-000000000003"'),'P2001');
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
SELECT pg_temp.reject_trade(pg_temp.assets(),'P2003');
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
UPDATE games SET status='archived';
SELECT pg_temp.reject_trade(pg_temp.assets(),'P2004');
UPDATE games SET status='active';

DO $$ BEGIN
 IF has_function_privilege('anon','execute_trade_authoritative(uuid,uuid,uuid,jsonb)','execute')
   OR has_function_privilege('service_role','execute_trade_authoritative(uuid,uuid,uuid,jsonb)','execute') THEN
   RAISE EXCEPTION 'Unexpected RPC permission'; END IF;
END $$;
-- Allowed authenticated RPC calls only; do not reproduce the denied-RPC runtime crash.
SET LOCAL ROLE authenticated;
SELECT execute_trade_authoritative('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',pg_temp.assets());
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM executed_trades) <> 1 OR (SELECT count(*) FROM trade_asset_snapshots) <> 2 THEN
   RAISE EXCEPTION 'Trade/history cardinality mismatch'; END IF;
 IF (SELECT owner_team_id FROM game_pick_inventory WHERE id='a6000000-0000-4000-8000-000000000001') <> 'a1000000-0000-4000-8000-000000000002'::UUID
   OR (SELECT owner_team_id FROM game_pick_inventory WHERE id='a6000000-0000-4000-8000-000000000002') <> 'a1000000-0000-4000-8000-000000000001'::UUID THEN
   RAISE EXCEPTION 'Pick transfer mismatch'; END IF;
 IF (SELECT team_id FROM game_player_states WHERE player_id='a2000000-0000-4000-8000-000000000001') <> 'a1000000-0000-4000-8000-000000000002'::UUID
   OR (SELECT salary_amount FROM game_contract_seasons LIMIT 1) <> 1000000 THEN
   RAISE EXCEPTION 'Pick trade changed roster or canonical terms'; END IF;
END $$;
SELECT pg_temp.reject_trade(pg_temp.assets(),'P2006');
ROLLBACK;
