# Atributos: validar la fuente antes de importar

**Estado:** primera entrega del bloque 1, solo lectura. No cambia jugadores, partidas ni resultados.

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

**Verificación de esta entrega:** 26 pruebas focalizadas y 520 pruebas totales aprobadas; Biome, typecheck y build correctos. Prueba real de la CLI con roster sintético: 1 candidato, 1 registro incompleto y 1 ausente; código 1 esperado y cero escrituras. No se ejecutó contra una exportación real del roster canónico.
