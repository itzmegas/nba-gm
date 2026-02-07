# Arquitectura de Estado en "The Association"

## Server State vs Client State

Esta guía explica la separación de responsabilidades entre TanStack Query (Server State) y Zustand (Client State) en nuestro simulador de NBA GM.

---

## Diagrama de Arquitectura General

```mermaid
flowchart TB
    subgraph "Data Layer"
        Supabase[("Supabase<br/>PostgreSQL")]
    end

    subgraph "Infrastructure Layer"
        Repos["Repositories<br/>SupabaseTeamRepository<br/>SupabasePlayerRepository<br/>SupabaseContractRepository"]
    end

    subgraph "Application Layer"
        subgraph "Server State (TanStack Query)"
            TQ_Hooks["React Query Hooks<br/>• useTeams()<br/>• usePlayers()<br/>• useContracts()"]
            TQ_Cache[("Query Cache<br/>• Stale time<br/>• Refetching<br/>• Invalidation")]
        end

        subgraph "Client State (Zustand)"
            ZS_Stores["Zustand Stores<br/>• useTeamStore<br/>• usePlayerStore<br/>• useTradeStore"]
        end
    end

    subgraph "Presentation Layer"
        Components["React Components<br/>• TeamSelector<br/>• RosterView<br/>• TradeBuilder"]
    end

    Supabase <-->|"HTTP / SQL"| Repos
    Repos -->|"Fetch Data"| TQ_Hooks
    TQ_Hooks -->|"Cache & Provide"| TQ_Cache
    TQ_Cache -->|"Hydrate"| Components
    ZS_Stores -->|"UI State"| Components
```

---

## Server State (TanStack Query)

### ¿Qué guarda?
- Datos de la base de datos
- Equipos, jugadores, contratos
- Stats y resultados
- Cache de peticiones HTTP

### Características
```mermaid
mindmap
  root(("Server State<br/>TanStack Query"))
    Cache Automatico
      Deduplicacion de requests
      Stale Time configurable
      Background refetching
    Sincronizacion
      Real-time updates
      Optimistic updates
      Invalidacion manual
    Estado de carga
      isLoading
      isFetching
      isError
    Persistencia temporal
      En memoria RAM
      Durante la sesion
```

### Ejemplo de Flujo

```mermaid
sequenceDiagram
    participant C as Component
    participant TQ as TanStack Query
    participant R as Repository
    participant S as Supabase

    C->>TQ: useTeams()
    TQ->>TQ: ¿En cache?
    alt Cache MISS
        TQ->>R: getAll()
        R->>S: SELECT * FROM teams
        S-->>R: [Lakers, Celtics, Bulls...]
        R-->>TQ: Team[]
        TQ->>TQ: Guardar en cache
    end
    TQ-->>C: Team[]
    
    Note over C,TQ: 5 minutos después...
    
    C2->>TQ: useTeams()
    TQ->>TQ: ¿En cache?
    TQ->>TQ: Sí, pero STALE
    TQ-->>C2: Datos cacheados (instantáneo)
    TQ->>R: getAll() (background)
    R->>S: SELECT * FROM teams
    S-->>R: [Lakers, Celtics...]
    TQ->>TQ: Actualizar cache
```

---

## Client State (Zustand)

### ¿Qué guarda?
- Selecciones del usuario
- Filtros activos
- Estado de UI (modales abiertos, etc)
- Datos temporales (traspaso en progreso)

### Características
```mermaid
mindmap
  root(("Client State<br/>Zustand"))
    UI State
      Selected items
      Active filters
      Modal states
      Form inputs
    Datos temporales
      Trade packages
      Draft picks seleccionados
      Simulaciones
    Persistencia opcional
      localStorage
      sessionStorage
      No persiste por defecto
    Inmutable
      Actions tipadas
      Selectors
      DevTools
```

### Ejemplo de Flujo

