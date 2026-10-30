import { z } from "zod";
import { playerProfileHref } from "@/components/league/navigation";
import { POSITION } from "@/domain/entities/Player";

const filtersSchema = z.object({
  q: z.string().max(120).catch(""),
  teamId: z.union([z.uuid(), z.enum(["all", "free"])]).catch("all"),
  position: z.union([z.literal("all"), z.enum(POSITION)]).catch("all"),
  status: z.enum(["all", "active", "inactive"]).catch("all"),
  sort: z.enum(["name", "overall"]).catch("name"),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
  selected: z.uuid().catch(""),
});

export function parsePlayersFilters(queryString: string) {
  return filtersSchema.parse(Object.fromEntries(new URLSearchParams(queryString)));
}

export function playersHref(gameId: string, queryString = "") {
  const filters = parsePlayersFilters(queryString);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== "all" && value !== "name" && value !== 1)
      query.set(key, String(value));
  }
  return `/games/${encodeURIComponent(gameId)}/dashboard/league/players${query.size ? `?${query}` : ""}`;
}

export function directoryPlayerHref(gameId: string, playerId: string, queryString: string) {
  const query = new URLSearchParams({ playersReturn: "1", playersReturnQuery: queryString });
  return `${playerProfileHref(gameId, playerId)}?${query}`;
}
