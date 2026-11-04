# Revisión legal preliminar para una publicación pública

**Fecha de revisión:** 29 de octubre de 2026.
**Estado:** análisis de planificación; no constituye asesoramiento jurídico ni autorización de publicación.

Publicar el juego gratis, sin publicidad y con una licencia open source **no elimina los derechos de terceros**. Antes de publicar con contenido real, hace falta revisar las fuentes, los permisos y la jurisdicción aplicable. No se ha estimado la probabilidad de recibir reclamos.

## Conclusión práctica

La alternativa de menor exposición identificada es publicar el motor y el código propio bajo MIT, con una liga, jugadores, escudos e imágenes ficticios u originales. Se pierde autenticidad NBA, pero se reduce buena parte de los conflictos identificados.

Conservar contenido real requiere una revisión profesional de propiedad intelectual y verificar permisos de uso, exhibición y redistribución. Esta recomendación no implica que el proyecto haya decidido reemplazar ese contenido.

## Riesgos por tipo de contenido

| Contenido | Riesgo a revisar |
|---|---|
| Logos de NBA y equipos | Marcas y posibles derechos de autor. Una URL pública no autoriza incorporarlos al juego. |
| Fotografías de jugadores | Derechos sobre la fotografía y posibles derechos de imagen del jugador; pueden requerir autorizaciones distintas. |
| Nombres e identidades reales | Posibles derechos de imagen, identidad o *publicity*, según la jurisdicción y el uso concreto dentro del juego. No es solamente un asunto de copyright. |
| Estadísticas, salarios y plantillas | Los hechos aislados suelen tener menor protección por copyright. La extracción y reutilización pueden involucrar condiciones contractuales, derechos sobre bases de datos y otras normas. |
| Ratings de NBA 2K | Son valoraciones elaboradas para otro producto, no simples hechos deportivos observables. No asumir que son estadísticas libres. |
| Nombre, dominio y presentación del juego | Usar NBA como marca del producto plantea cuestiones distintas de mencionarla descriptivamente; revisar posibles confusiones sobre afiliación o patrocinio. |

Cargar imágenes desde servidores ajenos, en lugar de almacenarlas, no es una solución legal confiable. También debe inventariarse el contenido incluido en el repositorio, fixtures, exportaciones y prototipos.

## Fuentes identificadas en el código

| Fuente o recurso | Referencias del proyecto | Situación pendiente |
|---|---|---|
| CDN de NBA: logos | `src/infrastructure/repositories/SupabaseTeamRepository.ts` | Verificar autorización de uso de marcas e imágenes. |
| NBA y ESPN: fotografías | `src/infrastructure/repositories/SupabasePlayerRepository.ts` | Verificar derechos sobre fotografías e imagen de jugadores. |
| ESPN: plantillas | `src/infrastructure/roster/espnRosterSource.ts` | Revisar términos aplicables al acceso automatizado y a la reutilización pública. |
| Basketball-Reference: contratos | `src/infrastructure/contracts/basketballReferenceContractSource.ts` | Confirmar por escrito si el uso concreto está permitido. |
| NBA: jugadores two-way y agentes libres | `src/infrastructure/contracts/nbaGLeagueTwoWaySource.ts`, `src/infrastructure/freeAgency/nbaFreeAgentSource.ts` | Revisar permisos y condiciones aplicables. |
| NBA2K API: atributos y ratings | `src/infrastructure/ratings/nba2kRatingsSource.ts` | Aclarar derechos sobre los datos de origen, además de los del proveedor de la API. |
| Spotrac: referencia de excepciones contractuales | `src/infrastructure/contracts/curatedContractStatusExceptions.ts` | Revisar el alcance del uso y las condiciones correspondientes. |

Este inventario es preliminar, no una auditoría exhaustiva ni una confirmación del contenido actualmente desplegado.

### Basketball-Reference / Sports Reference

