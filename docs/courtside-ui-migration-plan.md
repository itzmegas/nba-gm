# Plan de migración visual de Courtside

**Fecha del análisis:** 2026-10-28.

**Estado:** catálogo híbrido, shell real y Dashboard revisados y aprobados por el usuario. Etapa de Dashboard completada; autorización explícita para registrar los commits correspondientes.

**Alcance vigente:** ordenar y verificar los cambios existentes en unidades coherentes de catálogo, shell, Dashboard y documentación. Sin otras funcionalidades, cambios de procesos ni push.

**Decisión:** conservar la estructura y los elementos útiles de la UI actual, incorporando selectivamente la tipografía, superficies, jerarquía y densidad de OpenDesign. La presentación se decide **pantalla por pantalla**: conservar, adaptar o reproducir la del prototipo cuando se apruebe para esa pantalla. Nunca reemplazar reglas ni datos reales por los del export.

**Siguiente paso:** acordar el alcance de Roster en una nueva unidad; no iniciarlo automáticamente. La aprobación visual no sustituye las verificaciones técnicas o de navegador pendientes en la sección 10.

El análisis original se realizó sin modificar archivos ni instalar dependencias. Las rutas existentes mencionadas se verificaron en el repositorio. La implementación posterior de la fase 1 incorpora las condiciones de las secciones 6 y 9; sus verificaciones se registran al final de la sección 9. Las decisiones posteriores de esta sección prevalecen sobre las recomendaciones originales; no constituyen aprobación general de todas las pantallas o ampliaciones del roadmap.

## 0. Acuerdos vigentes y forma de trabajo

**Aprobación vigente (2026-10-28):** el usuario aprobó el Dashboard actual y solicitó sus commits correspondientes. Quedan completadas las unidades visuales de catálogo, shell y Dashboard. Esta aprobación no acredita pruebas autenticadas de persistencia, auditoría de accesibilidad ni build productivo, y no autoriza implementar Roster ni otras pantallas en esta entrega. Los estados pendientes y límites anteriores se conservan abajo como registro histórico.

**Continuación autorizada (2026-10-28):** tras revisar la captura del shell real, el usuario indicó continuar con la unidad híbrida de Dashboard acordada abajo. Esta autorización posterior supera el límite histórico de «solo shell», pero no autoriza otras pantallas ni sustituye la aprobación humana del Dashboard resultante.

**Aprobación posterior del usuario (2026-10-28):** aprobó visualmente el catálogo híbrido y autorizó únicamente la implementación del shell productivo: fuentes, superficies y jerarquía, conservando marco inset, escudo sin wordmark, Lucide, ubicación de controles y todos los comportamientos de simulación. No autorizó composición del Dashboard ni otras pantallas. Los tokens y overrides globales del preview no se activan en la partida. Esta autorización de alcance no sustituye la aprobación humana del shell resultante.

### Base híbrida acordada

| Área | Decisión |
|---|---|
| Shell | Conservar el layout actual enmarcado/inset: sidebar y main como superficies diferenciadas, con su borde y separación. No sustituirlo por la composición plana del prototipo. |
| Identidad y navegación | Mantener los iconos Lucide actuales y el escudo de la franquicia. No mostrar el nombre «Courtside» en la sidebar de la partida. |
| Dashboard | Conservar próximo partido, posiciones, finanzas y alertas; posiciones cercanas con la franquicia resaltada y enlaces directos a Calendar y Roster. |
| Resumen financiero | Mantener la barra salarial con datos reales, cargos por cortes y umbrales de cap/tax/aprons, aunque posteriormente exista una página de Finanzas. No crear esa página en esta unidad. |
| Fin de temporada | Compactar el vacío de «No next game» y dar jerarquía a los accesos existentes a Postseason/offseason, sin inventar acciones ni habilitar una siguiente temporada. |
| Pie de sidebar | Ordenar la jerarquía de fecha, estado y simulación; conservar acciones, progreso, pausa, restricciones y salvaguardas. |
| Lenguaje visual | Usar OpenDesign para mejorar fuentes, superficies, jerarquía y densidad; no imponer sus dimensiones o composiciones a todos los elementos. Mantener temas de franquicia y modo claro. |

La sidebar productiva ya muestra el escudo sin el wordmark Courtside: debe conservarse. El ajuste pendiente corresponde a la muestra del catálogo y a la dirección visual, no a eliminar una marca que ya no existe en producción.

### Ciclo obligatorio por pantalla

1. **Comparar:** revisar la pantalla actual y su referencia, inventariando datos, acciones, estados y enlaces que deben sobrevivir.
2. **Acordar la presentación:** elegir con el usuario qué se conserva, qué se adapta y qué se reproduce del prototipo. Registrar la decisión para esa pantalla; no extrapolarla a las siguientes.
3. **Implementar una unidad acotada:** modificar presentación sobre componentes y flujos reales. Si falta una capacidad o fuente de datos, separarla como trabajo funcional explícito.
4. **Verificar:** comprobar datos, navegación, estados, responsive, accesibilidad y persistencia según corresponda, además de las pruebas técnicas de la sección 10.
5. **Revisar y aprobar:** mostrar el resultado y ajustar con el usuario antes de pasar a la siguiente pantalla.

Una pantalla puede adoptar de forma completa la **presentación** del prototipo dentro del shell acordado, pero no sus fixtures, negociaciones simuladas, métricas sin fuente ni lógica de negocio. Se mantienen las correcciones de legibilidad, accesibilidad y modo claro. Todavía no se ha decidido cuáles de las demás pantallas seguirán esa opción.

## 1. Arquitectura actual relevante para la UI

### Estructura y composición

| Área | Implementación verificada | Qué conservar |
|---|---|---|
| Aplicación | Next.js 16.1.4, App Router, React 19.2.3 | Rutas, layouts y límites server/client. |
| Layout raíz | `src/app/layout.tsx` | Providers de temas, internacionalización, React Query y tooltips. |
| Autenticación | `src/app/(protected)/layout.tsx` | Protección de las rutas autenticadas. |
| Acceso a partidas | `src/app/(protected)/games/[gameId]/layout.tsx` | Comprobación server-side de usuario, propiedad y partida eliminada. |
| Shell de la partida | `src/app/(protected)/games/[gameId]/dashboard/layout.tsx` | Contexto de partida, tema de franquicia, sidebar y header. |
| Navegación y simulación | `src/components/dashboard/layout-components.tsx` | Rutas activas, avance temporal, progreso, pausa y restricciones. |
| Lógica de aplicación | `src/application/hooks/`, `src/application/stores/` | Consultas, mutaciones, coordinación y selectores existentes. |
| Dominio | `src/domain/` | Entidades, contratos y reglas del juego. |
| Datos | `src/infrastructure/repositories/`, `src/infrastructure/supabase/` | Clientes, repositorios, mapeos y acceso a Supabase. |

Las pantallas consumen hooks de aplicación. No es necesario trasladar consultas ni reglas de negocio a los nuevos componentes visuales.

### Librerías que ya resuelven la migración

- **Tailwind CSS 4:** configuración CSS-first en `src/app/globals.css`.
- **shadcn/ui:** componentes locales con estilo `radix-maia`.
- **Radix UI:** diálogos, selects, menús, tooltips, sheet y otras primitivas.
- **Base UI:** utilizado por el combobox.
- **Lucide:** iconografía.
- **CVA, clsx y tailwind-merge:** variantes y composición de clases.
- **tw-animate-css:** animaciones de componentes.
- **TanStack Query:** estado remoto.
- **Zustand:** estado compartido, incluida la coordinación de simulaciones.
- **Zod:** validación.
- **next-themes:** modos claro, oscuro y sistema.
- **Vitest y Testing Library:** pruebas existentes.

No se encontró una biblioteca específica de gráficos, TanStack Table ni una instalación/configuración de Playwright.

**Dependencias nuevas necesarias para comenzar: ninguna.**

### Temas y estilos actuales

`src/app/globals.css` ya contiene:

- Variables semánticas compatibles con shadcn.
- Temas claro y oscuro.
- Colores de las franquicias.
- Selección, foco y reducción de movimiento.
- Overrides de una etapa visual anterior.

`src/components/theme/team-theme-applier.tsx` aplica la franquicia mediante `data-team` sobre `<html>`. Esto también permite tematizar componentes renderizados mediante portales.

Hay dos detalles importantes:

1. Los overrides actuales tienen suficiente especificidad para imponerse sobre nuevos tokens y estados de botones. Hay que resolver esa precedencia, no seguir acumulando excepciones.
2. `components.json` apunta a `app/globals.css`, pero el archivo real es `src/app/globals.css`. Conviene corregirlo antes de volver a utilizar el generador de shadcn.

