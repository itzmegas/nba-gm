// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateGame } from "@/application/hooks/games/useCreateGame";

const { create, update, softDelete, rpc, getUser } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  rpc: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/client", () => ({
  createClient: () => ({ auth: { getUser }, rpc }),
}));
vi.mock("@/infrastructure/repositories/SupabaseGameRepository", () => ({
  SupabaseGameRepository: class {
    create = create;
    update = update;
    softDelete = softDelete;
  },
}));
const gameId = "11111111-1111-4111-8111-111111111111";
const input = {
  name: "New save",
  selectedTeamId: "22222222-2222-4222-8222-222222222222",
  seasonYear: 2026,
  seasonEraId: "modern" as const,
  simulationDate: new Date("2026-10-02"),
};
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe("new-save initial market", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    create.mockResolvedValue({ ...input, id: gameId, status: "initializing" });
    update.mockResolvedValue({ ...input, id: gameId, status: "active" });
    softDelete.mockResolvedValue(undefined);
    rpc.mockResolvedValue({ error: null });
  });

  it("imports after seeding, schedule creation and activation before reporting success", async () => {
    const events: string[] = [];
    rpc.mockImplementation(async (name: string) => {
      events.push(name);
      return { error: null };
    });
    update.mockImplementation(async () => {
      events.push("activate");
      return { ...input, id: gameId, status: "active" };
    });
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      events.push(url);
      return new Response(
        JSON.stringify(url.includes("bootstrap") ? { enrolled_count: 4, skipped_count: 0 } : {})
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useCreateGame(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(events).toEqual([
      "/api/roster-refresh",
      "seed_game_data",
      "initialize_game_schedule",
      "/api/free-agency/bootstrap",
      "/api/player-attributes/bootstrap",
      "activate",
    ]);
    expect(softDelete).not.toHaveBeenCalled();
  });

  it("does not leave a successful save with an unimported market when the provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}"))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "NBA import unavailable" }), { status: 502 })
        )
    );
    const { result } = renderHook(() => useCreateGame(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow("NBA import unavailable");
    });
    expect(softDelete).toHaveBeenCalledWith(gameId);
    expect(rpc).toHaveBeenCalledWith("rollback_seed_game_data", { p_game_id: gameId });
  });

  it("does not import modern NBA players into a historical save", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useCreateGame(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ ...input, seasonYear: 1995, seasonEraId: "jordan" });
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
