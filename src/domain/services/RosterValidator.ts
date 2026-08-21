import { NBA_RULES } from "../constants/nba-rules";
import type { Contract } from "../entities/Contract";
import { RosterSizeError } from "../errors";

export class RosterValidator {
  validateRosterLimits(
    contracts: Contract[],
    isOffseason: boolean = false
  ): { isValid: boolean; errors: RosterSizeError[] } {
    const errors: RosterSizeError[] = [];
    const size = contracts.length;

    if (isOffseason) {
      if (size > NBA_RULES.ROSTER_LIMITS.OFFSEASON_MAX) {
        errors.push(
          new RosterSizeError(
            `Offseason roster size (${size}) exceeds maximum allowed (${NBA_RULES.ROSTER_LIMITS.OFFSEASON_MAX})`
          )
        );
      }
    } else {
      if (size < NBA_RULES.ROSTER_LIMITS.IN_SEASON_MIN) {
        errors.push(
          new RosterSizeError(
            `In-season roster size (${size}) is below minimum required (${NBA_RULES.ROSTER_LIMITS.IN_SEASON_MIN})`
          )
        );
      }
      if (size > NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX) {
        errors.push(
          new RosterSizeError(
            `In-season roster size (${size}) exceeds maximum allowed (${NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX})`
          )
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
