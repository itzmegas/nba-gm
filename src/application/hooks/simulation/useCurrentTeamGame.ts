import { useQuery } from "@tanstack/react-query";
import { SupabaseScheduleRepository } from "@/infrastructure/repositories/SupabaseScheduleRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useCurrentTeamGame(gameId: string, teamId: string, simulationDate: Date) {
  const date = simulationDate.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["schedule", "current", gameId, teamId, date],
    queryFn: () =>
      new SupabaseScheduleRepository(createClient()).getForTeamOnDate(
        gameId,
        teamId,
        simulationDate
      ),
    enabled: Boolean(gameId && teamId),
  });
}
