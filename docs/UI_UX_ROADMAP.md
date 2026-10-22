# UI/UX: una mesa de trabajo para el GM

**Estado:** etapa 1 en curso: muestra ajustada aprobada; primera aplicación de la base visual al juego implementada, pendiente de revisión con una partida autenticada.
**Fecha:** 2026-10-22.

Conservar la claridad y el minimalismo actuales, pero pasar de un dashboard administrativo a un juego de gestión deportiva. La prioridad no es agregar decoración: es mantener visible el contexto necesario para decidir y dar protagonismo a la franquicia y sus jugadores.

## Por dónde empezar

1. Validar una muestra visual pequeña: navegación, una tarjeta, una fila y sus estados.
2. Ajustar colores de interacción, superficies y densidad sin cambiar los flujos.
3. Usar el roster como primera pantalla de trabajo con selección y contexto persistente.
4. Extender los patrones que funcionen a las demás secciones, una por entrega.

No se propone reemplazar shadcn, incorporar una biblioteca visual ni rediseñar todo de una vez.

### Primera entrega: muestra aprobada

Con `bun run dev`, abrir `/ui-preview`. La ruta solo está disponible en desarrollo y no requiere una partida: utiliza jugadores y cifras ficticios identificados como muestra. Si el servidor conserva el CSS anterior, reiniciarlo antes de comparar.

- Alternar **Current tokens / Proposed tokens**, claro/oscuro y cualquiera de las 30 franquicias. La comparación usa el mismo contenido de muestra; no reproduce toda la pantalla actual del roster.
- Revisar navegación abierta/contraída/móvil, tarjeta y filas. Probar hover, pulsación, Tab y selección con Espacio; los ejemplos deshabilitado y pendiente no ejecutan acciones.
- La propuesta conserva el color primario de franquicia, neutraliza fondos secundarios/de interacción y separa selección de hover mediante fondo, marca lateral y check. La comparación conserva los tokens históricos en **Current tokens**; salir de la ruta elimina sus atributos de tema.

**Ajuste aprobado:** conservar los botones redondeados y las tarjetas actuales, incluidos radios, espaciado y contorno. Las fotos de las filas pasan de 36 a 48 px para mejorar el reconocimiento sin volver a los 64 px originales. Se mantienen los fondos de interacción y los estados diferenciados de la propuesta. El usuario aprobó esta dirección para comenzar su aplicación al juego; no supone aceptar las siguientes etapas.

Capturas de referencia: [actual claro](images/ui-ux-stage-1/current-light.png), [propuesta clara](images/ui-ux-stage-1/proposed-light.png), [actual oscuro](images/ui-ux-stage-1/current-dark.png), [propuesta oscura con foco y selección](images/ui-ux-stage-1/proposed-dark-focus.png) y [propuesta móvil](images/ui-ux-stage-1/proposed-mobile.png).

**Verificación de esta entrega:** muestra recorrida en Chrome a 1440×900, 1280×720 y 390×844; reflow a 720×450 y movimiento reducido, sin desbordamiento horizontal de página (la tabla móvil tiene scroll horizontal). Selección por teclado y cierre de navegación móvil con Escape comprobados. Se midieron 840 pares/estados: 14 comprobaciones por franquicia y tema, incluyendo hover primario y foco. Los textos evaluados alcanzan 4.5:1 y el indicador de foco 3:1. No es una declaración de conformidad de toda la aplicación.

El hover original `primary/80` incumplía 4.5:1 en 13 combinaciones, aunque los 60 pares primarios sólidos pasaban. La propuesta mantiene el fondo primario opaco y añade subrayado al hover; el componente global todavía no cambia.

**Pruebas:** 18 regresiones enfocadas pasan, incluidos tres tests nuevos de la muestra; TypeScript y Biome de los archivos de implementación pasan. La suite completa termina con 428 tests aprobados, cuatro fallidos y una suite que no carga: formato horario español, falta de `QueryClientProvider` en tests de traspasos y mock de iconos incompleto en dashboard. Sus fuentes coinciden con `HEAD` y no se modificaron. `bun biome check` global falla por el salto de línea final de `.engram/manifest.json`, también fuera de esta entrega.

