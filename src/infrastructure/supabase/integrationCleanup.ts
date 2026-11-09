import type { SupabaseClient } from "@supabase/supabase-js";
import { TEST_FIXTURE } from "@/infrastructure/supabase/integrationSafety";

export async function cleanupTestTrade(client: SupabaseClient, gameId: string, tradeId: string) {
  const snapshots = await client
    .from("trade_asset_snapshots")
    .delete()
    .eq("executed_trade_id", tradeId);
  if (snapshots.error) throw new Error("Scoped trade cleanup failed");
  const snapshotCount = await client
    .from("trade_asset_snapshots")
    .select("id", { head: true, count: "exact" })
    .eq("executed_trade_id", tradeId);
  if (snapshotCount.error || snapshotCount.count !== 0)
    throw new Error("Scoped trade cleanup verification failed");
  const history = await client
    .from("executed_trades")
    .delete()
    .eq("game_id", gameId)
    .eq("id", tradeId);
  if (history.error) throw new Error("Scoped trade cleanup failed");
  const historyCount = await client
    .from("executed_trades")
    .select("id", { head: true, count: "exact" })
    .eq("game_id", gameId);
  if (historyCount.error || historyCount.count !== 0)
    throw new Error("Scoped trade cleanup verification failed");
}

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
