# Simulación: de gestionar una plantilla a construir una franquicia

**Estado:** módulo de atributos implementado y verificado localmente: fuente autenticada, caché compartida, identidades revisadas, estimaciones deterministas, copias por partida y ajuste de calidad en SQL. Queda instalar migraciones y probar una partida nueva en el entorno que se use.
**Fecha:** 2026-10-23.

**Recomendación:** dar consecuencias deportivas a las decisiones del GM antes de ampliar la cantidad de temporadas jugables.

## El recorrido en una mirada

**Atributos → partido con box score → estadísticas de temporada → postemporada → siguiente temporada.**

| Orden | Bloque | Resultado visible |
| --- | --- | --- |
| 1 | Atributos individuales | La calidad y el perfil de los jugadores influyen en el resultado. |
| 2 | Simulación por posesiones y box score | Se puede consultar qué aportó cada jugador en un partido. |
| 3 | Estadísticas de temporada | Se pueden evaluar rendimientos y comparar jugadores a lo largo de la campaña. |
| 4 | Play-in y playoffs | La temporada termina con un campeón, no con un bloqueo del calendario. |
| 5 | Entre temporadas | La franquicia continúa al año siguiente conservando su historia. |

## Punto de partida

En el código revisado al guardar este documento:

- La simulación diaria genera marcadores de equipo, no actuaciones individuales.
- La fuerza depende de una valoración base del equipo y, en partidas modernas con contexto de plantilla, de la cantidad de jugadores disponibles; no distingue su calidad individual.
- El avance se detiene después del 15 de abril, sin transición a la postemporada.

Referencias: [simulación diaria y fuerza de plantilla](../scripts/migrations/032_roster_simulation_strength.sql), [modelo de jugador](../src/domain/entities/Player.ts) y [reglas NBA documentadas](NBA_BUSINESS_RULES.md).

## Primer hito: un partido que se pueda explicar

> Puedo cambiar mi plantilla, simular y entender quién aportó qué y cómo cambió el rendimiento.

### 1. Atributos: las entradas del motor

Representar capacidades como tiro, defensa, pase y rebote con el conjunto mínimo que necesite la primera versión del motor.

**Fuente candidata:** la investigación de febrero de 2026 identificó `nba2kapi.com` para enriquecer jugadores con atributos de NBA 2K. Antes de adoptarla hay que verificar disponibilidad actual, cobertura, coste, condiciones de uso y correspondencia de identidades. No se considera una integración existente ni una fuente confirmada.

Los atributos importados sirven como base inicial. Las estadísticas de la partida deben surgir de su propia simulación, no copiarse de la NBA real.

### 2. Posesiones: lo que ocurre en el partido

Empezar por acciones suficientes para producir un partido coherente: pérdidas, tiros, faltas y rebotes, con participación de los jugadores.

**Una misma simulación debe producir el marcador y las estadísticas.** Evitar generar primero un resultado y repartir después números independientes entre jugadores.

### 3. Box score: el resultado individual

- [ ] Los atributos individuales influyen en la simulación.
- [ ] Cada partido permite consultar minutos, tiros, puntos, rebotes, asistencias, robos, tapones y pérdidas.
- [ ] Los puntos individuales coinciden con el marcador de cada equipo y los minutos son coherentes con la duración del partido.
- [ ] El resultado queda guardado y consultable sin volver a simularlo.

**Fuera de este primer hito:** registrar cada pase, visor en vivo, animaciones, estadísticas avanzadas y progresión de atributos. El detalle jugada a jugada puede ampliarse después; no es un requisito para empezar a generar estadísticas.

## Después del primer hito

### Estadísticas de temporada

Acumular totales y promedios a partir de los partidos guardados. Mantener separados los datos por partida, temporada y fase de competición para no mezclar temporada regular y postemporada.

### Postemporada

**Fin de temporada regular → clasificación y desempates → play-in → playoffs → campeón.**

Tratarlo como un bloque cerrado que pueda aprovechar el motor disponible, sin esperar a una simulación perfecta.

**Alternativa de prioridad:** si lo más importante pasa a ser terminar una campaña, adelantar este bloque. Aporta un cierre visible antes, pero no resuelve por sí solo la falta de profundidad individual.

### Continuidad entre temporadas

