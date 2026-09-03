import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sanitizeSerializedContractError,
  serializeContractError,
} from "@/application/contracts/contractDiagnostics";
import { materializeModernGameContracts } from "@/application/contracts/materializeModernGameContracts";
import {
  currentRosterRefresh,
  ROSTER_REFRESH_STATUS,
} from "@/application/roster/currentRosterRefresh";
import { basketballReferenceContractSnapshotSchema } from "@/infrastructure/contracts/basketballReferenceContractSource";
import { SupabaseContractSnapshotCache } from "@/infrastructure/contracts/SupabaseContractSnapshotCache";
import { curatedContractIdentityExceptions } from "@/infrastructure/playerIdentity/validatedPlayerIdentityCrosswalk";
import { fetchCurrentRosterForTeam } from "@/infrastructure/roster/espnRosterSource";
import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/serviceRole";

const requestSchema = z.object({
  gameId: z.uuid(),
  selectedTeamId: z.uuid(),
});

function methodNotAllowed(): NextResponse {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

function errorMessage(error: unknown): string {
  const diagnostic = serializeContractError(error);
  if (
    diagnostic.name === "ContractSnapshotAcquisitionError" ||
    diagnostic.name === "ContractSnapshotDurabilityError"
  ) {
    return diagnostic.message;
  }
  return sanitizeSerializedContractError(diagnostic).message;
}

async function rollbackGameInitialization(
  authenticatedClient: Awaited<ReturnType<typeof createClient>>,
  gameId: string,
  primaryError: unknown
): Promise<void> {
  console.error(`[roster-refresh] contract materialization failed: ${errorMessage(primaryError)}`);
  try {
    const rollbackResult = await authenticatedClient.rpc("rollback_seed_game_data", {
      p_game_id: gameId,
    });
    if (rollbackResult.error) {
      console.error(`[roster-refresh] game rollback failed: ${rollbackResult.error.message}`);
    }
  } catch (rollbackError) {
    console.error(`[roster-refresh] game rollback failed: ${errorMessage(rollbackError)}`);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  let materializationStarted = false;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = requestSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { gameId, selectedTeamId } = parseResult.data;

  try {
    const serviceClient = createServiceRoleClient();
    const result = await currentRosterRefresh({
      gameId,
      selectedTeamId,
      authenticatedClient: supabase,
      serviceClient,
      fetchTeamRoster: fetchCurrentRosterForTeam,
    });

    if (result.status === ROSTER_REFRESH_STATUS.FAILED) {
      console.error(
        `[roster-refresh] run ${result.runId} failed (${result.teamCount} teams): ${result.error}`
      );
      return NextResponse.json(
        { error: "Roster refresh failed", runId: result.runId, teamCount: result.teamCount },
        { status: 500 }
      );
    }

    const gameResult = await supabase
      .from("games")
      .select("season_year, season_era_id, status, user_id")
      .eq("id", gameId)
      .eq("user_id", user.id)
      .single();
    if (gameResult.error || !gameResult.data) {
      return NextResponse.json(
        { error: "Game initialization context is invalid" },
        { status: 409 }
      );
    }
    if (gameResult.data.season_era_id !== "modern" || gameResult.data.status !== "initializing") {
      return NextResponse.json({ error: "Modern initializing game required" }, { status: 409 });
    }
    materializationStarted = true;
    await materializeModernGameContracts({
      gameId,
      userId: user.id,
      seasonYear: gameResult.data.season_year as number,
      cache: new SupabaseContractSnapshotCache(
        serviceClient,
        basketballReferenceContractSnapshotSchema
      ),
      serviceClient,
      curatedIdentityExceptions: curatedContractIdentityExceptions,
      allowUnmatchedRosterExperienceFallback: true,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (materializationStarted) {
      await rollbackGameInitialization(supabase, gameId, error);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export function GET(): NextResponse {
  return methodNotAllowed();
}

export function PUT(): NextResponse {
  return methodNotAllowed();
}

export function DELETE(): NextResponse {
  return methodNotAllowed();
}

export function PATCH(): NextResponse {
  return methodNotAllowed();
}
