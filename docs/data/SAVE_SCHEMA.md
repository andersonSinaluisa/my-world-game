# Save Schema

> **Status:** Accepted (v1, `saveVersion` 1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-005](../decisions/ADR-005-OFFLINE-FIRST.md), [ADR-006](../decisions/ADR-006-SQLITE.md)
> **Related Epic:** EPIC-015
> **Related HU:** HU-GAME-052, HU-GAME-053, HU-GAME-054, HU-GAME-055, HU-GAME-072
> **Sistema:** [SAVE_SYSTEM](../architecture/SAVE_SYSTEM.md)

## 1. Modelo lógico: `GameSave`

Es la vista lógica completa de una partida. Se usa en migraciones, exportación, pruebas y el futuro backend. Físicamente se guarda repartido en tablas (§3).

```ts
interface GameSave {
  saveVersion: number;                       // formato del guardado. v1 = 1
  slotId: string;                            // 'main' en el MVP
  createdAt: string;                         // ISO-8601
  updatedAt: string;
  contentVersions: Record<PackId, string>;   // { "core": "1.0.0" }: packs activos al guardar
  player: PlayerState;
  entities: SavedEntity[];                   // SOLO entidades modificadas o creadas en runtime (diff)
  removed: EntityId[];                       // entidades declaradas en escenas que ya no existen (comidas, vendidas…)
}

interface PlayerState {
  currentSceneId: SceneId;                   // dónde retomar
  cameraX: number;
  wallet: { coins: number };
  unlocks: string[];                         // ids de ubicaciones o contenidos desbloqueados
  inventory: { capacity: number };           // el contenido se deriva de las locations 'inventory'
  settings: Settings;
  dailyReward?: { lastClaimDate: string };   // YYYY-MM-DD en hora local (HU-GAME-067)
  flags: Record<string, boolean | number | string>;  // flags de progreso genéricos (tutorial visto, etc.)
}

interface Settings {
  musicVolume: number;        // 0..1
  sfxVolume: number;          // 0..1
  muted: boolean;
  reduceMotion: boolean;      // [DESIGNED FOR LATER] HU-GAME-110
  language: 'es' | 'en';
  leftHanded?: boolean;       // [DESIGNED FOR LATER]
}

interface SavedEntity {
  id: EntityId;
  prefabId?: PrefabId;
  tags?: string[];                        // solo si difieren del prefab
  location: Location;
  components: Partial<ComponentMap>;      // SOLO componentes persistibles (§2), completos para esa entidad
}
```

## 2. Qué se persiste de cada componente

| Componente | ¿Persiste? | Nota |
|---|---|---|
| `transform` | ✅ | posición final |
| `states` | ✅ solo `current` | |
| `edible` / `drinkable` | ✅ solo `bitesLeft` / `sipsLeft` | |
| `purchasable` | ✅ `purchased` (entidades de escena) · **completo** (`price`, `purchased`, `restock`, `origin`) en entidades runtime `rt_` | las copias de reposición no tienen definición de escena de la que heredar |
| `collectible` | — | al recogerse, la entidad se elimina (`entity_removed`) |
| `spawnedFrom` | ✅ | necesario para `maxAlive` |
| `pose` | ✅ si es persistente (`idle`, `sit`, `sleep`) + `seatId` | las poses temporales se normalizan a `returnTo` |
| `character`, `appearance` | ✅ | |
| `holder` | ❌ | derivado o constante |
| `outfit` | ❌ | índice derivado de las locations |
| `expression` | ❌ | vuelve a `neutral` |
| `sprite`, `hitbox`, `draggable`, `surface`, `seat`, `bed`, `container` (definición), `sounds`, `animations`, `spawner`, `portal`, `wearable` | ❌ | vienen del prefab o de la escena. **Si una instancia los modificó en runtime** (poco común), se persiste el override completo. |

Principio: se **persiste el estado del jugador, no la definición del contenido**. Así, si se actualiza el arte o el hitbox de un prefab, las partidas existentes lo reciben automáticamente.

## 3. Modelo físico (SQLite)

Base de datos: `myworld.db`.

```sql
-- versión del ESQUEMA SQL (no del formato de datos): PRAGMA user_version = 1

CREATE TABLE save_slot (
  slot_id        TEXT PRIMARY KEY,          -- 'main'
  save_version   INTEGER NOT NULL,          -- versión del formato de datos (GameSave.saveVersion)
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  content_versions TEXT NOT NULL,           -- JSON
  player         TEXT NOT NULL              -- JSON PlayerState
);

CREATE TABLE entity_state (
  slot_id    TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  scene_id   TEXT,                          -- desnormalizado para cargar por escena; NULL si no está en escena
  data       TEXT NOT NULL,                 -- JSON SavedEntity
  updated_at TEXT NOT NULL,
  PRIMARY KEY (slot_id, entity_id)
);
CREATE INDEX idx_entity_scene ON entity_state(slot_id, scene_id);

CREATE TABLE entity_removed (
  slot_id   TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  PRIMARY KEY (slot_id, entity_id)
);
```