## 2. Pantallas existentes y funcionalidad real

En esta tabla, **implementada** significa conectada en el código; no implica una comprobación contra la base desplegada durante esta revisión.

| Pantalla y archivo | Estado actual |
|---|---|
| Dashboard — `src/app/(protected)/games/[gameId]/dashboard/page.tsx` | Próximo partido, posiciones, finanzas y alertas reales. |
| Roster — `src/app/(protected)/games/[gameId]/dashboard/roster/page.tsx` | Plantel de la partida, selección, atributos, estadísticas, contratos y cortes bajo restricciones. |
| League — `src/app/(protected)/games/[gameId]/dashboard/league/page.tsx` | Exploración de planteles por equipo, búsqueda y vistas de atributos/estadísticas. No es todavía el hub del prototipo. |
| Player Profile — `src/app/(protected)/games/[gameId]/dashboard/player/[id]/page.tsx` | Biografía y contratos. La sección de estadísticas/scouting es parcial y contiene un placeholder. |
| Trades — `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx` | Jugadores, picks, validación, ejecución transaccional e historial persistido. |
| Free Agency — `src/app/(protected)/games/[gameId]/dashboard/free-agency/page.tsx` | Mercado, ofertas y resultados reales; las ofertas pendientes se resuelven mediante días simulados. Tiene restricciones de compatibilidad de partida. |
| Calendar — `src/app/(protected)/games/[gameId]/dashboard/schedule/page.tsx` | Calendario, navegación mensual, resultados y box scores guardados. |
| Daily Games — `src/app/(protected)/games/[gameId]/dashboard/schedule/day/[date]/page.tsx` | Partidos de la fecha, navegación y resultados expandibles. |
| Postseason — `src/app/(protected)/games/[gameId]/dashboard/postseason/page.tsx` | Play-in, playoffs, resultados, campeón y estado de eliminación. También aloja offseason. |
| Settings | Existe el enlace en la sidebar, pero **no existe la página**. |

### Otras superficies que no deben perderse

- Gestión de partidas: `src/app/(protected)/page.tsx`.
- Creación de partida: `src/app/(protected)/games/new/page.tsx`.
- Career: `src/app/(protected)/career/page.tsx` y `src/app/(protected)/career/[careerId]/page.tsx`. Es un modo separado, actualmente oculto en la navegación principal.
- Login: `src/app/login/page.tsx`.
- Contraseña: `src/app/account/password/page.tsx`.
- Recuperación: `src/app/auth/recovery/route.ts`.
- Preview visual: `src/app/ui-preview/page.tsx`, disponible únicamente en desarrollo.
- Las rutas antiguas bajo `src/app/dashboard/` redirigen al inicio.
- `src/app/select-team/page.tsx` redirige a creación de partida.

**Offseason merece especial cuidado:** ya tiene decisiones persistidas y proyecciones. No es simplemente una maqueta, pero tampoco habilita todavía una siguiente temporada jugable.

## 3. Qué aporta realmente OpenDesign

El directorio `docs/NBA-Franchise-Management-Redesign/` contiene **10 HTML, 17 JavaScript y 14 hojas de estilo**, además de recursos.

### Identidad visual

La referencia principal está en `docs/NBA-Franchise-Management-Redesign/styles.css`.

| Elemento | Valor observado |
|---|---|
| Fondo general | `#101114` |
| Sidebar | `#141518` |
| Paneles | `#191b1f` |
| Superficies elevadas | `#202227` |
| Separadores | `#2d2f35` |
| Texto principal | `#f4f4f6` |
| Texto secundario | `#a5a7b1` |
| Acento | `#713eb8` |
| Hover del acento | `#8250ca` |
| Acento claro / suave | `#c9abf2` / `#282035` |
| Positivo / advertencia / negativo | `#96d6b3` / `#e9be76` / `#ed9b9e` |

La diferencia con la UI actual no es únicamente el color:

- Tipografía condensada para títulos y métricas.
- Paneles compactos con bordes discretos, sin sombras permanentes.
- Escudos, retratos y estadísticas con mayor protagonismo.
- Tablas densas acompañadas por inspectores.
- Navegación organizada como un juego de franquicias.
- Jerarquía editorial: contexto, protagonista, métricas y acciones.

### Tipografía y geometría

- **Barlow:** texto y controles.
- **Barlow Condensed:** títulos y cifras destacadas.
- Sidebar de escritorio: **216 px**.
- Header: mínimo **88 px**.
- Contenido: hasta **1800–1840 px**, según pantalla.
- Paneles: radio **6 px**.
- Controles: radio **4 px**.
- Diálogos: radio **8 px**.
- Bordes: generalmente **1 px**.
- Movimiento base: **180 ms**.
- Sombras fuertes reservadas para overlays, drawers y notificaciones.

Los inspectores suelen ocupar unos **268–336 px**, o aproximadamente el 27–30 % del espacio. Las vistas pasan a disposición vertical cuando deja de entrar una tabla legible.

### Pantallas y experiencias presentes

Además de los HTML independientes, hay vistas mediante hashes, parámetros y diálogos:

- Dashboard.
- Roster con inspector y vistas de contratos/ratings/estadísticas.
- Calendar con eventos y detalle del día.
- Trade Center.
- Free Agency con shortlist y drawer de oferta.
- League Overview.
- Standings.
- Teams.
- Franchise Profiles.
- Players.
- Player Profiles y comparación.
- League Leaders.
- Transactions.

**El manifest no describe todo ese mapa de estados.** Tampoco contiene un Design System resuelto: parte del trabajo consiste precisamente en extraerlo del código.

### Limitaciones que no conviene trasladar

El export no utiliza backend, `fetch` ni persistencia del navegador:

- Advance Day cambia fechas locales o muestra una notificación.
- Las respuestas de negociación pueden seleccionarse manualmente.
- Algunas extensiones modifican contratos en memoria.
- Las operaciones no se sincronizan entre pantallas.
- `txLedgerSnapshot()` devuelve siempre `null`: Transactions tiene presentación, pero no un historial conectado.
- Hay diferencias de plantel, salarios y umbrales financieros entre páginas.

También faltan estados asíncronos reales de carga, error y reintento.

En responsive hay inconsistencias: navegación que desaparece en ciertas vistas móviles, controles pequeños y textos de hasta 6–8 px. **Debe conservarse el lenguaje visual, no esos problemas de implementación.**

### Assets y fuentes

Hay 30 escudos SVG, 58 retratos PNG y fuentes locales.

Dos precauciones:

- Los siete archivos llamados `.woff2` contienen realmente datos TrueType. Hay que corregir su empaquetado antes de integrarlos con `next/font/local`.
- Los créditos de imágenes NBA **no conceden licencia de redistribución**. No debe asumirse que se puede publicar todo el directorio.

Las fuentes incluyen licencias SIL OFL; deben conservarse sus avisos.

## 4. Comparación: reutilizar, adaptar y ampliar

### Inventario de componentes compartidos

Las entradas abreviadas de la primera columna pertenecen al mismo directorio indicado al comienzo de su fila.