**Pendiente:** captura del roster autenticado, zoom real al 200 %, lector de pantalla y recorridos completos. La etapa 1 completa todavía no se considera aceptada.

### Segunda entrega: base visual aplicada al juego

- Tokens neutrales de superficie, interacción y foco bajo el tema de franquicia activo. Se conservan los colores primarios y de gráficos; login, carrera y creación de partidas sin tema activo conservan sus estilos. Los menús en portales heredan el mismo tema.
- Hover primario opaco con subrayado, estado pulsado, foco de 2 px y navegación activa con marca lateral y mayor peso tipográfico. Se conserva la geometría de `Button` y `Card`, y se respeta movimiento reducido.
- Fotos de 48 px en `RosterTable`, compartida por roster y Liga. No se cambian navegación de filas, cortes, selección ni composición de pantallas; la densidad adicional queda para la etapa del roster.
- `/ui-preview` mantiene la comparación histórica sin aplicar los estilos nuevos a **Current tokens**.

**Verificación:** 17 pruebas enfocadas pasan, incluidas cuatro regresiones nuevas sobre las 30 franquicias en ambos temas, aislamiento/limpieza del tema y tamaño de foto con navegación conservada. TypeScript pasa. En Chrome se comprobaron 720 pares de tokens con el selector real del juego sobre la muestra: nueve pares de texto y tres de foco por franquicia y tema; mínimos de 4.53:1 y 7.03:1 respectivamente. Hover primario opaco/subrayado, foco de 2 px y movimiento reducido comprobados. La muestra no desborda horizontalmente a 1440×900, 1280×720, 390×844 y 720×450. Estas mediciones no validan los recorridos ni las capturas de una partida autenticada.

**Pruebas globales:** 432 tests aprobados, cuatro fallidos y una suite que no carga, con los mismos fallos descritos en la primera entrega. Biome global sigue fallando únicamente por el salto de línea final de `.engram/manifest.json`; los archivos de implementación modificados pasan. `globals.css` está excluido de Biome y se comprobó por separado en Chrome.

## Alcance y evidencia

Se revisaron la captura del roster, el layout compartido, los tokens de tema, los componentes base y el código de dashboard, roster, liga, ficha de jugador, agencia libre, traspasos y calendario.

- **Verificado visualmente en la revisión inicial:** únicamente lo visible en la captura proporcionada del roster. La verificación posterior de la muestra aislada se describe arriba; no amplía la evidencia sobre otras pantallas reales.
- **Verificado en código:** estructura, estilos declarados, ubicación de controles y comportamiento de selección/navegación de las secciones anteriores.
- **Pendiente de validar en navegador:** apariencia de los hovers, tamaños reales en otros dispositivos, contraste efectivo, comportamiento de scroll y recorridos completos con una partida autenticada.

Las recomendaciones son propuestas de diseño, no defectos visuales medidos en todas las pantallas. Este documento no sustituye las funcionalidades pendientes del MVP ni implica cambiar reglas del juego.

## Diagnóstico

