# Interaction Schema

> **Status:** Accepted (v1, formatVersion 1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-004](../decisions/ADR-004-DATA-DRIVEN-CONTENT.md)
> **Related Epic:** EPIC-008 (y EPIC-009 a EPIC-014, EPIC-020, que la usan)
> **Related HU:** HU-GAME-031, HU-GAME-032, HU-GAME-033
> **Sistema:** [INTERACTION_SYSTEM](../architecture/INTERACTION_SYSTEM.md)

Las interacciones se declaran como **reglas de datos**.

- Una regla dice: *cuando ocurre este **trigger** entre un **source** con estas capacidades y un **target** con estas capacidades, y se cumplen estas **condiciones**, ejecuta estas **acciones***.
- Las **acciones** forman un conjunto cerrado implementado en el motor (`engine/actions/`).
- El contenido **combina** acciones, pero **no puede inventarlas**.

## 1. Ubicación

```
content/<pack>/interactions/*.rules.json     # arrays de InteractionRule
```

## 2. Formato

```ts
interface InteractionRule {
  id: string;                      // "eat_food" → core:eat_food
  trigger: 'drop' | 'tap' | 'longPress';   // v1. 'longPress' solo en MVP para quitar ropa. [DESIGNED FOR LATER]: 'combine'
  source?: Matcher;                // drop: la entidad arrastrada. tap: ausente
  target: TargetMatcher;           // drop: lo que hay bajo el dedo. tap: la entidad tocada
  conditions?: Condition[];        // AND lógico; conjunto cerrado (§4)
  actions: ActionSpec[];           // se ejecutan en orden, en una transacción (§6)
  priority?: number;               // default 0; mayor = gana (ver INTERACTION_SYSTEM §4)
  fallback?: 'place' | 'returnToOrigin';  // qué pasa con el source si la regla coincide pero se rechaza; default 'place'.
                                   // 'returnToOrigin' = vuelve a purchasable.origin (productos de tienda)
  feedback?: {
    highlight?: boolean;           // resaltar el target durante el arrastre (HU-GAME-033); default true
    rejectHint?: AssetKey;         // icono cuando la regla coincide pero falla una condición
  };
}

interface Matcher {
  has?: ComponentName[];           // todos presentes
  tags?: string[];                 // todos presentes
  anyTags?: string[];              // al menos uno
  notTags?: string[];              // ninguno
  state?: StateId;                 // states.current === state
  prefabId?: PrefabId;             // ⚠️ solo en reglas locales de un prefab (extraRules); prohibido en reglas globales
}

interface TargetMatcher extends Matcher {
  zone?: HitZoneId | HitZoneId[];  // el punto debe caer en esa zona del hitbox del target
  ui?: 'inventory' | 'trash';      // target de UI en lugar de entidad (§3)
}

interface ActionSpec {
  type: ActionType;                // ver §5
  [param: string]: unknown;        // parámetros propios de cada acción (validados por el schema de la acción)
}
```

## 3. Targets especiales

| Target | Cuándo | Ejemplo |
|---|---|---|
| Entidad | El punto cae sobre el hitbox de una entidad | Soltar comida sobre un personaje |
| `ui: "inventory"` | El punto cae sobre el botón de la mochila del HUD | Guardar en la mochila (HU-GAME-037) |
| Nada (suelo o superficie) | Ninguna regla coincide | **No es una regla.** Se aplica el fallback `place` del SurfaceSystem |

## 4. Condiciones (conjunto cerrado v1)

| Condición | Parámetros | Verdadera si… |
|---|---|---|
| `isOpen` | `of: "$target" \| "$source"` | la entidad **no** tiene `openable` (siempre abierta: cesta, alacena sin puertas) **o** está en `openState` |
| `containerHasSpace` | `of` | tiene un slot libre y acepta los tags del source |
| `seatFree` | `of` | nadie ocupa el `seat` o la `bed` |
| `handFree` | `of` (personaje) | al menos una mano libre |
| `canWear` | `item`, `character` | el slot existe y hay sprite para el cuerpo del personaje |
| `inventoryHasSpace` | — | la mochila tiene un slot libre |
| `canAfford` | `item` | el monedero tiene ≥ `purchasable.price` |
| `isPurchased` | `item`, `value: boolean`, `ifMissing?: boolean` | coincide con `purchasable.purchased`; si la entidad no tiene `purchasable`, devuelve `ifMissing` (default `true`) |
| `stateIs` | `of`, `state` | `states.current === state` |
| `belowMax` | `of` (spawner) | las instancias vivas con `spawnedFrom.spawnerId` = spawner (location ≠ `limbo`) son menos que `maxAlive` |
| `poseIsNot` | `of`, `poses: PoseId[]` | la pose actual del personaje no está en la lista (p. ej. no se come dormido) |
| `slotWorn` | `of` (personaje), por zona | hay una prenda vestida en el slot correspondiente a la zona tocada |

