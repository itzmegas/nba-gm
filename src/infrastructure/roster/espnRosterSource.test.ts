import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentRosterForTeam } from "@/infrastructure/roster/espnRosterSource";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCurrentRosterForTeam", () => {
  it("validates and maps ESPN athletes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        status: "success",
        athletes: [
          {
            id: "3945274",
            firstName: "Luka",
            lastName: "Doncic",
            fullName: "Luka Doncic",
            displayHeight: "6' 6\"",
            displayWeight: "230 lbs",
            jersey: "77",
            position: { abbreviation: "PG" },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const roster = await fetchCurrentRosterForTeam({ nbaId: 1610612747, abbreviation: "LAL" });

    expect(roster).toEqual([
      {
        provider: "espn",
        sourceId: 3945274,
        payload: {
          first_name: "Luka",
          last_name: "Doncic",
          full_name: "Luka Doncic",
          position: "PG",
          height: "6' 6\"",
          weight: "230 lbs",
          jersey_number: "77",
        },
      },
    ]);
  });

  it("uses ESPN's non-standard team slug and rejects malformed data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "success", athletes: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchCurrentRosterForTeam({ nbaId: 1610612762, abbreviation: "UTA" })
    ).rejects.toThrow("invalid data for UTA");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/teams/utah/roster"),
      expect.objectContaining({ signal: undefined })
    );
  });
});
