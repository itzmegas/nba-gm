import os
import re
import requests
import pandas as pd
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from typing import List, Dict, Optional

# Load environment variables
load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Environment variables not set")
    exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# Headers para evitar que nos bloqueen
REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}


def scrape_hoopshype_salaries():
    """Scrapea los salarios de hoopshype.com"""
    url = "https://hoopshype.com/salaries/players/"
    
    print(f"🌐 Fetching data from {url}...")
    
    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"❌ Error fetching page: {e}")
        return []
    
    soup = BeautifulSoup(response.text, 'lxml')
    
    # Buscar todas las tablas y encontrar la que tenga la estructura correcta
    tables = soup.find_all('table')
    salary_table = None
    
    for table in tables:
        # Buscar el thead para verificar que sea la tabla de salarios
        thead = table.find('thead')
        if thead:
            headers = [th.get_text(strip=True) for th in thead.find_all('th')]
            # La tabla correcta debe tener "Player" y años como "2025-26"
            if 'Player' in headers and any('2025' in h for h in headers):
                salary_table = table
                print(f"✅ Found salary table with headers: {headers[:5]}")
                break
    
    if not salary_table:
        print("❌ Could not find salary table")
        return []
    
    # Extraer filas de datos
    tbody = salary_table.find('tbody')
    if not tbody:
        print("❌ No tbody found")
        return []
    
    rows = tbody.find_all('tr')
    print(f"   Processing {len(rows)} rows...")
    
    players_data = []
    
    for row in rows:
        cells = row.find_all('td')
        if len(cells) < 3:  # Necesitamos al menos: rank, nombre, salario2025
            continue
        
        # Segunda celda es el nombre del jugador (primera es el ranking #)
        player_name = cells[1].get_text(strip=True)
        
        if not player_name or player_name == 'Player':
            continue
        
        # Las siguientes celdas son los salarios por año
        salaries = []
        options = []
        
        for i, cell in enumerate(cells[2:], 2):  # Empezar desde la tercera celda
            text = cell.get_text(strip=True)
            
            # Buscar símbolos de opciones
            option_type = None
            if 'T' in text and 'P' in text:
                option_type = 'PT'
            elif 'P' in text:
                option_type = 'P'
            elif 'T' in text:
                option_type = 'T'
            elif 'Q' in text:
                option_type = 'Q'
            
            # Limpiar el texto para extraer solo el número
            salary_text = text
            for char in ['P', 'T', 'Q', '-']:
                salary_text = salary_text.replace(char, '')
            salary_text = salary_text.strip()
            
            if salary_text and salary_text not in ['', '$']:
                try:
                    # Convertir a número
                    salary = int(salary_text.replace('$', '').replace(',', ''))
                    salaries.append(salary)
                    options.append(option_type)
                except ValueError:
                    salaries.append(None)
                    options.append(option_type)
            else:
                salaries.append(None)
                options.append(option_type)
        
        if player_name and any(s for s in salaries if s):
            players_data.append({
                'name': player_name,
                'salaries': salaries,
                'options': options
            })
    
    print(f"✅ Parsed {len(players_data)} players with salaries")
    return players_data


def get_db_players():
    """Trae todos los jugadores de la DB para hacer matching"""
    url = f"{SUPABASE_URL}/rest/v1/players?select=id,full_name,team_id"
    
    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Error fetching players from DB: {e}")
        return []


