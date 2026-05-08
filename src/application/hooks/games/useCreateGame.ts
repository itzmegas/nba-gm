import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Game } from "@/domain/entities/Game";
import { GAME_STATUS } from "@/domain/entities/Game";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import { createClient } from "@/infrastructure/supabase/client";

interface CreateGameInput {
  name: string;
  selectedTeamId: string;
  seasonYear: number;
  currentDate: Date;
}

export function useCreateGame() {
  const queryClient = useQueryClient();

  return useMutation<Game, Error, CreateGameInput>({
    mutationFn: async (input) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      const repository = new SupabaseGameRepository(supabase);

      return repository.create({
        userId: user.id,
        name: input.name,
        selectedTeamId: input.selectedTeamId,
        seasonYear: input.seasonYear,
        currentDate: input.currentDate,
        status: GAME_STATUS.INITIALIZING,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}
