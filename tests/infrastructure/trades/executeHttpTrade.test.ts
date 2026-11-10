import { afterEach, expect, it, vi } from "vitest";
import type { TradePackage } from "@/domain/entities/Trade";
import { executeHttpTrade } from "@/infrastructure/trades/executeHttpTrade";

const gameId = "a0000000-0000-4000-8000-000000000001";
const teamAId = "a1000000-0000-4000-8000-000000000001";
const teamBId = "a1000000-0000-4000-8000-000000000002";
const pack = (teamId: string): TradePackage => ({
  teamId,
  teamName: "Untrusted name",
  outgoingAssets: [{ type: "pick", pickId: teamId }],
  incomingAssets: [],
});
afterEach(() => vi.unstubAllGlobals());

it("posts identifiers only, using cookies and without RPC or snapshot validation", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true, tradeId: gameId }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(executeHttpTrade(gameId, pack(teamAId), pack(teamBId))).resolves.toEqual({
    success: true,
    tradeId: gameId,
  });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/games/${gameId}/trades`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamAId,
      teamBId,
      assets: [
        { assetType: "pick", assetId: teamAId, fromTeamId: teamAId },
        { assetType: "pick", assetId: teamBId, fromTeamId: teamBId },
      ],
    }),
  });
});

it("preserves defined errors and never automatically retries uncertain writes", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { success: false, code: "HARD_CAP_UNKNOWN", error: "Player trades unavailable." },
        { status: 422 }
      )
    );
  vi.stubGlobal("fetch", fetchMock);
  expect(await executeHttpTrade(gameId, pack(teamAId), pack(teamBId))).toMatchObject({
    success: false,
    code: "HARD_CAP_UNKNOWN",
  });
  fetchMock.mockRejectedValueOnce(new Error("private network diagnostic"));
  expect(await executeHttpTrade(gameId, pack(teamAId), pack(teamBId))).toMatchObject({
    success: false,
    code: "TRADE_FAILED",
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
