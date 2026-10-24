# Entrada a la offseason, sin cambiar de temporada

Después de confirmar al campeón, la misma partida puede entrar explícitamente en una etapa de planificación. Conserva la fecha, el año, el equipo y todo el historial; todavía no inicia la siguiente campaña.

## Uso en una partida existente

1. Después de `052`, aplicar manualmente **solo** `scripts/migrations/053_offseason_entry.sql`. No ejecutar `scripts/schema.sql` sobre una base existente. El agente no aplica migraciones remotas.
2. Abrir **Postemporada**. Con campeón confirmado aparece la entrada a offseason; consultar la página no realiza la transición.
3. Pulsar el botón de entrada. Al recargar se conserva el estado de offseason y se puede consultar la situación contractual del equipo elegido. El campeón y el cuadro siguen disponibles en la misma página.

La instalación no avanza ninguna partida. La transición tampoco cambia la fecha de simulación: una partida cerrada el 10 de junio de 2027 permanece en esa fecha y en la temporada 2026–27. El año siguiente se muestra únicamente como contexto del resumen contractual.

## Qué informa el resumen

| Situación | Evidencia utilizada |
| --- | --- |
| Vencimiento | Límite contractual explícito en la temporada que acaba de finalizar. |
| Opción de jugador o equipo | Opción registrada para la próxima temporada; no se ejerce ni se rechaza. |
| Cobertura de la próxima temporada | Fila contractual conocida, sin afirmar que el salario esté garantizado. |
| Desconocido | Falta de contrato, límite, opción o salario verificable; no equivale a cero ni a agente libre. |

Los contratos simulados vigentes prevalecen sobre la copia de origen. Los contratos canónicos usan sus temporadas y límites explícitos: la última fila salarial observada no demuestra un vencimiento, y una columna futura vacía no acredita cobertura. Los límites sintetizados por estimaciones de salario mínimo tampoco acreditan un vencimiento; su perspectiva sigue como desconocida y estimada. Los importes ausentes se muestran como desconocidos. Las partidas antiguas conservan la lectura de sus contratos existentes.

El resumen reutiliza la plantilla actual de la partida y es de solo lectura. No calcula un nuevo presupuesto ni convierte automáticamente vencimientos en bajas.

## Persistencia y límites

`game_offseasons` guarda una única entrada por partida y temporada, vinculada al campeón de `postseason_results`. `enter_offseason` autentica al propietario, bloquea la partida activa y comprueba el año esperado y el campeonato antes de insertar. Reintentar devuelve la misma entrada, incluso con solicitudes concurrentes. La tabla tiene RLS y no admite escrituras directas del cliente.

La única escritura de esta transición es el marcador de entrada. No modifica la partida, clasificación, encuentros, box scores, series, campeón, contratos, plantilla ni atributos. El avance diario sigue detenido al existir un campeón.

**Fuera de alcance:** iniciar 2027–28, nuevo calendario, draft, renovaciones, decisiones de opciones, liberaciones, mercado de verano, progresión y retiros. La continuidad jugable necesitará además reglas financieras para el nuevo año, atributos por temporada y consultas históricas independientes del año actual.

## Verificación local

```sh
bun scripts/test-offseason-entry-postgres.ts
bun run test
bun run typecheck
bun biome check
bun run build
```

El runner PostgreSQL utiliza exclusivamente su contenedor desechable sin red externa, puertos, credenciales ni montajes de datos. Comprueba permisos, campeón obligatorio, año esperado, reintentos, concurrencia, rollback y conservación del estado anterior. No prueba ni modifica Supabase remoto.

**Comprobado localmente (2026-10-25):** 796 tests en 116 archivos, TypeScript, Biome (394 archivos), build de producción y runner PostgreSQL correctos. La copia canónica de `053` es idéntica a la migración. Dos conexiones esperaron el mismo bloqueo y devolvieron una única entrada con el mismo timestamp; las tablas anteriores permanecieron idénticas. La revisión independiente confirmó resueltos los casos de columnas futuras vacías, límites sintetizados por estimaciones y lecturas atrasadas de caché, con regresiones verificadas.

**Aceptación manual (2026-10-25):** el usuario mostró la planificación abierta con opciones de jugador/equipo, cobertura conocida, salarios desconocidos y estimaciones identificadas. Confirmó que, después de recargar, conserva el mismo estado y resumen sin pedir otra entrada. Esto verifica entrada, presentación y persistencia; no constituye una auditoría de todos los importes contra sus fuentes. El agente no aplicó migraciones remotas ni avanzó la partida.
