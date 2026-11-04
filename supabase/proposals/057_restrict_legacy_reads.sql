-- PROPOSAL ONLY. Not in migrations/; never register this as already applied.
-- Requires approval of the authenticated-only catalog / owner-scoped contract contract.
BEGIN;
DROP POLICY "Allow public read access to contracts" ON public.contracts;
DROP POLICY "Allow public read access to players" ON public.players;
DROP POLICY "Allow public read access to teams" ON public.teams;
-- Remove explicit grants; a PUBLIC-only revoke does not remove them.
REVOKE EXECUTE ON FUNCTION public.initialize_game_schedule(uuid),
 public.seed_game_data(uuid,uuid), public.seed_game_pick_inventory(uuid) FROM anon;
COMMIT;
