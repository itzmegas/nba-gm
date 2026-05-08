import type { Contract } from "@/domain/entities/Contract";
import type { TradePackage, TradeValidationResult } from "@/domain/entities/Trade";
import type { ContractRepository } from "@/domain/repositories/ContractRepository";
import { TradeValidator } from "@/domain/services/TradeValidator";

export interface TradeExecutionResult {
  success: boolean;
  validationResult?: TradeValidationResult;
  executedAt?: Date;
  error?: string;
}

export class TradeEngine {
  private validator = new TradeValidator();

  constructor(private contractRepository: ContractRepository) {}

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

    // 2. Ejecutar el trade (actualizar contratos en DB)
    try {
      // Transferir jugadores de A a B
      for (const asset of packageA.outgoingAssets) {
        if (asset.type === "player" && asset.contract) {
          await this.contractRepository.update(gameId, asset.contract.id, {
            teamId: packageB.teamId,
          });
        }
      }

      // Transferir jugadores de B a A
      for (const asset of packageB.outgoingAssets) {
        if (asset.type === "player" && asset.contract) {
          await this.contractRepository.update(gameId, asset.contract.id, {
            teamId: packageA.teamId,
          });
        }
      }

      // Nota: Los picks del draft y cash considerations se manejarían en otra tabla

      return {
        success: true,
        executedAt: new Date(),
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
