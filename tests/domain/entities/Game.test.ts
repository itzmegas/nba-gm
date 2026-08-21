import { describe, expect, it } from "vitest";
import { GAME_STATUS, type GameStatus, gameSchema } from "@/domain/entities/Game";
import { SEASON_ERA_IDS } from "@/domain/entities/SeasonEra";

const UUIDS = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  selectedTeamId: "33333333-3333-4333-8333-333333333333",
} as const;

const buildValidGameInput = () => ({
  id: UUIDS.id,
  userId: UUIDS.userId,
  name: "Mi Asociación",
  selectedTeamId: UUIDS.selectedTeamId,
  seasonYear: 2026,
  seasonEraId: SEASON_ERA_IDS.MODERN,
  simulationDate: new Date("2026-10-01T00:00:00.000Z"),
  status: GAME_STATUS.ACTIVE,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
});

describe("Game entity", () => {
  describe("GAME_STATUS", () => {
    it("exposes expected constant values", () => {
      expect(GAME_STATUS).toEqual({
        INITIALIZING: "initializing",
        ACTIVE: "active",
        ARCHIVED: "archived",
        DELETED: "deleted",
      });
    });

    it("allows GameStatus extraction from constants", () => {
      const status: GameStatus = GAME_STATUS.ARCHIVED;
      expect(status).toBe("archived");
    });
  });

  describe("gameSchema", () => {
    it("passes with valid game", () => {
      const result = gameSchema.safeParse(buildValidGameInput());
      expect(result.success).toBe(true);
    });

    it("fails when status is not in enum", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        status: "paused",
      });

      expect(result.success).toBe(false);
    });

    it("fails when name is longer than 80 chars", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        name: "a".repeat(81),
      });

      expect(result.success).toBe(false);
    });

    it("fails when name is empty", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        name: "",
      });

      expect(result.success).toBe(false);
    });

    it("fails when id is invalid uuid", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        id: "invalid-uuid",
      });

      expect(result.success).toBe(false);
    });

    it("fails when userId is invalid uuid", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        userId: "invalid-uuid",
      });

      expect(result.success).toBe(false);
    });

    it("fails when selectedTeamId is invalid uuid", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        selectedTeamId: "invalid-uuid",
      });

      expect(result.success).toBe(false);
    });

    it("accepts a persisted historical season era", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        seasonEraId: SEASON_ERA_IDS.LEBRON,
      });

      expect(result.success).toBe(true);
    });

    it("fails when seasonEraId is not a configured era", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        seasonEraId: "future",
      });

      expect(result.success).toBe(false);
    });

    it("fails for deleted game without deletedAt", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        status: GAME_STATUS.DELETED,
      });

      expect(result.success).toBe(false);
    });

    it("passes for deleted game with deletedAt", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        status: GAME_STATUS.DELETED,
        deletedAt: new Date("2026-02-01T00:00:00.000Z"),
      });

      expect(result.success).toBe(true);
    });

    it("fails for active game with deletedAt", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        status: GAME_STATUS.ACTIVE,
        deletedAt: new Date("2026-02-01T00:00:00.000Z"),
      });

      expect(result.success).toBe(false);
    });

    it("passes for active game without deletedAt", () => {
      const result = gameSchema.safeParse({
        ...buildValidGameInput(),
        status: GAME_STATUS.ACTIVE,
      });

      expect(result.success).toBe(true);
    });
  });
});
