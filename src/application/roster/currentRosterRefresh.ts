import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const ROSTER_REFRESH_STATUS = {
  SUCCESS: "success",
  FAILED: "failed",
} as const;

export type RosterRefreshStatus =
  (typeof ROSTER_REFRESH_STATUS)[keyof typeof ROSTER_REFRESH_STATUS];

export interface RosterRefreshResult {
  runId: string;
  status: RosterRefreshStatus;
  teamCount: number;
  error?: string;
}

export interface RosterEntry {
  nbaId: number;
  payload: Record<string, unknown>;
}

export interface RosterRefreshDependencies {
  gameId: string;
  selectedTeamId: string;
  authenticatedClient: SupabaseClient;
  serviceClient: SupabaseClient;
  fetchTeamRoster: (
    teamNbaId: number,
    signal?: AbortSignal
  ) => Promise<RosterEntry[]> | RosterEntry[];
  teamTimeoutMs?: number;
  maxRetries?: number;
  overallTimeoutMs?: number;
}

const inputSchema = z.object({
  gameId: z.uuid(),
  selectedTeamId: z.uuid(),
});

const TEAM_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const OVERALL_TIMEOUT_MS = 90_000;
const TEAM_FETCH_CONCURRENCY = 5;
const RETRY_BACKOFF_MS = 200;

function assertNotAborted(signal: AbortSignal, label: string): void {
  if (signal.aborted) {
    throw new Error(`${label} aborted`);
  }
}

async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  maxRetries: number,
  label: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, attempt * RETRY_BACKOFF_MS);
      });
    }

    try {
      return await fetcher();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(`${label} failed after ${maxRetries + 1} attempts: ${message}`);
}

async function fetchTeamRosterWithRetry(
  teamNbaId: number,
  fetchTeamRoster: (
    teamNbaId: number,
    signal?: AbortSignal
  ) => Promise<RosterEntry[]> | RosterEntry[],
  teamTimeoutMs: number,
  maxRetries: number,
  signal: AbortSignal
): Promise<RosterEntry[]> {
  return fetchWithRetry(
    async () => {
      assertNotAborted(signal, `Team ${teamNbaId} fetch`);
      const controller = new AbortController();
      const abortHandler = () => controller.abort();

      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", abortHandler, { once: true });
      }

      const timeoutId = setTimeout(() => controller.abort(), teamTimeoutMs);

      try {
        return await fetchTeamRoster(teamNbaId, controller.signal);
      } finally {
        signal.removeEventListener("abort", abortHandler);
        clearTimeout(timeoutId);
      }
    },
    maxRetries,
    `Team ${teamNbaId}`
  );
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<U>
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function buildFailedResult(runId: string, teamCount: number, error: unknown): RosterRefreshResult {
  const message = error instanceof Error ? error.message : "Roster refresh failed";

  return {
    runId,
    status: ROSTER_REFRESH_STATUS.FAILED,
    teamCount,
    error: message,
  };
}

