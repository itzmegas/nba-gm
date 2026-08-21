import type { Contract } from "@/domain/entities/Contract";
import type { ExecutedTrade, TradePackage, TradeValidationResult } from "@/domain/entities/Trade";
import type { TradeRepository } from "@/domain/repositories/TradeRepository";
import { TradeValidator } from "@/domain/services/TradeValidator";

export interface TradeExecutionResult {
  success: boolean;
  validationResult?: TradeValidationResult;
  trade?: ExecutedTrade;
  executedAt?: Date;
  error?: string;
}

export class TradeEngine {
  private validator = new TradeValidator();

  constructor(private tradeRepository: TradeRepository) {}

  async executeTrade(
    gameId: string,
    teamAContracts: Contract[],
    teamBContracts: Contract[],
    packageA: TradePackage,
    packageB: TradePackage,
    shouldValidate: boolean = true
  ): Promise<TradeExecutionResult> {
    // 1. Validar el trade
    if (shouldValidate) {
      const validation = this.validator.validateTrade(
        teamAContracts,
        teamBContracts,
        packageA,
        packageB
      );

      if (!validation.isValid) {
        return {
          success: false,
          validationResult: validation,
          error: `Trade validation failed: ${validation.errors.join(", ")}`,
        };
      }

      // Si hay warnings, loguearlos pero continuar
      if (validation.warnings.length > 0) {
        console.warn("Trade warnings:", validation.warnings);
      }
    }

    try {
      const trade = await this.tradeRepository.execute(
        gameId,
        packageA.teamId,
        packageB.teamId,
        packageA,
        packageB
      );

      return {
        success: true,
        trade,
        executedAt: trade.executedAt,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to execute trade: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // Método para simular un trade sin ejecutarlo (útil para la UI)
  simulateTrade(
    _gameId: string,
    teamAContracts: Contract[],
    teamBContracts: Contract[],
    packageA: TradePackage,
    packageB: TradePackage
  ): TradeValidationResult {
    return this.validator.validateTrade(teamAContracts, teamBContracts, packageA, packageB);
  }
}
