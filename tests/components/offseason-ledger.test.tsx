// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { OffseasonContractLedger } from "@/components/offseason/OffseasonContractLedger";

const { hook, mutate, prepare, outlook } = vi.hoisted(() => ({
  hook: vi.fn(),
  mutate: vi.fn(),
  prepare: vi.fn(),
  outlook: vi.fn(),
}));
vi.mock("@/application/hooks/offseason/useOffseasonContracts", () => ({
  useOffseasonContracts: hook,
}));
vi.mock("@/domain/services/OffseasonContractOutlook", () => ({
  getOffseasonContractOutlook: outlook,
}));
const row = {
  playerId: "player",
  teamId: "owner",
  seasonYear: 2026,
  status: "team_option",
  decision: null,
  nextSalary: 100,
};
function state(overrides = {}) {
  return {
    ledger: { data: [row], isPending: false, isError: false, refetch: vi.fn() },
    prepare: { mutate: prepare, isPending: false, isError: false },
    decide: { mutate, reset: vi.fn(), isPending: false, isError: false },
    ...overrides,
  };
}
function show(selectedTeamId = "owner") {
  return render(
    <I18nProvider locale="en">
      <OffseasonContractLedger
        gameId="career"
        seasonYear={2026}
        selectedTeamId={selectedTeamId}
        ownerTeamId="owner"
        roster={[
          {
            player: {
              id: "player",
              firstName: "Test",
              lastName: "Player",
              fullName: "Test Player",
              yearsOfExperience: 2,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            contract: null,
            gameContract: null,
          },
        ]}
      />
    </I18nProvider>
  );
}
beforeEach(() => {
  hook.mockReturnValue(state());
  outlook.mockReturnValue({ status: "team_option", estimated: false, nextSalary: 100 });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("never writes on render and prepares only explicitly", () => {
  show();
  expect(prepare).not.toHaveBeenCalled();
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Record expiries and team options" }));
  expect(prepare).toHaveBeenCalledOnce();
});
it("requires confirmation, cancel writes nothing, confirm sends the decision once", () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Exercise team option" }));
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Decline team option" }));
  const confirm = within(screen.getByRole("alertdialog")).getByRole("button", {
    name: "Confirm decision",
  });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(mutate).toHaveBeenCalledOnce();
  expect(mutate).toHaveBeenCalledWith(
    { playerId: "player", decision: "decline" },
    expect.any(Object)
  );
});
it("keeps other teams read-only", () => {
  show("other");
  expect(screen.queryByRole("button")).toBeNull();
});
it.each([
  { status: "unknown", estimated: false },
  { status: "team_option", estimated: true },
  { status: "player_option", estimated: false },
])("keeps uncertain and player options nonactionable: %j", (value) => {
  outlook.mockReturnValue(value);
  show();
  expect(screen.queryByRole("button", { name: "Exercise team option" })).toBeNull();
});
it("shows saved decisions without controls", () => {
  hook.mockReturnValue(
    state({
      ledger: { data: [{ ...row, decision: "exercise" }], isPending: false, isError: false },
    })
  );
  show();
  expect(screen.getByText("Team option exercised (saved plan)")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Decline team option" })).toBeNull();
});
it("shows planned departures", () => {
  hook.mockReturnValue(
    state({ ledger: { data: [{ ...row, status: "expiring" }], isPending: false, isError: false } })
  );
  show();
  expect(screen.getByText("Planned departure")).toBeTruthy();
});
it("disables actions while saving and reports errors", () => {
  hook.mockReturnValue(state({ prepare: { mutate: prepare, isPending: true, isError: true } }));
  show();
  expect(
    screen.getByRole("button", { name: "Exercise team option" }).hasAttribute("disabled")
  ).toBe(true);
  expect(screen.getByRole("alert")).toBeTruthy();
});
it("keeps the confirmation open on error and blocks duplicate saves while pending", () => {
  const view = show();
  fireEvent.click(screen.getByRole("button", { name: "Exercise team option" }));
  hook.mockReturnValue(
    state({ decide: { mutate, reset: vi.fn(), isPending: true, isError: false } })
  );
  view.rerender(
    <I18nProvider locale="en">
      <OffseasonContractLedger
        gameId="career"
        seasonYear={2026}
        selectedTeamId="owner"
        ownerTeamId="owner"
        roster={[]}
      />
    </I18nProvider>
  );
  expect(
    within(screen.getByRole("alertdialog"))
      .getByRole("button", { name: "Saving…" })
      .hasAttribute("disabled")
  ).toBe(true);
  hook.mockReturnValue(
    state({ decide: { mutate, reset: vi.fn(), isPending: false, isError: true } })
  );
  view.rerender(
    <I18nProvider locale="en">
      <OffseasonContractLedger
        gameId="career"
        seasonYear={2026}
        selectedTeamId="owner"
        ownerTeamId="owner"
        roster={[]}
      />
    </I18nProvider>
  );
  expect(within(screen.getByRole("alertdialog")).getByRole("alert")).toBeTruthy();
});
it("does not allow unknown salaries or contradictory amounts", () => {
  outlook.mockReturnValue({ status: "team_option", estimated: false, nextSalary: 200 });
  show();
  expect(screen.queryByRole("button", { name: "Exercise team option" })).toBeNull();
});
