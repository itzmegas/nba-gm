import { NextResponse } from "next/server";
import { z } from "zod";
import {
  currentRosterRefresh,
  ROSTER_REFRESH_STATUS,
} from "@/application/roster/currentRosterRefresh";
import { fetchCurrentRosterForTeam } from "@/infrastructure/roster/nbaRosterSource";
import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/serviceRole";

const requestSchema = z.object({
  gameId: z.uuid(),
  selectedTeamId: z.uuid(),
});

function methodNotAllowed(): NextResponse {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
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
      return NextResponse.json(
        { error: "Roster refresh failed", runId: result.runId, teamCount: result.teamCount },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
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
