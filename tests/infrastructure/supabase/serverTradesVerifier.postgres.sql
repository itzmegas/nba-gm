-- Independent verifier probes retained as regression tests; no history dependency.
BEGIN;
CREATE FUNCTION pg_temp.fingerprint() RETURNS text LANGUAGE sql AS $$
 SELECT md5(jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM games t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_pick_inventory t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM executed_trades t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM trade_asset_snapshots t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_player_states t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM contracts t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_runtime_contracts t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_contract_agreements t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM game_contract_seasons t))::text)
$$;
CREATE FUNCTION pg_temp.check_rpc(fn text, assets jsonb, expected text, message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE before_hash text := pg_temp.fingerprint(); code text; detail text;
BEGIN
 BEGIN
 EXECUTE format('SELECT public.%I($1,$2,$3,$4)', fn) USING
 'a3000000-0000-4000-8000-000000000001'::uuid,
 'a1000000-0000-4000-8000-000000000001'::uuid,
 'a1000000-0000-4000-8000-000000000002'::uuid, assets;
 EXCEPTION WHEN OTHERS THEN code := SQLSTATE; detail := SQLERRM; END;
 IF code IS DISTINCT FROM expected OR detail IS DISTINCT FROM message THEN
 RAISE EXCEPTION 'Expected %/%, received %/%', expected, message, code, detail; END IF;
 IF before_hash IS DISTINCT FROM pg_temp.fingerprint() THEN RAISE EXCEPTION 'Rejected RPC changed state'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $$
DECLARE fn text; a jsonb := '[{"asset_type":"pick","asset_id":"a6000000-0000-4000-8000-000000000001","from_team_id":"a1000000-0000-4000-8000-000000000001"},{"asset_type":"pick","asset_id":"a6000000-0000-4000-8000-000000000002","from_team_id":"a1000000-0000-4000-8000-000000000002"}]'; x jsonb;
BEGIN
 FOREACH fn IN ARRAY ARRAY['execute_trade_authoritative','execute_trade_transactional'] LOOP
  FOREACH x IN ARRAY ARRAY['[]'::jsonb, '[{},{}]'::jsonb, a || (a->0), jsonb_set(a,'{1,asset_id}','"bad"'), jsonb_set(a,'{0,user_id}','"forged"')] LOOP
   PERFORM pg_temp.check_rpc(fn,x,'P2001','INVALID_REQUEST');
  END LOOP;
  PERFORM pg_temp.check_rpc(fn,jsonb_set(a,'{1,asset_type}','"player"'),'P2007','HARD_CAP_UNKNOWN');
  PERFORM pg_temp.check_rpc(fn,jsonb_set(a,'{1,asset_id}','"a6000000-0000-4000-8000-000000000003"'),'P2006','STALE_ASSET');
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM pg_temp.check_rpc(fn,a,'P2002','UNAUTHORIZED');
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
  PERFORM pg_temp.check_rpc(fn,a,'P2003','GAME_NOT_FOUND');
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
 END LOOP;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','execute_trade_transactional(uuid,uuid,uuid,jsonb)','EXECUTE') OR has_function_privilege('service_role','execute_trade_transactional(uuid,uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Compatibility RPC ACL leaked'; END IF;
END $$;
ROLLBACK;
