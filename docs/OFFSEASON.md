# Offseason: planificación y opciones, sin cambiar de temporada

Después de confirmar al campeón, la misma partida puede entrar explícitamente en una etapa de planificación. Conserva la fecha, el año, el equipo y todo el historial; todavía no inicia la siguiente campaña.

## Uso en una partida existente

1. Después de `052`, aplicar manualmente **solo** `scripts/migrations/053_offseason_entry.sql`. No ejecutar `scripts/schema.sql` sobre una base existente. El agente no aplica migraciones remotas.
2. Abrir **Postemporada**. Con campeón confirmado aparece la entrada a offseason; consultar la página no realiza la transición.
3. Pulsar el botón de entrada. Al recargar se conserva el estado de offseason y se puede consultar la situación contractual del equipo elegido. El campeón y el cuadro siguen disponibles en la misma página.

### Registrar vencimientos y decidir opciones de equipo

Con `053` instalada, aplicar manualmente **solo** `scripts/migrations/054_offseason_contracts.sql`. No ejecutar el esquema canónico sobre una base existente. La instalación no prepara ni decide contratos.

1. En la planificación, seleccionar el equipo de la partida y pulsar el botón de registro de vencimientos y opciones. Abrir la página o consultar el resumen no escribe datos.
2. El registro conserva vencimientos conocidos como salidas previstas y opciones pendientes. No quita jugadores de la plantilla ni modifica contratos originales.
3. Para una opción de equipo con salario conocido, elegir ejercer o rechazar y confirmar. Cancelar no guarda nada. Una decisión confirmada es definitiva: repetirla devuelve el mismo registro; intentar cambiarla se rechaza.
4. Recargar conserva el registro y las decisiones. Las opciones de jugador quedan pendientes hasta resolverlas mediante el bloque siguiente; otros equipos son de solo lectura. Los datos desconocidos, estimados o contradictorios no habilitan decisiones.

El registro pertenece al equipo controlado por el usuario. Prepararlo omite clasificaciones sin evidencia suficiente; una opción conocida con salario desconocido puede registrarse, pero no decidirse. Esta preparación no resuelve opciones de jugador ni decide por otros equipos.

### Resolver opciones de jugador: política inicial

Con `054` instalada, aplicar manualmente **solo** `scripts/migrations/055_offseason_player_options.sql`. No ejecutar el esquema canónico sobre una base existente. Instalar la migración o consultar la página no resuelve opciones.

La acción explícita de resolver opciones de jugador, con confirmación, aplica únicamente al equipo controlado. El GM no elige ejercer o rechazar: el servidor compara el salario conocido de la opción con el de la temporada terminada.

| Datos conocidos | Resultado simulado |
| --- | --- |
| Salario de opción igual o mayor al actual | Ejerce. |
| Salario de opción menor al actual | Rechaza; salida prevista, sin quitar al jugador de la plantilla actual. |
| Salario ausente, estimado o evidencia contradictoria | Sigue pendiente. |

El cero es un importe conocido, no un dato ausente. Cada resolución guarda ambos importes, decisión, motivo, evidencia y versión `salary-comparison-v1` en `game_offseason_player_options`, separada de las opciones de equipo. Reintentar no cambia resultados guardados; recargar solo los consulta. Cancelar la confirmación no ejecuta la resolución.