| Base actual verificada | Tratamiento recomendado |
|---|---|
| `src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `combobox.tsx` | Conservar APIs y comportamiento; adaptar tipografía, radios, superficies y estados. |
| `src/components/ui/card.tsx`, `badge.tsx` | Conservar APIs; adaptar superficies y densidad donde aporte valor, sin eliminar por sistema los bordes y formas actuales. |
| `src/components/ui/dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx` | Conservar primitivas y gestión de foco. Adaptar apariencia y dimensiones. |
| `src/components/ui/sidebar.tsx` | Conservar colapso, navegación móvil, contexto y composición enmarcada actual; adaptar estilo y jerarquía sin reemplazar el shell. |
| `src/components/ui/app-table.tsx` | Convertirlo en la base visual de las tablas del rediseño. |
| `src/components/ui/sortable-table-header.tsx`, `table-actions.tsx` | Conservar ordenamiento accesible y acciones. |
| `src/components/players/player-headshot.tsx` | Conservar fuente dinámica, carga y fallback. |
| `src/components/roster/roster-table.tsx`, `roster-table-views.tsx` | Adaptar presentación sin perder ordenamiento, clasificación contractual ni navegación. |
| `src/components/games/FixtureGameCard.tsx`, `GameBoxScore.tsx`, `SeasonStatistics.tsx` | Reutilizar datos y estados; rediseñar su composición visual. |
| `src/components/theme/theme-toggle.tsx`, `src/components/i18n/LocaleSwitcher.tsx` | Mantener capacidades y persistencia existentes. |

### Qué adaptar según cada pantalla

Revisar **composiciones de presentación**, no sustituir mecanismos funcionales. Estos son candidatos, no reemplazos obligatorios:

- Jerarquía de sidebar y header, conservando el marco, el escudo y los iconos actuales.
- Jerarquía y distribución del Dashboard, conservando sus módulos útiles y barra financiera.
- Presentación de identidad de jugadores.
- Encabezados, filtros y paneles de inspección.
- Clases visuales heredadas del estilo Maia que contradigan la dirección acordada.

No reemplazar Radix por implementaciones manuales ni copiar los diálogos del HTML.

### Componentes nuevos justificados

Crearlos cuando aparezca su uso real, no todos por adelantado:

- Encabezado de pantalla: contexto, título, descripción y acciones.
- Identidad compartida de equipo: escudo, nombre, abreviatura y fallback.
- Identidad compartida de jugador, compuesta sobre `PlayerHeadshot`.
- Badge de rating con valor, significado y estado estimado.
- Inspector de jugador reutilizable entre listados.
- Navegación de League mediante enlaces reales.
- Controles de simulación extraídos de la sidebar, si se trasladan al header.

Cards, barras y filtros simples pueden componerse con lo existente: no necesitan automáticamente otra abstracción.

### Separación de alcance

| Experiencia del prototipo | Tipo de trabajo |
|---|---|
| Colores, fuentes, paneles, tablas, botones y shell | **Visual.** |
| Inspector usando jugador seleccionado y datos existentes | **Nueva composición de UI.** |
| Standings completo y directorio de equipos | **Nueva pantalla sobre datos existentes.** |
| Players global y comparación básica | **Nueva experiencia de consulta**, cuidando datos específicos de la partida. |
| League Leaders | **Nueva presentación y reglas de ranking** sobre estadísticas ya disponibles. |
| Historial unificado de Transactions | **Nueva integración de lecturas**; no hay una pantalla/lector unificado actual. |
| Shortlist y notas persistentes | **Nueva funcionalidad**, con decisiones de persistencia y permisos. |
| Negociación de trades, counteroffers y estrategia de GM | **Nueva lógica de negocio.** |
| Extensiones ejecutables, términos avanzados de contratos o rollover | **Funcionalidad de dominio**, fuera del reskin. |
| POT, interés, fit, riesgo o seguridad laboral | No mostrar puntuaciones sin una fuente y un contrato de datos verificados. |

Una oportunidad concreta: `src/application/hooks/schedule/useSeasonStatistics.ts` ya obtiene estadísticas globales por partida, temporada y fase. **Leaders no exige asumir nuevas tablas**, aunque sí definir empates, mínimos de participación y cobertura.

En cambio, `src/domain/entities/LeagueStanding.ts` solo expone victorias y derrotas. Rachas, L10 y registros local/visitante necesitan derivación o lecturas adicionales.

## 5. Propuesta del Design System

**Es la primera fase y ya tiene una implementación aislada.** Su siguiente iteración debe reflejar los acuerdos híbridos de la sección 0, sin migrar inmediatamente las pantallas.

### Dirección visual

- Superficies oscuras inspiradas en OpenDesign sobre el layout enmarcado actual.
- Barlow para lectura y Barlow Condensed para personalidad deportiva.
- Tipografía condensada en títulos y cifras importantes, sin convertir todos los textos y controles en mayúsculas.
- Bordes y contraste de superficies antes que sombras.
- Números tabulares para estadísticas y dinero.
- Acentos de franquicia sobre una estructura neutral consistente.
- Conservar iconos, escudo y barra salarial; la identidad nueva no exige sustituirlos.

Las medidas de la sección 3 describen el prototipo, y las de tokens son una base para evaluar: no obligan a cambiar la geometría del shell actual ni el radio de todos sus contenedores. La evidencia de la fase 1 documenta la primera muestra, no una geometría aprobada para producción.

Se recomienda mantener los colores por equipo: fijar el morado para todas las franquicias simplificaría las capturas, pero perdería una capacidad existente. Sacramento puede reproducir la referencia; las demás franquicias conservarían su identidad.

El modo claro debe mantenerse. Como el prototipo no lo define, su adaptación necesitará aprobación visual propia; no conviene eliminarlo ni forzar dark silenciosamente.

### Tokens propuestos

| Grupo | Definición |
|---|---|
| Superficies | Canvas, sidebar, panel, panel elevado, control y selección. |
| Texto | Principal, secundario, discreto e invertido. |
| Marca/franquicia | Primario, hover, texto sobre primario, selección suave y foco. |
| Estados | Positivo, advertencia, destructivo e informativo, con texto/icono además de color. |
| Tipografía | Texto de 14–16 px; metadatos generalmente 12–13 px; títulos 24–36 px; métricas hero 48–64 px. |
| Espaciado | Escala práctica de 4, 8, 12, 16, 20, 24 y 32 px. |
| Radios | 3 px badges; 4 px controles; 6 px paneles; 8 px overlays. |
| Bordes | 1 px; separar bordes decorativos de límites interactivos. |
| Sombras | Ninguna por defecto en paneles; elevación reservada para overlays. |
| Movimiento | Transiciones breves, respetando `prefers-reduced-motion`. |

La escala tipográfica propuesta **corrige deliberadamente** el texto demasiado pequeño del export.

### Reglas de componentes

- **Botones:** mantener variantes actuales; primario, secundario, outline, ghost y destructivo.
- **Inputs/selects:** mismas validaciones y estados; superficies propias de control.
- **Cards:** compactar cuando mejore la lectura; conservar bordes y separación útiles del layout actual, sin aplicar un reemplazo uniforme.
- **Tablas:** encabezados consistentes, números alineados, selección visible y ordenamiento accesible.
- **Badges:** estado explícito, sin depender únicamente del color.
- **Modales/drawers:** Radix/Dialog/Sheet, contenido desplazable y foco conservado.
- **Iconos:** conservar los Lucide actuales; no importar los diccionarios SVG duplicados.
- **Loading/error/empty:** diseñarlos como estados reales, no como cifras de ejemplo.
- **Responsive:** inspectores debajo del listado cuando sea necesario; tablas anchas con scroll contenido, no desbordamiento de toda la página.

La navegación móvil debe mantener accesibles todas las secciones. Se recomienda conservar el drawer actual antes que copiar la navegación móvil inconsistente del prototipo.

## 6. Integración con Tailwind y shadcn/ui

### Mapeo semántico, no copia de variables

Hay nombres que parecen equivalentes pero no lo son:

| OpenDesign | Adaptación |
|---|---|
| `--bg` | `--background` |
| `--panel` | `--card` |
| `--text` | `--foreground` |
| `--muted`, que representa texto | `--muted-foreground`, no la superficie `--muted` |
| `--accent`, que representa la acción principal | Familia `--primary`, no directamente el `--accent` de shadcn |

Mantener los aliases de Tailwind mediante `@theme inline` y agregar solo los tokens que realmente falten.

### Migración controlada de estilos

1. Incorporar la nueva apariencia con activación explícita exclusivamente en el preview, bajo `html[data-ui-preview="courtside"]` en el `src/app/globals.css` existente.
2. Alinear el catálogo con la dirección híbrida y verificar componentes y portales.
3. Revisar y aprobar el alcance del shell de partida antes de activar su apariencia; conservar su layout enmarcado.
4. Migrar las composiciones de cada pantalla mediante el ciclo de comparación y aprobación de la sección 0.
5. Retirar los overrides sustituidos cuando dejen de tener consumidores.

No importar `styles.css` ni las hojas de cada página. Sus selectores globales, resets y nombres genéricos podrían competir con Tailwind y los componentes actuales.

Tampoco alcanza con bajar `--radius`: los componentes tienen clases como `rounded-4xl` y `rounded-2xl`. Hay que adaptar esas decisiones visuales conservando sus props.

**Aislamiento aprobado para la fase 1:** todos los tokens y ajustes de Courtside quedan centralizados bajo ese selector; no se crean bifurcaciones de componentes, APIs nuevas ni props de estilo condicionales repartidas por la aplicación. Solo el ciclo de vida de `UiPreview` establece y restaura el marcador y las clases de variables de `next/font` sobre `<html>`, conservando los valores previos al desmontar. Así los portales montados en `<body>` heredan el mismo tema. Se conservan los 30 temas de franquicia y el modo real de `next-themes`, incluido sistema: no se fuerza oscuro.

Los aliases semánticos de controles, selección y foco prevalecen sobre los overrides históricos `.dark[data-team]` únicamente dentro del catálogo. Los pares primario/texto de los equipos se conservan; Sacramento utiliza el morado de referencia de OpenDesign dentro del preview. `ThemeToggle` mantiene su comportamiento existente: las preferencias que el usuario elige siguen siendo globales; salir del catálogo retira la identidad Courtside, no revierte una preferencia elegida explícitamente.

### Fuentes, imágenes y gráficos

- Integrar Barlow y Barlow Condensed mediante `next/font/local`, solo desde la ruta del preview. Copiar los binarios existentes a `src/app/ui-preview/fonts/` con extensión `.ttf`, acorde con su formato TrueType real, y conservar los avisos SIL OFL. No modificar las fuentes del layout raíz.
- Mantener inicialmente Geist Mono donde resulte útil para datos.
- Seguir consumiendo `player.headshotUrl` y `team.logoUrl`.
- No reconstruir URLs de imágenes dentro de componentes.
- No ampliar indiscriminadamente `remotePatterns` en `next.config.ts`.
- Resolver barras y medidores simples con CSS/SVG. Evaluar una biblioteca de gráficos únicamente si aparece una necesidad que lo justifique.

En la fase 1 no se distribuyen escudos ni retratos NBA del export: las muestras utilizan placeholders o siluetas. El consumo de URLs reales corresponde a las pantallas existentes, no a consultas nuevas del catálogo.

## 7. Orden recomendado y roadmap

Cada unidad termina con revisión visual y funcional. Las subfases se entregan por separado, no como un cambio acumulado.

**Dirección aprobada, ejecución gradual:** el usuario aceptó el enfoque híbrido y la revisión pantalla por pantalla. Esta sesión solo actualiza el plan; la implementación se retoma en una nueva sesión con el catálogo. La recepción favorable inicial no cierra su revisión ni autoriza automáticamente todas las fases. Acordar el alcance de cada unidad antes de implementarla y aprobar su resultado antes de avanzar. Las ampliaciones funcionales siguen separadas del reskin. Después de Roster y Player Profile, el orden solicitado es **Teams → Standings → Players**, reutilizando tablas, identidades e inspectores compartidos.

### Fase 1 — Design System aislado

**Objetivo:** cerrar la identidad híbrida antes de tocar pantallas productivas. La primera muestra está implementada; resta alinearla con los acuerdos posteriores y revisarla.

Se detalla en la sección 9. No depende de cambios de backend.

### Fase 2 — Shell global de la partida

- **Archivos:** `src/components/dashboard/layout-components.tsx`, `src/components/ui/sidebar.tsx` y `src/app/(protected)/games/[gameId]/dashboard/layout.tsx`.
- **Trabajo:** adaptar superficies, tipografía y jerarquía sobre el layout enmarcado actual. Mantener escudo e iconos, sin wordmark Courtside; ordenar el pie de estado/simulación. Cualquier cambio de agrupación o ubicación de controles se revisa antes, no se hereda automáticamente del prototipo.
- **Reutilización:** Sidebar, Sheet, menús, tooltips, tema y hooks actuales. No trasladar ni extraer controles de simulación sin necesidad acordada.
- **Dependencia:** catálogo alineado y aprobado; revisar el alcance concreto del shell con el usuario antes de implementarlo.
- **Riesgo:** duplicar controladores o perder acciones al colapsar.
- **Aceptación/verificación:** conservar marco y separación sidebar/main, escudo e iconos; mismas rutas, avances por día/mes/temporada, pausa, errores y bloqueo tras campeón; navegación completa con teclado y móvil.

### Fase 3 — Dashboard

- **Archivos:** página de Dashboard y `src/components/dashboard/`.
- **Trabajo:** conservar los cuatro módulos útiles y mejorar su jerarquía con el lenguaje de OpenDesign. Mantener barra salarial, posiciones cercanas con franquicia resaltada y enlaces directos. Compactar el vacío de fin de temporada y destacar los accesos existentes a Postseason/offseason. No imponer el hero ni la composición completa del prototipo.
- **Reutilización:** `NextGameWidget`, `StandingsWidget`, `CapSpaceWidget`, `AlertsWidget`.
- **Dependencia:** shell y paneles aprobados.
- **Riesgo:** introducir métricas del prototipo sin respaldo.
- **Aceptación/verificación:** cada cifra coincide con su fuente actual; barra con cargos por cortes y umbrales financieros conservados; próximo partido conserva simulación y estados de carga/error/empty; verificar temporada activa y finalizada, enlaces y aprobación visual de esta pantalla.

Es un buen primer caso real: usa pocos componentes, tiene datos conectados y permite validar la identidad rápidamente.

### Fase 4A — Roster

- **Archivos:** página de Roster, `src/components/roster/` y `src/components/players/player-headshot.tsx`.
- **Trabajo:** tabla, resumen, selección e inspector.
- **Reutilización:** vistas, sorting, estadísticas, contratos y acción de corte.
- **Dependencias:** tablas y controles del Design System.
- **Riesgo:** perder atributos existentes o confundir contratos estándar/two-way.
- **Aceptación/verificación:** misma composición de plantilla, salarios, ordenamiento y restricciones; conservar valores desconocidos/estimados.

### Fase 4B — Player Profile

- **Archivos:** página de Player Profile y componentes de identidad reutilizados.
- **Trabajo:** hero, biografía y contrato.
- **Dependencia:** fase 4A.
- **Riesgo:** convertir placeholders en información aparentemente real.
- **Aceptación/verificación:** conservar navegación de regreso y `leagueTeamId`. Conectar estadísticas existentes sería una subunidad funcional explícita; scouting no se inventa.

### Fase 5 — League existente: Teams → Standings → Players

Después de Roster (4A) y Player Profile (4B), dividir en tres entregas cuyo alcance y presentación se acuerdan individualmente:

1. **Teams:** rediseñar la exploración por equipo actual y componer el directorio sobre datos existentes.
2. **Standings:** añadir la clasificación completa, sin inventar estadísticas no disponibles.
3. **Players:** listado global específico de la partida, filtros y enlaces al perfil canónico; no esperar a la fase 11.

- **Archivos existentes:** página de League, `src/application/hooks/simulation/useStandings.ts`, hooks de equipos y roster.
- **Nuevos:** componentes y páginas de Teams, Standings y Players, con rutas por aprobar.
- **Reutilización:** tablas compartidas, identidades de equipo/jugador, vistas de solo lectura e inspector de Roster y Player Profile.
- **Dependencias:** fases 2 y 4.
- **Riesgo:** romper enlaces con `?teamId`, mostrar clasificación como seeding oficial o mezclar el equipo canónico de un jugador con su pertenencia en la partida.
- **Aceptación/verificación:** equipos/records reales, contexto conservado, filtros y navegación al perfil, y ninguna acción de corte sobre equipos ajenos. Datos no disponibles permanecen explícitos; comprobar pertenencia después de trades, fichajes y cortes.

### Fase 6 — Calendar, detalle diario y box scores

Entregas separadas: calendario mensual; después detalle diario y resultados.

- **Archivos:** páginas de Schedule y Daily Games; `src/components/games/Calendar.tsx`, `src/components/games/DailyGames.tsx`, `src/components/games/FixtureGameCard.tsx`, `src/components/games/GameBoxScore.tsx`.
- **Reutilización:** consultas, fechas, fixtures y resultados guardados.
- **Dependencias:** shell y overlays.
- **Riesgo:** fechas desplazadas por timezone o resultados ficticios.
- **Aceptación/verificación:** mismos fixtures y scores; fechas inválidas siguen devolviendo 404; fechas vacías conservan empty state; navegación y cambio de mes siguen funcionando.

Los deadlines y eventos editoriales del prototipo se incorporarían después de definir una fuente real.

### Fase 7 — Postseason y offseason

Dos unidades: brackets/resultados; después planificación.

- **Archivos:** `src/components/postseason/`, `src/components/offseason/` y página de Postseason.
- **Reutilización:** estructura actual, escudos, series, resúmenes y decisiones persistidas.
- **Dependencias:** resultados y componentes de identidad.
- **Riesgo:** simplificar incorrectamente eliminación o confundir planificación con ejecución.
- **Aceptación/verificación:** mismos participantes, seeds y resultados; decisiones conservadas tras recargar; ninguna modificación de temporada/plantel por un cambio visual.

No hay una referencia equivalente completa en OpenDesign: adaptar estas pantallas al sistema, conservando su disposición funcional actual.

### Fase 8 — Trades

- **Archivos:** página de Trades, `src/components/trades/trade-asset-panel.tsx` y `src/components/trades/trade-summary.tsx`.
- **Trabajo:** paneles de activos, resumen e impacto financiero.
- **Reutilización:** selección, picks, validadores, ejecución e historial.
- **Dependencias:** tablas, selectores e identidades.
- **Riesgo:** sustituir reglas reales por `trade-center-rules.js` del prototipo.
- **Aceptación/verificación:** ejecutar un trade en una partida de prueba y comprobar planteles, contratos, picks e historial tras recargar.

La negociación Accepted/Rejected/Counteroffer del prototipo queda fuera de esta fase.

### Fase 9 — Free Agency

- **Archivos:** página de Free Agency, `src/components/free-agency/market-screen.tsx`, `src/components/free-agency/offer-form.tsx` y `src/components/free-agency/offer-results.tsx`.
- **Trabajo:** mercado, inspector y presentación de oferta mediante Sheet si aporta valor.
- **Reutilización:** contexto financiero, límites, mutaciones y resolución diaria.
- **Dependencias:** formularios y overlays.
- **Riesgo:** mostrar aceptación inmediata o habilitar términos no soportados.
- **Aceptación/verificación:** oferta pendiente real, resolución al simular y actualización de datos; conservar bloqueo durante simulación, validaciones y reintentos.

No reducir los años admitidos ni cambiar reglas para imitar el formulario del export.

### Fase 10 — Superficies externas y Settings mínimo

Separar gestión de partidas, autenticación y Career en unidades independientes.

- **Archivos:** páginas de inicio/creación/login/contraseña/Career y sus componentes actuales.
- **Nuevo:** Settings, únicamente con preferencias realmente disponibles.
- **Reutilización:** formularios, creación y recuperación actuales; tema e idioma.
- **Dependencia:** Design System estable.
- **Riesgo:** romper inicialización o cambiar el significado de salir/cambiar partida.
- **Aceptación/verificación:** crear y reabrir partidas, recuperar contraseña y mantener redirects. Career conserva su flujo separado.

### Fase 11 — Ampliaciones de League

No implementar como un bloque único:

| Subfase | Entregable y alcance |
|---|---|
| 11A | **Overview:** composición de standings, líderes y actividad real; sin noticias inventadas. |
| 11B | **Franchise Profiles:** identidad, roster y finanzas disponibles. Front Office avanzado queda pendiente. |
| 11C | **Reservada:** Players se adelanta a la fase 5; no se duplica aquí ni se retrasa hasta completar estas ampliaciones. |
| 11D | **Leaders y comparación:** estadísticas reales, reglas de ranking y comparación explícita de dos jugadores. |
| 11E | **Transactions:** lector normalizado de eventos persistidos, con alcance y cobertura claros. |

- **Módulos:** hooks/repositorios existentes; nuevos componentes de League y consultas adicionales solo donde falten.
- **Dependencias:** tablas, perfiles, standings y fuentes verificadas.
- **Riesgos:** consultas por cada fila/equipo, mezclar datos canónicos con la partida o presentar un historial incompleto como completo.
- **Aceptación/verificación:** navegación directa/atrás, filtros, cobertura y datos después de trades/signings/releases.

Las rutas nuevas deben permanecer bajo la partida. Mantener `/player/[id]` como perfil canónico dentro del dashboard de la partida y la compatibilidad de los enlaces actuales de League.

## 8. Preservación funcional y riesgos

### Contratos que no deben cambiar durante el reskin

- **Roster:** la pertenencia sale del estado de la partida, no del equipo canónico del jugador.
- **Contratos:** respetar acuerdos efectivos, procedencia y valores estimados/desconocidos.
- **Simulación:** mantener exclusión mutua, fecha persistida esperada, pausa y finalización determinada por el servidor.
- **Trades:** mantener ejecución transaccional e invalidaciones.
- **Free Agency:** conservar identificadores de reintento y resolución mediante simulación.
- **Offseason:** las decisiones son planes; no ejecutar contratos ni crear otra temporada.
- **Supabase:** mantener propiedad, RLS, clientes y acceso privilegiado exclusivamente server-side.

### Medidas preventivas

| Riesgo | Prevención |
|---|---|
| Cascada CSS conflictiva | Activación aislada, precedencia documentada y retirada de overrides sustituidos. |
| Modales con tema incorrecto | Probar portales; no limitar los tokens a un wrapper que no los contiene. |
| Pérdida de validaciones | Mantener hooks/formularios; modificar presentación, no sus contratos. |
| Datos del prototipo en producción | Prohibir importar sus módulos de fixtures en las pantallas reales. |
| Regresiones responsive | Revisar 360, 768, 1024, 1440 y 1920 px, además de alturas cortas y zoom. |
| Pérdida de accesibilidad | Nombres para iconos, foco visible, teclado, retorno de foco y estados no basados solo en color. |
| Imágenes rotas o derechos insuficientes | Mantener providers/fallbacks y revisar licencias antes de publicar assets. |
| Migración difícil de revertir | Una unidad revisable con pruebas; no mezclar reskin y nuevas reglas de negocio. |

## 9. Primera fase detallada

### Entregable

**Un catálogo visual de Courtside dentro del `/ui-preview` existente, sin alterar todavía las pantallas reales de la partida.**

**Primera implementación realizada y bien recibida; alineación híbrida y cierre visual pendientes.** Incluye componentes representativos, tabla de roster con inspector y una muestra de navegación. No incluye la migración del shell real ni la página de Dashboard. Los fixtures son exclusivamente ilustrativos, identificados como tales: no se consultan partidas ni se montan controladores de simulación.

La próxima iteración debe mostrar el layout enmarcado elegido, conservar los iconos y representar la identidad de franquicia sin el wordmark Courtside en la sidebar de muestra. También debe permitir evaluar el resumen salarial y los estados del Dashboard acordados, sin conectar el catálogo a Supabase ni redistribuir assets NBA del export. La apariencia de roster/inspector sigue siendo una muestra: su aprobación definitiva corresponde a cada pantalla real.

Debe permitir aprobar:

- Paleta y superficies.
- Fuentes y escala.
- Los 30 temas de franquicia.
- Claro/oscuro.
- Controles, paneles, tablas y overlays.
- Estados y responsive.

### Archivos involucrados

| Archivo | Alcance de la fase 1 |
|---|---|
| `src/components/design/ui-preview.tsx` | Extender el catálogo actual, claramente identificado como muestra sin persistencia. |
| `src/app/ui-preview/page.tsx` | Conservar disponibilidad exclusiva en desarrollo; integrar `next/font/local` solo para esta ruta. |
| `src/app/ui-preview/fonts/` | Copiar las fuentes locales existentes como `.ttf` y conservar SIL OFL; sin assets NBA. |
| `src/app/globals.css` | Centralizar tokens y estilos exclusivamente bajo `html[data-ui-preview="courtside"]`; sin importar hojas del prototipo. |
| `src/components/ui/app-table.tsx` | Añadir metadatos `data-slot` estables para los estilos aislados; conservar props, clases previas y semántica. |
| `components.json` | Corregir la ruta del CSS a `src/app/globals.css`. |
| `biome.json` | Excluir únicamente el export de referencia; mantener los controles de código propio. |
| `tests/components/uiPreview.test.tsx` | Ampliar comprobaciones del catálogo y aislamiento. |
| `tests/components/gameTheme.test.tsx` | Proteger aplicación y limpieza del tema. |
| `tests/components/appTable.test.tsx` | Proteger semántica y comportamiento compartido. |

`src/app/layout.tsx` y las APIs de `src/components/ui/` no se modificaron para activar Courtside. El catálogo reutiliza las primitivas existentes. Un enlace privado consume el contexto de la sidebar para cerrar el drawer al navegar en móvil; no introduce otro provider ni otra frontera `use client`. Las tres fuentes locales suman 255.136 bytes, con `preload: false`, y conservan la licencia OFL.

### Secuencia de trabajo

1. Registrar capturas y estados actuales.
2. Integrar las fuentes locales `.ttf` y sus licencias únicamente en la ruta del preview.
3. Definir tokens y precedencia bajo el selector aislado; aplicar/restaurar marcador y clases de fuentes desde `UiPreview`, sin forzar claro/oscuro.
4. Presentar botones, formularios, paneles, badges y tablas.
5. Incorporar muestras de Dialog, Sheet, Select y menús.
6. Añadir loading, error, empty, selected, disabled e invalid.
7. Validar accesibilidad, los 30 temas, responsive, portales y limpieza al salir de la ruta.
8. Comparar con la referencia mediante el procedimiento siguiente; registrar evidencia y solicitar aprobación visual antes de iniciar la fase 2.

### Comparación visual reproducible

**Estado:** comparación ejecutada con Chrome headless y CDP; procedimiento manual conservado para reproducirla. Se utilizó Google Chrome 156.0.8078.47, sin instalar Playwright ni otra dependencia.

#### Preparación y URLs

**Estado al traspasar la sesión:** los servidores de revisión de los puertos 3001 y 4173 se detuvieron a pedido del usuario y se confirmó que no quedaban listeners. Las URLs siguientes son las utilizadas en la revisión anterior, no servicios actualmente iniciados. Estos pasos son instrucciones para una revisión futura; esta actualización documental no los ejecuta.

1. Iniciar el servidor Next local con `bun run dev --hostname 127.0.0.1 --port 3001`, o usar otro puerto disponible. En esta sesión 3000 correspondía a otro proyecto y no se modificó ese proceso.
2. Servir el export como referencia estática, sin modificar sus archivos, desde la raíz del repositorio:

   ```bash
   python3 -m http.server 4173 --bind 127.0.0.1 --directory docs/NBA-Franchise-Management-Redesign
   ```

3. Abrir el catálogo en `http://127.0.0.1:3001/ui-preview` y las referencias en `http://127.0.0.1:4173/roster.html` y `http://127.0.0.1:4173/index.html`.
4. Seleccionar **oscuro explícitamente con `ThemeToggle`** para la comparación con el export y elegir Sacramento para el acento de referencia. No alterar el modo sistema ni forzar oscuro en código. Validar claro y sistema por separado.
5. Usar navegador al **100 % de zoom**, **DPR 1** en ambos lados y esperar a `document.fonts.ready` antes de capturar. Confirmar que las fuentes y los estados elegidos estén presentes; un presupuesto de tiempo headless no demuestra por sí solo que las fuentes hayan terminado de cargar.

