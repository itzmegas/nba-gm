import { readFile } from "node:fs/promises";
import { getNba2kRatingCoverage } from "@/infrastructure/ratings/nba2kRatingCoverage";
import { fetchNba2kRatings } from "@/infrastructure/ratings/nba2kRatingsSource";

try {
  if (process.argv.length > 3) {
    throw new Error("Usage: bun scripts/dry-run-player-attributes.ts [roster.json]");
  }
  const rosterPath = process.argv[2];
  const roster: unknown = rosterPath ? JSON.parse(await readFile(rosterPath, "utf8")) : null;
  const { players, ...metadata } = await fetchNba2kRatings(AbortSignal.timeout(120_000));
  const coverage = rosterPath ? getNba2kRatingCoverage({ ...metadata, players }, roster) : null;
  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        writeOperationCount: 0,
        ...metadata,
        validPlayerCount: players.length,
        coverage,
        readyForImport: false,
      },
      null,
      2
    )
  );
  if (coverage && coverage.unresolvedCount > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Ratings dry run failed.");
  process.exitCode = 1;
}
