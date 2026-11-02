-- Synthetic-only tests of observed deployed behavior, including known security drift.
BEGIN;
SELECT plan(12);
SELECT is((SELECT count(*)::integer FROM pg_tables WHERE schemaname='public'),42,'42 application tables');
SELECT is((SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d
 WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')),55,'55 application functions');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname='public'),47,'47 deployed policies');
SELECT ok(NOT (SELECT attnotnull FROM pg_attribute WHERE attrelid='public.contracts'::regclass
 AND attname='game_id'),'observed game_id remains nullable');
SELECT ok(to_regclass('public.idx_scheduled_games_team') IS NOT NULL,'legacy schedule index retained');
SELECT ok(has_function_privilege('anon','public.seed_game_data(uuid,uuid)','EXECUTE'),'observed anon seed helper access retained');
SELECT ok(has_function_privilege('anon','public.initialize_game_schedule(uuid)','EXECUTE'),'observed anon schedule helper access retained');
SELECT ok(has_function_privilege('anon','public.seed_game_pick_inventory(uuid)','EXECUTE'),'observed anon inventory helper access retained');
SELECT ok(NOT has_function_privilege('anon','public.advance_simulation_day(uuid,date)','EXECUTE'),'core simulation RPC stays protected');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity),'all tables retain RLS');
INSERT INTO public.teams(id,nba_id,name,city,abbreviation)
 VALUES ('b1000000-0000-4000-8000-000000000001',-999001,'Synthetic baseline team','Test','TST');
SET LOCAL ROLE anon;
SELECT is((SELECT name FROM public.teams WHERE nba_id=-999001),'Synthetic baseline team','observed public team read works');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM supabase_migrations.schema_migrations),3,'exact three-migration local chain');
SELECT * FROM finish();
ROLLBACK;
