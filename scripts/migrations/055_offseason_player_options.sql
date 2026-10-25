BEGIN;

CREATE TABLE public.game_offseason_player_options (
  game_id UUID NOT NULL,
  season_year INTEGER NOT NULL,
  player_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  current_salary BIGINT NOT NULL CHECK (current_salary >= 0),
  next_salary BIGINT NOT NULL CHECK (next_salary >= 0),
  decision TEXT NOT NULL CHECK (decision IN ('exercise','decline')),
  reason TEXT NOT NULL CHECK (reason IN ('salary_not_lower','salary_lower')),
  policy_version TEXT NOT NULL DEFAULT 'salary-comparison-v1' CHECK (policy_version='salary-comparison-v1'),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence JSONB NOT NULL,
  PRIMARY KEY (game_id,season_year,player_id),
  FOREIGN KEY (game_id,season_year,player_id) REFERENCES public.game_offseason_contracts ON DELETE CASCADE,
  CHECK ((next_salary >= current_salary AND decision='exercise' AND reason='salary_not_lower')
    OR (next_salary < current_salary AND decision='decline' AND reason='salary_lower'))
);
ALTER TABLE public.game_offseason_player_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY game_offseason_player_options_owner ON public.game_offseason_player_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id=game_id
    AND g.user_id=auth.uid() AND g.deleted_at IS NULL));
REVOKE ALL ON public.game_offseason_player_options FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.game_offseason_player_options TO authenticated;

CREATE FUNCTION public.resolve_offseason_player_options(p_game_id UUID,p_season_year INTEGER)
RETURNS SETOF public.game_offseason_player_options
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  -- Reuse authentication, game lock, entry checks and strict snapshot revalidation.
  -- Explicit resolution may prepare missing 054 rows, but never changes existing rows or team decisions.
  PERFORM public.prepare_offseason_contracts(p_game_id,p_season_year);
  WITH salaries AS (
    SELECT l.*,CASE
      WHEN l.evidence->'runtime'<>'null'::JSONB THEN (l.evidence->'runtime'->>'annual_salary')::BIGINT
      WHEN l.evidence->'identity'<>'null'::JSONB OR l.evidence->'agreement'<>'null'::JSONB THEN
        CASE WHEN c.matches=1 THEN c.salary END
      ELSE (l.evidence->'legacy'->>('salary_y'||(p_season_year+1-(l.evidence->'legacy'->>'start_year')::INTEGER)))::BIGINT
      END current_salary
    FROM public.game_offseason_contracts l
    CROSS JOIN LATERAL (
      SELECT count(*) matches,min((s->>'salary_amount')::BIGINT) salary
      FROM jsonb_array_elements(l.evidence->'seasons') s
      WHERE (s->>'start_year')::INTEGER=p_season_year
    ) c
    WHERE l.game_id=p_game_id AND l.season_year=p_season_year AND l.classification='player_option'
  )
  INSERT INTO public.game_offseason_player_options
    (game_id,season_year,player_id,team_id,current_salary,next_salary,decision,reason,evidence)
    SELECT game_id,season_year,player_id,team_id,current_salary,next_salary,
      CASE WHEN next_salary>=current_salary THEN 'exercise' ELSE 'decline' END,
      CASE WHEN next_salary>=current_salary THEN 'salary_not_lower' ELSE 'salary_lower' END,evidence
    FROM salaries WHERE current_salary>=0 AND next_salary>=0
    ON CONFLICT (game_id,season_year,player_id) DO NOTHING;
  RETURN QUERY SELECT * FROM public.game_offseason_player_options
    WHERE game_id=p_game_id AND season_year=p_season_year ORDER BY player_id;
END $$;
REVOKE ALL ON FUNCTION public.resolve_offseason_player_options(UUID,INTEGER) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.resolve_offseason_player_options(UUID,INTEGER) TO authenticated;

COMMIT;
