import { z } from "zod";
import type { TradePackage } from "@/domain/entities/Trade";
import { TRADE_ERROR, tradeCommandSchema } from "@/domain/trades/TradeCommand";

const responseSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true), tradeId: z.uuid() }),
  z.object({ success: z.literal(false), code: z.enum(TRADE_ERROR), error: z.string() }),
]);

export async function executeHttpTrade(
  gameId: string,
  packageA: TradePackage,
  packageB: TradePackage
) {
  try {
    const command = tradeCommandSchema.parse({
      teamAId: packageA.teamId,
      teamBId: packageB.teamId,
      assets: [packageA, packageB].flatMap((pack) =>
        pack.outgoingAssets.map((asset) => ({
          assetType: asset.type,
          assetId:
            asset.type === "pick" ? asset.pickId : (asset.contract?.playerId ?? asset.player?.id),
          fromTeamId: pack.teamId,
        }))
      ),
    });
    const response = await fetch(`/api/games/${z.uuid().parse(gameId)}/trades`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    const result = responseSchema.parse(await response.json());
    if (response.ok !== result.success) throw new Error("Invalid trade response");
    return result;
  } catch {
    // A lost response may follow a committed write; never automatically retry it.
    return {
      success: false as const,
      code: TRADE_ERROR.TRADE_FAILED,
      error: "Trade outcome could not be confirmed. Refresh history before retrying.",
    };
  }
}
