# Motor por posesiones y box score individual

**Primera versión y rotaciones v2 probadas por el usuario, con 044–047 instaladas según su confirmación.** Los próximos encuentros de una partida moderna con atributos producen actuaciones individuales; el marcador es la suma de sus puntos. Los resultados anteriores permanecen intactos y no reciben estadísticas inventadas.

## Activación para instalaciones pendientes

1. Tener instaladas las migraciones hasta `046_daily_possession_simulation.sql`. El usuario confirmó 044–046 y la persistencia de ambos box scores tras reiniciar.
2. Actualizar primero la aplicación para aceptar resultados `possessions-v1` y `possessions-v2`.
3. Aplicar **solo** `047_possession_rotation_calibration.sql` con el procedimiento autorizado para el entorno. No volver a ejecutar las migraciones instaladas ni todo `schema.sql` sobre una base existente.
4. Conservar los encuentros ya jugados. En un partido nuevo, abrir **Calendario → nuestro partido**: la primera unidad debe recibir más tiempo que la banca, manteniendo 240 minutos por equipo y puntos individuales iguales al marcador.

El agente no aplicó migraciones ni simuló la partida remota. No volver a aplicar 047 en la partida de referencia: el usuario confirmó su instalación y las nuevas rotaciones. La migración no cambia los payloads v1 existentes.

## Consulta desde el calendario

- **Clic en nuestro partido:** abre solo ese encuentro en un diálogo, con marcador y box score de ambos equipos directamente, sin desplegar otro control. Si todavía no se jugó, muestra sus datos programados sin solicitar estadísticas.
- **«+ juegos» / «Ver partidos»:** navega a `/games/[gameId]/dashboard/schedule/day/[date]`, con fecha ISO en la URL. Incluye todos los encuentros de esa jornada y destaca el nuestro primero.
- La página de jornada ofrece selector de fecha y flechas a la jornada anterior/siguiente con partidos, omitiendo días sin encuentros. Se desactivan en los extremos del calendario. Una fecha válida sin encuentros muestra un estado vacío; una fecha inválida devuelve 404.
- Cada partido completado permite abrir su box score bajo demanda. Los próximos encuentros no tienen estadísticas; los históricos sin box score conservan el marcador y explican que no hay actuaciones registradas.
- Las tablas usan el estilo compartido `AppTable`. Se reutilizan las consultas autenticadas existentes, sin nuevas escrituras ni migraciones. No se implementan comparativas entre distintos partidos en esta entrega.

## Qué hace esta versión

| Área | Comportamiento |
| --- | --- |
| Participantes | Solo jugadores activos y no lesionados de la plantilla de la partida; atributos de su temporada. |
| Convocatoria | Hasta 15 disponibles por equipo, ordenados por tiro cercano, triple y defensa interior; desempate por ID. Admite plantillas de carrera más grandes con jugadores two-way. |
| Rotación | Diez jugadores prioritarios, cinco en cancha; orden por media de los 14 atributos. La primera unidad tiene doble peso de minutos que la banca, ajustado por calidad y resistencia. Los demás aportan profundidad ante faltas. |
| Posesiones | 100 por equipo en tiempo reglamentario; pérdidas, robos, tiros de dos/tres, tapones, faltas de tiro, tiros libres, asistencias y rebotes. El rebote ofensivo continúa la posesión. |
| Duración | Cuatro cuartos de 12 minutos; prórrogas de 5 minutos y 11 posesiones por equipo hasta desempatar. |
| Consistencia | Cada equipo suma exactamente 240 minutos, más 25 por prórroga. Los puntos se calculan con los tiros convertidos, no con un marcador previo. |
| Determinismo | Semilla por partida, fecha y equipos; no modifica el generador aleatorio global de PostgreSQL. Los encuentros nuevos tras 047 guardan `possessions-v2`; los anteriores conservan `possessions-v1`. |

La calibración es aproximada, no una reproducción estadística certificada de la NBA. La comparación usa las mismas **300 semillas**, plantillas de 12 jugadores y atributos uniformes de 70:

| Medida | v1 | v2 |
| --- | --- | --- |
| Puntos por equipo | 116,75 | 109,88 |
| Acierto de triples | 38,96 % | 36,90 % |
| Intentos de triple / tiros de campo | 42,52 % | 34,69 % |
| Minutos por jugador de primera unidad, normalizados a 48 minutos | 24,01 | 31,70 |
| Minutos por jugador de banca, normalizados a 48 minutos | 23,99 | 16,30 |

V2 elimina la cuota mínima de triples para atributos de tiro exterior de 35 o menos, ajusta el acierto exterior y reduce segundas oportunidades mediante el rebote defensivo. No limita artificialmente el marcador: un partido de muchos puntos sigue siendo posible. Las pruebas verifican intervalos amplios, no estos valores exactos ni una única captura.

## Guardado y seguridad

El flujo existente permanece: `useAdvanceDay` / `useAdvanceRange` → `advance_simulation_day` → `advance_simulation_day_core`. El núcleo llama al motor y guarda un único `game_box_scores.payload` por encuentro, con nombres y actuaciones de ese momento.

Marcador, box score, clasificación, fecha y resolución del mercado conservan la misma transacción. Un error revierte el día completo. El bloqueo de la partida y la fecha esperada evitan duplicados por solicitudes simultáneas o reintentos.

- RLS permite al propietario leer sus estadísticas; el cliente no puede crearlas, cambiarlas ni eliminarlas.
- Las funciones del motor son internas, sin permisos de ejecución para usuarios ni claves de servicio.
- Un `CHECK` valida identidades, tiros, puntos y segundos. El repositorio vuelve a validar el JSON con Zod al leerlo.
- Los nombres quedan copiados en el resultado: consultar la historia no recalcula estadísticas ni depende de la plantilla actual.
- Las partidas sin snapshot de atributos y las eras anteriores conservan el resultado de equipo del motor previo, sin box score ficticio.
- Si una partida con atributos pierde cobertura o un equipo tiene menos de cinco disponibles, el avance falla sin guardar resultados parciales.

## Límites deliberados

No hay reloj por evento, ritmo variable, táctica ni configuración manual de rotaciones. Las alineaciones se revisan por turnos de tres pares de posesiones: las exclusiones por faltas se aplican en el siguiente turno, no inmediatamente. Si quedan menos de cinco jugadores sin seis faltas, se mantienen cinco participantes para poder completar el encuentro. Los puestos de cancha y las tendencias reales de tiro no se importan: el perfil se aproxima con atributos.

Solo se modelan faltas de tiro; no hay bonus colectivo, faltas técnicas, lesiones durante el encuentro, fatiga persistente, tiempos muertos ni jugada a jugada guardada. No se añaden estadísticas de temporada, playoffs ni progresión de atributos.

El payload versionado permite la consulta por partido y alimenta la [proyección de estadísticas de temporada](SEASON_STATISTICS.md), implementada como un módulo separado sin volver a simular encuentros.

## Verificación local

```sh
bun run test
bun run typecheck
bun biome check
bun run build
bun scripts/test-possession-engine-postgres.ts
```

El runner necesita Docker y la imagen local `postgres:17-alpine`: no la descarga. Crea y elimina su propio contenedor, sin red, puertos ni montajes del host. No lee credenciales ni conecta a Supabase.

Cobertura: muestra inicial de 100 partidos, comparación v1/v2 de 300 semillas por versión, prórrogas, determinismo, efecto de atributos, identidades duplicadas, minutos/puntos/tiros inválidos, persistencia, cobertura incompleta, plantillas grandes, lesionados/inactivos, rollback, permisos/RLS y avances concurrentes. La actualización se aplica sobre resultados v1 guardados: se comparan sus payloads sin cambios y se verifica que el encuentro siguiente use v2. También se comprueban minutos de primera unidad/banca, una figura al final del orden de entrada y perfiles de no tirador/especialista. Las pruebas de interfaz cubren carga diferida, tablas, resultados históricos sin estadísticas, errores y reintento.

Pendiente: comprobar visualmente la navegación de calendario/jornadas y el detalle directo en la misma partida, sin recalcular encuentros anteriores.
