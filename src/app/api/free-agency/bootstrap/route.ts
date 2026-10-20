import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchNbaFreeAgentTracker } from "@/infrastructure/freeAgency/nbaFreeAgentSource";
import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/serviceRole";

const inputSchema = z.object({ gameId: z.uuid() }).strict();

export async function POST(request: Request): Promise<NextResponse> {
  const client = await createClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { gameId } = input.data;
  const game = await client
    .from("games")
    .select("id, status, season_year, season_era_id")
    .eq("id", gameId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (game.error) return NextResponse.json({ error: "Cannot load game" }, { status: 500 });
  if (!game.data) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (
    game.data.status !== "active" ||
    game.data.season_year !== 2026 ||
    game.data.season_era_id !== "modern"
  ) {
    return NextResponse.json({ error: "An active modern 2026 game is required" }, { status: 409 });
  }
  try {
    // Check before fetching: retries and market visits must not consult the live NBA again.
    const existing = await client
      .from("free_agency_imports")
      .select("enrolled_count, skipped_count")
      .eq("game_id", gameId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return NextResponse.json(existing.data);
    const snapshot = await fetchNbaFreeAgentTracker();
    const result = await createServiceRoleClient().rpc("import_initial_free_agents", {
      p_game_id: gameId,
      p_owner_id: user.id,
      p_snapshot: snapshot,
    });
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json(result.data);
  } catch (error) {
    console.error("[free-agency-bootstrap]", error);
    return NextResponse.json(
      { error: "Initial free-agent import failed. Please retry loading the initial market." },
      { status: 502 }
    );
  }
}
