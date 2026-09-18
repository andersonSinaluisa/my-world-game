# EPIC-014 — Scene Navigation

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 2
> **Docs:** [SCENE_SYSTEM](../../architecture/SCENE_SYSTEM.md) · [SCENE_SCHEMA](../../data/SCENE_SCHEMA.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [INTERACTION_SYSTEM](../../architecture/INTERACTION_SYSTEM.md) · [RENDERING](../../architecture/RENDERING.md) · [AUDIO_SYSTEM](../../architecture/AUDIO_SYSTEM.md) · [SAVE_SYSTEM](../../architecture/SAVE_SYSTEM.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md) · [CONTENT_PACK_SCHEMA](../../data/CONTENT_PACK_SCHEMA.md)

## Objetivo del epic
Conectar las tres escenas del MVP (`core:home`, `core:street`, `core:store`) para que el niño pueda llevar a sus personajes, y lo que sostienen, de un lugar a otro soltándolos sobre una puerta, con una transición corta y sin texto, y saltar entre lugares y habitaciones desde un mapa. Todo el comportamiento sale de datos (`portal`, spawn points, zonas, `provides.locations`), sin lógica específica de escena.

## Historias
- [HU-GAME-049 — Puertas y portales entre escenas](#hu-game-049--puertas-y-portales-entre-escenas)
- [HU-GAME-050 — Transición entre escenas](#hu-game-050--transición-entre-escenas)
- [HU-GAME-051 — Mapa de ubicaciones](#hu-game-051--mapa-de-ubicaciones)

---

## HU-GAME-049 — Puertas y portales entre escenas

> **Status:** Draft
> **Epic:** EPIC-014 · **Fase:** 2 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-014 — Scene Navigation

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **soltar a mi personaje sobre una puerta para que aparezca en otro lugar**
para **ir de mi casa a la calle y a la tienda llevando conmigo lo que tengo en las manos**.

### Contexto
El MVP tiene tres escenas conectadas por puertas ([SCENE_SYSTEM §1](../../architecture/SCENE_SYSTEM.md)). Una puerta es una entidad con el componente `portal` ([ENTITY_SCHEMA §5.12](../../data/ENTITY_SCHEMA.md)); la regla global `core:travel_portal` (drop, source `character`, target `portal`, prioridad 95) ejecuta la acción `teleport` ([INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md)). El motor no sabe qué puerta es cuál: el destino (`targetSceneId`, `targetSpawnId`) está en el JSON de la escena. Esta HU cubre la resolución lógica del viaje; la transición visual es HU-GAME-050.

### Reglas de negocio
- **RN-1:** Soltar una entidad con `character` sobre una entidad con `portal` ejecuta `teleport` (regla `core:travel_portal`, prioridad 95). No hay otra forma de viajar arrastrando.
- **RN-2:** `teleport` cambia `location.sceneId` del personaje a `portal.targetSceneId` y lo coloca en el spawn `portal.targetSpawnId`, con `facing` del spawn si lo declara.
- **RN-3:** Viajan con el personaje: los objetos que sostiene (`location.kind = 'held'`) y las prendas que viste (`worn`). No cambian de location (siguen `held`/`worn` del mismo personaje); solo cambia la escena del portador.
- **RN-4:** Solo viaja el personaje soltado. Los demás personajes **se quedan** en su escena y siguen allí al volver ([SCENE_SYSTEM §2](../../architecture/SCENE_SYSTEM.md), "Personajes entre escenas").
- **RN-5:** Si el personaje estaba sentado o dormido, el `standUp` implícito del inicio del drag ya lo liberó ([INTERACTION_SYSTEM §5](../../architecture/INTERACTION_SYSTEM.md)); llega con pose `idle`.
- **RN-6:** Soltar sobre una puerta algo que no es un personaje no coincide con `travel_portal` (`portal.accepts` por defecto `['character']`) y se aplica el fallback `place`.
- **RN-7:** Un tap sobre una puerta **no** hace viajar. Si la puerta además tiene `openable`, se aplica `tap_open` (solo efecto visual).
- **RN-8:** Si en el spawn de llegada ya hay otro personaje a menos de 120 unidades en x, el viajero se desplaza 120 unidades (separación de [SCENE_SYSTEM §2](../../architecture/SCENE_SYSTEM.md), paso 4), limitado a `[0, scene.width]`.
- **RN-9:** Tras el viaje, `player.currentSceneId` pasa a ser la escena de destino y la cámara se centra en el spawn (no se usa `player.cameraX`, que pertenece a la escena anterior).
- **RN-10:** `teleport.validate` rechaza el viaje con `interactionRejected(notPurchased)` si el personaje sostiene un objeto con `purchasable.purchased = false` ([INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md)). El comportamiento de la tienda está en HU-GAME-066.
- **RN-11:** Puertas del MVP (datos, no código):

| Entidad | Escena | `targetSceneId` | `targetSpawnId` |
|---|---|---|---|
| `core:home/front_door` | `core:home` | `core:street` | `home_door` |
| `core:street/home_door` | `core:street` | `core:home` | `front_door` |
| `core:street/store_door` | `core:street` | `core:store` | `entrance` |
| `core:store/entrance_door` | `core:store` | `core:street` | `store_door` |

### Criterios de aceptación
```gherkin
Scenario: el personaje viaja al soltarlo sobre una puerta
  Given un personaje en la escena "core:home"
  And una entidad con `portal` hacia "core:street" y spawn "home_door"
  When el jugador suelta el personaje sobre el hitbox de la puerta
  Then se ejecuta la regla "core:travel_portal"
  And la location del personaje es { kind: 'scene', sceneId: 'core:street' }
  And su transform coincide con el spawn "home_door" de "core:street"
  And player.currentSceneId es "core:street"

Scenario: lo que sostiene viaja con él
  Given un personaje que sostiene un objeto con `edible` en la mano derecha (una manzana)
  When el jugador suelta el personaje sobre una puerta con `portal`
  Then en la escena de destino el objeto sigue con location { kind: 'held', holderId: <personaje>, hand: 'right' }
  And el objeto no queda en la escena de origen

Scenario: un objeto que no es personaje no viaja
  Given un objeto con `draggable` sin tag `character` (una pelota)
  When el jugador lo suelta sobre una puerta con `portal`
  Then no se ejecuta "teleport"
  And el objeto se coloca con la acción `place` en la escena actual

Scenario: tocar la puerta no hace viajar
  Given una puerta con `portal` y `openable` en estado cerrado
  When el jugador toca la puerta
  Then la puerta pasa al estado abierto
  And la escena activa no cambia

Scenario: los demás personajes se quedan donde estaban
  Given dos personajes A y B en "core:home"
  When el jugador suelta a A sobre la puerta hacia "core:street"
  And después suelta a A sobre la puerta de vuelta a "core:home"
  Then B sigue en "core:home" con la misma posición y pose que antes

Scenario: separación en un spawn ocupado
  Given un personaje B de pie exactamente en el spawn "home_door" de "core:street"
  When el personaje A llega a "core:street" por la puerta de la casa
  Then la x de A difiere de la de B en 120 unidades
```
Incluye: AC-PERSIST-01 (el personaje dejado en la tienda sigue en la tienda al volver), AC-PERSIST-02 (tras cerrar la app se retoma en `player.currentSceneId` con el personaje en el spawn de llegada), AC-A11Y-01 (se entiende que la puerta "lleva a otro lado" sin leer). Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Soltar el personaje sobre la puerta y a la vez sobre un asiento más cercano al frente: gana el orden del resolver (prioridad 95 de `travel_portal` frente a 80 de `sit_on_seat`).
- Personaje que sostiene dos objetos: viajan ambos.
- Portal cuyo `targetSceneId` no existe: imposible en release (lo detecta el validador, [SCENE_SCHEMA §6](../../data/SCENE_SCHEMA.md)); en dev, `CommandResult { ok: false }` y `logger.warn`, sin pantalla de error.
- La app pasa a background justo después del drop: el flush previo a descargar la escena (HU-GAME-050) garantiza el estado.
- Doble drop sobre puertas durante la transición: la entrada está bloqueada (HU-GAME-050).

### Dependencias
- HU-GAME-010: cargar una escena declarada en JSON (destino del viaje).
- HU-GAME-031: resolver interacciones mediante reglas de datos (`travel_portal`).
- HU-GAME-017: arrastrar personajes.

### Consideraciones técnicas
- Acción `teleport` en `engine/actions/`, que delega en `SceneService.enter(sceneId, spawnId, travelers[])` ([SCENE_SYSTEM §2](../../architecture/SCENE_SYSTEM.md)).
- Sin `if sceneId === …`: todo destino sale de `portal`. [NEEDED NOW] (Fase 2).
- Las entidades globales (personaje, `held`, `worn`) no se descargan al salir de la escena ([GAME_ENGINE §3](../../architecture/GAME_ENGINE.md)).
- Tests headless con un pack fixture de dos escenas mínimas.

### Assets necesarios
- `env_home_door_front` / `env_home_door_front_open`: puerta de casa (interior) cerrada/abierta (placeholder aceptable: sí en dev, no en release).
- `env_street_door_home`, `env_street_door_store`, `env_store_door_entrance`: puertas (placeholder: sí en dev).
- `sfx_door_open`, `sfx_door_close`: sonidos de puerta (placeholder: sí en dev).
- `sfx_portal_whoosh`: sonido de "viaje" al ejecutar `teleport` (propuesta; placeholder: sí en dev).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de `teleport` y de las cuatro puertas en datos
- [ ] pruebas de integración headless de todos los escenarios automatizables
- [ ] rendimiento: el drop sobre la puerta responde en ≤ 50 ms antes de iniciar la transición
- [ ] persistencia: `currentSceneId` y la escena de cada personaje sobreviven a cerrar la app
- [ ] documentación: tabla de puertas reflejada en los JSON de escena

---

## HU-GAME-050 — Transición entre escenas

> **Status:** Draft
> **Epic:** EPIC-014 · **Fase:** 2 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-014 — Scene Navigation

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **que el cambio de lugar sea un fundido corto y alegre**
para **no perder la atención esperando ni ver la pantalla "romperse" mientras carga**.

### Contexto
Toda entrada a una escena (por portal, mapa o al continuar) pasa por `SceneService.enter` ([SCENE_SYSTEM §2](../../architecture/SCENE_SYSTEM.md)). La transición visual y su presupuesto están en [SCENE_SYSTEM §4](../../architecture/SCENE_SYSTEM.md) y [PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos). El guardado exige un flush antes de descargar la escena ([SAVE_SYSTEM §3](../../architecture/SAVE_SYSTEM.md)).

### Reglas de negocio
- **RN-1:** Secuencia obligatoria de `enter`: `sceneWillChange` → `SaveService.flush()` → fade out de audio → fundido visual de salida (300 ms) → descargar la escena anterior → construir la nueva (definición + diff) → colocar viajeros → precargar texturas visibles → colocar la cámara → `sceneLoaded` → música/ambiente de la zona → fundido de entrada (300 ms).
- **RN-2:** El fundido es a un color de la paleta (no negro puro); el color es dato de contenido, no código.
- **RN-3:** Si la carga (entre el fin del fundido de salida y el inicio del de entrada) supera **600 ms**, aparece un indicador lúdico animado, **sin texto**.
- **RN-4:** **Durante toda la transición se bloquea la entrada** (gestos del mundo y botones del HUD). Un drag en curso se cancela con `dragCancel` antes de empezar.
- **RN-5:** Presupuesto de la transición completa (fundidos incluidos): target **≤ 1,0 s**, warning **> 1,5 s**, critical **> 2,5 s** ([PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos)). Reparto de referencia: 600 ms de fundidos + ≤ 400 ms de carga.
- **RN-6:** La precarga de texturas espera como máximo **1,5 s** ([RENDERING §6](../../architecture/RENDERING.md)); lo que falte aparece luego con un fade.
- **RN-7:** La música hace crossfade de 800 ms hacia la pista de la zona de llegada ([AUDIO_SYSTEM §3](../../architecture/AUDIO_SYSTEM.md)); si es la misma pista, no se reinicia.
- **RN-8:** El overlay de rendimiento (HU-GAME-071) registra el tiempo de la última transición.

### Criterios de aceptación
```gherkin
Scenario: transición completa al cruzar una puerta
  Given el jugador en "core:home"
  When se ejecuta la acción `teleport` hacia "core:street"
  Then se emiten en orden "sceneWillChange", el flush del guardado y "sceneLoaded"
  And la pantalla hace un fundido de salida de 300 ms y uno de entrada de 300 ms
  And al terminar la escena activa es "core:street"

Scenario: el guardado se vacía antes de descargar la escena
  Given una entidad sucia en "core:home" dentro de la ventana de debounce
  When empieza la transición hacia "core:street"
  Then la entidad está escrita en el SaveStore antes de que se descarguen las entidades de "core:home"

Scenario: la entrada está bloqueada durante la transición
  Given una transición en curso
  When el jugador toca o arrastra en la pantalla
  Then no se despacha ningún comando del mundo
  And no se inicia una segunda transición

Scenario: indicador si la carga tarda
  Given un SaveStore de test que retrasa la lectura 700 ms
  When se entra en una escena
  Then se muestra el indicador animado de carga sin texto
  And desaparece al empezar el fundido de entrada

Scenario: carga rápida sin indicador
  Given una carga que tarda menos de 600 ms
  When se entra en una escena
  Then el indicador de carga no se muestra

@performance @manual
Scenario: presupuesto en el dispositivo de referencia
  Given una build release en el Android de referencia de gama baja
  When el jugador cruza 10 veces la puerta casa ↔ calle
  Then el overlay registra cada transición en ≤ 1,0 s y ninguna por encima de 1,5 s
```
Incluye: AC-PERF-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- La app pasa a background a mitad de la transición: se completa la carga en cuanto vuelve y el guardado ya se hizo en RN-1.
- Fallo al construir la escena destino (contenido corrupto, solo posible en dev): se vuelve a la escena de origen con los viajeros en el spawn `default`, `logger.warn`, sin pantalla de error.
- Una textura que no carga en 1,5 s: la escena aparece igual y la textura entra con fade.
- `reduceMotion` es [DESIGNED FOR LATER] (HU-GAME-110): no cambia los fundidos en el MVP.

### Dependencias
- HU-GAME-049: puertas y portales (origen principal de las transiciones).

### Consideraciones técnicas
- Coordinación entre `SceneService` (core), la capa de transición (UI, RN View encima de la Canvas), `AudioService` y `SaveService`. La UI escucha `sceneWillChange`/`sceneLoaded` vía GameFacade.
- El fundido se anima en el UI thread (Reanimated). No hay `setState` por frame.
- El paso "precargar la escena destino al acercarse al portal" es [DESIGNED FOR LATER] ([PERFORMANCE §5](../../architecture/PERFORMANCE.md)).

### Assets necesarios
- `ui_loading_anim_01`: indicador lúdico de carga (placeholder: sí en dev, no en release).
- Color de fundido: token de la paleta en el contenido (propuesta: `transition.fadeColor` en el pack `core`).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de la secuencia RN-1 y del bloqueo de entrada
- [ ] pruebas de integración del orden de eventos, del flush y del indicador (con reloj falso)
- [ ] rendimiento medido en release con el overlay y anotado en la HU
- [ ] persistencia: flush verificado antes de la descarga
- [ ] documentación

---

## HU-GAME-051 — Mapa de ubicaciones

> **Status:** Draft
> **Epic:** EPIC-014 · **Fase:** 2 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-014 — Scene Navigation

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **abrir un mapa con dibujos de los lugares y de las habitaciones**
para **ir rápido a donde quiero jugar sin arrastrar a nadie hasta la puerta**.

### Contexto
El mapa muestra las ubicaciones de mapa (`MapLocation`: Casa, Calle, Tienda) y los botones de las zonas de la casa, que hacen saltar la cámara a `snapCameraX` ([SCENE_SYSTEM §3](../../architecture/SCENE_SYSTEM.md), [RENDERING §5](../../architecture/RENDERING.md)). Las ubicaciones las declaran los packs en `provides.locations` ([CONTENT_PACK_SCHEMA §2](../../data/CONTENT_PACK_SCHEMA.md)), de modo que un pack futuro aparece en el mapa sin tocar el motor.

### Reglas de negocio
- **RN-1:** Un botón de mapa en el HUD (≥ 64 dp) abre una capa de mapa sobre el juego. El juego queda en pausa lógica mientras el mapa está abierto.
- **RN-2:** El mapa lista una tarjeta por cada `provides.locations[]` de los packs cargados, con su `icon`. La ubicación actual está resaltada.
- **RN-3:** Tocar otra ubicación ejecuta `enterScene { sceneId: entrySceneId, spawnId: entrySpawnId }` con la transición de HU-GAME-050. **El mapa no mueve personajes** (`travelers = []`): el niño "visita" el lugar y sus personajes se quedan donde estaban (coherente con RN-4 de HU-GAME-049). Para llevar personajes u objetos se usan las puertas o la mochila.
- **RN-4:** Tocar la ubicación actual cierra el mapa sin transición.
- **RN-5:** Si la escena actual tiene `zones`, el mapa muestra un botón por zona (icono por zona). Tocarlo cierra el mapa y mueve la cámara con `withTiming` a `zone.snapCameraX − viewportW/2` en **450 ms** ([RENDERING §5](../../architecture/RENDERING.md)), limitado a `bounds`. Solo se muestran las zonas (`scene.zones`) de la escena actual. Al terminar el salto se envía `cameraSettled { cameraX }`.
- **RN-6:** Una ubicación bloqueada (no incluida en `player.unlocks`) se ve con un candado, no es tocable y responde con shake + `sfx_reject_soft`. En el MVP todas están desbloqueadas ([GAME_RULES R7](../../product/GAME_RULES.md)).
- **RN-7:** El botón del mapa está deshabilitado durante un drag y durante una transición.
- **RN-8:** Todo es comprensible sin leer: iconos grandes, sin texto obligatorio; cada botón tiene `accessibilityLabel` i18n.

### Criterios de aceptación
```gherkin
Scenario: ir a otra ubicación desde el mapa
  Given el jugador en "core:home" con el mapa abierto
  When toca la tarjeta de la ubicación "store"
  Then se inicia la transición hacia "core:store" en el spawn "entrance"
  And ningún personaje cambia de escena
  And player.currentSceneId es "core:store"

Scenario: saltar a una habitación
  Given el jugador en "core:home" con el mapa abierto
  When toca el botón de la zona "kitchen"
  Then el mapa se cierra
  And la cámara termina centrada en snapCameraX de "kitchen" (2880) tras 450 ms, dentro de bounds
  And se envía cameraSettled con la cameraX final

Scenario: tocar la ubicación actual
  Given el jugador en "core:street" con el mapa abierto
  When toca la tarjeta de "street"
  Then el mapa se cierra y no hay transición

Scenario: ubicación bloqueada
  Given una ubicación de un pack de test que no está en player.unlocks
  When el jugador toca su tarjeta
  Then la tarjeta hace shake y suena el rechazo suave
  And no se inicia ninguna transición

Scenario: mapa no disponible durante un drag
  Given el jugador arrastrando un objeto
  When toca el botón del mapa
  Then el mapa no se abre

@persistence
Scenario: la cámara elegida se conserva
  Given el jugador saltó a la zona "bedroom" desde el mapa
  When la app se cierra por completo y se vuelve a abrir
  Then la cámara se restaura en player.cameraX de la zona "bedroom"
```
Incluye: AC-A11Y-01, AC-PERSIST-02. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Viewport más ancho que la zona (tablet 4:3 ve ~1440 unidades; teléfono ~2340): la cámara se limita a `bounds`.
- Pack sin `provides.locations`: no añade tarjetas.
- El mapa abierto cuando la app pasa a background: al volver sigue abierto y sin cambios.
- Escena sin `zones` (calle o tienda si no las declaran): no se muestran botones de zona.

### Dependencias
- HU-GAME-050: transición entre escenas.

### Consideraciones técnicas
- UI en `ui/` (RN Views). La lista de ubicaciones y zonas llega por selectores del GameFacade; la UI no importa `engine/core`.
- Fuentes de datos del mapa: `provides.locations` del manifest ([CONTENT_PACK_SCHEMA §2](../../data/CONTENT_PACK_SCHEMA.md)) para las ubicaciones y `scene.zones` ([SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md)) para los botones de zona. No hay otra fuente.
- [NEEDED NOW] (Fase 2).

### Assets necesarios
- `ui_btn_map`: botón del mapa en el HUD (placeholder: sí en dev).
- `ui_map_bg_01`: fondo ilustrado del mapa (placeholder: sí en dev).
- `ui_map_home`, `ui_map_street`, `ui_map_store`: iconos de ubicación (placeholder: sí en dev).
- `ui_map_zone_living`, `ui_map_zone_kitchen`, `ui_map_zone_bedroom`, `ui_map_zone_bathroom`: iconos de zona (placeholder: sí en dev).
- `ui_icon_lock`: candado (placeholder: sí en dev).
- `sfx_ui_tap`, `sfx_reject_soft`: globales ya existentes.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación del mapa, de las tarjetas de ubicación y de los botones de zona
- [ ] pruebas de integración de `enterScene` desde el mapa y del salto de cámara
- [ ] prueba manual en teléfono y en tablet 4:3 (tamaño de botones ≥ 64 dp)
- [ ] persistencia de `cameraX` y `currentSceneId`
- [ ] documentación
