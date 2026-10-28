BEGIN;

CREATE TABLE public.game_offseason_contracts (
  game_id UUID NOT NULL,
  season_year INTEGER NOT NULL,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  classification TEXT NOT NULL CHECK (classification IN ('expiring','team_option','player_option')),
  next_salary BIGINT,
  evidence JSONB NOT NULL,
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision TEXT CHECK (decision IN ('exercise','decline')),
  decided_at TIMESTAMPTZ,
  PRIMARY KEY (game_id,season_year,player_id),
  FOREIGN KEY (game_id,season_year) REFERENCES public.game_offseasons ON DELETE CASCADE,
  CHECK ((decision IS NULL) = (decided_at IS NULL)),
  CHECK (decision IS NULL OR classification='team_option')
);
ALTER TABLE public.game_offseason_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY game_offseason_contracts_owner ON public.game_offseason_contracts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id=game_id
    AND g.user_id=auth.uid() AND g.deleted_at IS NULL));
REVOKE ALL ON public.game_offseason_contracts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.game_offseason_contracts TO authenticated;

-- Private classifier: simulated agreements override canonical identities, which override legacy rows.
CREATE FUNCTION public.offseason_contract_evidence(p_game_id UUID,p_season_year INTEGER)
RETURNS TABLE(player_id UUID,team_id UUID,classification TEXT,next_salary BIGINT,evidence JSONB)
LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
WITH source AS (
  SELECT s.player_id,s.team_id,to_jsonb(r) runtime,to_jsonb(i) identity,
    to_jsonb(a) agreement,to_jsonb(c) legacy,
    (SELECT coalesce(jsonb_agg(to_jsonb(cs) ORDER BY cs.start_year,cs.id),'[]')
      FROM public.game_contract_seasons cs WHERE cs.agreement_id=a.id) seasons,
    n.option_kind,n.salary_amount,n.matches
  FROM public.games g JOIN public.game_player_states s ON s.game_id=g.id AND s.team_id=g.selected_team_id
  LEFT JOIN public.game_active_runtime_contracts r ON r.game_id=g.id AND r.player_id=s.player_id
  LEFT JOIN public.game_contract_identities i ON i.game_id=g.id AND i.player_id=s.player_id
  LEFT JOIN public.game_contract_agreements a ON a.game_id=g.id AND a.player_id=s.player_id
  LEFT JOIN public.contracts c ON c.game_id=g.id AND c.player_id=s.player_id
  LEFT JOIN LATERAL (SELECT min(cs.option_kind) option_kind,min(cs.salary_amount) salary_amount,count(*) matches
    FROM public.game_contract_seasons cs WHERE cs.agreement_id=a.id AND cs.start_year=p_season_year+1
      AND (cs.salary_amount IS NOT NULL OR cs.option_kind IN ('player','team'))) n ON true
  WHERE g.id=p_game_id
), terms AS (
 SELECT *,coalesce(runtime,CASE WHEN identity IS NULL AND agreement IS NULL THEN legacy END) term
 FROM source
), classified AS (
 SELECT *,CASE
 WHEN runtime IS NULL AND (identity IS NOT NULL OR agreement IS NOT NULL) THEN CASE
   WHEN identity IS NULL OR agreement IS NULL OR (identity->>'estimated')::BOOLEAN
     OR identity->>'resolution_status' NOT IN ('observed-standard','official-two-way')
     OR identity->>'provenance_quality'='estimated' OR agreement->>'provenance_quality'='estimated'
     OR (agreement->>'estimated')::BOOLEAN OR matches>1 THEN NULL
   WHEN left(agreement->>'end_season_label',4)::INTEGER<p_season_year
     OR (left(agreement->>'end_season_label',4)::INTEGER=p_season_year AND matches>0) THEN NULL
   WHEN matches=0 AND left(agreement->>'end_season_label',4)::INTEGER=p_season_year THEN 'expiring'
   WHEN option_kind='team' THEN 'team_option'
   WHEN option_kind='player' THEN 'player_option' END
 ELSE CASE
   WHEN term IS NULL OR (term->>'start_year')::INTEGER>p_season_year
     OR (runtime IS NULL AND legacy->>'team_id' IS DISTINCT FROM team_id::TEXT)
     OR (term->>'end_year')::INTEGER<p_season_year
     OR ((term->>'is_team_option')::BOOLEAN AND (term->>'is_player_option')::BOOLEAN) THEN NULL
   WHEN (term->>'end_year')::INTEGER=p_season_year THEN 'expiring'
   WHEN (term->>'end_year')::INTEGER=p_season_year+1 THEN CASE
     WHEN (term->>'is_team_option')::BOOLEAN THEN 'team_option'
     WHEN (term->>'is_player_option')::BOOLEAN THEN 'player_option' END END END kind
 FROM terms
)
SELECT player_id,team_id,kind,
 CASE WHEN kind='expiring' THEN NULL WHEN runtime IS NOT NULL THEN (runtime->>'annual_salary')::BIGINT
 WHEN identity IS NOT NULL OR agreement IS NOT NULL THEN salary_amount
 ELSE (legacy->>('salary_y'||(p_season_year+2-(legacy->>'start_year')::INTEGER)))::BIGINT END,
 jsonb_build_object('runtime',runtime,'identity',identity,'agreement',agreement,'legacy',legacy,'seasons',seasons)
