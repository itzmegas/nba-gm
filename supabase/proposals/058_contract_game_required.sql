-- PROPOSAL ONLY. Not in migrations/; no cleanup, deletion, or invented game ownership.
-- Recheck NULL count and lock impact in an approved maintenance window first.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.contracts WHERE game_id IS NULL) THEN
   RAISE EXCEPTION 'Contracts with NULL game_id require an explicitly approved disposition';
 END IF;
END $$;
ALTER TABLE public.contracts ALTER COLUMN game_id SET NOT NULL;
COMMIT;
