# Object Schema (Prefabs)

> **Status:** Accepted (v1, formatVersion 1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-004](../decisions/ADR-004-DATA-DRIVEN-CONTENT.md)
> **Related Epic:** EPIC-006, EPIC-021
> **Related HU:** HU-GAME-024, HU-GAME-025, HU-GAME-026, HU-GAME-069
> **Base:** [ENTITY_SCHEMA](ENTITY_SCHEMA.md)

Un **prefab** es la plantilla de un objeto interactivo. Cada escena **instancia** los prefabs; los personajes, la tienda y los dispensadores los **spawnean**.

- Un prefab no tiene posición.
- La posición pertenece a la instancia (ver [SCENE_SCHEMA](SCENE_SCHEMA.md)).

## 1. Ubicación de los archivos

```
content/<pack>/prefabs/<category>/<name>.json      # un prefab por archivo
```

Ejemplo: `content/core/prefabs/food/apple_red.json` define `core:apple_red`. El namespace se toma del pack y el `id` del archivo debe coincidir con el nombre del archivo.

## 2. Formato

```ts
interface PrefabDefinition {
  id: string;                     // "apple_red" (sin namespace; el pack lo añade) — obligatorio
  category: PrefabCategory;       // obligatorio; ver §3. Informativo, NO define comportamiento
  tags?: string[];                // usados por reglas, contenedores y filtros; default []
  components: ComponentMap;       // obligatorio; ver ENTITY_SCHEMA §5
  interactions?: {
    disabledRules?: RuleId[];     // desactiva reglas globales para este prefab
    extraRules?: InteractionRule[]; // reglas locales; `source` o `target` implícitos = este prefab (ver INTERACTION_SCHEMA §5)
  };
  metadata: {
    name: I18nKey;                // "object.apple_red.name" — obligatorio (accesibilidad, tienda, debug)
    description?: I18nKey;
    price?: number;               // precio sugerido para la tienda; la instancia puede sobreescribir
    rarity?: 'common' | 'rare';   // [DESIGNED FOR LATER]
    author?: string;              // artista o fuente
    placeholder?: boolean;        // true = arte provisional (Kenney, Glitch…); prohibido en release
    license?: string;             // "CC0", "commissioned", … (ver ASSET_GUIDELINES)
  };
}
```

## 3. Categorías (`category`)

`food` · `drink` · `clothing` · `furniture` · `appliance` · `toy` · `decor` · `tool` · `plant` · `container` · `door` · `misc`

**`category` sirve solo para organizar** (editor, tienda, filtros de mochila). **Nunca** se usa en reglas de comportamiento. Para eso están los **componentes** y los **tags**.

> ⚠️ **Tipo frente a capacidades.** La propuesta inicial tenía un campo `"type": "food"`. Se sustituye por `category` (organización) + componentes (capacidades) para que un objeto pueda tener varias capacidades a la vez. Ejemplo: un melón que es `edible` y también `container` de semillas.

## 4. Mapa de campos pedidos → dónde viven

| Campo solicitado | Dónde vive | Notas |
|---|---|---|
| ID | `id` + namespace del pack | `core:apple_red` |
| type | `category` + `tags` | Ver la nota del §3 |
| sprite | `components.sprite` | Claves de asset, no rutas |
| position | **Instancia de escena** (`transform`) | El prefab no tiene posición |
| zIndex | `components.sprite.layer` + `sprite.z` | Capas semánticas y z dentro de la capa |
| hitbox | `components.hitbox` | Incluye `zones` y `padding` |
| interactions | Derivadas de componentes + `interactions.disabledRules/extraRules` | Ver [INTERACTION_SYSTEM](../architecture/INTERACTION_SYSTEM.md) |
| states | `components.states` (+ `openable`/`switchable`) | Sprites por estado en `sprite.byState` |
| animations | `components.animations` | Presets visuales |
| sounds | `components.sounds` | Claves de audio |
| metadata | `metadata` | Nombre i18n, precio, autor, placeholder, licencia |

## 5. Ejemplos

