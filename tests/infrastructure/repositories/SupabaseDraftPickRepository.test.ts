import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseDraftPickRepository } from "@/infrastructure/repositories/SupabaseDraftPickRepository";

const IDS = {
  game: "22222222-2222-4222-8222-222222222222",
  inventory: "77777777-7777-4777-8777-777777777777",
  pick: "66666666-6666-4666-8666-666666666666",
  team: "33333333-3333-4333-8333-333333333333",
} as const;

describe("SupabaseDraftPickRepository", () => {
  it("maps nullable protection to an unprotected domain pick", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable thenables
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve(
          resolve({
            data: [
              {
                id: IDS.inventory,
                game_id: IDS.game,
                draft_pick_id: IDS.pick,
                owner_team_id: IDS.team,
                is_transferable: true,
                draft_picks: {
                  id: IDS.pick,
                  draft_year: 2027,
                  draft_round: 1,
                  protection: null,
                  original_team_id: IDS.team,
                },
              },
            ],
            error: null,
          })
        ),
    };
    const client = { from: () => query } as unknown as SupabaseClient;

    const [inventory] = await new SupabaseDraftPickRepository(client).getByGameId(IDS.game);

    expect(inventory.pick.protection).toBeUndefined();
  });
});
