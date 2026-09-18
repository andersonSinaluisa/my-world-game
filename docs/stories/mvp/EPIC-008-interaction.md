# EPIC-008 — Interaction System

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 0 (HU-GAME-033 en Fase 1)
> **Docs:** [INTERACTION_SYSTEM](../../architecture/INTERACTION_SYSTEM.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [INPUT_SYSTEM](../../architecture/INPUT_SYSTEM.md) · [GAME_ENGINE](../../architecture/GAME_ENGINE.md) · [ECS](../../architecture/ECS.md) · [ACCEPTANCE_CRITERIA](../ACCEPTANCE_CRITERIA.md)

## Objetivo del epic
Que todas las interacciones (soltar algo sobre algo, tocar algo) se resuelvan con reglas de datos: un trigger, matchers por capacidades, condiciones de un conjunto cerrado y acciones de un conjunto cerrado. El motor elige una regla de forma determinista, la ejecuta en una transacción y da un feedback amable cuando no se puede. Añadir un objeto nuevo nunca requiere código.

## Historias
- [HU-GAME-031 — Resolver interacciones mediante reglas de datos](#hu-game-031--resolver-interacciones-mediante-reglas-de-datos)
- [HU-GAME-032 — Interacciones por tap](#hu-game-032--interacciones-por-tap)
- [HU-GAME-033 — Resaltar el destino válido durante el arrastre](#hu-game-033--resaltar-el-destino-válido-durante-el-arrastre)

---

## HU-GAME-031 — Resolver interacciones mediante reglas de datos

> **Status:** Draft
> **Epic:** EPIC-008 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-008 — Interaction System

### Prioridad
Must · P0

### Historia
Como **diseñador de contenido**
quiero **declarar en JSON qué pasa cuando se suelta un objeto con ciertas capacidades sobre otro**
para **crear interacciones nuevas combinando acciones existentes, sin escribir código ni `if` por objeto**.

### Contexto
Las reglas viven en `content/<pack>/interactions/*.rules.json` ([INTERACTION_SCHEMA §1, §2](../../data/INTERACTION_SCHEMA.md)). El `RuleIndex` las indexa por trigger y componente; el `InteractionResolver` elige una de forma determinista y el `ActionExecutor` la ejecuta en una transacción ([INTERACTION_SYSTEM §2, §3](../../architecture/INTERACTION_SYSTEM.md), [INTERACTION_SCHEMA §6](../../data/INTERACTION_SCHEMA.md)). Esta HU construye la infraestructura completa con el trigger `drop`. Cada acción y condición concreta la añade la HU que la necesita (p. ej. `eat` en HU-GAME-042), salvo las que se indican aquí.

### Reglas de negocio
- **R1 — Schema zod `strict`** de `InteractionRule` (triggers v1: `drop`, `tap`, `longPress`; campo `fallback: 'place' | 'returnToOrigin'`, por defecto `place`), `Matcher`, `TargetMatcher`, `ActionSpec` y `Condition` ([INTERACTION_SCHEMA §2](../../data/INTERACTION_SCHEMA.md)), con las validaciones de [INTERACTION_SCHEMA §9](../../data/INTERACTION_SCHEMA.md): `id` único en el pack; acción o condición desconocida → error; `tap` con `source` → error; `prefabId` en una regla global → error; `has` con componentes inexistentes → error; roles incompatibles con el trigger → error.
- **R2 — RuleIndex** construido al cargar los packs, con clave `trigger → componente requerido del target`. Incluye las `extraRules` de los prefabs (con `source` o `target` implícitos = ese prefab).
- **R3 — Algoritmo** ([INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md)), entrada `{ trigger, sourceId?, point, sceneId }`:
  1. candidatos de target con el hit testing (HU-GAME-026), del frente hacia atrás, **excluyendo** el `source` y lo que lleva (lo que sostiene o viste); un drop target de UI (la mochila) va primero si el punto cae sobre él;
  2. zona de cada candidato: entre las `hitbox.zones` que contienen el punto, la de **menor área**; si empatan, la de nombre alfabéticamente menor; si ninguna, `body` (misma función que HU-GAME-026);
  3. reglas aplicables: `source` y `target` (incluida la zona) coinciden y la regla no está en `interactions.disabledRules` de ninguno de los dos prefabs;
  4. orden: `priority` mayor → candidato más al frente → mayor especificidad (número de restricciones del matcher: `has`, `tags`, `anyTags`, `notTags`, `state`, `zone`…) → `id` en orden alfabético;
  5. se evalúan las condiciones de la regla ganadora; si fallan, se prueba la **siguiente** regla del orden;
  6. si ninguna pasa, se emite `interactionRejected` con la razón de la **primera** regla que coincidió y se aplica el `fallback` **de esa regla** (`place` por defecto; `returnToOrigin` para productos de tienda, [INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md));
  7. drop sin ninguna regla que coincida: la acción `place` (HU-GAME-028).
- **R4 — Transacción** ([INTERACTION_SCHEMA §6](../../data/INTERACTION_SCHEMA.md)): se ejecuta `validate` de **todas** las acciones; si alguna falla, no se ejecuta ninguna, se emite `interactionRejected { ruleId, reason }` y se aplica el `fallback` de la regla. Si todas pasan, se ejecutan en orden y los eventos se emiten al final, en bloque.
- **R5 — Éxito:** se emite `interactionPerformed { ruleId, sourceId, targetId, actions }` ([GAME_ENGINE §5](../../architecture/GAME_ENGINE.md)).
- **R6 — Rechazo amable** ([AC-REJECT-01](../ACCEPTANCE_CRITERIA.md)): `visualEffect "shake"` sobre el target (HU-GAME-009), sonido de rechazo suave (cuando exista el AudioService) y el `fallback` de la regla (con `place`, el objeto queda bajo el punto). **Nunca** hay texto de error.
- **R7 — Drop sin ninguna regla que coincida:** solo `place`; no se emite `interactionRejected`.
- **R8 — Conjunto cerrado:** acciones en `engine/actions/<name>.ts` con `validate(ctx)` y `execute(ctx)` y schema de parámetros; condiciones en `engine/rules/conditions/`. Prohibidas las condiciones tipo "expresión" o scripting.
- **R9 — Implementadas en esta HU:** el `ActionExecutor`, el registro de acciones y condiciones, la acción `place` (ya creada en HU-GAME-028), el fallback `place` y las condiciones `stateIs` e `isOpen` (solo necesitan `states` y `openable`, que ya existen). `isOpen` **pasa** si la entidad no tiene `openable` (siempre abierta: cesta, alacena sin puertas) o si está en `openState` ([INTERACTION_SCHEMA §4](../../data/INTERACTION_SCHEMA.md)). `setState` y `cycleState` vienen de HU-GAME-025. Las demás acciones y condiciones las añade la HU que las usa: p. ej. `poseIsNot` (EPIC-004/012), `isPurchased` y el fallback `returnToOrigin` (HU-GAME-064/066), el trigger `longPress` con `unwear` (HU-GAME-040).
- **R10 — Roles:** cada acción tiene roles por defecto (`$source`, `$target`) según [INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md); las reglas solo los declaran si cambian.
- **R11 — Coste:** ≤ 5 candidatos × ≤ 10 reglas indexadas por evento ([INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md)); el drop completo cumple ≤ 50 ms ([PERFORMANCE §2](../../architecture/PERFORMANCE.md)).
- **R12 — Determinismo:** mismo World + mismo drop ⇒ misma regla y mismos eventos.

Reglas de fixture usadas en los ejemplos (pack `test`):

| id | trigger | source | target | condiciones | acciones | prio |
|---|---|---|---|---|---|---|
| `paint_open_box` | drop | has `draggable`, tags `brush` | has `openable` | `isOpen $target` | `setState { entity: $target, state: "painted" }` | 70 |
| `tag_box` | drop | has `draggable` | has `openable` | — | `cycleState { entity: $target }` | 10 |
| `hit_zone_lid` | drop | has `draggable`, tags `brush` | has `openable`, zone `lid` | — | `setState { entity: $target, state: "open" }` | 70 |

La caja de fixture tiene `states { values: ["closed", "open", "painted"] }`, `openable { openState: "open", closedState: "closed" }` y una zona de hitbox `lid`.

### Criterios de aceptación
```gherkin
Scenario: gana la regla de mayor prioridad cuya condición pasa
  Given una caja abierta (states.current "open") y un pincel con tag "brush"
  When se suelta el pincel sobre la caja
  Then se aplica la regla "test:paint_open_box"
  And states.current de la caja es "painted"
  And se emite interactionPerformed con ruleId "test:paint_open_box"

Scenario: si la condición falla se prueba la siguiente regla
  Given una caja cerrada y un pincel con tag "brush"
  When se suelta el pincel sobre la caja fuera de la zona "lid"
  Then "test:paint_open_box" falla por isOpen
  And se aplica "test:tag_box"

Scenario: desempate por especificidad
  Given una caja abierta y un pincel con tag "brush"
  When se suelta el pincel dentro de la zona "lid" de la caja
  Then se aplica "test:hit_zone_lid" y no "test:paint_open_box" (misma prioridad, más restricciones)

Scenario: desempate por id
  Given dos reglas con la misma prioridad, el mismo candidato y la misma especificidad, "test:b_rule" y "test:a_rule"
  When se resuelve el drop
  Then se aplica "test:a_rule"

Scenario: ninguna regla pasa sus condiciones
  Given solo la regla "test:paint_open_box" y una caja cerrada
  When se suelta el pincel sobre la caja
  Then se emite interactionRejected con ruleId "test:paint_open_box" y la razón de isOpen
  And se emite visualEffect "shake" sobre la caja
  And el pincel queda colocado con place bajo el punto de soltado

Scenario: rechazo amable
  Incluye: AC-REJECT-01

Scenario: una acción que no valida cancela toda la regla
  Given una regla con las acciones [cycleState sobre el target, setState con el estado inexistente "broken"]
  When se suelta el source sobre el target
  Then el estado del target no cambia
  And se emite interactionRejected y el source se coloca con place

Scenario: isOpen pasa sin openable
  Given una regla con la condición isOpen $target y un target con container pero sin openable
  When se suelta un objeto sobre el target
  Then la condición isOpen pasa y se aplica la regla

Scenario: la zona elegida es la de menor área
  Given una caja con las zonas "lid" (área 2000) y "front" (área 9000) que contienen el punto, con "front" declarada primero en el JSON
  When se resuelve un drop en ese punto
  Then los matchers se evalúan con la zona "lid"

Scenario: sin reglas que coincidan solo se apoya
  Given una pelota sin reglas aplicables sobre una mesa
  When se suelta sobre la mesa
  Then la pelota se apoya con place
  And no se emite interactionRejected

Scenario: disabledRules de un prefab
  Given un pincel cuyo prefab tiene interactions.disabledRules ["test:paint_open_box"]
  When se suelta sobre una caja abierta
  Then se aplica "test:tag_box"

Scenario: el source no es su propio target
  Given una caja openable y draggable
  When se suelta sobre un punto que solo cubre su propio hitbox
  Then la caja no se considera candidata de sí misma y se aplica place

Scenario: los eventos se emiten al final
  Given una regla con 2 acciones
  When se ejecuta
  Then un listener del EventBus recibe todos los eventos en un único bloque tras la transacción

Scenario Outline: reglas inválidas en el contenido
  Given un archivo de reglas con <problema>
  When se valida el pack
  Then hay un error de validación con code "<code>"

  Examples:
    | problema                                       | code                |
    | dos reglas con id "eat_food"                   | duplicateRuleId     |
    | una acción "explode"                           | unknownAction       |
    | una condición "isHungry"                       | unknownCondition    |
    | trigger "tap" con source                       | tapWithSource       |
    | prefabId en el matcher de una regla global     | prefabIdInGlobal    |
    | has ["flying"]                                 | unknownComponent    |
```

### Casos límite
- Un drop sobre la mochila (`ui: "inventory"`): el candidato de UI va primero; la regla y la acción son HU-GAME-037.
- Una regla con `priority` negativa: válida; queda por debajo de las de prioridad 0.
- Reglas de dos packs con el mismo `id` sin namespace: no chocan porque el id final lleva namespace (`core:eat_food`, `school:eat_food`).
- `extraRules` con `prefabId` en el matcher: permitido solo ahí.
- Una acción lanza una excepción inesperada en `execute`: la transacción se revierte (HU-GAME-003), se trata como rechazo y se registra el error.

### Dependencias
- HU-GAME-028: `place` como fallback.

### Consideraciones técnicas
- Documentos: [INTERACTION_SYSTEM](../../architecture/INTERACTION_SYSTEM.md), [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md), [GAME_ENGINE §5, §8](../../architecture/GAME_ENGINE.md).
- [NEEDED NOW] RuleIndex, resolver, executor, `stateIs`, `isOpen`.
- El resolver acepta los tres triggers v1 (`drop`, `tap`, `longPress`); esta HU prueba `drop`, HU-GAME-032 `tap` y HU-GAME-040 `longPress`.
- [DESIGNED FOR LATER] trigger `combine`; acción `emit`.
- Restricción: el resolver no contiene `if` por prefab ni por categoría; el orden se decide solo con los datos de la regla.

### Assets necesarios
- Sonido de rechazo suave `sfx_reject_soft` (placeholder aceptable: sí; Kenney Interface Sounds, CC0). Se conecta cuando exista el AudioService (HU-GAME-056).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests unitarios del resolver con un `RuleIndex` de fixtures: prioridad, desempates, zonas, condiciones y fallback ([INTERACTION_SYSTEM §8](../../architecture/INTERACTION_SYSTEM.md)).
- [ ] Test por acción y condición implementada (`validate` + `execute`).
- [ ] Tiempo de respuesta del drop medido en el Android de referencia.
- [ ] INTERACTION_SCHEMA §9 actualizado con los códigos de error definitivos.

---

## HU-GAME-032 — Interacciones por tap

> **Status:** Draft
> **Epic:** EPIC-008 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-008 — Interaction System

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **tocar los objetos para que hagan algo (abrirse, encenderse, reaccionar)**
para **descubrir el mundo tocándolo todo**.

### Contexto
Un tap es un toque de < 250 ms con un movimiento < 10 dp ([INPUT_SYSTEM §2](../../architecture/INPUT_SYSTEM.md)). Genera el comando `pointerTap { worldPoint }` → hit test → resolver con trigger `tap` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)). Las reglas `tap` no tienen `source` ([INTERACTION_SCHEMA §2](../../data/INTERACTION_SCHEMA.md)). El pack `core` define `tap_open`, `tap_switch`, `tap_spawner`, `tap_character` y `tap_collect` ([INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md)); sus acciones llegan con sus HU (HU-GAME-034, 047, 044, 015, 067). Esta HU deja el camino del tap completo y lo prueba con acciones que ya existen.

### Reglas de negocio
- **R1 — Definición de tap:** duración < 250 ms **y** movimiento < 10 dp. Un toque que no cumple ambas no es tap.
- **R2 — Target:** la entidad más al frente bajo el punto (sea o no arrastrable), según el hit testing de HU-GAME-026, con su zona. La decoración pura (sin `draggable` activo ni reglas `tap`/`longPress`) es transparente: el tap la atraviesa y llega a lo que hay detrás.
- **R3 — Resolución:** mismo algoritmo y mismo orden que HU-GAME-031 con trigger `tap` y sin `source`.
- **R4 — Tap sin regla:** no hace nada, salvo `visualEffect` con el preset de `animations.tap` si el objeto lo define ([INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md), paso 7). No hay fallback `place`.
- **R5 — Tap rechazado** (una regla coincide pero ninguna pasa sus condiciones, p. ej. `belowMax`): `interactionRejected` + `visualEffect "shake"` + sonido suave, sin texto. No hay `place` (no hay nada que colocar).
- **R6 — Tap sobre el fondo:** no hace nada y no mueve la cámara.
- **R7 — HUD primero:** los `Pressable` de la HUD capturan el toque antes que la Canvas ([INPUT_SYSTEM §6](../../architecture/INPUT_SYSTEM.md)).
- **R8 — Long press** (≥ 450 ms con movimiento < 10 dp) no es tap. Sobre un personaje genera `pointerLongPress { worldPoint }` y se resuelve con reglas `longPress` (MVP: solo `unwear_clothes`, HU-GAME-040); el resultado puede traer `startDrag` ([INPUT_SYSTEM §2](../../architecture/INPUT_SYSTEM.md), [GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)). Esta HU solo garantiza que un long press no dispara reglas `tap`.
- **R9 — Transiciones:** durante una transición de escena la entrada está bloqueada y los taps se ignoran ([SCENE_SYSTEM §4](../../architecture/SCENE_SYSTEM.md)).
- **R10 — Taps rápidos:** cada tap se procesa por separado, sin debounce (propuesta). Dos taps sobre una lámpara la encienden y la apagan.

Regla de fixture: `test:tap_cycle` — trigger `tap`, target has `switchable`, acción `cycleState { entity: $target }`, prio 10.

### Criterios de aceptación
```gherkin
Scenario: un tap ejecuta la regla del objeto
  Given una lámpara switchable con states { current: "off", values: ["off", "on"] }
  When se despacha pointerTap en un punto de la lámpara
  Then se aplica "test:tap_cycle" y states.current es "on"
  And se emite interactionPerformed

Scenario: tap sin regla con animación
  Given un osito sin reglas tap y con animations { tap: "wiggle" }
  When se despacha pointerTap sobre el osito
  Then se emite visualEffect { preset: "wiggle" } sobre el osito
  And no se emite interactionPerformed ni interactionRejected
  And el World no cambia

Scenario: la decoración pura es transparente al tap
  Given una planta decorativa sin draggable ni reglas tap/longPress delante de la lámpara
  When se despacha pointerTap en un punto común a las dos
  Then se aplica "test:tap_cycle" sobre la lámpara

Scenario: tap sobre decoración pura sin nada detrás
  Given una planta decorativa sin draggable ni reglas, sin otra entidad detrás
  When se despacha pointerTap sobre la planta
  Then no se emite ningún evento

Scenario: tap sobre el fondo
  When se despacha pointerTap en un punto sin entidades
  Then no se emite ningún evento y cameraX no cambia

Scenario: tap rechazado
  Given un objeto con una regla tap cuya condición stateIs falla
  When se despacha pointerTap sobre el objeto
  Then se emite interactionRejected
  And se emite visualEffect "shake" sobre el objeto
  And no se aplica place

Scenario: dos taps seguidos
  Given la lámpara apagada
  When se despachan dos pointerTap seguidos sobre ella
  Then states.current vuelve a ser "off"

@persistence
Scenario: el estado cambiado por tap se conserva
  Incluye: AC-PERSIST-01, AC-PERSIST-02

@manual
Scenario: umbrales del tap en el dispositivo
  Given la lámpara en un teléfono
  When el jugador la toca durante menos de 250 ms moviendo menos de 10 dp
  Then la lámpara cambia de estado
  And si mantiene el dedo 300 ms sin moverlo y lo levanta, no cambia
  And si mueve el dedo 6 dp o más sobre ella (no es arrastrable), no cambia y se hace paneo

@manual
Scenario: se entiende sin leer
  Incluye: AC-A11Y-01
```

### Casos límite
- Tap sobre un objeto arrastrable con regla tap (p. ej. un personaje): si el dedo se mueve ≥ 6 dp empieza el drag; si no, y dura < 250 ms, es tap.
- Toque de 250-450 ms sin movimiento: no es tap ni long press; no hace nada.
- Toque que se mueve entre 6 y 10 dp en < 250 ms: el paneo (o el drag) ya empezó a los 6 dp, así que no es tap.
- Tap sobre un objeto dentro de un contenedor abierto: el objeto es el target antes que el contenedor (HU-GAME-026, R6).

### Dependencias
- HU-GAME-026: hit testing.
- HU-GAME-031: resolver y executor.

### Consideraciones técnicas
- Documentos: [INPUT_SYSTEM §2, §6](../../architecture/INPUT_SYSTEM.md), [INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md), [INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md), [GAME_ENGINE §4](../../architecture/GAME_ENGINE.md).
- [NEEDED NOW] reconocimiento del tap en el gesto único y comando `pointerTap`.
- El trigger `longPress` ya es v1, pero su única regla y su acción llegan con HU-GAME-040.
- Restricción: la clasificación tap/drag/paneo es una función pura (duración, distancia, resultado del hit test) con tests.

### Assets necesarios
- Ninguno nuevo (usa la lámpara placeholder de HU-GAME-025).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests en el harness de todos los escenarios automatizables.
- [ ] Tests unitarios de la clasificación tap/drag/paneo.
- [ ] Verificación manual de los umbrales en Android e iOS.

---

## HU-GAME-033 — Resaltar el destino válido durante el arrastre

> **Status:** Draft
> **Epic:** EPIC-008 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-008 — Interaction System

### Prioridad
Should · P1

### Historia
Como **jugador que aún no sabe leer**
quiero **ver qué objeto o personaje "acepta" lo que llevo antes de soltarlo**
para **saber qué va a pasar y descubrir las interacciones por mí mismo**.

### Contexto
Durante el arrastre, el adaptador de input pide al resolver una **previsualización** cada vez que cambia el target bajo el dedo, nunca en cada frame ([INTERACTION_SYSTEM §6](../../architecture/INTERACTION_SYSTEM.md)). El comando es `dragPreview { entityId, worldPoint }` y el evento `dropPreview { targetId?, ok, reason? }` ([GAME_ENGINE §4, §5](../../architecture/GAME_ENGINE.md)). La regla puede desactivar el resaltado con `feedback.highlight: false` y mostrar un icono con `feedback.rejectHint` ([INTERACTION_SCHEMA §2](../../data/INTERACTION_SCHEMA.md)).

### Reglas de negocio
- **R1 — Cuándo se previsualiza** ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md)): solo cuando cambia el target o la zona bajo el dedo. El worklet guarda los bounds del target (y de la zona) de la última previsualización y solo llama al JS cuando el dedo sale de ellos o entra en otra zona. Salir de todo target también cuenta como cambio. Si el cálculo en el UI thread no es viable, el fallback es un muestreo a **≤ 10 Hz**.
- **R2 — `resolver.preview(ctx) → { ruleId, ok, reason }`** es una función **pura**: no ejecuta acciones, no modifica el World, no emite `entityChanged` ni marca nada como sucio.
- **R3 — Resultado visible:**
  - `ok: true` y `feedback.highlight !== false` → outline suave y ligera escala del target;
  - una regla coincide pero falla una condición → se muestra `feedback.rejectHint` si existe; sin outline;
  - ninguna regla coincide → sin resaltado (el `place` no se resalta, propuesta).