| Prioridad | Hallazgo y evidencia | Consecuencia | Cambio propuesto |
| --- | --- | --- | --- |
| Alta | Los temas asignan colores sólidos de franquicia a `primary`, `secondary` y `accent`. `SelectItem` usa `accent` para el elemento enfocado. | La identidad del equipo también determina fondos de interacción; según la franquicia pueden resultar demasiado intensos. | Separar el acento de marca de los fondos suaves de interacción. No atribuir todos los hovers al mismo token: botones y filas usan también `muted` e `input`. |
| Alta | `Card` incorpora `ring-1`, `rounded-2xl`, `py-6` y `gap-6`; el roster añade padding en su contenido. Las clases `border-border/50` no sustituyen ese ring. | Mucho espacio vertical y contornos repetidos entre tarjetas, tabla y filas; se ven pocos jugadores a la vez. | Definir densidad para pantallas de trabajo y una sola delimitación por superficie, conservando separadores necesarios. |
| Alta | El roster coloca cuatro tarjetas antes de la tabla; las fotos son de 64 px y las celdas tienen padding vertical. | El resumen consume buena parte de la pantalla y desaparece al recorrer la plantilla. | Resumen compacto, ficha de selección y lista más densa con scroll propio en escritorio. |
| Alta | `RosterTable` navega a otra página al pulsar una fila y no tiene selección de jugador. | Comparar exige entrar y salir de fichas. La fila con `onClick` tampoco ofrece una acción nativa equivalente por teclado. | Selección explícita sin navegar y enlace separado a la ficha completa. |
| Alta | En agencia libre, `OfferForm` se renderiza después de todos los candidatos. | La acción de ofertar puede abrir contenido fuera de la zona visible. | Lista y panel de negociación próximos, manteniendo a la vista candidato, presupuesto y formulario. |
| Media | En traspasos, el resumen y su validación aparecen después de los dos inventarios completos. | La selección de activos queda alejada de su impacto salarial y de la acción final. | Resumen compacto persistente y detalle completo bajo demanda. |
| Media | El header no declara posición persistente; fecha y simulación viven en la sidebar y parte del contexto se oculta cuando se contrae. El layout usa altura mínima, no un área de trabajo acotada. | No hay un contrato explícito sobre qué contexto permanece visible y qué región hace scroll. | Definir ese contrato por tipo de pantalla; no fijar todas las páginas indiscriminadamente. |
| Media | Hay textos de tabla/ficha en español sin catálogo y textos de traspasos en inglés, junto con secciones traducidas. El roster concatena ciudad y nombre, como el “Chicago Chicago Bulls” de la captura. | Se percibe como un conjunto de piezas, no como un producto consistente. | Normalizar nombres, moneda, temporadas y textos mediante los catálogos existentes. |
| Media | El header muestra una campana con punto permanente y sin acción declarada; las noticias del dashboard usan textos fijos del catálogo. | La presentación sugiere novedades reales aunque esos elementos no dependen de eventos de la partida. | Identificar contenido de muestra o retirarlo hasta que exista el flujo; no añadir un sistema de noticias en este trabajo. |

## Dirección visual propuesta

**Concepto: oficina de franquicia con lenguaje de retransmisión deportiva.** Datos sobrios, jerarquía clara y algunos elementos expresivos; no una interfaz de consola copiada literalmente.

| Elemento | Criterio |
| --- | --- |
| Superficies | Fondo y paneles ligeramente diferenciados; evitar que cada bloque necesite borde, ring y sombra a la vez. |
| Bordes y radios | Conservar los botones redondeados y las tarjetas actuales, con sus radios, espaciado y contorno. Mantener separadores discretos; no reducir radios para aumentar la densidad. |
| Identidad | Logo, fotografía, dorsal y un acento de franquicia en cabeceras y selección. La estructura debe reconocerse como The Association incluso al cambiar de equipo. |
| Color | Marca para identidad/acción principal; fondos neutrales o tintes suaves para hover; colores semánticos estables para éxito, advertencia y error. El rojo de Chicago no debe significar automáticamente peligro. |
| Tipografía | Nombres y cifras importantes con jerarquía deportiva; datos secundarios más tranquilos. Cifras alineadas y tabulares para comparar salarios y resultados. Reutilizar las fuentes existentes antes de agregar otras. |
| Densidad | Compactar tablas y resúmenes sin comprimir todas las tarjetas ni reducir texto o áreas táctiles. Fotografías grandes en la ficha; probar 48 px en las filas para conservar el reconocimiento. |
| Movimiento | Transiciones breves para selección y feedback, sin desplazamientos que dificulten leer o comparar; respetar movimiento reducido. |

Estados que deben distinguirse: **reposo, hover, foco de teclado, selección, pulsado, deshabilitado y pendiente**. Hover y selección no pueden verse iguales. El foco debe seguir siendo evidente aunque se suavicen los bordes.

Se conservan los radios existentes de botones y tarjetas. La paleta de la muestra ajustada está aprobada; la composición del roster sigue pendiente de su propia entrega. No se asume un modo oscuro obligatorio: se conservan claro y oscuro.

## Roster: primer flujo a rediseñar

### Composición de escritorio

