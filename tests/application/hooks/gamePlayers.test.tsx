// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useGamePlayers } from "@/application/hooks/players/useGamePlayers";
import { useExecuteTrade } from "@/application/hooks/trades/useTrades";
import { TradeEngine } from "@/application/services/TradeEngine";
import type { GamePlayerContractState } from "@/domain/contracts/GameContract";
import type { Contract } from "@/domain/entities/Contract";
import type { Player } from "@/domain/entities/Player";
import type { PlayerState } from "@/domain/entities/PlayerState";
import { SupabaseGameContractRepository } from "@/infrastructure/contracts/SupabaseGameContractRepository";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { SupabasePlayerRatingsRepository } from "@/infrastructure/repositories/SupabasePlayerRatingsRepository";
import { SupabasePlayerRepository } from "@/infrastructure/repositories/SupabasePlayerRepository";
import { SupabasePlayerStateRepository } from "@/infrastructure/repositories/SupabasePlayerStateRepository";

vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => ({}) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const gameId = "11111111-1111-4111-8111-111111111111";

function setup(count = 6) {
  const players: Player[] = Array.from({ length: count + 1 }, (_, index) => ({
    id: String(index),
    firstName: "Player",
    lastName: String(index),
    fullName: `Player ${index}`,
    teamId: "canonical",
    isActive: false,
    yearsOfExperience: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
  const states: PlayerState[] = players.slice(0, count).map((player, index) => ({
    id: player.id,
    gameId,
    playerId: player.id,
    teamId: index === 1 || index === 2 ? undefined : "traded-team",
    isActive: index !== 3,
    isInjured: false,
    morale: 50,
    fatigue: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
  const contract: Contract = {
    id: "contract",
    gameId,
    playerId: "5",
    teamId: "traded-team",
    origin: "simulated-agreement",
    startYear: 2026,
    endYear: 2027,
    salaryY1: 2000000,
    isPlayerOption: false,
    isTeamOption: false,
    isGuaranteed: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const identity: GamePlayerContractState = {
    playerId: "4",
    resolutionStatus: "inactive-excluded",
    contractType: null,
    provenanceQuality: null,
    sourceMethod: null,
    estimated: false,
    capTreatment: "excluded-inactive",
    exclusionEvidence: null,
    agreement: null,
  };
  vi.spyOn(SupabasePlayerRepository.prototype, "getAll").mockResolvedValue(players);
  vi.spyOn(SupabasePlayerStateRepository.prototype, "getByGameId").mockResolvedValue(states);
  vi.spyOn(SupabaseContractRepository.prototype, "getAll").mockResolvedValue([
    contract,
    { ...contract, playerId: "1" },
  ]);
  vi.spyOn(SupabaseGameContractRepository.prototype, "getAll").mockResolvedValue([
    identity,
    { ...identity, playerId: "5" },
  ]);
  const ratings = vi
    .spyOn(SupabasePlayerRatingsRepository.prototype, "getByPlayers")
    .mockResolvedValue(new Map());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, ratings, client };
}

it("uses only game membership, current ownership and runtime contract overrides", async () => {
  const { wrapper } = setup();
  const { result } = renderHook(() => useGamePlayers(gameId, 2026), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const rows = result.current.data ?? [];
  expect(rows).toHaveLength(6);
  expect(rows[0].player).toMatchObject({ teamId: "traded-team", isActive: true });
  expect(rows[1].player.teamId).toBeUndefined();
  expect(rows[1].contract).toBeNull();
  expect(rows[2].player).toMatchObject({ teamId: undefined, isActive: true });
  expect(rows[3].player.isActive).toBe(false);
  expect(rows[4].player.isActive).toBe(false);
  expect(rows[5].player.isActive).toBe(true);
  expect(rows[5].contract?.origin).toBe("simulated-agreement");
  expect(rows[0].ratings).toBeNull();
});

it("batches global ratings and propagates errors instead of returning partial results", async () => {
  const { wrapper, ratings } = setup(451);
  ratings.mockRejectedValueOnce(new Error("Ratings unavailable"));
  const { result } = renderHook(() => useGamePlayers(gameId, 2026), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  ratings.mockResolvedValue(new Map());
  await result.current.refetch();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(ratings.mock.calls.slice(1).map((call) => call[2].length)).toEqual([150, 150, 150, 1]);
  expect(ratings.mock.calls.every(([id, season]) => id === gameId && season === 2026)).toBe(true);
});

it("invalidates the global directory after a successful trade", async () => {
  const { wrapper, client } = setup();
  const key = ["games", gameId, "players", 2026];
  client.setQueryData(key, []);
  vi.spyOn(TradeEngine.prototype, "executeTrade").mockResolvedValue({ success: true });
  const { result } = renderHook(() => useExecuteTrade(), { wrapper });
  const packageA = { teamId: "a", teamName: "A", outgoingAssets: [], incomingAssets: [] };
  await result.current.mutateAsync({
    gameId,
    teamA: { contracts: [], rosterSize: 15 },
    teamB: { contracts: [], rosterSize: 15 },
    packageA,
    packageB: { ...packageA, teamId: "b" },
    seasonYear: 2026,
  });
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});
