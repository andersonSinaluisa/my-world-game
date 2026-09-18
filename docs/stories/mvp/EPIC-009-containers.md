# EPIC-009 — Containers

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [INVENTORY_SYSTEM](../../architecture/INVENTORY_SYSTEM.md) · [INTERACTION_SYSTEM](../../architecture/INTERACTION_SYSTEM.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [INPUT_SYSTEM](../../architecture/INPUT_SYSTEM.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md)

## Objetivo del epic
Que los muebles con `container` (nevera, alacena, caja de juguetes, armario, cesta de ropa, buzón, expositor refrigerado) se abran y cierren con un toque, acepten objetos soltados en su interior y los devuelvan al arrastrarlos, al estilo casa de muñecas: el interior se ve en el mundo, sin rejillas ni popups. Todo con los componentes `states` + `openable` + `container` y las reglas `tap_open` y `store_in_container`.

## Historias
- [HU-GAME-034 — Abrir y cerrar muebles](#hu-game-034--abrir-y-cerrar-muebles)
- [HU-GAME-035 — Guardar objetos en contenedores](#hu-game-035--guardar-objetos-en-contenedores)
- [HU-GAME-036 — Sacar objetos de contenedores](#hu-game-036--sacar-objetos-de-contenedores)

---

## HU-GAME-034 — Abrir y cerrar muebles

> **Status:** Draft
> **Epic:** EPIC-009 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-009 — Containers

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **tocar la nevera, el armario o la caja de juguetes para abrirlos y cerrarlos**
para **ver qué hay dentro**.

### Contexto
Abrir y cerrar es un cambio de `states.current` mediante la acción `toggleOpen`, disparada por la regla `tap_open` sobre cualquier entidad con `openable` ([INVENTORY_SYSTEM §1](../../architecture/INVENTORY_SYSTEM.md), [INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md)). El sprite cambia por `sprite.byState`. La misma regla sirve para puertas con `openable` (efecto visual).

### Reglas de negocio
- R1: Regla `tap_open`: trigger `tap`, target has `openable`, sin condiciones, acción `toggleOpen`, prioridad 10.
- R2: `toggleOpen` alterna `states.current` entre `openable.closedState` y `openable.openState`.
- R3: El sprite se resuelve por `sprite.byState[states.current]`, con fallback a `sprite.asset`.
- R4: **Cerrado = no tocable por dentro:** los objetos de un contenedor cerrado no se renderizan ni son candidatos de hit test.
- R5: Abierto con `showContentsWhenOpen` (default `true`): los objetos se dibujan en `container.slots[i]` (relativos al pivot) en la capa `furnitureBack` + 1.
- R6: Sonido `sounds.open` / `sounds.close` y preset `animations.open` / `animations.close` si el prefab los define.
- R7: Tap sobre un mueble con `openable` y `draggable`: tap si < 250 ms y < 10 dp; drag si se mueve ≥ 6 dp ([INPUT_SYSTEM §2](../../architecture/INPUT_SYSTEM.md)).
- R8: El estado abierto/cerrado se persiste (`states.current`, [SAVE_SCHEMA §2](../../data/SAVE_SCHEMA.md)).

### Criterios de aceptación
```gherkin
Scenario: abrir un contenedor cerrado
  Given una entidad con states { current: "closed" } y openable { openState: "open", closedState: "closed" } (la nevera)
  When el jugador hace tap sobre ella
  Then se resuelve "core:tap_open"
  And states.current es "open"
  And el sprite es sprite.byState.open
  And suena sounds.open

Scenario: cerrar un contenedor abierto oculta su contenido
  Given una nevera abierta con un objeto en el slot 0
  When el jugador hace tap sobre la nevera
  Then states.current es "closed"
  And el objeto del slot 0 no se renderiza y no es candidato de hit test

Scenario: un contenedor cerrado tapa lo que tiene dentro
  Given una nevera cerrada con un objeto dentro
  When el jugador hace tap en el punto donde estaría el slot del objeto
  Then se resuelve "core:tap_open" sobre la nevera, no una interacción con el objeto

Scenario: sin texto y con feedback
  Given un contenedor cerrado
  When el jugador lo toca
  Then hay animación y sonido de apertura y ningún texto

@persistence
Scenario: el estado abierto persiste
  Given que el jugador dejó el armario abierto
  When viaja a otra escena y regresa
  Then el armario sigue abierto
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Tap sobre un contenedor sin `openable` (alacena, cesta de ropa, buzón, expositor): `tap_open` no coincide; tap sin regla → solo la animación `tap` si existe. Ese contenedor está **siempre abierto**: su contenido se ve y se puede tocar ([INTERACTION_SCHEMA §4](../../data/INTERACTION_SCHEMA.md), `isOpen`).
- Taps muy rápidos: cada tap alterna; el audio descarta repeticiones del mismo tipo antes de 80 ms ([AUDIO_SYSTEM §3](../../architecture/AUDIO_SYSTEM.md)).
- Cerrar un contenedor mientras se arrastra algo hacia él: el drop se evalúa con el estado del momento del drop.
- Una puerta `portal` + `openable`: `tap_open` solo cambia el sprite; viajar requiere arrastrar un personaje (EPIC-014).

### Dependencias
- HU-GAME-025: estados y sprites por estado.
- HU-GAME-032: interacciones por tap.

### Consideraciones técnicas
- ContainerSystem (acciones `open`/`close`/`toggleOpen`) y StateSystem ([ECS §5](../../architecture/ECS.md)).
- Hit testing: los objetos de un contenedor **abierto** son candidatos antes que el contenedor ([INPUT_SYSTEM §5](../../architecture/INPUT_SYSTEM.md)).
- Estado: [NEEDED NOW].

### Assets necesarios
- `env_home_fridge_white` / `env_home_fridge_white_open`: nevera cerrada/abierta (placeholder aceptable: sí).
- `env_home_toybox` / `env_home_toybox_open`, `env_home_wardrobe` / `env_home_wardrobe_open` (placeholder: sí).
- `sfx_fridge_open`, `sfx_fridge_close`, `sfx_door_wood_open`, `sfx_door_wood_close` (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `toggleOpen` y regla `tap_open` con tests.
- [ ] Test de hit testing: contenido de contenedor cerrado no tocable.
- [ ] Persistencia de `states.current` probada (AC-PERSIST-01/02).

---

## HU-GAME-035 — Guardar objetos en contenedores

> **Status:** Draft
> **Epic:** EPIC-009 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-009 — Containers

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **meter la comida en la nevera y los juguetes en su caja soltándolos dentro**
para **ordenar la casa y encontrarlos luego donde los dejé**.

### Contexto
Guardar cambia la location del objeto a `container { containerId, slot }` mediante la regla `store_in_container` y la acción `store` ([INVENTORY_SYSTEM §1](../../architecture/INVENTORY_SYSTEM.md), [INTERACTION_SYSTEM §4](../../architecture/INTERACTION_SYSTEM.md)). Los filtros son por tags (`accepts`/`rejects`), no por tipo de objeto.

### Reglas de negocio
- R1: Regla `store_in_container`: trigger `drop`; source has `draggable`, notTags `character`, `furniture`; target has `container`, zona `inside`; condiciones `isOpen`, `containerHasSpace`; acción `store`; prioridad 70; `rejectHint: ui_hint_container_full`.
- R2: `containerHasSpace` pasa si hay un slot libre **y** el source cumple `accepts` (si se define) y no tiene ningún tag de `rejects` (default `['character', 'furniture']`). Además, el motor **siempre** rechaza las entidades con componente `container` ([ENTITY_SCHEMA §5.8](../../data/ENTITY_SCHEMA.md)).
- R3: El objeto va al **primer slot libre** (índice menor). Capacidad `container.capacity` (1..64); `slots.length === capacity`.
- R4: Si el contenedor está **cerrado**, `isOpen` falla y se prueba la siguiente regla; si ninguna pasa se aplica `place` y el objeto se apoya encima o al lado (INTERACTION_SYSTEM §4).
- R5: Contenedor lleno → `interactionRejected(containerFull)`: shake + `sfx_reject_soft` + `place`. Tag no aceptado → `interactionRejected(notAccepted)` + `place`.
- R6: Aceptación del MVP ([MVP_SCOPE](../../product/MVP_SCOPE.md)): nevera `food`/`drink`; caja de juguetes `toy`; armario y cesta de ropa `clothing`.
- R7: Contenedores anidados prohibidos en el MVP: una entidad con `container` nunca se guarda en otro contenedor (regla del motor, [INVENTORY_SYSTEM §1](../../architecture/INVENTORY_SYSTEM.md)).
- R8: Guardar un objeto sostenido lo saca de la mano y lo guarda en **una sola transacción**.
- R9: La comida parcialmente comida se guarda con su `bitesLeft` / `sipsLeft`.
- R10: El contenido persiste: la location `container` se guarda y la escena lo reconstruye al cargar ([SAVE_SCHEMA §4](../../data/SAVE_SCHEMA.md)).

### Criterios de aceptación
```gherkin
Scenario: guardar un objeto en un contenedor abierto
  Given una nevera abierta con capacity 6, accepts ["food","drink"] y los slots 0 y 1 ocupados
  And un objeto con tag "food" en la escena (una manzana)
  When el jugador suelta el objeto sobre la zona "inside" de la nevera
  Then se resuelve "core:store_in_container"
  And el objeto tiene location { kind: "container", containerId: nevera, slot: 2 }
  And se dibuja en container.slots[2]

Scenario: contenedor cerrado
  Given una nevera cerrada
  When el jugador suelta una manzana sobre su zona "inside"
  Then la manzana no entra en la nevera
  And se coloca con "place" encima o al lado de la nevera

Scenario: contenedor lleno
  Given una caja de juguetes abierta con todos sus slots ocupados
  When el jugador suelta un objeto con tag "toy" en su zona "inside"
  Then se emite interactionRejected con reason "containerFull"
  And la caja hace "shake", suena el rechazo suave y se muestra ui_hint_container_full
  And el objeto se coloca con "place" bajo el punto de soltado

Scenario: tag no aceptado
  Given una nevera abierta con espacio
  When el jugador suelta un objeto con tag "clothing" (un zapato) en su zona "inside"
  Then se emite interactionRejected con reason "notAccepted" y el objeto se coloca con "place"

Scenario: contenedor sin openable siempre abierto
  Given una entidad con container { accepts: ["clothing"] } sin openable (la cesta de ropa) con espacio
  When el jugador suelta una prenda sobre su zona "inside"
  Then isOpen pasa y la prenda queda con location container en el primer slot libre

Scenario: un contenedor no entra en otro
  Given una nevera abierta con espacio
  When el jugador suelta sobre su zona "inside" una entidad arrastrable con componente container
  Then la entidad no entra en la nevera y se coloca con "place"

Scenario: guardar lo que un personaje sostiene
  Given un personaje que sostiene una manzana
  When el jugador arrastra la manzana desde la mano y la suelta en la nevera abierta
  Then la manzana está en la nevera y la mano del personaje queda libre

@persistence
Scenario: el contenido persiste
  Given que el jugador guardó una manzana con bitesLeft 2 en la nevera
  When la app se cierra por completo y se vuelve a abrir
  Then la manzana está en el mismo slot de la nevera con bitesLeft 2
```
Incluye: AC-REJECT-01, AC-PERSIST-01, AC-PERSIST-02 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Soltar fuera de la zona `inside` (sobre el techo de la nevera): la regla no coincide → `place` sobre la superficie si existe.
- Hueco intermedio (slot 1 libre, 0 y 2 ocupados): el objeto va al slot 1.
- Objeto que es un contenedor (caja) soltado en otro contenedor: rechazado (R7).
- Producto sin comprar en la tienda soltado en el expositor refrigerado: `store_in_container` no comprueba `purchasable`; queda dentro del expositor de la tienda (no sale de la escena).
- Varias manzanas iguales: cada una ocupa su propio slot (sin apilado en el MVP).

### Dependencias
- HU-GAME-034: abrir y cerrar.
- HU-GAME-031: resolución de reglas `drop`.

### Consideraciones técnicas
- ContainerSystem (acción `store`), condiciones `isOpen` y `containerHasSpace`, `LocationService.move` ([ECS §4](../../architecture/ECS.md)).
- `isOpen` pasa si el contenedor **no** tiene `openable` (siempre abierto: alacena, cesta de ropa, buzón, expositor) o si está en `openState` ([INTERACTION_SCHEMA §4](../../data/INTERACTION_SCHEMA.md)).
- `rejects` filtra por tags; el rechazo de entidades con `container` lo aplica el motor aparte ([ENTITY_SCHEMA §5.8](../../data/ENTITY_SCHEMA.md)).
- Estado: [NEEDED NOW]; contenedores anidados [NOT NEEDED YET].

### Assets necesarios
- `ui_hint_container_full`: icono de contenedor lleno (placeholder aceptable: sí).
- `sfx_store_item`: sonido de guardar (placeholder: sí) — propuesta; `sfx_reject_soft` global existente.
- Sprites de interior visibles (`env_home_fridge_white_open` con estantes) de HU-GAME-034.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `store` y condiciones `isOpen`/`containerHasSpace` con tests (primer slot libre, lleno, no aceptado, sin `openable`, source con `container`).
- [ ] Test de escenario de la fila "objeto + contenedor" de INTERACTION_SYSTEM §4.
- [ ] Persistencia del contenido probada (AC-PERSIST-01/02).

---

## HU-GAME-036 — Sacar objetos de contenedores

> **Status:** Draft
> **Epic:** EPIC-009 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-009 — Containers

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **sacar lo que hay dentro de un mueble arrastrándolo con el dedo**
para **usarlo, dárselo a un personaje o llevarlo a otro sitio**.

### Contexto
Sacar no tiene regla propia: es un `takeOut` implícito que el DragSystem ejecuta al empezar a arrastrar un objeto visible de un contenedor abierto ([INTERACTION_SYSTEM §5](../../architecture/INTERACTION_SYSTEM.md), [INVENTORY_SYSTEM §1](../../architecture/INVENTORY_SYSTEM.md)). Luego el objeto se suelta como cualquier otro y se resuelven las reglas `drop` normales.

### Reglas de negocio
- R1: Solo se pueden sacar objetos de un contenedor **abierto** o sin `openable` (siempre abierto). Los de un contenedor cerrado no son tocables.
- R2: En el hit test, los objetos de un contenedor abierto son candidatos **antes** que el propio contenedor ([INPUT_SYSTEM §5](../../architecture/INPUT_SYSTEM.md)).
- R3: Al empezar el drag (movimiento ≥ 6 dp) se ejecuta `takeOut`: location `container` → `scene`, en la posición del dedo, y el slot queda libre.
- R4: Al soltar se resuelven las reglas `drop` normales (comer, sostener, vestir, guardar en otro contenedor o en la mochila) o `place`.
- R5: Soltarlo de nuevo en el mismo contenedor lo guarda en el **primer slot libre**, que puede no ser el original.
- R6: `dragCancel` deshace el `takeOut`: el objeto vuelve a su location original (mismo contenedor y mismo slot) y a su posición ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md), [GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).
- R7: Tap sobre un objeto dentro de un contenedor abierto resuelve reglas `tap` del objeto (si las tiene), no `tap_open` del contenedor.

### Criterios de aceptación
```gherkin
Scenario: sacar un objeto de un contenedor abierto
  Given una caja de juguetes abierta con un objeto en el slot 0
  When el jugador empieza a arrastrar el objeto
  Then se ejecuta takeOut y el slot 0 queda libre
  And al soltarlo sobre el suelo el objeto tiene location "scene"

Scenario: sacar y dar de comer directamente
  Given una nevera abierta con un objeto con edible en el slot 3
  When el jugador arrastra el objeto y lo suelta en la zona "mouth" de un personaje
  Then se resuelve "core:eat_food"

Scenario: el contenido de un contenedor cerrado no se puede sacar
  Given una nevera cerrada con un objeto dentro
  When el jugador intenta arrastrar desde el punto del slot
  Then no empieza ningún drag del objeto
  And el objeto sigue en la nevera

Scenario: arrastre interrumpido vuelve al slot
  Given una caja de juguetes abierta con un objeto en el slot 2
  When el jugador empieza a arrastrarlo y el gesto se cancela por una interrupción del sistema
  Then el objeto vuelve a location container en el slot 2 de la caja

Scenario: mover de un contenedor a otro
  Given un armario abierto con una prenda y una cesta de ropa con espacio
  When el jugador arrastra la prenda y la suelta sobre la zona "inside" de la cesta
  Then la prenda tiene location container en la cesta y el slot del armario queda libre

@persistence
Scenario: lo sacado queda fuera
  Given que el jugador sacó un juguete de la caja y lo dejó sobre la cama
  When la app se cierra por completo y se vuelve a abrir
  Then el juguete está sobre la cama y la caja tiene ese slot libre
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-PERF-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Objeto no `draggable` dentro de un contenedor (contenido mal definido): no se puede sacar; advertencia del validador (**propuesta**).
- Cerrar el contenedor con un tap mientras otro dedo arrastra: el MVP ignora el segundo dedo.
- Interrupción del gesto: el objeto vuelve a su slot original (R6).

### Dependencias
- HU-GAME-035: guardar en contenedores.

### Consideraciones técnicas
- DragSystem + ContainerSystem (`takeOut`).
- `takeOut` ocurre en `dragStart` (el World cambia en `dragStart` y `dragEnd`, nunca por frame) y `dragCancel` lo deshace ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md)).
- Estado: [NEEDED NOW].

### Assets necesarios
- Ninguno nuevo. Usa `sounds.pickup` del objeto o `sfx_pickup_default` ([AUDIO_SYSTEM §2](../../architecture/AUDIO_SYSTEM.md)).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] `takeOut` implícito en el DragSystem con tests (abierto, cerrado, cancelación).
- [ ] Test de hit testing con prioridad del contenido sobre el contenedor.
- [ ] Persistencia probada (AC-PERSIST-01/02).
