import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCurrentRosterForTeam,
  resetEspnRosterSourceForTests,
} from "@/infrastructure/roster/espnRosterSource";

afterEach(() => {
  vi.unstubAllGlobals();
  resetEspnRosterSourceForTests();
});

describe("fetchCurrentRosterForTeam", () => {
  const currentWebRosterFixture = {
    coach: [],
    positionGroups: [
      {
        displayName: "Guards",
        athletes: [
          {
            id: "3945274",
            firstName: "Luka",
            lastName: "Doncic",
            fullName: "Luka Doncic",
            jersey: "77",
            position: { abbreviation: "PG" },
            experience: { years: 8 },
          },
        ],
      },
      {
        displayName: "Centers",
        athletes: [
          {
            id: "4065648",
            firstName: "Jaxson",
            lastName: "Hayes",
            fullName: "Jaxson Hayes",
            position: { abbreviation: "C" },
            experience: { years: 6 },
          },
        ],
      },
    ],
    season: { year: 2026 },
    team: { abbreviation: "LAL" },
  };

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
            experience: { years: 8 },
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
          years_of_experience: 8,
        },
      },
    ]);
  });

  it("flattens the current positionGroups athletes shape in order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(currentWebRosterFixture));
    vi.stubGlobal("fetch", fetchMock);

    const roster = await fetchCurrentRosterForTeam({ nbaId: 1610612747, abbreviation: "LAL" });

    expect(roster).toEqual([
      expect.objectContaining({
        provider: "espn",
        sourceId: 3945274,
        payload: expect.objectContaining({
          full_name: "Luka Doncic",
          years_of_experience: 8,
        }),
      }),
      expect.objectContaining({
        provider: "espn",
        sourceId: 4065648,
        payload: expect.objectContaining({
          full_name: "Jaxson Hayes",
          years_of_experience: 6,
        }),
      }),
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

  it("rejects a current response with no athletes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ coach: [], positionGroups: [{ displayName: "Guards", athletes: [] }] })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchCurrentRosterForTeam({ nbaId: 1610612747, abbreviation: "LAL" })
    ).rejects.toThrow("invalid data for LAL");
  });

  it("uses legacy only after web-primary failure", async () => {
    const athlete = {
      id: "1",
      firstName: "A",
      lastName: "B",
      fullName: "A B",
      experience: { years: 2 },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ status: "success", athletes: [athlete] }));
    vi.stubGlobal("fetch", fetchMock);
    const roster = await fetchCurrentRosterForTeam({ nbaId: 1, abbreviation: "LAL" });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("site.web.api.espn.com");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("site.api.espn.com");
    expect(roster[0]?.payload.years_of_experience).toBe(2);
  });

  it("memoizes legacy denial without poisoning unrelated web success", async () => {
    const athlete = { id: "2", firstName: "C", lastName: "D", fullName: "C D" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 500 }))
      .mockResolvedValueOnce(Response.json({}, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ athletes: [{ items: [athlete] }] }))
      .mockResolvedValueOnce(Response.json({}, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCurrentRosterForTeam({ nbaId: 1, abbreviation: "LAL" })).rejects.toThrow(
      "403"
    );
    expect(await fetchCurrentRosterForTeam({ nbaId: 2, abbreviation: "BOS" })).toHaveLength(1);
    await expect(fetchCurrentRosterForTeam({ nbaId: 3, abbreviation: "NYK" })).rejects.toThrow(
      "500"
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
