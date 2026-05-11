import { describe, expect, it } from "vitest";
import { playerStateSchema } from "@/domain/entities/PlayerState";

const UUIDS = {
  id: "44444444-4444-4444-8444-444444444444",
  gameId: "55555555-5555-4555-8555-555555555555",
  playerId: "66666666-6666-4666-8666-666666666666",
  teamId: "77777777-7777-4777-8777-777777777777",
} as const;

const buildValidPlayerStateInput = () => ({
  id: UUIDS.id,
  gameId: UUIDS.gameId,
  playerId: UUIDS.playerId,
  teamId: UUIDS.teamId,
  morale: 75,
  fatigue: 25,
  isActive: true,
  isInjured: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
});

describe("PlayerState entity", () => {
  describe("playerStateSchema", () => {
    it("passes with valid player state", () => {
      const result = playerStateSchema.safeParse(buildValidPlayerStateInput());
      expect(result.success).toBe(true);
    });

    it("fails when morale is below 0", () => {
      const result = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        morale: -1,
      });

      expect(result.success).toBe(false);
    });

    it("fails when morale is above 100", () => {
      const result = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        morale: 101,
      });

      expect(result.success).toBe(false);
    });

    it("passes when morale is on boundaries 0 and 100", () => {
      const lowResult = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        morale: 0,
      });
      const highResult = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        morale: 100,
      });

      expect(lowResult.success).toBe(true);
      expect(highResult.success).toBe(true);
    });

    it("fails when fatigue is below 0", () => {
      const result = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        fatigue: -1,
      });

      expect(result.success).toBe(false);
    });

    it("fails when fatigue is above 100", () => {
      const result = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        fatigue: 101,
      });

      expect(result.success).toBe(false);
    });

    it("passes when fatigue is on boundaries 0 and 100", () => {
      const lowResult = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        fatigue: 0,
      });
      const highResult = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        fatigue: 100,
      });

      expect(lowResult.success).toBe(true);
      expect(highResult.success).toBe(true);
    });

    it("fails when required fields are missing", () => {
      const result = playerStateSchema.safeParse({
        id: UUIDS.id,
      });

      expect(result.success).toBe(false);
    });

    it("supports optional teamId both with and without value", () => {
      const withTeam = playerStateSchema.safeParse(buildValidPlayerStateInput());
      const withoutTeam = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        teamId: undefined,
      });

      expect(withTeam.success).toBe(true);
      expect(withoutTeam.success).toBe(true);
    });

    it("requires isActive and isInjured as booleans", () => {
      const validResult = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        isActive: false,
        isInjured: true,
      });
      const invalidResult = playerStateSchema.safeParse({
        ...buildValidPlayerStateInput(),
        isActive: "true",
        isInjured: 0,
      });

      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);
    });
  });
});
