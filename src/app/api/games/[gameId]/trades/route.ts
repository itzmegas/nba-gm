import { NextResponse } from "next/server";
import { executeServerTrade } from "@/application/trades/executeServerTrade";
import {
  TRADE_ERROR,
  type TradeErrorCode,
  TradeOperationError,
} from "@/domain/trades/TradeCommand";
import { createClient } from "@/infrastructure/supabase/server";
import { SupabaseTradeTransaction } from "@/infrastructure/trades/SupabaseTradeTransaction";

const errors: Record<TradeErrorCode, { status: number; message: string }> = {
  INVALID_REQUEST: { status: 400, message: "Invalid trade request." },
  UNAUTHORIZED: { status: 401, message: "Authentication required." },
  FORBIDDEN_ORIGIN: { status: 403, message: "Cross-origin trade requests are not permitted." },
  GAME_NOT_FOUND: { status: 404, message: "Owned game not found." },
  GAME_NOT_ACTIVE: { status: 409, message: "An active game is required." },
  INVALID_TEAMS: { status: 422, message: "Invalid participating teams." },
  STALE_ASSET: {
    status: 409,
    message: "Trade assets are stale or unavailable. Refresh before retrying.",
  },
  HARD_CAP_UNKNOWN: {
    status: 422,
    message: "Player trades are unavailable until authoritative hard-cap state is defined.",
  },
  TRADE_UNAVAILABLE: {
    status: 503,
    message: "The authoritative trade transaction is unavailable.",
  },
  TRADE_FAILED: {
    status: 500,
    message: "Trade outcome could not be confirmed. Refresh history before retrying.",
  },
};

function failure(code: TradeErrorCode) {
  const { status, message } = errors[code];
  return NextResponse.json({ success: false, code, error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return failure(TRADE_ERROR.FORBIDDEN_ORIGIN);
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return failure(TRADE_ERROR.UNAUTHORIZED);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(TRADE_ERROR.INVALID_REQUEST);
    }
    const { gameId } = await params;
    const result = await executeServerTrade(gameId, body, new SupabaseTradeTransaction(client));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return failure(error instanceof TradeOperationError ? error.code : TRADE_ERROR.TRADE_FAILED);
  }
}
