# Scene Schema

> **Status:** Accepted (v1, formatVersion 1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-004](../decisions/ADR-004-DATA-DRIVEN-CONTENT.md), [ADR-007](../decisions/ADR-007-VIRTUAL-COORDINATES.md)
> **Related Epic:** EPIC-003, EPIC-014, EPIC-017, EPIC-018, EPIC-019
> **Related HU:** HU-GAME-010, HU-GAME-011, HU-GAME-012, HU-GAME-049
> **Sistema:** [SCENE_SYSTEM](../architecture/SCENE_SYSTEM.md)

Una escena es un espacio jugable **declarado íntegramente por datos**. El motor no conoce ninguna escena concreta.

## 1. Ubicación

```
content/<pack>/scenes/<sceneId>.json          # p. ej. content/core/scenes/home.json → core:home
```

## 2. Formato

```ts
interface SceneDefinition {
  id: string;                         // "home" → core:home
  name: I18nKey;                      // "scene.home.name"
  location: LocationGroupId;          // agrupación para el mapa: "home" | "street" | "store"
  size: { width: number; height: 1080 };   // world units; la altura es SIEMPRE 1080 (ADR-007)
  background: {
    layers: BackgroundLayer[];        // de atrás hacia adelante
  };
  floor: { y: number; x1?: number; x2?: number }[];   // segmentos de suelo (world units absolutos)
  bounds?: { minX: number; maxX: number };            // límites de la cámara; default 0..width
  zones?: Zone[];                     // habitaciones o áreas dentro de la escena (HU-GAME-012)
  spawnPoints: SpawnPoint[];          // al menos uno con id "default"
  entities: SceneEntity[];            // instancias de prefabs o entidades inline
  audio?: { music?: AudioKey; ambience?: AudioKey };  // default de la escena; las zonas pueden sobrescribir
  camera?: { startX?: number; startSpawnId?: string };
  metadata?: { author?: string; placeholder?: boolean };
}

interface BackgroundLayer {
  id: string;                         // "sky", "walls", "floor"
  chunks: { asset: AssetKey; x: number; width: number }[];  // tiras de ≤ 2048 px de ancho (ver RENDERING §8)
  parallax?: number;                  // 1 = se mueve con la cámara; <1 = más lejos. default 1
  y?: number;                         // default 0
}

interface Zone {
  id: string;                         // "kitchen"
  name: I18nKey;
  x1: number; x2: number;             // rango horizontal
  audio?: { music?: AudioKey; ambience?: AudioKey };
  snapCameraX?: number;               // x central de la zona para "saltar" desde el mapa
}

interface SpawnPoint {
  id: string;                         // "default", "front_door"
  x: number; y: number;
  facing?: 'left' | 'right';
}

type SceneEntity =
  | { localId: string; prefabId: PrefabId; transform: TransformData; overrides?: Partial<ComponentMap>; tags?: string[] }
  | { localId: string; inline: { components: ComponentMap; tags?: string[] }; transform: TransformData };  // decoración sin prefab
  // también: entidades dentro de un contenedor desde el inicio
  // { localId, prefabId, inContainer: { localId: string; slot: number } }
```

> **Mapa de ubicaciones:** lo alimentan `manifest.provides.locations` (ubicaciones) y `scene.zones` (botones de habitación). La escena **no** declara enlaces de navegación propios. Los portales son entidades.

## 3. Reglas

1. `size.height` **siempre** vale 1080. `size.width` es múltiplo recomendado de 1920/2 (960) para cuadrar con los chunks, pero no es obligatorio.
2. Cada `localId` es único dentro de la escena y **estable** para siempre. Es la clave del guardado.
3b. Los `tags` de una instancia de escena se **añaden** (unión) a los del prefab, no los reemplazan.
3. El `EntityId` final es `{packNs}:{sceneId}/{localId}` (p. ej. `core:home/fridge`).
4. Toda entidad con `sprite` debe tener un `transform`, salvo las que empiezan dentro de un contenedor.
5. Tiene que existir un spawn `default`.
5b. Los segmentos de `floor` tienen que **cubrir todo el ancho** `0..width` sin huecos (un segmento sin `x1`/`x2` cubre toda la escena). El validador lo comprueba.
6. Toda coordenada debe caer dentro de `0..width` × `0..1080`. El validador lo comprueba.
7. **Coordenadas en un solo lugar:** las posiciones viven en el JSON de la escena y **nunca** en componentes React ni en el código.

