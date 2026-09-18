# EPIC-004 — Character System

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [CHARACTER_SYSTEM](../../architecture/CHARACTER_SYSTEM.md) · [CHARACTER_SCHEMA](../../data/CHARACTER_SCHEMA.md) · [RENDERING](../../architecture/RENDERING.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [INPUT_SYSTEM](../../architecture/INPUT_SYSTEM.md) · [ECS](../../architecture/ECS.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md)

## Objetivo del epic
Que los personajes existan en el mundo como entidades de capas 2D sin esqueleto: se dibujan con un orden fijo de 18 capas, cambian de pose y de expresión, sostienen objetos en las manos y se arrastran con el dedo. Todo el comportamiento sale de componentes (`character`, `appearance`, `pose`, `expression`, `holder`) y de las reglas de datos del pack `core`, nunca de código por personaje.

## Historias
- [HU-GAME-013 — Renderizar un personaje por capas](#hu-game-013--renderizar-un-personaje-por-capas)
- [HU-GAME-014 — Poses del personaje](#hu-game-014--poses-del-personaje)
- [HU-GAME-015 — Expresiones faciales](#hu-game-015--expresiones-faciales)
- [HU-GAME-016 — Sostener objetos en las manos](#hu-game-016--sostener-objetos-en-las-manos)
- [HU-GAME-017 — Arrastrar personajes](#hu-game-017--arrastrar-personajes)

---

## HU-GAME-013 — Renderizar un personaje por capas

> **Status:** Draft
> **Epic:** EPIC-004 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-004 — Character System

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **ver a mis personajes dibujados en la escena con su cuerpo, cara, pelo y ropa**
para **reconocerlos y sentir que son míos**.

### Contexto
El personaje es una pila de sprites 2D que comparten pivot, elegidos según tipo de cuerpo, pose, apariencia y ropa vestida ([CHARACTER_SYSTEM §1-§3](../../architecture/CHARACTER_SYSTEM.md)). Esta HU crea el selector puro `selectCharacterLayers(world, id)` y el componente de render que dibuja un personaje como **un único `Group` de Skia**. Es la base de todo el EPIC-004, del creador (EPIC-005) y de la ropa (EPIC-011). El catálogo de partes sale de `content/core/characters/parts.json` ([CHARACTER_SCHEMA §1](../../data/CHARACTER_SCHEMA.md)).

### Reglas de negocio
- R1: El orden de dibujo es **fijo** y lo define el motor, de atrás hacia delante: `shadow → hairBack → legs → bottomClothes → shoes → torso → torsoClothes → armL → armClothesL → heldL → armR → armClothesR → heldR → head → eyes → mouth → hairFront → accessories` (18 capas, [CHARACTER_SCHEMA §3](../../data/CHARACTER_SCHEMA.md)). `accessories` queda vacía en el MVP [DESIGNED FOR LATER].
- R2: Todas las capas de un tipo de cuerpo comparten lienzo y pivot (centro inferior, entre los pies). No hay offsets por capa.
- R3: Resolución de sprite por capa según [CHARACTER_SYSTEM §3](../../architecture/CHARACTER_SYSTEM.md):
  - cuerpo: `bodyTypes[bodyType].layers[pose][layer]`; si falta, `layers.idle[layer]`;
  - ropa: `wearable.bodyVariants[bodyType][layer]`; si falta, `wearable.layers[layer]`; variante por pose `"{asset}_{pose}"` solo si existe en el manifest;
  - pelo: `hairStyles[hairStyle].byBodyType[bodyType]`; si falta, `hairStyles[hairStyle]` (`back` es opcional);
  - ojos: `closedAsset` si la expresión es `sleepy` o la pose es `sleep`; si no, `asset`;
  - boca: `mouths[mouth].byExpression[expression]`; si falta, `asset`.
- R4: Las capas `legs`, `torso`, `armL`, `armR` y `head` se tiñen con el color de `skinTones[skinTone]`; `hairBack` y `hairFront` con `hairColors[hairColor]`. La ropa **no** se tiñe (viene coloreada). La técnica de tinte (`ColorMatrix` o `BlendMode.Multiply`) la fija el spike de la Fase 1 ([CHARACTER_SYSTEM §4](../../architecture/CHARACTER_SYSTEM.md)).
- R5: `shadow` es una elipse generada por el motor, no un asset.
- R6: El personaje se dibuja en la capa `characters` con `z = transform.y` (quien está más abajo en pantalla se dibuja delante). Si está sentado o dormido, `z = z del asiento + 1` ([RENDERING §4](../../architecture/RENDERING.md)).
- R7: `selectCharacterLayers` es **puro y memoizado**: solo se recalcula cuando cambian los componentes del personaje o de las prendas que viste. No hay re-render de React por frame.
- R8: La hitbox estándar del personaje (zonas `head`, `mouth`, `handL`, `handR`, `body` y las bandas `torso`, `legs`, `feet` dentro de `body`) la genera el motor a partir de `bodyTypes[].height` ([CHARACTER_SCHEMA §4](../../data/CHARACTER_SCHEMA.md)); no se define por personaje.
- R9: Todos los personajes (≤ 12) están siempre cargados como entidades globales, pero solo se renderizan y son tocables los de la escena activa ([GAME_ENGINE §3](../../architecture/GAME_ENGINE.md)).
- R10: Si falta un asset referenciado, la capa se omite y se registra `logger.warn` (en dev); el personaje nunca deja de dibujarse ni aparece un error al niño.

### Criterios de aceptación
```gherkin
Scenario: el personaje se dibuja con todas sus capas en orden
  Given un personaje con appearance { bodyType: "child", skinTone: "skin_04", hairStyle: "hair_buns" } en pose "idle"
  And que viste una prenda con slot "top"
  When se evalúa selectCharacterLayers para ese personaje
  Then la lista de capas respeta el orden fijo de CHARACTER_SCHEMA §3
  And la capa "torsoClothes" usa el asset de la prenda vestida
  And las capas de cuerpo llevan el tinte del tono "skin_04"

Scenario: fallback al sprite de idle cuando la pose no define una capa
  Given un bodyType cuyo set de la pose "sit" no define la capa "head"
  And un personaje de ese cuerpo en pose "sit"
  When se evalúa selectCharacterLayers
  Then la capa "head" usa bodyTypes[bodyType].layers.idle.head

Scenario: variante de prenda por tipo de cuerpo
  Given una prenda con bodyVariants.adult.torsoClothes definido
  When la viste un personaje con bodyType "adult"
  Then la capa "torsoClothes" usa la variante de "adult"
  And si la viste un personaje "child" sin variante, usa wearable.layers.torsoClothes

Scenario: orden de profundidad entre personajes
  Given dos personajes de pie en la misma escena, A con transform.y 900 y B con transform.y 960
  When se renderiza la capa "characters"
  Then B se dibuja delante de A

Scenario: asset ausente no rompe el personaje
  Given un personaje cuyo peinado referencia una clave "back" que no está en el manifest
  When se renderiza
  Then se omite la capa "hairBack", el resto de capas se dibuja
  And en dev se registra una advertencia

Scenario: memoización del selector
  Given un personaje ya renderizado
  When cambia el transform de otra entidad de la escena
  Then selectCharacterLayers devuelve la misma referencia para el personaje
```
Incluye: AC-PERF-01 (12 personajes en la misma escena, caso peor de [CHARACTER_SCHEMA §6](../../data/CHARACTER_SCHEMA.md)) (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- 12 personajes en pantalla a la vez: presupuesto de [PERFORMANCE](../../architecture/PERFORMANCE.md); se mide con el overlay (HU-GAME-071).
- Personaje sin prenda en un slot: las capas de ropa de ese slot quedan vacías; se ve el cuerpo base (ver nota de assets).
- Peinado sin `back` (pelo corto): `hairBack` vacía.
- Personaje con `flipX: true`: todo el `Group` se refleja, incluidas las capas `held*`.

### Dependencias
- HU-GAME-006: capas de render y orden z.
- HU-GAME-068 (vía 006/010): el catálogo `characters/parts.json` se carga y valida con el pack `core`.

### Consideraciones técnicas
- Selector en `engine/` (puro, sin Skia); componente `CharacterSprite` en `engine/adapters/render/` que se suscribe con `useEntity(id)` ([GAME_ENGINE §6](../../architecture/GAME_ENGINE.md)).
- Expuesto a la UI como `selectors.characterLayers(id)` del GameFacade; el creador (HU-GAME-018) usa la misma resolución mediante `previewCharacterLayers(draft)`.
- Spike de tinte de la Fase 1: comparar `ColorMatrix` y `BlendMode.Multiply` con el estilo final; plan B sprites pre-coloreados ([CHARACTER_SYSTEM §4](../../architecture/CHARACTER_SYSTEM.md)). **El resultado del spike es un ADR** antes de dar la HU por Done.
- Estado: selector y render [NEEDED NOW]; `accessories` [DESIGNED FOR LATER]; rig esquelético [DESIGNED FOR LATER].

### Assets necesarios
- `chr_body_child_idle_{legs|torso|arml|armr|head}`: cuerpo niño en idle, escala de grises (placeholder aceptable: sí).
- `chr_body_adult_idle_{legs|torso|arml|armr|head}`: cuerpo adulto en idle, escala de grises (placeholder: sí).
- `chr_eyes_{id}` y `chr_eyes_{id}_closed`: 1 par mínimo para esta HU (placeholder: sí).
- `chr_mouth_{id}`: 1 mínimo (placeholder: sí).
- `chr_hair_{id}_front` / `chr_hair_{id}_back`: 1 peinado mínimo (placeholder: sí).
- El cuerpo base debe incluir ropa interior pintada (niños sin prenda nunca se ven desnudos) — requisito para [CHARACTER_GUIDELINES](../../design/CHARACTER_GUIDELINES.md).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] `selectCharacterLayers` implementado con todas las reglas de resolución de R3.
- [ ] Tests unitarios del selector: orden, fallbacks de pose, bodyVariants, ojos cerrados, boca por expresión, memoización.
- [ ] Verificación manual en dispositivo del tinte y del orden visual (captura en la HU).
- [ ] Medición con 12 personajes en escena anotada en la HU.
- [ ] ADR del spike de tinte aceptado.

---

## HU-GAME-014 — Poses del personaje

> **Status:** Draft
> **Epic:** EPIC-004 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-004 — Character System

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **que mi personaje cambie de postura (de pie, colgando, sentado, durmiendo, comiendo, bebiendo)**
para **que lo que hago con él se vea vivo y claro sin leer nada**.

### Contexto
El componente `pose` (`current`, `seatId?`, `returnTo?`) es propiedad del CharacterSystem ([CHARACTER_SCHEMA §2](../../data/CHARACTER_SCHEMA.md)). Esta HU implementa la máquina de poses, la distinción persistente/temporal y los tweens de presentación asociados ([CHARACTER_SYSTEM §5 y §8](../../architecture/CHARACTER_SYSTEM.md)). Las acciones que llevan a `sit`, `sleep`, `eat` y `drink` se implementan en HU-GAME-045, 046, 042 y 043; aquí se deja la infraestructura de pose que ellas usan.

### Reglas de negocio
- R1: Poses v1: `idle`, `dangle`, `sit`, `sleep`, `eat`, `drink`.
- R2: **Persistentes** (se guardan): `idle`, `sit`, `sleep` (+ `seatId`). **Temporales** (no se guardan): `dangle`, `eat`, `drink`. Al cargar, una pose temporal se normaliza a `returnTo` o a `idle` ([SAVE_SCHEMA §2](../../data/SAVE_SCHEMA.md)).
- R3: `eat` y `drink` duran **unos 900 ms** y al terminar vuelven a `returnTo`. `returnTo` es la pose persistente previa (`idle` o `sit`).
- R4: Si el personaje empieza a arrastrarse durante una pose temporal, esta se cancela y pasa a `dangle`.
- R5: Transiciones válidas según el diagrama de [CHARACTER_SYSTEM §8](../../architecture/CHARACTER_SYSTEM.md): `idle→dangle`, `dangle→idle` (drop sin regla), `dangle→sit`, `dangle→sleep`, `sit→dangle` y `sleep→dangle` (standUp implícito), `idle→eat`, `sit→eat`, `eat→returnTo`. `drink` se comporta igual que `eat`.
- R6: Visual de `idle`: respiración con tween de escala Y ±1,5 %. Con varios personajes, un **único reloj compartido** con desfase por personaje ([RENDERING §9](../../architecture/RENDERING.md)).
- R7: Visual de `dangle`: piernas colgando y balanceo según la velocidad horizontal del dedo, calculado en el UI thread (sin cruzar a JS por frame).
- R8: Los sprites de cada pose salen de `bodyTypes[].layers[pose]` con fallback a `idle` (HU-GAME-013 R3).
- R9: Un cambio de pose emite `entityChanged`; solo las persistentes marcan la entidad como sucia para el autosave.

### Criterios de aceptación
```gherkin
Scenario: pose temporal vuelve a la persistente previa
  Given un personaje en pose "sit" sobre un asiento
  When el CharacterSystem aplica la pose "eat" con returnTo "sit"
  Then la pose actual es "eat"
  And tras unos 900 ms (reloj falso del harness) la pose vuelve a "sit" con el mismo seatId

Scenario: el arrastre cancela una pose temporal
  Given un personaje en pose "eat" con returnTo "idle"
  When empieza un dragStart sobre el personaje
  Then la pose pasa a "dangle"
  And no se vuelve a aplicar "idle" al vencer el temporizador de "eat"

Scenario: transición no válida se ignora
  Given un personaje en pose "sleep"
  When se solicita directamente la pose "eat" sin pasar por dangle
  Then la pose sigue siendo "sleep"
  And en dev se registra una advertencia de transición inválida

Scenario: las poses temporales no se guardan
  Given un personaje en pose "drink" con returnTo "idle"
  When el SaveService serializa el personaje
  Then el SavedEntity contiene pose { current: "idle" }

@persistence
Scenario: la pose persistente sobrevive a cerrar la app
  Given un personaje en pose "sit" con seatId "core:home/sofa"
  When la app se cierra por completo y se vuelve a abrir
  Then el personaje está en pose "sit" anclado a "core:home/sofa"

@manual
Scenario: respiración y balanceo
  Given 3 personajes en idle en pantalla
  When el jugador observa 5 segundos y luego arrastra uno de lado a lado
  Then los tres respiran desfasados y el arrastrado balancea las piernas según la velocidad
```
Incluye: AC-PERSIST-01, AC-PERSIST-02 (pose `sit`/`sleep`), AC-PERF-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Se cierra la app durante `eat`: al abrir, el personaje está en `returnTo`.
- `seatId` guardado apunta a un asiento que ya no existe (prefab eliminado): la pose se normaliza a `idle` en el suelo y se registra advertencia ([SAVE_SYSTEM §5](../../architecture/SAVE_SYSTEM.md)).
- Dos `eat` seguidos antes de 900 ms: ver HU-GAME-042 (el temporizador se reinicia y `returnTo` no se sobrescribe con `eat`) — propuesta.

### Dependencias
- HU-GAME-013: render por capas y resolución de sprites por pose.

### Consideraciones técnicas
- CharacterSystem ([ECS §5](../../architecture/ECS.md)); temporizadores con el `clock` inyectado para que sean deterministas en el harness ([GAME_ENGINE §2](../../architecture/GAME_ENGINE.md)).
- Tweens `idle`/`dangle` en el adaptador de render con SharedValues ([ADR-009](../../decisions/ADR-009-STATE-AND-THREADING.md)).
- Estado: poses v1 [NEEDED NOW]; nuevas poses de packs futuros [DESIGNED FOR LATER] (el tipo `PoseId` es del motor).

### Assets necesarios
- `chr_body_{child|adult}_{dangle|sit|sleep|eat|drink}_{capa}`: sprites de cuerpo por pose en escala de grises (placeholder aceptable: sí; si faltan, fallback a idle).
- `fx_crumbs_01`: efecto de migas para `eat` (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Máquina de poses con transiciones de R5 y tests unitarios de cada una.
- [ ] Normalización de poses temporales en el serializer con test.
- [ ] Tweens de idle y dangle verificados a mano en Android de gama baja.
- [ ] Persistencia de `sit`/`sleep` probada (AC-PERSIST-01/02).

---

## HU-GAME-015 — Expresiones faciales

> **Status:** Draft
> **Epic:** EPIC-004 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-004 — Character System

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **que la cara de mi personaje reaccione (se alegra, se sorprende, tiene sueño, dice "ñam")**
para **entender lo que siente sin leer**.

### Contexto
El componente `expression` (`current`, `untilMs?`) no se persiste ([CHARACTER_SCHEMA §2](../../data/CHARACTER_SCHEMA.md)). La acción `setExpression(character, expression, durationMs?)` existe en el conjunto cerrado ([INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md)) y la regla `tap_character` la usa. El resto de expresiones son automáticas según eventos ([CHARACTER_SYSTEM §9](../../architecture/CHARACTER_SYSTEM.md)).

### Reglas de negocio
- R1: Expresiones v1: `neutral`, `happy`, `surprised`, `sleepy`, `yum`, `curious`.
- R2: `setExpression(expr, durationMs)` fija `current` y `untilMs`; al vencer vuelve a `neutral`. El temporizador es un `setTimeout` **por personaje**, no un tick por frame, y se cancela si la expresión cambia antes.
- R3: Regla `tap_character` (trigger `tap`, target has `character`, prio 5): `setExpression(happy, 1500)`.
- R4: Expresiones automáticas: tap → `happy` 1,5 s; comer o beber → `yum` mientras dura la pose; empezar a arrastrar → `surprised` mientras dura `dangle`; dormir → `sleepy` (ojos cerrados); recibir una prenda → `happy` 1 s.
- R5: La expresión afecta a `eyes` (`closedAsset` con `sleepy`) y a `mouth` (`byExpression[expression]`, fallback `asset`).
- R6: No se persiste: al cargar la partida todos los personajes empiezan en `neutral`. Un personaje en pose `sleep` sigue viéndose con ojos cerrados por la pose (HU-GAME-013 R3).
- R7: Expresión ligada a pose (`surprised` en `dangle`, `yum` en `eat`/`drink`, `sleepy` en `sleep`) termina al salir de esa pose.

### Criterios de aceptación
```gherkin
Scenario: tocar un personaje lo pone contento
  Given un personaje en idle con expresión "neutral"
  When el jugador hace tap sobre el personaje
  Then se resuelve la regla "core:tap_character"
  And la expresión es "happy"
  And tras 1500 ms (reloj falso) vuelve a "neutral"

Scenario: un segundo tap reinicia el temporizador
  Given un personaje con "happy" al que le quedan 300 ms
  When el jugador vuelve a hacer tap sobre él
  Then la expresión sigue en "happy" y vence 1500 ms después del segundo tap

Scenario: sorpresa mientras se arrastra
  Given un personaje en idle
  When empieza un dragStart sobre el personaje
  Then la expresión es "surprised"
  And al soltarlo sin regla la expresión vuelve a "neutral"

Scenario: la boca cambia según la expresión
  Given una boca con byExpression.yum definido
  When el personaje pasa a expresión "yum"
  Then la capa "mouth" usa el asset de byExpression.yum

Scenario: la expresión no se guarda
  Given un personaje con expresión "happy"
  When la app se cierra por completo y se vuelve a abrir
  Then el personaje tiene expresión "neutral"
```
Incluye: AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Tap sobre un personaje dormido: `happy` 1,5 s cambia la boca, pero los ojos siguen cerrados por la pose `sleep`. **Pregunta abierta:** ¿debería el tap despertarlo? (no documentado; en el MVP no lo despierta).
- Boca sin variante para la expresión: se usa `asset`.
- Personaje eliminado o descargado con un temporizador pendiente: el temporizador se cancela.
- `curious` no tiene disparador automático en v1; queda disponible para reglas de packs.

### Dependencias
- HU-GAME-013: resolución de ojos y boca por expresión.
- HU-GAME-032 (vía EPIC-008): reglas `tap`.

### Consideraciones técnicas
- CharacterSystem + acción `setExpression` ([INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md), estado NOW P1).
- Los `setTimeout` usan el `clock`/scheduler inyectado para tests deterministas.
- Estado: [NEEDED NOW] (P1).

### Assets necesarios
- `chr_mouth_{id}_{happy|surprised|yum}`: variantes por expresión de las 6 bocas (placeholder aceptable: sí).
- `chr_eyes_{id}_closed`: ojos cerrados de los 6 ojos (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `setExpression` con `validate`/`execute` y tests.
- [ ] Regla `tap_character` en `core.rules.json` validada por el validador de contenido.
- [ ] Tests de temporizador (vencimiento, reinicio, cancelación) con reloj falso.
- [ ] Verificación manual sin lectura (AC-A11Y-01).

---

## HU-GAME-016 — Sostener objetos en las manos

> **Status:** Draft
> **Epic:** EPIC-004 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-004 — Character System

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **dar un objeto a mi personaje soltándolo sobre su mano**
para **que lo lleve consigo por la casa y a otros sitios**.

### Contexto
Sostener es un cambio de location a `held { holderId, hand }` ([ECS §4](../../architecture/ECS.md)). Lo resuelve la regla `hold_item` y la acción `hold` del HoldSystem ([INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md), [CHARACTER_SYSTEM §6](../../architecture/CHARACTER_SYSTEM.md)). El componente `holder` solo declara las manos disponibles; lo sostenido es un índice derivado (`world.index.heldBy`).

### Reglas de negocio
- R1: Regla `hold_item`: trigger `drop`, source has `draggable` y notTags `furniture`, `character`; target has `holder`, zona `handL`/`handR`/`body`; condición `handFree`; acción `hold`; prioridad 50.
- R2: Elección de mano: la de la **zona** tocada (`handL` → `left`, `handR` → `right`) si está libre; si no, la otra mano libre; si ninguna está libre, `handFree` falla.
- R3: Zona `body` (sin mano concreta): primero la mano `right` y después la `left` ([CHARACTER_SYSTEM §6](../../architecture/CHARACTER_SYSTEM.md)).
- R4: Prioridades: si el source tiene `edible`/`drinkable` y cae en `mouth`/`head`, gana `eat_food`/`drink_drink` (100). Si una prenda cae en `body`/`torso`/`legs`/`feet`, gana `wear_clothes` (90). `hold_item` (50) aplica en las manos y como fallback en `body`.
- R5: El objeto sostenido se dibuja **dentro del grupo del personaje**, en la capa `heldL`/`heldR`, a escala 0,8, alineado en `handAnchors[pose][hand]`.
- R6: Al arrastrar al personaje, lo sostenido va con él; al viajar por un portal viaja con él (location `held` intacta).
- R7: Arrastrar el objeto sostenido lo saca de la mano: location → escena en la posición del dedo ([INTERACTION_SYSTEM §5](../../architecture/INTERACTION_SYSTEM.md)).
- R8: Guardar un objeto sostenido (contenedor o mochila) lo saca de la mano y lo guarda en **una sola transacción**.
- R9: Comer o beber algo que ya se sostiene es [DESIGNED FOR LATER]; en el MVP solo se come arrastrando la comida a la boca.
- R10: Lo sostenido es entidad global: se persiste con location `held` y se carga al inicio con los personajes.

### Criterios de aceptación
```gherkin
Scenario: soltar un objeto en la mano libre
  Given un personaje con ambas manos libres
  And un objeto con draggable sin tags furniture ni character (una pelota)
  When el jugador suelta el objeto sobre la zona "handL" del personaje
  Then se resuelve "core:hold_item"
  And el objeto tiene location { kind: "held", holderId: personaje, hand: "left" }
  And se dibuja en la capa "heldL" a escala 0,8

Scenario: la mano tocada está ocupada y se usa la otra
  Given un personaje que sostiene algo en la mano izquierda
  When el jugador suelta otro objeto sobre la zona "handL"
  Then el objeto queda en la mano "right"

Scenario: ambas manos ocupadas
  Given un personaje con las dos manos ocupadas
  When el jugador suelta un tercer objeto sobre la zona "handR"
  Then la condición handFree falla y se emite interactionRejected
  And el personaje hace "shake", suena el rechazo suave
  And el objeto se coloca con "place" bajo el punto de soltado

Scenario: la comida en la boca se come, no se sostiene
  Given un objeto con edible
  When el jugador lo suelta sobre la zona "mouth" del personaje
  Then se resuelve "core:eat_food" y no "core:hold_item"

Scenario: lo sostenido va con el personaje
  Given un personaje que sostiene un objeto en la mano derecha
  When el jugador arrastra al personaje y lo suelta 800 unidades a la derecha
  Then el objeto sigue con location "held" en la mano "right"

Scenario: sacar el objeto de la mano arrastrándolo
  Given un personaje que sostiene un objeto
  When el jugador arrastra el objeto y lo suelta sobre el suelo
  Then el objeto tiene location "scene" y las dos manos del personaje quedan libres

@persistence
Scenario: lo sostenido sobrevive a cerrar la app
  Given un personaje que sostiene un objeto en la mano izquierda
  When la app se cierra por completo y se vuelve a abrir
  Then el objeto sigue en la mano izquierda del personaje
```
Incluye: AC-REJECT-01, AC-PERSIST-01, AC-PERSIST-02 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Soltar un mueble o un personaje sobre la mano: el matcher no coincide (notTags) → `place`.
- Soltar un objeto sobre la mano de un personaje dormido: `hold_item` no comprueba la pose; lo sostiene con `handAnchors.sleep`. **Pregunta abierta** si es deseable.
- Objeto sostenido que es comida parcialmente comida: conserva `bitesLeft`.
- Producto sin comprar sostenido que intenta salir de la tienda: ver EPIC-019 (`notPurchased`).

### Dependencias
- HU-GAME-014: `handAnchors` por pose.
- HU-GAME-031: resolución de reglas `drop`.

### Consideraciones técnicas
- HoldSystem + acciones `hold`/`release`; `LocationService.move` para el cambio de location ([ECS §4](../../architecture/ECS.md)).
- El InteractionResolver excluye de los candidatos lo que el source lleva encima ([INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md)).
- DragSystem: liberación implícita al empezar a arrastrar un objeto `held`.
- Estado: [NEEDED NOW].

### Assets necesarios
- Ninguno nuevo: el objeto sostenido usa su propio `sprite`. Datos `handAnchors` por pose en `parts.json` (placeholder aceptable: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acciones `hold` y `release` con tests; condición `handFree` con tests.
- [ ] Test de escenario en el harness para cada escenario automatizable.
- [ ] Persistencia de `held` probada (AC-PERSIST-01/02).
- [ ] Test de la elección de mano con zona `body` (derecha primero).

---

## HU-GAME-017 — Arrastrar personajes

> **Status:** Draft
> **Epic:** EPIC-004 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-004 — Character System

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **levantar a mi personaje con el dedo y llevarlo a cualquier sitio de la escena**
para **moverlo por la casa como en una casa de muñecas**.

### Contexto
No hay pathfinding ni caminar automático: los personajes se mueven arrastrándolos ([SCENE_SYSTEM §5](../../architecture/SCENE_SYSTEM.md)). El personaje tiene `draggable` como cualquier entidad, así que reutiliza el drag de HU-GAME-027; esta HU añade lo específico del personaje: pose `dangle`, `standUp` implícito, expresión `surprised` y el destino de soltado ([CHARACTER_SYSTEM §5, §8](../../architecture/CHARACTER_SYSTEM.md), [INTERACTION_SYSTEM §5](../../architecture/INTERACTION_SYSTEM.md)).

### Reglas de negocio
- R1: El drag empieza **sin espera** al mover ≥ 6 dp sobre el personaje ([INPUT_SYSTEM §2](../../architecture/INPUT_SYSTEM.md)); tap (< 250 ms, < 10 dp) → regla `tap_character`.
- R2: Al empezar el drag: si estaba en `sit` o `sleep`, se ejecuta `standUp` implícito (libera el asiento); si estaba en pose temporal, se cancela; la pose pasa a `dangle` y la expresión a `surprised`.
- R3: Mientras dura el drag lo dibuja el DragProxy (`liftOffset`, escala 1,05, sombra). El World solo cambia en `dragStart` (transiciones de R2) y en `dragEnd`; nunca por frame ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md)).
- R4: Lo que el personaje sostiene viaja con él (HU-GAME-016 R6). Las prendas vestidas también.
- R5: Al soltar, se resuelven reglas `drop` con el personaje como source: `travel_portal` (95), `sleep_on_bed` (85), `sit_on_seat` (80). Las reglas de objetos (`hold_item`, `store_in_container`, `store_in_backpack`) **no** coinciden porque excluyen el tag `character`.
- R6: Sin regla aplicable: fallback `place` y pose `idle`, apoyado en el suelo o en una superficie; la expresión vuelve a `neutral`.
- R7: Auto-scroll de cámara al acercarse al borde (zona del 12 % del ancho, máx. 1400 u/s; HU-GAME-029).
- R8: `dragCancel` (llamada, background) deshace las transiciones de `dragStart`: el personaje vuelve a su location, posición y pose persistente originales (si estaba sentado o dormido, vuelve a ocupar el mismo asiento o cama) ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).
- R9: Un solo puntero activo; un segundo dedo se ignora. No empieza drag en el margen de 16 dp de los bordes.

### Criterios de aceptación
```gherkin
Scenario: levantar y soltar un personaje en el suelo
  Given un personaje en idle
  When el jugador lo arrastra y lo suelta sobre el suelo sin ninguna entidad debajo
  Then durante el arrastre la pose es "dangle" y la expresión "surprised"
  And al soltar se aplica "place" y la pose es "idle"
  And su transform.y coincide con el segmento de suelo bajo el punto

Scenario: levantar a un personaje sentado libera el asiento
  Given un personaje en pose "sit" en un asiento
  When empieza un dragStart sobre el personaje
  Then se ejecuta standUp implícito y el asiento queda libre
  And la pose es "dangle"

Scenario: soltar sobre un asiento libre lo sienta
  Given un asiento libre con componente seat
  When el jugador suelta al personaje sobre el asiento
  Then se resuelve "core:sit_on_seat" y la pose es "sit"

Scenario: soltar un personaje sobre la mochila no lo guarda
  Given la mochila con espacio
  When el jugador suelta al personaje sobre el botón de la mochila
  Then ninguna regla coincide y el personaje se coloca con "place" bajo el punto
  And el personaje sigue con location "scene"

Scenario: arrastre interrumpido
  Given un personaje sentado en una silla que se está arrastrando
  When el gesto se cancela por una interrupción del sistema
  Then se deshace el standUp implícito
  And el personaje vuelve a pose "sit" en la misma silla y a su posición de origen

Scenario: persistencia de la nueva posición
  Given que el jugador soltó un personaje en otra zona de la escena
  When viaja a otra escena y regresa
  Then el personaje está en la posición donde lo soltó
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-PERF-01, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Soltar un personaje encima de otro personaje: sin regla → `place` al lado/encima del suelo bajo el punto; ambos se ordenan por `transform.y`.
- Soltar fuera de la escena: `x` se limita a `[0, scene.width]` ([INPUT_SYSTEM §7](../../architecture/INPUT_SYSTEM.md)).
- Personaje sentado tapado por el respaldo: el hit test toma primero lo más cercano al frente; el personaje (z asiento + 1) queda delante.
- Arrastrar un personaje que está comiendo: la pose `eat` se cancela; el mordisco ya aplicado no se revierte.

### Dependencias
- HU-GAME-014: poses `dangle`/`idle` y cancelación de temporales.
- HU-GAME-027: drag genérico y DragProxy.

### Consideraciones técnicas
- DragSystem (standUp implícito al empezar), SeatSystem (`standUp`), CharacterSystem (pose y expresión) ([ECS §5](../../architecture/ECS.md)).
- Las transiciones de location/pose de [INTERACTION_SYSTEM §5](../../architecture/INTERACTION_SYSTEM.md) ocurren en `dragStart` y `dragCancel` las deshace ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md)).
- Todos los personajes (≤ 12) están siempre cargados como entidades globales; solo los de la escena activa se renderizan y son tocables ([GAME_ENGINE §3](../../architecture/GAME_ENGINE.md)).
- Estado: [NEEDED NOW]; multitouch [DESIGNED FOR LATER] (HU-GAME-101).

### Assets necesarios
- `chr_body_{child|adult}_dangle_{capa}` (compartido con HU-GAME-014; placeholder aceptable: sí).
- `sfx_pickup_character` y `sfx_drop_character`: sonidos de levantar y soltar un personaje (placeholder: sí) — propuesta de claves.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests de escenario en el harness: drop en suelo, en asiento, sobre la mochila, cancelación.
- [ ] Verificación manual en dispositivo del balanceo y del auto-scroll.
- [ ] Medición del drag con el overlay (sin re-renders de React por frame).
- [ ] Persistencia de posición probada (AC-PERSIST-01/02).