**Añadir una condición nueva** es un cambio en el motor. Requiere:
1. El handler en `engine/rules/conditions/`.
2. Una fila en esta tabla.
3. Tests.

**Prohibido:** condiciones genéricas tipo "expresión" o scripting.

## 5. Acciones (conjunto cerrado v1)

Los **roles** de cada acción se indican con `"$source"` y `"$target"`. Cada acción tiene roles por defecto, así que las reglas normalmente no necesitan declararlos.

| Acción | Roles (default) | Efecto | Sistema | Estado |
|---|---|---|---|---|
| `place` | `item=$source` | Coloca sobre una superficie o el suelo (fallback) | SurfaceSystem | NOW |
| `hold` | `item=$source`, `holder=$target` | Location → `held` (mano libre; `hand` según la zona) | HoldSystem | NOW |
| `release` | `item` | Suelta en la escena bajo el holder | HoldSystem | NOW |
| `eat` | `food=$source`, `eater=$target` | Pose `eat` + `bitesLeft--`. Si quedan mordiscos, la comida pasa a la **mano libre** del comensal (`held`; si no hay ninguna libre, `place` a sus pies). Cuando llega a 0, aplica `onFinish` (el resultado de `replace` también va a la mano o a los pies). | ConsumeSystem | NOW |
| `drink` | `drink=$source`, `drinker=$target` | Igual, con sorbos (`sipsLeft`) | ConsumeSystem | NOW |
| `sit` | `character=$source`, `seat=$target` | Ancla al asiento y pose `sit` | SeatSystem | NOW |
| `sleep` | `character=$source`, `bed=$target` | Ancla a la cama y pose `sleep` | SeatSystem | NOW |
| `standUp` | `character` | Libera el asiento (se llama implícitamente al arrastrar) | SeatSystem | NOW |
| `wear` | `item=$source`, `character=$target` | Location → `worn`; la prenda previa del slot cae a la escena | OutfitSystem | NOW |
| `unwear` | `character=$target`, `slot` (de la zona: `torso`→`top`, `legs`→`bottom`, `feet`→`shoes`) | La prenda de ese slot pasa a la escena en el punto del dedo y **el comando devuelve `startDrag: itemId`**: el Input adapter continúa el gesto como un drag de la prenda | OutfitSystem | NOW |
| `store` | `item=$source`, `container=$target` | Location → `container` (primer slot libre) | ContainerSystem | NOW |
| `takeOut` | `item` | Container → escena (lo dispara el drag desde el slot) | ContainerSystem | NOW |
| `open` / `close` / `toggleOpen` | `entity=$target` | Cambia de estado usando `openable` | ContainerSystem | NOW |
| `toggleSwitch` | `entity=$target` | Cambia de estado usando `switchable` | StateSystem | NOW |
| `setState` / `cycleState` | `entity`, `state?` | Cambia `states.current` | StateSystem | NOW |
| `spawn` | `spawner=$target` | Instancia `spawner.prefabId` junto al spawner | SpawnSystem | NOW |
| `teleport` | `traveler=$source`, `portal=$target` | Mueve al personaje (y lo que sostiene) a otra escena. `validate` rechaza con `notPurchased` si sostiene un producto sin comprar y con `notAccepted` si no cumple `portal.accepts`. El cambio de escena ocurre después de la interacción, con la transición de HU-GAME-050 | SceneService | NOW (Fase 2) |
| `addToInventory` | `item=$source` | Location → `inventory` | InventorySystem | NOW (P1) |
| `purchase` | `item=$source`, `register=$target` | Descuenta monedas y pone `purchased=true` | EconomySystem | NOW (Fase 2) |
| `collect` | `entity=$target` | Aplica `collectible.reward` y elimina la entidad (→ `limbo` + `entity_removed`) | EconomySystem | NOW (P2) |
| `setExpression` | `character`, `expression`, `durationMs?` | Cambia la expresión | CharacterSystem | NOW (P1) |
| `playSound` | `sound` | Reproduce un efecto (normalmente implícito vía `sounds`) | AudioService | NOW |
| `emit` | `event` | Evento de dominio libre (recuerdos, analytics) | EventBus | LATER |
| `combine` | `a`, `b`, `recipe` | Receta A+B→C | CraftSystem | LATER (EPIC-030) |

**Para añadir una acción:**
1. Handler en `engine/actions/<name>.ts` con `validate(ctx)` y `execute(ctx)`.
2. Schema zod de sus parámetros.
3. Fila en esta tabla.
4. Tests en el harness headless.

