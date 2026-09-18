# EPIC-003 — Scene Management

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 0 (HU-GAME-012 en Fase 1)
> **Docs:** [SCENE_SYSTEM](../../architecture/SCENE_SYSTEM.md) · [SCENE_SCHEMA](../../data/SCENE_SCHEMA.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [OBJECT_SCHEMA](../../data/OBJECT_SCHEMA.md) · [CONTENT_SYSTEM](../../architecture/CONTENT_SYSTEM.md) · [RENDERING](../../architecture/RENDERING.md)

## Objetivo del epic
Que las escenas se declaren íntegramente en JSON y el motor las cargue sin conocer ninguna en concreto: tamaño, fondos, suelo, spawn points, entidades (inline o desde prefabs con overrides) y zonas horizontales. La posición de cada objeto vive solo en el JSON de la escena.

## Historias
- [HU-GAME-010 — Cargar una escena declarada en JSON](#hu-game-010--cargar-una-escena-declarada-en-json)
- [HU-GAME-011 — Instanciar entidades desde prefabs con overrides](#hu-game-011--instanciar-entidades-desde-prefabs-con-overrides)
- [HU-GAME-012 — Zonas (habitaciones) dentro de una escena](#hu-game-012--zonas-habitaciones-dentro-de-una-escena)

---

## HU-GAME-010 — Cargar una escena declarada en JSON

> **Status:** Draft
> **Epic:** EPIC-003 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-003 — Scene Management

### Prioridad
Must · P0

### Historia
Como **diseñador de contenido**
quiero **declarar una escena en un JSON (tamaño, fondos, suelo, spawn points y entidades) y que el juego la cargue**
para **crear y ajustar ubicaciones sin tocar el código del motor**.

### Contexto
La escena es un espacio jugable declarado por datos ([SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md)). El `SceneService` la carga con `enter(sceneId, spawnId, travelers[])` siguiendo los pasos de [SCENE_SYSTEM §2](../../architecture/SCENE_SYSTEM.md). Esta HU cubre la validación de la escena, la carga de sus entidades **inline**, la descarga de la escena anterior y la colocación inicial de la cámara. Las entidades desde prefabs son HU-GAME-011; el diff de guardado es HU-GAME-053; la transición visual es HU-GAME-050.

### Reglas de negocio
- **R1 — Schema zod `strict`** de `SceneDefinition` en `engine/scene` o `engine/content`. `size.height` vale **siempre 1080** ([SCENE_SCHEMA §3](../../data/SCENE_SCHEMA.md), regla 1).
- **R2 — Spawn `default` obligatorio** (regla 5). Toda coordenada cae dentro de `0..width × 0..1080` (regla 6).
- **R3 — IDs:** el `EntityId` de una entidad de escena es `{packNs}:{sceneId}/{localId}` (p. ej. `core:home/fridge`). Cada `localId` es único en la escena (regla 2).
- **R4 — `enter(sceneId, spawnId, travelers[])`** hace, en orden:
  1. emite `sceneWillChange { from, to }`;
  2. saca del World las entidades de escena de la escena anterior; las globales (personajes que viajan, mochila, lo que llevan) se quedan;
  3. construye la nueva escena a partir de la definición;
  4. coloca a los `travelers` en `spawnId`, separados 120 unidades en x si son varios ([SCENE_SYSTEM §2](../../architecture/SCENE_SYSTEM.md));
  5. coloca la cámara: si es la escena guardada, `player.cameraX`; si no, `camera.startX`, o centrada en `camera.startSpawnId`, o centrada en el spawn de llegada; siempre limitada a los bounds (HU-GAME-007);
  6. emite `sceneLoaded { from, to }`.
- **R5 — Comando** `enterScene { sceneId, spawnId }` por el `GameFacade` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).
- **R6 — Suelo y límites:** `floor` es una lista de segmentos absolutos; un segmento sin `x1`/`x2` cubre toda la escena. Los segmentos tienen que cubrir **todo** `0..width` sin huecos; si no, la escena es inválida ([SCENE_SCHEMA §3](../../data/SCENE_SCHEMA.md), regla 5b). `bounds` por defecto `0..width`.
- **R7 — Entidades inline** (`{ localId, inline: { components, tags }, transform }`): se crean con sus componentes validados, sin prefab.
- **R8 — Sin lógica por escena:** nada de `if (sceneId === …)` ([SCENE_SYSTEM §5](../../architecture/SCENE_SYSTEM.md)).
- **R9 — Errores:** `enterScene` con una escena inexistente devuelve `{ ok: false, reason: "unknownScene" }` y el jugador sigue en la escena actual. Un `spawnId` inexistente usa `default` y registra `logger.warn`.
- **R10 — Precarga básica:** antes de `sceneLoaded` se piden al AssetLoader los chunks de fondo visibles en la posición inicial de la cámara. La precarga completa con timeout de 1,5 s va con la transición (HU-GAME-050, [RENDERING §6](../../architecture/RENDERING.md)).

### Criterios de aceptación
```gherkin
Scenario: cargar una escena válida
  Given el pack de prueba con la escena "test:room" de 3840 unidades y 3 entidades inline
  When se despacha enterScene { sceneId: "test:room", spawnId: "default" }
  Then el World contiene las 3 entidades con ids "test:room/<localId>"
  And su location es { kind: "scene", sceneId: "test:room" }
  And se emiten sceneWillChange y después sceneLoaded

Scenario: al cambiar de escena se descargan las entidades de la anterior
  Given la escena "test:room" cargada y una entidad global en la mochila
  When se entra en la escena "test:hall"
  Then el World no contiene ninguna entidad de escena de "test:room"
  And la entidad de la mochila sigue en el World

Scenario: los viajeros aparecen separados en el spawn
  Given dos personajes que viajan a "test:hall" y un spawn "door" en x = 500
  When se entra en "test:hall" por el spawn "door"
  Then los personajes quedan en x = 500 y x = 620

Scenario: cámara centrada en el spawn en una escena nueva
  Given la escena "test:room" de 3840 unidades, viewportW = 2338 y un spawn "default" en x = 700
  When se entra por primera vez en "test:room"
  Then cameraX queda en 0 (700 − 1169 limitado a los bounds)

Scenario: escena inexistente
  Given el jugador en "test:room"
  When se despacha enterScene { sceneId: "test:nowhere", spawnId: "default" }
  Then dispatch devuelve { ok: false, reason: "unknownScene" }
  And el jugador sigue en "test:room" con todas sus entidades

Scenario: spawn inexistente
  When se entra en "test:room" con spawnId "roof"
  Then los viajeros aparecen en el spawn "default"
  And se registra un logger.warn que nombra "roof"

Scenario: altura distinta de 1080
  Given una escena con size { width: 1920, height: 720 }
  When se valida
  Then la validación falla con un error en /size/height

Scenario: suelo con huecos
  Given una escena de 3840 unidades con floor [{ y: 960, x1: 0, x2: 1800 }, { y: 960, x1: 2000, x2: 3840 }]
  When se valida la escena
  Then la validación falla con un error en /floor indicando el hueco 1800..2000

Scenario: coordenada fuera de la escena
  Given una entidad inline con transform { x: 5000, y: 960 } en una escena de 3840
  When se valida la escena
  Then la validación falla con un error en /entities/<índice>/transform/x
```

### Casos límite
- Entrar en la misma escena en la que ya se está (p. ej. desde el mapa): se trata como un salto de cámara al spawn, sin descargar ni recargar (propuesta).
- Escena sin entidades: válida.
- `camera.startX` fuera de los bounds: se limita (HU-GAME-007).
- Un comando `enterScene` mientras otro está en curso: se ignora el segundo (propuesta; la entrada está bloqueada durante la transición, [SCENE_SYSTEM §4](../../architecture/SCENE_SYSTEM.md)).

### Dependencias
- HU-GAME-003: World y eventos.
- HU-GAME-068: pack `core` y `ContentRegistry.scene(id)`.

### Consideraciones técnicas
- Documentos: [SCENE_SYSTEM §1, §2, §5](../../architecture/SCENE_SYSTEM.md), [SCENE_SCHEMA §2, §3](../../data/SCENE_SCHEMA.md).
- [NEEDED NOW] schema, `SceneService.enter`, `current()`, entidades inline, cámara inicial.
- [DESIGNED FOR LATER] extensiones de escena (`extends` + `addEntities`, [CONTENT_PACK_SCHEMA §7](../../data/CONTENT_PACK_SCHEMA.md)); streaming de escenas contiguas.
- [NOT NEEDED YET] pathfinding ([SCENE_SYSTEM §5](../../architecture/SCENE_SYSTEM.md)).
- Las llamadas a `SaveService.flush()` y al fade de audio del paso 1 de SCENE_SYSTEM §2 se conectan en HU-GAME-052 y HU-GAME-057; aquí solo se emite el evento.

### Assets necesarios
- Fondo placeholder de la escena de prueba en chunks de 1920 × 1080 (placeholder aceptable: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Schema de escena y `SceneService` con tests en el harness de cada escenario.
- [ ] La escena placeholder se ve en el dispositivo con la cámara inicial correcta.
- [ ] SCENE_SCHEMA actualizado si la implementación revela un hueco.

---

## HU-GAME-011 — Instanciar entidades desde prefabs con overrides

> **Status:** Draft
> **Epic:** EPIC-003 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-003 — Scene Management

### Prioridad
Must · P0

### Historia
Como **diseñador de contenido**
quiero **colocar en una escena instancias de prefabs y cambiar solo algunos campos de cada una**
para **reutilizar los objetos y ajustar casos concretos (una puerta que lleva a otro sitio, una nevera con otra capacidad) sin duplicar definiciones**.

### Contexto
Los prefabs no tienen posición; la escena los instancia ([OBJECT_SCHEMA §1](../../data/OBJECT_SCHEMA.md)). Los componentes efectivos se calculan como `deepMerge(prefab.components, sceneEntity.overrides, savedState.components)`, por componente y por campo; los arrays se reemplazan y `null` elimina un componente ([ENTITY_SCHEMA §3](../../data/ENTITY_SCHEMA.md)). Una entidad puede empezar dentro de un contenedor con `inContainer` ([SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md)).

### Reglas de negocio
- **R1 — Resolución del prefab:** `prefabId` sin namespace → `{packActual}:id`; con namespace → tal cual, y el pack debe ser el propio o estar en `dependencies` ([CONTENT_PACK_SCHEMA §4](../../data/CONTENT_PACK_SCHEMA.md)). Se aplica `resolveAlias` antes de buscarlo.
- **R2 — Fusión** con una función pura `resolveComponents(prefab, overrides, saved?)`:
  - por componente y por campo;
  - los arrays se reemplazan, no se concatenan;
  - `"componente": null` en los overrides elimina ese componente.

  La misma función la reutiliza el SaveService al aplicar el estado guardado (HU-GAME-053).
- **R3 — Validación tras fusionar:** el resultado se valida con los schemas `strict` de componentes y con las dependencias entre componentes de [OBJECT_SCHEMA §6](../../data/OBJECT_SCHEMA.md) (p. ej. `openable` requiere `states`).
- **R4 — Tags:** los `tags` de la instancia de escena se **añaden** (unión, sin duplicados) a los del prefab; nunca los reemplazan ([SCENE_SCHEMA §3](../../data/SCENE_SCHEMA.md), regla 3b; [ENTITY_SCHEMA §3](../../data/ENTITY_SCHEMA.md)).
- **R5 — Independencia:** cada instancia tiene sus propios datos. Cambiar una manzana no cambia otra manzana ni el prefab.
- **R6 — `inContainer`:** la entidad se crea con location `{ kind: "container", containerId: "{ns}:{sceneId}/{localId}", slot }` y sin necesidad de `transform`. Los contenedores se crean antes que su contenido (dos pasadas).
- **R7 — `transform` de la escena** es la posición inicial de la instancia; las coordenadas viven solo en el JSON de la escena ([SCENE_SCHEMA §3](../../data/SCENE_SCHEMA.md), regla 7).
- **R8 — Errores:** un `prefabId` inexistente es un error de validación del pack (HU-GAME-069). Si aun así llega a runtime: en dev, error; en producción, la entidad se omite y se registra `logger.warn`.

### Criterios de aceptación
```gherkin
Scenario: un override cambia solo un campo
  Given un prefab con container { capacity: 6, accepts: ["food", "drink"] }
  And una instancia de escena con overrides { container: { capacity: 4 } }
  When se instancia la escena
  Then la entidad tiene container { capacity: 4, accepts: ["food", "drink"] }

Scenario: los arrays se reemplazan
  Given un prefab con container.accepts ["food", "drink"]
  And una instancia con overrides { container: { accepts: ["toy"] } }
  When se instancia
  Then container.accepts es ["toy"]

Scenario: los tags de la instancia se suman a los del prefab
  Given un prefab con tags ["food", "fruit"]
  And una instancia de escena con tags ["fruit", "kitchen"]
  When se instancia
  Then la entidad tiene los tags "food", "fruit" y "kitchen", sin duplicados

Scenario: null elimina un componente
  Given un prefab con el componente draggable
  And una instancia con overrides { draggable: null }
  When se instancia
  Then la entidad no tiene el componente draggable

Scenario: las instancias son independientes
  Given dos instancias del mismo prefab con edible
  When cambia edible.bitesLeft de la primera
  Then la segunda instancia y el prefab no cambian

Scenario: entidad que empieza dentro de un contenedor
  Given la escena con "fridge" (container con capacity 6) y "fridge_milk" con inContainer { localId: "fridge", slot: 0 }
  When se instancia la escena
  Then "…/fridge_milk" tiene location { kind: "container", containerId: "…/fridge", slot: 0 }
  And no se dibuja como entidad suelta

Scenario: un override que rompe una dependencia
  Given un prefab con states y openable
  And una instancia con overrides { states: null }
  When se valida la escena
  Then la validación falla indicando que openable requiere states

Scenario: prefab inexistente en producción
  Given una entidad de escena con prefabId "test:ghost" que no existe
  When se carga la escena en modo producción
  Then la entidad se omite
  And se registra un logger.warn con "test:ghost"
  And el resto de la escena se carga
```

### Casos límite
- `inContainer` con un `slot` ≥ `capacity` o hacia una entidad sin `container`: error del validador ([SCENE_SCHEMA §6](../../data/SCENE_SCHEMA.md)).
- Dos entidades `inContainer` en el mismo slot: error del validador (propuesta; lo detecta también el invariante de HU-GAME-003).
- Override de un componente que el prefab no tiene: lo añade (la fusión es por componente).
- Alias: `prefabId: "core:apple"` con `idAliases { "core:apple": "core:apple_red" }` instancia `core:apple_red`.

### Dependencias
- HU-GAME-010: carga de escena.
- HU-GAME-024: registro de prefabs.

### Consideraciones técnicas
- Documentos: [ENTITY_SCHEMA §3](../../data/ENTITY_SCHEMA.md), [SCENE_SCHEMA §2-§4](../../data/SCENE_SCHEMA.md), [OBJECT_SCHEMA §6](../../data/OBJECT_SCHEMA.md), [SAVE_SCHEMA §4](../../data/SAVE_SCHEMA.md).
- [NEEDED NOW] `resolveComponents`, instanciación, `inContainer`.
- [DESIGNED FOR LATER] entidades de packs externos añadidas por extensión de escena.
- Restricción: sin `if` por prefab ni por escena; la fusión es genérica.

### Assets necesarios
- Los de los prefabs de prueba de HU-GAME-024 (placeholder aceptable: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] `resolveComponents` con tests unitarios de fusión, arrays, `null` e independencia.
- [ ] Tests en el harness de `inContainer` y de errores.
- [ ] Test de la unión de `tags`.

---

## HU-GAME-012 — Zonas (habitaciones) dentro de una escena

> **Status:** Draft
> **Epic:** EPIC-003 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-003 — Scene Management

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **que la casa tenga habitaciones (salón, cocina, dormitorio y baño) dentro de un mismo espacio continuo**
para **pasar de una a otra deslizando el dedo, sin pantallas de carga, y saltar directamente a la que quiera**.

### Contexto
La casa es una sola escena de 7680 unidades con cuatro zonas de 1920 ([SCENE_SCHEMA §4 y §5](../../data/SCENE_SCHEMA.md)). `zoneAt(cameraCenterX)` da la zona activa, que usan la música y el ambiente (HU-GAME-057) y la UI. Las zonas no bloquean el movimiento ([SCENE_SYSTEM §3](../../architecture/SCENE_SYSTEM.md)). Los botones de zona del mapa (HU-GAME-051) saltan a `snapCameraX`.

### Reglas de negocio
- **R1 — `zoneAt(x)`** devuelve la zona con `x1 ≤ x < x2` (intervalo semiabierto, propuesta) o `undefined` si ninguna la contiene.
- **R2 — Zona activa:** `zoneAt(cameraX + viewportW / 2)`. Se recalcula **solo** al procesar el comando `cameraSettled { cameraX }` (fin del paneo o de la inercia, fin del auto-scroll o de un salto de zona; [GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)), nunca por frame. Al entrar en una escena se calcula con la cámara inicial.
- **R3 — Exposición:** selector `selectors.activeZone()` y evento `zoneChanged { sceneId, zoneId? }`, que se emite solo si la zona activa cambia ([GAME_ENGINE §5, §6](../../architecture/GAME_ENGINE.md)). Lo consumen el audio (HU-GAME-057) y la UI.
- **R4 — Salto a zona:** `jumpToZone(zoneId)` usa `jumpTo(snapCameraX)` de HU-GAME-007 (450 ms, limitado a los bounds), que termina con `cameraSettled`. Si la zona no define `snapCameraX`, se usa `(x1 + x2) / 2` (propuesta).
- **R5 — Sin bloqueo:** los objetos y los personajes cruzan de una zona a otra sin cambiar de escena ni de location. La zona no se guarda en la entidad.
- **R6 — Validación (propuesta):** las zonas caen dentro de `0..width`, sus `id` son únicos y no se solapan. Se añade al validador (HU-GAME-069).
- **R7 — Escena sin zonas:** válida; `zoneAt` devuelve `undefined` y la escena usa su audio por defecto.

### Criterios de aceptación
```gherkin
Scenario: zona de una x en el borde
  Given la escena "core:home" con salón 0..1920 y cocina 1920..3840
  When se evalúa zoneAt(1920)
  Then el resultado es la zona "kitchen"

Scenario: zona activa según el centro de la cámara
  Given viewportW = 2338 y cameraX = 1000
  When se calcula la zona activa
  Then el centro es 2169 y la zona activa es "kitchen"

Scenario: el cambio de zona se notifica una vez
  Given la zona activa "living" y viewportW = 2338
  When se despacha cameraSettled { cameraX: 1331 } (centro en x = 2500)
  Then se emite exactamente un zoneChanged { sceneId: "core:home", zoneId: "kitchen" }
  And selectors.activeZone() devuelve "kitchen"

Scenario: sin cambio de zona no hay evento
  Given la zona activa "kitchen" y viewportW = 2338
  When se despacha cameraSettled { cameraX: 1500 } (centro en x = 2669)
  Then no se emite zoneChanged

Scenario: saltar a una zona
  Given viewportW = 2338 y la zona "bedroom" con snapCameraX 4800
  When se llama a jumpToZone("bedroom")
  Then cameraX termina en 3631 tras 450 ms

Scenario: un objeto cruza de zona sin cambiar de escena
  Given una manzana en la cocina (x = 2600)
  When se arrastra y se suelta en el salón (x = 1200)
  Then su location sigue siendo { kind: "scene", sceneId: "core:home" }

Scenario: zonas solapadas
  Given una escena con zonas 0..2000 y 1900..3840
  When se valida la escena
  Then la validación falla con un error en /zones/1

Scenario: escena sin zonas
  Given una escena sin campo zones
  When se evalúa zoneAt(500)
  Then el resultado es undefined y no hay error
  And selectors.activeZone() devuelve undefined
```

### Casos límite
- Hueco entre zonas: `zoneAt` devuelve `undefined`; la zona activa anterior se mantiene hasta entrar en otra (propuesta, para no cortar la música).
- La última zona termina en `width`: `zoneAt(width)` queda fuera por el intervalo semiabierto, pero la cámara nunca centra en `width`.
- Tablet 4:3 (`viewportW = 1440`): cada zona de 1920 no cabe entera; se cumple la regla de diseño de las 1440 unidades ([RENDERING §2.1](../../architecture/RENDERING.md)).

### Dependencias
- HU-GAME-010: carga de escena.

### Consideraciones técnicas
- Documentos: [SCENE_SYSTEM §3](../../architecture/SCENE_SYSTEM.md), [SCENE_SCHEMA §2, §4, §5](../../data/SCENE_SCHEMA.md), [RENDERING §5](../../architecture/RENDERING.md).
- [NEEDED NOW] `zoneAt`, zona activa, `activeZone()`, `zoneChanged`, `jumpToZone`.
- Restricción: la zona activa depende de `cameraX`, que vive en el UI thread; el motor solo la conoce por `cameraSettled` (HU-GAME-007, R6).

### Assets necesarios
- Ninguno nuevo (usa los fondos placeholder de la casa).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] `zoneAt`, zona activa, `zoneChanged` y `jumpToZone` con tests en el harness.
- [ ] Validación de zonas añadida al validador.
- [ ] SCENE_SCHEMA actualizado con el intervalo semiabierto y la regla de solapes.
