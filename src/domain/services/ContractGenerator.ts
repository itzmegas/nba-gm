import { NBA_RULES } from "../constants/nba-rules";
import type { Player } from "../entities/Player";

export class ContractGenerator {
  calculateMaxSalary(player: Player): number {
    const yoe = player.yearsOfExperience;
    let multiplier: number;

    if (yoe >= 10) {
      multiplier = NBA_RULES.MAX_SALARY_TIERS.TIER_3; // 35%
    } else if (yoe >= 7) {
      multiplier = NBA_RULES.MAX_SALARY_TIERS.TIER_2; // 30%
    } else {
      multiplier = NBA_RULES.MAX_SALARY_TIERS.TIER_1; // 25%
    }

    return Math.floor(NBA_RULES.SALARY_CAP * multiplier);
  }
}
