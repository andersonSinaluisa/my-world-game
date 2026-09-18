# Entity Schema

> **Status:** Accepted (v1, formatVersion 1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-003](../decisions/ADR-003-ECS.md), [ADR-004](../decisions/ADR-004-DATA-DRIVEN-CONTENT.md), [ADR-007](../decisions/ADR-007-VIRTUAL-COORDINATES.md)
> **Related Epic:** EPIC-001, EPIC-006
> **Conceptos:** [../architecture/ECS.md](../architecture/ECS.md)

Aquí se define el **formato de datos** de una entidad y de cada componente.

- Los tipos se escriben en pseudo-TypeScript.
- La implementación real debe usar **schemas zod** en `MyWorld/src/engine/components/`, e inferir de ellos los tipos TS (`z.infer`).
- Si este documento y el código no coinciden, **el documento manda** hasta que se actualice con un cambio aprobado.

## 1. Convenciones globales

| Tema | Regla |
|---|---|
| Unidades | **World units**: la escena mide 1080 de alto. `x` crece hacia la derecha e `y` hacia abajo. Origen arriba a la izquierda de la escena. |
| Ángulos | Grados. Rotación en sentido horario. Poco usada. |
| IDs de contenido | `namespace:snake_case` → `core:apple_red`. Regex: `^[a-z0-9_]+:[a-z0-9_]+$` |
| IDs de instancia | Ver §2 |
| Claves de asset | `asset key` lógica (`obj_food_apple_red`), **nunca rutas**. La resolución a archivo la hace el manifest de assets. |
| Claves de texto | `i18n key` (`object.apple_red.name`), nunca texto literal en el contenido |
| Opcionalidad | Todo campo opcional tiene un default documentado |
| Extensión | Campos desconocidos → **error de validación** (`strict`). Esto evita typos silenciosos. |

## 2. Identificadores de instancia (`EntityId`)

| Origen | Formato | Ejemplo | Estable entre versiones |
|---|---|---|---|
| Entidad declarada en una escena | `{sceneId}/{localId}` | `core:home/fridge` | ✅ Sí. Es la clave del diff de guardado. |
| Entidad creada en runtime (spawn, compra, personaje) | `rt_{ulid}` | `rt_01J8Z7…` | ✅ Sí, una vez creada se guarda con ese ID |

- **Nunca** hay que cambiar el `localId` de una entidad declarada en una escena publicada. Si hace falta, se usa `idAliases` en el manifest del pack (ver [CONTENT_PACK_SCHEMA](CONTENT_PACK_SCHEMA.md)).
- ULID se genera en JS puro (implementación propia de unas 20 líneas o una librería mínima; ver [DEVELOPMENT_RULES](../ai/DEVELOPMENT_RULES.md) sobre dependencias).

## 3. Entidad

```ts
interface Entity {
  id: EntityId;
  prefabId?: PrefabId;          // si existe, los componentes se resuelven como prefab ⊕ overrides
  tags: string[];               // default: tags del prefab
  location: Location;           // ver ECS.md §4
  components: ComponentMap;     // componentes efectivos (ya fusionados)
}
```

**Resolución de componentes:**

```
efectivo = deepMerge(prefab.components, sceneEntity.overrides, savedState.components)
```

- La fusión es **por componente y por campo**.
- Los arrays de componentes **se reemplazan**, no se concatenan. **Excepción:** `tags` de la instancia de escena se **unen** con los del prefab.
- Para eliminar un componente del prefab en una instancia se escribe `"componentName": null` en los overrides.

## 4. Location

```ts
type Location =
  | { kind: 'scene'; sceneId: SceneId }
  | { kind: 'container'; containerId: EntityId; slot: number }
  | { kind: 'inventory'; slot: number }
  | { kind: 'held'; holderId: EntityId; hand: 'left' | 'right' }
  | { kind: 'worn'; characterId: EntityId; slot: WearSlot }
  | { kind: 'limbo' };
```

`WearSlot` (v1): `'top' | 'bottom' | 'shoes'`.
[DESIGNED FOR LATER]: `'head' | 'face' | 'outer' | 'full'`. `full` es para vestidos: ocupa `top` y `bottom`.

## <a id="componentes"></a>5. Componentes

### 5.1 `transform` [NEEDED NOW]
```ts
{
  x: number;              // world units, posición del pivot
  y: number;
  flipX?: boolean;        // default false
  scale?: number;         // default 1; rango permitido 0.25..4
  rotation?: number;      // default 0
  parentId?: EntityId;    // [DESIGNED FOR LATER] HU-GAME-030: x,y pasan a ser relativos al padre
}
```
Solo es significativo cuando `location.kind === 'scene'`. En otros casos se conserva, pero no se renderiza.

