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
4. Recargar conserva el registro y las decisiones. Las opciones de jugador siguen pendientes; otros equipos son de solo lectura. Los datos desconocidos, estimados o contradictorios no habilitan decisiones.

El registro pertenece al equipo controlado por el usuario. Prepararlo omite clasificaciones sin evidencia suficiente; una opción conocida con salario desconocido puede registrarse, pero no decidirse. No hay decisiones automáticas para otros equipos ni para jugadores.

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

**Fuera de alcance:** iniciar 2027–28, nuevo calendario, draft, renovaciones, decisiones de jugadores u otros equipos, liberaciones, mercado de verano, progresión y retiros. La continuidad jugable necesitará además reglas financieras para el nuevo año, atributos por temporada y consultas históricas independientes del año actual.

## Verificación local

```sh
bun scripts/test-offseason-entry-postgres.ts
bun scripts/test-offseason-contracts-postgres.ts
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
