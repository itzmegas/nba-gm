# Flujo de Usuario - "The Association"

## Visión General

El jugador toma el rol de General Manager (GM) de un equipo NBA. La experiencia está diseñada para ser inmersiva, estratégica y realista.

---

## User Journey Map

```mermaid
journey
    title Experiencia del GM - Primera Sesión
    section Onboarding
      Ingreso a la app: 5: Usuario
      Selección de equipo: 5: Usuario
      Personalización: 3: Usuario
    section Setup Inicial
      Descarga de datos: 5: Sistema
      Configuración default: 4: Usuario, Sistema
      Tutorial opcional: 3: Usuario
    section Gameplay Loop
      Dashboard GM: 5: Usuario
      Gestión de roster: 5: Usuario
      Traspasos: 4: Usuario
      Simulación: 5: Usuario
```

---

## Flujo Detallado por Etapa

### 1. Landing / Ingreso

```mermaid
flowchart TD
    Start(["Usuario entra a la app"]) --> Auth{"¿Está autenticado?"}
    
    Auth -->|"No"| Login["Pantalla de Login/Registro"]
    Auth -->|"Sí"| CheckSave{"¿Tiene partida<br/>en progreso?"}
    
    Login -->|"Login exitoso"| CheckSave
    
    CheckSave -->|"Sí"| LoadGame["Cargar partida guardada"]
    CheckSave -->|"No"| TeamSelect["Selección de Equipo"]
    
    LoadGame --> Dashboard["Dashboard Principal"]
    TeamSelect --> Onboarding
```

**Pantalla de Login:**
- Email + Password (Supabase Auth)
- OAuth opcional (Google, GitHub)
- "Jugar como invitado" (datos locales, no persisten)

---

### 2. Selección de Equipo

```mermaid
flowchart LR
    subgraph "Paso 1: Filtrar"
        A1["Todos los equipos"]
        A2["Filtrar por conferencia<br/>East | West"]
        A3["Filtrar por nivel<br/>Contender | Rebuilder | Neutral"]
    end
    
    subgraph "Paso 2: Comparar"
        B1["Ver info de equipo"]
        B2["Roster actual"]
        B3["Cap Space disponible"]
        B4["Draft picks"]
        B5["Rating general"]
    end
    
    subgraph "Paso 3: Elegir"
        C1["Seleccionar equipo"]
        C2["Confirmar"]
        C3["Ver modo franchise"]
    end
    
    A1 --> A2 --> A3 --> B1 --> B2 --> B3 --> B4 --> B5 --> C1 --> C2 --> C3
```

**Información mostrada por equipo:**
- Logo, ciudad, nombre
- Conference/Division
- Roster (top 5 jugadores con rating)
- Cap Space: `$45M / $140M` (con barra visual)
- Luxury Tax status
- Draft picks disponibles
- Objetivo de la franquicia (según datos reales)

**Clasificación de equipos:**
```typescript
type TeamDifficulty = 
  | "contender"     // Lakers, Celtics, Nuggets (difícil mantener)
  | "playoff-team"  // Heat, Suns, 76ers (balanceado)
  | "rebuilder"     // Pistons, Wizards, Spurs (fácil reconstruir)
  | "tanker";       // Equipos con picks altos
```

---

### 3. Descarga de Plantillas (Data Sync)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant App as App
    participant TQ as TanStack Query
    participant API as API Route
    participant Repo as Repository
    participant SB as Supabase
    participant NBA as NBA API

    U->>App: "Seleccionar equipo X"
    App->>App: Mostrar loading screen
    
    par Descarga paralela
        App->>TQ: prefetchTeams()
        TQ->>Repo: getAll()
        Repo->>SB: SELECT * FROM teams
        SB-->>Repo: Teams[]
        Repo-->>TQ: Teams[]
    and
        App->>TQ: prefetchPlayers()
        TQ->>Repo: getAll()
        Repo->>SB: SELECT * FROM players
        SB-->>Repo: Players[]
        Repo-->>TQ: Players[]
    and
        App->>TQ: prefetchContracts()
        TQ->>Repo: getAll()
        Repo->>SB: SELECT * FROM contracts
        SB-->>Repo: Contracts[]
    end

    App->>App: Inicializar Game State
    App->>App: Redirigir a Dashboard
```

**Datos que se descargan:**
1. **Equipos** - Info básica de los 30 equipos
2. **Jugadores** - Todos los jugadores activos (~500)
3. **Contratos** - Todos los contratos vigentes
4. **Stats** (opcional v1) - Stats de la temporada actual

**Opciones de Configuración Inicial:**
```typescript
interface GameSettings {
  // Fecha de inicio
  startDate: "2024-10-22"; // Inicio temporada 2024-25
  
  // Dificultad
  difficulty: "rookie" | "pro" | "hall-of-fame";
  
  // Opciones de simulación
  simulationSpeed: "daily" | "weekly" | "monthly";
  autoSave: boolean;
  saveFrequency: "on-exit" | "daily" | "weekly";
  
  // Reglas
  tradeDeadline: boolean;       // Respetar deadline
  salaryCapRules: "strict" | "relaxed";
  injuriesEnabled: boolean;
  