Separarla de los playoffs: cambiar el año no alcanza. Hay que definir contratos que vencen, opciones, agencia libre, draft, calendario nuevo y conservación del historial.

El alcance inicial de esta etapa queda por acordar; no implica implementar todas las reglas de la NBA de una vez.

## Antes de implementar

- [x] Definir el alcance del módulo de atributos. Esta entrega no incluye todavía posesiones, box score ni progresión por edad.
- [x] Validar acceso/cobertura y política de datos ausentes: 14 ratings, estimaciones identificadas; los términos conocidos no demuestran licencia de redistribución.
- [x] Definir compatibilidad con partidas existentes: sin backfill y sin inventar resultados de partidos completados.
- [x] Integrar en la función SQL diaria real; cambiar únicamente `SeasonSimulator.ts` no alcanzaba el flujo que usa el juego.

**Siguiente paso recomendado:** delimitar el primer partido con atributos y box score, no construir todo el roadmap en una sola entrega.

## Avance del bloque 1

- [x] Modelo inicial de 14 atributos y descarga validada de NBA 2K27, sin importar datos.
- [x] Reporte de calidad y candidatos de identidad con entrada opcional del roster canónico.
- [x] Ejecutar el cruce contra el roster canónico de una partida moderna real: 526 candidatos de 546 jugadores, 19 sin coincidencia de nombre y 1 incompleto.
- [x] Implementar reconciliación con evidencia y estimación explícita de casos sin corroborar: diez alias revisados por ID ESPN, Xavier sin vínculo aprobado y sin coincidencias ambiguas silenciosas. Verificación de lectura: 530 importables y 16 estimados sobre 546.
- [x] Acordar atributos estimados, identificados y separados de los importados, para jugadores sin datos completos.
- [x] Acordar caché persistente compartida: actualizar la fuente de forma controlada y copiarla al iniciar cada partida, sin consultar al proveedor por usuario.
- [x] Implementar la adquisición compartida con caché persistente, coordinación entre instancias, validación al leer y reutilización de la última versión válida ante errores.
- [x] Implementar estimaciones deterministas versionadas (`replacement-v1`) y materialización transaccional por jugador/partida/temporada.
- [x] Documentar límites conocidos de la fuente y dejar claro que la API key no prueba una licencia de redistribución.
- [x] Integrar la calidad individual en la fuerza SQL diaria, con fallback para juegos antiguos.

  **Implementado localmente:** migraciones `038_game_player_attributes.sql` a `042_player_attribute_simulation_strength.sql`, snapshot transaccional/idempotente antes de activar, agentes libres iniciales incluidos, rollback de fallos y ajuste individual de fuerza. Migraciones aún no aplicadas al Supabase remoto; la autorización de redistribución del proveedor sigue sin acreditarse.

  **Verificación local actual:** `bun run test` 617/617 en 91 archivos; `bun run typecheck`; `bun biome check` (328 archivos); `bun run build`; runner PostgreSQL aislado con migraciones 037–042, RLS, rollback, agentes libres en `initializing`, refresco concurrente y simulación diaria. No se hizo push ni se escribieron datos en Supabase remoto.

### Plan de entrega del módulo de atributos

1. Descarga autenticada `bulk` con `NBA_2K_API_KEY`, validación y errores sin secretos; mantener el reporte de lectura.
2. Caché de fuente compartida en BD, versionada por edición y contenido, con actualización controlada cada 24 horas, un único refresco entre instancias y última versión válida ante fallos.
3. Corroboración de identidades y generación verificable de atributos estimados para datos ausentes o incompletos.
4. Copias por jugador, partida y temporada, con procedencia, aislamiento, RLS e inicialización transaccional e idempotente.
5. Uso de la calidad individual en la simulación diaria SQL, manteniendo partidas antiguas sin atributos y resultados ya jugados.
6. Pruebas, documentación y commits locales revisables, sin push ni modificaciones en la partida remota auditada.

La caché comparte **datos de origen**, no estado mutable entre carreras. Las actualizaciones externas no sobrescriben partidas existentes. La evolución por edad queda para una entrega futura, junto con los bloques posteriores del roadmap.

Detalle, evidencia y comandos: [Atributos de jugadores](PLAYER_ATTRIBUTES.md).
