import { createClient } from "@supabase/supabase-js";

const teamDefinitions = [
  [1610612737, "Atlanta Hawks", "Atlanta", "ATL", "East", "Southeast"],
  [1610612738, "Boston Celtics", "Boston", "BOS", "East", "Atlantic"],
  [1610612739, "Cleveland Cavaliers", "Cleveland", "CLE", "East", "Central"],
  [1610612740, "New Orleans Pelicans", "New Orleans", "NOP", "West", "Southwest"],
  [1610612741, "Chicago Bulls", "Chicago", "CHI", "East", "Central"],
  [1610612742, "Dallas Mavericks", "Dallas", "DAL", "West", "Southwest"],
  [1610612743, "Denver Nuggets", "Denver", "DEN", "West", "Northwest"],
  [1610612744, "Golden State Warriors", "Golden State", "GSW", "West", "Pacific"],
  [1610612745, "Houston Rockets", "Houston", "HOU", "West", "Southwest"],
  [1610612746, "LA Clippers", "Los Angeles", "LAC", "West", "Pacific"],
  [1610612747, "Los Angeles Lakers", "Los Angeles", "LAL", "West", "Pacific"],
  [1610612748, "Miami Heat", "Miami", "MIA", "East", "Southeast"],
  [1610612749, "Milwaukee Bucks", "Milwaukee", "MIL", "East", "Central"],
  [1610612750, "Minnesota Timberwolves", "Minnesota", "MIN", "West", "Northwest"],
  [1610612751, "Brooklyn Nets", "Brooklyn", "BKN", "East", "Atlantic"],
  [1610612752, "New York Knicks", "New York", "NYK", "East", "Atlantic"],
  [1610612753, "Orlando Magic", "Orlando", "ORL", "East", "Southeast"],
  [1610612754, "Indiana Pacers", "Indiana", "IND", "East", "Central"],
  [1610612755, "Philadelphia 76ers", "Philadelphia", "PHI", "East", "Atlantic"],
  [1610612756, "Phoenix Suns", "Phoenix", "PHX", "West", "Pacific"],
  [1610612757, "Portland Trail Blazers", "Portland", "POR", "West", "Northwest"],
  [1610612758, "Sacramento Kings", "Sacramento", "SAC", "West", "Pacific"],
  [1610612759, "San Antonio Spurs", "San Antonio", "SAS", "West", "Southwest"],
  [1610612760, "Oklahoma City Thunder", "Oklahoma City", "OKC", "West", "Northwest"],
  [1610612761, "Toronto Raptors", "Toronto", "TOR", "East", "Atlantic"],
  [1610612762, "Utah Jazz", "Utah", "UTA", "West", "Northwest"],
  [1610612763, "Memphis Grizzlies", "Memphis", "MEM", "West", "Southwest"],
  [1610612764, "Washington Wizards", "Washington", "WAS", "East", "Southeast"],
  [1610612765, "Detroit Pistons", "Detroit", "DET", "East", "Central"],
  [1610612766, "Charlotte Hornets", "Charlotte", "CHA", "East", "Southeast"],
] as const;

const teams = teamDefinitions.map(([nba_id, name, city, abbreviation, conference, division]) => ({
  nba_id,
  name,
  city,
  abbreviation,
  conference,
  division,
}));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error } = await supabase.from("teams").upsert(teams, { onConflict: "nba_id" });

if (error) {
  throw new Error(`Failed to seed teams: ${error.message}`);
}

console.log(`Seeded ${teams.length} NBA teams. Existing players and contracts were not modified.`);
