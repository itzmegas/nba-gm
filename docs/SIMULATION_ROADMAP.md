# Simulación: de gestionar una plantilla a construir una franquicia

**Estado:** atributos, posesiones/box score, estadísticas individuales y postemporada implementados. El usuario confirmó el recorrido hasta el cierre de playoffs el 10 de junio de 2027 en la partida existente. Pendiente comprobar visualmente el cuadro y los filtros de estadísticas por fase; la continuidad entre temporadas queda fuera de esta entrega.
**Fecha:** 2026-10-24.

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

## Punto de partida histórico, antes de estos bloques

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

- [x] Los atributos individuales influyen en la simulación.
- [x] Cada partido nuevo permite consultar minutos, tiros, puntos, rebotes, asistencias, robos, tapones y pérdidas.
- [x] Los puntos individuales coinciden con el marcador de cada equipo y los minutos son coherentes con la duración del partido.
- [x] El resultado queda guardado y consultable sin volver a simularlo.

Arquitectura y verificación local: [Motor por posesiones y box score](POSSESSION_ENGINE.md). La instalación de 044–047 fue confirmada posteriormente por el usuario.

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

**Siguiente paso recomendado:** comprobar el selector de estadísticas en Plantilla y Liga, preservando la partida existente y sus resultados históricos.

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

## Avance del bloque 2

- [x] Motor determinista por posesiones con participación individual, rotación automática y prórrogas.
- [x] Un único resultado produce puntos individuales, marcador y clasificación en la transacción diaria existente.
- [x] Box score persistente por encuentro, aislado por partida, con lectura del propietario y sin escritura desde el cliente.
- [x] Consulta bajo demanda desde los partidos completados del calendario, en español e inglés.
- [x] Compatibilidad hacia adelante: sin recalcular partidos anteriores ni inventar sus estadísticas; las partidas sin atributos conservan el motor anterior.
- [x] El usuario confirmó 044–046, consulta de ambos equipos y persistencia tras reiniciar en la partida de referencia. El agente no modificó datos remotos.
- [x] Calibración v2 local: primera unidad con más minutos, tiros exteriores por perfil y comparación reproducible de 300 partidos por versión; historial v1 conservado.
- [x] El usuario confirmó la instalación de 047 y comprobó las nuevas rotaciones en un partido futuro; no se consultó ni modificó Supabase desde el agente.

## Avance del bloque 3

- [x] Consulta de totales y promedios individuales desde box scores v1/v2, sin acumuladores ni cambios al motor.
- [x] Temporada y fase explícitas en el calendario; consulta aislada por partida y propietario.
- [x] Selector de plantilla/atributos y estadísticas en Plantilla y Liga, respetando los jugadores y filtros existentes, con totales/por partido y porcentajes ponderados por intentos, en español e inglés.
- [x] DNP excluidos de partidos jugados; aviso de cobertura incompleta para encuentros sin box score.
- [x] El usuario confirmó la instalación de 048; no se consultó ni modificó Supabase desde el agente.
- [ ] Comprobar el selector de vistas en la partida existente.

Detalle: [Estadísticas de temporada](SEASON_STATISTICS.md).

## Avance del bloque 4: postemporada

**Alcance aprobado:** clasificación y desempates simplificados → play-in → cuadro fijo al mejor de siete → campeón. Sin cambio de temporada, draft, agencia libre ni regeneración de calendarios existentes.

