import { describe, expect, it } from "vitest";
import { scheduledGameSchema } from "@/domain/entities/ScheduledGame";

const validScheduledGame = {
  id: "11111111-1111-4111-8111-111111111111",
  gameId: "22222222-2222-4222-8222-222222222222",
  date: "2026-10-15",
  homeTeamId: "33333333-3333-4333-8333-333333333333",
  awayTeamId: "44444444-4444-4444-8444-444444444444",
  status: "scheduled",
};

describe("scheduledGameSchema", () => {
  it("accepts a scheduled game", () => {
    expect(scheduledGameSchema.safeParse(validScheduledGame).success).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(
      scheduledGameSchema.safeParse({ ...validScheduledGame, status: "cancelled" }).success
    ).toBe(false);
  });
});
