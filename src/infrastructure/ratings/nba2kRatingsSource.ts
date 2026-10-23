import { createHash } from "node:crypto";
import { z } from "zod";
import type { PlayerAttributes } from "@/domain/entities/PlayerAttributes";
import type { PlayerRatingSourceSnapshot } from "@/domain/ratings/PlayerRatingSourceCache";

const ratingSchema = z.number().int().min(0).max(99);
const attributesSchema = z.object({
  closeShot: ratingSchema,
  midRangeShot: ratingSchema,
  threePointShot: ratingSchema,
  freeThrow: ratingSchema,
  drawFoul: ratingSchema,
  ballHandle: ratingSchema,
  passAccuracy: ratingSchema,
  interiorDefense: ratingSchema,
  perimeterDefense: ratingSchema,
  steal: ratingSchema,
  block: ratingSchema,
  offensiveRebound: ratingSchema,
  defensiveRebound: ratingSchema,
  stamina: ratingSchema,
}) satisfies z.ZodType<PlayerAttributes>;

const sourcePlayerSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1),
  team: z.string().trim().min(1),
  teamType: z.literal("curr"),
  gameVersion: z.literal("2K27"),
  lastUpdated: z.iso.datetime(),
  overall: ratingSchema,
  attributes: z.unknown(),
  height: z.string().max(32).nullish(),
  positions: z.array(z.string().min(1).max(8)).max(5).nullish(),
});
const playerRatingSchema = sourcePlayerSchema.extend({ attributes: attributesSchema });

const pageSchema = z.object({
  success: z.literal(true),
  data: z.array(sourcePlayerSchema).min(1).max(100),
  meta: z.object({
    pagination: z.object({
      hasMore: z.boolean(),
      nextCursor: z
        .string()
        .regex(/^\d+$/)
        .nullish()
        .transform((value) => value ?? null),
      count: z.number().int().min(1).max(100),
      total: z.number().int().min(1).max(10_000),
    }),
  }),
});

const bulkSchema = z.object({
  success: z.literal(true),
  data: z.array(sourcePlayerSchema).min(1).max(10_000),
  meta: z.object({
    count: z.number().int().positive(),
    total: z.number().int().positive().max(10_000),
  }),
});

export type Nba2kPlayerRating = z.infer<typeof playerRatingSchema>;

interface ExcludedPlayerRating {
  slug: string;
  name: string;
  invalidAttributes: string[];
}

export const NBA2K_RATINGS_URL =
  "https://api.nba2kapi.com/api/public/players?teamType=curr&limit=100";
export const NBA2K_BULK_RATINGS_URL = "https://api.nba2kapi.com/api/players/bulk?teamType=curr";

function contentHash(snapshot: Pick<PlayerRatingSourceSnapshot, "players" | "excludedPlayers">) {
  const bySlug = (a: { slug: string }, b: { slug: string }) => a.slug.localeCompare(b.slug);
  return createHash("sha256")
    .update(
      JSON.stringify({
        players: snapshot.players.toSorted(bySlug),
        excludedPlayers: snapshot.excludedPlayers.toSorted(bySlug),
      })
    )
    .digest("hex");
}

