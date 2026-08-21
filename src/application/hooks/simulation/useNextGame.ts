import { useQuery } from "@tanstack/react-query";
import { SupabaseScheduleRepository } from "@/infrastructure/repositories/SupabaseScheduleRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useNextGame(gameId: string, teamId: string, simulationDate?: Date) {
  return useQuery({
    queryKey: ["schedule", "next", gameId, teamId, simulationDate?.toISOString()],
    queryFn: () =>
      simulationDate
        ? new SupabaseScheduleRepository(createClient()).getNextForTeam(
            gameId,
            teamId,
            simulationDate
          )
        : null,
    enabled: Boolean(gameId && teamId && simulationDate),
  });
}
