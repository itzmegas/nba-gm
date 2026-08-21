-- Migration 003: Enforce contracts.game_id NOT NULL
--
-- Purpose:
--   Move to strict game-scoped contracts once all contracts have been assigned
--   a `game_id`.
--
-- IMPORTANT:
--   Run this ONLY after confirming all contracts rows are game-scoped.
--   This script includes a safety check and aborts if NULL values exist.
--
-- Rollback:
--   ALTER TABLE contracts ALTER COLUMN game_id DROP NOT NULL;

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM contracts
    WHERE game_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Migration 003 aborted: contracts.game_id contains NULL values. Run Phase 2 seeding/backfill first.';
  END IF;
END
$$;

ALTER TABLE contracts
  ALTER COLUMN game_id SET NOT NULL;

COMMIT;

-- Rollback (manual):
-- BEGIN;
-- ALTER TABLE contracts
--   ALTER COLUMN game_id DROP NOT NULL;
-- COMMIT;
