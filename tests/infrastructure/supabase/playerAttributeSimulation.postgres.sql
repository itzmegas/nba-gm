BEGIN;

INSERT INTO auth.users(id) VALUES ('90000000-0000-4000-8000-000000000001');
INSERT INTO public.teams(id, nba_id, name, city, abbreviation, base_rating) VALUES
  ('91000000-0000-4000-8000-000000000001', 901, 'Attribute Home', 'Attribute', 'ATH', 75),
  ('91000000-0000-4000-8000-000000000002', 902, 'Attribute Away', 'Attribute', 'ATA', 75);
INSERT INTO public.players(id, first_name, last_name, full_name, position, is_active) VALUES
  ('92000000-0000-4000-8000-000000000001', 'Home', 'One', 'Home One', 'G', true),
  ('92000000-0000-4000-8000-000000000002', 'Home', 'Two', 'Home Two', 'C', true),
  ('92000000-0000-4000-8000-000000000003', 'Away', 'One', 'Away One', 'G', true),
  ('92000000-0000-4000-8000-000000000004', 'Away', 'Two', 'Away Two', 'C', true);
INSERT INTO public.games(id, user_id, name, selected_team_id, season_year, season_era_id,
  simulation_date, status, deleted_at) VALUES
  ('93000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
    'Attribute simulation', '91000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-01', 'initializing', NULL),
  ('93000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
    'Legacy simulation', '91000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-01', 'initializing', NULL);
INSERT INTO public.game_player_states(game_id, player_id, team_id, is_active, is_injured) VALUES
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', true, false),
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', true, false),
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000002', true, false),
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000002', true, false),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', true, false),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', true, false),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000002', true, false),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000002', true, false);
INSERT INTO public.game_contract_materializations(game_id, source, season, source_version_ids) VALUES
  ('93000000-0000-4000-8000-000000000001', 'test', '2026-27', array_fill(gen_random_uuid(), ARRAY[30])),
  ('93000000-0000-4000-8000-000000000002', 'test', '2026-27', array_fill(gen_random_uuid(), ARRAY[30]));
UPDATE public.games SET status = 'active'
  WHERE id IN ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002');
