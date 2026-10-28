// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { OffseasonContractLedger } from "@/components/offseason/OffseasonContractLedger";

const { hook, mutate, prepare, outlook, playerOptions } = vi.hoisted(() => ({
  hook: vi.fn(),
  mutate: vi.fn(),
  prepare: vi.fn(),
  outlook: vi.fn(),
  playerOptions: vi.fn(),
}));
vi.mock("@/application/hooks/offseason/useOffseasonContracts", () => ({
  useOffseasonContracts: hook,
}));
vi.mock("@/application/hooks/offseason/useOffseasonPlayerOptions", () => ({
  useOffseasonPlayerOptions: playerOptions,
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
  playerOptions.mockReturnValue({
    options: { data: [], isPending: false, isError: false },
    resolve: { isPending: false },
  });
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

it("projects saved team decisions on render and reload without writes", () => {
  hook.mockReturnValue(
    state({
      ledger: { data: [{ ...row, decision: "exercise" }], isPending: false, isError: false },
    })
  );
  const view = show();
  const projection = () => screen.getByRole("region", { name: "Selected team · Projected roster" });
  expect(within(projection()).getByText("Test Player")).toBeTruthy();
  const badge = within(projection()).getByText("Continuity projected · Option exercised");
  expect(badge.getAttribute("data-slot")).toBe("badge");
  expect(badge.classList.contains("whitespace-normal")).toBe(true);
  const portrait = projection().querySelector("img");
  expect(portrait?.getAttribute("src")).toBe("/player-silhouette.svg");
  expect(portrait?.getAttribute("alt")).toBe("");
  view.unmount();
  show();
  expect(projection().textContent).toContain("Continuity projected · Option exercised");
  expect(prepare).not.toHaveBeenCalled();
  expect(mutate).not.toHaveBeenCalled();
});

it("does not reuse another team's saved decisions", () => {
  hook.mockReturnValue(
    state({
      ledger: { data: [{ ...row, decision: "exercise" }], isPending: false, isError: false },
    })
  );
  show("other");
  const projection = screen.getByRole("region", { name: "Selected team · Projected roster" });
  expect(projection.textContent).toContain("Pending option · Continuity not confirmed");
});

it.each([
  { scope: {}, expected: "Continuity projected · Option exercised" },
  { scope: { gameId: "other" }, expected: "Pending option · Continuity not confirmed" },
  { scope: { seasonYear: 2025 }, expected: "Pending option · Continuity not confirmed" },
  { scope: { teamId: "other" }, expected: "Pending option · Continuity not confirmed" },
  { scope: { playerId: "other" }, expected: "Pending option · Continuity not confirmed" },
])("scopes saved player projection: $scope", ({ scope, expected }) => {
  const playerRow = { ...row, status: "player_option" };
  hook.mockReturnValue(state({ ledger: { data: [playerRow], isPending: false, isError: false } }));
  outlook.mockReturnValue({ status: "player_option", nextSalary: 100, estimated: false });
  playerOptions.mockReturnValue({
    options: {
      data: [
        {
          ...playerRow,
          gameId: "career",
          currentSalary: 90,
          decision: "exercise",
          reason: "salary_not_lower",
          policyVersion: "salary-comparison-v1",
          ...scope,
        },
      ],
      isPending: false,
      isError: false,
    },
    resolve: { isPending: false },
  });
  show();
  expect(
    screen.getByRole("region", { name: "Selected team · Projected roster" }).textContent
  ).toContain(expected);
});

it.each(["loading", "error"])("withholds the projection on player decision %s", (status) => {
  hook.mockReturnValue(
    state({
      ledger: { data: [{ ...row, status: "player_option" }], isPending: false, isError: false },
    })
  );
  playerOptions.mockReturnValue({
    options: {
      data: [],
      isPending: status === "loading",
      isError: status === "error",
      refetch: vi.fn(),
    },
    resolve: { isPending: false },
  });
  show();
  const projection = screen.getByRole("region", { name: "Selected team · Projected roster" });
  expect(within(projection).queryByRole("list")).toBeNull();
  expect(
    within(projection).getByText(
      status === "loading"
        ? "Loading..."
        : "Unable to load or resolve player options. Retry before resolving."
    )
  ).toBeTruthy();
});