```mermaid
sequenceDiagram
    participant User
    participant UI as Component
    participant ZS as Zustand Store
    participant TQ as TanStack Query

    User->>UI: Clickea "Lakers"
    UI->>ZS: selectTeam("lakers-id")
    ZS->>ZS: selectedTeamId = "lakers-id"
    ZS-->>UI: Nuevo estado
    UI->>UI: Re-render con selección

    Note over UI,TQ: Componente de roster

    UI->>TQ: usePlayersByTeam("lakers-id")
    TQ->>TQ: Fetch jugadores de Lakers
    TQ-->>UI: Player[]
    UI->>UI: Mostrar roster

    User->>UI: Clickea "LeBron"
    UI->>ZS: togglePlayerSelection("lebron-id")
    ZS->>ZS: selectedPlayerIds = ["lebron-id"]
    ZS-->>UI: Nuevo estado
    UI->>UI: Highlight jugador seleccionado
```

---

## Caso de Uso: Armar un Traspaso

```mermaid
flowchart LR
    subgraph "Paso 1: Seleccionar Equipos"
        A1["useTeamStore<br/>setTeamA('lakers')"]
        A2["useTeamStore<br/>setTeamB('celtics')"]
    end

    subgraph "Paso 2: Seleccionar Jugadores"
        B1["usePlayerStore<br/>togglePlayer('lebron')"]
        B2["usePlayerStore<br/>togglePlayer('ad')"]
        B3["useTradeStore<br/>addPlayerToTrade()"]
    end

    subgraph "Paso 3: Validar"
        C1["useTradeStore<br/>validationResult"]
        C2["Calcular Salarios<br/>Reglas CBA"]
    end

    subgraph "Paso 4: Ejecutar"
        D1["API Route<br/>/api/trades"]
        D2["Invalidar Cache<br/>queryClient.invalidate"]
    end

    A1 --> A2 --> B1 --> B2 --> B3 --> C1 --> C2 --> D1 --> D2
```

---

## Comparación Detallada

| Aspecto | TanStack Query (Server State) | Zustand (Client State) |
|---------|------------------------------|------------------------|
| **Origen** | Base de datos (Supabase) | Interacción del usuario |
| **Persistencia** | Cache temporal | localStorage (opcional) |
| **Scope** | Global (toda la app) | Global (toda la app) |
| **Mutabilidad** | Inmutable | Inmutable |
| **Sync** | Automática con servidor | Manual |
| **Re-fetch** | Background automático | N/A |
| **Ejemplos** | Teams, Players, Contracts | SelectedTeam, Filters, TradePackage |

---

## Anti-Patrones a Evitar

### ❌ Guardar datos de la DB en Zustand

```mermaid
flowchart TD
    A["Componente"] -->|"fetchTeams()"| B["Zustand Store"]
    B -->|"Guardar en state.teams"| B
    B -->|"Render"| A

    style B fill:#ff6b6b
```

**Problemas:**
- Duplicación de estado
- Cache manual (propenso a errores)
- No hay invalidación automática
- Múltiples requests si varios componentes montan

### ✅ Usar TanStack Query para Server State

```mermaid
flowchart TD
    A["Componente"] -->|"useTeams()"| B["TanStack Query"]
    B -->|"¿En cache?"| B
    B -->|"No: Fetch"| C["Repository"]
    C -->|"Supabase"| D[("DB")]
    B -->|"Sí: Retornar"| A

    E["Otro Componente"] -->|"useTeams()"| B
    B -->|"Cache HIT"| E

    style B fill:#51cf66
```

**Ventajas:**
- Deduplicación automática
- Cache inteligente
- Refetching background
- DevTools integrados

---

## Estructura de Carpetas Recomendada