export async function currentRosterRefresh(
  deps: RosterRefreshDependencies
): Promise<RosterRefreshResult> {
  const parseResult = inputSchema.safeParse({
    gameId: deps.gameId,
    selectedTeamId: deps.selectedTeamId,
  });

  if (!parseResult.success) {
    return {
      runId: "",
      status: ROSTER_REFRESH_STATUS.FAILED,
      teamCount: 0,
      error: "Invalid input",
    };
  }

  const teamTimeoutMs = deps.teamTimeoutMs ?? TEAM_TIMEOUT_MS;
  const maxRetries = deps.maxRetries ?? MAX_RETRIES;
  const overallTimeoutMs = deps.overallTimeoutMs ?? OVERALL_TIMEOUT_MS;

  const abortController = new AbortController();
  const refreshPromise = runRefresh({
    ...deps,
    teamTimeoutMs,
    maxRetries,
    signal: abortController.signal,
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Roster refresh timed out after ${overallTimeoutMs}ms`));
    }, overallTimeoutMs);
  });

  try {
    return await Promise.race([refreshPromise, timeoutPromise]);
  } catch (error) {
    abortController.abort();
    refreshPromise.catch(() => undefined);
    return buildFailedResult("", 0, error);
  }
}

interface TeamRow {
  id: string;
  nba_id: number;
}

interface StagingRow {
  run_id: string;
  team_id: string;
  player_nba_id: number;
  payload: Record<string, unknown>;
}

interface RunRefreshContext {
  gameId: string;
  selectedTeamId: string;
  authenticatedClient: SupabaseClient;
  serviceClient: SupabaseClient;
  fetchTeamRoster: (
    teamNbaId: number,
    signal?: AbortSignal
  ) => Promise<RosterEntry[]> | RosterEntry[];
  teamTimeoutMs: number;
  maxRetries: number;
  signal: AbortSignal;
}

async function runRefresh(context: RunRefreshContext): Promise<RosterRefreshResult> {
  const {
    authenticatedClient,
    serviceClient,
    fetchTeamRoster,
    teamTimeoutMs,
    maxRetries,
    gameId,
    signal,
  } = context;

  const teamsResult = await authenticatedClient.from("teams").select("id, nba_id");

  if (teamsResult.error) {
    throw new Error(`Failed to load teams: ${teamsResult.error.message}`);
  }

  const teams = (teamsResult.data ?? []) as TeamRow[];

  if (teams.length === 0) {
    throw new Error("No teams found");
  }

  const runResult = await serviceClient
    .from("roster_refresh_runs")
    .insert({ expected_team_count: teams.length, status: "pending" })
    .select()
    .single();

  if (runResult.error || !runResult.data) {
    throw new Error(`Failed to create refresh run: ${runResult.error?.message ?? "no data"}`);
  }

  const runId = runResult.data.id as string;

  try {
    const teamRosters = await mapWithConcurrency(teams, TEAM_FETCH_CONCURRENCY, async (team) => {
      const roster = await fetchTeamRosterWithRetry(
        team.nba_id,
        fetchTeamRoster,
        teamTimeoutMs,
        maxRetries,
        signal
      );

      return { teamId: team.id, roster };
    });

    assertNotAborted(signal, "Staging");

    const stagingRows = teamRosters.flatMap<StagingRow>(({ teamId, roster }) =>
      roster.map((entry) => ({
        run_id: runId,
        team_id: teamId,
        player_nba_id: entry.nbaId,
        payload: entry.payload,
      }))
    );

    if (stagingRows.length === 0) {
      throw new Error("No roster entries to stage");
    }

    const stagingResult = await serviceClient.from("roster_refresh_staging").insert(stagingRows);

    if (stagingResult.error) {
      throw new Error(`Failed to stage roster entries: ${stagingResult.error.message}`);
    }

    assertNotAborted(signal, "Promotion");

    const promoteResult = await serviceClient.rpc("promote_current_roster", { p_run_id: runId });

    if (promoteResult.error) {
      throw new Error(`Failed to promote roster: ${promoteResult.error.message}`);
    }

    const runUpdateResult = await serviceClient
      .from("roster_refresh_runs")
      .update({ status: "success", completed_team_count: teams.length })
      .eq("id", runId);

    if (runUpdateResult.error) {
      throw new Error(`Failed to mark refresh run as success: ${runUpdateResult.error.message}`);
    }

    assertNotAborted(signal, "Seeding");

    const seedResult = await authenticatedClient.rpc("seed_game_data", {
      p_game_id: gameId,
      p_team_id: context.selectedTeamId,
    });

    if (seedResult.error) {
      throw new Error(`Failed to seed game data: ${seedResult.error.message}`);
    }

    assertNotAborted(signal, "Finalizing");

    return {
      runId,
      status: ROSTER_REFRESH_STATUS.SUCCESS,
      teamCount: teams.length,
    };
  } catch (error) {
    await rollbackToSeed(context, runId);
    return buildFailedResult(runId, teams.length, error);
  }
}

async function rollbackToSeed(context: RunRefreshContext, runId: string): Promise<void> {
  try {
    await context.authenticatedClient.rpc("seed_game_data", {
      p_game_id: context.gameId,
      p_team_id: context.selectedTeamId,
    });
  } catch {
    // Fallback seed is best-effort; the primary failure is already recorded.
  }

  try {
    await context.serviceClient
      .from("roster_refresh_runs")
      .update({
        status: "failed",
        error: "Refresh failed; rolled back to canonical seed",
      })
      .eq("id", runId);
  } catch {
    // Run update failure is non-fatal; the caller still receives a failed result.
  }
}