```text
┌ Navegación · Franquicia · Temporada · Fecha · Simulación ┐
├ Roster · 14/15 standard · Two-way · Payroll · Cap · Apron ┤
├ Foto · Nombre · Dorsal · Posición · Datos del contrato   ┤
│                                 [Ver ficha] [Acciones] │
├ Cabecera de columnas persistente                       ┤
│ Lista de jugadores                                     │
│ Solo esta región tiene scroll vertical                 │
│ Fila seleccionada diferenciada del hover               │
└────────────────────────────────────────────────────────┘
```

Es un esquema de jerarquía, no un mockup a escala. La ficha superior debe ser compacta: mantener el contexto no sirve si deja espacio para solo dos filas.

### Comportamiento propuesto

- Seleccionar un jugador actualiza la ficha superior sin cambiar de página ni mover el scroll de la lista. Seleccionar no equivale a ejecutar una acción.
- Seleccionar inicialmente el primer jugador visible con un orden estable. Si no hay jugadores, mostrar un estado vacío; no una ficha anterior.
- Permitir comparación secuencial con la misma estructura y posición de datos al cambiar de jugador. Una comparación simultánea de dos jugadores queda fuera de esta primera entrega.
- Mantener el resumen del equipo separado del contrato individual: no confundir payroll/cap con salario del jugador.
- Mostrar solo datos disponibles: foto con fallback, nombre, dorsal, posición, medidas/experiencia y contrato. No inventar ratings, estadísticas o proyecciones.
- Ofrecer un enlace nativo a la ficha completa. Mantener acceso directo a esa ruta y el regreso al equipo de origen.
- Hacer la selección accesible con controles nativos dentro de la tabla, estado anunciado y foco visible. No convertir la tabla en un grid ARIA salvo que se implemente todo su patrón de teclado.
- Conservar las confirmaciones, restricciones y estados pendientes de cortar jugadores. La acción no debe propagarse como selección o navegación accidental.
- Si una actualización, un corte o un cambio de equipo elimina al seleccionado, seleccionar otro jugador válido o limpiar la ficha. Nunca mostrar datos del jugador anterior por error.
- En una actualización normal, preservar selección y posición cuando el jugador siga existiendo. Al cambiar de partida no reutilizar una selección ajena.

### Scroll y adaptación

- En escritorio con altura suficiente, acotar el área de trabajo al espacio disponible bajo el header; usar una única región vertical de lista y cabecera de tabla persistente.
- Revisar toda la cadena de contenedores flex, alturas mínimas y `overflow`. Añadir `sticky` solo a la ficha no resuelve por sí mismo el layout actual.
- Evitar que `overflow-hidden` de tarjetas recorte foco, menús o contenido. Los diálogos deben conservar su comportamiento habitual.
- En móvil, ventanas bajas y zoom elevado, volver a un flujo de página natural con ficha compacta o detalle desplegable. No forzar la composición de escritorio ni encerrar al usuario en varios scrolls verticales.
- Mantener nombre/selección accesibles cuando una tabla necesite scroll horizontal. El detalle debe permitir consultar los datos que se oculten por ancho.

**Criterio de éxito:** recorrer toda la plantilla y consultar varios jugadores sin perder el resumen del equipo, navegar obligatoriamente fuera de la lista ni provocar saltos de posición.

## Aplicación a las otras secciones

