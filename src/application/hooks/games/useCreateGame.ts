import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Game } from "@/domain/entities/Game";
import { GAME_STATUS } from "@/domain/entities/Game";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import { createClient } from "@/infrastructure/supabase/client";

interface CreateGameInput {
  name: string;
  selectedTeamId: string;
  seasonYear: number;
  simulationDate: Date;
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

      // 1. Create game with initializing status
      const game = await repository.create({
        userId: user.id,
        name: input.name,
        selectedTeamId: input.selectedTeamId,
        seasonYear: input.seasonYear,
        simulationDate: input.simulationDate,
        status: GAME_STATUS.INITIALIZING,
      });

      // 2. Seed game data (player states + contracts) via SQL function
      const { error: seedError } = await supabase.rpc("seed_game_data", {
        p_game_id: game.id,
        p_team_id: input.selectedTeamId,
      });

      if (seedError) {
        // If seeding fails, soft-delete the game to avoid orphaned records
        await repository.softDelete(game.id);
        throw new Error(`Failed to seed game data: ${seedError.message}`);
      }

      // 3. Activate the game after successful seeding
      const activatedGame = await repository.update(game.id, {
        status: GAME_STATUS.ACTIVE,
      });

      return activatedGame;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}
