# EPIC-010 — Inventory

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [INVENTORY_SYSTEM](../../architecture/INVENTORY_SYSTEM.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [INPUT_SYSTEM](../../architecture/INPUT_SYSTEM.md) · [GAME_ENGINE](../../architecture/GAME_ENGINE.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md) · [ECS](../../architecture/ECS.md)

## Objetivo del epic
Dar al jugador una mochila global de 12 slots, accesible desde un botón del HUD, para llevar objetos entre escenas sin tener que sostenerlos. Guardar es soltar sobre el botón (regla `store_in_backpack`); sacar es arrastrar un slot de la bandeja hacia la escena (comando `takeFromInventory`). El contenido es una location (`inventory`), no una lista aparte.

## Historias
- [HU-GAME-037 — Guardar objetos en la mochila](#hu-game-037--guardar-objetos-en-la-mochila)
- [HU-GAME-038 — Sacar objetos de la mochila](#hu-game-038--sacar-objetos-de-la-mochila)

---

## HU-GAME-037 — Guardar objetos en la mochila

> **Status:** Draft
> **Epic:** EPIC-010 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-010 — Inventory

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **soltar un objeto sobre el botón de la mochila para guardarlo**
para **llevármelo a otra habitación o a la tienda sin perderlo**.

### Contexto
La mochila es un botón del HUD (View RN encima de la Canvas) que actúa como **drop target** ([INVENTORY_SYSTEM §2](../../architecture/INVENTORY_SYSTEM.md)). El adaptador de input comprueba sus bounds medidos (`onLayout`) en `dragEnd` y el resolver la trata como primer candidato con `ui: "inventory"` ([INTERACTION_SCHEMA §3](../../data/INTERACTION_SCHEMA.md)).

### Reglas de negocio
- R1: Regla `store_in_backpack`: trigger `drop`; source has `draggable`, notTags `character`, `furniture`; target `ui: "inventory"`; condiciones `inventoryHasSpace` e `isPurchased { value: true, ifMissing: true }`; acción `addToInventory`; prioridad 100.
- R2: Capacidad MVP: **12 slots** (`player.inventory.capacity`). El objeto va al primer slot libre (`location { kind: "inventory", slot }`).
- R3: Si el punto de soltado cae sobre el botón de la mochila, ese target es el **primer** candidato (antes que cualquier entidad del mundo debajo).
- R4: Mochila llena → `interactionRejected`: el **botón de la mochila** hace shake, suena `sfx_reject_soft` y el objeto se coloca con `place` bajo el punto ([INVENTORY_SYSTEM §4](../../architecture/INVENTORY_SYSTEM.md)).
- R5: Producto sin comprar (`purchasable.purchased === false`) → rechazo amable y `place` (en la tienda, Fase 2).
- R6: Muebles y personajes no coinciden con el matcher → `place`, sin sonido de rechazo (no hay regla coincidente).
- R7: Guardar un objeto sostenido lo saca de la mano y lo guarda en una sola transacción. La comida conserva `bitesLeft`/`sipsLeft`.
- R8: La mochila es **global**: su contenido no depende de la escena y se carga al inicio con las entidades globales (igual que los personajes, [GAME_ENGINE §3](../../architecture/GAME_ENGINE.md)).
- R9: Feedback de éxito: el botón hace `bounce` y muestra un contador/indicador visual de ocupación (**propuesta**: 12 puntos que se rellenan, sin números).
- R10: Durante el drag, al pasar sobre el botón se resalta si la regla pasaría (preview de HU-GAME-033) o muestra `rejectHint` si no.

### Criterios de aceptación
```gherkin
Scenario: guardar un objeto en la mochila
  Given la mochila con 3 slots ocupados (0, 1 y 2)
  And un objeto con draggable en la escena (un osito)
  When el jugador lo suelta sobre el botón de la mochila
  Then se resuelve "core:store_in_backpack"
  And el objeto tiene location { kind: "inventory", slot: 3 }
  And el objeto deja de dibujarse en la escena y el botón hace "bounce"

Scenario: la mochila está llena
  Given la mochila con 12 slots ocupados
  When el jugador suelta un objeto sobre el botón de la mochila
  Then se emite interactionRejected
  And el botón de la mochila hace "shake" y suena el rechazo suave
  And el objeto se coloca con "place" bajo el punto de soltado

Scenario: un mueble no se guarda
  Given un objeto con tag "furniture" y draggable (una silla)
  When el jugador lo suelta sobre el botón de la mochila
  Then ninguna regla coincide y la silla se coloca con "place" en el suelo

Scenario: el botón tiene prioridad sobre lo que hay debajo
  Given el botón de la mochila dibujado encima de una nevera abierta
  When el jugador suelta una manzana sobre el botón
  Then la manzana va a la mochila, no a la nevera

Scenario: la mochila viaja entre escenas
  Given un objeto guardado en la mochila en la casa
  When el jugador viaja a la calle
  Then el objeto sigue en el mismo slot de la mochila

@persistence
Scenario: la mochila sobrevive a cerrar la app
  Given una galleta con bitesLeft 1 guardada en el slot 0
  When la app se cierra por completo y se vuelve a abrir
  Then el slot 0 contiene la galleta con bitesLeft 1
```
Incluye: AC-REJECT-01 (el shake lo hace el botón), AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- El botón está en una esquina y el drag se acerca al borde: el auto-scroll de cámara (HU-GAME-029) no debe impedir soltar sobre el botón. **Pregunta abierta:** ¿el área del botón excluye la zona de auto-scroll?
- Soltar parcialmente sobre el botón: cuenta el punto del dedo, no el sprite.
- Objeto con `interactions.disabledRules: ["core:store_in_backpack"]`: no coincide → `place`.
- Soltar un objeto con cosas dentro (un contenedor arrastrable): el matcher lo excluye si tiene tag `furniture`; si no lo tuviera, la mochila **también lo rechaza**: la regla fija contra el anidamiento se aplica a contenedores y mochila ([INVENTORY_SYSTEM §2](../../architecture/INVENTORY_SYSTEM.md)).

### Dependencias
- HU-GAME-031: resolución de reglas y targets de UI.
- HU-GAME-004: GameFacade y HUD.

### Consideraciones técnicas
- InventorySystem (acción `addToInventory`, P1), condición `inventoryHasSpace`, `isPurchased` con `ifMissing`.
- HUD: `Pressable` + medición de bounds con `onLayout` para el drop target ([INPUT_SYSTEM §6](../../architecture/INPUT_SYSTEM.md)); selector `inventorySlots()` y hook `useInventory()`.
- Estado: [NEEDED NOW] (P1); ampliar capacidad [DESIGNED FOR LATER].

### Assets necesarios
- `ui_hud_backpack` y `ui_hud_backpack_open`: botón de la mochila (placeholder aceptable: sí).
- `ui_hint_backpack_full`: icono de mochila llena (placeholder: sí).
- `sfx_backpack_store`: sonido de guardar (placeholder: sí) — propuesta.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `addToInventory` y condición `inventoryHasSpace` con tests.
- [ ] Test de integración con `uiTarget: "inventory"` en `dragEnd`.
- [ ] Botón ≥ 64 dp con `accessibilityLabel` i18n.
- [ ] Persistencia probada entre escenas y tras cerrar la app.

---

## HU-GAME-038 — Sacar objetos de la mochila

> **Status:** Draft
> **Epic:** EPIC-010 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-010 — Inventory

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **abrir la mochila y arrastrar un objeto de vuelta a la escena**
para **usar en otro sitio lo que traje**.

### Contexto
Tocar el botón de la mochila abre una **bandeja de slots** (UI RN). Arrastrar un slot hacia la escena envía `takeFromInventory { slot, worldPoint }`, que saca el objeto a la escena e inicia su drag desde el dedo ([INVENTORY_SYSTEM §2](../../architecture/INVENTORY_SYSTEM.md), [GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).

### Reglas de negocio
- R1: Tap en el botón de la mochila abre o cierra la bandeja con los 12 slots; los ocupados muestran el sprite del objeto (incluido el sprite por mordiscos de la comida).
- R2: Arrastrar desde un slot ocupado hacia fuera de la bandeja ejecuta `takeFromInventory { slot, worldPoint }`: location `inventory` → `scene` y el objeto sigue al dedo como un drag normal (DragProxy).
- R3: Al soltar se resuelven las reglas `drop` normales (comer, sostener, vestir, guardar en contenedor) o `place`.
- R4: Soltar sobre el propio botón de la mochila la vuelve a guardar en el primer slot libre (puede ser otro slot).
- R5: Slot vacío: tocarlo o arrastrarlo no hace nada.
- R6: Mientras la bandeja está abierta la escena sigue siendo jugable; la bandeja se cierra con un tap en el botón o al empezar un drag desde ella (**propuesta**).
- R7: Slots ≥ 64 dp de área efectiva; `accessibilityLabel` con el `metadata.name` i18n del objeto.
- R8: `dragCancel` tras sacarlo deshace la transición: el objeto vuelve a su slot original de la mochila ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md), [GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).

### Criterios de aceptación
```gherkin
Scenario: abrir la bandeja
  Given la mochila con un objeto en el slot 0
  When el jugador toca el botón de la mochila
  Then se muestra la bandeja con 12 slots y el sprite del objeto en el slot 0

Scenario: sacar un objeto a la escena
  Given la bandeja abierta con un osito en el slot 0
  When el jugador arrastra el slot 0 y lo suelta sobre el suelo de la escena
  Then se despacha takeFromInventory { slot: 0 }
  And el osito tiene location "scene" apoyado en el suelo bajo el punto
  And el slot 0 queda vacío

Scenario: sacar y dar de comer
  Given la bandeja abierta con una comida en el slot 2
  When el jugador la arrastra y la suelta en la zona "mouth" de un personaje
  Then se resuelve "core:eat_food"

Scenario: arrastre interrumpido vuelve a la mochila
  Given la bandeja abierta con un osito en el slot 4
  When el jugador lo arrastra a la escena y el gesto se cancela por una interrupción del sistema
  Then el osito vuelve a location { kind: "inventory", slot: 4 }

Scenario: slot vacío
  Given la bandeja abierta con el slot 5 vacío
  When el jugador arrastra desde el slot 5
  Then no se despacha ningún comando y no empieza ningún drag

@persistence
Scenario: lo sacado queda en la escena
  Given que el jugador sacó un objeto de la mochila en la cocina
  When viaja a otra escena y regresa
  Then el objeto sigue en la cocina y no en la mochila
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-PERF-01, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Soltar el objeto dentro de la bandeja (sin salir de ella): **propuesta** — equivale a `dragCancel` (vuelve al slot).
- Producto comprado en la tienda sacado en casa: se comporta como cualquier objeto.
- Sacar en una escena distinta a la de origen: el objeto pasa a `sceneId` de la escena activa.

### Dependencias
- HU-GAME-037: guardar en la mochila.

### Consideraciones técnicas
- Comando `takeFromInventory` del GameFacade; el gesto nace en una View RN y debe continuar como drag del mundo: **pregunta abierta** técnica sobre el traspaso del gesto de la bandeja (RN) al detector único de la Canvas ([INPUT_SYSTEM §1](../../architecture/INPUT_SYSTEM.md)); requiere spike.
- Estado: [NEEDED NOW] (P1).

### Assets necesarios
- `ui_hud_backpack_tray` y `ui_hud_backpack_slot`: bandeja y fondo de slot (placeholder aceptable: sí).
- `sfx_backpack_open`, `sfx_backpack_close` (placeholder: sí) — propuesta.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Comando `takeFromInventory` con tests (slot ocupado, vacío, cancelación).
- [ ] Bandeja verificada a mano en Android e iOS (traspaso del gesto sin saltos).
- [ ] Persistencia probada (AC-PERSIST-01/02).
