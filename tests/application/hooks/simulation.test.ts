import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { useAdvanceDay } from "@/application/hooks/simulation/useAdvanceDay";

const rpc = vi.fn(async () => ({ data: [{ new_date: "2026-10-15" }], error: null }));
const client = { rpc } as unknown as SupabaseClient;

vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => client }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (options: {
    mutationFn: (input: { gameId: string; simulationDate: Date }) => Promise<unknown>;
  }) => ({ mutateAsync: options.mutationFn }),
}));

describe("useAdvanceDay", () => {
  it("sends the current simulation date as the RPC idempotency guard", async () => {
    await useAdvanceDay().mutateAsync({
      gameId: "11111111-1111-4111-8111-111111111111",
      simulationDate: new Date("2026-10-14T00:00:00.000Z"),
    });

    expect(rpc).toHaveBeenCalledWith("advance_simulation_day", {
      p_game_id: "11111111-1111-4111-8111-111111111111",
      p_expected_date: "2026-10-14",
    });
  });
});
