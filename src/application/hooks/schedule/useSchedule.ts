import { useQuery } from "@tanstack/react-query";
import { SupabaseScheduleRepository } from "@/infrastructure/repositories/SupabaseScheduleRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useSchedule(gameId: string) {
  return useQuery({
    queryKey: ["schedule", gameId],
    queryFn: () => new SupabaseScheduleRepository(createClient()).getByGameId(gameId),
    enabled: !!gameId,
  });
}