- **R4 — Coherencia:** si el dedo no se mueve entre el último `dragPreview` y el `dragEnd`, la regla aplicada en el drop es la misma que la de la previsualización.
- **R5 — Limpieza:** el resaltado desaparece al cambiar de target, al soltar y al cancelar el drag.
- **R6 — Render:** el outline es la única excepción de shader junto al tinte ([RENDERING §8](../../architecture/RENDERING.md)); se dibuja en la capa `Effects`. La escala del target es presentación (SharedValue), no cambia `transform`.
- **R7 — Mochila:** el botón de la mochila de la HUD también se resalta si la regla `ui: "inventory"` pasa (lo conecta HU-GAME-037).
- **R8 — Coste:** una previsualización cuesta lo mismo que un drop sin ejecutar acciones; no afecta a los FPS del UI thread durante el drag.

### Criterios de aceptación
```gherkin
Scenario: destino válido
  Given una caja abierta y un pincel arrastrándose con la regla "test:paint_open_box"
  When el dedo entra en el hitbox de la caja
  Then se despacha un dragPreview
  And se emite dropPreview { targetId: caja, ok: true }

Scenario: destino que coincide pero no cumple la condición
  Given una caja cerrada, solo la regla "test:paint_open_box" y feedback.rejectHint "ui_hint_closed"
  When el dedo entra en el hitbox de la caja
  Then se emite dropPreview { targetId: caja, ok: false, reason: <razón de isOpen> }
  And la UI muestra el icono "ui_hint_closed" sobre la caja

Scenario: la previsualización no cambia el World
  Given un World con un snapshot S
  When se ejecutan 10 dragPreview sobre distintos targets
  Then el World sigue siendo igual a S
  And no se ha marcado ninguna entidad como sucia

Scenario: moverse dentro del mismo target no genera previsualizaciones
  Given un dragPreview ya enviado para la caja en la zona "body"
  When el dedo se mueve 50 dp sin salir de la zona "body" de la caja
  Then no se despacha ningún dragPreview nuevo

Scenario: resaltado desactivado por la regla
  Given una regla que pasa con feedback.highlight false
  When el dedo entra en el target
  Then se emite dropPreview { ok: true }
  And la UI no dibuja outline

Scenario: el drop coincide con la previsualización
  Given un dropPreview con ruleId "test:paint_open_box"
  When se suelta el pincel sin mover el dedo
  Then se aplica la regla "test:paint_open_box"

Scenario: limpieza al cancelar
  Given la caja resaltada
  When el drag se cancela
  Then desaparece el outline de la caja

@manual
Scenario: el niño entiende qué acepta cada cosa
  Incluye: AC-A11Y-01
  # Pasos: con la escena de prueba, pedir a un niño que "dé de comer" o "guarde" un objeto y observar si usa el resaltado para decidir.

@performance @manual
Scenario: el resaltado no provoca tirones
  Incluye: AC-PERF-01
```

