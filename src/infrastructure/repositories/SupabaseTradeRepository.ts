import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ExecutedTrade,
  executedTradeSchema,
  type TradeAsset,
  type TradePackage,
  tradeAssetInputSchema,
} from "@/domain/entities";
import type { TradeRepository } from "@/domain/repositories/TradeRepository";

interface TradeRow extends Record<string, unknown> {
  trade_asset_snapshots?: unknown;
}

export class SupabaseTradeRepository implements TradeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getHistory(gameId: string): Promise<ExecutedTrade[]> {
    const { data, error } = await this.client
      .from("executed_trades")
      .select("*, trade_asset_snapshots(*)")
      .eq("game_id", gameId)
      .order("executed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map((row) => this.mapToEntity(row as TradeRow));
  }

  async execute(
    gameId: string,
    teamAId: string,
    teamBId: string,
    packageA: TradePackage,
    packageB: TradePackage
  ): Promise<ExecutedTrade> {
    const assets = [
      ...this.mapAssets(packageA.outgoingAssets, packageA.teamId),
      ...this.mapAssets(packageB.outgoingAssets, packageB.teamId),
    ];
    const { data, error } = await this.client.rpc("execute_trade_transactional", {
      p_game_id: gameId,
      p_team_a_id: teamAId,
      p_team_b_id: teamBId,
      p_assets: assets,
    });
    if (error) throw new Error(error.message);
    const history = await this.getHistory(gameId);
    const trade = history.find(({ id }) => id === (data as string));
    if (!trade) throw new Error("Transactional trade completed without history");
    return trade;
  }

  private mapAssets(assets: TradeAsset[], fromTeamId: string) {
    return assets.map((asset) => {
      const assetId =
        asset.type === "player" ? (asset.contract?.playerId ?? asset.player?.id) : asset.pickId;
      const validated = tradeAssetInputSchema.parse({
        assetType: asset.type,
        assetId,
        fromTeamId,
      });
      return {
        asset_type: validated.assetType,
        asset_id: validated.assetId,
        from_team_id: validated.fromTeamId,
      };
    });
  }

  private mapToEntity(row: TradeRow): ExecutedTrade {
    const snapshots = Array.isArray(row.trade_asset_snapshots) ? row.trade_asset_snapshots : [];
    return executedTradeSchema.parse({
      id: row.id,
      gameId: row.game_id,
      teamAId: row.team_a_id,
      teamBId: row.team_b_id,
      executedAt: new Date(row.executed_at as string),
      assets: snapshots.map((snapshot) => {
        const value = snapshot as Record<string, unknown>;
        const metadata = (value.metadata ?? {}) as Record<string, unknown>;
        return {
          assetType: value.asset_type,
          assetId: value.asset_id,
          fromTeamId: value.from_team_id,
          toTeamId: value.to_team_id,
          playerId: metadata.player_id,
          pick: metadata.pick_id
            ? {
                id: metadata.pick_id,
                draftYear: metadata.draft_year,
                draftRound: metadata.draft_round,
                protection: metadata.protection ?? undefined,
                originalTeamId: metadata.original_team_id ?? value.from_team_id,
              }
            : undefined,
        };
      }),
    });
  }
}
