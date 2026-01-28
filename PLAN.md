# 🏀 Project: NBA GM Manager (codename: "The Association")

## 🚀 Objetivo
Crear un simulador de gestión de la NBA donde el usuario toma el rol de General Manager (GM) con enfoque en realismo de datos, lógica de Salary Cap y una interfaz profesional.

## 🏗️ Stack Tecnológico
- **Runtime/Package Manager:** Bun (All-in-one).
- **Frontend:** Next.js 15 (App Router) + TypeScript.
- **UI:** shadcn/ui + Tailwind CSS.
- **State Management:** Zustand (ligero y potente).
- **Validations:** Zod 4.
- **Fetching/Cache:** TanStack Query.
- **Linting/Formatting:** Biome.
- **Backend/DB:** Supabase (PostgreSQL + Auth).
- **Data Ingestion:** Python (nba_api + requests) para el scrapeo inicial.
- **Arquitectura:** Hexagonal / Clean Architecture (Separación clara de lógica de negocio).

## 📂 Estructura de Carpetas & Arquitectura
Este proyecto sigue **Clean Architecture**. La regla de oro es: **"La dependencia fluye hacia adentro"**. El Dominio no sabe nada de React ni de Supabase.

```text
.
├── app/                         # 🌐 PRESENTATION: Rutas de Next.js (Pages, Layouts)
│   ├── (dashboard)/             # Grupo de rutas protegidas
│   └── api/                     # Route Handlers
│
├── components/                  # 🎨 UI: Componentes visuales
│   ├── ui/                      # Primitivos de shadcn (Button, Card, Input)
│   └── teams/                   # Componentes de negocio (TeamCard, RosterTable)
│
├── src/
│   ├── domain/                  # 🧠 CORE: Reglas de Negocio (Puro TS)
│   │   ├── entities/            # Modelos puros (ej: Team.ts, Player.ts)
│   │   └── repositories/        # Contratos/Interfaces (ej: TeamRepository.ts)
│   │
│   ├── application/             # 🤝 ORQUESTACIÓN: Casos de uso y Estado
│   │   ├── stores/              # Zustand Stores (ej: useTeamStore.ts)
│   │   └── use-cases/           # Lógica compleja (ej: ValidateTrade.ts)
│   │
│   └── infrastructure/          # 🔌 IMPLEMENTACIÓN: El mundo real
│       ├── supabase/            # Configuración de clientes (client.ts, server.ts)
│       └── repositories/        # Implementación real (ej: SupabaseTeamRepository.ts)
│
└── scripts/                     # 🐍 ETL: Scripts de Python para datos
```

### 📌 Ejemplo de Flujo: "Mostrar Lista de Equipos"
1.  **Domain:** Definimos qué es un `Team` (Entity) y creamos la interfaz `TeamRepository` que dice *"necesito una forma de buscar equipos"*.
2.  **Infrastructure:** Creamos `SupabaseTeamRepository` que implementa esa interfaz usando el cliente de Supabase.
3.  **Application:** Un store de Zustand (`useTeamStore`) o un hook de TanStack Query usa el repositorio para pedir los datos.
4.  **Presentation (App/Components):** La página `app/teams/page.tsx` usa el hook y le pasa la data a `<TeamGrid />`.

## 🗺️ Roadmap de Implementación

### Fase 1: Cimientos y Datos (Semana 1)
- [x] **Setup Inicial:** Configurar repo, carpetas y conexión a Supabase.
- [x] **Esquema SQL:** Definir tablas de `teams`, `players`, `contracts`.
- [x] **ETL Script:** Script en Python para traer rosters actuales.
- [x] **Capa de Dominio:** Definir las entidades básicas en TypeScript (`Player`, `Team`, `Contract`).
- [x] **Tooling:** Configurar Biome, Bun, Zustand, Zod.

### Fase 2: El Motor de la NBA (Semana 2)
- [ ] **Data Layer:** Crear repositorios en `infrastructure` para conectar con Supabase.
- [ ] **State Store:** Crear stores de Zustand para manejar equipos y jugadores.
- [ ] **Calculadora de Cap:** Implementar lógica de salarios (Luxury Tax, Hard Cap).
- [ ] **Trade Machine Core:** Lógica de validación de traspasos (reglas CBA simplificadas).

### Fase 3: Dashboard del GM (Semana 3)
- [ ] **Roster View:** Tabla interactiva con stats y contratos (usando TanStack Query).
- [ ] **Trade Interface:** Selector de jugadores para "armar el paquete" del traspaso.
- [ ] **Simulador de Calendario:** Botón para avanzar el tiempo y procesar resultados.

## 🛠️ Reglas del Juego (CBA Simplificado)
1. **Salary Cap:** $140M (Referencia).
2. **Luxury Tax:** Penalización si pasas el límite.
3. **Traspasos:** Los salarios deben cuadrar (dentro de un 125% de margen si el equipo paga impuestos).
4. **Roster:** Mínimo 12 jugadores, máximo 15.
