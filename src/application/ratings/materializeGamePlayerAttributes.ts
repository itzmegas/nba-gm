import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSharedPlayerRatings } from "@/application/ratings/getSharedPlayerRatings";
import type { InitialPlayerAttributes } from "@/domain/ratings/InitialPlayerAttributes";
import type {
  PlayerRatingSourceCache,
  PlayerRatingSourceSnapshot,
} from "@/domain/ratings/PlayerRatingSourceCache";
import { fetchNba2kRatings } from "@/infrastructure/ratings/nba2kRatingsSource";
import { reconcilePlayerAttributes } from "@/infrastructure/ratings/reconcilePlayerAttributes";
import { SupabasePlayerRatingSourceCache } from "@/infrastructure/ratings/SupabasePlayerRatingSourceCache";

const rosterRowSchema = z.object({
  player_id: z.uuid(),
  players: z.object({
    full_name: z.string().trim().min(1),
    espn_id: z.number().int().positive().nullable(),
    height: z.string().nullable(),
    position: z.string().nullable(),
  }),
  teams: z.object({ abbreviation: z.string().regex(/^[A-Z]{2,3}$/) }).nullable(),
});

const materializationResultSchema = z.object({
  status: z.enum(["materialized", "already-materialized"]),
  playerCount: z.number().int().positive(),
  sourceVersionId: z.uuid(),
});

export interface MaterializeGamePlayerAttributesInput {
  gameId: string;
  ownerId: string;
  seasonYear: number;
  serviceClient: SupabaseClient;
  cache?: PlayerRatingSourceCache;
  fetchSnapshot?: (signal?: AbortSignal) => Promise<PlayerRatingSourceSnapshot>;
  signal?: AbortSignal;
}

const PAGE_SIZE = 500;

async function loadGameRoster(
  client: SupabaseClient,
  gameId: string,
  signal?: AbortSignal
): Promise<z.infer<typeof rosterRowSchema>[]> {
  const rows: z.infer<typeof rosterRowSchema>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    signal?.throwIfAborted();
    const { data, error } = await client
      .from("game_player_states")
      .select("player_id, players!inner(full_name, espn_id, height, position), teams(abbreviation)")
      .eq("game_id", gameId)
      .order("player_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("Failed to load game player roster");
    const page = z.array(rosterRowSchema).parse(data ?? []);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function toRpcRow(row: InitialPlayerAttributes) {
  return {
    playerId: row.playerId,
    origin: row.origin,
    matchMethod: row.matchMethod,
    attributes: row.attributes,
    sourceSlug: row.sourceSlug,
    sourceOverall: row.sourceOverall,
    generatorVersion: row.generatorVersion,
    identityEvidence: row.evidence,
  };
}

export async function materializeGamePlayerAttributes(
  input: MaterializeGamePlayerAttributesInput
): Promise<z.infer<typeof materializationResultSchema>> {
  const gameId = z.uuid().parse(input.gameId);
  const ownerId = z.uuid().parse(input.ownerId);
  const seasonYear = z.number().int().min(1900).max(3000).parse(input.seasonYear);
  const roster = await loadGameRoster(input.serviceClient, gameId, input.signal);
  if (roster.length === 0) throw new Error("Game roster is empty");

  const cache = input.cache ?? new SupabasePlayerRatingSourceCache(input.serviceClient);
  const fetchSnapshot =
    input.fetchSnapshot ??
    ((signal?: AbortSignal) => {
      const apiKey = process.env.NBA_2K_API_KEY;
      if (!apiKey) throw new Error("NBA_2K_API_KEY is required for player attributes");
      return fetchNba2kRatings(signal, apiKey);
    });
  const shared = await getSharedPlayerRatings({ cache, fetchSnapshot }, input.signal);
  const attributes = reconcilePlayerAttributes(
    shared.value.snapshot,
    roster.map((row) => ({
      playerId: row.player_id,
      fullName: row.players.full_name,
      espnId: row.players.espn_id,
      teamAbbreviation: row.teams?.abbreviation ?? null,
      height: row.players.height,
      position: row.players.position,
    }))
  );
  const { data, error } = await input.serviceClient.rpc("materialize_game_player_attributes", {
    p_game_id: gameId,
    p_owner_id: ownerId,
    p_season_year: seasonYear,
    p_source_version_id: shared.value.versionId,
    p_rows: attributes.map(toRpcRow),
  });
  if (error) throw new Error("Failed to materialize game player attributes");
  const result = materializationResultSchema.parse(data);
  if (result.playerCount !== roster.length) {
    throw new Error("Materialized player attribute count does not match game roster");
  }
  return result;
}