## 4. Ejemplo (fragmento de `core:home`)

```json
{
  "id": "home",
  "name": "scene.home.name",
  "location": "home",
  "size": { "width": 7680, "height": 1080 },
  "background": {
    "layers": [
      { "id": "walls", "chunks": [
        { "asset": "env_home_bg_living_01", "x": 0, "width": 1920 },
        { "asset": "env_home_bg_kitchen_01", "x": 1920, "width": 1920 },
        { "asset": "env_home_bg_bedroom_01", "x": 3840, "width": 1920 },
        { "asset": "env_home_bg_bathroom_01", "x": 5760, "width": 1920 }
      ] }
    ]
  },
  "floor": [{ "y": 960 }],
  "zones": [
    { "id": "living", "name": "zone.living.name", "x1": 0, "x2": 1920, "snapCameraX": 720 },
    { "id": "kitchen", "name": "zone.kitchen.name", "x1": 1920, "x2": 3840, "snapCameraX": 2880, "audio": { "ambience": "amb_kitchen_fridge_hum" } },
    { "id": "bedroom", "name": "zone.bedroom.name", "x1": 3840, "x2": 5760, "snapCameraX": 4800 },
    { "id": "bathroom", "name": "zone.bathroom.name", "x1": 5760, "x2": 7680, "snapCameraX": 6720 }
  ],
  "spawnPoints": [
    { "id": "default", "x": 700, "y": 960 },
    { "id": "front_door", "x": 150, "y": 960, "facing": "right" }
  ],
  "entities": [
    { "localId": "sofa", "prefabId": "core:sofa_blue", "transform": { "x": 900, "y": 960 } },
    { "localId": "fridge", "prefabId": "core:fridge_white", "transform": { "x": 3420, "y": 960 } },
    { "localId": "fridge_milk", "prefabId": "core:milk_carton", "inContainer": { "localId": "fridge", "slot": 0 } },
    { "localId": "table", "prefabId": "core:table_round", "transform": { "x": 2600, "y": 960 } },
    { "localId": "apple_1", "prefabId": "core:apple_red", "transform": { "x": 2580, "y": 780 } },
    { "localId": "front_door", "prefabId": "core:door_front", "transform": { "x": 120, "y": 960 },
      "overrides": { "portal": { "targetSceneId": "core:street", "targetSpawnId": "home_door" } } }
  ],
  "audio": { "music": "mus_home_calm_01" }
}
```

## 5. Decisión de granularidad: una escena por ubicación, habitaciones como zonas

- **Home** = **una sola escena ancha** (4 habitaciones × 1920 = 7680 world units). Salón, cocina, dormitorio y baño son **zonas**.
- **Street** = una escena (unas 5760 unidades).
- **Store** = una escena (unas 3840 unidades).

**Por qué:**
- La fantasía de "casa de muñecas" pide ver las habitaciones como un espacio continuo, sin pantallas de carga entre ellas.
- Así las zonas pueden tener su propia música.
- El schema **no obliga** a esto. Si en el futuro una casa crece, las habitaciones pueden pasar a ser escenas separadas conectadas por portales, sin tocar el motor.

**Coste:** exige culling y fondos por chunks (HU-GAME-008). Ver [RENDERING](../architecture/RENDERING.md) y [PERFORMANCE](../architecture/PERFORMANCE.md).

## 6. Validación

Además de las reglas del §3, el validador ([HU-GAME-069](../stories/mvp/EPIC-024-testing.md)) comprueba:
- Que todos los `prefabId` existan.
- Que todas las claves de asset y audio existan.
- Que los `inContainer` apunten a un `localId` con componente `container` y a un `slot` menor que `capacity`.
- Que los `portal.targetSceneId` y `targetSpawnId` existan.
- Que ningún chunk de fondo mida más de 2048 px de ancho.