### 5.2 `sprite` [NEEDED NOW]
```ts
{
  asset: AssetKey;                         // sprite por defecto
  layer: RenderLayer;                      // ver RENDERING.md §4
  z?: number;                              // orden dentro de la capa; default 0
  pivot?: { x: number; y: number };        // normalizado 0..1 respecto al sprite; default { x: 0.5, y: 1 } (centro inferior)
  size?: { w: number; h: number };         // world units; default: tamaño nativo del asset a escala 1x
  byState?: Record<StateId, AssetKey>;     // sprite según states.current
  tint?: string;                           // #RRGGBB, opcional (p. ej. ropa recoloreada)
}
```
`RenderLayer` = `'background' | 'wallDecor' | 'furnitureBack' | 'furniture' | 'props' | 'characters' | 'foreground'`

### 5.3 `hitbox` [NEEDED NOW]
```ts
{
  shape: { type: 'rect'; x: number; y: number; w: number; h: number }  // relativo al pivot, world units
       | { type: 'circle'; x: number; y: number; r: number }
       | { type: 'polygon'; points: [number, number][] };               // [DESIGNED FOR LATER]
  padding?: number;                         // world units extra para dedos pequeños; default 12
  zones?: Record<HitZoneId, Shape>;         // zonas nombradas: 'mouth', 'handL', 'handR', 'head', 'body', 'seat', 'inside'...
}
```
El hit testing usa la forma **más** el `padding` (y el mínimo `minHitDp`). Si varias zonas contienen el punto, gana la de **menor área** ([INTERACTION_SYSTEM §3](../architecture/INTERACTION_SYSTEM.md)). Ver [INPUT_SYSTEM](../architecture/INPUT_SYSTEM.md#hit-testing).

### 5.4 `draggable` [NEEDED NOW]
```ts
{
  mode?: 'free' | 'floorOnly';   // default 'free'. floorOnly = solo se apoya en el suelo (muebles)
  liftOffset?: number;           // cuánto "sube" visualmente al levantarlo; default 16
  enabled?: boolean;             // default true (p. ej. false cuando está fijo en tienda sin comprar)
}
```

### 5.5 `surface` [NEEDED NOW]
```ts
{
  segments: { x1: number; x2: number; y: number }[];  // relativos al pivot; líneas horizontales de apoyo
  carriesItems?: boolean;   // [DESIGNED FOR LATER] HU-GAME-030: los objetos apoyados se vuelven hijos
}
```
El suelo de la escena se declara en la escena (`floor`), no como entidad. Ver [SCENE_SCHEMA](SCENE_SCHEMA.md).

### 5.6 `states` [NEEDED NOW]
```ts
{
  current: StateId;
  values: StateId[];           // p. ej. ["closed","open"], ["off","on"]
}
```
Máquina de estados **sin transiciones condicionales**. Las transiciones las hacen las acciones `setState` y `cycleState`.

### 5.7 `openable` [NEEDED NOW]
```ts
{ openState: StateId; closedState: StateId; }   // requiere `states`
```

### 5.7b `switchable` [NEEDED NOW]
```ts
{ onState: StateId; offState: StateId; }        // requiere `states`
```

### 5.7c `animations` [NEEDED NOW · P1]
```ts
Partial<Record<'idle' | 'tap' | 'pickup' | 'drop' | 'use' | 'open' | 'close', TweenPresetId>>
// TweenPresetId (v1): 'bounce' | 'wiggle' | 'squash' | 'pulse' | 'shake' | 'spin'
```
Es solo presentación: el motor emite el evento y el render aplica el preset (ver [ANIMATION_GUIDELINES](../design/ANIMATION_GUIDELINES.md)). No afecta a la lógica ni se guarda.

### 5.8 `container` [NEEDED NOW]
```ts
{
  capacity: number;                               // 1..64
  accepts?: string[];                             // tags aceptados; default: cualquiera
  rejects?: string[];                             // tags rechazados; default: ['character', 'furniture']
                                                  // + regla fija del motor: NUNCA acepta entidades con componente `container` (sin anidamiento)
  requiresOpen?: boolean;                         // default true si existe openable
  slots?: { x: number; y: number }[];             // posiciones visibles al abrir (relativas al pivot); length = capacity
  showContentsWhenOpen?: boolean;                 // default true
}
```

### 5.9 `edible` / `drinkable` [NEEDED NOW]
```ts
edible:    { bites: number; bitesLeft?: number; spriteByBitesLeft?: Record<number, AssetKey>; onFinish?: FinishBehavior }
drinkable: { sips: number;  sipsLeft?: number;  spriteBySipsLeft?: Record<number, AssetKey>; onFinish?: FinishBehavior }   // propuesta MVP: sips = 3
type FinishBehavior = { type: 'remove' } | { type: 'replace'; prefabId: PrefabId };   // p. ej. vaso vacío
```
Si `bitesLeft` no está definido, vale `bites` (y lo mismo con `sipsLeft` y `sips`).

### 5.10 `wearable` [NEEDED NOW]
```ts
{
  slot: WearSlot;
  layers: Partial<Record<CharacterLayer, AssetKey>>;  // cómo se dibuja puesta, por capa del personaje
  bodyVariants?: Record<BodyTypeId, Partial<Record<CharacterLayer, AssetKey>>>; // si cambia según el cuerpo
}
```
Cuando no está vestida, la prenda se dibuja con su `sprite` normal (versión "suelta").

### 5.11 `seat` / `bed` [NEEDED NOW]
```ts
seat: { anchor: { x: number; y: number }; pose?: 'sit'; capacity?: number; facing?: 'left' | 'right' | 'front' }
bed:  { anchor: { x: number; y: number }; pose?: 'sleep'; capacity?: number; coverAsset?: AssetKey /* manta dibujada delante del personaje dormido */ }
```
- `capacity` vale 1 por defecto. Un sofá puede tener varios anchors [DESIGNED FOR LATER]: `anchors[]`.
- El **ocupante no se guarda aquí**: se deriva de `pose.seatId` de los personajes (ver ECS.md §4).

### 5.12 `portal` [NEEDED NOW · Fase 2]
```ts
{ targetSceneId: SceneId; targetSpawnId: string; accepts?: string[] /* default ['character'] */ }
```

### 5.13 `spawner` [NEEDED NOW]
```ts
{ prefabId: PrefabId; maxAlive?: number /* default 3 */; trigger?: 'tap' /* v1 */; spawnOffset?: { x: number; y: number } }
```

### 5.13b `spawnedFrom` [NEEDED NOW]
```ts
{ spawnerId: EntityId }
```
Lo añade la acción `spawn`. Se persiste con la entidad para que `belowMax` siga contando bien tras recargar. Si el objeto se consume (`limbo`), deja de contar.

### 5.14 `purchasable` [NEEDED NOW · Fase 2]
```ts
{
  price: number;
  purchased?: boolean;              // default false
  restock?: boolean;                // default true: al comprarse, se crea una copia sin comprar en `origin`
  origin?: { x: number; y: number } | { containerId: EntityId; slot: number };  // lugar de exposición; default = transform inicial o slot inicial (inContainer) de la escena
}
```
- Mientras `purchased === false`, la entidad no puede salir de la escena de la tienda (rechazo en portal o mochila) y, si se suelta fuera de un estante, **vuelve a `origin`** al salir de la tienda o al recargar la escena.
- Al comprarse (acción `purchase`), la entidad pasa a pertenecer al jugador. Si `restock`, se crea en `origin` una copia nueva sin comprar (`rt_` id). Así el stock es infinito y sencillo en el MVP.

### 5.15 `collectible` [NEEDED NOW · P2]
```ts
{ reward: { coins?: number; prefabId?: PrefabId } }
```
Al recogerse (acción `collect`), la entidad pasa a `limbo` y se registra en `entity_removed`: desaparece para siempre de esa partida. No hace falta un flag `collected`.
```ts
```

### 5.16 `sounds` [NEEDED NOW]
```ts
Partial<Record<'pickup' | 'drop' | 'use' | 'open' | 'close' | 'eat' | 'drink' | 'toggle' | 'spawn', AudioKey>>
```

### 5.17 Componentes de personaje
Están definidos en [CHARACTER_SCHEMA](CHARACTER_SCHEMA.md): `character`, `appearance`, `outfit`, `holder`, `pose` y `expression`.

## 6. Ejemplo completo de una entidad en runtime

```json
{
  "id": "core:home/fridge",
  "prefabId": "core:fridge_white",
  "tags": ["furniture", "appliance", "kitchen"],
  "location": { "kind": "scene", "sceneId": "core:home" },
  "components": {
    "transform": { "x": 3420, "y": 960 },
    "sprite": { "asset": "env_home_fridge_white", "layer": "furniture", "byState": { "open": "env_home_fridge_white_open" } },
    "hitbox": { "shape": { "type": "rect", "x": -110, "y": -420, "w": 220, "h": 420 }, "zones": { "inside": { "type": "rect", "x": -90, "y": -380, "w": 180, "h": 340 } } },
    "states": { "current": "closed", "values": ["closed", "open"] },
    "openable": { "openState": "open", "closedState": "closed" },
    "container": { "capacity": 6, "accepts": ["food", "drink"], "slots": [{ "x": -50, "y": -330 }, { "x": 50, "y": -330 }, { "x": -50, "y": -230 }, { "x": 50, "y": -230 }, { "x": -50, "y": -130 }, { "x": 50, "y": -130 }] },
    "sounds": { "open": "sfx_fridge_open", "close": "sfx_fridge_close" }
  }
}
```

## 7. Cambios en este schema

- Añadir un campo opcional con default es un cambio **compatible**: solo se documenta.
- Renombrar o eliminar un campo, o cambiar su semántica, es un cambio **incompatible**. Exige:
  1. Incrementar el `formatVersion` del contenido y/o el `saveVersion`.
  2. Escribir la migración correspondiente (ver [SAVE_SCHEMA](SAVE_SCHEMA.md#migraciones)).
  3. Actualizar este documento y el ADR si corresponde.
