from __future__ import annotations

import hashlib
import importlib
import os
import time
from collections.abc import Callable, Iterable
from typing import Protocol, TypeVar, cast
from urllib.parse import urlencode

import requests

RestRow = dict[str, object]
T = TypeVar("T")


class NbaEndpoint(Protocol):
    def get_dict(self) -> dict[str, object]: ...


class CommonTeamRosterFactory(Protocol):
    def __call__(self, team_id: int, season: str) -> NbaEndpoint: ...


def load_runtime_dependencies() -> tuple[Callable[[str], bool], CommonTeamRosterFactory, Callable[[], list[RestRow]]]:
    try:
        dotenv_module = importlib.import_module("dotenv")
        roster_module = importlib.import_module("nba_api.stats.endpoints.commonteamroster")
        teams_module = importlib.import_module("nba_api.stats.static.teams")
    except ImportError as error:
        raise SystemExit(
            "Missing Python dependency. Install python-dotenv and nba_api before running this script."
        ) from error

    return (
        cast(Callable[[str], bool], getattr(dotenv_module, "load_dotenv")),
        cast(CommonTeamRosterFactory, getattr(roster_module, "CommonTeamRoster")),
        cast(Callable[[], list[RestRow]], getattr(teams_module, "get_teams")),
    )


load_dotenv, common_team_roster, get_nba_teams = load_runtime_dependencies()
load_dotenv(".env.local")

HISTORICAL_SEASON = "2010-11"
SEASON_YEAR = 2010
BATCH_SIZE = 100
REQUEST_TIMEOUT_SECONDS = 30
NBA_API_DELAY_SECONDS = 0.8

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.")
    raise SystemExit(1)

BASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

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