| Sección | Fricción observada en código | Propuesta acotada y comprobación |
| --- | --- | --- |
| Dashboard | Payroll ocupa dos columnas; siguiente partido y alertas compiten con tarjetas de noticias fijas. | Priorizar situación deportiva, próximo partido y decisiones reales. Verificar que cada bloque informativo corresponda a datos de la partida o esté identificado como muestra. |
| Liga | Selector de equipo y roster están en tarjetas separadas; reutiliza la tabla con navegación directa. | Mantener equipo consultado y selección visibles mientras se explora el roster. Conservar `teamId` en URL y retorno desde ficha; sin acciones de gestión sobre equipos ajenos. |
| Ficha de jugador | Cabecera fotográfica grande, contrato y una tarjeta de scouting sin estadísticas; textos y enlaces presentan inconsistencias. | Alinear la identidad con la ficha compacta, conservar el detalle contractual y separar claramente “sin datos” de “función no disponible”. Usar un solo elemento interactivo por enlace, no botón dentro de enlace. |
| Agencia libre | Introducción extensa, resumen en tarjetas, lista completa y formulario al final. | Exploración y negociación en la misma zona de trabajo en escritorio; detalle accesible en móvil. Tras elegir candidato, el formulario y su contexto deben quedar visibles. Conservar borrador cuando corresponda y todos los bloqueos por oferta pendiente/actualización. |
| Traspasos | Dos listas largas antes del resumen, validación y ejecución. | Mantener visibles cantidades seleccionadas, impacto y legalidad; detalle expandible. Poder seleccionar y quitar activos de ambos equipos sin perder el resumen ni debilitar la validación existente. |
| Calendario | Grilla con ancho mínimo y scroll horizontal; cambia de componente al avanzar el mes simulado. | Diferenciar día simulado, mes consultado y día seleccionado. Evaluar agenda en móvil y acceso “hoy”; validar qué ocurre con la navegación manual al simular. Conservar resultados y diálogo del día. |

No todas las secciones necesitan panel fijo: dashboard y ficha completa pueden mantener scroll de página. La persistencia se aplica donde acompaña una decisión repetida.

## Plan de entregas

Cada etapa requiere revisión antes de avanzar; una etapa no equivale a un único cambio masivo.

### 1. Base visual e identidad — sin cambiar flujos

- [x] Capturar estados actuales y preparar una muestra pequeña en claro y oscuro.
- [x] Validar colores, superficies, contornos, radios, tipografía y densidad de esa muestra.
- [ ] Separar marca de interacción en los tokens existentes; revisar también sus consumidores fuera del dashboard.
- [ ] Ajustar navegación, botones, tarjetas y filas en entregas pequeñas, sin retirar foco ni información.
- [ ] Corregir nombres duplicados y textos de las superficies modificadas con los catálogos existentes.

**Aceptación:** mismo lenguaje visual en navegación, tarjeta y tabla; hover suave, selección inequívoca y foco visible. Revisar Chicago, Boston, Lakers y Brooklyn/San Antonio como muestra de rojo, verde, amarillo y neutros, y comprobar los pares de color finales de las 30 franquicias. No declarar accesibilidad por comentarios previos del CSS.

### 2. Shell del juego — contexto persistente

- [ ] Definir qué permanece visible: franquicia, fecha simulada, temporada y acceso a simulación.
- [ ] Revisar jerarquía de avanzar día/mes/temporada sin ponerlos todos al mismo nivel ni perder pausa, progreso y errores.
- [ ] Resolver sidebar expandida, contraída y móvil sin ocultar información esencial de simulación.
- [ ] Definir pantallas de trabajo acotadas frente a pantallas con scroll natural; no aplicar un bloqueo global de altura.
- [ ] Revisar señales que aparentan funcionalidad, como el punto permanente de notificaciones.

**Aceptación:** contexto y estado de simulación disponibles en los tres modos de navegación; header y contenido no se superponen. No implementar notificaciones para justificar un icono.

### 3. Roster — selección y comparación secuencial

- [ ] Sustituir las cuatro tarjetas altas por un resumen compacto sin perder standard/two-way, cargos retenidos ni estados financieros.
- [ ] Incorporar ficha superior y selección de jugador con enlace separado al detalle.
- [ ] Reducir altura de filas, mantener cabecera de tabla y limitar el scroll en escritorio.
- [ ] Resolver teclado, vacío, carga, error, datos desconocidos y selección después de actualizaciones/cortes.
- [ ] Revisar el otro consumidor de `RosterTable`: Liga debe conservar navegación y comportamiento esperado hasta su propia adaptación.
- [ ] Validar en navegador y agregar regresiones de selección y acciones existentes.

**Aceptación:** cumplir el criterio de éxito del roster a 1440×900 y 1280×720; validar también 390×844 y zoom al 200 %, sin recortes ni trampas de scroll/foco. Confirmar cantidades con datos reales, no con alturas supuestas.

### 4. Extensión por sección — después de validar el roster

