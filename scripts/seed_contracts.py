import os
import random
import requests
from dotenv import load_dotenv

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

# Rango de salarios por nivel de jugador (salario anual en dólares)
SALARY_TIERS = {
    "superstar": (45_000_000, 55_000_000),  # LeBron, Curry, etc.
    "star": (30_000_000, 44_000_000),       # All-Stars
    "starter": (15_000_000, 29_000_000),    # Titulares sólidos
    "rotation": (5_000_000, 14_000_000),    # Jugadores de rotación
    "bench": (2_000_000, 4_999_999),        # Banca
    "rookie": (1_000_000, 2_500_000),       # Novatos y contratos mínimos
}

def get_tier_by_index(index, total_players):
    """Asigna un tier basado en la posición en el roster (simulando estrellas primero)"""
    if index == 0:
        return "superstar"
    elif index <= 2:
        return "star"
    elif index <= 5:
        return "starter"
    elif index <= 9:
        return "rotation"
    elif index <= 12:
        return "bench"
    else:
        return "rookie"

def generate_contract_salaries(tier, years=3):
    """Genera salarios para múltiples años con escaladas típicas"""
    base_salary = random.randint(*SALARY_TIERS[tier])
    salaries = []
    
    for year in range(years):
        # 3-8% de aumento anual típico en la NBA
        increase = 1 + random.uniform(0.03, 0.08)
        year_salary = int(base_salary * (increase ** year))
        salaries.append(year_salary)
    
    # Rellenar hasta 5 años si es necesario
    while len(salaries) < 5:
        salaries.append(0)
    
    return salaries[:5]  # Máximo 5 años

def seed_contracts():
    print("💰 Generating contracts for all players...")
    
    # 1. Traer todos los jugadores
    players_url = f"{SUPABASE_URL}/rest/v1/players?select=id,team_id,full_name"
    res = requests.get(players_url, headers=HEADERS)
    
    if res.status_code != 200:
        print(f"❌ Error fetching players: {res.text}")
        return
    
    players = res.json()
    print(f"✅ Found {len(players)} players")
    
    # 2. Agrupar por equipo para asignar tiers correctamente
    teams_players = {}
    for player in players:
        team_id = player["team_id"]
        if team_id not in teams_players:
            teams_players[team_id] = []
        teams_players[team_id].append(player)
    
    contracts = []
    current_year = 2024
    
    for team_id, team_players in teams_players.items():
        print(f"  Processing {len(team_players)} players for team {team_id[:8]}...")
        
        # Ordenar aleatoriamente para simular que no todos los mejores están primero
        random.shuffle(team_players)
        
        for idx, player in enumerate(team_players):
            tier = get_tier_by_index(idx, len(team_players))
            salaries = generate_contract_salaries(tier, years=random.randint(2, 4))
            
            contract = {
                "player_id": player["id"],
                "team_id": team_id,
                "start_year": current_year,
                "end_year": current_year + random.randint(1, 4),
                "salary_y1": salaries[0],
                "salary_y2": salaries[1] if salaries[1] > 0 else None,
                "salary_y3": salaries[2] if salaries[2] > 0 else None,
                "salary_y4": salaries[3] if salaries[3] > 0 else None,
                "salary_y5": salaries[4] if salaries[4] > 0 else None,
                "is_guaranteed": random.random() > 0.1,  # 90% garantizados
                "is_player_option": random.random() > 0.9,  # 10% player option
                "is_team_option": random.random() > 0.95,   # 5% team option
            }
            contracts.append(contract)
    
    # 3. Insertar contratos en batch
    print(f"\n💾 Inserting {len(contracts)} contracts...")
    
    contracts_url = f"{SUPABASE_URL}/rest/v1/contracts"
    
    # Insertar de a 50 para no sobrecargar
    batch_size = 50
    for i in range(0, len(contracts), batch_size):
        batch = contracts[i:i+batch_size]
        res = requests.post(contracts_url, headers=HEADERS, json=batch)
        
        if res.status_code in [200, 201]:
            print(f"  ✅ Inserted batch {i//batch_size + 1}/{(len(contracts)//batch_size)+1}")
        else:
            print(f"  ❌ Error inserting batch: {res.text}")
    
    print(f"\n🎉 Successfully seeded {len(contracts)} contracts!")
    
    # Stats
    total_salary = sum(c["salary_y1"] for c in contracts)
    avg_salary = total_salary / len(contracts)
    print(f"\n📊 Stats:")
    print(f"   Total salaries (Y1): ${total_salary:,}")
    print(f"   Average salary: ${avg_salary:,.0f}")
    print(f"   Highest salary: ${max(c['salary_y1'] for c in contracts):,}")
    print(f"   Lowest salary: ${min(c['salary_y1'] for c in contracts):,}")

if __name__ == "__main__":
    seed_contracts()