La [política de uso de datos](https://www.sports-reference.com/data_use.html) indica que no deberían crearse sitios o herramientas basados en datos extraídos de sus sitios sin permiso.

Hay un matiz relevante: la sección 5 de sus [términos de uso](https://www.sports-reference.com/termsofuse.html) también admite determinados usos de datos de páginas individuales, sujetos a atribución y restricciones, especialmente respecto de bases o servicios sustitutivos. No corresponde interpretar esto como una prohibición absoluta de cualquier reutilización ni como autorización general para importar contratos al juego.

**Acción:** describir las páginas consultadas, volumen, frecuencia, almacenamiento, exhibición y redistribución previstos, y solicitar confirmación escrita. Respetar límites técnicos de acceso no sustituye la revisión de derechos.

### NBA y ESPN

Los [términos de NBA](https://www.nba.com/termsofuse) reservan derechos sobre contenidos y marcas; no ofrecen una autorización general para incorporarlos a juegos.

Que un endpoint de NBA o ESPN responda sin clave demuestra accesibilidad técnica, no permiso para publicar o redistribuir su contenido. La revisión de términos específicos de ESPN y de cada recurso queda pendiente.

### NBA2K API

El [README del proveedor](https://github.com/wkoverfield/nba2kapi) declara MIT, identifica a [2kratings.com](https://www.2kratings.com/) como fuente y aclara que el proyecto no está afiliado a NBA ni a 2K.

Esto no demuestra que el proveedor pueda sublicenciar todos los derechos sobre los ratings originales. Deben distinguirse la licencia del software, las condiciones del servicio y los derechos sobre el conjunto de datos. No se verificó una autorización de los titulares originales.

## Qué resuelven MIT y la gratuidad

- MIT permite licenciar el código sobre el que se tienen derechos; no concede derechos ajenos sobre datos, fotos, marcas o identidades.
- Cambiar MIT por GPL u otra licencia open source no soluciona los permisos de terceros.
- Separar expresamente el código propio del contenido de terceros aclara el alcance de la licencia, pero no autoriza a distribuir ese contenido.
- Avisos como “proyecto de fans”, “sin fines de lucro” o “derechos de sus respectivos dueños” no sustituyen permisos.
- La gratuidad puede influir en ciertos análisis jurídicos, pero no constituye una exención general.

## Checklist antes de publicar

- [ ] Identificar país de residencia u operación, público objetivo y jurisdicciones relevantes con asesoramiento profesional.
- [ ] Inventariar datos, imágenes, marcas y otros contenidos del sitio, repositorio, fixtures, prototipos y archivos descargables.
- [ ] Registrar para cada recurso su origen, titular conocido, licencia, atribución exigida y evidencia de autorización.
- [ ] Revisar condiciones de acceso automatizado, almacenamiento, exhibición y redistribución de cada proveedor.
- [ ] Resolver derechos de fotografías, identidades de jugadores y marcas por separado.
- [ ] Aclarar los permisos sobre los ratings de origen o sustituirlos por valoraciones propias con procedencia documentada.
- [ ] Revisar nombre público, dominio, identidad visual y avisos de no afiliación.
- [ ] Definir qué archivos cubre MIT y qué materiales tienen condiciones distintas; retirar los que no se puedan distribuir.
- [ ] Obtener revisión jurídica del uso concreto antes de lanzar con contenido real.
- [ ] Revalidar términos y permisos al momento de publicar; pueden cambiar respecto de esta revisión.

## Consecuencias posibles y límites del análisis

Los problemas pueden incluir bloqueo de acceso a las fuentes, pedidos de retirada, baja del hosting o reclamos económicos. No se puede estimar su probabilidad con la información disponible.

Quedan pendientes la jurisdicción aplicable, contratos o permisos que pudieran existir, una auditoría exhaustiva de assets y el análisis de excepciones o defensas legales. Los términos de un proveedor expresan sus condiciones y pretensiones; no determinan por sí solos el alcance de la ley ni su exigibilidad en cada caso.

**Próximo paso si se decide publicar:** completar el inventario y llevarlo, junto con una descripción del funcionamiento del juego y sus fuentes, a un abogado especializado en propiedad intelectual.
