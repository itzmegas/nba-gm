// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { OffseasonContractLedger } from "@/components/offseason/OffseasonContractLedger";

const { ledgerHook, playerHook, resolve, prepare, decide, retry } = vi.hoisted(() => ({
  ledgerHook: vi.fn(),
  playerHook: vi.fn(),
  resolve: vi.fn(),
  prepare: vi.fn(),
  decide: vi.fn(),
  retry: vi.fn(),
}));
vi.mock("@/application/hooks/offseason/useOffseasonContracts", () => ({
  useOffseasonContracts: ledgerHook,
}));
vi.mock("@/application/hooks/offseason/useOffseasonPlayerOptions", () => ({
  useOffseasonPlayerOptions: playerHook,
}));
const playerRow = {
  playerId: "player",
  teamId: "owner",
  seasonYear: 2026,
  status: "player_option",
  decision: null,
  nextSalary: 120,
};
const teamRow = {
  ...playerRow,
  playerId: "team-option",
  status: "team_option",
  decision: "exercise",
};
const saved = {
  gameId: "career",
  playerId: "player",
  teamId: "owner",
  seasonYear: 2026,
  currentSalary: 100,
  nextSalary: 120,
  decision: "exercise",
  reason: "salary_not_lower",
  policyVersion: "salary-comparison-v1",
  resolvedAt: "2027-06-10T00:00:00Z",
};
function ledgerState(overrides = {}) {
  return {
    ledger: {
      data: [playerRow, teamRow, { ...playerRow, playerId: "other-player", teamId: "other" }],
      isPending: false,
      isError: false,
    },
    prepare: { mutate: prepare, isPending: false, isError: false },
    decide: { mutate: decide, reset: vi.fn(), isPending: false, isError: false },
    ...overrides,
  };
}
function playerState(overrides = {}) {
  return {
    options: { data: [], isPending: false, isError: false, refetch: retry },
    resolve: { mutate: resolve, reset: vi.fn(), isPending: false, isError: false },
    ...overrides,
  };
}
function view(selectedTeamId = "owner", locale: "en" | "es" = "en") {
  return (
    <I18nProvider locale={locale}>
      <OffseasonContractLedger
        gameId="career"
        seasonYear={2026}
        selectedTeamId={selectedTeamId}
        ownerTeamId="owner"
        roster={[]}
      />
    </I18nProvider>
  );
}
beforeEach(() => {
  ledgerHook.mockReturnValue(ledgerState());
  playerHook.mockReturnValue(playerState());
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("reads saved results only once candidates exist and never writes on render", () => {
  render(view());
  expect(playerHook).toHaveBeenCalledWith("career", 2026, true);
  expect(resolve).not.toHaveBeenCalled();
  expect(prepare).not.toHaveBeenCalled();
  expect(decide).not.toHaveBeenCalled();
  expect(screen.getAllByText("Player option pending (not controlled by team)")).toHaveLength(1);
});
it.each([
  { data: [], isPending: false, isError: false },
  { data: undefined, isPending: true, isError: false },
  { data: [playerRow], isPending: false, isError: true },
])("does not read player results before an available ledger with candidates: %j", (ledger) => {
  ledgerHook.mockReturnValue(ledgerState({ ledger }));
  render(view());
  expect(playerHook).toHaveBeenCalledWith("career", 2026, false);
});
it("requires explicit confirmation, cancels without writing, and suppresses duplicate confirms", () => {
  render(view());
  fireEvent.click(screen.getByRole("button", { name: "Resolve player options" }));
  const dialog = screen.getByRole("alertdialog");
  expect(dialog.textContent).toContain("saved definitively");
  expect(dialog.textContent).toContain("Unknown, estimated or conflicting inputs remain pending");
  expect(resolve).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(resolve).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Resolve player options" }));
  const confirm = within(screen.getByRole("alertdialog")).getByRole("button", {
    name: "Confirm decision",
  });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(resolve).toHaveBeenCalledOnce();
  expect(resolve).toHaveBeenCalledWith(undefined, expect.any(Object));
  expect(decide).not.toHaveBeenCalled();
});
it("keeps other teams read-only and filters their displayed player rows", () => {
  render(view("other"));
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("other-player")).toBeTruthy();
  expect(screen.queryByText("player")).toBeNull();
  expect(resolve).not.toHaveBeenCalled();
});
it.each([
  {
    decision: "exercise",
    reason: "salary_not_lower",
    label: "Player option exercised (saved plan)",
    salary: 120,
  },
  {
    decision: "decline",
    reason: "salary_lower",
    label: "Player option declined · Planned departure",
    salary: 0,
  },
])("shows saved $decision, salary inputs, reason and policy without stale pending or GM choices", ({
  decision,
  reason,
  label,
  salary,
}) => {
  playerHook.mockReturnValue(
    playerState({
      options: {
        data: [{ ...saved, decision, reason, nextSalary: salary }],
        isPending: false,
        isError: false,
      },
    })
  );
  render(view());
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText(/Current-season salary: \$100/).textContent).toContain(
    `Next-season salary: $${salary}`
  );
  expect(screen.getByText(/Policy: salary-comparison-v1/)).toBeTruthy();
  expect(screen.queryByText("Player option pending (not controlled by team)")).toBeNull();
  expect(screen.queryByRole("button", { name: "Resolve player options" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Exercise team option" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Decline team option" })).toBeNull();
  expect(screen.getByText("Team option exercised (saved plan)")).toBeTruthy();
});
it("leaves missing resolutions pending after an empty successful response", () => {
  resolve.mockImplementation((_input, callbacks) => {
    callbacks.onSuccess([]);
    callbacks.onSettled();
  });
  ledgerHook.mockReturnValue(
    ledgerState({
      ledger: { data: [{ ...playerRow, nextSalary: null }], isPending: false, isError: false },
    })
  );
  render(view());
  fireEvent.click(screen.getByRole("button", { name: "Resolve player options" }));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm decision" })
  );
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(screen.getByText("Player option pending (not controlled by team)")).toBeTruthy();
  expect(screen.getByText(/No saved resolution/)).toBeTruthy();
  expect(screen.queryByText(/\$0/)).toBeNull();
});
it("shows loading without offering resolution", () => {
  playerHook.mockReturnValue(playerState({ options: { isPending: true, isError: false } }));
  render(view());
  expect(screen.getByText("Loading...")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Resolve player options" })).toBeNull();
});
it("offers read retry, blocks writes on error, and keeps previously saved results visible", () => {
  playerHook.mockReturnValue(
    playerState({ options: { data: [saved], isPending: false, isError: true, refetch: retry } })
  );
  render(view());
  expect(screen.getByRole("alert").textContent).toContain(
    "Unable to load or resolve player options"
  );
  expect(screen.getByText("Player option exercised (saved plan)")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Resolve player options" })).toBeNull();
});
it("keeps confirmation open on mutation failure and permits retry", () => {
  resolve.mockImplementation((_input, callbacks) => {
    callbacks.onSettled();
  });
  const ui = render(view());
  fireEvent.click(screen.getByRole("button", { name: "Resolve player options" }));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm decision" })
  );
  playerHook.mockReturnValue(
    playerState({ resolve: { mutate: resolve, reset: vi.fn(), isPending: false, isError: true } })
  );
  ui.rerender(view());
  expect(within(screen.getByRole("alertdialog")).getByRole("alert")).toBeTruthy();
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm decision" })
  );
  expect(resolve).toHaveBeenCalledTimes(2);
});
it("coordinates both mutation workflows while saving player options", () => {
  const ui = render(view());
  fireEvent.click(screen.getByRole("button", { name: "Resolve player options" }));
  playerHook.mockReturnValue(
    playerState({ resolve: { mutate: resolve, reset: vi.fn(), isPending: true, isError: false } })
  );
  ui.rerender(view());
  const dialog = within(screen.getByRole("alertdialog"));
  expect(dialog.getByRole("button", { name: "Saving…" }).hasAttribute("disabled")).toBe(true);
  expect(dialog.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(dialog.getByRole("button", { name: "Saving…" }));
  expect(resolve).not.toHaveBeenCalled();
});
it("disables ledger preparation while player-option resolution is pending", () => {
  playerHook.mockReturnValue(
    playerState({
      resolve: { mutate: resolve, reset: vi.fn(), isPending: true, isError: false },
    })
  );
  render(view());
  expect(screen.getByRole("button", { name: "Saving…" }).hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByRole("button", { name: "Resolve player options" }).hasAttribute("disabled")
  ).toBe(true);
});
it("does not show unread results as pending or permit resolution after an initial read error", () => {
  playerHook.mockReturnValue(
    playerState({
      options: { data: undefined, isPending: false, isError: true, refetch: retry },
    })
  );
  render(view());
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Resolve player options" })).toBeNull();
  expect(screen.queryByText("Player option pending (not controlled by team)")).toBeNull();
});
it("disables player resolution while the original ledger is being prepared", () => {
  ledgerHook.mockReturnValue(
    ledgerState({ prepare: { mutate: prepare, isPending: true, isError: false } })
  );
  render(view());
  expect(
    screen.getByRole("button", { name: "Resolve player options" }).hasAttribute("disabled")
  ).toBe(true);
});
it("keeps Spanish copy and saved outcomes available", () => {
  playerHook.mockReturnValue(
    playerState({
      options: {
        data: [{ ...saved, decision: "decline", reason: "salary_lower", nextSalary: 0 }],
        isPending: false,
        isError: false,
      },
    })
  );
  render(view("owner", "es"));
  expect(screen.getByText("Opción de jugador rechazada · Salida prevista")).toBeTruthy();
  expect(screen.getByText(/Política: salary-comparison-v1/)).toBeTruthy();
});
