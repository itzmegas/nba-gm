SET LOCAL ROLE anon;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM contracts)=0, 'anonymous contracts leaked';
  ASSERT (SELECT count(*) FROM teams)=0, 'anonymous teams leaked';
  ASSERT (SELECT count(*) FROM players)=0, 'anonymous players leaked';
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='b7000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  ASSERT (SELECT array_agg(id) FROM contracts)=ARRAY['b7400000-0000-4000-8000-000000000001'::uuid], 'wrong owner rows';
  ASSERT (SELECT count(*) FROM teams)=1, 'authenticated catalog unavailable';
  ASSERT (SELECT count(*) FROM players)=1, 'authenticated players unavailable';
  UPDATE contracts SET salary_y1=20 WHERE id='b7400000-0000-4000-8000-000000000002';
  ASSERT NOT FOUND, 'cross-owner update';
  DELETE FROM contracts WHERE id='b7400000-0000-4000-8000-000000000002';
  ASSERT NOT FOUND, 'cross-owner delete';
  BEGIN
    PERFORM initialize_game_schedule('b7300000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'cross-owner schedule';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Game not found or access denied' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM seed_game_pick_inventory('b7300000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'cross-owner picks';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Game not found or access denied' THEN RAISE; END IF;
  END;
END $$;
SET LOCAL request.jwt.claim.sub='b7000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  ASSERT (SELECT array_agg(id) FROM contracts)=ARRAY['b7400000-0000-4000-8000-000000000002'::uuid], 'second owner rows';
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.role='service_role';
SET LOCAL ROLE service_role;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM contracts)=2, 'service role reads';
  UPDATE contracts SET salary_y1=salary_y1+1;
  ASSERT (SELECT sum(salary_y1) FROM contracts)=1000002, 'service role updates';
END $$;
RESET ROLE;