FROM classified WHERE kind IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.offseason_contract_evidence(UUID,INTEGER) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.prepare_offseason_contracts(p_game_id UUID,p_season_year INTEGER)
RETURNS SETOF public.game_offseason_contracts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE g public.games%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO g FROM public.games WHERE id=p_game_id AND user_id=auth.uid()
    AND status='active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  IF p_season_year IS NULL OR g.season_year IS DISTINCT FROM p_season_year THEN RAISE EXCEPTION 'Season year does not match the current season'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_offseasons WHERE game_id=g.id AND season_year=p_season_year) THEN RAISE EXCEPTION 'Offseason entry required'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_offseason_contracts l
    LEFT JOIN public.offseason_contract_evidence(g.id,p_season_year) e USING(player_id)
    WHERE l.game_id=g.id AND l.season_year=p_season_year
      AND (e.player_id IS NULL OR l.team_id IS DISTINCT FROM e.team_id OR l.evidence IS DISTINCT FROM e.evidence)) THEN
    RAISE EXCEPTION 'Offseason contract evidence changed';
  END IF;
  INSERT INTO public.game_offseason_contracts(game_id,season_year,player_id,team_id,classification,next_salary,evidence)
    SELECT g.id,p_season_year,e.* FROM public.offseason_contract_evidence(g.id,p_season_year) e
    ON CONFLICT (game_id,season_year,player_id) DO NOTHING;
  RETURN QUERY SELECT * FROM public.game_offseason_contracts WHERE game_id=g.id AND season_year=p_season_year ORDER BY player_id;
END $$;

CREATE FUNCTION public.decide_offseason_team_option(p_game_id UUID,p_season_year INTEGER,p_player_id UUID,p_decision TEXT)
RETURNS public.game_offseason_contracts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE entry public.game_offseason_contracts%ROWTYPE;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('exercise','decline') THEN RAISE EXCEPTION 'Invalid team option decision'; END IF;
  -- Preparation also revalidates the complete immutable snapshot under the game lock.
  PERFORM public.prepare_offseason_contracts(p_game_id,p_season_year);
  SELECT * INTO entry FROM public.game_offseason_contracts WHERE game_id=p_game_id
    AND season_year=p_season_year AND player_id=p_player_id;
  IF NOT FOUND OR entry.classification<>'team_option' OR entry.next_salary IS NULL THEN RAISE EXCEPTION 'Known controlled-team option required'; END IF;
  IF entry.decision IS NOT NULL AND entry.decision<>p_decision THEN RAISE EXCEPTION 'Team option decision is immutable'; END IF;
  IF entry.decision IS NULL THEN
    UPDATE public.game_offseason_contracts SET decision=p_decision,decided_at=now()
      WHERE game_id=p_game_id AND season_year=p_season_year AND player_id=p_player_id RETURNING * INTO entry;
  END IF;
  RETURN entry;
END $$;
REVOKE ALL ON FUNCTION public.prepare_offseason_contracts(UUID,INTEGER) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.decide_offseason_team_option(UUID,INTEGER,UUID,TEXT) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.prepare_offseason_contracts(UUID,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_offseason_team_option(UUID,INTEGER,UUID,TEXT) TO authenticated;

COMMIT;
