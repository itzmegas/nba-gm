import { describe, expect, it, vi } from "vitest";
import { executeServerTrade } from "@/application/trades/executeServerTrade";
import { TRADE_ERROR, TradeOperationError } from "@/domain/trades/TradeCommand";

const gameId = "a0000000-0000-4000-8000-000000000001";
const teamAId = "a1000000-0000-4000-8000-000000000001";
const teamBId = "a1000000-0000-4000-8000-000000000002";
const assetId = "a2000000-0000-4000-8000-000000000001";
const tradeId = "a3000000-0000-4000-8000-000000000001";
const command = {
  teamAId,
  teamBId,
  assets: [
    { assetType: "pick", assetId, fromTeamId: teamAId },
    { assetType: "pick", assetId: teamBId, fromTeamId: teamBId },
  ],
};

describe("server trade command", () => {
  it("passes only validated identifiers to the authenticated transaction", async () => {
    const execute = vi.fn().mockResolvedValue(tradeId);
    await expect(executeServerTrade(gameId, command, { execute })).resolves.toEqual({ tradeId });
    expect(execute).toHaveBeenCalledExactlyOnceWith(gameId, command);
  });

  it.each([
    { ...command, userId: teamAId },
    { ...command, salary: 0 },
    { ...command, rosterSize: 12 },
    { ...command, hardCapLimit: 999999999 },
    { ...command, assets: [{ ...command.assets[0], salary: 0 }, command.assets[1]] },
    { ...command, teamBId: teamAId },
    { ...command, assets: [command.assets[0], command.assets[0]] },
    { ...command, assets: [command.assets[0]] },
    { ...command, assets: [command.assets[0], { ...command.assets[1], fromTeamId: gameId }] },
    { ...command, assets: [{ ...command.assets[0], assetType: "cash" }, command.assets[1]] },
  ])("rejects malformed/forged input before writes: %j", async (body) => {
    const execute = vi.fn();
    await expect(executeServerTrade(gameId, body, { execute })).rejects.toMatchObject({
      code: TRADE_ERROR.INVALID_REQUEST,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects invalid game IDs and propagates defined transaction errors", async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new TradeOperationError(TRADE_ERROR.HARD_CAP_UNKNOWN));
    await expect(executeServerTrade("bad", command, { execute })).rejects.toMatchObject({
      code: TRADE_ERROR.INVALID_REQUEST,
    });
    expect(execute).not.toHaveBeenCalled();
    await expect(executeServerTrade(gameId, command, { execute })).rejects.toMatchObject({
      code: TRADE_ERROR.HARD_CAP_UNKNOWN,
    });
  });
});
