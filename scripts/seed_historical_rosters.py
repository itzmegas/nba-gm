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

HISTORICAL_SEASON = "2010-11"
SEASON_YEAR = 2010

SUPERSTAR_PLAYER_NBA_IDS = {
    977,  # Kobe Bryant
    1495,  # Tim Duncan
    1717,  # Dirk Nowitzki
    2200,  # Pau Gasol
    2544,  # LeBron James
    2548,  # Dwyane Wade
    2730,  # Dwight Howard
    201142,  # Kevin Durant
    201565,  # Derrick Rose
}

STAR_PLAYER_NBA_IDS = {
    708,  # Kevin Garnett
    959,  # Steve Nash
    101108,  # Chris Paul
    200746,  # LaMarcus Aldridge
    201566,  # Russell Westbrook
    201939,  # Stephen Curry
    2546,  # Carmelo Anthony
}

SALARY_TIERS = {
    "superstar": (14_500_000, 18_500_000),
    "star": (9_500_000, 14_000_000),
    "starter": (4_500_000, 8_500_000),
    "rotation": (1_500_000, 4_000_000),
    "bench": (850_000, 1_400_000),
    "rookie": (473_604, 1_600_000),
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

    print("Historical roster seed completed.")


if __name__ == "__main__":
    main()