```
src/
├── application/
│   ├── hooks/                    # TanStack Query hooks
│   │   ├── teams/
│   │   │   ├── useTeams.ts       # Server state
│   │   │   ├── useTeam.ts        # Server state
│   │   │   └── useTeamPlayers.ts # Server state
│   │   ├── players/
│   │   │   └── usePlayers.ts     # Server state
│   │   └── contracts/
│   │       └── useContracts.ts   # Server state
│   │
│   └── stores/                   # Zustand stores
│       ├── useTeamStore.ts       # Client state (filters, selection)
│       ├── usePlayerStore.ts     # Client state (selection)
│       └── useTradeStore.ts      # Client state (trade builder)
│
└── infrastructure/
    └── repositories/             # Data access layer
        ├── SupabaseTeamRepository.ts
        ├── SupabasePlayerRepository.ts
        └── SupabaseContractRepository.ts
```

---

## Checklist de Implementación

Al agregar una nueva feature, preguntate:

```mermaid
flowchart TD
    Start(["Nueva Feature"]) --> Q1{"¿Los datos vienen<br/>de la base de datos?"}
    
    Q1 -->|"Sí"| SS["Usar TanStack Query"]
    Q1 -->|"No"| Q2{"¿Es estado de UI<br/>o temporal?"}
    
    Q2 -->|"Sí"| CS["Usar Zustand"]
    Q2 -->|"No"| Local["useState/useReducer<br/>Componente local"]
    
    SS --> SSR["1. Crear Repository<br/>2. Crear Hook<br/>3. Usar en Componente"]
    CS --> ZS["1. Definir Store<br/>2. Crear Actions<br/>3. Usar Selectors"]
    
    SSR --> End1(["✅ Server State"])
    ZS --> End2(["✅ Client State"])
    Local --> End3(["✅ Local State"])
```

---

## Ejemplo Completo: TeamSelector

```typescript
// components/TeamSelector.tsx
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useTeamStore, selectSelectedTeamId } from "@/application/stores";

export function TeamSelector() {
  // SERVER STATE: Datos de Supabase
  const { data: teams, isLoading, error } = useTeams();
  
  // CLIENT STATE: Qué seleccionó el usuario
  const selectedTeamId = useTeamStore(selectSelectedTeamId);
  const selectTeam = useTeamStore((state) => state.selectTeam);
  const setSearchQuery = useTeamStore((state) => state.setSearchQuery);
  const searchQuery = useTeamStore((state) => state.searchQuery);

  if (isLoading) return <div>Cargando equipos...</div>;
  if (error) return <div>Error: {error.message}</div>;

  // Filtrado en cliente (podría ser en servidor también)
  const filteredTeams = teams?.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* CLIENT STATE: Filtro de búsqueda */}
      <input
        type="text"
        placeholder="Buscar equipo..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* SERVER STATE: Lista de equipos */}
      <div className="grid grid-cols-3 gap-4">
        {filteredTeams?.map((team) => (
          <button
            key={team.id}
            onClick={() => selectTeam(team.id)}
            className={selectedTeamId === team.id ? "selected" : ""}
          >
            <img src={team.logoUrl} alt={team.name} />
            <span>{team.city} {team.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## Reglas de Oro

1. **Si viene de la DB → TanStack Query**
   - Equipos, jugadores, contratos, estadísticas
   - Cualquier dato que otros usuarios puedan modificar

2. **Si es interacción del usuario → Zustand**
   - Qué equipo está seleccionado
   - Qué jugadores elegí para un traspaso
   - Filtros activos en la UI

3. **Si es temporal y local → useState**
   - Input de un formulario antes de enviar
   - Estado de un modal (abierto/cerrado)
   - Hover states, animaciones

4. **Nunca dupliques Server State en Client State**
   - No guardes `teams` en Zustand
   - Usá los hooks de TanStack Query

---

## Recursos

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Zustand Docs](https://docs.pmnd.rs/zustand)
- [React Query vs Redux](https://tkdodo.eu/blog/react-query-and-graphql)

---

*Documento creado para "The Association" - NBA GM Simulator*
