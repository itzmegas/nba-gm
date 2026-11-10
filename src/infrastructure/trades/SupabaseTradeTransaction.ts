import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  TRADE_ERROR,
  type TradeCommand,
  type TradeErrorCode,
  TradeOperationError,
  type TradeTransaction,
} from "@/domain/trades/TradeCommand";

const databaseErrors: Record<string, TradeErrorCode> = {
  P2001: TRADE_ERROR.INVALID_REQUEST,
  P2002: TRADE_ERROR.UNAUTHORIZED,
  P2003: TRADE_ERROR.GAME_NOT_FOUND,
  P2004: TRADE_ERROR.GAME_NOT_ACTIVE,
  P2005: TRADE_ERROR.INVALID_TEAMS,
  P2006: TRADE_ERROR.STALE_ASSET,
  P2007: TRADE_ERROR.HARD_CAP_UNKNOWN,
  "42501": TRADE_ERROR.TRADE_UNAVAILABLE,
  "42883": TRADE_ERROR.TRADE_UNAVAILABLE,
  PGRST202: TRADE_ERROR.TRADE_UNAVAILABLE,
};

export class SupabaseTradeTransaction implements TradeTransaction {
  constructor(private readonly client: SupabaseClient) {}

  async execute(gameId: string, command: TradeCommand): Promise<string> {
    const { data, error } = await this.client.rpc("execute_trade_authoritative", {
      p_game_id: gameId,
      p_team_a_id: command.teamAId,
      p_team_b_id: command.teamBId,
      p_assets: command.assets.map(({ assetType, assetId, fromTeamId }) => ({
        asset_type: assetType,
        asset_id: assetId,
        from_team_id: fromTeamId,
      })),
    });
    if (error)
      throw new TradeOperationError(databaseErrors[error.code] ?? TRADE_ERROR.TRADE_FAILED);
    const result = z.uuid().safeParse(data);
    if (!result.success) throw new TradeOperationError(TRADE_ERROR.TRADE_FAILED);
    return result.data;
  }
}