#### Matriz de capturas

Repetir cada par catálogo/referencia con exactamente el mismo viewport:

| Ancho × alto (px) | Revisión principal |
|---|---|
| 360 × 800 | Navegación móvil, tabla con scroll contenido e inspector apilado. |
| 768 × 1024 | Transición de columnas y controles accesibles. |
| 1024 × 900 | Densidad de tabla, paneles e inspector. |
| 1440 × 1000 | Geometría de escritorio y jerarquía tipográfica. |
| 1920 × 1080 | Límites de ancho y distribución del espacio. |

Comparar geometría, densidad, familias y escala tipográfica, tabla e inspector, cards, navegación y overlays; **no exigir coincidencia del contenido de fixtures**. Incorporar la pantalla actual como tercera referencia para comprobar lo que se decidió conservar. Las diferencias aprobadas del enfoque híbrido no son defectos de fidelidad. La navegación es una muestra, no un shell productivo terminado.

#### Ejemplos de captura con CLI

Crear previamente `/tmp/opencode/courtside-visual/` para las capturas. Estos comandos son una alternativa ilustrativa al mecanismo CDP utilizado en esta sesión; ajustar puerto y `--window-size` para cada fila. Para comparación manual controlada, usar DevTools y la preparación indicada arriba:

```bash
/usr/bin/google-chrome --headless --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1440,1000 --virtual-time-budget=5000 --screenshot=/tmp/opencode/courtside-visual/preview-1440x1000.png http://127.0.0.1:3001/ui-preview

/usr/bin/google-chrome --headless --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1440,1000 --virtual-time-budget=5000 --screenshot=/tmp/opencode/courtside-visual/roster-1440x1000.png http://127.0.0.1:4173/roster.html

/usr/bin/google-chrome --headless --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1440,1000 --virtual-time-budget=5000 --screenshot=/tmp/opencode/courtside-visual/index-1440x1000.png http://127.0.0.1:4173/index.html
```

