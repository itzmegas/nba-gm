import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  StaleCareerError,
  usePickDraftTeam,
  useResolveEvent,
  useRetireCareer,
  useRollEvent,
} from "@/application/hooks/career/useCareer";
import { SupabaseCareerSaveRepository } from "@/infrastructure/repositories/SupabaseCareerSaveRepository";

const id = "11111111-1111-4111-8111-111111111111",
  userId = "22222222-2222-4222-8222-222222222222",
  teamId = "33333333-3333-4333-8333-333333333333";
const event = JSON.parse(
  '{"id":"pending","kind":"rivalry","prompt":"P","options":[{"label":"A","effects":{"overallDelta":1,"ageDelta":1}},{"label":"B","effects":{"overallDelta":1,"ageDelta":1}}]}'
) as unknown;
const row = JSON.parse(
  `{"id":"${id}","user_id":"${userId}","first_name":"A","last_name":"B","position":"PG","college":"Duke","current_age":18,"current_overall":60,"events_resolved":0,"stage":"nba","current_team_id":"${teamId}","pending_event":${JSON.stringify(event)},"created_at":"2026-01-01","updated_at":"2026-01-01"}`
) as unknown;
type Call = { table: string; operation: string; filters: unknown[][]; payload?: unknown };
const calls: Call[] = [];
let result: unknown = row;
const client = {
  auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
  from: (table: string) => {
    const call: Call = { table, operation: "select", filters: [] };
    calls.push(call);
    const builder = new Proxy(
      {},
      {
        get: (_, property: string | symbol) => {
          const key = String(property);
          return (...args: unknown[]) => {
            if (key === "insert" || key === "update") {
              call.operation = key;
              call.payload = args[0];
            } else if (["eq", "is", "neq"].includes(key)) call.filters.push(args);
            if (["order", "maybeSingle", "single"].includes(key))
              return Promise.resolve({
                data: key === "maybeSingle" ? result : key === "single" ? row : [row],
                error: null,
              });
            return builder;
          };
        },
      }
    );
    return builder;
  },
} as unknown as SupabaseClient;
const invalidations = { invalidateQueries: vi.fn(async () => undefined) };
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => client }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => invalidations,
  useMutation: (options: { mutationFn: (input: unknown) => Promise<unknown> }) => ({
    mutateAsync: options.mutationFn,
  }),
}));
describe("career runtime boundaries", () => {
  it("scopes repository reads/creates and never touches GM tables", async () => {
    const repo = new SupabaseCareerSaveRepository(client);
    await repo.getByUserId(userId);
    await repo.create({ userId, firstName: "A", lastName: "B", position: "PG", college: "Duke" });
    expect(calls.every((call) => call.table === "career_saves")).toBe(true);
    expect(calls[0].filters).toContainEqual(["user_id", userId]);
    expect(calls[1].payload).toMatchObject({ user_id: userId, current_overall: 60 });
  });
  it("emits narrow guards and reports zero-row mutations as stale", async () => {
    calls.length = 0;
    await useRollEvent(id).mutateAsync();
    expect(calls[1].filters).toContainEqual(["pending_event", null]);
    expect(calls[1].filters).toContainEqual(["stage", "nba"]);
    calls.length = 0;
    await useResolveEvent(id).mutateAsync({ optionIndex: 0 });
    expect(calls[1].filters).toContainEqual(["pending_event->>id", "pending"]);
    expect(calls[1].payload).toMatchObject({ events_resolved: 1 });
    calls.length = 0;
    await usePickDraftTeam(id).mutateAsync({
      teamId,
      offerIds: [
        teamId,
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
      ],
    });
    expect(calls[0].filters).toContainEqual(["stage", "draft"]);
    result = null;
    await expect(useRetireCareer(id).mutateAsync()).rejects.toBeInstanceOf(StaleCareerError);
    expect(invalidations.invalidateQueries).toHaveBeenCalled();
  });
});
