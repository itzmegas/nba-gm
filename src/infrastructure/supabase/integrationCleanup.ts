import type { SupabaseClient } from "@supabase/supabase-js";
import { TEST_FIXTURE } from "@/infrastructure/supabase/integrationSafety";

// Remove RESTRICT children before the roster and Auth/game cascade.
export async function cleanupTestGameRows(client: SupabaseClient, gameId: string) {
  for (const [table, column, ids] of [
    ["game_contract_seasons", "agreement_id", TEST_FIXTURE.agreementIds],
    ["game_contract_agreements", "id", TEST_FIXTURE.agreementIds],
    ["game_contract_identities", "player_id", TEST_FIXTURE.playerIds],
    ["game_player_states", "player_id", TEST_FIXTURE.playerIds],
  ] as const) {
    const deleted = await client
      .from(table)
      .delete()
      .eq("game_id", gameId)
      .in(column, [...ids]);
    if (deleted.error) throw new Error("Scoped game cleanup failed");
    const remaining = await client
      .from(table)
      .select("game_id", { head: true, count: "exact" })
      .eq("game_id", gameId);
    if (remaining.error || remaining.count !== 0)
      throw new Error("Scoped game cleanup verification failed");
  }
}