Una sesión headless nueva puede no compartir la preferencia elegida en la UI. Solo aceptar el par cuando se hayan verificado modo, franquicia y fuentes en esa sesión; las capturas de modos distintos no son una comparación válida. `--no-sandbox` queda limitado a esta ejecución local controlada, no es una recomendación de despliegue.

**Alternativa manual obligatoria si falla headless o no se puede controlar su estado:** abrir las tres URLs en Chrome, fijar dimensiones con el modo dispositivo de DevTools, DPR 1 y zoom 100 %, seleccionar oscuro en el catálogo, esperar las fuentes y capturar cada viewport. Comparar las imágenes en paralelo; registrar el error automático y la evidencia manual, sin declarar éxito de la automatización. En ambos casos revisar interactivamente los estados que una captura estática no acredita.

#### Revisión interactiva y diferencias aceptadas

- Recorrer los **30 acentos de equipo**, incluidos estados activos, selección, foco y contraste; verificar portales de Dialog, Sheet, Select y menús, sus colores y anchos.
- Navegar con teclado, abrir/cerrar overlays con Escape y comprobar retorno de foco. Probar `prefers-reduced-motion`.
- Probar claro y sistema mediante `ThemeToggle`, sin sustituir su comportamiento real. El modo claro es una adaptación: no existe referencia clara del export.
- Revisar alturas cortas y zoom aumentado, sin desbordamiento horizontal del documento ni acciones inaccesibles; permitir scroll contenido en tablas y overlays.
- Salir de `/ui-preview` y comprobar restauración del marcador y clases de fuentes; los tokens deben corresponder al tema vigente sin los overrides del catálogo. `ThemeToggle` sigue conservando la preferencia explícita del usuario.

