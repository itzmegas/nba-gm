/**
 * Verify database state for game-model migration.
 *
 * Run with: bun scripts/verify-db.ts
 *
 * This script checks which tables and columns exist in Supabase
 * to determine what migrations still need to be applied.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

// Use service role key to bypass RLS for verification
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verify() {
  console.log("🔍 Verifying database state for game-model...\n");

  // Check static tables
  const tables = [
    { name: "teams", label: "Teams (static)" },
    { name: "players", label: "Players (static)" },
    { name: "contracts", label: "Contracts (needs game_id)" },
    { name: "games", label: "Games (NEW)" },
    { name: "game_player_states", label: "Game Player States (NEW)" },
  ];

  let allGood = true;

  for (const { name, label } of tables) {
    const { count, error } = await supabase.from(name).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ❌ ${label}: MISSING (${error.code}: ${error.message})`);
      allGood = false;
    } else {
      console.log(`  ✅ ${label}: ${count} rows`);
    }
  }

  // Check contracts.game_id column exists
  console.log("\n🔍 Checking contracts columns...");
  const { data: contracts, error: cErr } = await supabase
    .from("contracts")
    .select("id, game_id")
    .limit(3);

  if (cErr) {
    console.log(`  ❌ contracts.game_id: MISSING (${cErr.message})`);
    allGood = false;
  } else {
    const nullGameIds = contracts?.filter((c) => c.game_id === null).length ?? 0;
    console.log(
      `  ✅ contracts.game_id: EXISTS (${nullGameIds}/${contracts?.length ?? 0} have null game_id)`
    );
  }

  // Check game_status enum
  console.log("\n📋 Migration status:");
  if (!allGood) {
    console.log("\n  ⚠️  Some tables/columns are missing. You need to run the schema migration.");
    console.log("\n  INSTRUCTIONS:");
    console.log("  1. Go to your Supabase Dashboard → SQL Editor");
    console.log("  2. Copy the contents of scripts/schema.sql");
    console.log("  3. Paste and click 'Run'");
    console.log("  4. Run this script again to verify\n");
  } else {
    console.log("\n  🎉 All game-model tables and columns are in place!");
    console.log("  Ready to create games and seed data.\n");

    // Check if we need to run the seed function
    console.log("🔍 Checking seed function...");
    let rpcErr: { message: string } | null = null;
    try {
      const result = await supabase.rpc("seed_game_data", {
        p_game_id: "00000000-0000-0000-0000-000000000000",
        p_team_id: "00000000-0000-0000-0000-000000000000",
      });
      rpcErr = result.error ? { message: result.error.message } : null;
    } catch {
      rpcErr = { message: "function does not exist" };
    }

    if (rpcErr) {
      console.log("  ⚠️  seed_game_data function not found.");
      console.log("  Run scripts/migrations/002_backfill_game_data.sql in Supabase SQL Editor.\n");
    } else {
      console.log("  ✅ seed_game_data function exists.\n");
    }
  }
}

verify()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  });
