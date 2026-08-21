import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Game } from "@/domain/entities/Game";
import { GAME_STATUS } from "@/domain/entities/Game";
import { SEASON_ERA_IDS, type SeasonEraId } from "@/domain/entities/SeasonEra";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import { createClient } from "@/infrastructure/supabase/client";

interface UseCreateGameInput {
  name: string;
  selectedTeamId: string;
  seasonYear: number;
  seasonEraId: SeasonEraId;
  simulationDate: Date;
}

async function refreshCurrentRoster(gameId: string, selectedTeamId: string): Promise<void> {
  const response = await fetch("/api/roster-refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, selectedTeamId }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Roster refresh failed");
  }
}

export function useCreateGame() {
  const queryClient = useQueryClient();

  return useMutation<Game, Error, UseCreateGameInput>({
    mutationFn: async (input) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      const repository = new SupabaseGameRepository(supabase);

      // 1. Create game with initializing status; it stays non-active until
      // refresh + seed + schedule succeed.
      const game = await repository.create({
        userId: user.id,
        name: input.name,
        selectedTeamId: input.selectedTeamId,
        seasonYear: input.seasonYear,
        seasonEraId: input.seasonEraId,
        simulationDate: input.simulationDate,
        status: GAME_STATUS.INITIALIZING,
      });

      try {
        // 2. Current-era games refresh the canonical roster before seeding.
        // Historical games make zero refresh calls and keep the existing path.
        if (input.seasonEraId === SEASON_ERA_IDS.MODERN) {
          await refreshCurrentRoster(game.id, input.selectedTeamId);
        }

        // 3. Seed game data (player states + contracts) via SQL function.
        // For modern games this runs only after a successful refresh.
        const { error: seedError } = await supabase.rpc("seed_game_data", {
          p_game_id: game.id,
          p_team_id: input.selectedTeamId,
        });

        if (seedError) {
          throw new Error(`Failed to seed game data: ${seedError.message}`);
        }

        const { error: scheduleError } = await supabase.rpc("initialize_game_schedule", {
          p_game_id: game.id,
        });

        if (scheduleError) {
          throw new Error(`Failed to initialize game schedule: ${scheduleError.message}`);
        }

        // 4. Activate the game after successful initialization.
        const activatedGame = await repository.update(game.id, {
          status: GAME_STATUS.ACTIVE,
        });

        return activatedGame;
      } catch (error) {
        // Any failure leaves the game non-active and cleans up the partial record.
        await repository.softDelete(game.id);
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}
