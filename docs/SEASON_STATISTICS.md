# Estadísticas individuales de temporada

## Qué incluye

En **Plantilla** y **Liga**, el selector **Plantilla y atributos / Estadísticas** cambia la vista de la lista existente, sin otra ruta ni otra tabla de jugadores en paralelo. En Liga respeta el equipo seleccionado y la búsqueda. La vista de estadísticas se carga al abrirla y permite seleccionar **temporada regular / play-in / playoffs**, ordenar columnas y alternar totales/por partido: minutos, puntos, rebotes, asistencias, robos, tapones, pérdidas, faltas y tiros convertidos/intentos. Los porcentajes usan convertidos/intentos acumulados; sin intentos se muestra «—». La fase inicial es temporada regular; las Finales forman parte de playoffs. Cambiar de fase consulta sus datos guardados y no simula partidos.

Solo participan box scores persistidos (`possessions-v1` y `possessions-v2`). PJ requiere segundos jugados > 0: los DNP no reducen promedios. Los jugadores de la plantilla sin participaciones registradas siguen visibles con «—», nunca con actuaciones inventadas de cero. Se conserva el nombre actual de la plantilla y la selección del jugador o enlace a su ficha. Los totales siguen al ID del jugador e incluyen toda su temporada, independientemente de cambios de equipo; no representan únicamente su paso por el equipo seleccionado.

La cobertura indica encuentros de toda la liga completados con box score sobre encuentros completados. Un resultado antiguo sin box score permanece intacto y se excluye de las actuaciones. No se recalcula ni importa estadística real.

## Instalación

El usuario confirmó la aplicación de 048; el agente no consultó ni modificó Supabase. El selector de vistas no requiere otra migración. Para instalaciones pendientes, aplicar manualmente **solo** `scripts/migrations/048_player_season_statistics.sql`, después de 044–047. La migración añade metadatos al calendario y una consulta de solo lectura; no cambia marcadores, clasificación, payloads ni la fecha de simulación.

Los encuentros anteriores a 048 pertenecen a la única temporada de su partida y a temporada regular. La migración les asigna esos metadatos, no inventa actuaciones. Las inserciones futuras copian el año de la partida si no lo especifican. Las migraciones 050 y 052 crean encuentros nuevos con `competition_phase` explícita; no cambian los metadatos ni resultados de los partidos previos. Todavía no existe cambio de temporada.

`scripts/schema.sql` incluye el espejo canónico. No ejecutar el esquema completo sobre una instalación existente.

## Arquitectura y seguridad

- `get_player_season_statistics`: agregación SQL al leer, `SECURITY INVOKER`, RLS y filtro explícito del propietario/partida no eliminada. Parámetros de partida, temporada y fase; sin tabla de acumulados ni escrituras del cliente.
- Repositorio de infraestructura con validación Zod; interfaz y resultados en Domain.
- Hook TanStack Query; invalidación al simular un día o cada día confirmado de un lote.
- Plantilla y estadísticas usan `AppTable` (`src/components/ui/app-table.tsx`): bordes, encabezado, espaciado, filas alternadas, hover y selección compartidos por defecto, conservando la foto del jugador. Los encabezados ordenables también usan esta base. La consulta devuelve agregados, no todos los payloads al navegador.

## Verificación

`bun run test`, `bun run typecheck`, `bun biome check` y `bun run build`.

`bun scripts/test-possession-engine-postgres.ts` usa PostgreSQL desechable sin red externa. Comprueba upgrade 047→048, conservación de resultados/payloads, suma de actuaciones, exclusión de DNP, cobertura antigua incompleta, aislamiento por propietario/temporada/fase y estabilidad al cambiar el año de la partida. Nunca conecta a la partida real.

Prueba manual pendiente: abrir Plantilla y Liga en la partida `8d2d44b9-9634-4a74-94fc-0732825122e8`, alternar atributos/estadísticas, contrastar un jugador con sus box scores, cambiar totales/promedios, ordenar y comprobar el filtro de equipo/búsqueda de Liga. Volver a atributos conserva su ordenamiento; las acciones de plantilla siguen en esa vista. No es necesario recalcular encuentros para consultar los datos existentes.
