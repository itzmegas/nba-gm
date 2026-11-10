import { z } from "zod";

export const TRADE_ERROR = {
  INVALID_REQUEST: "INVALID_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN_ORIGIN: "FORBIDDEN_ORIGIN",
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  GAME_NOT_ACTIVE: "GAME_NOT_ACTIVE",
  INVALID_TEAMS: "INVALID_TEAMS",
  STALE_ASSET: "STALE_ASSET",
  HARD_CAP_UNKNOWN: "HARD_CAP_UNKNOWN",
  TRADE_UNAVAILABLE: "TRADE_UNAVAILABLE",
  TRADE_FAILED: "TRADE_FAILED",
} as const;
export type TradeErrorCode = (typeof TRADE_ERROR)[keyof typeof TRADE_ERROR];

export const tradeCommandSchema = z
  .strictObject({
    teamAId: z.uuid(),
    teamBId: z.uuid(),
    assets: z
      .array(
        z.strictObject({
          assetType: z.enum(["player", "pick"]),
          assetId: z.uuid(),
          fromTeamId: z.uuid(),
        })
      )
      .min(2)
      .max(100),
  })
  .refine(
    ({ teamAId, teamBId, assets }) =>
      teamAId !== teamBId &&
      assets.some((asset) => asset.fromTeamId === teamAId) &&
      assets.some((asset) => asset.fromTeamId === teamBId) &&
      assets.every((asset) => asset.fromTeamId === teamAId || asset.fromTeamId === teamBId) &&
      new Set(assets.map((asset) => `${asset.assetType}:${asset.assetId}`)).size === assets.length
  );
export type TradeCommand = z.infer<typeof tradeCommandSchema>;

export class TradeOperationError extends Error {
  constructor(readonly code: TradeErrorCode) {
    super(code);
    this.name = "TradeOperationError";
  }
}

export interface TradeTransaction {
  // The implementation must retain the verified user's session and validate under database locks.
  execute(gameId: string, command: TradeCommand): Promise<string>;
}
