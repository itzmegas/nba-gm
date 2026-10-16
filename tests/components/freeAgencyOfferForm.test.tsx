// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { useBatchSimulationStore } from "@/application/stores/useBatchSimulationStore";
import { OfferForm } from "@/components/free-agency/offer-form";

const rpc = vi.fn();
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => ({ rpc }) }));
const gameId = "11111111-1111-4111-8111-111111111111";
const player = {
  playerId: "22222222-2222-4222-8222-222222222222",
  firstName: "Alex",
  lastName: "Player",
  position: "PG",
  minimumSalary: 2_625_627,
  maximumSalary: 42_500_000,
};
const context = {
  teamId: "33333333-3333-4333-8333-333333333333",
  season: "2026-27",
  simulationDate: "2026-10-15",
  salaryCap: 170_111_480,
  payroll: 160_111_480,
  capRoom: 10_000_000,
  rosterCount: 14,
};

function renderForm(
  options: { capRoom?: number; rosterCount?: number; pending?: boolean; locale?: "en" | "es" } = {}
) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale={options.locale ?? "en"}>
        <OfferForm
          gameId={gameId}
          player={player}
          context={{
            ...context,
            capRoom: options.capRoom ?? context.capRoom,
            rosterCount: options.rosterCount ?? context.rosterCount,
          }}
          hasPendingOffer={options.pending ?? false}
        />
      </I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  rpc.mockReset();
  useBatchSimulationStore.setState({ isActive: false, mode: null });
});
afterEach(cleanup);

describe("free agency offer form", () => {
  it("submits selected player terms only and announces next-day resolution without signing", async () => {
    rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => ({
      data: {
        id: "44444444-4444-4444-8444-444444444444",
        request_id: args.p_request_id,
        game_id: gameId,
        player_id: player.playerId,
        team_id: context.teamId,
        season: "2026-27",
        annual_salary: args.p_annual_salary,
        years: args.p_years,
        due_date: "2026-10-16",
        status: "pending",
      },
      error: null,
    }));
    const { container } = renderForm();
    fireEvent.change(screen.getByLabelText("Annual salary (USD)"), {
      target: { value: "5000000" },
    });
    fireEvent.change(screen.getByLabelText("Years"), { target: { value: "3" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(
      await screen.findByText("Offer submitted. Advance the simulation to resolve it.")
    ).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("submit_free_agency_offer", {
      p_game_id: gameId,
      p_player_id: player.playerId,
      p_request_id: expect.any(String),
      p_season: "2026-27",
      p_annual_salary: 5_000_000,
      p_years: 3,
    });
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-16");
  });

  it("retains the request UUID after uncertain responses and changes it for new terms", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "connection lost" } });
    renderForm();
    fireEvent.submit(screen.getByRole("form"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Submit offer" }).disabled).toBe(
        false
      )
    );
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Submit offer" }).disabled).toBe(
        false
      )
    );
    expect(rpc.mock.calls[0][1].p_request_id).toBe(rpc.mock.calls[1][1].p_request_id);
    fireEvent.change(screen.getByLabelText("Years"), { target: { value: "2" } });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));
    expect(rpc.mock.calls[2][1].p_request_id).not.toBe(rpc.mock.calls[0][1].p_request_id);
  });

  it("prevents repeated submission before an in-flight response", async () => {
    rpc.mockReturnValue(new Promise(() => {}));
    renderForm();
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Submitting…" }).disabled).toBe(
      true
    );
  });

  it("allows the exact minimum exception but rejects cap excess and malformed terms", () => {
    renderForm({ capRoom: 0 });
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Submit offer" });
    expect(button.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Annual salary (USD)"), {
      target: { value: "3000000" },
    });
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/Only the exact verified minimum/)).toBeTruthy();
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.change(screen.getByLabelText("Years"), { target: { value: "6" } });
    expect(screen.getByText(/Enter a whole-dollar salary/)).toBeTruthy();
    fireEvent.submit(screen.getByRole("form"));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks full rosters, existing human offers and running simulations with localized copy", () => {
    renderForm({ rosterCount: 15, pending: true, locale: "es" });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enviar oferta" }).disabled).toBe(
      true
    );
    expect(screen.getByText("La plantilla está completa (15 jugadores).")).toBeTruthy();
    expect(screen.getByText("Ya tienes una oferta pendiente por este jugador.")).toBeTruthy();
    act(() => useBatchSimulationStore.setState({ isActive: true }));
    expect(
      screen.getByText("Las ofertas están pausadas mientras se ejecuta la simulación.")
    ).toBeTruthy();
    fireEvent.submit(screen.getByRole("form"));
    expect(rpc).not.toHaveBeenCalled();
  });
});
