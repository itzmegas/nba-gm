// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRoster } from "@/application/hooks/roster/useRoster";
import type { GamePlayerContractState } from "@/domain/contracts/GameContract";
import type { PlayerState } from "@/domain/entities/PlayerState";
import { SupabaseGameContractRepository } from "@/infrastructure/contracts/SupabaseGameContractRepository";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { SupabasePlayerRatingsRepository } from "@/infrastructure/repositories/SupabasePlayerRatingsRepository";
import { SupabasePlayerStateRepository } from "@/infrastructure/repositories/SupabasePlayerStateRepository";

const gameId = "11111111-1111-4111-8111-111111111111";
const teamId = "22222222-2222-4222-8222-222222222222";
const playerRows = Array.from({ length: 1553 }, (_, index) => ({
  id: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
  first_name: "Roster",
  last_name: "Player",
  full_name: `Player ${index}`,
  position: "G",
  years_of_experience: 4,
  is_active: true,
  created_at: "2026-10-15T00:00:00Z",
  updated_at: "2026-10-15T00:00:00Z",
}));
let failingPage: number | null = null;
const from = vi.fn(() => {
  let start = 0;
  let end = 999;
  const query = {
    select: () => query,
    order: () => query,
    range: (first: number, last: number) => {
      start = first;
      end = last;
      return query;
    },
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable thenables
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(
        failingPage !== null && start >= failingPage
          ? { data: null, error: { message: "Player page unavailable" } }
          : { data: playerRows.slice(start, Math.min(end + 1, start + 1000)), error: null }
      ).then(resolve),
  };
  return query;
});
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => ({ from }) }));

function renderRoster(seasonYear?: number) {
  const states: PlayerState[] = [
    ...Array.from({ length: 11 }, (_, n) => n),
    1500,
    1501,
    1502,
    1503,
    1504,
    1505,
    1506,
    1507,
  ].map((index) => ({
    id: playerRows[index].id,
    gameId,
    teamId,
    playerId: playerRows[index].id,
    isActive: index !== 1506,
    isInjured: false,
    fatigue: 0,
    morale: 50,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
  const identities: GamePlayerContractState[] = states.map(({ playerId }, index) => ({
    playerId,
    resolutionStatus:
      index === 18
        ? "inactive-excluded"
        : index === 15 || index === 16
          ? "official-two-way"
          : "observed-standard",
    contractType: index === 15 || index === 16 ? "two-way" : "standard",
    provenanceQuality: "observed",
    sourceMethod: "basketball-reference-current-salary",
    estimated: false,
    capTreatment:
      index === 18
        ? "excluded-inactive"
        : index === 15 || index === 16
          ? "excluded-two-way"
          : "standard-cap-and-matching",
    exclusionEvidence: null,
    agreement: null,
  }));
  vi.spyOn(SupabasePlayerStateRepository.prototype, "getByGameAndTeam").mockResolvedValue(states);
  vi.spyOn(SupabaseContractRepository.prototype, "getByTeamId").mockResolvedValue([]);
  vi.spyOn(SupabaseGameContractRepository.prototype, "getByTeam").mockResolvedValue(identities);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useRoster(gameId, teamId, seasonYear), { wrapper });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  failingPage = null;
});

describe("complete game roster reads", () => {
  it("attaches saved ratings for the requested season to the correct player", async () => {
    const ratings = {
      attributes: { closeShot: 80 },
      estimated: false,
    } as unknown as import("@/domain/entities/PlayerAttributes").PlayerRatings;
    const getRatings = vi
      .spyOn(SupabasePlayerRatingsRepository.prototype, "getByPlayers")
      .mockResolvedValue(new Map([[playerRows[1500].id, ratings]]));
    const { result } = renderRoster(2026);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRatings).toHaveBeenCalledWith(
      gameId,
      2026,
      expect.arrayContaining([playerRows[1500].id])
    );
    expect(
      result.current.data?.find(({ player }) => player.id === playerRows[1500].id)?.ratings
    ).toEqual(ratings);
    expect(
      result.current.data?.find(({ player }) => player.id === playerRows[0].id)?.ratings
    ).toBeNull();
  });

  it("surfaces ratings read failures instead of claiming the values are missing", async () => {
    vi.spyOn(SupabasePlayerRatingsRepository.prototype, "getByPlayers").mockRejectedValue(
      new Error("Ratings unavailable")
    );
    const { result } = renderRoster(2026);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Ratings unavailable");
  });
  it("shows all 15 standard and 2 two-way players beyond the global 1000-player limit", async () => {
    const getRatings = vi.spyOn(SupabasePlayerRatingsRepository.prototype, "getByPlayers");
    const { result } = renderRoster();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(17);
    expect(
      result.current.data?.filter(({ gameContract }) => gameContract?.contractType === "two-way")
    ).toHaveLength(2);
    expect(result.current.data?.some(({ player }) => player.id === playerRows[1500].id)).toBe(true);
    expect(getRatings).not.toHaveBeenCalled();
  });

  it("surfaces a later player-page failure instead of displaying a partial roster", async () => {
    failingPage = 1000;
    const { result } = renderRoster();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Player page unavailable");
    expect(result.current.data).toBeUndefined();
  });
});
