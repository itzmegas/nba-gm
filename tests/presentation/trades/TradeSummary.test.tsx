// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { formatSalary, formatSignedSalary } from "@/components/trades/format";
import { TradeSummary } from "@/components/trades/trade-summary";

const pick = (id: string, year: number) => ({
  id,
  gameId: "game",
  draftPickId: id,
  ownerTeamId: id,
  isTransferable: true,
  pick: { id, draftYear: year, draftRound: 1, originalTeamId: id },
});
const details = (teamId: string) => ({
  teamId,
  teamName: teamId,
  outgoingSalary: 0,
  incomingSalary: 0,
  salaryDelta: 0,
  rosterSizeAfter: 14,
  isOverCapAfter: false,
  isOverHardCapAfter: false,
  newTotalSalary: 0,
});
const props: ComponentProps<typeof TradeSummary> = {
  teamAName: "Kings",
  teamBName: "Nuggets",
  packageA: {
    teamId: "A",
    teamName: "Kings",
    outgoingAssets: [{ type: "pick", pickId: "a" }],
    incomingAssets: [],
  },
  packageB: {
    teamId: "B",
    teamName: "Nuggets",
    outgoingAssets: [{ type: "pick", pickId: "b" }],
    incomingAssets: [],
  },
  pickById: new Map([
    ["a", pick("a", 2027)],
    ["b", pick("b", 2028)],
  ]),
  playerStateByPlayerId: new Map(),
  executionError: null,
  isExecuting: false,
  onExecute: vi.fn(),
  seasonYear: 2026,
};

describe("TradeSummary", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows both incoming pick packages and only enables validated bilateral execution", () => {
    const { rerender } = render(
      <I18nProvider locale="en">
        <TradeSummary {...props} />
      </I18nProvider>
    );
    const exchange = screen.getByRole("region", { name: "Proposed Exchange" });
    expect(within(exchange).getByText("2028 R1")).toBeTruthy();
    expect(within(exchange).getByText("2027 R1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Execute trade" }).hasAttribute("disabled")).toBe(
      true
    );
    rerender(
      <I18nProvider locale="en">
        <TradeSummary
          {...props}
          simulation={{
            isValid: true,
            errors: [],
            warnings: [],
            details: { teamA: details("A"), teamB: details("B") },
          }}
        />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Execute trade" }));
    expect(props.onExecute).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Financial Impact" })).toBeTruthy();
    expect(screen.queryByText(/GM Negotiation|Counteroffer|Propose Trade/)).toBeNull();
  });

  it("preserves validator warnings, execution errors and pending lock in Spanish", () => {
    render(
      <I18nProvider locale="es">
        <TradeSummary
          {...props}
          isExecuting
          executionError="Server restriction"
          simulation={{
            isValid: false,
            errors: [],
            warnings: ["Roster warning"],
            details: { teamA: details("A"), teamB: details("B") },
          }}
        />
      </I18nProvider>
    );
    expect(screen.getByRole("heading", { name: "Legalidad del traspaso" })).toBeTruthy();
    expect(screen.getByText("Roster warning")).toBeTruthy();
    expect(screen.getByText("Server restriction").getAttribute("role")).toBe("alert");
    expect(screen.getByRole("button", { name: "Ejecutando…" }).hasAttribute("disabled")).toBe(true);
  });

  it("does not confuse known zero salary with missing salary", () => {
    expect(formatSalary(0)).toBe("$0");
    expect(formatSignedSalary(0)).toBe("$0");
    expect(formatSalary(undefined)).toBe("—");
    expect(formatSalary(null)).toBe("—");
  });
});