export const playerRatingSourceSnapshotSchema = z
  .object({
    source: z.literal("nba2kapi"),
    sourceUrl: z.literal(NBA2K_BULK_RATINGS_URL),
    gameVersion: z.literal("2K27"),
    observedAt: z.iso.datetime(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    requestCount: z.literal(1),
    players: z.array(playerRatingSchema).min(1).max(10_000),
    excludedPlayers: z
      .array(
        z.object({
          slug: z.string().min(1),
          name: z.string().trim().min(1),
          invalidAttributes: z.array(z.string().max(80)).min(1).max(14),
        })
      )
      .max(9_999),
  })
  .superRefine((snapshot, context) => {
    const slugs = [...snapshot.players, ...snapshot.excludedPlayers].map(({ slug }) => slug);
    if (slugs.length > 10_000 || new Set(slugs).size !== slugs.length) {
      context.addIssue({ code: "custom", message: "Invalid snapshot identities" });
    }
    if (contentHash(snapshot) !== snapshot.contentHash) {
      context.addIssue({ code: "custom", message: "Snapshot content hash mismatch" });
    }
  });

async function requestRatings(
  url: string,
  signal?: AbortSignal,
  apiKey?: string
): Promise<unknown> {
  const timeout = AbortSignal.timeout(20_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, {
      signal: requestSignal,
      headers: apiKey ? { "X-API-Key": apiKey } : undefined,
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new Error(
      requestSignal.aborted ? "NBA 2K ratings request aborted" : "NBA 2K ratings request failed"
    );
  }
  if (!response.ok) throw new Error(`NBA 2K ratings request failed: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error("Invalid NBA 2K ratings response");
  }
}

function buildSnapshot(
  rows: z.infer<typeof sourcePlayerSchema>[],
  sourceUrl: string,
  requestCount: number
) {
  const players: Nba2kPlayerRating[] = [];
  const excludedPlayers: ExcludedPlayerRating[] = [];
  const slugs = new Set<string>();
  for (const player of rows) {
    if (slugs.has(player.slug)) throw new Error("Duplicate NBA 2K current-player slugs");
    slugs.add(player.slug);
    const attributes = attributesSchema.safeParse(player.attributes);
    if (attributes.success) players.push({ ...player, attributes: attributes.data });
    else
      excludedPlayers.push({
        slug: player.slug,
        name: player.name,
        invalidAttributes: attributes.error.issues.map(({ path }) => path.join(".")),
      });
  }
  return {
    source: "nba2kapi" as const,
    sourceUrl,
    gameVersion: "2K27" as const,
    observedAt: new Date().toISOString(),
    contentHash: contentHash({ players, excludedPlayers }),
    requestCount,
    players,
    excludedPlayers,
  };
}

export async function fetchNba2kRatings(signal?: AbortSignal, apiKey?: string) {
  if (apiKey !== undefined) {
    if (!apiKey.trim()) throw new Error("NBA_2K_API_KEY must not be empty");
    const parsed = bulkSchema.safeParse(
      await requestRatings(NBA2K_BULK_RATINGS_URL, signal, apiKey)
    );
    if (!parsed.success) throw new Error("Invalid NBA 2K ratings response");
    const { data, meta } = parsed.data;
    if (meta.count !== data.length || meta.total !== data.length) {
      throw new Error("Incomplete NBA 2K ratings download");
    }
    return buildSnapshot(data, NBA2K_BULK_RATINGS_URL, 1);
  }

  const rows: z.infer<typeof sourcePlayerSchema>[] = [];
  const slugs = new Set<string>();
  const cursors = new Set(["0"]);
  let cursor: string | null = "0";
  let total: number | undefined;
  let requestCount = 0;

  do {
    const parsed = pageSchema.safeParse(
      await requestRatings(`${NBA2K_RATINGS_URL}&cursor=${cursor}`, signal)
    );
    if (!parsed.success) throw new Error("Invalid NBA 2K ratings response");
    const { data, meta } = parsed.data;
    const page = meta.pagination;
    total ??= page.total;
    for (const player of data) {
      if (slugs.has(player.slug)) throw new Error("Duplicate NBA 2K current-player slugs");
      slugs.add(player.slug);
      rows.push(player);
    }
    requestCount += 1;
    if (page.total !== total || page.count !== data.length || slugs.size > total) {
      throw new Error("NBA 2K ratings pagination changed during download");
    }
    if (!page.hasMore) {
      if (page.nextCursor !== null || slugs.size !== total) {
        throw new Error("Incomplete NBA 2K ratings download");
      }
    } else if (page.nextCursor === null || cursors.has(page.nextCursor)) {
      throw new Error("Invalid NBA 2K ratings pagination cursor");
    }
    cursor = page.nextCursor;
    if (cursor !== null) cursors.add(cursor);
  } while (cursor !== null);

  return buildSnapshot(rows, NBA2K_RATINGS_URL, requestCount);
}
