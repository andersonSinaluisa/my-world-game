# EPIC-011 — Clothing

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [CHARACTER_SYSTEM](../../architecture/CHARACTER_SYSTEM.md) · [CHARACTER_SCHEMA](../../data/CHARACTER_SCHEMA.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [INVENTORY_SYSTEM](../../architecture/INVENTORY_SYSTEM.md) · [INPUT_SYSTEM](../../architecture/INPUT_SYSTEM.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md)

## Objetivo del epic
Que el niño vista y desvista a sus personajes arrastrando prendas reales del mundo (15 prendas: 6 superiores, 5 inferiores, 4 zapatos) y las guarde en el armario. Vestir es la regla `wear_clothes`; quitar es una pulsación larga (regla `unwear_clothes`, trigger `longPress`) que ejecuta `unwear` y sigue como arrastre; el armario es un contenedor más con `accepts: ["clothing"]`.

## Historias
- [HU-GAME-039 — Vestir prendas soltándolas sobre el personaje](#hu-game-039--vestir-prendas-soltándolas-sobre-el-personaje)
- [HU-GAME-040 — Quitar prendas del personaje](#hu-game-040--quitar-prendas-del-personaje)
- [HU-GAME-041 — Armario con ropa disponible](#hu-game-041--armario-con-ropa-disponible)

---

## HU-GAME-039 — Vestir prendas soltándolas sobre el personaje

> **Status:** Draft
> **Epic:** EPIC-011 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-011 — Clothing

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **arrastrar una camiseta, un pantalón o unos zapatos sobre mi personaje para ponérselos**
para **cambiarle el look cuando quiera**.

### Contexto
Vestir cambia la location de la prenda a `worn { characterId, slot }` y deja caer la prenda que ocupaba ese slot ([CHARACTER_SYSTEM §7](../../architecture/CHARACTER_SYSTEM.md), [INTERACTION_SYSTEM §4](../../architecture/INTERACTION_SYSTEM.md)). `outfit` es un índice derivado, no se persiste ([CHARACTER_SCHEMA §2](../../data/CHARACTER_SCHEMA.md)).

### Reglas de negocio
- R1: Regla `wear_clothes`: trigger `drop`; source has `wearable`; target has `character`, zona `body`/`torso`/`legs`/`feet`; condiciones `canWear`, `isPurchased`; acción `wear`; prioridad 90.
- R2: `canWear` pasa si el `wearable.slot` existe (v1: `top`, `bottom`, `shoes`) y hay sprite para el cuerpo del personaje (`bodyVariants[bodyType]` o `layers`). Toda prenda debe tener sprites para los dos cuerpos (el validador da error en `starterClothes` y advertencia en el resto; [CHARACTER_SYSTEM §7](../../architecture/CHARACTER_SYSTEM.md)), así que en runtime `canWear` solo falla con contenido mal definido.
- R2b: `isPurchased` (`{ value: true, ifMissing: true }`): un producto de la tienda sin comprar **no** se puede vestir ([INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md)).
- R3: `wear`: la prenda pasa a `location { kind: "worn", characterId, slot }`. Si el slot estaba ocupado, la prenda anterior pasa a la escena **junto a los pies** del personaje con una animación de "pop".
- R4: La prenda puesta se dibuja en sus capas (`torsoClothes`, `armClothesL/R`, `bottomClothes`, `shoes`) según HU-GAME-013; suelta se dibuja con su `sprite` normal.
- R5: Recibir una prenda pone la expresión `happy` 1 s ([CHARACTER_SYSTEM §9](../../architecture/CHARACTER_SYSTEM.md)).
- R6: Si la prenda cae en `handL`/`handR` gana `hold_item` (la sostiene); en `body`/`torso`/`legs`/`feet` gana `wear_clothes` (90 > 50). La prenda va a **su** slot, sea cual sea la banda tocada.
- R7: Vestir una prenda sostenida (por el mismo u otro personaje) la saca de la mano y la viste en una sola transacción (`held → worn`, [ECS §4](../../architecture/ECS.md)).
- R8: Las prendas vestidas viajan con el personaje (arrastre y portales) y se persisten como entidades propias con location `worn`.
- R9: Vestir no cambia la pose: se puede vestir a un personaje sentado o dormido (`canWear` no comprueba la pose).

### Criterios de aceptación
```gherkin
Scenario: vestir una prenda en un slot vacío
  Given un personaje sin prenda en el slot "shoes"
  And una prenda con wearable { slot: "shoes" } en la escena
  When el jugador suelta la prenda sobre la zona "body" del personaje
  Then se resuelve "core:wear_clothes"
  And la prenda tiene location { kind: "worn", characterId: personaje, slot: "shoes" }
  And la capa "shoes" del personaje usa el asset de la prenda
  And la expresión es "happy" durante 1000 ms

Scenario: la prenda anterior cae junto al personaje
  Given un personaje que viste la camiseta A en el slot "top"
  When el jugador suelta la camiseta B sobre su zona "body"
  Then B está vestida en "top"
  And A tiene location "scene" junto a los pies del personaje, apoyada en el suelo

Scenario: producto sin comprar
  Given una prenda con purchasable { purchased: false } en la tienda
  When el jugador la suelta sobre la zona "torso" de un personaje
  Then isPurchased falla y se emite interactionRejected
  And el personaje hace "shake", suena el rechazo suave y la prenda se coloca con "place"

Scenario: no hay sprite para ese cuerpo (contenido mal definido)
  Given una prenda fuera de starterClothes sin variante para "adult" y sin layers genéricos para ese slot
  And un personaje con bodyType "adult"
  When el jugador la suelta sobre su zona "body"
  Then canWear falla y se emite interactionRejected
  And el personaje hace "shake", suena el rechazo suave
  And la prenda se coloca con "place" bajo el punto de soltado

Scenario: una prenda en la mano se sostiene
  Given un personaje con la mano derecha libre
  When el jugador suelta una prenda sobre su zona "handR"
  Then se resuelve "core:hold_item" y la prenda queda sostenida

@persistence
Scenario: la ropa puesta persiste
  Given que el jugador vistió a un personaje con una prenda nueva
  When la app se cierra por completo y se vuelve a abrir
  Then el personaje sigue vistiendo esa prenda y la anterior sigue en el suelo
```
Incluye: AC-REJECT-01, AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Personaje sentado: la prenda anterior cae al suelo bajo el asiento, no sobre el asiento (**propuesta**).
- Vestir la misma prenda que ya lleva: no ocurre, porque las prendas vestidas se excluyen de los candidatos y no se pueden arrastrar directamente.
- Prenda sin comprar en la tienda: no se puede vestir (`isPurchased`), así que no puede salir de la tienda puesta.
- Slot `full` (vestidos) [DESIGNED FOR LATER].

### Dependencias
- HU-GAME-013: capas de ropa en el render.
- HU-GAME-031: resolución de reglas `drop`.

### Consideraciones técnicas
- OutfitSystem (acción `wear`), condiciones `canWear` e `isPurchased`, índice `world.index.wornBy` ([GAME_ENGINE §3](../../architecture/GAME_ENGINE.md)).
- Variante por pose `"{asset}_{pose}"` opcional (HU-GAME-013 R3).
- Estado: [NEEDED NOW]; tintes de ropa y slots adicionales [DESIGNED FOR LATER].

### Assets necesarios
- Para las 15 prendas: `obj_clothing_{name}` (suelta) y `chr_{top|bottom|shoes}_{name}` (+ `_arm_l`/`_arm_r` para superiores, `_adult` si hay variante de cuerpo) (placeholder aceptable: sí).
- `sfx_wear_clothes`: sonido de ponerse ropa (placeholder: sí) — propuesta.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `wear` y condiciones `canWear`/`isPurchased` con tests (slot vacío, reemplazo, sin sprite, desde la mano, sin comprar).
- [ ] Test de escenario de la fila "ropa + personaje" de INTERACTION_SYSTEM §4.
- [ ] Persistencia probada (AC-PERSIST-01/02).

---

## HU-GAME-040 — Quitar prendas del personaje

> **Status:** Draft
> **Epic:** EPIC-011 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-011 — Clothing

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **mantener el dedo sobre la ropa de mi personaje y arrastrarla fuera para quitársela**
para **cambiarle la ropa o guardarla en el armario**.

### Contexto
Las prendas vestidas **no** se arrastran directamente (así arrastrar al personaje no lo desviste por accidente). Se quitan con una pulsación larga sobre la prenda: el comando `pointerLongPress` resuelve la regla `unwear_clothes` (trigger `longPress`, v1 limitado a esta regla), la acción `unwear` saca la prenda y devuelve `startDrag: itemId`, y el dedo sigue arrastrando la prenda sin levantarse ([CHARACTER_SYSTEM §7](../../architecture/CHARACTER_SYSTEM.md), [INPUT_SYSTEM §2](../../architecture/INPUT_SYSTEM.md), [INTERACTION_SCHEMA §5, §7](../../data/INTERACTION_SCHEMA.md)).

### Reglas de negocio
- R1: Gesto: toque sobre un personaje, **≥ 450 ms sin moverse (< 10 dp)** → comando `pointerLongPress { worldPoint }`. Un movimiento ≥ 6 dp antes de 450 ms arrastra al **personaje** (HU-GAME-017).
- R2: Regla `unwear_clothes`: trigger `longPress`; target has `character`, zona `torso`/`legs`/`feet`; condición: la zona tiene prenda; acción `unwear`; prioridad 50.
- R3: Zonas → slot: `torso` → `top`, `legs` → `bottom`, `feet` → `shoes`. Son bandas verticales dentro de `body` de la hitbox estándar ([CHARACTER_SCHEMA §4](../../data/CHARACTER_SCHEMA.md)).
- R4: `unwear`: la prenda de ese slot pasa a la escena en el punto del dedo y el comando devuelve `startDrag: itemId`; el Input adapter continúa el gesto como un drag de la prenda (DragProxy).
- R5: Al soltar se resuelven las reglas `drop` normales: vestir a otro personaje, guardar en el armario o la mochila, sostener, o `place`.
- R6: Si la zona no tiene prenda, la condición falla: no se quita nada y no hay `startDrag` (el gesto termina; **propuesta**: sin sonido de rechazo, porque no hubo un intento de soltar).
- R7: Feedback al cumplirse la pulsación larga: la prenda sale con un "pop" y queda bajo el dedo (preset `bounce`), sin texto.
- R8: El personaje puede quedarse sin prenda en un slot; el cuerpo base muestra ropa interior pintada (requisito de arte en HU-GAME-013).
- R9: `dragCancel` tras `unwear` deshace la transición: la prenda vuelve a estar vestida en su slot ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md)).
- R10: El cambio se persiste (la prenda pasa a ser una entidad con location `scene`/`container`/…).

### Criterios de aceptación
```gherkin
Scenario: quitar una camiseta y dejarla en el suelo
  Given un personaje que viste una prenda en el slot "top"
  When el jugador mantiene el dedo 450 ms sobre la zona "torso" del personaje
  Then se resuelve "core:unwear_clothes" y el comando devuelve startDrag con el id de la prenda
  And la capa "torsoClothes" del personaje queda vacía
  And al arrastrar y soltar sobre el suelo la prenda tiene location "scene" apoyada en el suelo

Scenario: moverse antes de 450 ms arrastra al personaje
  Given un personaje vestido
  When el jugador toca su zona "torso" y mueve el dedo 20 dp a los 100 ms
  Then empieza el drag del personaje y ninguna prenda cambia de location

Scenario: quitar y guardar en el armario
  Given un personaje con zapatos y un armario abierto con espacio
  When el jugador hace long press sobre la zona "feet" y suelta la prenda en la zona "inside" del armario
  Then los zapatos tienen location container en el armario

Scenario: zona sin prenda
  Given un personaje sin prenda en el slot "shoes"
  When el jugador hace long press sobre la zona "feet"
  Then no se ejecuta unwear y no se devuelve startDrag

Scenario: arrastre interrumpido devuelve la prenda
  Given que el jugador quitó una prenda con long press y la está arrastrando
  When el gesto se cancela por una interrupción del sistema
  Then la prenda vuelve a estar vestida en el mismo slot

@persistence
Scenario: la prenda quitada no vuelve sola
  Given que el jugador quitó la camiseta de un personaje
  When la app se cierra por completo y se vuelve a abrir
  Then el personaje sigue sin camiseta y la camiseta está donde se soltó
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)); verificación `@manual` del gesto en dispositivo.

### Casos límite
- Personaje sentado o dormido: el long press quita la prenda sin levantarlo (no hay `dragStart` del personaje).
- Long press sobre la mano con un objeto sostenido: la zona es `handL`/`handR`, así que `unwear_clothes` no coincide.
- Long press sobre objetos que no son personajes: [DESIGNED FOR LATER]; en el MVP no hace nada.
- Niños de 4 años pueden no descubrir el long press: se cubre con AC-A11Y-01 y, si falla la prueba, se reabre el diseño.

### Dependencias
- HU-GAME-039: vestir (capas de ropa y zonas `torso`/`legs`/`feet`).

### Consideraciones técnicas
- OutfitSystem (acción `unwear`), InteractionResolver con trigger `longPress`, comando `pointerLongPress` con resultado `startDrag` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).
- Detección del long press (450 ms, < 10 dp) en el adaptador de input y continuación del mismo gesto como drag.
- Estado: [NEEDED NOW] (P1); long press en otros objetos [DESIGNED FOR LATER].

### Assets necesarios
- `sfx_unwear_clothes`: sonido de quitarse ropa (placeholder aceptable: sí) — propuesta de clave.
- Ninguno visual nuevo; usa los sprites de HU-GAME-039.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Regla `unwear_clothes`, acción `unwear` y comando `pointerLongPress` con tests (umbral, zonas, zona vacía, `startDrag`, cancelación).
- [ ] Verificación manual en Android e iOS con al menos un niño del rango de edad (o registro para la prueba de salida del MVP).
- [ ] Persistencia probada (AC-PERSIST-01/02).

---

## HU-GAME-041 — Armario con ropa disponible

> **Status:** Draft
> **Epic:** EPIC-011 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-011 — Clothing

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **abrir el armario del dormitorio y encontrar ropa para probarle a mis personajes**
para **tener más opciones que la ropa con la que se crearon**.

### Contexto
El armario no es un sistema especial: es un contenedor con `states` + `openable` + `container { accepts: ["clothing"] }` que la escena declara con prendas dentro desde el inicio ([INVENTORY_SYSTEM §3](../../architecture/INVENTORY_SYSTEM.md), entidades `inContainer` de [SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md)). Es trabajo de **contenido** sobre las mecánicas de HU-GAME-034/035/036 y HU-GAME-039.

### Reglas de negocio
- R1: Prefab del armario: `states { closed, open }`, `openable`, `container { accepts: ["clothing"], capacity, slots }`, `hitbox.zones.inside`. Sin código propio.
- R2: La escena `core:home` (dormitorio) declara prendas con `inContainer: { localId: armario, slot }`, cada una con `slot < capacity`.
- R3: Capacidad del armario **12**; empieza con **8 prendas** ([MVP_SCOPE §2](../../product/MVP_SCOPE.md)). Las 15 prendas del MVP están además disponibles en el creador (`starterClothes`) y la tienda vende instancias adicionales. **Propuesta:** reparto inicial 3 superiores, 3 inferiores y 2 zapatos.
- R4: La cesta de ropa del baño es otro contenedor con `accepts: ["clothing"]` sin `openable`: está siempre abierta (`isOpen` pasa sin `openable`, [INTERACTION_SCHEMA §4](../../data/INTERACTION_SCHEMA.md)).
- R5: Se abre con `tap_open`, se guarda con `store_in_container` (rechaza lo que no sea `clothing`) y se saca arrastrando; se viste soltando sobre el personaje.
- R6: Las prendas del armario son entidades declaradas de escena (`core:home/{localId}`); al moverlas se persisten con el diff.
- R7: El armario es también el destino de la prenda reemplazada por `setOutfitSlot` desde el creador si tiene espacio (HU-GAME-021, [GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).

### Criterios de aceptación
```gherkin
Scenario: el armario empieza con ropa
  Given una partida nueva
  When el jugador abre el armario del dormitorio
  Then se ven 8 prendas en los slots 0 a 7 y quedan 4 slots libres

Scenario: sacar una prenda del armario y vestirla
  Given el armario abierto con una prenda en el slot 0
  When el jugador la arrastra y la suelta en la zona "body" de un personaje
  Then la prenda queda vestida y la anterior del mismo slot cae junto al personaje

Scenario: el armario solo acepta ropa
  Given el armario abierto con espacio
  When el jugador suelta un objeto con tag "food" en su zona "inside"
  Then se emite interactionRejected con reason "notAccepted"
  And el objeto se coloca con "place"

@persistence
Scenario: la ropa guardada sigue en el armario
  Given que el jugador guardó una camiseta en el armario y lo cerró
  When la app se cierra por completo, se vuelve a abrir y abre el armario
  Then la camiseta está en el mismo slot
```
Incluye: AC-REJECT-01, AC-PERSIST-01, AC-PERSIST-02 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Armario lleno al guardar la prenda que el personaje acaba de soltar: `containerFull` → `place` delante del armario.
- Una prenda declarada en un slot ≥ `capacity`: error del validador de contenido ([SCENE_SCHEMA](../../data/SCENE_SCHEMA.md)).
- Prendas de packs futuros con tag `clothing`: se aceptan sin cambios.

### Dependencias
- HU-GAME-035: guardar en contenedores.
- HU-GAME-039: vestir.

### Consideraciones técnicas
- Solo contenido (`content/core/prefabs/furniture/wardrobe*.json`, escena `home`) y test de escenario.
- Relación resuelta en [MVP_SCOPE §2](../../product/MVP_SCOPE.md): las 15 prendas están en `starterClothes`; el armario solo contiene 8 instancias iniciales.
- Estado: [NEEDED NOW] (P1).

### Assets necesarios
- `env_home_wardrobe` / `env_home_wardrobe_open`: armario cerrado y abierto con barra/estantes visibles (placeholder aceptable: sí).
- `env_home_laundry_basket`: cesta de ropa (placeholder: sí).
- `sfx_wardrobe_open`, `sfx_wardrobe_close` (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Prefab del armario y escena con `inContainer` pasan `npm run content:validate`.
- [ ] Test de escenario: abrir → sacar → vestir → guardar la prenda anterior.
- [ ] Persistencia probada (AC-PERSIST-01/02).