Esta es una heurística de simulación, no una regla NBA ni una predicción de preferencias reales. **Modelar expectativas de mercado** queda como [bloque futuro pendiente](SIMULATION_ROADMAP.md#bloque-futuro-pendiente-modelar-expectativas-de-mercado), con alcance por acordar. No forma parte de esta política inicial.

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

`game_offseason_contracts` añade un registro separado por partida, temporada y jugador. Sus RPC autentican al propietario, bloquean la partida activa, exigen la entrada a offseason y el año esperado, y derivan la evidencia desde la base, sin confiar en clasificaciones enviadas por el cliente. Los acuerdos simulados prevalecen sobre los canónicos y estos sobre los contratos antiguos. La tabla permite lectura del propietario con RLS, no escrituras directas del cliente.

`prepare_offseason_contracts` registra vencimientos y opciones mediante una acción explícita; `decide_offseason_team_option` revalida la evidencia antes de guardar. Si la evidencia registrada cambia, ambas operaciones se rechazan: no se reemplaza silenciosamente el registro ni se ofrece todavía un mecanismo de conciliación. Ninguna de estas operaciones modifica contratos, plantilla, salarios vigentes, fecha, temporada o resultados históricos. Ejercer una opción solo registra la decisión; todavía no materializa el contrato del próximo año.

La titularidad se toma de la plantilla actual de la partida: los equipos de origen de un contrato importado son procedencia, no impiden decidirlo después de un traspaso. Los contratos simulados liberados se excluyen; una nueva firma utiliza exclusivamente el acuerdo activo. Ambos casos tienen regresiones en PostgreSQL aislado.

`resolve_offseason_player_options` reutiliza la preparación protegida de `054` para autenticar al propietario, bloquear la partida y revalidar año, entrada y evidencia. Una acción explícita puede completar registros aún no preparados; nunca cambia las decisiones de equipo ya guardadas. La resolución de jugador tiene lectura del propietario mediante RLS y no admite escrituras directas del cliente. No modifica los contratos vigentes ni convierte rechazos en bajas inmediatas.

**Fuera de alcance:** iniciar 2027–28, nuevo calendario, draft, renovaciones, decisiones de otros equipos, liberaciones, mercado de verano, expectativas de mercado, progresión y retiros. La continuidad jugable necesitará además reglas financieras para el nuevo año, atributos por temporada y consultas históricas independientes del año actual.

## Verificación local

```sh
bun scripts/test-offseason-entry-postgres.ts
bun scripts/test-offseason-contracts-postgres.ts
bun scripts/test-offseason-player-options-postgres.ts
bun run test
bun run typecheck
bun biome check
bun run build
```

El runner PostgreSQL utiliza exclusivamente su contenedor desechable sin red externa, puertos, credenciales ni montajes de datos. Comprueba permisos, campeón obligatorio, año esperado, reintentos, concurrencia, rollback y conservación del estado anterior. No prueba ni modifica Supabase remoto.

**Comprobado localmente (2026-10-25):** 796 tests en 116 archivos, TypeScript, Biome (394 archivos), build de producción y runner PostgreSQL correctos. La copia canónica de `053` es idéntica a la migración. Dos conexiones esperaron el mismo bloqueo y devolvieron una única entrada con el mismo timestamp; las tablas anteriores permanecieron idénticas. La revisión independiente confirmó resueltos los casos de columnas futuras vacías, límites sintetizados por estimaciones y lecturas atrasadas de caché, con regresiones verificadas.

**Aceptación manual (2026-10-25):** el usuario mostró la planificación abierta con opciones de jugador/equipo, cobertura conocida, salarios desconocidos y estimaciones identificadas. Confirmó que, después de recargar, conserva el mismo estado y resumen sin pedir otra entrada. Esto verifica entrada, presentación y persistencia; no constituye una auditoría de todos los importes contra sus fuentes. El agente no aplicó migraciones remotas ni avanzó la partida.

**Registro contractual `054`:** el runner aislado verifica clasificación, autorización/RLS, reintentos inmutables, rollback, espera concurrente del bloqueo y conservación de las tablas anteriores.

**Aceptación manual de `054` (2026-10-25):** el usuario informó que aplicó la migración y mostró el registro con Nique Clifford y Maxime Raynaud como opciones de equipo pendientes, y Malik Monk como opción de jugador pendiente sin controles. Confirmó que los tres registros persisten al recargar y que abrir la opción de Clifford y cancelar la confirmación la deja pendiente. Después mostró ambas opciones de equipo ejercidas como planes guardados, sin botones para cambiarlas, y confirmó que siguen iguales tras recargar. Esto verifica lectura del registro, cancelación, confirmación y persistencia del ejercicio; no verifica manualmente rechazo, filas de vencimiento ni restricciones de otros equipos o datos inciertos. El agente no accedió al remoto ni avanzó la partida; las decisiones siguen siendo planes, no contratos materializados de 2027–28.

**Verificación local de la nueva entrega (2026-10-25):** 819 tests en 119 archivos, TypeScript, Biome (403 archivos) y build de producción correctos. Los tests de interfaz comprueban preparación explícita, confirmación/cancelación, errores, bloqueo de duplicados y restricciones por equipo/evidencia; los de hooks comprueban la recuperación de decisiones guardadas y la cancelación de lecturas atrasadas. La forma objeto de la respuesta RPC compuesta se contrastó con la implementación de PostgREST; no se ejecutó una llamada HTTP contra Supabase ni una prueba E2E de navegador.

**Verificación local de `055` (2026-10-25):** 871 tests en 122 archivos, TypeScript, Biome (412 archivos), build de producción y runner PostgreSQL aislado correctos. El runner comprueba igualdad y comparación salarial, cero conocido, datos inciertos, precedencia de fuentes, contratos traspasados y liberados, permisos/RLS, reintentos inmutables, rollback, espera concurrente del bloqueo y conservación de todas las tablas anteriores, incluidas las decisiones de equipo de `054`. La migración y su copia canónica son idénticas. Las pruebas de repositorio, hooks e interfaz comprueban validación, acción explícita, confirmación/cancelación, errores, protección de caché y recuperación de resultados guardados.

**Aceptación manual de `055` (2026-10-25):** el usuario informó que instaló la migración y confirmó que abrir la resolución, cancelar y recargar mantiene a Malik Monk pendiente. Después mostró su opción ejercida como plan guardado: salario actual $20.190.035, salario siguiente $21.582.451, motivo de salario siguiente igual o mayor y política `salary-comparison-v1`. Confirmó que persiste al recargar. Las capturas conservan las opciones de equipo ejercidas de Clifford y Raynaud; el botón de resolver ya no aparece tras guardar a Monk. Esto verifica cancelación, ejercicio según la política y persistencia; no verifica manualmente rechazo ni datos inciertos. El agente no accedió al remoto ni inició 2027–28.
