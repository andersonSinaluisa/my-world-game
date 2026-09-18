# EPIC-013 — Furniture

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [INTERACTION_SYSTEM](../../architecture/INTERACTION_SYSTEM.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [CHARACTER_SYSTEM](../../architecture/CHARACTER_SYSTEM.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [INPUT_SYSTEM](../../architecture/INPUT_SYSTEM.md) · [RENDERING](../../architecture/RENDERING.md) · [INVENTORY_SYSTEM](../../architecture/INVENTORY_SYSTEM.md)

## Objetivo del epic
Que los muebles den vida a la casa: sentarse en sillas, sofás, bancos, inodoro y bañera; dormir en la cama con la manta encima; encender y apagar lámparas, TV, fogón, grifo y farola; y reorganizar los muebles arrastrándolos por el suelo con todo lo que llevan. Solo con los componentes `seat`, `bed`, `states` + `switchable` y `draggable { mode: "floorOnly" }` y las reglas `sit_on_seat`, `sleep_on_bed` y `tap_switch`.

## Historias
- [HU-GAME-045 — Sentarse en asientos](#hu-game-045--sentarse-en-asientos)
- [HU-GAME-046 — Dormir en camas](#hu-game-046--dormir-en-camas)
- [HU-GAME-047 — Objetos encendibles (lámpara, TV, grifo)](#hu-game-047--objetos-encendibles-lámpara-tv-grifo)
- [HU-GAME-048 — Mover muebles](#hu-game-048--mover-muebles)

---

## HU-GAME-045 — Sentarse en asientos

> **Status:** Draft
> **Epic:** EPIC-013 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-013 — Furniture

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **soltar a mi personaje sobre una silla o el sofá para que se siente**
para **montar escenas de la vida diaria: comer en la mesa, ver la tele**.

### Contexto
La regla `sit_on_seat` y la acción `sit` del SeatSystem anclan al personaje en `seat.anchor` con pose `sit` ([INTERACTION_SYSTEM §4](../../architecture/INTERACTION_SYSTEM.md), [CHARACTER_SYSTEM §8](../../architecture/CHARACTER_SYSTEM.md)). La ocupación no se guarda en el asiento: se deriva de `pose.seatId` ([ENTITY_SCHEMA §5.11](../../data/ENTITY_SCHEMA.md)).

### Reglas de negocio
- R1: Regla `sit_on_seat`: trigger `drop`; source has `character`; target has `seat`; condición `seatFree`; acción `sit`; prioridad 80.
- R2: `sit`: pose `sit` con `seatId`; el transform del personaje se deriva de `seat.anchor` (relativo al pivot del asiento); `flipX` según `seat.facing` si aplica.
- R3: `seat.capacity` vale 1 por defecto. En el MVP el sofá tiene **1 plaza**; varias plazas (`anchors[]`) [DESIGNED FOR LATER].
- R4: Asiento ocupado → `seatFree` falla → se prueba la siguiente regla; si ninguna pasa, `interactionRejected`, el asiento hace shake, suena el rechazo suave y el personaje se coloca con `place` junto a la silla en `idle`.
- R5: Render: el personaje sentado usa `z = z del asiento + 1` en la capa `characters` ([RENDERING §4](../../architecture/RENDERING.md)).
- R6: Levantarse: arrastrar al personaje ejecuta `standUp` implícito y pasa a `dangle` (HU-GAME-017).
- R7: Puede comer y beber sentado (`returnTo: "sit"`, HU-GAME-042) y sostener objetos.
- R8: Asientos del MVP: sofá, sillón, silla, inodoro, bañera, banco ([MVP_SCOPE](../../product/MVP_SCOPE.md)).
- R9: La pose `sit` y el `seatId` se persisten.

### Criterios de aceptación
```gherkin
Scenario: sentarse en un asiento libre
  Given una entidad con seat { anchor: { x: 0, y: -95 } } libre (una silla)
  And un personaje que se está arrastrando
  When el jugador lo suelta sobre la silla
  Then se resuelve "core:sit_on_seat"
  And el personaje tiene pose { current: "sit", seatId: silla }
  And su posición coincide con el anchor de la silla y se dibuja delante de ella

Scenario: asiento ocupado
  Given una silla con un personaje sentado
  When el jugador suelta a otro personaje sobre la silla
  Then se emite interactionRejected
  And la silla hace "shake" y suena el rechazo suave
  And el segundo personaje se coloca con "place" junto a la silla en pose "idle"

Scenario: levantarse al arrastrar
  Given un personaje sentado en el sofá
  When el jugador empieza a arrastrarlo
  Then el sofá queda libre y el personaje está en "dangle"

Scenario: soltar un objeto sobre un asiento no lo sienta
  Given una silla libre
  When el jugador suelta una pelota sobre la silla
  Then no se resuelve "core:sit_on_seat" y la pelota se coloca con "place"

@persistence
Scenario: sigue sentado al volver
  Given un personaje sentado en el sillón
  When la app se cierra por completo y se vuelve a abrir
  Then el personaje sigue sentado en el sillón
```
Incluye: AC-REJECT-01, AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Soltar un personaje sobre un asiento que también es `surface` (banco con objetos): gana `sit_on_seat` si está libre.
- Asiento eliminado o sin `seat` tras actualizar el pack: el personaje se normaliza a `idle` en el suelo (HU-GAME-014).
- Guardado inconsistente con dos personajes en el mismo asiento: en producción se repara moviendo uno al spawn `default` ([SAVE_SYSTEM §5](../../architecture/SAVE_SYSTEM.md)).
- Soltar un personaje sobre la zona de un asiento tapada por otro mueble más al frente: gana el candidato más cercano al frente.

### Dependencias
- HU-GAME-017: arrastrar personajes (EPIC-004).
- HU-GAME-031: reglas de datos.

### Consideraciones técnicas
- SeatSystem (acciones `sit`/`standUp`), condición `seatFree`, índice `world.index.seatOccupant`.
- Estado: [NEEDED NOW]; varias plazas [DESIGNED FOR LATER].

### Assets necesarios
- `env_home_chair_wood_001`, `env_home_sofa`, `env_home_armchair`, `env_home_toilet`, `env_home_bathtub` (placeholder aceptable: sí); `env_street_bench` (Fase 2).
- `chr_body_{child|adult}_sit_{legs|torso}`: pose sentada (compartido con HU-GAME-014).
- `sfx_sit_soft` (placeholder: sí) — propuesta.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acciones `sit`/`standUp` y condición `seatFree` con tests.
- [ ] Test de escenario de la fila "personaje + silla" de INTERACTION_SYSTEM §4.
- [ ] Persistencia probada (AC-PERSIST-01/02).

---

## HU-GAME-046 — Dormir en camas

> **Status:** Draft
> **Epic:** EPIC-013 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-013 — Furniture

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **acostar a mi personaje en la cama y que se tape con la manta**
para **jugar a la hora de dormir**.

### Contexto
La regla `sleep_on_bed` y la acción `sleep` reutilizan el SeatSystem con otra pose ([ECS §5](../../architecture/ECS.md)). La cama tiene `bed` y `surface`: un personaje se acuesta; un objeto se apoya encima ([INTERACTION_SYSTEM §4](../../architecture/INTERACTION_SYSTEM.md)). Es el ejemplo de persistencia de la arquitectura: "si dejo un juguete sobre la cama, debe permanecer allí" ([SAVE_SYSTEM §1](../../architecture/SAVE_SYSTEM.md)).

### Reglas de negocio
- R1: Regla `sleep_on_bed`: trigger `drop`; source has `character`; target has `bed`; condición `seatFree`; acción `sleep`; prioridad 85.
- R2: `sleep`: pose `sleep` con `seatId` = cama, anclado en `bed.anchor`; expresión `sleepy` (ojos cerrados).
- R3: Si la cama define `bed.coverAsset`, la manta se dibuja en la capa `characters` **inmediatamente después** del personaje dormido (z del personaje + 0,5): lo tapa a él, pero no a lo que esté delante de la cama. Sin personaje dormido, la manta forma parte del sprite de la cama ([RENDERING §4](../../architecture/RENDERING.md)).
- R4: `bed.capacity` 1 por defecto. Cama ocupada → `seatFree` falla → siguiente regla o fallback: el personaje se coloca con `place` (puede quedar de pie sobre la superficie de la cama) con rechazo amable.
- R5: Un **objeto** soltado sobre la cama no coincide con `sleep_on_bed` (source no es `character`) y se apoya en su `surface` con `place`.
- R6: Levantarse: arrastrar al personaje ejecuta `standUp` implícito (HU-GAME-017).
- R7: Al cargar la partida, la expresión vuelve a `neutral` pero los ojos siguen cerrados porque la pose es `sleep` (HU-GAME-013 R3).
- R8: Pose `sleep`, `seatId` y la posición de los objetos sobre la cama se persisten.

### Criterios de aceptación
```gherkin
Scenario: acostar a un personaje
  Given una entidad con bed { anchor, coverAsset: "env_home_bed_single_cover" } libre
  When el jugador suelta un personaje sobre la cama
  Then se resuelve "core:sleep_on_bed"
  And el personaje tiene pose { current: "sleep", seatId: cama } y ojos cerrados
  And la manta se dibuja en la capa "characters" justo después del personaje (z del personaje + 0,5)

Scenario: cama ocupada
  Given una cama con un personaje durmiendo
  When el jugador suelta a otro personaje sobre la cama
  Then se emite interactionRejected, la cama hace "shake" y suena el rechazo suave
  And el segundo personaje se coloca con "place" en pose "idle"

Scenario: un juguete sobre la cama se apoya
  Given una cama con surface
  When el jugador suelta un osito sobre la cama
  Then no se resuelve "core:sleep_on_bed"
  And el osito queda apoyado en el segmento de surface de la cama

@persistence
Scenario: el juguete sigue sobre la cama al volver
  Given un osito apoyado sobre la cama
  When el jugador viaja a otra escena y regresa
  Then el osito sigue sobre la cama en la misma posición

@persistence
Scenario: sigue durmiendo tras cerrar la app
  Given un personaje durmiendo en la cama
  When la app se cierra por completo y se vuelve a abrir
  Then el personaje sigue en pose "sleep" en la cama, con ojos cerrados y la manta delante
```
Incluye: AC-REJECT-01, AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Tocar a un personaje dormido: `tap_character` → `happy` 1,5 s (boca), sin despertarlo (ver HU-GAME-015).
- Soltar comida o bebida en la boca de un personaje dormido: `poseIsNot [sleep]` falla → rechazo amable y `place` (HU-GAME-042).
- Objeto apoyado sobre la cama sin nadie durmiendo: no hay manta separada (va en el sprite de la cama), así que el objeto se ve encima.
- Personaje dormido sosteniendo un objeto: se dibuja en `handAnchors.sleep`.

### Dependencias
- HU-GAME-045: SeatSystem y `seatFree`.

### Consideraciones técnicas
- SeatSystem (acción `sleep`), SurfaceSystem para objetos, render de `coverAsset` en el adaptador ([CHARACTER_SYSTEM §8](../../architecture/CHARACTER_SYSTEM.md)).
- Capa de la manta: `characters`, justo después del personaje dormido ([RENDERING §4](../../architecture/RENDERING.md)).
- Estado: [NEEDED NOW].

### Assets necesarios
- `env_home_bed_single` y `env_home_bed_single_cover` (manta) (placeholder aceptable: sí).
- `chr_body_{child|adult}_sleep_{capa}`: pose acostada (compartido con HU-GAME-014).
- `sfx_sleep_snore_soft` (placeholder: sí) — propuesta.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `sleep` con tests; render de la manta verificado a mano.
- [ ] Test de escenario "personaje + cama" y "objeto sobre cama" de INTERACTION_SYSTEM §4.
- [ ] Persistencia probada, incluido el ejemplo del juguete sobre la cama (AC-PERSIST-01/02).

---

## HU-GAME-047 — Objetos encendibles (lámpara, TV, grifo)

> **Status:** Draft
> **Epic:** EPIC-013 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-013 — Furniture

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **tocar la lámpara, la tele o el grifo para encenderlos y apagarlos**
para **que la casa reaccione a lo que hago**.

### Contexto
Encender y apagar es un cambio de `states.current` con la acción `toggleSwitch`, disparada por la regla `tap_switch` sobre cualquier entidad con `switchable` ([INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md), ejemplo de lámpara en [OBJECT_SCHEMA §5](../../data/OBJECT_SCHEMA.md)).

### Reglas de negocio
- R1: Regla `tap_switch`: trigger `tap`; target has `switchable`; sin condiciones; acción `toggleSwitch`; prioridad 10.
- R2: `toggleSwitch` alterna `states.current` entre `switchable.offState` y `switchable.onState`.
- R3: El sprite cambia por `sprite.byState`; suena `sounds.toggle`.
- R4: Encendibles del MVP: TV, lámpara de pie, fogón, lámpara de mesa, lavabo (grifo) y farola ([MVP_SCOPE](../../product/MVP_SCOPE.md)).
- R5: Sin iluminación dinámica ni shaders: "encendido" es un sprite distinto (luz pintada). Animaciones por frames (agua, llama, imagen de la TV) son [DESIGNED FOR LATER]; en el MVP el estado `on` es estático ([RENDERING §8-§9](../../architecture/RENDERING.md)).
- R6: **Propuesta:** un sonido en bucle mientras está encendido (TV, grifo) queda fuera del MVP; solo `toggle`.
- R7: Un encendible arrastrable (lámpara de pie) distingue tap y drag por el umbral de 6 dp.
- R8: El estado se persiste (`states.current`).

### Criterios de aceptación
```gherkin
Scenario: encender una lámpara
  Given una entidad con states { current: "off" } y switchable { onState: "on", offState: "off" } (lámpara de pie)
  When el jugador hace tap sobre ella
  Then se resuelve "core:tap_switch"
  And states.current es "on", el sprite es sprite.byState.on y suena sounds.toggle

Scenario: apagar
  Given la lámpara encendida
  When el jugador hace tap sobre ella
  Then states.current es "off"

Scenario: arrastrar no enciende
  Given una lámpara de pie apagada con draggable
  When el jugador la arrastra 200 unidades
  Then la lámpara se mueve y states.current sigue en "off"

@persistence
Scenario: sigue encendida al volver
  Given que el jugador dejó la TV encendida
  When viaja a otra escena y regresa
  Then la TV sigue encendida
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Entidad con `openable` y `switchable` a la vez: ambas reglas tap con prioridad 10; desempate por especificidad y por `id` alfabético (`tap_open` < `tap_switch`). **Propuesta:** evitarlo en el contenido del MVP.
- `switchable` con `onState` fuera de `states.values`: error del validador.
- Taps repetidos: el audio descarta el mismo sonido antes de 80 ms.

### Dependencias
- HU-GAME-032: interacciones por tap.
- HU-GAME-025: estados y sprites por estado.

### Consideraciones técnicas
- StateSystem (acción `toggleSwitch`).
- Estado: [NEEDED NOW] (P1); animación por frames [DESIGNED FOR LATER].

### Assets necesarios
- `env_home_lamp_floor_off` / `_on`, `env_home_lamp_table_off` / `_on`, `env_home_tv_off` / `_on`, `env_home_stove_off` / `_on`, `env_home_sink_off` / `_on` (placeholder aceptable: sí); `env_street_lamp_off` / `_on` (Fase 2).
- `sfx_switch_click`, `sfx_tap_water` (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `toggleSwitch` y regla `tap_switch` con tests.
- [ ] Prefabs encendibles del MVP pasan el validador.
- [ ] Persistencia probada (AC-PERSIST-01/02).

---

## HU-GAME-048 — Mover muebles

> **Status:** Draft
> **Epic:** EPIC-013 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-013 — Furniture

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **arrastrar el sofá, las sillas o la lámpara a otro sitio de la habitación**
para **decorar la casa a mi manera**.

### Contexto
Un mueble movible es una entidad con `draggable { mode: "floorOnly" }`: ignora las superficies y se apoya siempre en el suelo ([ENTITY_SCHEMA §5.4](../../data/ENTITY_SCHEMA.md), [INPUT_SYSTEM §7](../../architecture/INPUT_SYSTEM.md)). Los personajes sentados o dormidos y el contenido de los contenedores viajan con él porque su posición es relativa al mueble ([CHARACTER_SYSTEM §8](../../architecture/CHARACTER_SYSTEM.md), [INVENTORY_SYSTEM §1](../../architecture/INVENTORY_SYSTEM.md)). Los objetos apoyados sobre superficies son otra historia: **HU-GAME-030** (P2, [EPIC-007](EPIC-007-drag-drop.md)); aquí no se duplican.

### Reglas de negocio
- R1: Solo se mueven los muebles cuyo prefab declara `draggable` (con `mode: "floorOnly"`); los que no lo declaran (p. ej. la nevera del ejemplo de ENTITY_SCHEMA §6) son fijos.
- R2: Al soltar, ninguna regla aplica a muebles (las reglas de objetos excluyen el tag `furniture`), así que siempre se aplica `place`: va **directo al suelo** bajo `x`, ignorando superficies, con `x` limitada a `[0, scene.width]`.
- R3: Personajes con `pose.seatId` = el mueble (sentados o dormidos) se mueven con él: su transform se deriva del anchor. Siguen sentados/dormidos.
- R4: Los objetos dentro de un contenedor se mueven con él (location relativa al contenedor).
- R5: Objetos apoyados sobre su `surface`: **fuera de alcance**; los cubre HU-GAME-030 (P2).
- R6: Durante el drag, el mueble lo dibuja el DragProxy; si lleva un personaje sentado, **propuesta**: el proxy dibuja también al ocupante para que no "flote" en su sitio.
- R7: Tocar el mueble (tap) sigue resolviendo sus reglas tap (abrir, encender); el drag empieza solo con movimiento ≥ 6 dp.
- R8: Hit test: si un personaje sentado está delante del asiento, tocarlo arrastra al personaje (z del asiento + 1); para mover el mueble hay que tocar su parte visible.
- R9: Los muebles no se guardan en contenedores ni en la mochila, ni cruzan portales (esas reglas exigen `character` o excluyen `furniture`).
- R10: La nueva posición se persiste (`transform`), junto con la de los ocupantes derivados.

### Criterios de aceptación
```gherkin
Scenario: mover un mueble al suelo
  Given una entidad con tag "furniture" y draggable { mode: "floorOnly" } (una silla)
  When el jugador la arrastra y la suelta encima de una mesa con surface
  Then la silla ignora la surface y queda apoyada en el segmento de suelo bajo x

Scenario: el personaje sentado se mueve con el asiento
  Given un personaje sentado en un sillón con draggable floorOnly
  When el jugador arrastra el sillón 600 unidades a la derecha y lo suelta
  Then el personaje sigue en pose "sit" con el mismo seatId
  And su posición coincide con el anchor del sillón en la nueva posición

Scenario: el contenido de un contenedor se mueve con él
  Given una caja de juguetes movible con un objeto en el slot 0
  When el jugador la arrastra a otra posición
  Then el objeto sigue con location container en el slot 0 y se dibuja en la nueva posición de la caja

Scenario: un mueble no entra en la mochila
  Given una silla movible
  When el jugador la suelta sobre el botón de la mochila
  Then ninguna regla coincide y la silla se coloca en el suelo

Scenario: un mueble fijo no se arrastra
  Given un mueble sin draggable (la nevera)
  When el jugador intenta arrastrarlo
  Then el gesto se trata como tap o paneo de cámara y el mueble no se mueve

@persistence
Scenario: la nueva distribución persiste
  Given que el jugador movió el sofá con un personaje sentado
  When la app se cierra por completo y se vuelve a abrir
  Then el sofá está en su nueva posición y el personaje sigue sentado en él
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-PERF-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Soltar un mueble encima de otro mueble: se superponen; no hay colisiones en el MVP (**propuesta**: el orden de dibujo sigue `z`/`transform.y`).
- Mover un mueble a otra zona (cocina → salón): permitido; las zonas no bloquean.
- Mueble con objetos encima (mesa con una manzana): sin HU-GAME-030 la manzana **no** se mueve con el mueble. Si al moverlo se queda sin soporte, **cae** (acción `place` en su x actual) a la superficie de debajo o al suelo. Nunca queda flotando ([INPUT_SYSTEM §7](../../architecture/INPUT_SYSTEM.md)).
- Arrastre interrumpido: el mueble y sus ocupantes vuelven a la posición de origen.
- Mueble arrastrado hasta tapar un portal: permitido; la puerta sigue siendo tocable si queda delante en z (**propuesta**: diseño de escena evita muebles movibles junto a puertas).

### Dependencias
- HU-GAME-027: arrastrar objetos.
- HU-GAME-028: soltar sobre superficies y suelo (modo `floorOnly`).
- Relacionada: HU-GAME-030 (P2) — objetos apoyados que se mueven con el mueble.

### Consideraciones técnicas
- DragSystem + SurfaceSystem (`floorOnly`), SeatSystem (transform derivado del anchor), ContainerSystem (slots relativos).
- `transform.parentId` es [DESIGNED FOR LATER] para HU-GAME-030; esta HU no lo usa.
- El autosave marca sucio el mueble y los ocupantes cuyo transform derivado cambia (o se deriva al cargar; decidir en implementación).
- Estado: [NEEDED NOW] (P1).

### Assets necesarios
- Ninguno nuevo; usa los sprites de los muebles. `sfx_drag_furniture` y `sfx_drop_wood` (placeholder aceptable: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests de escenario: `floorOnly`, ocupante sentado, contenedor con contenido, mueble fijo.
- [ ] Verificación manual del DragProxy con ocupante en dispositivo.
- [ ] Persistencia probada (AC-PERSIST-01/02).