  // Display
  currencyFormat: "short" | "full";  // $45M vs $45,000,000
  showAdvancedStats: boolean;
}
```

---

### 4. Dashboard Principal (Hub)

```mermaid
flowchart TB
    subgraph "Layout Principal"
        Header["Header<br/>Logo equipo | Fecha | Salario Cap | Notificaciones"]
        Sidebar["Sidebar<br/>Navegación principal"]
        Main["Main Content Area"]
    end
    
    subgraph "Widgets Dashboard"
        W1["Próximo Partido"]
        W2["Alertas<br/>• Contratos expirando<br/>• Lesiones<br/>• Ofertas recibidas"]
        W3["Standing<br/>Posición en conferencia"]
        W4["Cap Space<br/>Visualización del salary cap"]
        W5["Noticias<br/>Simuladas de la liga"]
    end
    
    Header --- Main
    Sidebar --- Main
    Main --- W1
    Main --- W2
    Main --- W3
    Main --- W4
    Main --- W5
```

**Secciones de Navegación:**
1. **Dashboard** - Overview y alertas
2. **Roster** - Gestión de plantilla
3. **Calendario** - Partidos y resultados
4. **Traspasos** - Trade machine y ofertas
5. **Agencia Libre** - FAs disponibles
6. **Draft** - Scouts y picks
7. **Finanzas** - Salary cap detallado
8. **Configuración** - Settings del juego

---

### 5. Core Gameplay Loop

```mermaid
flowchart TD
    Dashboard --> Actions{"¿Qué querés hacer?"}
    
    Actions -->|"Gestionar Roster"| Roster["Roster Management"]
    Actions -->|"Hacer traspaso"| Trade["Trade Machine"]
    Actions -->|"Fichar agente libre"| FA["Free Agency"]
    Actions -->|"Avanzar tiempo"| Sim["Simular"]
    
    Roster -->|"Cambiar rotación"| Update[("Actualizar DB")]
    Roster -->|"Waive jugador"| Update
    
    Trade -->|"Proponer traspaso"| Validate{"¿Válido?"}
    Validate -->|"Sí"| AI_Decision{"IA acepta?"}
    Validate -->|"No"| Error["Mostrar error"]
    Error --> Trade
    
    AI_Decision -->|"Sí"| Execute["Ejecutar traspaso"]
    AI_Decision -->|"No"| Counter["Contraoferta o rechazo"]
    Execute --> Update
    Counter --> Trade
    
    FA -->|"Ofrecer contrato"| AI_Decision2{"Jugador acepta?"}
    AI_Decision2 -->|"Sí"| Sign["Firmar jugador"]
    AI_Decision2 -->|"No"| FA
    Sign --> Update
    
    Sim -->|"Procesar"| Results["Resultados generados"]
    Results -->|"Mostrar"| Dashboard
    
    Update --> Dashboard
```

---

## Opciones por Defecto (Configuración)

### Perfiles Pre-definidos

```typescript
const DEFAULT_PROFILES = {
  rookie: {
    difficulty: "rookie",
    tradeDifficulty: "easy",      // IA más permisiva
    salaryCapRules: "relaxed",    // Margen de error mayor
    injuriesEnabled: false,
    autoSave: true,
    simulationSpeed: "weekly",
    tutorialEnabled: true,
    hintsEnabled: true,
  },
  
  pro: {
    difficulty: "pro",
    tradeDifficulty: "medium",    // IA realista
    salaryCapRules: "strict",     // Reglas CBA estrictas
    injuriesEnabled: true,
    autoSave: true,
    simulationSpeed: "daily",
    tutorialEnabled: false,
    hintsEnabled: true,
  },
  
  hallOfFame: {
    difficulty: "hall-of-fame",
    tradeDifficulty: "hard",      // IA dura en negociaciones
    salaryCapRules: "strict",
    injuriesEnabled: true,
    autoSave: false,              // Manual save only
    simulationSpeed: "daily",
    tutorialEnabled: false,
    hintsEnabled: false,          // Sin ayudas
    ironmanMode: true,            // Una sola partida, si te echan perdés
  }
};
```

### Configuración Default (Primera vez)

```typescript
const DEFAULT_GAME_CONFIG: GameSettings = {
  startDate: new Date().toISOString().split('T')[0], // Hoy
  currentSeason: 2024,
  
  // Equipo seleccionado por usuario
  userTeamId: null, // Se setea en selección
  
  // Dificultad
  difficulty: "pro",
  
  // Simulación
  simulationSpeed: "daily",
  autoSave: true,
  saveFrequency: "daily",
  
  // Reglas
  tradeDeadline: true,
  salaryCapRules: "strict",
  injuriesEnabled: true,
  
  // UI
  currencyFormat: "short",
  showAdvancedStats: false,
  theme: "dark",
  
  // Notificaciones
  emailNotifications: false, // En web, no tiene sentido
  tradeAlerts: true,
  injuryAlerts: true,
  contractAlerts: true,
};
```

---

## Estados del Usuario en la App

```mermaid
stateDiagram-v2
    [*] --> Landing
    Landing --> Authenticating : Login/Register
    Authenticating --> TeamSelection : Éxito
    Authenticating --> Landing : Error
    
    TeamSelection --> DataLoading : Elegir equipo
    DataLoading --> Onboarding : Primera vez
    DataLoading --> Dashboard : Tiene partida
    
    Onboarding --> Dashboard : Completar/Skip
    
    Dashboard --> Roster
    Dashboard --> TradeMachine
    Dashboard --> FreeAgency
    Dashboard --> Calendar
    Dashboard --> Settings
    
    Roster --> Dashboard
    TradeMachine --> Dashboard
    FreeAgency --> Dashboard
    Calendar --> Dashboard
    Settings --> Dashboard
    
    Dashboard --> Simulating : Avanzar fecha
    Simulating --> Dashboard : Resultados listos
    
    Dashboard --> [*] : Logout
