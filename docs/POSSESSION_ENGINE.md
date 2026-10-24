# Motor por posesiones y box score individual

**Primera versión implementada localmente.** Los próximos encuentros de una partida moderna con atributos producen actuaciones individuales; el marcador es la suma de sus puntos. Los resultados anteriores permanecen intactos y no reciben estadísticas inventadas.

## Activación pendiente

1. Tener instaladas las migraciones previas hasta `043_player_demographics.sql`.
2. Aplicar, en orden, `044_possession_engine.sql`, `045_game_box_scores.sql` y `046_daily_possession_simulation.sql` con el procedimiento autorizado para el entorno. No ejecutar todo `schema.sql` sobre una base existente.
3. Conservar el encuentro ya jugado de la partida de referencia. Tras instalar las migraciones, avanzar hasta el próximo partido y abrir **Calendario → fecha → Estadísticas del partido**.
4. Verificar que el resultado anterior no cambió, que no tiene estadísticas inventadas y que el nuevo muestra puntos individuales iguales al marcador.

No se aplicaron migraciones ni se simuló la partida remota durante esta implementación.

## Qué hace esta versión

| Área | Comportamiento |
| --- | --- |
| Participantes | Solo jugadores activos y no lesionados de la plantilla de la partida; atributos de su temporada. |
| Convocatoria | Hasta 15 disponibles por equipo, ordenados por tiro cercano, triple y defensa interior; desempate por ID. Admite plantillas de carrera más grandes con jugadores two-way. |
| Rotación | Diez jugadores prioritarios, cinco en cancha; tiempo distribuido según calidad y resistencia. Los demás aportan profundidad ante faltas. |
| Posesiones | 100 por equipo en tiempo reglamentario; pérdidas, robos, tiros de dos/tres, tapones, faltas de tiro, tiros libres, asistencias y rebotes. El rebote ofensivo continúa la posesión. |
| Duración | Cuatro cuartos de 12 minutos; prórrogas de 5 minutos y 11 posesiones por equipo hasta desempatar. |
| Consistencia | Cada equipo suma exactamente 240 minutos, más 25 por prórroga. Los puntos se calculan con los tiros convertidos, no con un marcador previo. |
| Determinismo | Semilla por partida, fecha y equipos; no modifica el generador aleatorio global de PostgreSQL. Versión guardada: `possessions-v1`. |

La calibración inicial es aproximada, no una reproducción estadística certificada de la NBA. Con atributos uniformes de 70, la muestra fija de 100 semillas produjo 117,71 puntos por equipo y 7 períodos de prórroga. La prueba admite un intervalo amplio de anotación, no exige ese promedio exacto.

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

No hay reloj por evento, ritmo variable, táctica ni configuración manual de rotaciones. Las alineaciones se revisan por turnos de cinco pares de posesiones: las exclusiones por faltas se aplican en el siguiente turno, no inmediatamente. Si quedan menos de cinco jugadores sin seis faltas, se mantienen cinco participantes para poder completar el encuentro.

Solo se modelan faltas de tiro; no hay bonus colectivo, faltas técnicas, lesiones durante el encuentro, fatiga persistente, tiempos muertos ni jugada a jugada guardada. No se añaden estadísticas de temporada, playoffs ni progresión de atributos.

El payload versionado permite la primera consulta por partido; una futura entrega de estadísticas de temporada deberá decidir su proyección de totales sin volver a simular encuentros.

## Verificación local

```sh
bun run test
bun run typecheck
bun biome check
bun run build
bun scripts/test-possession-engine-postgres.ts
```

El runner necesita Docker y la imagen local `postgres:17-alpine`: no la descarga. Crea y elimina su propio contenedor, sin red, puertos ni montajes del host. No lee credenciales ni conecta a Supabase.

Cobertura: determinismo, 100 partidos y prórrogas, efecto de atributos, identidades duplicadas, minutos/puntos/tiros inválidos, persistencia, cobertura incompleta, plantillas grandes, lesionados/inactivos, rollback de un día con varios encuentros, compatibilidad histórica, permisos/RLS y dos avances concurrentes de la misma fecha. Las pruebas de interfaz cubren carga diferida, tablas, resultados históricos sin estadísticas, errores y reintento.

Pendiente: instalación remota y comprobación visual en navegador con una sesión real.
