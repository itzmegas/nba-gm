BEGIN;

-- Legacy imports left these NULL; the UI fallback never persisted its conference map.
UPDATE public.teams AS team
SET conference = canonical.conference
FROM (VALUES
  ('East', ARRAY['ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS']),
  ('West', ARRAY['DAL','DEN','GSW','HOU','LAC','LAL','MEM','MIN','NOP','OKC','PHX','POR','SAC','SAS','UTA'])
) AS canonical(conference, abbreviations)
WHERE team.abbreviation = ANY(canonical.abbreviations)
  AND nullif(btrim(team.conference), '') IS NULL;

COMMIT;