No se promete equivalencia píxel a píxel: el texto tendrá un mínimo deliberado de **12 px**, frente a los 6–11 px presentes en partes del prototipo. Las siluetas/placeholders sustituyen imágenes NBA por derechos de uso y el modo claro requiere revisión propia. Estas diferencias no justifican omitir la comparación de estructura y densidad.

### Criterios de aceptación

- [ ] La identidad se reconoce como Courtside, no como el tema Maia recoloreado.
- [ ] El catálogo refleja el shell enmarcado, iconos e identidad de franquicia acordados, sin wordmark Courtside en la sidebar de muestra.
- [ ] Se pueden revisar el resumen salarial y los estados del Dashboard acordados sin datos conectados ni controladores reales.
- [x] El preview no consulta ni modifica partidas.
- [ ] Las pantallas reales siguen visualmente intactas en esta fase.
- [x] Los overlays reciben el tema correcto.
- [x] Los 30 temas, claro/oscuro y sistema funcionan sin forzar una preferencia.
- [x] Solo `UiPreview` aplica/restaura el marcador y las clases de fuentes en `<html>`; los portales heredan el estilo y salir de la ruta retira esos overrides.
- [x] Las fuentes son locales a la ruta, los binarios usan `.ttf`, se conserva SIL OFL y el layout raíz no cambia.
- [x] No se distribuyen escudos ni retratos NBA del export.
- [ ] No hay texto crítico diminuto ni controles inaccesibles al colapsar.
- [x] El foco y la selección se distinguen en las comprobaciones de navegador.
- [x] No hay desbordamiento horizontal de la página en los cinco viewports comprobados.
- [x] No hay cambios en hooks, mutaciones, dominio, repositorios o esquema.
- [x] No se agregan dependencias.
- [x] No hay consultas nuevas, controladores de simulación ni cambios de APIs de componentes; los fixtures se identifican como ilustrativos.
- [x] Se documentó la comparación en los cinco viewports con DPR 1 y fuentes cargadas, junto con la alternativa manual.
- [ ] La iteración híbrida tiene aprobación visual registrada antes de iniciar la fase 2; el feedback favorable de la primera muestra no sustituye este cierre.

**Riesgo principal:** que un cambio en componentes compartidos se filtre fuera del preview. Por eso el opt-in y las comprobaciones de aislamiento forman parte del entregable, no son un detalle posterior.

### Evidencia de implementación y revisión

Resultados observados el 2026-10-28 para la **primera implementación**, antes de la dirección híbrida posterior. Las capturas y el script CDP son artefactos temporales de sesión, no una nueva suite ni dependencia del proyecto. Los casilleros visuales pendientes incluyen la alineación aún no implementada y su aprobación humana. Esta actualización documental no reejecuta ni extiende estas verificaciones a una futura iteración.