**Por qué una fila por entidad** (y no un blob con todo el mundo):
- El **autosave es incremental**: solo se escriben las entidades sucias, en una transacción.
- Con cientos de entidades, reescribir un JSON de unos 200 KB en cada cambio sería innecesario.
- Además, reduce el riesgo de corrupción total.

**Por qué el `data` va en JSON** (y no en columnas por componente): los componentes evolucionan con el contenido. El JSON se valida con zod al leerlo. SQLite se usa como almacén transaccional, no como modelo relacional.

## 4. Reconstrucción de una escena al cargar

```
para la escena S:
  1. entidades = SceneDefinition(S).entities instanciadas desde prefabs      (contenido)
  2. quitar las que estén en entity_removed
  3. para cada fila de entity_state con scene_id = S o cuya location apunte a un contenedor de S:
       si existe en (1) → fusionar components persistidos sobre los efectivos
       si no existe    → instanciar desde su prefabId (entidad runtime) + components
  4. las entidades globales (TODOS los personajes, lo que sostienen y visten, y la mochila) se cargan al inicio, sea cual sea la escena
```

## <a id="migraciones"></a>5. Versionado y migraciones

Hay **tres versiones independientes**:

| Versión | Dónde | Cambia cuando | Mecanismo |
|---|---|---|---|
| `PRAGMA user_version` | SQLite | cambia la **estructura de tablas** | migraciones SQL numeradas `sql/001_init.sql`, `002_…` |
| `saveVersion` | `save_slot.save_version` | cambia el **formato de `GameSave`, de `SavedEntity` o de un componente persistible** | funciones TS puras `migrate_1_to_2(save: GameSaveV1): GameSaveV2` |
| `contentVersions[pack]` | `save_slot.content_versions` | se actualiza un **pack** (IDs renombrados o eliminados) | `idAliases` y `removedIds` en el manifest del pack (ver [CONTENT_PACK_SCHEMA](CONTENT_PACK_SCHEMA.md)) |

**Reglas:**
1. Las migraciones de `saveVersion` son **encadenadas** (1→2→3…), **puras**, **idempotentes por paso** y **cubiertas por un test con fixture** (HU-GAME-072).
2. Antes de **cualquier** migración (SQL por `user_version` o de datos por `saveVersion`) se hace una **copia de seguridad** en `myworld.backup.db`. Implementación: `ATTACH` del archivo de backup y copia tabla a tabla (`DELETE` + `INSERT … SELECT`), porque `VACUUM INTO` falla si el archivo ya existe y borrarlo exigiría una dependencia de sistema de archivos. El resultado es equivalente.
3. Si una migración falla:
   - se restaura la copia;
   - se muestra una pantalla amable "no pudimos cargar tu mundo";
   - se ofrece empezar de nuevo **sin borrar la copia**;
   - se registra el error en el log local.
4. **Pack más nuevo en el guardado que en la app** (la app volvió a una versión anterior):
   - si difiere la versión **major**, el guardado no se abre (igual que la regla 5);
   - si difiere solo la minor o la patch, se abre y las entidades de prefabs desconocidos se descartan según la regla 6.
5. **Un guardado con versión mayor a la soportada** (el usuario volvió a una versión anterior de la app) **no se abre ni se modifica**. Se muestra un aviso.
6. Una entidad cuyo `prefabId` ya no existe y no tiene alias:
   - se **descarta** al cargar;
   - se registra una advertencia;
   - si estaba en un contenedor o en la mochila, se libera el slot.

## 6. Ejemplo de `GameSave` (exportado)

```json
{
  "saveVersion": 1,
  "slotId": "main",
  "createdAt": "2026-09-18T15:00:00Z",
  "updatedAt": "2026-09-18T15:42:10Z",
  "contentVersions": { "core": "1.0.0" },
  "player": {
    "currentSceneId": "core:home", "cameraX": 2400,
    "wallet": { "coins": 35 }, "unlocks": ["core:street", "core:store"],
    "inventory": { "capacity": 12 },
    "settings": { "musicVolume": 0.6, "sfxVolume": 0.9, "muted": false, "reduceMotion": false, "language": "es" },
    "flags": { "tutorialSeen": true }
  },
  "entities": [
    { "id": "core:home/apple_1", "prefabId": "core:apple_red", "location": { "kind": "scene", "sceneId": "core:home" },
      "components": { "transform": { "x": 4410, "y": 700 }, "edible": { "bitesLeft": 2 } } },
    { "id": "rt_01J8Z8…", "prefabId": "core:teddy_bear", "location": { "kind": "scene", "sceneId": "core:home" },
      "components": { "transform": { "x": 4550, "y": 690 } } }
  ],
  "removed": ["core:home/cookie_2"]
}
```

Este es el caso "dejo un juguete sobre la cama y sigue ahí al volver": `rt_01J8Z8…` queda con `transform.y` sobre la superficie de la cama.
