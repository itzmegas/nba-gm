BEGIN;

CREATE TABLE public.game_offseasons (
  game_id UUID NOT NULL,
  season_year INTEGER NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, season_year),
  FOREIGN KEY (game_id, season_year)
    REFERENCES public.postseason_results(game_id, season_year) ON DELETE CASCADE
);
ALTER TABLE public.game_offseasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY game_offseasons_owner ON public.game_offseasons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g
    WHERE g.id = game_id AND g.user_id = auth.uid() AND g.deleted_at IS NULL));
REVOKE ALL ON public.game_offseasons FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.game_offseasons TO authenticated;

CREATE FUNCTION public.enter_offseason(p_game_id UUID, p_season_year INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; entry public.game_offseasons%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  IF p_season_year IS NULL OR g.season_year IS DISTINCT FROM p_season_year THEN
    RAISE EXCEPTION 'Season year does not match the current season';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.postseason_results p
    WHERE p.game_id = g.id AND p.season_year = g.season_year) THEN
    RAISE EXCEPTION 'Completed championship required';
  END IF;
  INSERT INTO public.game_offseasons(game_id, season_year) VALUES (g.id, g.season_year)
    ON CONFLICT (game_id, season_year) DO NOTHING;
  SELECT * INTO STRICT entry FROM public.game_offseasons
    WHERE game_id = g.id AND season_year = g.season_year;
  RETURN jsonb_build_object('seasonYear', entry.season_year, 'enteredAt', entry.entered_at);
END;
$$;
REVOKE ALL ON FUNCTION public.enter_offseason(UUID, INTEGER) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enter_offseason(UUID, INTEGER) TO authenticated;

COMMIT;
