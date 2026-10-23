# Atributos: validar la fuente antes de importar

**Estado:** descarga autenticada, caché compartida, reconciliación, estimaciones, persistencia por carrera e integración SQL implementadas en la rama local. Las migraciones 037–042 aún no se aplicaron a Supabase remoto; la partida usada en la auditoría permanece sin modificaciones.

## Modelo inicial

Los atributos son capacidades de 0 a 99, **no porcentajes de acierto**. El dominio no depende del proveedor.

| Uso previsto | Atributos |
| --- | --- |
| Tiros y faltas | `closeShot`, `midRangeShot`, `threePointShot`, `freeThrow`, `drawFoul` |
| Creación y pérdidas | `ballHandle`, `passAccuracy` |
| Defensa | `interiorDefense`, `perimeterDefense`, `steal`, `block` |
| Rebotes y carga | `offensiveRebound`, `defensiveRebound`, `stamina` |

El `overall` del proveedor se conserva como referencia; no reemplaza estas capacidades. La simulación usa el promedio de las 14 capacidades para ajustar la fuerza del equipo.

## Fuente comprobada el 22 de octubre de 2026

- El [endpoint público](https://api.nba2kapi.com/api/public/players?teamType=curr&limit=100) responde sin clave y pagina en `meta.pagination`.
- [Versiones](https://api.nba2kapi.com/api/versions): edición actual `2K27`, 653 registros actuales declarados; `2K26` está archivada. Esto **no demuestra** cobertura de nuestra plantilla canónica ni de las eras históricas.
- El [README](https://github.com/wkoverfield/nba2kapi) documenta 60 solicitudes/minuto por IP para el endpoint público. La [documentación](https://nba2kapi.com/docs/rate-limits) anuncia 500/hora por clave; el README todavía dice 100/hora. No son límites garantizados por esta aplicación.
- El proveedor anuncia acceso gratuito. No se contrató ningún servicio ni se creó una cuenta.
- **Permisos pendientes:** el README declara MIT para el proyecto y atribuye los datos a `2kratings.com`; no se verificó una licencia que autorice reutilizar o redistribuir esos datos. Acceso público no equivale a autorización.

## Garantías de la descarga

Solo acepta registros actuales de `2K27`. Los jugadores con atributos faltantes o inválidos quedan en `excludedPlayers`, sin inventar valores de reemplazo. Rechaza slugs duplicados, paginación incompleta o circular y cambios de cantidad durante la descarga. Conserva edición, URL, fecha de observación, actualización de cada jugador válido y hash SHA-256 del contenido normalizado.

La descarga completa validó **652 jugadores y excluyó 1**, en 7 solicitudes: `tyler-nickel`, con 10 de los 14 atributos faltantes. También confirmó que la última página puede omitir `nextCursor`; se acepta únicamente cuando `hasMore` es falso y la cantidad descargada coincide con el total declarado.

Las pruebas usan datos sintéticos, sin copiar el dataset al repositorio:

```bash
bun run test src/infrastructure/ratings
```

## Plan aprobado para completar el módulo

La API inicializa; después la carrera conserva y gobierna sus propios atributos:

1. Descargar una base de origen con la API key de servidor y almacenarla en una **caché persistente compartida**, no descargarla al crear cada partida.
2. Actualizar esa base cada 24 horas como política inicial, con un único refresco entre instancias. Si falla el proveedor, conservar la última versión válida e informar su antigüedad; sin una versión válida, no presentar datos externos inventados.
3. Corroborar identidades. Los casos ambiguos no se vinculan automáticamente; para datos ausentes o incompletos se aprobaron **atributos estimados claramente identificados**, separados de los importados.
4. Crear copias independientes por jugador, partida y temporada con procedencia. Una actualización externa nunca sobrescribe una carrera existente.
5. Integrar atributos individuales en la simulación diaria SQL, preservando partidas sin snapshots y resultados completados.

Solo la fuente inicial se comparte entre usuarios. La progresión por edad queda para después; no se implementan ahora posesiones ni box score. No se redistribuye el dataset en el repositorio. Las limitaciones de licencia indicadas arriba siguen siendo independientes del acceso autenticado.

La conexión al motor se hará en el flujo SQL transaccional, no solamente en `SeasonSimulator.ts`. No se reconstruirán estadísticas de partidos ya jugados.

### Estimaciones aprobadas

`estimatePlayerAttributes` implementa `replacement-v1`: perfiles conservadores por posición principal (base, exterior o interior), con una variación entera de -4 a +4 por atributo derivada del UUID canónico. No usa azar ni reloj, no modifica las plantillas base y produce el mismo punto de partida para el mismo jugador. Quince pruebas cubren determinismo, posiciones, límites y aislamiento de objetos.

Son capacidades **estimadas**, no observaciones de NBA 2K ni estadísticas reales. Esta primera calibración es de nivel de reemplazo; deberá contrastarse con rendimientos simulados. El generador no implementa potencial, progresión ni envejecimiento. La materialización por partida registra explícitamente su origen y versión.

`reconcilePlayerAttributes` exige identidad única y corroboración por equipo, altura válida o alias revisado con ID ESPN y ambos nombres. Reconoce alturas NBA (`6-11`) y ESPN (`6' 11"`); una altura inválida no sirve como evidencia. Las colisiones entre nombres, IDs o reclamaciones de un mismo slug generan estimaciones para todos los involucrados, no un ganador por orden.

La salida distingue origen, método/motivo, versión del generador, referencia `overall` y evidencia. En la lectura real de los 546 jugadores auditados produjo **530 importables y 16 estimados**: 496 por nombre/equipo, 24 por nombre/altura y 10 por alias revisado; 9 sin candidato exacto, 1 incompleto y 6 sin corroboración suficiente. Estos últimos incluyen discrepancias de altura o altura canónica ausente: no se presentan como ausencias del proveedor. Veintiuna pruebas verifican las decisiones. Esa partida auditada no fue modificada; el mismo flujo ya materializa partidas nuevas.

La creación moderna ejecuta: roster/contratos → schedule → agentes libres iniciales (si corresponde) → atributos completos → activación. La ruta server-only `/api/player-attributes/bootstrap` solo acepta partidas modernas en `initializing`; no hace backfill de partidas activas.

La migración `041_rollback_game_attributes.sql` extiende el rollback de inicialización para borrar primero las copias/header de atributos y el estado de agentes libres antes de eliminar `game_player_states`. `useCreateGame` invoca ese rollback de forma best-effort antes del soft-delete si falla cualquier etapa; no elimina jugadores canónicos ni la caché global.

### Integración con el partido diario

La migración `042_player_attribute_simulation_strength.sql` conserva la fórmula de roster disponible y, si todos los jugadores activos y sanos tienen atributos, agrega un ajuste basado en su promedio de los 14 atributos de la temporada actual: `round((promedio - 60) * 0.2)`, limitado junto al rating final entre 0 y 100. Si una partida antigua o una plantilla parcial no tiene cobertura completa, mantiene el comportamiento anterior basado en tamaño de roster. La simulación solo calcula rating para juegos todavía `scheduled`; atributos posteriores no recalculan marcadores completados.

Verificación repetible de migraciones, RLS, cobertura, idempotencia, rollback, flujo de agentes libres, concurrencia de refresco y simulación diaria en PostgreSQL aislado:

```bash
bun scripts/test-player-attributes-postgres.ts <id-del-contenedor-aislado-autorizado>
```

La prueba verifica contenedor sin red/puertos y usa una base aleatoria dentro del tmpfs. No aplica migraciones ni escribe en Supabase remoto.

Para habilitar la función en un entorno propio hay que aplicar las migraciones 037–042 en orden y definir `NBA_2K_API_KEY` como variable privada del servidor. Este repositorio no aplicó esas migraciones a la base remota.

### Persistencia compartida de la fuente

La migración `037_player_rating_source_cache.sql` crea versiones inmutables por edición/hash y una cabecera de caché privada, con RLS y acceso exclusivamente mediante operaciones de servidor. No se aplicó a la base remota.

- Frescura de 24 horas: el primer consumidor tras el vencimiento obtiene un lease de 60 segundos; los demás pueden leer la versión anterior. Es una actualización bajo demanda, no un cron ni una descarga por usuario.
- Publicar requiere el lease vigente. Una respuesta tardía no puede sobrescribir la de otro refresco; el mismo contenido reutiliza la versión existente.
- Un error libera el lease y aplica 5 minutos de espera antes de volver a consultar al proveedor, conservando el último contenido válido. Una caché vacía no se presenta como una fuente válida.
- Prueba real en PostgreSQL 17 aislado: `tests/infrastructure/supabase/playerRatingCache.postgres.sql` verifica versiones, vencimientos, cooldown, privilegios y RLS. Una prueba adicional con dos conexiones concurrentes confirmó un único propietario del refresco.

La orquestación `getSharedPlayerRatings` reutiliza versiones frescas sin descargar, sirve versiones anteriores mientras otra instancia actualiza y espera hasta 25 segundos a un primer refresco en curso. Con caché vacía en cooldown falla de inmediato. La cancelación libera el lease; los errores de persistencia no se ocultan como fallos del proveedor. Trece pruebas focalizadas verifican esas rutas, incluidos 50 consumidores sin solicitudes externas.

`SupabasePlayerRatingSourceCache` conecta esas operaciones a la BD y valida también los snapshots leídos: edición, cantidades, atributos, identidades únicas y hash recalculado. No acepta snapshots públicos para persistencia ni expone detalles de errores SQL. Una prueba integrada con PostgreSQL 17 verificó el round trip JSONB/hash, 20 consumidores de una misma versión con una sola descarga y fallback con cooldown ante un fallo simulado del proveedor.

La verificación inicial de adquisición compartida aprobó 70 pruebas focalizadas de fuente, cobertura, caché y orquestación. La materialización ahora está conectada al flujo de creación.

### Copias por partida y temporada

La migración `038_game_player_attributes.sql` crea la cabecera de materialización y las copias por `(game_id, season_year, player_id)`, vinculadas a la identidad del jugador en esa partida, nunca a su equipo mutable. Se guardan los 14 atributos enteros de 0 a 99, origen, método de identidad, evidencia, referencia del proveedor y versión del generador; las restricciones impiden mezclar importaciones y estimaciones sin etiquetar.

RLS permite lectura solo al dueño y oculta partidas eliminadas. No hay escritura directa para clientes ni para `service_role`: la escritura se realiza mediante un RPC transaccional restringido. Las pruebas reales de PostgreSQL verifican atributos inválidos, colisiones de fuente, IDs de otra partida, permisos, aislamiento entre dueños, reintentos y conservación al cambiar de equipo. El esquema canónico contiene mirrors byte-idénticos de las migraciones 037–042, comprobados por Vitest.

## Ejecutar el reporte sin importar datos

```bash
bun scripts/dry-run-player-attributes.ts
bun scripts/dry-run-player-attributes.ts /ruta/roster.json
```

Con `NBA_2K_API_KEY` configurada en el entorno de servidor, utiliza `GET /api/players/bulk?teamType=curr` y el header `X-API-Key`: una solicitud para el conjunto completo. La clave no aparece en la URL, salida ni errores; no se permiten redirecciones. Una clave vacía o rechazada falla sin reintentar por el endpoint público. Sin esa variable, el reporte mantiene la descarga pública paginada para auditorías sin credenciales. No consulta ni escribe Supabase.

La descarga autenticada valida cantidad total, edición, identidades y atributos con las mismas reglas de cuarentena. El hash normaliza el orden por slug, por lo que no cambia por orden de respuesta ni por transporte público/bulk; no debe compararse directamente con hashes históricos anteriores a esta normalización.

**Verificación del transporte autenticado (23 de octubre de 2026):** 41 pruebas focalizadas, typecheck y Biome correctos. La CLI real validó 652 jugadores y excluyó 1 en una solicitud, sin escrituras. Hash normalizado: `18768de1aa2e0f0752b469d780db1b09656b8e07e82d1e38fcb98f3b87e993fa`. La caché persistente se conectó posteriormente; su verificación actual está en la sección anterior.

Sin archivo, muestra únicamente calidad y cantidad del proveedor; `coverage: null` significa que **no se midió cobertura del roster**. El archivo opcional debe ser una exportación de la plantilla canónica moderna de 2026-27, no la lista global de jugadores históricos:

```json
{
  "seasonYear": 2026,
  "seasonEraId": "modern",
  "players": [
    { "playerId": "00000000-0000-4000-8000-000000000001", "fullName": "Example Player" }
  ]
}
```

El reporte de auditoría separa candidatos por nombre, ausencias, ambigüedades y atributos incompletos. Reutiliza la normalización existente de acentos, mayúsculas y sufijos; no hace fuzzy matching ni resuelve homónimos automáticamente. **Un candidato no es una identidad validada.** El inicializador usa el reconciliador con evidencia adicional y aliases revisados por ID ESPN.

Sale con código 1 si falla la descarga/entrada o si el roster contiene casos sin resolver. Una auditoría del proveedor puede finalizar con código 0 aunque haya exclusiones: revisá `excludedPlayers`. `readyForImport` siempre es falso; incluso un roster sin faltantes requiere revisar identidades y permisos.

**Verificación de la entrega inicial:** 26 pruebas focalizadas y 520 pruebas totales aprobadas; Biome, typecheck y build correctos. Prueba real de la CLI con roster sintético: 1 candidato, 1 registro incompleto y 1 ausente; código 1 esperado y cero escrituras.

## Cruce con una partida real: 22 de octubre de 2026

**Resultado:** 526 candidatos por nombre sobre 546 jugadores (96,3 %). Esto mide cobertura nominal, **no identidades verificadas ni preparación para importar**.

La partida `b043e7c3-9b69-4742-a01b-6d11085a6b05` está activa, con `season_year = 2026` y `season_era_id = modern`. Se consultaron todos sus `game_player_states`, incluidos jugadores sin equipo, con sus nombres e identificadores ESPN desde `players`; no se utilizó la lista global de jugadores históricos.

| Resultado del cruce estricto | Todos los jugadores de la partida | Activos con equipo asignado |
| --- | ---: | ---: |
| Jugadores | 546 | 523 |
| Candidatos por nombre | 526 | 504 |
| Sin coincidencia de nombre | 19 | 18 |
| Atributos incompletos | 1 | 1 |
| Ambiguos | 0 | 0 |

### Revisión de los 20 casos pendientes

En una segunda descarga con el mismo hash se localizaron estas **11 posibles variantes**. Son pistas para corroborar cada identidad, no excepciones aprobadas:

| Nombre canónico | Nombre en la fuente |
| --- | --- |
| Mo Bamba | Mohamed Bamba |
| Bub Carrington | Carlton Carrington |
| Alex Sarr | Alexandre Sarr |
| Xavier Tillman | Xavier Tillman Sr. |
| Svi Mykhailiuk | Sviatoslav Mykhailiuk |
| Ronald Holland II | Ron Holland |
| Jimmy Butler III | Jimmy Butler |
| David Jones Garcia | David Jones-Garcia |
| Bronny James | Bronny James Jr. |
| Bobby Portis | Bobby Portis Jr. |
| Nic Claxton | Nicolas Claxton |

**Revisión del 23 de octubre:** se corroboraron los diez alias con identificador ESPN mediante los rosters actuales de Utah, Washington, Detroit, Golden State, San Antonio, Lakers, Miami y Chicago, comparados con nombre, equipo y ficha del proveedor. Los registros de ambos proveedores coinciden en equipo; los nombres alternativos quedan vinculados a los IDs ESPN, no a un acortamiento genérico de nombres. Bobby Portis difiere una pulgada de altura entre fuentes y David Jones Garcia tiene distinta clasificación de posición; esas diferencias no se ocultaron ni se trataron como coincidencias físicas exactas.

Xavier Tillman sigue sin alias revisado porque el registro canónico auditado no tiene ID ESPN. Si no se corrobora por nombre y equipo, recibe una estimación identificada; no se inventa un vínculo de proveedor.

Los diez enlaces revisados se registran en `reviewedNba2kRatingAliases.ts`, con ID ESPN y ambos nombres exactos; no se aplica una regla global de apodos o eliminación de sufijos. La fuente ahora conserva altura y posiciones opcionales para corroboración adicional. Los snapshots anteriores sin esos campos siguen siendo legibles; un refresco con metadatos nuevos genera su propia versión/hash.

No se localizó candidato por nombre para **8 jugadores**: Latrell Wrightsell Jr., Tacko Fall, Armoni Brooks, Nate Bittle, Leaky Black, Caleb Homesley, Reece Beekman y Duop Reath. En la reconciliación reciben estimaciones etiquetadas con motivo `missing-source`.

**Tyler Nickel** sí aparece por nombre, pero sigue excluido porque faltan 10 de los 14 atributos. No se completaron ni reemplazaron sus valores.

No se modificó la normalización compartida ni se aceptan coincidencias por apellido: por ejemplo, la fuente contiene tanto Alexandre Sarr como Olivier Sarr. Los aliases revisados vinculan ID ESPN, nombre canónico y slug exactos.

### Evidencia y límites

- Ejecución puntual con Bun, reutilizando `fetchNba2kRatings` y `getNba2kRatingCoverage`; consultas REST exclusivamente `GET`. Credenciales utilizadas solo en el proceso de servidor, nunca incluidas en el reporte ni enviadas al proveedor de atributos.
- Exportación paginada de 500 + 46 filas, con total exacto estable, UUID únicos y aserciones de cantidad. No se omitieron filas mediante joins internos.
- Fuente: 652 registros válidos, 1 excluido, 7 solicitudes por descarga; observación inicial `2026-10-22T18:31:47.135Z`.
- SHA-256 del contenido normalizado: `4b876f74645bfb635ee93c2b384c82397687b1538616b2da55120d192f8048a4`. La segunda descarga produjo el mismo hash.
- Cero escrituras en la base de datos. No se incorporaron exportaciones del roster ni del dataset de atributos al repositorio.
- Verificación de esta revisión: `bun run test src/infrastructure/ratings` (26/26), `bun biome check` (310 archivos) y `git diff --check` correctos. No se repitieron la suite completa, el typecheck ni el build: solo se modificó documentación.
- `identityVerified = false` y `readyForImport = false`. Este resultado corresponde a esta partida y este momento, no garantiza cobertura de otras partidas o eras.

**Verificación local:** `bun run test` aprobó 617/617 pruebas en 91 archivos; `bun run typecheck`, `bun biome check` (328 archivos), `bun run build` y el runner PostgreSQL aislado de migraciones 037–042 también pasaron. No se hizo push ni se aplicaron migraciones a Supabase remoto.

### Auditoría de requisitos de entrega local

| Requisito | Implementación y evidencia |
| --- | --- |
| Adquisición bulk autenticada sin clave en el navegador | `materializeGamePlayerAttributes.ts` lee `NBA_2K_API_KEY` desde la ruta de servidor; `nba2kRatingsSource.test.ts` cubre transporte, validación y errores. El hook cliente solo envía `gameId`. |
| Fuente compartida, coordinada e inmutable | Migración 037, `getSharedPlayerRatings.test.ts` y `playerRatingCache.postgres.sql`: frescura, lease, cooldown, fallback y permisos; runner con dos conexiones confirma un único propietario del refresco. |
| Identidades conservadoras y estimaciones identificadas | `reconcilePlayerAttributes.test.ts` y `estimatePlayerAttributes.test.ts`: evidencia, aliases revisados, ambigüedad y `replacement-v1`; sin fuzzy matching. |
| Copias independientes, procedencia, versión, RLS y escritura atómica/idempotente | Migraciones 038–039; `gamePlayerAttributes.postgres.sql` y `gamePlayerAttributesMaterialize.postgres.sql`: restricciones, aislamiento, cobertura, reintentos alterados/duplicados y rechazo de escrituras directas. |
| Agentes libres antes de atributos y activación; compensación de fallos | `useCreateGame.ts`, migraciones 040–041, `createGameMarket.test.tsx`, `initializingFreeAgentBootstrap.postgres.sql` y `gameAttributeRollback.postgres.sql`. El rollback conserva jugadores canónicos y versiones globales. |
| SQL diario efectivo y compatibilidad | Migración 042 y `playerAttributeSimulation.postgres.sql`: ratings y scores diarios, fallback legacy/parcial, independencia de refrescos externos y conservación de resultados completados. |
| Esquema instalable y mirrors consistentes | Runner sobre `scripts/schema.sql` completo y `playerRatingsInvariant.test.ts` para los mirrors 037–042; seis escenarios PostgreSQL y concurrencia real aprobados. |
| Límites de entrega y proveedor | Condiciones conocidas documentadas arriba; la clave no acredita redistribución. Sin backfill remoto, progresión por edad, posesiones, box score, estadísticas de temporada ni postemporada. |

**Siguiente paso operativo:** aplicar las migraciones 037–042 al entorno Supabase que se utilizará y probar manualmente la creación de una partida nueva. No se implementaron progresión por edad, posesiones ni box score; tampoco se modificó ni migró la partida usada en la auditoría anterior.
