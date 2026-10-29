// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { useBatchSimulationStore } from "@/application/stores/useBatchSimulationStore";
import { RosterTable } from "@/components/roster/roster-table";

const gameId = "11111111-1111-4111-8111-111111111111";
const playerId = "22222222-2222-4222-8222-222222222222";
const contractId = "33333333-3333-4333-8333-333333333333";
const releaseId = "44444444-4444-4444-8444-444444444444";
const { rpc, push } = vi.hoisted(() => ({ rpc: vi.fn(), push: vi.fn() }));
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => ({ rpc }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const player = {
  player: { id: playerId, fullName: "Test Player", position: "PG" },
  contract: { id: contractId, salaryY1: 2_625_627, endYear: 2026, origin: "simulated-agreement" },
  gameContract: null,
} as unknown as RosterPlayer;

beforeEach(() => {
  rpc.mockReset();
  push.mockReset();
  useBatchSimulationStore.setState({ isActive: false });
});
afterEach(() => {
  cleanup();
  useBatchSimulationStore.setState({ isActive: false });
});

function renderRoster(
  canRelease = true,
  leagueTeamId?: string,
  onSelectPlayer?: (id: string) => void
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const key of ["roster", "contracts", "free-agency", "release-cap-charge", "player-states"]) {
    client.setQueryData(["games", gameId, key], "cached");
  }
  render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="en">
        <RosterTable
          gameId={gameId}
          players={[player]}
          seasonYear={2026}
          canRelease={canRelease}
          leagueTeamId={leagueTeamId}
          onSelectPlayer={onSelectPlayer}
        />
      </I18nProvider>
    </QueryClientProvider>
  );
  return client;
}

function openActions() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Actions — Test Player" }), {
    button: 0,
    ctrlKey: false,
  });
}

function openRelease() {
  openActions();
  fireEvent.click(screen.getByRole("menuitem", { name: "Release Test Player" }));
}

it("requires confirmation, cancels without writing, and does not navigate to the player", () => {
  renderRoster();
  openRelease();
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(screen.getByText(/remain on your payroll/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(rpc).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

it("retains the request ID after an uncertain failure and reconciles all game reads", async () => {
  rpc
    .mockResolvedValueOnce({ data: null, error: { message: "Connection lost" } })
    .mockResolvedValueOnce({ data: releaseId, error: null });
  const client = renderRoster();
  openRelease();
  fireEvent.click(screen.getByRole("button", { name: "Confirm release" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Unable to release the player. Connection lost"
  );
  expect(rpc).toHaveBeenCalledTimes(1);
  const firstPayload = rpc.mock.calls[0][1];
  expect(firstPayload).toEqual({
    p_game_id: gameId,
    p_player_id: playerId,
    p_contract_id: contractId,
    p_request_id: expect.any(String),
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm release" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(rpc).toHaveBeenNthCalledWith(2, "release_roster_player", firstPayload);
  for (const key of ["roster", "contracts", "free-agency", "release-cap-charge", "player-states"]) {
    expect(client.getQueryState(["games", gameId, key])?.isInvalidated).toBe(true);
  }
  expect(push).not.toHaveBeenCalled();
});

it("blocks confirmation when simulation starts while the dialog is open", async () => {
  renderRoster();
  openRelease();
  await act(async () => {
    useBatchSimulationStore.setState({ isActive: true });
  });
  expect(screen.getByRole("button", { name: "Confirm release" }).hasAttribute("disabled")).toBe(
    true
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm release" }));
  expect(rpc).not.toHaveBeenCalled();
});

it("does not expose cuts on a read-only league roster", () => {
  renderRoster(false);
  openActions();
  expect(screen.queryByRole("menuitem", { name: "Release Test Player" })).toBeNull();
});

it("selects a roster player without navigating and uses the menu for full details", () => {
  const select = vi.fn();
  renderRoster(false, undefined, select);
  fireEvent.click(screen.getByRole("button", { name: "Test Player" }));
  expect(select).toHaveBeenCalledExactlyOnceWith(playerId);
  expect(push).not.toHaveBeenCalled();
  openActions();
  expect(select).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("menuitem", { name: "View player" }));
  expect(push).toHaveBeenCalledExactlyOnceWith(`/games/${gameId}/dashboard/player/${playerId}`);
});

it("uses compact rectangular portraits while preserving read-only league navigation", () => {
  const leagueTeamId = "55555555-5555-4555-8555-555555555555";
  renderRoster(false, leagueTeamId);
  const row = screen.getByText("Test Player").closest("tr");
  const portrait = row?.querySelector(".rounded-sm");
  expect(portrait?.classList.contains("h-10")).toBe(true);
  expect(portrait?.classList.contains("w-10")).toBe(true);
  fireEvent.click(screen.getByText("Test Player"));
  expect(push).toHaveBeenCalledExactlyOnceWith(
    `/games/${gameId}/dashboard/player/${playerId}?leagueTeamId=${leagueTeamId}`
  );
  expect(screen.queryByRole("button", { name: "Release Test Player" })).toBeNull();
  expect(rpc).not.toHaveBeenCalled();
});