## 6. Transacciones

Las acciones de una regla se ejecutan dentro de `world.transaction()`:
1. Se ejecuta `validate` de **todas** las acciones.
2. Si alguna falla: **no se ejecuta ninguna**, se emite `interactionRejected { ruleId, reason }` y se aplica el fallback `place`.
3. Si todas pasan: se ejecutan en orden. Los eventos se emiten **al final**, en bloque, para que la UI haga un único render y el autosave marque los cambios una sola vez.

## 7. Reglas del pack core (MVP)

Archivo: `content/core/interactions/core.rules.json`.

| id | trigger | source | target | condiciones | acciones | prio |
|---|---|---|---|---|---|---|
| `eat_food` | drop | has `edible` | has `character`, zone `mouth`/`head` | `isPurchased`, `poseIsNot [sleep]` | `eat` | 100 |
| `drink_drink` | drop | has `drinkable` | has `character`, zone `mouth`/`head` | `isPurchased`, `poseIsNot [sleep]` | `drink` | 100 |
| `wear_clothes` | drop | has `wearable` | has `character`, zone `body`/`torso`/`legs`/`feet` | `canWear`, `isPurchased` | `wear` | 90 |
| `hold_item` | drop | has `draggable`, notTags `furniture`,`character` | has `holder`, zone `handL`/`handR`/`body` | `handFree` | `hold` | 50 |
| `sit_on_seat` | drop | has `character` | has `seat` | `seatFree` | `sit` | 80 |
| `sleep_on_bed` | drop | has `character` | has `bed` | `seatFree` | `sleep` | 85 |
| `store_in_container` | drop | has `draggable`, notTags `character`,`furniture` | has `container`, zone `inside` | `isOpen`, `containerHasSpace` | `store` | 70 |
| `travel_portal` | drop | has `character` | has `portal` | — | `teleport` | 95 |
| `buy_at_register` | drop | has `purchasable` | tags `checkout` | `isPurchased(false)`, `canAfford` | `purchase` (fallback `returnToOrigin`) | 95 |
| `store_in_backpack` | drop | has `draggable`, notTags `character`,`furniture` | ui `inventory` | `inventoryHasSpace`, `isPurchased≠false` | `addToInventory` | 100 |
| `unwear_clothes` | longPress | — | has `character`, zone `torso`/`legs`/`feet` | la zona tiene prenda | `unwear` | 50 |
| `tap_open` | tap | — | has `openable` | — | `toggleOpen` | 10 |
| `tap_switch` | tap | — | has `switchable` | — | `toggleSwitch` | 10 |
| `tap_spawner` | tap | — | has `spawner` | `belowMax` | `spawn` | 20 |
| `tap_character` | tap | — | has `character` | — | `setExpression(happy, 1500)` | 5 |
| `tap_collect` | tap | — | has `collectible` | — | `collect` | 30 |

> `hold_item` usa solo `handL`, `handR` y `body` (zona fuera de las bandas): si incluyera `torso`/`legs`/`feet`, una prenda rechazada por `wear_clothes` (sin comprar o sin sprite para el cuerpo) acabaría sostenida en vez de rechazada (HU-GAME-039). Para sostener algo se suelta en la mano.
>
> En esta tabla, `isPurchased` sin parámetros equivale a `{ value: true, ifMissing: true }`: los productos de la tienda sin comprar no se comen, no se beben ni se visten.
>
> `isPurchased≠false` significa: la condición pasa si el objeto no tiene `purchasable` o si ya está comprado. Se implementa como `isPurchased { value: true, ifMissing: true }`.

## 8. Ejemplo JSON

```json
[
  {
    "id": "eat_food",
    "trigger": "drop",
    "source": { "has": ["edible"] },
    "target": { "has": ["character"], "zone": ["mouth", "head"] },
    "actions": [{ "type": "eat" }],
    "priority": 100
  },
  {
    "id": "store_in_container",
    "trigger": "drop",
    "source": { "has": ["draggable"], "notTags": ["character", "furniture"] },
    "target": { "has": ["container"], "zone": "inside" },
    "conditions": [{ "type": "isOpen", "of": "$target" }, { "type": "containerHasSpace", "of": "$target" }],
    "actions": [{ "type": "store" }],
    "priority": 70,
    "feedback": { "rejectHint": "ui_hint_container_full" }
  }
]
```

## 9. Validación

Una regla es **inválida** si:
- `id` está duplicado dentro del pack.
- La acción o la condición son desconocidas, o tienen parámetros inválidos.
- `trigger: "tap"` tiene `source`.
- Hay `prefabId` en una regla global.
- `has` referencia componentes inexistentes.
- Los roles (`$source` / `$target`) no son compatibles con el trigger.
