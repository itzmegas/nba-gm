BEGIN;

CREATE OR REPLACE FUNCTION guard_game_player_state_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Allow existing game-delete cascades, but never direct roster removal.
    IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Direct roster deletion is not permitted';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Direct roster insertion is not permitted';
  END IF;

  IF (NEW.game_id, NEW.player_id, NEW.team_id, NEW.is_active)
     IS DISTINCT FROM (OLD.game_id, OLD.player_id, OLD.team_id, OLD.is_active) THEN
    RAISE EXCEPTION 'Roster identity, ownership, and eligibility are authoritative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_player_states_write_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON game_player_states
  FOR EACH ROW EXECUTE FUNCTION guard_game_player_state_writes();
REVOKE ALL ON FUNCTION guard_game_player_state_writes() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION guard_legacy_contract_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Legacy contract identity and salary are authoritative';
END;
$$;

CREATE TRIGGER contracts_write_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON contracts
  FOR EACH ROW EXECUTE FUNCTION guard_legacy_contract_writes();
REVOKE ALL ON FUNCTION guard_legacy_contract_writes() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION guard_game_clock_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.selected_team_id IS DISTINCT FROM OLD.selected_team_id
    OR NEW.season_year IS DISTINCT FROM OLD.season_year
    OR NEW.season_era_id IS DISTINCT FROM OLD.season_era_id
    OR NEW.simulation_date IS DISTINCT FROM OLD.simulation_date
    OR (NEW.status = 'initializing' AND OLD.status <> 'initializing')
  ) THEN
    RAISE EXCEPTION 'Game ownership, identity, and simulation clock are authoritative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER games_write_integrity
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION guard_game_clock_writes();
REVOKE ALL ON FUNCTION guard_game_clock_writes() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
