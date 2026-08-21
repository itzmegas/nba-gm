# 🤖 Agent Instructions: "The Association" NBA GM

Usted es un Senior Architect trabajando en un simulador de gestión de la NBA. Este archivo define las reglas inquebrantables para cualquier modificación del código.

## 🏗️ Architecture: Clean/Hexagonal
Separación estricta de capas. La dependencia siempre fluye hacia el centro (Domain).

1.  **Domain (src/domain)**: Entidades puras e interfaces de repositorios. NO depende de nada externo.
2.  **Application (src/application)**: Casos de uso, stores de Zustand y hooks de TanStack Query. Orquestación pura.
3.  **Infrastructure (src/infrastructure)**: Implementaciones concretas (Supabase, API calls). Aquí vive el cliente de DB.
4.  **Presentation (src/app & src/components)**: Componentes de Next.js y shadcn/ui.

## 🛠️ Tech Stack Rules
- **Runtime**: Siempre usar `bun` para instalar/correr.
- **Lint/Format**: Biome es el único soberano. NO usar Prettier/ESLint.
- **State**: Zustand para estado global. Seguir patrón de Selectors para evitar re-renders.
- **Validation**: Zod para todo lo que entre desde afuera (API, Forms).
- **Fetching**: TanStack Query para server state.
- **Database**: Supabase con `@supabase/ssr`. 

## 🔌 Supabase Standards
- **Naming**: Las tablas y columnas en PostgreSQL deben ser `snake_case`. En TypeScript se mapean a `camelCase`.
- **Clients**: 
  - Usar `createClient` (server.ts) para Server Components y Actions.
  - Usar `createClient` (client.ts) para Hooks y Client Components.
- **Security**: 
  - RLS debe estar habilitado en todas las tablas.
  - La `SERVICE_ROLE_KEY` es de uso exclusivo para scripts de servidor (ETL) y NUNCA debe exponerse al cliente.
- **Migrations**: Los cambios en el esquema deben documentarse en `scripts/schema.sql` (por ahora, hasta implementar migraciones reales).

## 📜 Coding Standards
- **TypeScript**: Estricto al 100%. `any` está prohibido bajo pena de muerte.
- **Imports**: Usar siempre el alias `@/`. No usar paths relativos `../../`.
- **Components**: Usar patrones de React 19. Preferir Server Components.
- **Styling**: Tailwind CSS 4. Mantener atomic design en components.
- **Naming**: 
  - Componentes/Entidades: `PascalCase`
  - Funciones/Hooks/Variables: `camelCase`
  - Archivos de estilo: No existen (usar Tailwind).

## 🧪 Testing Protocol
- Antes de dar por finalizada una tarea, verificar que Biome no tire errores: `bun biome check`.
- Seguir patrones de testing con Vitest/Playwright si se requieren tests.

## 📝 Git Convention
- Usar Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`. No usar emojis en el mensaje de commit.
