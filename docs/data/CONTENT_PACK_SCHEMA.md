# Content Pack Schema

> **Status:** Accepted (v1, formatVersion 1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-004](../decisions/ADR-004-DATA-DRIVEN-CONTENT.md), [ADR-008](../decisions/ADR-008-CONTENT-PACKS.md)
> **Related Epic:** EPIC-021
> **Related HU:** HU-GAME-068, HU-GAME-069 · POST-MVP: HU-GAME-114
> **Sistema:** [CONTENT_SYSTEM](../architecture/CONTENT_SYSTEM.md)

## 1. Estructura de un pack

```
content/<packId>/
  manifest.json                 # obligatorio
  assets.json                   # manifest de assets: clave → archivo + metadatos
  prefabs/<category>/*.json     # PrefabDefinition (OBJECT_SCHEMA)
  scenes/*.json                 # SceneDefinition (SCENE_SCHEMA)
  interactions/*.rules.json     # InteractionRule[] (INTERACTION_SCHEMA)
  characters/parts.json         # solo si aporta partes de personaje (CHARACTER_SCHEMA)
  locales/es.json, en.json      # textos (claves i18n → texto)
  assets/                       # imágenes (webp) y audio (m4a) referenciados por assets.json
    images/...
    audio/...
```

## 2. `manifest.json`

```ts
interface PackManifest {
  id: string;                         // "core", "school", "beach" — ^[a-z0-9_]+$ ; es el namespace
  name: I18nKey;
  version: string;                    // semver del CONTENIDO: "1.2.0"
  formatVersion: 1;                   // versión de los SCHEMAS que usa el pack; el motor declara cuáles soporta
  minEngineVersion?: string;          // semver de la app mínima (p. ej. si usa una acción nueva)
  dependencies?: Record<PackId, string>;   // { "core": "^1.0.0" }: rangos semver
  provides: {
    scenes?: string[];                // ids sin namespace; debe coincidir con los archivos
    locations?: { id: string; name: I18nKey; icon: AssetKey; entrySceneId: SceneId; entrySpawnId: string }[];  // para el mapa
    characterParts?: boolean;
  };
  idAliases?: Record<string, string>; // renombres: "core:apple" → "core:apple_red" (prefabs o EntityIds de escena)
  removedIds?: string[];              // ids retirados: las entidades guardadas se descartan limpiamente
  entitlement?: { type: 'free' } | { type: 'iap'; productId: string };   // [DESIGNED FOR LATER]
  newGame?: {                         // SOLO en el pack core: estado inicial de una partida nueva
    sceneId: SceneId; spawnId: string;   // p. ej. core:home / default
    coins: number;                       // propuesta MVP: 50
    dailyGiftCoins: number;              // propuesta MVP: 10
    unlocks: string[];                   // MVP: todas las ubicaciones
    inventoryCapacity: number;           // MVP: 12
  };
  distribution: 'bundled' | 'downloadable';   // MVP: solo 'bundled'
  checksum?: string;                  // [DESIGNED FOR LATER] sha256 del paquete descargado
}
```

## 3. `assets.json`

```ts
interface AssetManifest {
  images: Record<AssetKey, {
    file: string;              // ruta relativa al pack: "assets/images/obj_food_apple_red.webp"
    w: number; h: number;      // px del archivo (1x = world units)
    placeholder?: boolean;
    license?: string;          // "commissioned" | "CC0" | ...
    source?: string;           // autor o URL (trazabilidad de licencias)
  }>;
  audio: Record<AudioKey, { file: string; kind: 'sfx' | 'music' | 'ambience'; loop?: boolean; volume?: number; license?: string; source?: string }>;
}
```

- Las claves de asset son **globales** (se resuelven en el pack y en sus dependencias).
- **Convención:** los assets de un pack no-core llevan el prefijo del pack. Ejemplo: `school_obj_book_red`. Así se evitan colisiones. El validador comprueba la unicidad global.

## 4. Resolución de IDs y namespaces

| Referencia en el JSON | Se resuelve como |
|---|---|
| `"prefabId": "apple_red"` (sin namespace) | `{packActual}:apple_red` |
| `"prefabId": "core:apple_red"` | tal cual. `core` debe ser el propio pack o estar en `dependencies` |
| `"targetSceneId": "core:street"` | tal cual. Mismas reglas de dependencia |

**Un pack NO puede referenciar a otro que no esté en sus `dependencies`.** Esto garantiza que se puede validar de forma aislada.

## 5. Versionado

| Cambio en el pack | Versión semver |
|---|---|
| Añadir prefabs, escenas o reglas | minor |
| Cambiar arte, hitbox, precios o posiciones iniciales | patch |
| Renombrar o eliminar IDs (con `idAliases`/`removedIds`), cambiar la semántica de una regla o subir `formatVersion` | **major** |

- El motor declara `supportedFormatVersions: [1]`. Un pack con un `formatVersion` no soportado **no se carga**: se registra el error y el pack queda deshabilitado, pero el resto sigue funcionando.
- **El pack `core` no se puede deshabilitar.** Si falla su validación en runtime, es un bug de build y lo detecta la CI (HU-GAME-069).

## 6. Validación

La hace `scripts/validate-content.ts` en la CI y `ContentRegistry` en dev (HU-GAME-069). Se valida en este orden:

1. Schema del `manifest.json`.
2. Dependencias: existen, el rango semver se satisface y **no hay ciclos**.
3. Schema de cada archivo (prefabs, escenas, reglas, partes, locales).
4. Referencias cruzadas: prefabs, escenas, spawns, assets, audio, claves i18n (en `es` y `en`), componentes y acciones.
5. Unicidad global de IDs y de claves de asset.
6. Archivos: cada `file` existe y sus dimensiones coinciden con `w`/`h`. Los chunks de fondo miden ≤ 2048 px y las texturas ≤ 2048×2048.
7. Política de release: `placeholder: true` → error cuando `--release`.

**Salida del validador:** una lista de errores con la forma `{ pack, file, path (JSON pointer), code, message }`. Si hay algún error, el código de salida es distinto de 0.

## 7. Ejemplo: manifest de un pack futuro

```json
{
  "id": "school",
  "name": "pack.school.name",
  "version": "1.0.0",
  "formatVersion": 1,
  "minEngineVersion": "1.3.0",
  "dependencies": { "core": "^1.2.0" },
  "provides": {
    "scenes": ["school_classroom", "school_yard"],
    "locations": [{ "id": "school", "name": "location.school.name", "icon": "school_ui_map_school", "entrySceneId": "school:school_yard", "entrySpawnId": "gate" }]
  },
  "distribution": "downloadable",
  "entitlement": { "type": "iap", "productId": "pack_school" }
}
```

Para que la calle de `core` enlace con la escuela **sin modificar `core`**, el pack `school` declara una **extensión de escena** [DESIGNED FOR LATER]:

```json
// school/scenes/_extends.core_street.json
{ "extends": "core:street", "addEntities": [ { "localId": "school_bus_stop", "prefabId": "school:bus_stop", "transform": { "x": 5200, "y": 960 } } ] }
```

Ver [CONTENT_SYSTEM §5](../architecture/CONTENT_SYSTEM.md).
