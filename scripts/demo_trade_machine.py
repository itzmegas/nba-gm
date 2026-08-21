import os
import requests
from dotenv import load_dotenv

load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

def get_team_by_name(name):
    """Busca un equipo por nombre"""
    url = f"{SUPABASE_URL}/rest/v1/teams?name=ilike.*{name}*"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200 and res.json():
        return res.json()[0]
    return None

def get_team_contracts(team_id):
    """Trae contratos de un equipo con info del jugador"""
    url = f"{SUPABASE_URL}/rest/v1/contracts?team_id=eq.{team_id}&select=*,players(full_name)"
    res = requests.get(url, headers=HEADERS)
    return res.json() if res.status_code == 200 else []

def format_currency(amount):
    if amount is None:
        return "$0"
    return f"${amount:,.0f}"

def demo_trade():
    print("=" * 70)
    print("🏀 TRADE MACHINE DEMO - The Association")
    print("=" * 70)
    
    # 1. Buscar dos equipos
    print("\n🔍 Finding teams...")
    team_a = get_team_by_name("Lakers")
    team_b = get_team_by_name("Warriors")
    
    if not team_a or not team_b:
        print("❌ Could not find teams. Make sure data is loaded.")
        return
    
    print(f"✅ {team_a['name']} vs {team_b['name']}")
    
    # 2. Traer contratos
    print(f"\n📊 Loading contracts...")
    contracts_a = get_team_contracts(team_a['id'])
    contracts_b = get_team_contracts(team_b['id'])
    
    print(f"   {team_a['name']}: {len(contracts_a)} contracts")
    print(f"   {team_b['name']}: {len(contracts_b)} contracts")
    
    # 3. Mostrar top 5 jugadores de cada equipo
    print(f"\n💰 {team_a['name']} Top Salaries:")
    sorted_a = sorted(contracts_a, key=lambda x: x.get('salary_y1', 0) or 0, reverse=True)[:5]
    for i, c in enumerate(sorted_a, 1):
        player = c.get('players', {}).get('full_name', 'Unknown')
        salary = c.get('salary_y1', 0)
        print(f"   {i}. {player}: {format_currency(salary)}")
    
    print(f"\n💰 {team_b['name']} Top Salaries:")
    sorted_b = sorted(contracts_b, key=lambda x: x.get('salary_y1', 0) or 0, reverse=True)[:5]
    for i, c in enumerate(sorted_b, 1):
        player = c.get('players', {}).get('full_name', 'Unknown')
        salary = c.get('salary_y1', 0)
        print(f"   {i}. {player}: {format_currency(salary)}")
    
    # 4. Calcular totales
    total_a = sum(c.get('salary_y1', 0) or 0 for c in contracts_a)
    total_b = sum(c.get('salary_y1', 0) or 0 for c in contracts_b)
    
    print(f"\n📈 Team Financials (2025-26):")
    print(f"   {team_a['name']}: {format_currency(total_a)} ({len(contracts_a)} players)")
    print(f"   {team_b['name']}: {format_currency(total_b)} ({len(contracts_b)} players)")
    print(f"   Salary Cap: $140,000,000")
    print(f"   Hard Cap: $189,000,000")
    
    # 5. Simular un trade simple
    print(f"\n🔄 TRADE SCENARIO:")
    print("-" * 70)
    
    # Tomar el jugador más caro de A y 2 de B
    if sorted_a and sorted_b and len(sorted_b) >= 2:
        player_a = sorted_a[0]  # Más caro de A
        players_b = sorted_b[:2]  # Top 2 de B
        
        salary_a = player_a.get('salary_y1', 0) or 0
        salary_b = sum(p.get('salary_y1', 0) or 0 for p in players_b)
        
        print(f"   {team_a['name']} sends:")
        print(f"     - {player_a.get('players', {}).get('full_name')}: {format_currency(salary_a)}")
        print(f"\n   {team_b['name']} sends:")
        for p in players_b:
            print(f"     - {p.get('players', {}).get('full_name')}: {format_currency(p.get('salary_y1', 0))}")
        print(f"     Total: {format_currency(salary_b)}")
        
        # 6. Validar con reglas CBA simplificadas
        print(f"\n⚖️  CBA VALIDATION:")
        print("-" * 70)
        
        # Salary matching: 125% rule
        margin = 1.25
        
        if salary_a > salary_b:
            # Team B recibe más, debe cumplir margen
            max_allowed = salary_b * margin
            print(f"   Team B receives {format_currency(salary_a)}")
            print(f"   Max allowed (125% of outgoing): {format_currency(max_allowed)}")
            if salary_a <= max_allowed:
                print(f"   ✅ Salary matching: VALID")
            else:
                print(f"   ❌ Salary matching: INVALID")
                print(f"      Difference: {format_currency(salary_a - max_allowed)}")
        else:
            # Team A recibe más
            max_allowed = salary_a * margin
            print(f"   Team A receives {format_currency(salary_b)}")
            print(f"   Max allowed (125% of outgoing): {format_currency(max_allowed)}")
            if salary_b <= max_allowed:
                print(f"   ✅ Salary matching: VALID")
            else:
                print(f"   ❌ Salary matching: INVALID")
                print(f"      Difference: {format_currency(salary_b - max_allowed)}")
        
        # Roster size check
        roster_a_after = len(contracts_a) - 1 + 2  # -1 player + 2 incoming
        roster_b_after = len(contracts_b) - 2 + 1  # -2 players + 1 incoming
        
        print(f"\n   Roster Size After Trade:")
        print(f"   {team_a['name']}: {len(contracts_a)} → {roster_a_after} players")
        if 12 <= roster_a_after <= 15:
            print(f"      ✅ Valid (12-15 range)")
        else:
            print(f"      ❌ Invalid")
        
        print(f"   {team_b['name']}: {len(contracts_b)} → {roster_b_after} players")
        if 12 <= roster_b_after <= 15:
            print(f"      ✅ Valid (12-15 range)")
        else:
            print(f"      ❌ Invalid")
    
    print(f"\n" + "=" * 70)
    print("✨ Demo complete!")
    print("=" * 70)
    print("\n💡 Next steps:")
    print("   1. Build UI with real TradeValidator")
    print("   2. Add player selection interface")
    print("   3. Implement trade execution")

if __name__ == "__main__":
    demo_trade()