### Comida
```json
{
  "id": "apple_red",
  "category": "food",
  "tags": ["food", "fruit"],
  "components": {
    "sprite": { "asset": "obj_food_apple_red", "layer": "props" },
    "hitbox": { "shape": { "type": "circle", "x": 0, "y": -40, "r": 40 } },
    "draggable": {},
    "edible": {
      "bites": 3,
      "spriteByBitesLeft": { "2": "obj_food_apple_red_bite1", "1": "obj_food_apple_red_bite2" },
      "onFinish": { "type": "replace", "prefabId": "core:apple_core" }
    },
    "sounds": { "pickup": "sfx_pickup_soft", "drop": "sfx_drop_soft", "eat": "sfx_eat_crunch" },
    "animations": { "drop": "squash" }
  },
  "metadata": { "name": "object.apple_red.name", "price": 2, "license": "commissioned" }
}
```

### Silla
```json
{
  "id": "chair_wood",
  "category": "furniture",
  "tags": ["furniture"],
  "components": {
    "sprite": { "asset": "env_home_chair_wood_01", "layer": "furniture" },
    "hitbox": { "shape": { "type": "rect", "x": -60, "y": -220, "w": 120, "h": 220 } },
    "draggable": { "mode": "floorOnly" },
    "seat": { "anchor": { "x": 0, "y": -95 }, "facing": "front" },
    "sounds": { "drop": "sfx_drop_wood" }
  },
  "metadata": { "name": "object.chair_wood.name", "price": 15 }
}
```

### Lámpara (encendible)
```json
{
  "id": "lamp_floor",
  "category": "decor",
  "tags": ["furniture", "light"],
  "components": {
    "sprite": { "asset": "env_home_lamp_floor_off", "layer": "furniture", "byState": { "on": "env_home_lamp_floor_on" } },
    "hitbox": { "shape": { "type": "rect", "x": -40, "y": -300, "w": 80, "h": 300 } },
    "draggable": { "mode": "floorOnly" },
    "states": { "current": "off", "values": ["off", "on"] },
    "switchable": { "onState": "on", "offState": "off" },
    "sounds": { "toggle": "sfx_switch_click" }
  },
  "metadata": { "name": "object.lamp_floor.name" }
}
```

### Camiseta
```json
{
  "id": "shirt_star_yellow",
  "category": "clothing",
  "tags": ["clothing", "top"],
  "components": {
    "sprite": { "asset": "obj_clothing_shirt_star_yellow", "layer": "props" },
    "hitbox": { "shape": { "type": "rect", "x": -50, "y": -80, "w": 100, "h": 80 } },
    "draggable": {},
    "wearable": { "slot": "top", "layers": { "torsoClothes": "chr_top_star_yellow", "armClothesL": "chr_top_star_yellow_arm_l", "armClothesR": "chr_top_star_yellow_arm_r" } }
  },
  "metadata": { "name": "object.shirt_star_yellow.name", "price": 10 }
}
```

## 6. Validación (HU-GAME-024, HU-GAME-069)

**Un prefab es inválido si:**
- `id` no cumple `^[a-z0-9_]+$` o no coincide con el nombre del archivo.
- Tiene componentes desconocidos o campos desconocidos (modo `strict`).
- Tiene dependencias entre componentes rotas:
  - `openable` o `switchable` sin `states`;
  - `openState` u `offState` que no están en `states.values`;
  - `container.slots.length !== capacity`.
- Tiene `sprite.byState` con estados inexistentes.
- Referencia una clave de asset o audio que no está en el manifest del pack o de sus dependencias.
- Referencia un `prefabId` (en `onFinish`, `spawner`) que no existe.
- Le falta `metadata.name`, o su clave i18n no existe en `locales/es.json` y `locales/en.json`.

**Advertencia, no error:** `metadata.placeholder === true`. Pasa a ser **error** en builds de release.

## 7. Presupuesto de contenido del MVP

Objetivo: **entre 30 y 50 prefabs interactivos** (ver [MVP_SCOPE](../product/MVP_SCOPE.md#objetos)). Los sprites de estado (mordiscos, abierto/cerrado) no cuentan como prefabs adicionales.
