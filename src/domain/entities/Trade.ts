import { z } from "zod";
import type { DomainError } from "../errors";
import type { Contract } from "./Contract";
import type { Player } from "./Player";

export const TRADE_ASSET_TYPE = {
  PLAYER: "player",
  PICK: "pick",
} as const;

export type TradeAssetType = (typeof TRADE_ASSET_TYPE)[keyof typeof TRADE_ASSET_TYPE];

export interface DraftPick {
  id: string;
  draftYear: number;
  draftRound: number;
  protection?: string;
  originalTeamId: string;
}

export interface PickInventory {
  id: string;
  gameId: string;
  draftPickId: string;
  ownerTeamId: string;
  isTransferable: boolean;
  pick: DraftPick;
}

export interface TransferredAsset {
  assetType: TradeAssetType;
  assetId: string;
  fromTeamId: string;
  toTeamId: string;
  playerId?: string;
  pick?: DraftPick;
}

export interface ExecutedTrade {
  id: string;
  gameId: string;
  teamAId: string;
  teamBId: string;
  executedAt: Date;
  assets: TransferredAsset[];
}

export const tradeAssetInputSchema = z.object({
  assetType: z.enum([TRADE_ASSET_TYPE.PLAYER, TRADE_ASSET_TYPE.PICK]),
  assetId: z.uuid(),
  fromTeamId: z.uuid(),
});

export const draftPickSchema = z.object({
  id: z.uuid(),
  draftYear: z.number().int(),
  draftRound: z.number().int().min(1).max(2),
  protection: z.string().min(1).optional(),
  originalTeamId: z.uuid(),
});

export const pickInventorySchema = z.object({
  id: z.uuid(),
  gameId: z.uuid(),
  draftPickId: z.uuid(),
  ownerTeamId: z.uuid(),
  isTransferable: z.boolean(),
  pick: draftPickSchema,
});

const transferredAssetBaseSchema = {
  assetId: z.uuid(),
  fromTeamId: z.uuid(),
  toTeamId: z.uuid(),
};

export const transferredAssetSchema = z.discriminatedUnion("assetType", [
  z.object({
    ...transferredAssetBaseSchema,
    assetType: z.literal(TRADE_ASSET_TYPE.PLAYER),
    playerId: z.uuid(),
  }),
  z.object({
    ...transferredAssetBaseSchema,
    assetType: z.literal(TRADE_ASSET_TYPE.PICK),
    pick: draftPickSchema,
  }),
]);

export const executedTradeSchema = z.object({
  id: z.uuid(),
  gameId: z.uuid(),
  teamAId: z.uuid(),
  teamBId: z.uuid(),
  executedAt: z.date(),
  assets: z.array(transferredAssetSchema),
});

export interface TradeAsset {
  type: "player" | "pick" | "cash";
  player?: Player;
  contract?: Contract;
  pickId?: string;
  // Para picks del draft
  pickYear?: number;
  pickRound?: number;
  pickProtection?: string;
  // Para cash considerations
  cashAmount?: number;
}

export interface TradePackage {
  teamId: string;
  teamName: string; // Para debugging/logs
  outgoingAssets: TradeAsset[];
  incomingAssets: TradeAsset[]; // Esto se calcula después
}

export interface TradeTeamSnapshot {
  contracts: Contract[];
  rosterSize: number;
  hardCapLimit?: number;
}

export interface TradeValidationResult {
  isValid: boolean;
  errors: DomainError[];
  warnings: string[];
  details: {
    teamA: TeamTradeDetails;
    teamB: TeamTradeDetails;
  };
}

export interface TeamTradeDetails {
  teamId: string;
  teamName: string;
  outgoingSalary: number;
  incomingSalary: number;
  salaryDelta: number;
  rosterSizeAfter: number;
  isOverCapAfter: boolean;
  isOverHardCapAfter: boolean;
  hardCapLimit?: number;
  newTotalSalary: number;
}
