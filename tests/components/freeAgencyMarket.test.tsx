// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { FreeAgencyMarketScreen } from "@/components/free-agency/market-screen";

const rpc = vi.fn();
const client = { rpc };
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => client }));
vi.mock("@/components/free-agency/offer-form", () => ({
  OfferForm: ({
    player,
    hasPendingOffer,
    disabled,
  }: {
    player: { firstName: string };
    hasPendingOffer: boolean;
    disabled?: boolean;
  }) => (
    <div data-testid="offer-form" data-pending={hasPendingOffer} data-disabled={disabled}>
      {player.firstName}
    </div>
  ),
}));

const gameId = "11111111-1111-4111-8111-111111111111";
const playerId = "22222222-2222-4222-8222-222222222222";
const teamId = "33333333-3333-4333-8333-333333333333";
const candidate = {
  player_id: playerId,
  first_name: "Alex",
  last_name: "Player",
  position: "G",
  minimum_salary: 1_000_000,
  maximum_salary: 10_000_000,
};
const context = {
  team_id: teamId,
  season: "2026-27",
  simulation_date: "2026-10-15",
  salary_cap: 140_000_000,
  payroll: 120_000_000,
  cap_room: 20_000_000,
  roster_count: 12,
};
const offer = (
  id: string,
  origin: "human" | "ai",
  status: "pending" | "accepted" | "rejected"
) => ({
  id,
  request_id: id,
  owner_id: "77777777-7777-4777-8777-777777777777",
  game_id: gameId,
  player_id: playerId,
  team_id: teamId,
  season: "2026-27",
  annual_salary: 2_000_000,
  years: 1,
  due_date: "2026-10-16",
  status,
  offer_origin: origin,
  created_at: "2026-10-15T12:00:00Z",
  resolved_at: status === "pending" ? null : "2026-10-16T00:00:00Z",
  resolved_date: status === "pending" ? null : "2026-10-16",
  resolution_reason:
    status === "accepted"
      ? "selected_offer_accepted"
      : status === "rejected"
        ? "another_offer_accepted"
        : null,
  resolution_detail: null,
  resolved_contract_id: status === "accepted" ? "88888888-8888-4888-8888-888888888888" : null,
  ai_decision_date: origin === "ai" ? "2026-10-15" : null,
  player_name: "Alex Player",
  team_name: "Team",
});
const market = (
  values: { supported?: boolean; candidates?: unknown[]; offers?: unknown[] } = {}
) => ({
  game_id: gameId,
  supported: values.supported ?? true,
  context: values.supported === false ? null : context,
  candidates: values.candidates ?? [candidate],
  offers: values.offers ?? [],
});

function renderMarket(locale: "en" | "es" = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider locale={locale}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return render(<FreeAgencyMarketScreen gameId={gameId} />, { wrapper });
}

