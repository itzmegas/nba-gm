-- Synthetic original-row preservation. New columns may be added, no old value may change.
DO $$ BEGIN
 ASSERT (SELECT name='Synthetic upgrade team' AND nba_id=-999002 FROM public.teams
 WHERE id='b1000000-0000-4000-8000-000000000002'), 'team preserved';
 ASSERT (SELECT full_name='Synthetic Player' AND nba_id=-999002 FROM public.players
 WHERE id='b2000000-0000-4000-8000-000000000002'), 'player preserved';
 ASSERT (SELECT salary_y1=1000000 AND start_year=2026 AND end_year=2027 AND game_id IS NULL
 FROM public.contracts WHERE id='b3000000-0000-4000-8000-000000000002'), 'legacy contract preserved';
END $$;
SET ROLE anon;
DO $$ BEGIN
 ASSERT (SELECT count(*)=1 FROM public.contracts WHERE id='b3000000-0000-4000-8000-000000000002'),
 'observed unrestricted legacy contract read (security correction remains separate)';
END $$;
RESET ROLE;
