import os
import time
import requests
import pandas as pd
from nba_api.stats.static import teams as nba_teams
from nba_api.stats.endpoints import commonteamroster

# Configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.")
    # Placeholders for illustration
    SUPABASE_URL = "https://your-project.supabase.co"
    SUPABASE_KEY = "your-key"

# REST Headers
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def ingest_teams():
    print("🏀 Fetching teams from NBA API...")
    all_teams = nba_teams.get_teams()
    
    formatted_teams = []
    for team in all_teams:
        formatted_teams.append({
            "nba_id": int(team["id"]),
            "name": str(team["full_name"]),
            "city": str(team["city"]),
            "abbreviation": str(team["abbreviation"]),
        })
    
    print(f"✅ Found {len(formatted_teams)} teams. Upserting to Supabase...")
    url = f"{SUPABASE_URL}/rest/v1/teams"
    
    try:
        response = requests.post(url, headers=HEADERS, json=formatted_teams)
        response.raise_for_status()
        
        # To get the inserted teams (with their UUIDs), we do a GET
        res = requests.get(url, headers=HEADERS)
        res.raise_for_status()
        print("🚀 Teams ingested successfully.")
        return res.json()
    except Exception as e:
        print(f"❌ Error ingesting teams: {e}")
        return []

def ingest_players(teams_in_db):
    print("👤 Fetching rosters for each team...")
    url = f"{SUPABASE_URL}/rest/v1/players"
    
    # Map nba_id to uuid from DB
    team_map = {int(team["nba_id"]): team["id"] for team in teams_in_db}
    
    for nba_id, db_uuid in team_map.items():
        print(f"  Fetching roster for team {nba_id}...")
        try:
            roster = commonteamroster.CommonTeamRoster(team_id=nba_id).get_dict()
            players_data = roster["resultSets"][0]["rowSet"]
            headers = roster["resultSets"][0]["headers"]
            
            df = pd.DataFrame(players_data, columns=headers)
            
            formatted_players = []
            for _, row in df.iterrows():
                player_name = str(row["PLAYER"])
                name_parts = player_name.split(' ')
                first_name = name_parts[0]
                last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ""
                
                # Use .get() or direct access and convert to avoid Series issues
                p_nba_id = int(row["PLAYER_ID"])
                
                formatted_players.append({
                    "nba_id": p_nba_id,
                    "team_id": db_uuid,
                    "first_name": first_name,
                    "last_name": last_name,
                    "full_name": player_name,
                    "position": str(row["POSITION"]),
                    "height": str(row["HEIGHT"]),
                    "weight": str(row["WEIGHT"]),
                    "jersey_number": str(row["NUM"]),
                    "is_active": True
                })
            
            if formatted_players:
                response = requests.post(url, headers=HEADERS, json=formatted_players)
                response.raise_for_status()
                print(f"  ✅ Ingested {len(formatted_players)} players for team {nba_id}")
            
            # Anti-rate limit
            time.sleep(0.8)
            
        except Exception as e:
            print(f"  ❌ Error fetching roster for team {nba_id}: {e}")

if __name__ == "__main__":
    if SUPABASE_KEY == "your-key":
        print("⚠️ Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.")
    else:
        teams = ingest_teams()
        if teams:
            ingest_players(teams)