```

---

## Wireframes de Pantallas Clave

### 1. Selección de Equipo

```
┌─────────────────────────────────────────────────────────────┐
│  THE ASSOCIATION                              [Login/Perfil]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "Elige tu franquicia"                                      │
│                                                             │
│  [Todos] [East] [West] [Contenders] [Rebuilders]           │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  🏀     │  │  🏀     │  │  🏀     │  │  🏀     │       │
│  │ LAKERS  │  │ CELTICS │  │ BULLS   │  │ ...     │       │
│  │         │  │         │  │         │  │         │       │
│  │ ⭐ 85   │  │ ⭐ 88   │  │ ⭐ 78   │  │         │       │
│  │ $45M    │  │ $12M    │  │ $89M    │  │         │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                             │
│  [Continuar ▶]  (deshabilitado hasta seleccionar)         │
└─────────────────────────────────────────────────────────────┘
```

### 2. Dashboard Principal

```
┌─────────────────────────────────────────────────────────────┐
│ 🏀 LAKERS                    Oct 22, 2024       [$12M Cap] │
│ GM: Usuario                                      [🔔] [⚙️]  │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ 📊   │  PRÓXIMO PARTIDO        ALERTAS           STANDING  │
│ 🏀   │  ┌──────────────┐      ┌────────────┐    ┌───────┐ │
│ 📅   │  │ vs Warriors  │      │ ! 3 contr. │    │ #3    │ │
│ 💰   │  │ Hoy 8:00 PM  │      │   expiran  │    │ West  │ │
│ 🎯   │  │ [Preparar]   │      │ ! Lesión   │    │ 2-0   │ │
│ 📝   │  └──────────────┘      └────────────┘    └───────┘ │
│ ⚙️   │                                                      │
│      │  CAP SPACE BREAKDOWN      NOTICIAS DE LIGA         │
│      │  ┌──────────────────┐     ┌────────────────────┐   │
│      │  │ Salary Cap       │     │ • Trade: Beal to...│   │
│      │  │ ████████░░ $140M │     │ • Lesión: Embiid...│   │
│      │  │ Used             │     │ • Rumor: Lillard...│   │
│      │  │ ██████░░░░ $128M │     └────────────────────┘   │
│      │  │ Available        │                              │
│      │  │ ██░░░░░░░░ $12M  │  [SIMULAR SIGUIENTE DÍA ▶]  │
│      │  └──────────────────┘                              │
└──────┴──────────────────────────────────────────────────────┘
```

---

## Decisiones de Diseño Pendientes

### 1. Progresión Temporal
- [ ] ¿Días exactos o saltos semanales?
- [ ] ¿Simular partido por partido o en bloques?
- [ ] ¿Playoffs automáticos o manual?

### 2. Interacción con otros equipos
- [ ] ¿IA propone traspasos o solo reacciona?
- [ ] ¿Notificaciones de otros GMs?
- [ ] ¿Chat/simulación de negociaciones?

### 3. Multiplayer (futuro)
- [ ] ¿Ligas privadas con amigos?
- [ ] ¿Draft online sincrónico?
- [ ] ¿Trade entre usuarios humanos?

### 4. Persistencia
- [ ] ¿Una partida por usuario o múltiples?
- [ ] ¿Cloud save automático?
- [ ] ¿Exportar/importar partidas?

---

## Checklist de Implementación

### MVP (Fase 1)
- [x] Login/Auth con Supabase
- [x] Selección de equipo
- [x] Descarga de datos (teams, players, contracts)
- [x] Dashboard básico
- [ ] Visualización de roster
- [ ] Simulación básica (avanzar días)

### Fase 2
- [ ] Trade machine básico
- [ ] Free agency simple
- [ ] Salary cap calculator
- [ ] Standing y resultados

### Fase 3
- [ ] Draft
- [ ] Playoffs
- [ ] Múltiples temporadas
- [ ] Logros/historial

---

## Notas

- **Target Audience**: Fans de NBA que juegan NBA 2K MyGM, Basketball GM, o similares
- **Diferenciador**: Realismo de datos + Simplicidad de UI
- **Monetización**: Free con features premium (estadísticas avanzadas, múltiples saves)

---

*Documento creado para definir la experiencia de usuario antes de implementación*
