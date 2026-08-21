from __future__ import annotations

import time

from historical_loader_core import (
    NBA_API_DELAY_SECONDS,
    SeasonConfig,
    as_int,
    as_string,
    build_contract_template,
    build_player_payload,
    fetch_roster,
    get_nba_teams,
    load_dotenv,
    load_team_map,
    upsert_players,
    upsert_templates,
)

load_dotenv(".env.local")

HISTORICAL_SEASON = "1995-96"
SEASON_YEAR = 1995

# 1995-96 salary cap was ~$23M. Tiers are era-calibrated approximations
# (not exact historical contracts) used to generate deterministic templates.
SALARY_TIERS = {
    "superstar": (3_000_000, 4_500_000),
    "star": (2_000_000, 3_000_000),
    "starter": (1_000_000, 2_000_000),
    "rotation": (500_000, 1_000_000),
    "bench": (300_000, 500_000),
    "rookie": (200_000, 350_000),
}

# MVP-caliber and top-tier franchise players for 1995-96.
SUPERSTAR_PLAYER_NBA_IDS = {
    893,  # Michael Jordan
    937,  # Scottie Pippen
    895,  # Dennis Rodman
    252,  # Karl Malone
    304,  # John Stockton
    165,  # Hakeem Olajuwon
    185,  # Charles Barkley
    151,  # Patrick Ewing
    406,  # Shaquille O'Neal
    764,  # David Robinson
}

# All-Star / franchise-second players for 1995-96.
STAR_PLAYER_NBA_IDS = {
    280,  # Anfernee Hardaway
    133,  # Clyde Drexler
    207,  # Tim Hardaway
    255,  # Grant Hill
    385,  # Shawn Kemp
    368,  # Gary Payton
    397,  # Reggie Miller
    297,  # Alonzo Mourning
    87,  # Dikembe Mutombo
    399,  # Dominique Wilkins
    913,  # Mitch Richmond
    268,  # Detlef Schrempf
    467,  # Jason Kidd
    452,  # Vin Baker
    307,  # Latrell Sprewell
    708,  # Kevin Garnett (rookie scale outlier)
}


def main() -> None:
    config: SeasonConfig = {
        "historical_season": HISTORICAL_SEASON,
        "season_year": SEASON_YEAR,
        "salary_tiers": SALARY_TIERS,
        "superstar_nba_ids": SUPERSTAR_PLAYER_NBA_IDS,
        "star_nba_ids": STAR_PLAYER_NBA_IDS,
    }

    print(f"Loading NBA historical rosters for {HISTORICAL_SEASON}.")
    team_map = load_team_map()
    nba_team_rows = get_nba_teams()

    player_payloads: list[dict[str, object]] = []
    roster_source_rows: list[tuple[int, str, dict[str, object], int]] = []

    for team in nba_team_rows:
        team_nba_id = as_int(team["id"])
        team_name = as_string(team["full_name"])
        team_id = team_map.get(team_nba_id)

        if not team_id:
            print(f"Skipping {team_name}: team {team_nba_id} is not present in Supabase.")
            continue

        print(f"Fetching {team_name} roster.")
        roster_rows = fetch_roster(team_nba_id, HISTORICAL_SEASON)
        for roster_order, row in enumerate(roster_rows, start=1):
            player_payloads.append(build_player_payload(row))
            roster_source_rows.append((team_nba_id, team_id, row, roster_order))

        time.sleep(NBA_API_DELAY_SECONDS)

    print(f"Upserting {len(player_payloads)} players.")
    player_ids = upsert_players(player_payloads)

    roster_templates: list[dict[str, object]] = []
    contract_templates: list[dict[str, object]] = []

    for _team_nba_id, team_id, row, roster_order in roster_source_rows:
        player_nba_id = as_int(row["PLAYER_ID"])
        player_id = player_ids.get(player_nba_id)

        if not player_id:
            raise RuntimeError(f"Player {player_nba_id} was not found after upsert.")

        roster_templates.append(
            {
                "season_year": SEASON_YEAR,
                "player_id": player_id,
                "team_id": team_id,
                "position": as_string(row.get("POSITION")),
                "jersey_number": as_string(row.get("NUM")),
                "roster_order": roster_order,
                "is_active": True,
            }
        )
        contract_templates.append(build_contract_template(player_id, player_nba_id, team_id, roster_order, config))

    print(f"Upserting {len(roster_templates)} historical roster templates.")
    upsert_templates("historical_roster_templates", roster_templates)

    print(f"Upserting {len(contract_templates)} historical contract templates.")
    upsert_templates("historical_contract_templates", contract_templates)

    print("Jordan era roster seed completed.")


if __name__ == "__main__":
    main()