describe("free agency market screen", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    rpc.mockReset();
  });

  it("loads authoritative market context, candidates, and human/AI offer history", async () => {
    rpc.mockResolvedValue({
      data: market({
        offers: [
          offer("44444444-4444-4444-8444-444444444444", "human", "accepted"),
          offer("55555555-5555-4555-8555-555555555555", "ai", "rejected"),
        ],
      }),
      error: null,
    });
    renderMarket();
    expect(screen.getByRole("status").textContent).toBe("Loading...");
    expect(await screen.findByRole("heading", { name: "Free agency market" })).toBeTruthy();
    expect(screen.getByText("$120,000,000")).toBeTruthy();
    expect(screen.getByText("Your offer")).toBeTruthy();
    expect(screen.getByText("AI offer")).toBeTruthy();
    expect(
      screen.getByText(
        "This offer won. The player joined the bidding team and payroll was updated."
      )
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit offer" }));
    expect(screen.getByTestId("offer-form").textContent).toContain("Alex");
  });

  it("shows errors and retries without presenting stale candidates", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "offline" } })
      .mockResolvedValueOnce({ data: market(), error: null });
    renderMarket();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByTestId("offer-form")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Free agency market" })).toBeTruthy();
  });

  it("renders unsupported and empty-pool states without inferring availability", async () => {
    rpc
      .mockResolvedValueOnce({
        data: market({ supported: false, candidates: [], offers: [] }),
        error: null,
      })
      .mockResolvedValueOnce({ data: market({ candidates: [] }), error: null });
    const first = renderMarket();
    expect(await screen.findByText(/market requires an active/)).toBeTruthy();
    first.unmount();
    renderMarket();
    expect(await screen.findByText(/No eligible free agents/)).toBeTruthy();
  });

  it("recovers an older empty save only on explicit import and refreshes the market", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ enrolled_count: 1, skipped_count: 0 })));
    vi.stubGlobal("fetch", fetcher);
    rpc
      .mockResolvedValueOnce({ data: market({ candidates: [] }), error: null })
      .mockResolvedValueOnce({ data: market(), error: null });
    renderMarket();
    const button = await screen.findByRole("button", { name: "Load initial market" });
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(button);
    await screen.findByText("Alex Player");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/free-agency/bootstrap",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ gameId }),
      })
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("translates offer outcomes with the active Spanish locale", async () => {
    rpc.mockResolvedValue({
      data: market({
        offers: [offer("99999999-9999-4999-8999-999999999999", "human", "accepted")],
      }),
      error: null,
    });
    renderMarket("es");
    expect(await screen.findByText("Tu oferta")).toBeTruthy();
    expect(screen.getByText(/Aceptada:/)).toBeTruthy();
    expect(
      screen.getByText(
        "Esta oferta ganó. El jugador se incorporó al equipo y se actualizó la nómina."
      )
    ).toBeTruthy();
  });

  it("keeps terminal results visible when a save no longer supports new offers", async () => {
    rpc.mockResolvedValue({
      data: market({
        supported: false,
        candidates: [],
        offers: [offer("99999999-9999-4999-8999-999999999999", "human", "accepted")],
      }),
      error: null,
    });
    renderMarket();
    expect(await screen.findByText(/market requires an active/)).toBeTruthy();
    expect(screen.getByText(/This offer won/)).toBeTruthy();
    expect(screen.queryByTestId("offer-form")).toBeNull();
  });

  it("preserves the selected form but disables it when a background refresh fails", async () => {
    rpc
      .mockResolvedValueOnce({ data: market(), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    renderMarket();
    await screen.findByRole("heading", { name: "Free agency market" });
    fireEvent.click(screen.getByRole("button", { name: "Submit offer" }));
    const form = screen.getByTestId("offer-form");
    fireEvent.click(screen.getByRole("button", { name: "Refresh market" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByTestId("offer-form")).toBe(form);
    expect(form.getAttribute("data-disabled")).toBe("true");
  });

  it("recognizes your pending offer and translates an invalidation detail", async () => {
    rpc.mockResolvedValue({
      data: market({
        offers: [
          offer("44444444-4444-4444-8444-444444444444", "human", "pending"),
          {
            ...offer("55555555-5555-4555-8555-555555555555", "ai", "rejected"),
            resolution_reason: "offer_no_longer_legal",
            resolution_detail: "Roster maximum reached",
          },
        ],
      }),
      error: null,
    });
    renderMarket("es");
    await screen.findByRole("heading", { name: "Mercado de agentes libres" });
    fireEvent.click(screen.getByRole("button", { name: "Enviar oferta" }));
    expect(screen.getByTestId("offer-form").getAttribute("data-pending")).toBe("true");
    expect(screen.getByText(/Se alcanzó el máximo de jugadores/)).toBeTruthy();
  });

  it("allows competing with a pending AI offer and blocks forms during background refresh", async () => {
    let resolveRefresh: ((value: { data: unknown; error: null }) => void) | undefined;
    rpc
      .mockResolvedValueOnce({
        data: market({ offers: [offer("66666666-6666-4666-8666-666666666666", "ai", "pending")] }),
        error: null,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          })
      );
    const { container } = renderMarket();
    await screen.findByText("Alex Player", { selector: "h3" });
    fireEvent.click(screen.getByRole("button", { name: "Submit offer" }));
    expect(screen.getByTestId("offer-form").getAttribute("data-pending")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Refresh market" }));
    await waitFor(() =>
      expect(screen.getByTestId("offer-form").getAttribute("data-disabled")).toBe("true")
    );
    expect(container.querySelector("form")).toBeNull();
    resolveRefresh?.({ data: market(), error: null });
  });
});