def normalize_name(name):
    """Normaliza nombres para mejor matching"""
    name = name.lower().strip()
    name = re.sub(r'[^\w\s]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name


def match_players(hoopshype_data, db_players):
    """Hace matching entre jugadores de Hoopshype y la DB"""
    print("\n🔗 Matching players...")
    
    db_map = {}
    for player in db_players:
        normalized = normalize_name(player['full_name'])
        db_map[normalized] = player
    
    matched = []
    unmatched = []
    
    for hs_player in hoopshype_data:
        normalized_name = normalize_name(hs_player['name'])
        
        if normalized_name in db_map:
            db_player = db_map[normalized_name]
            matched.append({
                'db_id': db_player['id'],
                'db_team_id': db_player['team_id'],
                'full_name': db_player['full_name'],
                'hoopshype_name': hs_player['name'],
                'salaries': hs_player['salaries'],
                'options': hs_player['options']
            })
        else:
            unmatched.append(hs_player['name'])
    
    print(f"✅ Matched: {len(matched)} players")
    print(f"⚠️  Unmatched: {len(unmatched)} players")
    
    if unmatched:
        print(f"   Sample unmatched: {unmatched[:10]}")
    
    return matched


def create_contracts_from_salaries(matched_players):
    """Crea objetos de contrato a partir de los salarios matcheados"""
    contracts = []
    current_year = 2025
    
    for player in matched_players:
        salaries = player['salaries']
        options = player['options']
        
        if not salaries:
            continue
        
        # Encontrar el último año con salario válido
        last_valid_idx = len(salaries) - 1
        for i in range(len(salaries) - 1, -1, -1):
            if salaries[i] is not None and salaries[i] > 0:
                last_valid_idx = i
                break
        
        valid_salaries = salaries[:last_valid_idx + 1]
        valid_options = options[:last_valid_idx + 1]
        
        if not valid_salaries or all(s is None or s == 0 for s in valid_salaries):
            continue
        
        is_player_option = any(opt == 'P' or opt == 'PT' for opt in valid_options if opt)
        is_team_option = any(opt == 'T' or opt == 'PT' for opt in valid_options if opt)
        
        contract = {
            'player_id': player['db_id'],
            'team_id': player['db_team_id'],
            'start_year': current_year,
            'end_year': current_year + len(valid_salaries) - 1,
            'salary_y1': valid_salaries[0] if len(valid_salaries) > 0 and valid_salaries[0] else 0,
            'salary_y2': valid_salaries[1] if len(valid_salaries) > 1 and valid_salaries[1] else None,
            'salary_y3': valid_salaries[2] if len(valid_salaries) > 2 and valid_salaries[2] else None,
            'salary_y4': valid_salaries[3] if len(valid_salaries) > 3 and valid_salaries[3] else None,
            'salary_y5': valid_salaries[4] if len(valid_salaries) > 4 and valid_salaries[4] else None,
            'is_player_option': is_player_option,
            'is_team_option': is_team_option,
            'is_guaranteed': True,
        }
        
        contracts.append(contract)
    
    return contracts


def insert_contracts(contracts):
    """Inserta los contratos en Supabase"""
    if not contracts:
        print("❌ No contracts to insert")
        return
    
    print(f"\n💾 Inserting {len(contracts)} real contracts...")
    
    delete_url = f"{SUPABASE_URL}/rest/v1/contracts"
    try:
        response = requests.delete(delete_url, headers=HEADERS)
        print("🗑️  Deleted old fake contracts")
    except Exception as e:
        print(f"⚠️  Could not delete old contracts: {e}")
    
    batch_size = 50
    for i in range(0, len(contracts), batch_size):
        batch = contracts[i:i+batch_size]
        try:
            response = requests.post(delete_url, headers=HEADERS, json=batch)
            if response.status_code in [200, 201]:
                print(f"  ✅ Inserted batch {i//batch_size + 1}/{(len(contracts)//batch_size)+1}")
            else:
                print(f"  ❌ Error: {response.text[:200]}")
        except Exception as e:
            print(f"  ❌ Exception: {e}")
    
    print(f"\n🎉 Successfully inserted {len(contracts)} real NBA contracts!")
    
    total_salary = sum(c['salary_y1'] for c in contracts if c['salary_y1'])
    print(f"\n📊 Stats for 2025-26 season:")
    print(f"   Total: ${total_salary:,}")
    print(f"   Average: ${total_salary/len(contracts):,.0f}")
    print(f"   Highest: ${max(c['salary_y1'] for c in contracts):,}")


def main():
    print("=" * 60)
    print("🏀 REAL NBA SALARIES - Hoopshype Scraper")
    print("=" * 60)
    
    hoopshype_data = scrape_hoopshype_salaries()
    
    if not hoopshype_data:
        print("❌ No data scraped, aborting")
        return
    
    print("\n📥 Fetching players from database...")
    db_players = get_db_players()
    print(f"✅ Found {len(db_players)} players in DB")
    
    matched = match_players(hoopshype_data, db_players)
    
    if not matched:
        print("❌ No players matched, aborting")
        return
    
    contracts = create_contracts_from_salaries(matched)
    print(f"\n📄 Created {len(contracts)} contract objects")
    
    insert_contracts(contracts)


if __name__ == "__main__":
    main()