def chunks(items: list[T], size: int) -> Iterable[list[T]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def supabase_endpoint(path: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/{path}"


def request_json(
    method: str,
    path: str,
    payload: list[RestRow] | RestRow | None = None,
    extra_headers: dict[str, str] | None = None,
) -> list[RestRow]:
    headers = dict(BASE_HEADERS)
    if extra_headers:
        headers.update(extra_headers)

    response = requests.request(
        method,
        supabase_endpoint(path),
        headers=headers,
        json=payload,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )

    if response.status_code >= 400:
        raise RuntimeError(f"Supabase {method} {path} failed: {response.status_code} {response.text}")

    if not response.content:
        return []

    data = response.json()
    if isinstance(data, list):
        return cast(list[RestRow], data)
    return [cast(RestRow, data)]


def as_int(value: object) -> int:
    if isinstance(value, bool):
        raise ValueError("Boolean values cannot be converted to int.")
    if isinstance(value, int):
        return value
    try:
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str) and value.strip():
            return int(value)
    except ValueError as error:
        raise ValueError(f"Expected an integer-compatible value, got {value!r}") from error
    raise ValueError(f"Expected an integer-compatible value, got {value!r}")


def as_string(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def split_player_name(full_name: str) -> tuple[str, str]:
    parts = full_name.split()
    if not parts:
        return "Unknown", "Player"
    return parts[0], " ".join(parts[1:]) if len(parts) > 1 else ""


def load_team_map() -> dict[int, str]:
    rows = request_json("GET", "teams?select=id,nba_id,abbreviation")
    return {as_int(row["nba_id"]): as_string(row["id"]) for row in rows}


def fetch_roster(team_nba_id: int) -> list[RestRow]:
    roster = common_team_roster(
        team_id=team_nba_id,
        season=HISTORICAL_SEASON,
    ).get_dict()
    result_sets = cast(list[dict[str, object]], roster["resultSets"])
    result_set = result_sets[0]
    headers = cast(list[str], result_set["headers"])
    rows = cast(list[list[object]], result_set["rowSet"])
    return [dict(zip(headers, row, strict=False)) for row in rows]


def build_player_payload(row: RestRow) -> RestRow:
    full_name = as_string(row["PLAYER"])
    first_name, last_name = split_player_name(full_name)

    return {
        "nba_id": as_int(row["PLAYER_ID"]),
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "position": as_string(row.get("POSITION")),
        "height": as_string(row.get("HEIGHT")),
        "weight": as_string(row.get("WEIGHT")),
        "jersey_number": as_string(row.get("NUM")),
        "is_active": True,
    }


def upsert_players(players: list[RestRow]) -> dict[int, str]:
    player_ids: dict[int, str] = {}
    query = urlencode({"on_conflict": "nba_id"})
    headers = {"Prefer": "resolution=merge-duplicates,return=representation"}

    for batch in chunks(players, BATCH_SIZE):
        rows = request_json("POST", f"players?{query}", batch, headers)
        for row in rows:
            player_ids[as_int(row["nba_id"])] = as_string(row["id"])

    missing_nba_ids = [as_int(player["nba_id"]) for player in players if as_int(player["nba_id"]) not in player_ids]
    if missing_nba_ids:
        player_ids.update(fetch_player_ids(missing_nba_ids))

    return player_ids


def fetch_player_ids(player_nba_ids: list[int]) -> dict[int, str]:
    player_ids: dict[int, str] = {}
    for batch in chunks(player_nba_ids, BATCH_SIZE):
        ids_filter = ",".join(str(player_id) for player_id in batch)
        rows = request_json("GET", f"players?select=id,nba_id&nba_id=in.({ids_filter})")
        for row in rows:
            player_ids[as_int(row["nba_id"])] = as_string(row["id"])
    return player_ids


def contract_tier(player_nba_id: int, roster_order: int) -> str:
    if player_nba_id in SUPERSTAR_PLAYER_NBA_IDS:
        return "superstar"
    if player_nba_id in STAR_PLAYER_NBA_IDS:
        return "star"
    if roster_order <= 5:
        return "starter"
    if roster_order <= 10:
        return "rotation"
    if roster_order <= 13:
        return "bench"
    return "rookie"


def deterministic_int(seed: str, minimum: int, maximum: int) -> int:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    value = int(digest[:12], 16)
    return minimum + (value % (maximum - minimum + 1))


def build_contract_template(player_id: str, player_nba_id: int, team_id: str, roster_order: int) -> RestRow:
    tier = contract_tier(player_nba_id, roster_order)
    minimum, maximum = SALARY_TIERS[tier]
    base_salary = deterministic_int(f"{SEASON_YEAR}:{player_nba_id}:salary", minimum, maximum)
    duration = deterministic_int(f"{SEASON_YEAR}:{player_nba_id}:duration", 1, 5)

    salaries = [0, 0, 0, 0, 0]
    for year_index in range(duration):
        salaries[year_index] = round(base_salary * (1.05**year_index))

    return {
        "season_year": SEASON_YEAR,
        "player_id": player_id,
        "team_id": team_id,
        "start_year": SEASON_YEAR,
        "end_year": SEASON_YEAR + duration - 1,
        "salary_y1": salaries[0],
        "salary_y2": salaries[1],
        "salary_y3": salaries[2],
        "salary_y4": salaries[3],
        "salary_y5": salaries[4],
        "is_player_option": duration >= 4 and deterministic_int(f"{player_nba_id}:player-option", 0, 9) == 0,
        "is_team_option": duration <= 2 and deterministic_int(f"{player_nba_id}:team-option", 0, 5) == 0,
        "is_guaranteed": True,
    }


def upsert_templates(table: str, rows: list[RestRow]) -> None:
    query = urlencode({"on_conflict": "season_year,player_id"})
    headers = {"Prefer": "resolution=merge-duplicates"}

    for batch in chunks(rows, BATCH_SIZE):
        request_json("POST", f"{table}?{query}", batch, headers)


def main() -> None:
    print(f"Loading NBA historical rosters for {HISTORICAL_SEASON}.")
    team_map = load_team_map()
    nba_team_rows = get_nba_teams()

    player_payloads: list[RestRow] = []
    roster_source_rows: list[tuple[int, str, RestRow, int]] = []

    for team in nba_team_rows:
        team_nba_id = as_int(team["id"])
        team_name = as_string(team["full_name"])
        team_id = team_map.get(team_nba_id)

        if not team_id:
            print(f"Skipping {team_name}: team {team_nba_id} is not present in Supabase.")
            continue

        print(f"Fetching {team_name} roster.")
        roster_rows = fetch_roster(team_nba_id)
        for roster_order, row in enumerate(roster_rows, start=1):
            player_payloads.append(build_player_payload(row))
            roster_source_rows.append((team_nba_id, team_id, row, roster_order))

        time.sleep(NBA_API_DELAY_SECONDS)

    print(f"Upserting {len(player_payloads)} players.")
    player_ids = upsert_players(player_payloads)

    roster_templates: list[RestRow] = []
    contract_templates: list[RestRow] = []

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
        contract_templates.append(build_contract_template(player_id, player_nba_id, team_id, roster_order))

    print(f"Upserting {len(roster_templates)} historical roster templates.")
    upsert_templates("historical_roster_templates", roster_templates)

    print(f"Upserting {len(contract_templates)} historical contract templates.")
    upsert_templates("historical_contract_templates", contract_templates)

    print("Historical roster seed completed.")


if __name__ == "__main__":
    main()
