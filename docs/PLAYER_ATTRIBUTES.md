# Atributos: validar la fuente antes de importar

**Estado:** fuente validada y primer cruce con una partida real ejecutado, solo lectura. Identidades e importación pendientes. No cambia jugadores, partidas ni resultados.

## Modelo inicial

Los atributos son capacidades de 0 a 99, **no porcentajes de acierto**. El dominio no depende del proveedor.

| Uso previsto | Atributos |
| --- | --- |
| Tiros y faltas | `closeShot`, `midRangeShot`, `threePointShot`, `freeThrow`, `drawFoul` |
| Creación y pérdidas | `ballHandle`, `passAccuracy` |
| Defensa | `interiorDefense`, `perimeterDefense`, `steal`, `block` |
| Rebotes y carga | `offensiveRebound`, `defensiveRebound`, `stamina` |

El `overall` del proveedor se conserva como referencia; no reemplaza estas capacidades ni define todavía una fórmula de fuerza.

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

## Siguiente paso

Medir correspondencias con el roster canónico y resolver permisos antes de importar. Después, persistir una versión de atributos por partida/temporada para que una actualización externa no modifique partidas existentes. Los jugadores sin datos deben quedar identificados; cualquier fallback simulado requiere una política explícita.

La conexión al motor se hará en el flujo SQL transaccional, no solamente en `SeasonSimulator.ts`. No se reconstruirán estadísticas de partidos ya jugados.

## Ejecutar el reporte sin importar datos

```bash
bun scripts/dry-run-player-attributes.ts
bun scripts/dry-run-player-attributes.ts /ruta/roster.json
```

Sin archivo, muestra únicamente calidad y cantidad del proveedor; `coverage: null` significa que **no se midió cobertura del roster**. No usa credenciales ni consulta Supabase. El archivo opcional debe ser una exportación de la plantilla canónica moderna de 2026-27, no la lista global de jugadores históricos:

```json
{
  "seasonYear": 2026,
  "seasonEraId": "modern",
  "players": [
    { "playerId": "00000000-0000-4000-8000-000000000001", "fullName": "Example Player" }
  ]
}
```

El reporte separa candidatos por nombre, ausencias, ambigüedades y atributos incompletos. Reutiliza la normalización existente de acentos, mayúsculas y sufijos; no hace fuzzy matching ni resuelve homónimos automáticamente. **Un candidato no es una identidad validada:** falta corroborar el identificador antes de importar.

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

No se localizó candidato para **8 jugadores**: Latrell Wrightsell Jr., Tacko Fall, Armoni Brooks, Nate Bittle, Leaky Black, Caleb Homesley, Reece Beekman y Duop Reath. No se les asignaron atributos estimados.

**Tyler Nickel** sí aparece por nombre, pero sigue excluido porque faltan 10 de los 14 atributos. No se completaron ni reemplazaron sus valores.

No se modificó la normalización compartida ni se aceptaron coincidencias por apellido: por ejemplo, la fuente contiene tanto Alexandre Sarr como Olivier Sarr. Las variantes requieren corroboración individual antes de vincular UUID canónico y slug del proveedor.

### Evidencia y límites

- Ejecución puntual con Bun, reutilizando `fetchNba2kRatings` y `getNba2kRatingCoverage`; consultas REST exclusivamente `GET`. Credenciales utilizadas solo en el proceso de servidor, nunca incluidas en el reporte ni enviadas al proveedor de atributos.
- Exportación paginada de 500 + 46 filas, con total exacto estable, UUID únicos y aserciones de cantidad. No se omitieron filas mediante joins internos.
- Fuente: 652 registros válidos, 1 excluido, 7 solicitudes por descarga; observación inicial `2026-10-22T18:31:47.135Z`.
- SHA-256 del contenido normalizado: `4b876f74645bfb635ee93c2b384c82397687b1538616b2da55120d192f8048a4`. La segunda descarga produjo el mismo hash.
- Cero escrituras en la base de datos. No se incorporaron exportaciones del roster ni del dataset de atributos al repositorio.
- Verificación de esta revisión: `bun run test src/infrastructure/ratings` (26/26), `bun biome check` (310 archivos) y `git diff --check` correctos. No se repitieron la suite completa, el typecheck ni el build: solo se modificó documentación.
- `identityVerified = false` y `readyForImport = false`. Este resultado corresponde a esta partida y este momento, no garantiza cobertura de otras partidas o eras.

**Siguiente paso:** corroborar las variantes y las identidades candidatas; acordar una política explícita para datos ausentes/incompletos y confirmar permisos de reutilización antes de persistir atributos.