| Evidencia | Resultado |
|---|---|
| Comprobación de Chrome y disponibilidad headless | Chrome 156 mediante CDP y WebSocket nativo de Bun; sin errores JavaScript observados. |
| Puertos y URLs realmente utilizados | Next en `http://127.0.0.1:3001/ui-preview`; export en `http://127.0.0.1:4173/`. |
| Capturas por viewport, modo, equipo, DPR y fuentes | `/tmp/opencode/courtside-visual/`: catálogo y referencias `roster.html`/`index.html` en las cinco resoluciones de la matriz, DPR 1 y `document.fonts.ready`; capturas adicionales de roster, claro y overlays. Se esperan las animaciones finitas antes de capturar. |
| Evidencia reproducible de sesión | `/tmp/opencode/courtside-browser-check.mjs` y `/tmp/opencode/courtside-visual/browser-evidence.json`; los archivos temporales deben archivarse si se necesita conservarlos entre entornos. Las instrucciones manuales no dependen de ellos. |
| 30 temas | 60 combinaciones claro/oscuro; comprobación de contraste de primario, hover, texto de acento y borde de input. No equivale a una auditoría WCAG integral. |
| Portales y navegación | Dialog, Sheet, Select, menú y tooltip fuera del árbol del catálogo, con fuentes/tokens correctos. Tab conserva el foco en los overlays y Escape lo devuelve al abridor. Sidebar colapsada de 76 px y navegación móvil con nombres accesibles. |
| Dimensiones | Sidebar de escritorio 216 px, header 88 px, paneles de radio 6 px, botones 4 px; diálogo estable de 660 px/radio 8 px y drawer de 480 px. Sin overflow del documento en la matriz; tabla con scroll propio. |
| Temas, movimiento y salida | Claro/oscuro y sistema responden a `ThemeToggle`, incluida preferencia de sistema clara y oscura emulada. Reduced motion: duración de transición `0s`. Salida SPA hacia `/login` retira marcador, equipo y clases locales sin recargar el documento. |
| Datos | Cero solicitudes a Supabase observadas durante el recorrido del catálogo. Fixtures solo dentro del preview. |
| Biome, typecheck y pruebas | `bun biome check`: 421 archivos, sin errores. `bun run typecheck`: correcto. `bun run test`: 917 pruebas en 126 archivos, todas correctas; 19 pruebas enfocadas en preview/temas/tabla. CSS global continúa excluido de Biome por configuración previa y se verificó mediante transformador CSS, compilación de desarrollo y navegador. |
| Diferencias y aprobación | Se revisaron capturas de escritorio y móvil frente al export. Siluetas en lugar de assets NBA, tipografía mínima legible, subconjunto de pesos 400/600 y modo claro adaptado son diferencias deliberadas. La densidad del catálogo no equivale a la migración de una pantalla completa. Después, el usuario dio feedback favorable y acordó la dirección híbrida de la sección 0; la revisión final de esa iteración sigue pendiente antes de iniciar la fase 2. |

La comprobación de navegador y la revisión adicional detectaron y permitieron corregir tres detalles: los estilos de reducción de movimiento necesitaban prevalecer sobre reglas más específicas; las etiquetas ocultas de ratings requerían un ancestro posicionado para no escapar del scroll de tabla; y los enlaces móviles debían cerrar el drawer al elegir un destino. Se añadieron comprobaciones de regresión al catálogo, incluida activación real de un destino móvil en Chrome.

Durante la sesión, Turbopack sirvió CSS anterior pese a cambios en disco. Se reinició únicamente el servidor de este proyecto y se apartó su caché de desarrollo generada antes de repetir las comprobaciones. No se modificó la configuración de Next ni procesos de otros proyectos.

**Pendiente o fuera de alcance:** revisión humana final, zoom de escritorio al 200 %, lector de pantalla, otros navegadores, validación visual de todas las pantallas reales, build productivo y pruebas contra Supabase desplegado. El acceso fuera de desarrollo se cubre con la prueba de la ruta, no con un servidor de producción en esta sesión.

## 10. Verificación y siguiente paso

### Cierre aprobado y commits — 2026-10-28

**Resultado vigente:** el usuario aprobó el Dashboard actual y solicitó registrar los cambios. Catálogo, shell y Dashboard quedan entregados; no se implementa ninguna pantalla adicional ni se realiza push. Los registros posteriores de esta sección son históricos cuando mencionan aprobación pendiente o cambios sin commit.

| Unidad y dependencia | Commit | Verificación de su snapshot staged |
|---|---|---|
| Catálogo aislado, fuentes OFL, CSS opt-in, metadatos AppTable, configuración y pruebas | `7d54003` | Biome sin errores; typecheck correcto; Vitest completo: 920 pruebas, 126 archivos. |
| Shell productivo; depende de las fuentes del catálogo | `64de4c9` | Biome sin errores; typecheck correcto; Vitest completo: 923 pruebas, 126 archivos. |
| Dashboard aprobado; reutiliza fuentes compartidas, sin activar tokens del catálogo | `423e968` | Biome sin errores; typecheck correcto; Vitest completo: 932 pruebas, 126 archivos. |
| Este plan y aprobación vigente | Commit documental posterior | Sin cambios de runtime; conserva evidencia histórica y verificaciones pendientes. |

Se verificaron snapshots exportados del índice sin alterar el working tree: `bun biome check`, `bun run typecheck` y `bun run test` en cada frontera. Biome informó 422 archivos en cada snapshot. El recorrido completo detectó dos mocks ausentes en la prueba de localización de Dashboard: `next/font/local` y `usePostseason`; se corrigieron con el patrón de los tests existentes, sin cambiar lógica productiva.

**Revisión por unidades, sin crear PRs:** catálogo → shell → Dashboard → plan. El catálogo suma 1.960 líneas añadidas/eliminadas y tres binarios TrueType (255.136 bytes); shell, 123 líneas; Dashboard, 177 líneas; este plan histórico, 818 líneas nuevas. El catálogo preexistente no se divide arbitrariamente por tipos de archivo: sus fuentes, CSS y pruebas forman una unidad funcional. Se recomienda `size:exception` para ese catálogo y para este plan histórico extenso, no una falsa promesa de slices inferiores a 400 líneas. No se elige estrategia de publicación ni se crean ramas/PRs adicionales.

**Auditoría de staging:** `git diff --cached --check` correcto en las unidades de código; revisión de rutas excluidas, patrones de secretos, únicos binarios permitidos (`.ttf`), cabeceras TrueType y resolución de cada ruta relativa de `fonts.ts`. Licencia SIL OFL completa conservada; únicamente se eliminó un espacio final. El export de referencia y sus imágenes NBA no se versionan. La exclusión preexistente en `.gitignore` solo corresponde al export y se incluye con el catálogo.

**Límites de rollback:** catálogo/CSS opt-in/tabla y fuentes pueden retirarse sin tocar reglas de negocio, pero las fuentes deben conservarse mientras shell o Dashboard las importen; revertir primero esos consumidores si se revierte toda la cadena. El shell se limita a sus clases/superficies y pruebas. Dashboard se limita a su página, cuatro widgets y pruebas. Este documento no añade comportamiento.

**Pendiente, sin atribuirlo a esta verificación:** no se reejecutaron navegador autenticado, matriz responsive completa, teclado/zoom, lector de pantalla, persistencia contra Supabase ni build productivo. Las capturas históricas y la aprobación humana no sustituyen esas pruebas. El siguiente trabajo será acordar Roster; no comenzarlo automáticamente.

### Dashboard real autorizado — 2026-10-28

**Implementado y aprobado por el usuario.** Estado vigente que prevalece sobre los límites históricos siguientes. Rama `feat/courtside-hybrid-preview`; commits autorizados por unidades coherentes, sin push. La aprobación visual no cierra las verificaciones pendientes indicadas abajo.

- La página reutiliza Barlow y Barlow Condensed locales existentes. Dos columnas independientes en escritorio ancho: próximo partido y finanzas; posiciones y alertas. Al reducir ancho se apilan; las alturas ya no se igualan a las posiciones y el vacío de próximo partido no estira un panel gigante.
- Los cuatro widgets conservan sus fuentes, estados y enlaces. Paneles locales con radio discreto, bordes semánticos y sin sombra; títulos condensados y nómina destacada. No se activan tokens globales del catálogo ni se modifica el shell inset.
- «No next game» ocupa un bloque compacto. El enlace real `/postseason` se destaca solo con consulta resuelta sin error y fase distinta de regular season. La etiqueta de offseason aparece únicamente con campeón confirmado por `hasPostseasonChampion`; lleva a la página existente, donde la planificación se selecciona con su control actual. No crea temporada, acciones ni afirmaciones de clasificación.
- Se conserva el ordenamiento de posiciones, contexto de conferencia, cinco equipos cercanos y resaltado de franquicia; barra financiera con cargos por cortes y los cuatro umbrales de la temporada sin modificar cálculos; simulación del siguiente partido, lock, errores y reintento existentes.

| Verificación nueva | Evidencia |
|---|---|
| `bun biome check` | Correcto: 422 archivos. |
| `bun run typecheck` | Correcto: generación de rutas y TypeScript. |
| Vitest relevante | 68 pruebas correctas en cinco archivos: `dashboardWidgets` (27), `dashboard` (12), `dashboardSidebar` (9), `gameTheme` (9), `uiPreview` (11). |
| Componentes reales en Testing Library | Nuevas pruebas de enlaces por fase/campeón, supresión de datos obsoletos durante carga/error, lock pendiente y reintento, cuatro umbrales y ancho calculado con cargos por cortes. Hooks simulados solo en pruebas, sin fixtures nuevos en producción. |
| Navegador autenticado | No reejecutado en esta unidad; el intento previo quedó en Sign in (evidencia histórica abajo). Las pruebas de componentes no acreditan revisión visual ni persistencia real. |

