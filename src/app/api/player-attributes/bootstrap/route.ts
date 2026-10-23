import { NextResponse } from "next/server";
import { z } from "zod";
import { materializeGamePlayerAttributes } from "@/application/ratings/materializeGamePlayerAttributes";
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
  const game = await client
    .from("games")
    .select("id, status, season_year, season_era_id")
    .eq("id", input.data.gameId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (game.error) return NextResponse.json({ error: "Cannot load game" }, { status: 500 });
  if (!game.data) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.data.status !== "initializing" || game.data.season_era_id !== "modern") {
    return NextResponse.json({ error: "Initializing modern game required" }, { status: 409 });
  }
  try {
    const result = await materializeGamePlayerAttributes({
      gameId: input.data.gameId,
      ownerId: user.id,
      seasonYear: game.data.season_year,
      serviceClient: createServiceRoleClient(),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[player-attributes-bootstrap]", error);
    return NextResponse.json({ error: "Player attributes initialization failed" }, { status: 502 });
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
