# EPIC-006 — Object System

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 0
> **Docs:** [OBJECT_SCHEMA](../../data/OBJECT_SCHEMA.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [ECS](../../architecture/ECS.md) · [INPUT_SYSTEM](../../architecture/INPUT_SYSTEM.md) · [CONTENT_SYSTEM](../../architecture/CONTENT_SYSTEM.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md)

## Objetivo del epic
Que los objetos interactivos sean plantillas de datos (prefabs) validadas, con estados simples y sprites por estado, y que el motor sepa qué objeto hay bajo el dedo con un hit testing en coordenadas del mundo. Ningún objeto necesita código propio.

## Historias
- [HU-GAME-024 — Registro de prefabs de objetos con validación](#hu-game-024--registro-de-prefabs-de-objetos-con-validación)
- [HU-GAME-025 — Estados de objetos y sprites por estado](#hu-game-025--estados-de-objetos-y-sprites-por-estado)
- [HU-GAME-026 — Hitbox y hit testing](#hu-game-026--hitbox-y-hit-testing)

---

## HU-GAME-024 — Registro de prefabs de objetos con validación

> **Status:** Draft
> **Epic:** EPIC-006 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-006 — Object System

### Prioridad
Must · P0

### Historia
Como **diseñador de contenido**
quiero **definir cada objeto en un archivo JSON de prefab y que el juego lo valide al cargarlo**
para **añadir objetos nuevos sin programar y enterarme enseguida si me equivoco**.

### Contexto
Un prefab es la plantilla de un objeto: `id`, `category`, `tags`, `components`, `interactions` y `metadata` ([OBJECT_SCHEMA §2](../../data/OBJECT_SCHEMA.md)). El `ContentRegistry` los registra con el namespace del pack ([CONTENT_SYSTEM §2](../../architecture/CONTENT_SYSTEM.md)). La validación completa corre en dev y en la CI; en release solo se validan el manifest y los schemas, porque las referencias cruzadas ya las comprobó la CI. El código de validación es el mismo que usa el validador de la CLI (HU-GAME-069).

### Reglas de negocio
- **R1 — Archivos:** `content/<pack>/prefabs/<category>/<name>.json`, un prefab por archivo. El `id` cumple `^[a-z0-9_]+$` y coincide con el nombre del archivo ([OBJECT_SCHEMA §1, §6](../../data/OBJECT_SCHEMA.md)).
- **R2 — Namespace:** se registra como `{pack}:{id}` (p. ej. `core:apple_red`).
- **R3 — `category`** es una de: `food`, `drink`, `clothing`, `furniture`, `appliance`, `toy`, `decor`, `tool`, `plant`, `container`, `door`, `misc`. Es **solo organizativa**: ningún system, action, condition ni regla la lee ([OBJECT_SCHEMA §3](../../data/OBJECT_SCHEMA.md)).
- **R4 — Modo `strict`:** componentes o campos desconocidos son error.
- **R5 — Dependencias entre componentes** ([OBJECT_SCHEMA §6](../../data/OBJECT_SCHEMA.md)):
  - `openable` o `switchable` sin `states` → error;
  - `openState`, `closedState`, `onState` u `offState` que no están en `states.values` → error;
  - `container.slots.length !== container.capacity` → error;
  - `sprite.byState` con estados que no están en `states.values` → error.
- **R6 — Referencias:** las claves de asset y de audio existen en el manifest del pack o de sus dependencias; los `prefabId` de `edible.onFinish`, `drinkable.onFinish` y `spawner` existen.
- **R7 — i18n:** `metadata.name` es obligatorio y su clave existe en `locales/es.json` y en `locales/en.json`.
- **R8 — Placeholder:** `metadata.placeholder: true` es advertencia; en builds de release es error (HU-GAME-069).
- **R9 — Formato de error:** `{ pack, file, path (JSON pointer), code, message }` ([CONTENT_PACK_SCHEMA §6](../../data/CONTENT_PACK_SCHEMA.md)). Se acumulan todos los errores; no se para en el primero.
- **R10 — Consulta:** `ContentRegistry.prefab(id)` aplica `resolveAlias` y, si el prefab no existe, lanza error en dev. Desde el facade, un comando que referencie un prefab inexistente devuelve `{ ok: false, reason: "unknownPrefab" }`.
- **R11 — Registro de componentes:** los componentes que aún no tengan schema (p. ej. `edible` antes de HU-GAME-042) se añaden aquí si el pack `core` ya los usa; siempre con su fila en [ECS §3](../../architecture/ECS.md) y su sección en ENTITY_SCHEMA.

### Criterios de aceptación
```gherkin
Scenario: un prefab válido se registra con namespace
  Given el archivo content/core/prefabs/food/apple_red.json con id "apple_red"
  When se cargan los packs
  Then ContentRegistry.prefab("core:apple_red") devuelve su definición

Scenario Outline: prefabs inválidos
  Given un prefab de prueba con <problema>
  When se valida el pack
  Then hay un error con code "<code>" en la ruta "<ruta>"

  Examples:
    | problema                                             | code                  | ruta                           |
    | id "Apple" en el archivo apple.json                  | invalidId             | /id                            |
    | id "apple_green" en el archivo apple_red.json        | idFileMismatch        | /id                            |
    | un componente "flying"                               | unknownComponent      | /components/flying             |
    | openable sin states                                  | missingDependency     | /components/openable           |
    | switchable.onState "lit" fuera de states.values      | invalidStateRef       | /components/switchable/onState |
    | container con capacity 6 y 4 slots                   | slotsCapacityMismatch | /components/container/slots    |
    | sprite.byState con el estado "broken" inexistente    | invalidStateRef       | /components/sprite/byState     |
    | sprite.asset "obj_missing" fuera del manifest        | unknownAsset          | /components/sprite/asset       |
    | edible.onFinish hacia "core:ghost"                   | unknownPrefab         | /components/edible/onFinish    |
    | metadata.name sin clave en locales/en.json           | missingI18n           | /metadata/name                 |

Scenario: placeholder es advertencia fuera de release
  Given un prefab con metadata.placeholder true
  When se valida el pack en modo desarrollo
  Then se informa una advertencia y la carga continúa

Scenario: se informan todos los errores de una vez
  Given un pack con 3 prefabs inválidos
  When se valida
  Then el resultado contiene los 3 errores

Scenario: alias de prefab
  Given el manifest con idAliases { "core:apple": "core:apple_red" }
  When se pide ContentRegistry.prefab("core:apple")
  Then devuelve la definición de "core:apple_red"

Scenario: category no define comportamiento
  Given dos prefabs con los mismos componentes y categorías distintas
  When se resuelve la misma interacción sobre cada uno
  Then el resultado es idéntico en ambos
```

### Casos límite
- Dos prefabs con el mismo `id` en carpetas de categoría distintas: error de unicidad (paso 5 de [CONTENT_PACK_SCHEMA §6](../../data/CONTENT_PACK_SCHEMA.md)).
- Una clave de asset de un pack que no está en `dependencies`: error, aunque la clave exista en otro pack.
- `metadata.price` negativo: error de schema (propuesta: `price ≥ 0`).
- `interactions.extraRules` y `disabledRules`: se validan aquí contra el schema de reglas de [INTERACTION_SCHEMA §9](../../data/INTERACTION_SCHEMA.md); su efecto es HU-GAME-031.

### Dependencias
- HU-GAME-003: ComponentRegistry y schemas base.
- HU-GAME-068: pack `core`, manifest de assets y locales.

### Consideraciones técnicas
- Documentos: [OBJECT_SCHEMA](../../data/OBJECT_SCHEMA.md), [ENTITY_SCHEMA §5](../../data/ENTITY_SCHEMA.md), [CONTENT_SYSTEM §2](../../architecture/CONTENT_SYSTEM.md), [CONTENT_PACK_SCHEMA §6](../../data/CONTENT_PACK_SCHEMA.md).
- [NEEDED NOW] registro de prefabs y validación en `src/engine/content/`, reutilizable por la CLI.
- [DESIGNED FOR LATER] `metadata.rarity`; packs descargables.
- Restricción: `engine/content` solo importa TS puro y zod. La regla "category no define comportamiento" se protege con una búsqueda en la CI (propuesta: ningún archivo de `systems/`, `actions/` o `rules/` contiene `.category`).

### Assets necesarios
- Prefabs de prueba de Fase 0 con sprites placeholder: `obj_food_apple_red`, `obj_toy_ball`, `env_home_table_round`, `env_home_toybox` (cerrada/abierta), `env_home_lamp_floor_off` / `_on` (placeholder aceptable: sí; Glitch Items, CC0, `placeholder: true`).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Schema de prefab y validaciones de R1-R9 con un test por código de error.
- [ ] `ContentRegistry.prefab` con alias y comportamiento en dev probado.
- [ ] OBJECT_SCHEMA §6 actualizado con los códigos de error definitivos.

---

## HU-GAME-025 — Estados de objetos y sprites por estado

> **Status:** Draft
> **Epic:** EPIC-006 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-006 — Object System

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **que los objetos cambien de aspecto cuando cambian de estado (abierto/cerrado, encendido/apagado)**
para **ver el resultado de lo que hago y encontrarlo igual cuando vuelva**.

### Contexto
El componente `states` es una máquina de estados sin transiciones condicionales: `{ current, values }` ([ENTITY_SCHEMA §5.6](../../data/ENTITY_SCHEMA.md)). Las transiciones las hacen las acciones `setState` y `cycleState` del `StateSystem` ([INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md), [ECS §5](../../architecture/ECS.md)). El sprite se elige con `sprite.byState` ([ENTITY_SCHEMA §5.2](../../data/ENTITY_SCHEMA.md)). Solo `states.current` se guarda ([SAVE_SCHEMA §2](../../data/SAVE_SCHEMA.md)).

### Reglas de negocio
- **R1 — Acciones de esta HU:** `setState { entity, state }` y `cycleState { entity }`, con `validate` y `execute` y el schema zod de sus parámetros ([INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md), "Para añadir una acción"). `toggleOpen` (HU-GAME-034) y `toggleSwitch` (HU-GAME-047) se construyen sobre este StateSystem.
- **R2 — `setState`:** `validate` falla si la entidad no tiene `states` o si `state` no está en `states.values`.
- **R3 — `cycleState`:** pasa al siguiente valor de `states.values` y, tras el último, vuelve al primero.
- **R4 — Sprite efectivo:** `sprite.byState[states.current]` si existe; si no, `sprite.asset`. Se resuelve en el selector `visibleEntities` (HU-GAME-004).
- **R5 — Eventos:** el cambio emite `entityChanged` y solo re-renderiza esa entidad.
- **R6 — Precarga:** al entrar en la escena se precargan los sprites de todos los estados posibles de sus entidades, para que el cambio no parpadee ([RENDERING §6](../../architecture/RENDERING.md)).
- **R7 — Persistencia:** se guarda solo `states.current`. Al cargar, si el valor guardado ya no está en `values` (el contenido cambió), se usa el `current` del prefab y se registra `logger.warn`.
- **R8 — Sin lógica por objeto:** el StateSystem no sabe qué significa "open" u "on"; eso lo dicen `openable` y `switchable`.

### Criterios de aceptación
```gherkin
Scenario: setState cambia el estado y el sprite
  Given una entidad con states { current: "off", values: ["off", "on"] }
  And sprite { asset: "lamp_off", byState: { on: "lamp_on" } }
  When se ejecuta la acción setState con state "on"
  Then states.current es "on"
  And visibleEntities devuelve el asset "lamp_on" para esa entidad
  And se emite entityChanged solo para esa entidad

Scenario: setState con un estado inexistente se rechaza
  Given la misma entidad
  When se ejecuta setState con state "broken"
  Then la validación de la acción falla
  And states.current sigue siendo "off"

Scenario: cycleState da la vuelta
  Given una entidad con states { current: "c", values: ["a", "b", "c"] }
  When se ejecuta cycleState
  Then states.current es "a"

Scenario: estado sin sprite propio
  Given una entidad con states.current "half" y sin byState.half
  When se resuelve su sprite
  Then se usa sprite.asset

@persistence
Scenario: el estado sobrevive a cerrar la app
  Incluye: AC-PERSIST-02
  Given una entidad cuyo estado cambió de "off" a "on"
  When se guarda y se vuelve a cargar la partida con el InMemorySaveStore
  Then states.current es "on"
  And el SavedEntity guardado solo contiene states.current, no values
  # Se verifica cuando HU-GAME-052 y HU-GAME-053 estén Done.

Scenario: estado guardado que ya no existe en el contenido
  Given un guardado con states.current "blue" y un prefab cuyos values son ["off", "on"] con current "off"
  When se carga la partida
  Then states.current es "off"
  And se registra un logger.warn con el id de la entidad
```

### Casos límite
- `states.values` con un solo valor: `cycleState` no cambia nada y no emite eventos (propuesta).
- `setState` al estado actual: no-op, sin eventos ni marca de sucio (propuesta).
- Una entidad con `byState` pero sin `states`: lo impide el validador (HU-GAME-024).

### Dependencias
- HU-GAME-024: prefabs con `states` validados.
- HU-GAME-006: render y selector de sprite.

### Consideraciones técnicas
- Documentos: [ENTITY_SCHEMA §5.2, §5.6](../../data/ENTITY_SCHEMA.md), [INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md), [SAVE_SCHEMA §2](../../data/SAVE_SCHEMA.md), [RENDERING §6](../../architecture/RENDERING.md).
- [NEEDED NOW] StateSystem, `setState`, `cycleState`, sprite por estado.
- [DESIGNED FOR LATER] animación por frames entre estados.
- Restricción: el sprite se resuelve en el selector, no en el componente React.

### Assets necesarios
- `env_home_lamp_floor_off`, `env_home_lamp_floor_on`, `env_home_toybox_closed`, `env_home_toybox_open` (placeholder aceptable: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acciones `setState` y `cycleState` con tests de `validate` y `execute`.
- [ ] Test de persistencia en el harness en cuanto exista el SaveService.
- [ ] Verificación manual: el cambio de sprite no parpadea en Android.

---

## HU-GAME-026 — Hitbox y hit testing

> **Status:** Draft
> **Epic:** EPIC-006 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-006 — Object System

### Prioridad
Must · P0

### Historia
Como **jugador pequeño**
quiero **que al tocar un objeto el juego sepa exactamente cuál quería tocar, aunque no sea preciso con el dedo**
para **coger y usar las cosas sin frustrarme**.

### Contexto
Hay un solo detector de gestos para toda la Canvas; el hit testing lo hace el motor en world units ([INPUT_SYSTEM §1 y §5](../../architecture/INPUT_SYSTEM.md)). El `hitbox` tiene una forma relativa al pivot, un `padding` (12 unidades por defecto) y zonas nombradas ([ENTITY_SCHEMA §5.3](../../data/ENTITY_SCHEMA.md)). El resultado alimenta el drag (HU-GAME-027), el tap (HU-GAME-032) y el resolver de interacciones (HU-GAME-031).

### Reglas de negocio
- **R1 — Formas v1:** `rect` y `circle`, relativas al pivot (`transform.x`, `transform.y`). `polygon` es [DESIGNED FOR LATER] y el validador lo rechaza en v1 (propuesta).
- **R2 — Transformación (propuesta):** la forma se escala con `transform.scale` y se refleja en x con `transform.flipX`.
- **R3 — Padding:** la forma se amplía `padding` unidades por todos los lados (12 por defecto).
- **R4 — Orden:** se recorren las entidades visibles (tras el culling de HU-GAME-008, o todas las de la escena si aún no existe) en **orden inverso al de render**: la del frente primero.
- **R5 — Entidades transparentes al input:** una entidad sin `draggable` activo **y** sin ninguna regla `tap` o `longPress` aplicable (decoración pura) **no es candidata**: el toque la atraviesa ([INPUT_SYSTEM §5](../../architecture/INPUT_SYSTEM.md), punto 3).
- **R5b — Para `dragStart`:** se elige la primera candidata con `draggable.enabled`. Si la primera candidata **no** es arrastrable pero tiene reglas `tap`, el gesto es tap o paneo y **no** se arrastra lo que hay detrás ([INPUT_SYSTEM §5](../../architecture/INPUT_SYSTEM.md), punto 4).
- **R6 — Contenedores:** los objetos dentro de un contenedor **abierto** con `showContentsWhenOpen` son candidatos **antes** que el contenedor; su posición es `transform del contenedor + container.slots[slot]`. Los de un contenedor cerrado no son tocables.
- **R7 — Zonas:** entre las `hitbox.zones` que contienen el punto gana la de **menor área** (la más específica: `mouth` gana a `head`); si empatan en área, la de nombre alfabéticamente menor; si ninguna lo contiene, la zona es `body`. El orden de las claves del JSON no importa ([INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md), paso 2; [ENTITY_SCHEMA §5.3](../../data/ENTITY_SCHEMA.md)).
- **R8 — Solo entidades en escena** (o dentro de un contenedor abierto de la escena). Las que están en mochila, mano o vestidas no son candidatas por sí mismas.
- **R9 — Función pura:** `hitTest(world, point, options)` vive en el motor y trabaja en world units. La conversión desde dp la hace el adaptador de input (HU-GAME-005).
- **R10 — Precisión:** sin alpha de píxel ([INPUT_SYSTEM §5](../../architecture/INPUT_SYSTEM.md), punto 5; [NOT NEEDED YET]).
- **R11 — Tamaño mínimo de toque en el mundo:** en tiempo de ejecución, el hit testing amplía cada hitbox (forma + `padding`) hasta que mida al menos **`minHitDp = 44 dp`** por eje, convertido a world units con la escala actual (`44 / scale`), manteniendo su centro; un `rect` crece en el eje que no llega y un `circle` crece su radio ([INPUT_SYSTEM §8](../../architecture/INPUT_SYSTEM.md)). En un teléfono de 360 dp de alto (`scale = 0,3333`), 44 dp son 132 unidades. Si las áreas ampliadas se solapan, gana la entidad más al frente (R4). La escala entra en `hitTest` como parámetro (`options.minHitWorld`), así la función sigue siendo pura. Los 64 dp de [DEFINITION_OF_DONE §6](../DEFINITION_OF_DONE.md) aplican a los botones de la HUD, no a los objetos del mundo.

### Criterios de aceptación
Salvo que el escenario diga otra cosa, se usa `scale = 0,7111` (44 dp ≈ 62 unidades), así que el mínimo de R11 no amplía las formas de los ejemplos.

```gherkin
Scenario: punto dentro de la forma
  Given una entidad en (1000, 960) con hitbox rect { x: -50, y: -100, w: 100, h: 100 }
  When se hace hitTest en (1000, 900)
  Then la entidad es la primera candidata

Scenario: punto dentro del padding
  Given la misma entidad con padding por defecto (12)
  When se hace hitTest en (1060, 900)
  Then la entidad es candidata

Scenario: punto fuera del padding
  Given la misma entidad
  When se hace hitTest en (1063, 900)
  Then la entidad no es candidata

Scenario: un objeto pequeño se amplía hasta minHitDp
  Given scale = 0,3333 (44 dp = 132 unidades)
  And una manzana en (1000, 960) con hitbox circle { x: 0, y: -40, r: 40 } y padding 12 (104 unidades de diámetro)
  When se hace hitTest en (1060, 920)
  Then la manzana es candidata, porque su área efectiva mide 132 unidades por eje
  And en (1070, 920) no es candidata

Scenario: el mínimo depende de la escala actual
  Given la misma manzana y scale = 0,7111 (tablet 4:3; 44 dp ≈ 62 unidades)
  When se hace hitTest en (1060, 920)
  Then la manzana no es candidata, porque forma + padding (104) ya supera el mínimo

Scenario: decoración pura transparente al input
  Given una planta decorativa sin draggable ni reglas tap/longPress delante de una pelota arrastrable
  When se hace hitTest en un punto común
  Then la planta no es candidata
  And la primera candidata es la pelota

Scenario: gana la entidad del frente
  Given dos entidades draggable solapadas, A en la capa "props" y B en la capa "furniture"
  When se hace hitTest en un punto común para un dragStart
  Then la entidad elegida es A

Scenario: un mueble con reglas tap tapa lo que tiene detrás
  Given una nevera cerrada no arrastrable con una regla tap delante de una manzana arrastrable
  When se hace hitTest para un dragStart en un punto común
  Then no se elige la manzana
  And el gesto se trata como tap o paneo

Scenario: los objetos de un contenedor abierto van antes que el contenedor
  Given una caja de juguetes abierta con una pelota en el slot 0
  When se hace hitTest en la posición del slot 0
  Then la primera candidata es la pelota

Scenario: los objetos de un contenedor cerrado no son tocables
  Given la misma caja cerrada con la pelota dentro
  When se hace hitTest en la posición del slot 0
  Then la pelota no es candidata y la primera candidata es la caja

Scenario: gana la zona de menor área
  Given un personaje cuyo hitbox declara primero la zona "head" (área 12000) y después "mouth" (área 1500), con "mouth" dentro de "head"
  When se hace hitTest en un punto de "mouth"
  Then la zona del candidato es "mouth"

Scenario: empate de área entre zonas
  Given dos zonas "handR" y "handL" de la misma área que contienen el punto
  When se hace hitTest en ese punto
  Then la zona del candidato es "handL"

Scenario: punto fuera de todas las zonas
  Given el mismo personaje
  When se hace hitTest en un punto del hitbox que no está en ninguna zona
  Then la zona del candidato es "body"

Scenario: flipX refleja la forma
  Given una entidad en x = 1000 con hitbox rect { x: 0, y: -100, w: 100, h: 100 } y padding 0
  And transform.flipX true
  When se hace hitTest en (950, 950)
  Then la entidad es candidata

@manual
Scenario: los objetos pequeños se aciertan con el dedo de un niño
  Incluye: AC-A11Y-01
  Given la escena de prueba en un teléfono con objetos pequeños (manzana, pelota)
  When un niño de 5 años intenta coger cada objeto 5 veces
  Then acierta al menos 4 de cada 5 intentos (umbral propuesto)
  # Pasos: registrar aciertos y fallos por objeto; anotar el resultado en la HU.
```

### Casos límite
- Punto en el borde exacto de la forma ampliada: cuenta como dentro (propuesta: límites cerrados).
- Entidad con `draggable.enabled: false` delante de otra arrastrable y sin reglas `tap`/`longPress`: es transparente (R5) y se elige la de detrás. Un producto de tienda fijo con reglas `tap` no es transparente.
- El mínimo de 44 dp amplía un objeto hasta solaparse con otro vecino: gana el del frente, aunque el punto esté más cerca del centro del de detrás.
- Punto fuera de la escena (x < 0): no hay candidatas.

### Dependencias
- HU-GAME-024: prefabs con `hitbox` validado.
- HU-GAME-007: cámara (conversión de coordenadas con `cameraX`).

### Consideraciones técnicas
- Documentos: [INPUT_SYSTEM §1, §4, §5, §8](../../architecture/INPUT_SYSTEM.md), [ENTITY_SCHEMA §5.3](../../data/ENTITY_SCHEMA.md), [INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md).
- [NEEDED NOW] `hitTest` en JS en el motor, con transparencia al input y `minHitDp`. Para saber si una entidad tiene reglas `tap`/`longPress` aplicables se consulta el RuleIndex (HU-GAME-031); hasta que exista, solo cuenta `draggable`.
- ⚠️ Spike de Fase 0 ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md), [ADR-009](../../decisions/ADR-009-STATE-AND-THREADING.md)): medir la latencia del hit test en JS en el Android de referencia; si molesta, réplica de hitboxes en un SharedValue [DESIGNED FOR LATER].
- [NOT NEEDED YET] polígonos y alpha de píxel.
- Restricción: nada de un `GestureDetector` por entidad; el hit test no conoce dp.

### Assets necesarios
- Ninguno nuevo (usa los prefabs de prueba de HU-GAME-024).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] `hitTest` con tests unitarios de cada escenario.
- [ ] Resultado del spike de latencia anotado en la HU.
- [ ] Prueba manual de acierto con el dedo registrada.
