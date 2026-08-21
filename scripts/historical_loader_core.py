from __future__ import annotations

import hashlib
import importlib
import os
import time
from collections.abc import Callable, Iterable
from typing import Protocol, TypedDict, TypeVar, cast
from urllib.parse import urlencode

import requests

RestRow = dict[str, object]
T = TypeVar("T")

BATCH_SIZE = 100
REQUEST_TIMEOUT_SECONDS = 30
NBA_API_DELAY_SECONDS = 0.8

REQUIRED_ROSTER_FIELDS = {"PLAYER_ID", "PLAYER", "POSITION", "NUM", "TeamID"}


class NbaEndpoint(Protocol):
    def get_dict(self) -> dict[str, object]: ...


class CommonTeamRosterFactory(Protocol):
    def __call__(self, team_id: int, season: str) -> NbaEndpoint: ...


class SeasonConfig(TypedDict):
    historical_season: str
    season_year: int
    salary_tiers: dict[str, tuple[int, int]]
    superstar_nba_ids: set[int]
    star_nba_ids: set[int]


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


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is not set.")
    return value


def chunks(items: list[T], size: int) -> Iterable[list[T]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def supabase_endpoint(path: str) -> str:
    supabase_url = _require_env("NEXT_PUBLIC_SUPABASE_URL")
    return f"{supabase_url}/rest/v1/{path}"


def request_json(
    method: str,
    path: str,
    payload: list[RestRow] | RestRow | None = None,
    extra_headers: dict[str, str] | None = None,
) -> list[RestRow]:
    supabase_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }
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


def validate_roster_row(row: RestRow) -> None:
    missing = REQUIRED_ROSTER_FIELDS - set(row.keys())
    if missing:
        raise ValueError(f"NBA API row missing required fields: {missing}")
    as_int(row["PLAYER_ID"])
    as_string(row["PLAYER"])
    as_int(row["TeamID"])


def load_team_map() -> dict[int, str]:
    rows = request_json("GET", "teams?select=id,nba_id,abbreviation")
    return {as_int(row["nba_id"]): as_string(row["id"]) for row in rows}


def fetch_roster(team_nba_id: int, season: str) -> list[RestRow]:
    roster = common_team_roster(
        team_id=team_nba_id,
        season=season,
    ).get_dict()
    result_sets = cast(list[dict[str, object]], roster["resultSets"])
    result_set = result_sets[0]
    headers = cast(list[str], result_set["headers"])
    rows = cast(list[list[object]], result_set["rowSet"])
    parsed_rows = [dict(zip(headers, row, strict=False)) for row in rows]
    for row in parsed_rows:
        validate_roster_row(row)
    return parsed_rows


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
    headers = {"Prefer": "resolution=ignore-duplicates,return=representation"}

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


def contract_tier(player_nba_id: int, roster_order: int, config: SeasonConfig) -> str:
    if player_nba_id in config["superstar_nba_ids"]:
        return "superstar"
    if player_nba_id in config["star_nba_ids"]:
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


def build_contract_template(
    player_id: str, player_nba_id: int, team_id: str, roster_order: int, config: SeasonConfig
) -> RestRow:
    season_year = config["season_year"]
    tier = contract_tier(player_nba_id, roster_order, config)
    minimum, maximum = config["salary_tiers"][tier]
    base_salary = deterministic_int(f"{season_year}:{player_nba_id}:salary", minimum, maximum)
    duration = deterministic_int(f"{season_year}:{player_nba_id}:duration", 1, 5)

    salaries = [0, 0, 0, 0, 0]
    for year_index in range(duration):
        salaries[year_index] = round(base_salary * (1.05**year_index))

    return {
        "season_year": season_year,
        "player_id": player_id,
        "team_id": team_id,
        "start_year": season_year,
        "end_year": season_year + duration - 1,
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
