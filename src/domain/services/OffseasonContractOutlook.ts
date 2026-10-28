import type { GamePlayerContractState } from "@/domain/contracts/GameContract";
import type { Contract } from "@/domain/entities/Contract";
import {
  type OffseasonContractOutlook,
  OFFSEASON_CONTRACT_STATUS as STATUS,
} from "@/domain/entities/Offseason";

const OPTION_STATUS = {
  player: STATUS.PLAYER_OPTION,
  team: STATUS.TEAM_OPTION,
  none: STATUS.CONTINUING,
  unknown: STATUS.UNKNOWN,
} as const;

export function getOffseasonContractOutlook(
  contract: Contract | null,
  gameContract: GamePlayerContractState | null,
  seasonYear: number
): OffseasonContractOutlook {
  const nextYear = seasonYear + 1;
  const simulated = contract?.origin === "simulated-agreement";
  const unknown: OffseasonContractOutlook = {
    status: STATUS.UNKNOWN,
    nextSalary: null,
    estimated:
      !simulated && (gameContract?.estimated || gameContract?.agreement?.estimated || false),
  };

  if (gameContract && !simulated) {
    const agreement = gameContract.agreement;
    // Minimum-salary estimates establish salary coverage, not observed contract terms.
    if (!agreement || unknown.estimated) return unknown;
    const next = agreement.seasons.find(
      (season) =>
        season.startYear === nextYear &&
        (season.salaryAmount !== null ||
          season.optionKind === "player" ||
          season.optionKind === "team")
    );
    // Observed season rows (including estimates) do not establish an agreement's expiry.
    const endYear = agreement.endSeasonLabel ? Number(agreement.endSeasonLabel.slice(0, 4)) : null;
    if (endYear !== null && (endYear < seasonYear || (endYear === seasonYear && next)))
      return unknown;
    if (!next)
      return { ...unknown, status: endYear === seasonYear ? STATUS.EXPIRING : STATUS.UNKNOWN };
    return {
      status: OPTION_STATUS[next.optionKind],
      nextSalary: next.salaryAmount,
      estimated: agreement.estimated,
    };
  }

  if (
    !contract ||
    contract.compatibilityProjection ||
    contract.startYear > seasonYear ||
    contract.endYear < seasonYear
  )
    return unknown;
  if (contract.endYear === seasonYear) return { ...unknown, status: STATUS.EXPIRING };
  const optionNextYear = contract.endYear === nextYear;
  return {
    status:
      optionNextYear && contract.isPlayerOption && contract.isTeamOption
        ? STATUS.UNKNOWN
        : optionNextYear && contract.isPlayerOption
          ? STATUS.PLAYER_OPTION
          : optionNextYear && contract.isTeamOption
            ? STATUS.TEAM_OPTION
            : STATUS.CONTINUING,
    nextSalary:
      [
        contract.salaryY1,
        contract.salaryY2,
        contract.salaryY3,
        contract.salaryY4,
        contract.salaryY5,
      ][nextYear - contract.startYear] ?? null,
    estimated: false,
  };
}