**Revisión:** `http://127.0.0.1:3000/games/<gameId>/dashboard`, entrando desde `http://127.0.0.1:3000/` con la sesión habitual. Revisar temporada activa y sin próximo partido, modo claro/oscuro y matriz responsive antes de aprobar. No se iniciaron ni alteraron procesos existentes.

**Límite:** detenerse en Dashboard. Aprobación humana recibida; siguen pendientes capturas autenticadas reproducibles, teclado/zoom y matriz responsive visual completa, simulación persistida contra Supabase y build productivo. Sin cambios en dominio, repositorios, reglas financieras, dependencias u otras pantallas.

### Shell productivo autorizado — 2026-10-28

**Implementado; pendiente de revisión humana.** Prevalece sobre los puntos de entrada y estados históricos siguientes. Se conserva la rama `feat/courtside-hybrid-preview` y todo el trabajo previo sin commit.

- `dashboard/layout.tsx`: clases exclusivas para el fondo exterior y borde del main inset; mismo árbol, providers, espaciado y contenido de pantalla.
- `layout-components.tsx`: Barlow en header y tres superficies de sidebar (también dentro del Sheet móvil); Barlow Condensed para la fecha, etiqueta de 12 px y jerarquía conservando posiciones. Se mantienen escudo, ocho enlaces, Lucide, controles, handlers, condiciones y estados existentes.
- `globals.css`: fondos claros/oscuros, borde del marco y radios de botones limitados a clases `game-shell-*`; conserva el indicador activo existente. No redefine tokens semánticos, fuentes heredadas del main ni primitivas de las pantallas. Franquicias y modos claro/oscuro/sistema conservan sus mecanismos reales.
- `src/app/ui-preview/fonts.ts`: definición compartida de las fuentes locales existentes; `page.tsx` y shell la reutilizan sin duplicar binarios. Se conserva OFL. No cambia el layout raíz ni el ciclo de marcador, limpieza o portales de `UiPreview`; los overlays productivos conservan el tema existente.
- Pruebas: se añade cobertura de aislamiento del marcador, superficies tipográficas, progreso, exclusión durante batch, pausa y error; siguen pasando navegación expandida/colapsada, campeón/offseason y avances existentes. Ambos archivos de pruebas del shell simulan `next/font/local`, que Vitest no transforma como Next.

| Verificación ejecutada | Evidencia |
|---|---|
| `bun biome check` | Correcto: 422 archivos. |
| `bun run typecheck` | Correcto: generación de rutas y TypeScript. |
| Vitest relevante | 41 pruebas correctas: `dashboardSidebar`, `dashboard`, `uiPreview`, `gameTheme`. |
| Navegador en servidor existente 3000 | Chrome headless con presupuesto de 8 s llegó a «Sign in» desde `/`; no hay sesión autenticada disponible. Evidencia: `/tmp/opencode/courtside-shell-access.html`. No se solicitaron credenciales ni se modificaron procesos. |

**Revisión:** abrir `http://127.0.0.1:3000/` con la sesión habitual y entrar en una partida; URL del shell: `http://127.0.0.1:3000/games/<gameId>/dashboard`. El catálogo aprobado sigue en `http://127.0.0.1:3000/ui-preview`.

**Bloqueo y límites:** no se acredita validación visual autenticada, responsive, teclado, los 30 equipos ni simulación persistida en navegador para este shell. No se ejecutó build productivo. La revisión humana del shell sigue pendiente; detenerse aquí antes del Dashboard. No hay cambios en datos, hooks, dominio, repositorios ni dependencias.

### Iteración híbrida del catálogo — 2026-10-28

- Rama de revisión: `feat/courtside-hybrid-preview`. Se conservan los cambios anteriores sin commit; esta iteración modifica únicamente el catálogo y sus pruebas.
- La muestra utiliza el shell inset enmarcado, iconos Lucide e identidad de franquicia con escudo placeholder identificado, sin wordmark Courtside en la sidebar. No se redistribuyen imágenes NBA.
- Se incorporan muestras explícitamente ficticias de próximo partido, posiciones cercanas, alertas y barra salarial con cargos por cortes y umbrales cap/tax/aprons. Los enlaces permanecen dentro del catálogo, sin rutas de partidas inventadas.
- Se pueden revisar temporada activa, fin de temporada, carga y error. El pie distingue fecha, estado y simulación no disponible; no monta controladores ni habilita una temporada nueva.
- Verificación nueva: `bun biome check` correcto (421 archivos), typecheck correcto y 22 pruebas relevantes correctas en tres archivos. Comprobación Chrome en cinco anchos (360–1920 px), fuentes cargadas, sin overflow del documento ni excepciones de ejecución; estados y capturas claro/oscuro comprobados.
- Evidencia temporal: `/tmp/opencode/courtside-hybrid-dashboard.png`, `/tmp/opencode/courtside-hybrid-dashboard-dark.png` y `/tmp/opencode/courtside-hybrid-evidence.json`.
- Revisión disponible en `http://127.0.0.1:3000/ui-preview`, utilizando el servidor existente del proyecto; no se modificaron procesos existentes. El intento de iniciar otro servidor en 3001 encontró el lock del checkout.
- Pendiente: aprobación visual humana y repetición exhaustiva de los 30 temas, teclado y portales para esta iteración. No se migran el shell productivo ni el Dashboard antes de esa aprobación. La evidencia de fase 1 no sustituye estas comprobaciones pendientes.

Durante la implementación, cada fase debe pasar:

1. Biome, typecheck y pruebas relevantes.
2. Revisión visual con los mismos datos antes/después.
3. Estados de carga, error, vacío y permisos.
4. Navegación, teclado y mobile.
5. Pruebas de mutación en partidas descartables cuando corresponda.
6. Recarga para confirmar persistencia.
7. Aprobación visual antes de avanzar.

### Resultado del análisis original

Resultados registrados el 2026-10-28, antes de guardar este documento:

- `bun biome check src tests`: **correcto**, 398 archivos.
- `bun biome check`: **falla**, con 97 errores; incluye diagnósticos del material exportado.
- No se aplicaron correcciones.
- `git diff --stat` estaba vacío; el directorio de diseños continuaba como material no versionado preexistente.

### Punto de entrada para la próxima sesión

**Actualización posterior:** el catálogo, shell y Dashboard ya están implementados y aprobados. Los pasos 1–4 siguientes describen el traspaso histórico, no trabajo pendiente. Retomar desde el paso 5, acordando primero el alcance de Roster; no repetir ni ampliar automáticamente las unidades aprobadas.

1. Leer los acuerdos vigentes de la sección 0 y comprobar el estado del working tree. La fase 1, fuentes y documentación permanecen sin commit; no descartar esos cambios ni modificar el export original.
2. Retomar con una unidad limitada al catálogo: alinear la muestra con el marco actual, iconos y escudo/identidad de franquicia sin Courtside en la sidebar; permitir revisar barra salarial y estados del Dashboard sin datos conectados.
3. Verificar y revisar visualmente esa iteración con el usuario antes de activar estilos en la partida. No presentar las pruebas de la primera muestra como evidencia de cambios nuevos.
4. Acordar e implementar el shell preservado y luego el Dashboard, como unidades separadas. Aprobar cada resultado antes de continuar.
5. Continuar **Roster → Player Profile → Teams → Standings → Players**, decidiendo en cada pantalla cuánto conservar y cuánto reproducir del prototipo; después seguir el roadmap restante.

**Límite del acuerdo:** está aprobada la dirección híbrida y el proceso de trabajo, no una copia general del prototipo ni todas las funcionalidades propuestas. No avanzar automáticamente entre pantallas ni implementar mecánicas nuevas como parte de una decisión estética.

### Traspaso de esta actualización

- Único archivo a modificar en esta unidad: `docs/courtside-ui-migration-plan.md`.
- No se cambia código, no se inicia la alineación del catálogo y no se levantan servidores.
- Los resultados técnicos anteriores se conservan como evidencia histórica; la siguiente implementación deberá repetir los controles pertinentes.
- No se realizaron commits ni pushes.
- Durante la verificación se detectó un cambio paralelo en `.gitignore` que excluye `docs/NBA-Franchise-Management-Redesign`; no se modificó ni revirtió. El export sigue presente e intacto localmente, pero no debe suponerse disponible en otro checkout.

Durante el análisis original no se ejecutaron navegador, Vitest, typecheck, build ni consultas a Supabase; la funcionalidad se verificó en código. La implementación de fase 1 sí ejecutó los controles y capturas descritos en su registro de evidencia; no se realizaron consultas a Supabase ni build productivo.

Quedan pendientes la validación visual real, el estado del backend desplegado y los permisos de publicación de assets NBA.
