BEGIN;

CREATE FUNCTION public.is_valid_player_attributes(p_attributes JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  attribute TEXT;
BEGIN
  IF jsonb_typeof(p_attributes) <> 'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_attributes)) <> 14 THEN RETURN false; END IF;
  FOREACH attribute IN ARRAY ARRAY[
    'closeShot', 'midRangeShot', 'threePointShot', 'freeThrow', 'drawFoul', 'ballHandle',
    'passAccuracy', 'interiorDefense', 'perimeterDefense', 'steal', 'block',
    'offensiveRebound', 'defensiveRebound', 'stamina'
  ] LOOP
    IF NOT (p_attributes ? attribute)
       OR jsonb_typeof(p_attributes->attribute) <> 'number'
       OR p_attributes->>attribute !~ '^[0-9]+$' THEN RETURN false; END IF;
    IF (p_attributes->>attribute)::NUMERIC NOT BETWEEN 0 AND 99 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.is_valid_player_attributes(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.game_attribute_materializations (
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL CHECK (season_year BETWEEN 1900 AND 3000),
  source_version_id UUID NOT NULL REFERENCES public.player_rating_source_versions(id),
  player_count INTEGER NOT NULL CHECK (player_count BETWEEN 1 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, season_year)
);

CREATE TABLE public.game_player_attributes (
  game_id UUID NOT NULL,
  season_year INTEGER NOT NULL,
  player_id UUID NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('nba2kapi', 'estimated')),
  match_method TEXT NOT NULL,
  attributes JSONB NOT NULL CHECK (public.is_valid_player_attributes(attributes)),
  source_slug TEXT,
  source_overall SMALLINT CHECK (source_overall BETWEEN 0 AND 99),
  generator_version TEXT,
  identity_evidence JSONB NOT NULL CHECK (jsonb_typeof(identity_evidence) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, season_year, player_id),
  UNIQUE (game_id, season_year, source_slug),
  FOREIGN KEY (game_id, season_year)
    REFERENCES public.game_attribute_materializations(game_id, season_year) ON DELETE CASCADE,
  FOREIGN KEY (game_id, player_id)
    REFERENCES public.game_player_states(game_id, player_id) ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (origin = 'nba2kapi' AND NULLIF(trim(source_slug), '') IS NOT NULL
      AND source_overall IS NOT NULL AND generator_version IS NULL
      AND match_method IN ('name-and-team', 'name-and-height', 'reviewed-espn-alias'))
    OR
    (origin = 'estimated' AND source_slug IS NULL AND source_overall IS NULL
      AND generator_version IS NOT DISTINCT FROM 'replacement-v1'
      AND match_method IN ('missing-source', 'incomplete-attributes', 'ambiguous-identity', 'uncorroborated-identity'))
  )
);

ALTER TABLE public.game_attribute_materializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_player_attributes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_attribute_materializations, public.game_player_attributes
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.game_attribute_materializations, public.game_player_attributes
  TO authenticated, service_role;
CREATE POLICY game_attribute_materializations_owner_read ON public.game_attribute_materializations
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid()
      AND g.deleted_at IS NULL
  ));
CREATE POLICY game_player_attributes_owner_read ON public.game_player_attributes
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid()
      AND g.deleted_at IS NULL
  ));

COMMIT;