- [ ] Agencia libre: acercar lista, selección y formulario; separar actividad/ofertas del flujo principal.
- [ ] Traspasos: resumen persistente y selección de activos sin viajes constantes al final.
- [ ] Liga y ficha: reutilizar el lenguaje visual y preservar contexto de navegación.
- [ ] Dashboard y calendario: priorizar información real y revisar adaptación a pantallas pequeñas.

**Aceptación:** cada entrega resuelve un recorrido concreto de la tabla anterior y conserva sus reglas y estados de error; no copiar el layout del roster donde no ayude.

## Límites técnicos y verificación

Reutilizar componentes, fotos, logos, catálogos y consultas existentes. Mantener presentación en `src/app`/`src/components` y estado/orquestación en Application; sin modificar reglas de negocio, contratos de API ni esquema de base de datos por motivos visuales. Reutilizar Zustand con selectores solo si la interacción necesita estado global; no introducir persistencia o infraestructura nueva para una selección local.

Los cambios a `Card`, `Button` y tokens globales también alcanzan login, creación de partidas y carrera. Preferir ajustes acotados cuando el cambio de densidad sea exclusivo de una pantalla de trabajo.

### Comprobaciones por entrega

- [ ] Capturas antes/después en claro y oscuro, con sidebar abierta, contraída y móvil.
- [ ] Contraste medido: 4.5:1 en texto normal y 3:1 en texto grande e indicadores esenciales de controles. Estados no comunicados solo por color.
- [ ] Recorrido por teclado, foco no recortado/oculto, nombres de botones, retorno de foco en diálogos y lectura del panel actualizado.
- [ ] Pantalla pequeña, ventana baja, zoom al 200 % y movimiento reducido.
- [ ] Carga, error, lista vacía, nombres largos, ausencia de foto y salarios/garantías desconocidos. No convertir “desconocido” en cero o en una certeza negativa.
- [ ] Regresiones de selección sin navegación, enlace al detalle/regreso, invalidación tras un corte y aislamiento entre equipos/partidas.
- [ ] Mantener confirmaciones de corte y bloqueos de simulación, actualización de mercado, oferta pendiente y ejecución de traspaso.
- [ ] Ejecutar `bun biome check` y las pruebas relevantes existentes. Biome excluye `globals.css`: una ejecución verde no valida colores ni CSS.

### Puntos de entrada para implementar

| Área | Archivos principales |
| --- | --- |
| Tokens y tema | `src/app/globals.css`, `src/components/theme/team-theme-applier.tsx`, `src/domain/constants/team-colors.ts` |
| Componentes compartidos | `src/components/ui/{card,button,badge,sidebar,select,dropdown-menu}.tsx` |
| Shell | `src/app/(protected)/games/[gameId]/dashboard/layout.tsx`, `src/components/dashboard/layout-components.tsx` |
| Roster y consumidores | `src/components/roster/roster-table.tsx`, `src/components/roster/release-player-button.tsx`, páginas `dashboard/roster/page.tsx` y `dashboard/league/page.tsx` |
| Mercado | `src/components/free-agency/{market-screen,offer-form,offer-results}.tsx` |
| Traspasos | `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx`, `src/components/trades/{trade-asset-panel,trade-summary}.tsx` |
| Dashboard, ficha y calendario | Páginas `dashboard/page.tsx`, `dashboard/player/[id]/page.tsx`, `dashboard/schedule/page.tsx`; `src/components/games/Calendar.tsx` |
| Regresiones existentes | `tests/components/{rosterPage,releasePlayer,freeAgencyMarket}.test.tsx`, `src/components/roster/roster-table.test.tsx`, `tests/components/i18n/game-and-dashboard.test.tsx` |

## Fuera de alcance por ahora

Comparación simultánea de jugadores, ratings/scouting nuevos, noticias/notificaciones reales, nuevas reglas de mercado, rediseño de onboarding/carrera, animaciones complejas, navegación de mando, virtualización y dependencias nuevas. Ninguna de estas funcionalidades es necesaria para comprobar si el nuevo roster mejora la experiencia.

**Siguiente paso recomendado:** revisar la base visual aplicada con una partida autenticada, incluyendo menús, ambos temas y navegación abierta/contraída/móvil. Completar la etapa 1 antes de redistribuir el shell o el roster.