- [x] Reglas puras de clasificación por conferencia: seis plazas directas, cuatro de play-in y desempates verificables. Detalle: [reglas de desempate](NBA_BUSINESS_RULES.md#86-simulator-qualification-tiebreakers-simplified).
- [x] Integrar cierre de fase regular y guardar clasificación definitiva y sorteo por partida/temporada, sin modificar resultados anteriores. El usuario confirmó la instalación de `049`; el agente no accedió al remoto.
- [x] Play-in persistente con localía del mejor clasificado. El usuario confirmó la instalación de `050` y `051`, y comprobó resultados y box scores de los dos partidos del 19 de abril en la partida de referencia, después de los cuatro del 17. Recorrido completo probado en PostgreSQL aislado, con motor v2, box scores, fallback antiguo, descanso, concurrencia y rollback.
- [x] Series, avance de rondas, Finales y campeón con reintentos transaccionales sin duplicados, en la migración local `052`.
- [x] Adaptar avance diario/por lotes, vista de postemporada y estadísticas separadas por fase, implementados localmente.
- [x] Verificar el recorrido completo hasta campeón en PostgreSQL aislado, con motor v2 y fallback antiguo, concurrencia, rollback y conservación de la clasificación e historial regular y del play-in.
- [x] El usuario confirmó el recorrido con `052` hasta el cierre de playoffs en la partida existente, con avance bloqueado y sin cambio de temporada.
- [ ] Comprobar visualmente el cuadro, el campeón mostrado y los filtros de estadísticas por fase; la captura del cierre no permite verificar esas vistas.

El cierre SQL guarda los 30 seeds y un sorteo determinista una sola vez cuando el calendario regular realmente termina. Las inconsistencias entre resultados y clasificación bloquean el cierre sin corregir datos silenciosamente. `050` continúa automáticamente hacia el play-in, separado de la clasificación regular, y guarda las 16 plazas de playoffs en otra tabla. `052` reemplaza la parada intermedia por cuatro rondas al mejor de siete y guarda campeón/subcampeón. La interfaz delega el punto de parada al backend: solo el campeón confirmado cierra el avance, sin cambio de temporada.

Las migraciones no avanzan partidas al instalarse. La partida de referencia se conserva sin cambios remotos del agente. La vista **Postemporada** muestra cuadro, series y resultados del play-in, explica la eliminación del equipo sin detener la liga y permite consultar box scores guardados. Plantilla y Liga incorporan selector de temporada regular, play-in y playoffs. Detalle de instalación y reglas: [Postemporada hasta el campeón](POSTSEASON.md).

**Corrección de compatibilidad `051`:** completa únicamente conferencias ausentes de equipos NBA reconocidos. La interfaz ya mostraba esas conferencias mediante un fallback local que no se persistía. El runner reproduce el bloqueo al cerrar el 15 de abril con 30 conferencias NULL y comprueba que la reparación permite continuar, sin recalcular encuentros completados ni modificar el historial. No reiniciar la partida: aplicar la migración y reintentar el avance pendiente.

**Entrega confirmada por el usuario (2026-10-25):** la partida `8d2d44b9-9634-4a74-94fc-0732825122e8` continuó desde el play-in del 19 de abril hasta el cierre del 10 de junio de 2027, aunque su equipo quedó 13.º. La captura muestra temporada finalizada, equipo eliminado, avance bloqueado y ausencia de cambio de temporada. Este mensaje requiere fase completada y campeón registrado. No se identificó al campeón ni se comprobaron el cuadro o los filtros de estadísticas mediante esa captura. El agente no accedió ni modificó datos remotos.

Verificación reproducible: `bun scripts/test-postseason-qualification-postgres.ts`. El runner crea y elimina únicamente su contenedor PostgreSQL aislado, sin credenciales ni red externa; incluye 50 escenarios de paridad entre dominio y SQL.

**Verificación local de `052`:** 762 tests en 112 archivos, TypeScript, Biome (382 archivos), build de producción y arranque del esquema canónico en PostgreSQL aislado correctos. El runner completa ambas temporadas de prueba hasta campeón, hace competir dos conexiones en cada día —incluidos los seis cambios de ronda— y prueba tres fallos con rollback de resultados, box scores, series, vínculos, campeón y reloj. Comprueba localía, barridos, séptimo partido, cuadro fijo, desempates de Finales, permisos y estadísticas separadas por fase. El usuario confirmó el cierre; solo quedan pendientes las comprobaciones visuales indicadas arriba. El agente no aplicó migraciones remotas.