INSERT INTO public.scheduled_games(game_id, game_date, home_team_id, away_team_id) VALUES
  ('93000000-0000-4000-8000-000000000001', '2026-10-02', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002'),
  ('93000000-0000-4000-8000-000000000002', '2026-10-02', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002');
INSERT INTO public.league_standings(game_id, team_id) VALUES
  ('93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002'),
  ('93000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002');

DO $$
DECLARE
  source_version UUID;
  refreshed_version UUID;
  high_attrs JSONB := jsonb_build_object(
    'closeShot',99,'midRangeShot',99,'threePointShot',99,'freeThrow',99,'drawFoul',99,
    'ballHandle',99,'passAccuracy',99,'interiorDefense',99,'perimeterDefense',99,
    'steal',99,'block',99,'offensiveRebound',99,'defensiveRebound',99,'stamina',99);
  low_attrs JSONB := jsonb_build_object(
    'closeShot',0,'midRangeShot',0,'threePointShot',0,'freeThrow',0,'drawFoul',0,
    'ballHandle',0,'passAccuracy',0,'interiorDefense',0,'perimeterDefense',0,
    'steal',0,'block',0,'offensiveRebound',0,'defensiveRebound',0,'stamina',0);
  home_rating INTEGER;
  away_rating INTEGER;
  v_seed BIGINT;
  expected_home SMALLINT;
  expected_away SMALLINT;
  actual_home SMALLINT;
  actual_away SMALLINT;
  initial_home SMALLINT;
  initial_away SMALLINT;
BEGIN
  INSERT INTO public.player_rating_source_versions(game_version, content_hash, payload)
    VALUES ('2K27', repeat('e',64), '{}') RETURNING id INTO source_version;
  INSERT INTO public.game_attribute_materializations(game_id, season_year, source_version_id, player_count)
    VALUES ('93000000-0000-4000-8000-000000000001', 2026, source_version, 4);
  INSERT INTO public.game_player_attributes(game_id, season_year, player_id, origin, match_method,
    attributes, generator_version, identity_evidence) VALUES
    ('93000000-0000-4000-8000-000000000001',2026,'92000000-0000-4000-8000-000000000001','estimated','missing-source',high_attrs,'replacement-v1','{}'),
    ('93000000-0000-4000-8000-000000000001',2026,'92000000-0000-4000-8000-000000000002','estimated','missing-source',high_attrs,'replacement-v1','{}'),
    ('93000000-0000-4000-8000-000000000001',2026,'92000000-0000-4000-8000-000000000003','estimated','missing-source',low_attrs,'replacement-v1','{}'),
    ('93000000-0000-4000-8000-000000000001',2026,'92000000-0000-4000-8000-000000000004','estimated','missing-source',low_attrs,'replacement-v1','{}');
  INSERT INTO public.player_rating_source_versions(game_version, content_hash, payload)
    VALUES ('2K27', repeat('1',64), '{"externalRefresh":"newer edition"}')
    RETURNING id INTO refreshed_version;
  INSERT INTO public.player_rating_source_cache(game_version, version_id, revalidated_at,
    next_refresh_at) VALUES ('2K27', refreshed_version, now(), now() + interval '24 hours')
    ON CONFLICT (game_version) DO UPDATE SET version_id=EXCLUDED.version_id,
      revalidated_at=EXCLUDED.revalidated_at,next_refresh_at=EXCLUDED.next_refresh_at;
  ASSERT (SELECT source_version_id=source_version FROM public.game_attribute_materializations
    WHERE game_id='93000000-0000-4000-8000-000000000001' AND season_year=2026);
  ASSERT (SELECT attributes=high_attrs FROM public.game_player_attributes
    WHERE game_id='93000000-0000-4000-8000-000000000001'
      AND player_id='92000000-0000-4000-8000-000000000001'), 'Source refresh does not rewrite career copy';

  PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  home_rating := public.get_simulation_team_rating('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001');
  away_rating := public.get_simulation_team_rating('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002');
  ASSERT home_rating = 63 AND away_rating = 43, 'Current player attributes alter team ratings around baseline60';
  ASSERT public.get_simulation_team_rating('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001') = 55,
    'Legacy modern games without snapshots retain the roster-count formula';

  v_seed := ('x' || substr(md5('93000000-0000-4000-8000-000000000001:2026-10-02:91000000-0000-4000-8000-000000000001:91000000-0000-4000-8000-000000000002'),1,8))::bit(32)::bigint;
  expected_home := greatest(70,round(105+(home_rating+3-75)*0.55+(mod(abs(v_seed),2400)/100.0-12)));
  expected_away := greatest(70,round(105+(away_rating-75)*0.55+(mod(abs(v_seed/2400),2400)/100.0-12)));
  IF expected_home = expected_away THEN expected_away := expected_away-1; END IF;
  SELECT home_score,away_score INTO actual_home,actual_away FROM public.advance_simulation_day(
    '93000000-0000-4000-8000-000000000001','2026-10-01');
  ASSERT (actual_home,actual_away) = (expected_home,expected_away), 'Daily SQL uses individual attribute strength';
  SELECT home_score,away_score INTO initial_home,initial_away FROM public.scheduled_games
    WHERE game_id='93000000-0000-4000-8000-000000000001';

  UPDATE public.game_player_attributes SET attributes=low_attrs
    WHERE game_id='93000000-0000-4000-8000-000000000001'
      AND player_id IN ('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002');
  PERFORM * FROM public.advance_simulation_day('93000000-0000-4000-8000-000000000001','2026-10-02');
  ASSERT (SELECT (home_score,away_score)=(initial_home,initial_away) FROM public.scheduled_games
    WHERE game_id='93000000-0000-4000-8000-000000000001'), 'Completed results are never recalculated';
  DELETE FROM public.game_player_attributes
    WHERE game_id='93000000-0000-4000-8000-000000000001'
      AND player_id='92000000-0000-4000-8000-000000000001';
  ASSERT public.get_simulation_team_rating('93000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001')=55,
    'Partial player coverage falls back to the established roster strength';

END;
$$;

ROLLBACK;
