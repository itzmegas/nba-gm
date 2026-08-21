import type { PickInventory } from "@/domain/entities/Trade";

export function formatSalary(amount: number | null | undefined): string {
  if (!amount) return "—";
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `$${amount.toLocaleString("en-US")}`;
}

export function formatSignedSalary(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${formatSalary(Math.abs(delta))}`;
}

export function formatPick(pick: PickInventory): string {
  const protection = pick.pick.protection ? ` (${pick.pick.protection})` : "";
  return `${pick.pick.draftYear} R${pick.pick.draftRound}${protection}`;
}