### Casos límite
- Dedo sobre un personaje que está en la zona `mouth` y luego pasa a `body`: es un cambio de zona (R1) y cada una tiene su previsualización.
- El target cambia de estado mientras el dedo está encima (improbable en el MVP): la previsualización se actualiza en el siguiente cambio de target (propuesta).
- `rejectHint` con una clave de asset inexistente: lo detecta el validador (HU-GAME-069).

### Dependencias
- HU-GAME-031: resolver.

### Consideraciones técnicas
- Documentos: [INTERACTION_SYSTEM §6](../../architecture/INTERACTION_SYSTEM.md), [INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md), [GAME_ENGINE §4, §5](../../architecture/GAME_ENGINE.md), [RENDERING §8](../../architecture/RENDERING.md), ANIMATION_GUIDELINES (pendiente).
- [NEEDED NOW] `resolver.preview`, `dragPreview`, `dropPreview`, outline.
- Restricción: el adaptador detecta el cambio de target en el UI thread y solo entonces cruza a JS. Si se usa el fallback de ≤ 10 Hz, se anota en la HU con la medición que lo justifica.

### Assets necesarios
- `ui_hint_closed`, `ui_hint_container_full`: iconos de pista de rechazo (placeholder aceptable: sí; Kenney Game Icons, CC0).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests en el harness de `preview` (pureza, coherencia con el drop, número de previsualizaciones).
- [ ] Verificación manual del outline y de las pistas en Android e iOS.
- [ ] Test con un worklet simulado: moverse dentro de los bounds guardados no cruza a JS.
