# EPIC-024 — Testing

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 0 (HU-GAME-072 en Fase 1)
> **Docs:** [CONTENT_PACK_SCHEMA](../../data/CONTENT_PACK_SCHEMA.md) · [CONTENT_SYSTEM](../../architecture/CONTENT_SYSTEM.md) · [OBJECT_SCHEMA](../../data/OBJECT_SCHEMA.md) · [SCENE_SCHEMA](../../data/SCENE_SCHEMA.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md) · [SAVE_SYSTEM](../../architecture/SAVE_SYSTEM.md)

## Objetivo del epic
Detectar los errores antes de que lleguen al niño: un validador de contenido que se ejecuta en la CLI y en la CI y bloquea cualquier pack roto o con arte provisional en release, y pruebas de regresión que garantizan que los guardados de todas las versiones publicadas siguen cargando. El harness headless base es HU-GAME-002 (EPIC-001).

## Historias
- [HU-GAME-069 — Validador de contenido para la CLI y la CI](#hu-game-069--validador-de-contenido-para-la-cli-y-la-ci)
- [HU-GAME-072 — Pruebas de regresión de guardado con fixtures](#hu-game-072--pruebas-de-regresión-de-guardado-con-fixtures)

---

## HU-GAME-069 — Validador de contenido para la CLI y la CI

> **Status:** Draft
> **Epic:** EPIC-024 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-024 — Testing

### Prioridad
Must · P0

### Historia
Como **diseñador de contenido**
quiero **ejecutar un comando que valide todos los packs y me diga exactamente qué archivo y qué campo están mal**
para **corregir el contenido antes de probarlo en el dispositivo y que la CI impida publicar contenido roto**.

### Contexto
[CONTENT_PACK_SCHEMA §6](../../data/CONTENT_PACK_SCHEMA.md) define el orden de validación, la forma de los errores y el código de salida. En release, el `ContentRegistry` no valida referencias cruzadas porque confía en la CI ([CONTENT_SYSTEM §2](../../architecture/CONTENT_SYSTEM.md), [PERFORMANCE §4](../../architecture/PERFORMANCE.md), regla 5): este validador es esa garantía. El DoD global exige que `npm run content:validate` pase ([DEFINITION_OF_DONE §2](../DEFINITION_OF_DONE.md)).

### Reglas de negocio
- **R1 — Comando:** `scripts/validate-content.ts`, script npm `content:validate`. Opciones: `--release` (política de release) y `--json` (salida legible por máquina, propuesta).
- **R2 — Mismo código que el runtime:** reutiliza los validadores de `src/engine/content/` (HU-GAME-024, HU-GAME-068). No hay una segunda implementación de las reglas.
- **R3 — Orden de validación** ([CONTENT_PACK_SCHEMA §6](../../data/CONTENT_PACK_SCHEMA.md)):
  1. schema del `manifest.json`;
  2. dependencias: existen, el rango semver se cumple y no hay ciclos;
  3. schema de cada archivo (prefabs, escenas, reglas, partes, locales);
  4. referencias cruzadas: prefabs, escenas, spawns, assets, audio, claves i18n en `es` **y** `en`, componentes y acciones;
  5. unicidad global de IDs y de claves de asset;
  6. archivos: cada `file` existe y sus dimensiones coinciden con `w`/`h`; chunks de fondo ≤ 2048 px de ancho; texturas ≤ 2048 × 2048;
  7. política de release: `placeholder: true` es **error** con `--release` y advertencia sin él.
- **R4 — Reglas específicas** que se incluyen en los pasos 3 y 4: [OBJECT_SCHEMA §6](../../data/OBJECT_SCHEMA.md), [SCENE_SCHEMA §3 y §6](../../data/SCENE_SCHEMA.md) (altura 1080, spawn `default`, **suelo que cubre `0..width` sin huecos**, coordenadas dentro de la escena, `inContainer` válido, portales con escena y spawn existentes) e [INTERACTION_SCHEMA §9](../../data/INTERACTION_SCHEMA.md) (incluidos el trigger `longPress` y el campo `fallback`).
- **R5 — Todos los errores de una vez:** no se detiene en el primero. Si el manifest de un pack es inválido, se omiten los pasos siguientes **de ese pack** y se sigue con los demás.
- **R6 — Formato del error:** `{ pack, file, path (JSON pointer), code, message }`. Salida de texto: una línea por error, agrupadas por pack y archivo; al final, el número de errores y advertencias.
- **R7 — Código de salida:** `0` sin errores (aunque haya advertencias); `1` con uno o más errores de contenido; `2` si el propio validador falla (argumentos inválidos, excepción inesperada) (propuesta para distinguir contenido roto de herramienta rota).
- **R8 — Dimensiones de imagen:** se leen de la cabecera del WebP en Node, sin dependencias nativas (propuesta: lector propio de cabeceras o librería ligera justificada en esta HU).
- **R9 — Tiempo:** la validación del pack `core` completo tarda < 10 s en una máquina de desarrollo (propuesta), para que se pueda ejecutar en cada cambio.
- **R10 — Integración:** `npm test` incluye un test que ejecuta el validador sobre el pack `core` real y espera 0 errores. La CI ejecuta `content:validate` y, en las ramas de release, `content:validate --release`. También ejecuta `content:assets --check` (HU-GAME-068).

### Criterios de aceptación
```gherkin
Scenario: el pack core es válido
  Given el pack core del repositorio
  When se ejecuta "npm run content:validate"
  Then termina con código de salida 0

Scenario Outline: cada tipo de error se detecta con su ruta
  Given un pack de fixture en src/test/fixtures/content-invalid/<fixture>
  When se ejecuta el validador sobre ese pack
  Then termina con código de salida 1
  And hay un error con code "<code>", file "<archivo>" y path "<ruta>"

  Examples:
    | fixture               | code                  | archivo                         | ruta                          |
    | manifest_bad_id       | invalidManifest       | manifest.json                   | /id                           |
    | dep_cycle             | dependencyCycle       | manifest.json                   | /dependencies                 |
    | dep_semver            | dependencyVersion     | manifest.json                   | /dependencies/core            |
    | prefab_unknown_field  | unknownField          | prefabs/food/apple.json         | /components/edible/calories   |
    | scene_height          | invalidSceneHeight    | scenes/room.json                | /size/height                  |
    | scene_no_default      | missingDefaultSpawn   | scenes/room.json                | /spawnPoints                  |
    | scene_floor_gap       | floorGap              | scenes/room.json                | /floor                        |
    | scene_out_of_bounds   | coordinateOutOfBounds | scenes/room.json                | /entities/0/transform/x       |
    | rule_bad_fallback     | invalidField          | interactions/test.rules.json    | /0/fallback                   |
    | in_container_slot     | invalidContainerSlot  | scenes/room.json                | /entities/1/inContainer/slot  |
    | rule_unknown_action   | unknownAction         | interactions/test.rules.json    | /0/actions/0/type             |
    | missing_i18n_en       | missingI18n           | prefabs/food/apple.json         | /metadata/name                |
    | duplicate_asset_key   | duplicateAssetKey     | assets.json                     | /images/obj_food_apple        |
    | image_size_mismatch   | imageSizeMismatch     | assets.json                     | /images/obj_food_apple/w      |
    | chunk_too_wide        | textureTooLarge       | assets.json                     | /images/env_bg_room_01        |
    | missing_file          | missingFile           | assets.json                     | /images/obj_toy_ball/file     |

Scenario: placeholder es advertencia sin --release
  Given un pack válido con un asset placeholder true
  When se ejecuta "npm run content:validate"
  Then termina con código de salida 0
  And la salida informa 1 advertencia

Scenario: placeholder es error con --release
  Given el mismo pack
  When se ejecuta "npm run content:validate -- --release"
  Then termina con código de salida 1
  And hay un error con code "placeholderInRelease"

Scenario: se informan todos los errores de una vez
  Given un pack con 3 errores en 3 archivos distintos
  When se ejecuta el validador
  Then la salida contiene los 3 errores y el resumen "3 errores"

Scenario: un manifest roto no impide validar otros packs
  Given dos packs, uno con manifest inválido y otro con un prefab inválido
  When se ejecuta el validador
  Then se informa el error del manifest del primero
  And también el error del prefab del segundo

Scenario: fallo de la propia herramienta
  When se ejecuta el validador con una opción desconocida "--foo"
  Then termina con código de salida 2 y muestra el uso

Scenario: salida JSON
  Given un pack con 1 error
  When se ejecuta el validador con --json
  Then la salida es un JSON válido con una lista de objetos { pack, file, path, code, message }
```

### Casos límite
- Imagen que no es WebP: error `invalidImageFormat` (propuesta).
- Chunk de exactamente 2048 px: válido; 2049: error.
- Claves i18n presentes en `es.json` pero no usadas: no es error (propuesta: advertencia opcional en una versión futura).
- Windows y macOS/Linux: las rutas del informe usan `/` siempre, para que la salida sea igual en la CI y en local.

### Dependencias
- HU-GAME-068: pack `core` y estructura.
- HU-GAME-002: Jest para los tests del validador.

### Consideraciones técnicas
- Documentos: [CONTENT_PACK_SCHEMA §6](../../data/CONTENT_PACK_SCHEMA.md), [CONTENT_SYSTEM §2, §3](../../architecture/CONTENT_SYSTEM.md), [OBJECT_SCHEMA §6](../../data/OBJECT_SCHEMA.md), [SCENE_SCHEMA §6](../../data/SCENE_SCHEMA.md), [INTERACTION_SCHEMA §9](../../data/INTERACTION_SCHEMA.md).
- [NEEDED NOW] validador CLI, fixtures inválidos, integración en `npm test`.
- [DESIGNED FOR LATER] validación de packs descargables (checksum, firma, HU-GAME-114); extensiones de escena.
- Ejecutor de TS en Node: `tsx`, instalado en HU-GAME-068.
- Restricción: el validador puede usar `fs` y `path` (es un script de Node en `scripts/`), pero los validadores que reutiliza de `engine/content` no.

### Assets necesarios
- Fixtures de imagen mínimos (WebP de pocos píxeles con dimensiones conocidas y uno de 2049 px de ancho) en `src/test/fixtures/content-invalid/` (placeholder aceptable: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] `npm run content:validate` y `--release` funcionando con los códigos de salida de R7.
- [ ] Un fixture inválido y un test por cada código de error.
- [ ] Test en `npm test` que valida el pack `core` real.
- [ ] CONTENT_PACK_SCHEMA §6 actualizado con la lista de códigos de error.

---

## HU-GAME-072 — Pruebas de regresión de guardado con fixtures

> **Status:** Draft
> **Epic:** EPIC-024 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-024 — Testing

### Prioridad
Should · P1

### Historia
Como **padre o madre**
quiero **que al actualizar el juego mi hijo encuentre su mundo exactamente como lo dejó**
para **que nunca pierda sus personajes ni lo que construyó**.

### Contexto
El guardado es un diff sobre la escena definida, con `saveVersion` y migraciones obligatorias ([ARCHITECTURE §6](../../architecture/ARCHITECTURE.md), invariante 6). Las migraciones son encadenadas, puras, idempotentes por paso y **cubiertas por un test con fixture** ([SAVE_SCHEMA §5](../../data/SAVE_SCHEMA.md), regla 1). El DoD global exige que los fixtures de versiones anteriores sigan cargando ([DEFINITION_OF_DONE §2](../DEFINITION_OF_DONE.md)). La carga y las migraciones son HU-GAME-053 y HU-GAME-054; esta HU crea el banco de fixtures y los tests que lo recorren.

### Reglas de negocio
- **R1 — Ubicación y formato:** `src/test/fixtures/saves/v{N}/<nombre>.json`, con el formato `GameSave` exportado ([SAVE_SCHEMA §1 y §6](../../data/SAVE_SCHEMA.md)).
- **R2 — Fixtures mínimos de `saveVersion` 1:**
  - `fresh.json`: partida nueva con un personaje creado;
  - `rich.json`: objetos movidos (el juguete sobre la cama del ejemplo de SAVE_SCHEMA §6), estados cambiados, un contenedor con objetos, mochila con objetos, prendas vestidas, un objeto sostenido, un personaje sentado, entidades `rt_…` (una de ellas con el componente persistido `spawnedFrom`) y entidades en `removed`;
  - `content_drift.json`: un `prefabId` retirado sin alias, un `prefabId` renombrado con `idAliases` y un estado guardado que ya no existe.
- **R3 — Recorrido de cada fixture:** cargar en un `InMemorySaveStore` (HU-GAME-002) → migrar hasta el `saveVersion` actual → cargar la partida con el pack `core` real → comprobar los **invariantes** ([SAVE_SYSTEM §5](../../architecture/SAVE_SYSTEM.md): location válida, sin dos entidades en el mismo slot de contenedor o de mochila, sin dos en la misma mano) → comprobar los hechos esperados del fixture (archivo `<nombre>.expected.json` con posiciones, estados y locations clave).
- **R4 — Inmutabilidad:** un fixture publicado **no se edita nunca**. Un test compara el hash de cada fixture con `src/test/fixtures/saves/checksums.json` (propuesta); cambiarlo exige justificarlo en el PR.
- **R5 — Nueva versión de formato:** todo PR que suba `saveVersion` a N+1 añade `migrate_N_to_N+1`, congela al menos un fixture `vN` real (exportado de una build con la versión N) y su resultado esperado tras migrar.
- **R6 — Idempotencia por paso:** aplicar un paso de migración a su salida no produce cambios (SAVE_SCHEMA §5, regla 1).
- **R7 — Guardado de una versión futura** (`saveVersion` mayor que la soportada): no se abre ni se modifica; el almacén queda byte a byte igual y se informa el modo "no compatible" (SAVE_SCHEMA §5, regla 4).
- **R8 — Fallo de migración:** se restaura el backup, no se lanza ninguna excepción hacia la UI y se informa el estado "no pudimos cargar tu mundo" (SAVE_SCHEMA §5, regla 3).
- **R9 — Contenido cambiado:** un `prefabId` sin alias ni existencia se descarta con `logger.warn` y libera su slot; un alias se resuelve (SAVE_SCHEMA §5, regla 5).
- **R10 — Esquema SQL:** las migraciones de `PRAGMA user_version` necesitan SQLite real y se verifican `@manual` en el dispositivo (una instalación con la build anterior actualizada a la nueva).
- **R11 — Ejecución:** los tests forman parte de `npm test` y corren en la CI.

### Criterios de aceptación
```gherkin
Scenario: un guardado v1 nuevo carga sin avisos
  Given el fixture saves/v1/fresh.json
  When se carga con el pack core real
  Then la partida se carga sin errores ni logger.warn
  And el personaje del fixture está en la escena "core:home"

Scenario: el juguete sigue sobre la cama
  Given el fixture saves/v1/rich.json con la entidad "rt_01J8Z8…" en transform (4550, 690)
  When se carga la partida
  Then la entidad está en location scene "core:home" con transform (4550, 690)
  And la entidad "core:home/cookie_2" no existe en el World

Scenario: spawnedFrom se conserva
  Given el fixture saves/v1/rich.json con una manzana rt_ con spawnedFrom { spawnerId: "core:home/fruit_bowl" }
  When se carga la partida
  Then la manzana conserva spawnedFrom.spawnerId "core:home/fruit_bowl"

Scenario: el índice de apoyo no se guarda pero se reconstruye
  Given el fixture saves/v1/rich.json con el juguete sobre la cama
  When se carga la partida
  Then world.index.supportOf del juguete es la cama

Scenario: se cumplen los invariantes tras cargar
  Given cada fixture de saves/v*/
  When se carga la partida
  Then cada entidad tiene una location válida
  And no hay dos entidades en el mismo slot de contenedor, en el mismo slot de mochila ni en la misma mano

Scenario: prefab retirado sin alias
  Given el fixture saves/v1/content_drift.json con un objeto de prefab inexistente en el slot 2 de la mochila
  When se carga la partida
  Then el objeto se descarta y se registra un logger.warn con su id
  And el slot 2 de la mochila queda libre

Scenario: prefab renombrado con alias
  Given el mismo fixture con un objeto de prefabId "core:apple" y el alias "core:apple" → "core:apple_red"
  When se carga la partida
  Then el objeto existe con prefabId "core:apple_red"

Scenario: guardado de una versión futura
  Given un InMemorySaveStore con un guardado de saveVersion 99
  When se intenta cargar
  Then el resultado indica el modo "no compatible"
  And el contenido del almacén es idéntico al de antes de intentarlo

Scenario: fallo de migración
  Given un guardado v1 y una migración de prueba que lanza una excepción
  When se carga la partida
  Then se restaura el backup y el almacén queda como estaba
  And el resultado indica "no pudimos cargar tu mundo" sin lanzar excepción

Scenario: cada paso de migración es idempotente
  Given cada migrate_N_to_N+1 registrada y su fixture vN
  When se aplica el paso dos veces sobre la salida del primero
  Then la segunda aplicación no produce cambios

Scenario: los fixtures no se modifican
  Given el archivo checksums.json de los fixtures de guardado
  When se ejecuta la suite
  Then el hash de cada fixture coincide con el registrado

@manual @persistence
Scenario: actualización real de la app
  Incluye: AC-PERSIST-02
  Given un dispositivo Android con la build anterior instalada y un mundo con objetos movidos, un contenedor lleno y personajes sentados
  When se instala la build nueva encima y se abre
  Then el mundo aparece igual que antes de actualizar
  # Pasos: hacer capturas de cada zona antes y después; comparar; anotar el resultado en la HU.
```

### Casos límite
- En el MVP solo existe `saveVersion` 1: no hay migraciones reales todavía. Los tests de migración usan una migración de prueba `v1 → v2` que solo existe en los tests, para validar la cadena, el backup y la idempotencia.
- Un fixture que depende de contenido del pack `core` que cambia (posiciones iniciales, arte): los hechos esperados comprueban solo el estado del jugador (diff), no el contenido.
- Fixture con un `slotId` distinto de `main`: se ignora en el MVP (un solo slot, [SAVE_SYSTEM §7](../../architecture/SAVE_SYSTEM.md)).

### Dependencias
- HU-GAME-054: versionado y migraciones.

### Consideraciones técnicas
- Documentos: [SAVE_SCHEMA §1, §2, §4-§6](../../data/SAVE_SCHEMA.md), [SAVE_SYSTEM §4, §5](../../architecture/SAVE_SYSTEM.md), [CONTENT_PACK_SCHEMA §2](../../data/CONTENT_PACK_SCHEMA.md) (`idAliases`, `removedIds`).
- [NEEDED NOW] banco de fixtures v1, tests de carga, invariantes, versión futura, fallo de migración.
- [DESIGNED FOR LATER] exportar/importar `GameSave` desde la app para generar fixtures reales ([SAVE_SYSTEM §7](../../architecture/SAVE_SYSTEM.md)); mientras tanto los fixtures v1 se escriben a mano a partir de SAVE_SCHEMA §6.
- [NOT NEEDED YET] tests automáticos de SQLite real en Node.
- Restricción: los tests usan el `InMemorySaveStore`; no importan `expo-sqlite`.

### Assets necesarios
- Ninguno.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Fixtures `fresh`, `rich` y `content_drift` de v1 con sus `.expected.json` y `checksums.json`.
- [ ] Tests de carga, invariantes, alias, descarte, versión futura, fallo de migración e idempotencia en `npm test`.
- [ ] Verificación manual de actualización real anotada en la HU.
- [ ] SAVE_SCHEMA §5 enlaza la carpeta de fixtures y la regla de R5.
