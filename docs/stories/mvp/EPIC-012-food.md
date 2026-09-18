# EPIC-012 — Food & Drinks

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [INTERACTION_SYSTEM](../../architecture/INTERACTION_SYSTEM.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [CHARACTER_SYSTEM](../../architecture/CHARACTER_SYSTEM.md) · [OBJECT_SCHEMA](../../data/OBJECT_SCHEMA.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md)

## Objetivo del epic
Que los personajes coman y beban cuando el niño les acerca comida o bebida a la boca, mordisco a mordisco y sorbo a sorbo, con pose, expresión "ñam", sonido y un resultado visible (corazón de manzana, vaso vacío). Y que la comida no se acabe nunca gracias a dispensadores como el frutero. Todo con `edible`, `drinkable`, `spawner` y las reglas `eat_food`, `drink_drink` y `tap_spawner`.

## Historias
- [HU-GAME-042 — Comer alimentos por mordiscos](#hu-game-042--comer-alimentos-por-mordiscos)
- [HU-GAME-043 — Beber bebidas](#hu-game-043--beber-bebidas)
- [HU-GAME-044 — Dispensadores de objetos](#hu-game-044--dispensadores-de-objetos)

---

## HU-GAME-042 — Comer alimentos por mordiscos

> **Status:** Draft
> **Epic:** EPIC-012 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-012 — Food & Drinks

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **acercar una manzana a la boca de mi personaje para que le dé un mordisco**
para **darle de comer y ver cómo la comida se va acabando**.

### Contexto
Es el caso de ejemplo de la arquitectura ([ARCHITECTURE §4](../../architecture/ARCHITECTURE.md)). La regla `eat_food` ejecuta la acción `eat` del ConsumeSystem: pose `eat`, `bitesLeft − 1`, sprite del mordisco y, al llegar a 0, `onFinish` ([INTERACTION_SCHEMA §5, §7](../../data/INTERACTION_SCHEMA.md), [ENTITY_SCHEMA §5.9](../../data/ENTITY_SCHEMA.md)).

### Reglas de negocio
- R1: Regla `eat_food`: trigger `drop`; source has `edible`; target has `character`, zona `mouth`/`head`; condiciones `isPurchased` (`{ value: true, ifMissing: true }`) y `poseIsNot [sleep]`; acción `eat`; prioridad 100 ([INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md)).
- R2: `eat`: `bitesLeft` baja en 1 (si no estaba definido, vale `bites`); el sprite pasa a `spriteByBitesLeft[bitesLeft]` si existe.
- R3: El personaje entra en pose `eat` **unos 900 ms** con `returnTo` = su pose persistente (`idle` o `sit`), expresión `yum` mientras dura la pose y efecto de migas; suena `sounds.eat`.
- R4: Al llegar `bitesLeft` a 0 se aplica `onFinish`: `remove` → location `limbo` (y, si era entidad declarada de escena, su id pasa a `removed`); `replace` → se elimina y se crea `onFinish.prefabId` (manzana → corazón de manzana), que va a la **mano libre** del comensal o, si no tiene ninguna, a sus pies. Sin `onFinish`: `remove` (**propuesta** de default).
- R5: Contenido MVP: manzana 3 mordiscos → `core:apple_core`; galleta 1 mordisco; plátano, sándwich y porción de pastel con `bites` definidos en su prefab ([MVP_SCOPE](../../product/MVP_SCOPE.md)).
- R6: Tras un mordisco con `bitesLeft > 0`, la comida pasa a la **mano libre** del comensal (location `held`, elección de mano de [CHARACTER_SYSTEM §6](../../architecture/CHARACTER_SYSTEM.md)); si no tiene ninguna mano libre, se coloca con `place` a sus pies. Todo en la misma transacción ([INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md)).
- R7: Soltar la comida en la mano → `hold_item`; en el cuerpo sin manos libres → rechazo amable y `place`. Comer algo ya sostenido tocándolo es [DESIGNED FOR LATER]: para otro mordisco hay que arrastrarlo desde la mano hasta la boca.
- R7b: No se come dormido (`poseIsNot [sleep]`) ni un producto de la tienda sin comprar (`isPurchased`): rechazo amable (AC-REJECT-01) y `place`.
- R8: `bitesLeft` se persiste; la comida consumida por completo no reaparece.
- R9: Dos mordiscos seguidos antes de 900 ms: **propuesta** — el segundo se aplica, la pose `eat` se reinicia y `returnTo` conserva la pose persistente original.

### Criterios de aceptación
```gherkin
Scenario: primer mordisco
  Given un objeto con edible { bites: 3 } sin bitesLeft (una manzana)
  And un personaje en idle
  When el jugador suelta la manzana sobre la zona "mouth" del personaje
  Then se resuelve "core:eat_food"
  And bitesLeft es 2 y el sprite es spriteByBitesLeft["2"]
  And la manzana queda en la mano libre del personaje (location "held")
  And el personaje está en pose "eat" con expresión "yum"
  And tras unos 900 ms vuelve a "idle" con expresión "neutral"

Scenario: el último mordisco reemplaza el objeto
  Given una manzana con bitesLeft 1 y onFinish { type: "replace", prefabId: "core:apple_core" }
  When el jugador la suelta sobre la zona "mouth" de un personaje
  Then la manzana ya no existe en la escena
  And existe una entidad nueva con prefabId "core:apple_core" en la mano libre del personaje

Scenario: sin manos libres la comida queda a sus pies
  Given un personaje con las dos manos ocupadas y una manzana con bitesLeft 3
  When el jugador suelta la manzana sobre su zona "mouth"
  Then bitesLeft es 2 y la manzana tiene location "scene" apoyada a los pies del personaje

Scenario: no se come dormido
  Given un personaje en pose "sleep"
  When el jugador suelta una manzana sobre su zona "mouth"
  Then poseIsNot falla y se emite interactionRejected
  And el personaje hace "shake", suena el rechazo suave y la manzana se coloca con "place"
  And bitesLeft no cambia

Scenario: producto sin comprar
  Given una comida con purchasable { purchased: false } en la tienda
  When el jugador la suelta sobre la zona "mouth" de un personaje
  Then isPurchased falla, se emite interactionRejected y la comida se coloca con "place"

Scenario: comida de un solo mordisco sin resultado
  Given un objeto con edible { bites: 1, onFinish: { type: "remove" } } (una galleta declarada en la escena)
  When el jugador lo suelta sobre la zona "head" de un personaje
  Then la galleta desaparece y su id queda en la lista "removed" del guardado

Scenario: comer sentado vuelve a sentado
  Given un personaje en pose "sit"
  When come un mordisco
  Then durante unos 900 ms está en "eat" y después vuelve a "sit" en el mismo asiento

Scenario: la comida en la mano no se come
  Given un personaje con la mano izquierda libre
  When el jugador suelta la manzana sobre la zona "handL"
  Then se resuelve "core:hold_item" y bitesLeft no cambia

@persistence
Scenario: los mordiscos persisten
  Given una manzana con bitesLeft 2 sobre la mesa
  When la app se cierra por completo y se vuelve a abrir
  Then la manzana sigue sobre la mesa con bitesLeft 2 y el sprite del primer mordisco
```
Incluye: AC-REJECT-01, AC-PERSIST-01, AC-PERSIST-02, AC-PERF-01, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Personaje que ya sostiene algo en una mano: la comida mordida va a la otra mano.
- Resultado de `replace` (corazón de manzana) con las dos manos ocupadas: a los pies del personaje.
- `spriteByBitesLeft` sin la clave actual: se mantiene el sprite anterior.
- Arrastrar al personaje durante la pose `eat`: se cancela la pose; el mordisco ya se aplicó.
- Comida guardada en la nevera o la mochila conserva `bitesLeft`.

### Dependencias
- HU-GAME-031: reglas de datos.
- HU-GAME-014: pose `eat` temporal con `returnTo`.
- HU-GAME-025: sprites por estado (mordiscos).

### Consideraciones técnicas
- ConsumeSystem (acción `eat`), HoldSystem (comida a la mano), SurfaceSystem (`place` a los pies), instanciación para `replace`, CharacterSystem (pose y `yum`); condiciones `isPurchased` y `poseIsNot`.
- Hitbox del personaje: zonas `mouth` (prioridad) y `head` generadas por el motor; ancla `mouthAnchor[pose]` para la animación ([CHARACTER_SCHEMA §3](../../data/CHARACTER_SCHEMA.md)).
- Estado: [NEEDED NOW].

### Assets necesarios
- `obj_food_apple_red`, `obj_food_apple_red_bite1`, `obj_food_apple_red_bite2`, `obj_food_apple_core` (placeholder aceptable: sí).
- `obj_food_banana*`, `obj_food_sandwich*`, `obj_food_cake_slice*`, `obj_food_cookie` con sprites por mordisco (placeholder: sí).
- `sfx_eat_crunch`, `sfx_eat_soft` (placeholder: sí).
- `fx_crumbs_01`: efecto de migas (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `eat` con `validate`/`execute` y tests (mordisco, comida a la mano o a los pies, `replace`, `remove`, `returnTo`).
- [ ] Condición `poseIsNot` con tests; rechazo dormido y sin comprar.
- [ ] Test de escenario de la fila "personaje + comida" de INTERACTION_SYSTEM §4 (incluida la mano).
- [ ] Decisión de R9 (mordiscos seguidos) documentada en CHARACTER_SYSTEM.
- [ ] Persistencia probada (AC-PERSIST-01/02).

---

## HU-GAME-043 — Beber bebidas

> **Status:** Draft
> **Epic:** EPIC-012 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-012 — Food & Drinks

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **acercar un vaso de jugo o la leche a la boca de mi personaje para que beba**
para **cuidarlo como a un muñeco de verdad**.

### Contexto
Es la versión "sorbos" de HU-GAME-042: regla `drink_drink`, acción `drink`, componente `drinkable { sips, sipsLeft?, spriteBySipsLeft?, onFinish? }` ([ENTITY_SCHEMA §5.9](../../data/ENTITY_SCHEMA.md)). Reutiliza el ConsumeSystem y la pose temporal.

### Reglas de negocio
- R1: Regla `drink_drink`: trigger `drop`; source has `drinkable`; target has `character`, zona `mouth`/`head`; condiciones `isPurchased` y `poseIsNot [sleep]`; acción `drink`; prioridad 100.
- R2: `drink`: `sipsLeft` baja en 1 (si no estaba definido, vale `sips`); pose `drink` unos 900 ms con `returnTo`; expresión `yum` durante la pose; suena `sounds.drink`.
- R3: Al llegar a 0 se aplica `onFinish`: vaso de jugo → `replace` con `core:empty_glass` (vaso vacío, `misc`).
- R4: El sprite pasa a `drinkable.spriteBySipsLeft[sipsLeft]` si existe; si no, se mantiene el anterior.
- R5: Valor MVP `sips = 3` ([ENTITY_SCHEMA §5.9](../../data/ENTITY_SCHEMA.md)) para el vaso de jugo y el cartón de leche. `onFinish` de la leche: `replace` → `core:milk_carton_empty` (cartón vacío, ver [MVP_SCOPE](../../product/MVP_SCOPE.md#objetos)); del jugo: `replace` → `core:glass_empty`.
- R6: Tras un sorbo con `sipsLeft > 0`, la bebida pasa a la mano libre del bebedor o, si no tiene ninguna, a sus pies; lo mismo el resultado de `replace` (vaso vacío). No se bebe dormido ni sin comprar (igual que HU-GAME-042 R7b).
- R7: `sipsLeft` se persiste.

### Criterios de aceptación
```gherkin
Scenario: beber un sorbo
  Given un objeto con drinkable { sips: 3 } (vaso de jugo)
  When el jugador lo suelta sobre la zona "mouth" de un personaje
  Then se resuelve "core:drink_drink"
  And sipsLeft es 2 y el sprite es spriteBySipsLeft["2"]
  And el vaso queda en la mano libre del personaje
  And el personaje está en pose "drink" con expresión "yum" y vuelve a su pose tras unos 900 ms

Scenario: el vaso se vacía
  Given un vaso de jugo con sipsLeft 1 y onFinish { type: "replace", prefabId: "core:empty_glass" }
  When el jugador lo suelta sobre la zona "mouth" de un personaje
  Then el vaso de jugo ya no existe
  And existe un vaso vacío en la mano libre del personaje o, si no tiene ninguna, a sus pies

Scenario: no se bebe dormido
  Given un personaje en pose "sleep"
  When el jugador suelta un vaso de jugo sobre su zona "mouth"
  Then se emite interactionRejected, el personaje hace "shake" y el vaso se coloca con "place"
  And sipsLeft no cambia

Scenario: el vaso vacío no se bebe
  Given un vaso vacío sin drinkable
  When el jugador lo suelta sobre la zona "mouth" de un personaje
  Then no se resuelve "core:drink_drink"
  And (según la zona) se sostiene con "core:hold_item" o se coloca con "place"

@persistence
Scenario: los sorbos persisten
  Given un cartón de leche con sipsLeft 1 en la nevera
  When la app se cierra por completo y se vuelve a abrir
  Then el cartón sigue en la nevera con sipsLeft 1
```
Incluye: AC-REJECT-01, AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Dos sorbos seguidos antes de 900 ms: igual que HU-GAME-042 R9 (propuesta).
- Objeto con `edible` y `drinkable` a la vez (sopa): ambas reglas con prioridad 100; desempate por especificidad y luego por `id` alfabético (`drink_drink` < `eat_food`) ([INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md)).

### Dependencias
- HU-GAME-042: ConsumeSystem, pose temporal y `onFinish`.

### Consideraciones técnicas
- ConsumeSystem (acción `drink`); reutiliza todo lo de HU-GAME-042.
- Estado: [NEEDED NOW].

### Assets necesarios
- `obj_drink_juice_glass`, `obj_drink_milk_carton`, `obj_misc_empty_glass` (placeholder aceptable: sí).
- `sfx_drink_sip` (placeholder: sí).
- `chr_body_{child|adult}_drink_{capa}`: pose de beber (compartido con HU-GAME-014).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `drink` con tests (sorbo, `replace`, persistencia de `sipsLeft`).
- [ ] Tests de `spriteBySipsLeft` y del rechazo dormido.
- [ ] Persistencia probada (AC-PERSIST-01/02).

---

## HU-GAME-044 — Dispensadores de objetos

> **Status:** Draft
> **Epic:** EPIC-012 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-012 — Food & Drinks

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **tocar el frutero para que aparezca una manzana nueva**
para **poder seguir dando de comer a mis personajes sin quedarme sin comida**.

### Contexto
Un dispensador es cualquier entidad con `spawner { prefabId, maxAlive?, trigger?, spawnOffset? }` ([ENTITY_SCHEMA §5.13](../../data/ENTITY_SCHEMA.md)). La regla `tap_spawner` ejecuta la acción `spawn` del SpawnSystem si se cumple `belowMax` ([INTERACTION_SCHEMA §4, §7](../../data/INTERACTION_SCHEMA.md)). Sin código por dispensador: el frutero de la cocina es solo un prefab.

### Reglas de negocio
- R1: Regla `tap_spawner`: trigger `tap`; target has `spawner`; condición `belowMax`; acción `spawn`; prioridad 20.
- R2: `spawn` instancia `spawner.prefabId` **junto al spawner** en `transform + spawnOffset` (default **propuesta** `{ x: 0, y: 0 }` y después `place` en la superficie o el suelo), con id `rt_{ulid}` y location `scene`.
- R3: `maxAlive` por defecto **3**. `belowMax` pasa si las instancias vivas de ese spawner son menos que `maxAlive`.
- R4: `spawn` añade a la instancia el componente persistible `spawnedFrom { spawnerId }` ([ENTITY_SCHEMA §5.13b](../../data/ENTITY_SCHEMA.md)). "Instancia viva" = entidad con ese `spawnerId` cuya location no es `limbo`, esté donde esté (escena, contenedor, mano, mochila, otra escena).
- R5: Al llegar al máximo, el tap emite `interactionRejected`: el dispensador hace "shake" y suena `sfx_reject_soft`; no aparece nada ni hay texto. (AC-REJECT-01 adaptado a `tap`: no hay `place`.)
- R6: Sonido `sounds.spawn` y preset `animations.tap`/`bounce` en la instancia nueva.
- R7: Las instancias creadas son entidades runtime y se persisten como cualquier otra.
- R8: El `spawner.trigger` v1 solo admite `tap`; cooldowns por tiempo son [DESIGNED FOR LATER] (TimeSystem).
- R9: Contenido MVP: frutero (`spawner` de `core:apple_red`).

### Criterios de aceptación
```gherkin
Scenario: tocar el dispensador crea un objeto
  Given una entidad con spawner { prefabId: "core:apple_red" } y 0 instancias vivas (el frutero)
  When el jugador hace tap sobre el frutero
  Then se resuelve "core:tap_spawner"
  And existe una entidad nueva rt_… con prefabId "core:apple_red" junto al frutero
  And suena sounds.spawn

Scenario: límite de instancias vivas
  Given un frutero con maxAlive por defecto y 3 manzanas vivas creadas por él
  When el jugador hace tap sobre el frutero
  Then belowMax falla y se emite interactionRejected
  And el frutero hace "shake", suena el rechazo suave y no aparece ninguna manzana

Scenario: comer libera cupo
  Given un frutero con 3 manzanas vivas
  And una de ellas se come hasta que se reemplaza por "core:apple_core"
  When el jugador hace tap sobre el frutero
  Then aparece una manzana nueva

Scenario: la manzana creada es una manzana normal
  Given una manzana recién creada por el frutero
  When el jugador la suelta sobre la zona "mouth" de un personaje
  Then se resuelve "core:eat_food" y su bitesLeft es 2

@persistence
Scenario: lo creado persiste
  Given que el jugador creó 2 manzanas y dejó una en la nevera
  When la app se cierra por completo y se vuelve a abrir
  Then las 2 manzanas existen donde se dejaron
  And el frutero solo permite crear 1 más
```
Incluye: AC-REJECT-01 (adaptado a tap), AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Instancias llevadas a otra escena en la mochila o en la mano: cuentan como vivas (según R4).
- Taps rápidos seguidos: cada tap se evalúa con el estado actual; nunca más de `maxAlive`.
- Spawner que también es arrastrable (frutero movible): tap vs drag por umbral de 6 dp.
- `spawner.prefabId` inexistente: error del validador de contenido.

### Dependencias
- HU-GAME-032: interacciones por tap.
- HU-GAME-024: registro de prefabs para instanciar.

### Consideraciones técnicas
- SpawnSystem (acción `spawn`) y condición `belowMax`.
- `spawnedFrom` se persiste con la entidad; `belowMax` cuenta las entidades con ese `spawnerId` y location ≠ `limbo` ([INTERACTION_SCHEMA §4](../../data/INTERACTION_SCHEMA.md), [ECS §3](../../architecture/ECS.md)).
- Estado: [NEEDED NOW] (P1); cooldowns [DESIGNED FOR LATER].

### Assets necesarios
- `env_home_fruit_bowl`: frutero (placeholder aceptable: sí).
- `sfx_spawn_pop`: sonido de aparición (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Acción `spawn` y condición `belowMax` con tests (límite, cupo liberado, persistencia del recuento).
- [ ] Componente `spawnedFrom` con schema zod y test de persistencia.
- [ ] Persistencia probada (AC-PERSIST-01/02).
