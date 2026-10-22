# Simulación: de gestionar una plantilla a construir una franquicia

**Estado:** bloque 1 con fuente validada y primer cruce contra una partida real; identidades, política de datos ausentes y permisos pendientes, sin integración al juego todavía.
**Fecha:** 2026-10-22.

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

- [ ] Confirmar el primer hito y los atributos mínimos necesarios.
- [ ] Validar la fuente de atributos y qué hacer con jugadores sin datos.
- [ ] Definir compatibilidad con partidas existentes, sin inventar estadísticas para partidos ya completados.
- [ ] Resolver la integración con la simulación diaria transaccional en SQL: modificar únicamente `SeasonSimulator.ts` no cambia el flujo que hoy usa el juego.

**Siguiente paso recomendado:** delimitar el primer partido con atributos y box score, no construir todo el roadmap en una sola entrega.

## Avance del bloque 1

- [x] Modelo inicial de 14 atributos y descarga validada de NBA 2K27, sin importar datos.
- [x] Reporte de calidad y candidatos de identidad con entrada opcional del roster canónico.
- [x] Ejecutar el cruce contra el roster canónico de una partida moderna real: 526 candidatos de 546 jugadores, 19 sin coincidencia de nombre y 1 incompleto.
- [ ] Corroborar identidades, incluidas las 11 posibles variantes de nombre localizadas; no son vínculos aprobados para importar.
- [ ] Confirmar permisos de reutilización y política de jugadores sin datos.
- [ ] Persistir atributos versionados por partida/temporada e integrarlos al motor SQL.

Detalle, evidencia y comandos: [Atributos de jugadores](PLAYER_ATTRIBUTES.md).
