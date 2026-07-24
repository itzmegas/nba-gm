import { describe, expect, it } from "vitest";
import { pickNbaOffers, selectEvent } from "@/domain/constants/career-events";
import {
  applyChoice,
  CAREER_STAGE,
  type CareerSave,
  draftPickInputSchema,
  parseSupabaseRow,
} from "@/domain/entities/CareerSave";

const IDS = Array.from(
  { length: 6 },
  (_, i) => `00000000-0000-4000-8000-${i.toString().padStart(12, "0")}`
);
const pendingEvent = {
  id: "event-1",
  kind: "rivalry" as const,
  prompt: "Choose",
  options: [
    { label: "Good", effects: { overallDelta: 2, ageDelta: 1, nextStage: CAREER_STAGE.DRAFT } },
    { label: "Bad", effects: { overallDelta: -5, ageDelta: 1 } },
  ],
};
const save = (overrides: Partial<CareerSave> = {}): CareerSave => ({
  id: IDS[0],
  userId: IDS[1],
  firstName: "Alex",
  lastName: "Carter",
  position: "PG",
  college: "Duke",
  currentAge: 18,
  currentOverall: 60,
  eventsResolved: 0,
  stage: CAREER_STAGE.COLLEGE,
  currentTeamId: null,
  pendingEvent,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  ...overrides,
});
const row = {
  id: IDS[0],
  user_id: IDS[1],
  first_name: "Alex",
  last_name: "Carter",
  position: "PG",
  college: "Duke",
  current_age: 18,
  current_overall: 60,
  events_resolved: 0,
  stage: "college",
  current_team_id: null,
  pending_event: pendingEvent,
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
};
const teams = (ids: string[]) =>
  ids.map((id, i) => ({
    id,
    nbaId: i,
    name: `Team ${i}`,
    city: `City ${i}`,
    abbreviation: `T${i}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

describe("CareerSave domain", () => {
  it("applies progression and stage transition", () =>
    expect(applyChoice(save(), 0)).toMatchObject({
      currentOverall: 62,
      currentAge: 19,
      stage: CAREER_STAGE.DRAFT,
    }));
  it("clamps overall at both bounds", () => {
    expect(applyChoice(save({ currentOverall: 40 }), 1).currentOverall).toBe(40);
    const high = {
      ...pendingEvent,
      options: [
        { label: "High", effects: { overallDelta: 5, ageDelta: 1 } },
        pendingEvent.options[1],
      ],
    };
    expect(applyChoice(save({ currentOverall: 98, pendingEvent: high }), 0).currentOverall).toBe(
      99
    );
  });
  it("parses valid rows and rejects malformed event JSONB", () => {
    expect(parseSupabaseRow(row)).toMatchObject({
      userId: IDS[1],
      currentTeamId: null,
      pendingEvent,
    });
    expect(() =>
      parseSupabaseRow({ ...row, pending_event: { kind: "bogus", prompt: 123 } })
    ).toThrowError();
  });
  it("selects a deterministic stage-filtered event", () => {
    const first = selectEvent(IDS[0], 18, 60, CAREER_STAGE.COLLEGE);
    expect(selectEvent(IDS[0], 18, 60, CAREER_STAGE.COLLEGE)).toEqual(first);
    expect(first.appliesTo).toContain(CAREER_STAGE.COLLEGE);
  });
  it("returns three distinct deterministic NBA offers", () => {
    const catalog = teams(IDS.slice(2));
    const first = pickNbaOffers(IDS[0], catalog);
    expect(first).toHaveLength(3);
    expect(new Set(first.map(({ id }) => id)).size).toBe(3);
    expect(pickNbaOffers(IDS[0], catalog)).toEqual(first);
  });
  it("rejects too-small and duplicate-heavy catalogs", () => {
    expect(() => pickNbaOffers(IDS[0], teams(IDS.slice(2, 4)))).toThrowError();
    expect(() =>
      pickNbaOffers(IDS[0], teams(Array.from({ length: 30 }, (_, i) => IDS[2 + (i % 2)])))
    ).toThrowError();
  });
  it("rejects duplicate draft offer IDs", () =>
    expect(() =>
      draftPickInputSchema.parse({ teamId: IDS[3], offerIds: [IDS[3], IDS[3], IDS[4]] })
    ).toThrowError());
});
