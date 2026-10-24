# Postemporada hasta el campeón

La clasificación y el play-in existentes continúan hacia un cuadro fijo de 16 equipos. Cada serie termina al llegar a cuatro victorias; las Finales guardan campeón y subcampeón sin cambiar el año de la partida.

## Instalación y partida existente

1. Después de `049`–`051`, aplicar manualmente **solo** `scripts/migrations/052_playoff_series.sql`. No ejecutar `scripts/schema.sql` sobre una base existente.
2. Abrir **Postemporada** para consultar el estado y el cuadro. La instalación y las consultas no avanzan la partida.
3. Usar el avance diario o por temporada para continuar. Una partida detenida con el play-in resuelto prepara la primera ronda en su próximo avance; no necesita reiniciarse.

El usuario confirmó que la partida de referencia `8d2d44b9-9634-4a74-94fc-0732825122e8` continuó desde el 19 de abril hasta el cierre del 10 de junio de 2027. Su equipo, 13.º, quedó eliminado, pero la liga completó los playoffs. La captura muestra el cierre con campeón registrado y el avance bloqueado, sin cambio de temporada. El agente no aplicó migraciones ni modificó datos remotos.

## Reglas de esta entrega

| Tema | Comportamiento |
| --- | --- |
| Cuadro | En cada conferencia: 1–8 y 4–5 alimentan una semifinal; 2–7 y 3–6, la otra. No se reordenan los equipos. |
| Duración | Cuatro rondas al mejor de siete. Solo se programa el siguiente partido necesario; no hay encuentros posteriores a la cuarta victoria. |
| Localía | Mejor seed de playoffs en rondas de conferencia; formato 2–2–1–1–1. |
| Finales | Ventaja de campo por porcentaje de victorias de la fase regular; empate por victorias entre finalistas, diferencial regular y sorteo ya persistido, en ese orden. |
| Calendario | Dos días entre partidos, con un día de descanso. La primera ronda comienza dos días después de la preparación, nunca antes de finalizar el play-in. Las rondas posteriores esperan a que termine toda la ronda anterior. No reproduce las fechas de retransmisión de la NBA. |
| Cierre | Campeón y subcampeón persistentes; nuevos avances son operaciones sin efecto. Sin draft, agencia libre ni cambio de temporada. |
| Estadísticas | Selector separado de fase regular, play-in y playoffs en Plantilla y Liga. Finales incluidas en playoffs. Los partidos sin box score conservan su aviso de cobertura. |

## Persistencia y seguridad

`postseason_series` guarda participantes, posición fija, victorias y ganador. `postseason_series_games` vincula cada número de partido con su encuentro del calendario. `postseason_results` conserva el resultado de las Finales. Las tablas tienen RLS y lectura exclusiva del propietario, sin escrituras del cliente.

`advance_simulation_day` mantiene el bloqueo de la partida y la fecha esperada: reintentos y avances simultáneos no duplican partidos. Resultados, box scores, rondas y fecha se confirman en la misma transacción. Reutiliza el motor por posesiones v2; las partidas antiguas conservan el motor sin box score. La postemporada no modifica la clasificación regular ni ejecuta su mercado de agentes libres.

`get_postseason_state` es una consulta autenticada de solo lectura. Devuelve fase, clasificación congelada, seeds finales, series, encuentros y campeón. Un equipo eliminado no detiene la liga; solo un campeón confirmado señala el cierre.

## Verificación

```sh
bun scripts/test-postseason-qualification-postgres.ts
bun run test
bun run typecheck
bun biome check
bun run build
```

El runner PostgreSQL utiliza un contenedor desechable sin red externa ni credenciales. Comprueba continuidad desde el play-in existente, cuatro rondas, box scores, reintentos, aislamiento y conservación del historial. Las dos temporadas completas pueden superar dos minutos; si se ejecuta desde una herramienta con límite de tiempo, reservar al menos diez minutos.

**Comprobado localmente:** ambas temporadas de prueba llegan al campeón; dos conexiones compiten por cada día, incluidos los seis cambios de ronda. Tres fallos inyectados comprueban rollback completo antes de reintentar. También se verifican barrido, séptimo partido, localías, desempates de Finales y aislamiento. La suite de interfaz/repositorios suma 762 tests en 112 archivos; TypeScript, Biome (382 archivos), build y esquema canónico desde cero pasan.

**Aceptación manual parcial (2026-10-25):** el usuario confirmó el recorrido hasta el cierre con el equipo eliminado. Queda comprobar el cuadro y el campeón mostrado, y contrastar las tres fases de estadísticas con sus box scores: la captura del cierre no verifica esas vistas. No recalcular encuentros ni reiniciar la partida.
