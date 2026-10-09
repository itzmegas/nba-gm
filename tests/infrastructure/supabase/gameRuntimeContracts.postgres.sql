INSERT INTO game_runtime_contracts(
  game_id, player_id, origin_kind, start_year, end_year, annual_salary
) VALUES
  ('40000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001', 'simulated-agreement', 2026, 2028, 8000000),
  ('40000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000001', 'simulated-agreement', 2026, 2027, 7000000);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM game_runtime_contracts) <> 1 THEN
    RAISE EXCEPTION 'Owner one must read only their runtime contract';
  END IF;
  IF (SELECT count(*) FROM game_runtime_contracts c JOIN game_player_states s
      ON s.game_id = c.game_id AND s.player_id = c.player_id
      WHERE c.game_id = '40000000-0000-4000-8000-000000000001'
        AND s.team_id = '20000000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'Runtime contract reads must resolve the player current team';
  END IF;
  IF (SELECT count(*) FROM game_runtime_contracts
      WHERE game_id = '40000000-0000-4000-8000-000000000002') <> 0 THEN
    RAISE EXCEPTION 'Owner one must not see owner two contract';
  END IF;
  BEGIN
    INSERT INTO game_runtime_contracts(
      game_id, player_id, origin_kind, start_year, end_year, annual_salary
    ) VALUES (
      '40000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'simulated-agreement', 2026, 2026, 9000000
    );
    RAISE EXCEPTION 'Authenticated INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE game_runtime_contracts SET annual_salary = 9000000;
    RAISE EXCEPTION 'Authenticated UPDATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM game_runtime_contracts;
    RAISE EXCEPTION 'Authenticated DELETE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$$;
RESET ROLE;

SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM game_runtime_contracts;
    RAISE EXCEPTION 'Anonymous SELECT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    INSERT INTO game_runtime_contracts(
      game_id, player_id, origin_kind, start_year, end_year, annual_salary
    ) VALUES (
      '40000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'simulated-agreement', 2026, 2026, 9000000
    );
    RAISE EXCEPTION 'Anonymous INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE game_runtime_contracts SET annual_salary = 9000000;
    RAISE EXCEPTION 'Anonymous UPDATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM game_runtime_contracts;
    RAISE EXCEPTION 'Anonymous DELETE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM game_runtime_contracts) <> 1 THEN
    RAISE EXCEPTION 'Owner two must read only their runtime contract';
  END IF;
  IF (SELECT count(*) FROM game_runtime_contracts
      WHERE game_id = '40000000-0000-4000-8000-000000000001') <> 0 THEN
    RAISE EXCEPTION 'Owner two must not read owner one contract';
  END IF;
  IF (SELECT count(*) FROM game_runtime_contracts
      WHERE game_id = '40000000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'Owner two must read their own game contract';
  END IF;
END
$$;
RESET ROLE;
