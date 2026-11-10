import { z } from "zod";
import {
  TRADE_ERROR,
  TradeOperationError,
  type TradeTransaction,
  tradeCommandSchema,
} from "@/domain/trades/TradeCommand";

export async function executeServerTrade(
  gameId: string,
  body: unknown,
  transaction: TradeTransaction
): Promise<{ tradeId: string }> {
  const command = tradeCommandSchema.safeParse(body);
  if (!z.uuid().safeParse(gameId).success || !command.success) {
    throw new TradeOperationError(TRADE_ERROR.INVALID_REQUEST);
  }
  return { tradeId: await transaction.execute(gameId, command.data) };
}
