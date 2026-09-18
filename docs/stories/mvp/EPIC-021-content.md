# EPIC-021 — Content Packs

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 0
> **Docs:** [CONTENT_SYSTEM](../../architecture/CONTENT_SYSTEM.md) · [CONTENT_PACK_SCHEMA](../../data/CONTENT_PACK_SCHEMA.md) · [OBJECT_SCHEMA](../../data/OBJECT_SCHEMA.md) · [SCENE_SCHEMA](../../data/SCENE_SCHEMA.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [FREE_ASSETS](../../design/research/FREE_ASSETS.md)

## Objetivo del epic
Que todo el contenido del MVP sea un Content Pack más, `core`, empaquetado en el binario: manifest versionado, manifest de assets, prefabs, escenas, reglas y textos en español e inglés, todo con namespace. El motor no conoce qué objetos existen. En el MVP solo existe el pack `core`; los packs descargables son [DESIGNED FOR LATER].

## Historias
- [HU-GAME-068 — Pack "core" con manifest y namespaces](#hu-game-068--pack-core-con-manifest-y-namespaces)

---

## HU-GAME-068 — Pack "core" con manifest y namespaces

> **Status:** Draft
> **Epic:** EPIC-021 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-021 — Content Packs

### Prioridad
Must · P0

### Historia
Como **diseñador de contenido**
quiero **un pack `core` con su manifest, su manifest de assets, sus textos en español e inglés y un registro que lo cargue al arrancar**
para **añadir objetos, escenas y reglas solo con archivos de datos y arte, sin tocar `src/`**.

### Contexto
[CONTENT_SYSTEM §1 y §2](../../architecture/CONTENT_SYSTEM.md) definen el `ContentRegistry` y la carga en el arranque; [CONTENT_PACK_SCHEMA §1-§5](../../data/CONTENT_PACK_SCHEMA.md) la estructura, el manifest, el `assets.json`, la resolución de namespaces y el versionado. Metro necesita `require` estáticos, así que el mapa de assets y la lista de archivos del pack se **generan** con un script ([CONTENT_SYSTEM §2](../../architecture/CONTENT_SYSTEM.md), "Cómo se empaqueta en el MVP"). En la Fase 0 el pack contiene un prototipo de escena con arte provisional; el contenido real de la casa, la calle y la tienda llega en EPIC-017, 018 y 019.

### Reglas de negocio
- **R1 — Estructura** en `MyWorld/content/core/` ([CONTENT_PACK_SCHEMA §1](../../data/CONTENT_PACK_SCHEMA.md)): `manifest.json`, `assets.json`, `prefabs/<category>/*.json`, `scenes/*.json`, `interactions/*.rules.json`, `locales/es.json`, `locales/en.json` y `assets/images/`, `assets/audio/`. `characters/parts.json` lo añade EPIC-004/005.
- **R2 — Manifest del pack core:** `id: "core"`, `name: "pack.core.name"`, `version: "1.0.0"` (propuesta de versión inicial), `formatVersion: 1`, `distribution: "bundled"`, sin `dependencies`, `provides.scenes` igual a los archivos de `scenes/`. `provides.locations` se rellena en la Fase 2 (mapa).
- **R3 — Contenido de la Fase 0** (propuesta): la escena `core:home` en versión prototipo (7680 × 1080, 4 chunks de fondo de 1920, suelo en y = 960 cubriendo `0..7680`, spawn `default`) y 5 prefabs placeholder que cubren las capacidades del prototipo: mesa (`surface`), manzana (`draggable`), pelota (`draggable`), caja de juguetes (`states` + `openable` + `container`), lámpara (`states` + `switchable`). Todos con `metadata.placeholder: true`.
- **R4 — `assets.json`** ([CONTENT_PACK_SCHEMA §3](../../data/CONTENT_PACK_SCHEMA.md)): cada clave con `file` (ruta relativa al pack), `w`, `h`, `placeholder`, `license` y `source`. Imágenes en **WebP** exportadas a 1× world units; audio en **m4a** ([RENDERING §6](../../architecture/RENDERING.md), [CONTENT_PACK_SCHEMA §1](../../data/CONTENT_PACK_SCHEMA.md)).
- **R5 — Claves, no rutas:** prefabs y escenas usan claves de asset e i18n; nunca rutas ni texto visible ([CONTENT_SYSTEM §6](../../architecture/CONTENT_SYSTEM.md)).
- **R6 — Script de generación** (`scripts/generate-asset-map.ts`, script npm `content:assets`):
  - genera `content/core/assets.generated.ts` con un `require` estático por clave de imagen y de audio;
  - genera `content/index.ts` con la lista estática de packs empaquetados y los `require` de sus JSON (manifest, prefabs, escenas, reglas, locales);
  - la salida es **determinista** (claves ordenadas) para que el diff sea legible;
  - si un `file` de `assets.json` no existe, falla con un error que nombra la clave y el archivo;
  - con `--check` no escribe nada y falla si los archivos generados no están al día (propuesta: los generados se versionan en git y la CI ejecuta `--check`).
- **R7 — ContentRegistry.loadBundledPacks()** ([CONTENT_SYSTEM §2](../../architecture/CONTENT_SYSTEM.md)):
  1. lee la lista de `content/index.ts`;
  2. ordena los packs topológicamente por `dependencies`; un ciclo es error;
  3. valida: **en dev**, validación zod completa con referencias cruzadas; **en release**, solo el manifest y los schemas;
  4. registra con namespace y construye el RuleIndex (HU-GAME-031).
- **R8 — Namespaces** ([CONTENT_PACK_SCHEMA §4](../../data/CONTENT_PACK_SCHEMA.md)): una referencia sin namespace se resuelve en el pack actual; con namespace, el pack debe ser el propio o estar en `dependencies`. `resolveAlias` aplica `idAliases`.
- **R9 — Versiones de formato:** el motor declara `supportedFormatVersions: [1]`. Un pack con otro `formatVersion` no se carga, se registra el error y el resto sigue. **El pack `core` no se puede deshabilitar**: si falla, en dev es un error bloqueante y en release la CI debió impedirlo ([CONTENT_PACK_SCHEMA §5](../../data/CONTENT_PACK_SCHEMA.md)).
- **R10 — i18n, una sola fuente** ([UI_UX_GUIDELINES §5](../../design/UI_UX_GUIDELINES.md)):
  - todos los textos viven en `content/<pack>/locales/es.json` y `en.json`: los de la app con claves `ui.*` y los del contenido con `object.*`, `scene.*`, `zone.*`…;
  - se leen con `ContentRegistry.t(key, locale)`, `locale ∈ { 'es', 'en' }`, y desde React con el hook `useT()` de `src/game/` (esta HU lo crea);
  - el idioma sale de `player.settings.language`. Por defecto: `es` si el dispositivo está en español; en cualquier otro caso, `en` ([UI_UX_GUIDELINES §5](../../design/UI_UX_GUIDELINES.md)). La detección usa `expo-localization`, que se instala en HU-GAME-075; hasta entonces el idioma por defecto es `es`;
  - una clave que falta en el idioma pedido usa el otro idioma y, si tampoco existe, devuelve la propia clave y registra `logger.warn` (propuesta). El validador impide que esto llegue a release (HU-GAME-069).
- **R11 — Aislamiento:** el motor recibe el registry por inyección (`GameEngine.create({ content })`) y nunca importa archivos de `content/` por ruta ([CONTENT_SYSTEM §6](../../architecture/CONTENT_SYSTEM.md)).
- **R12 — Dónde vive el arte** ([ARCHITECTURE §1 y §3](../../architecture/ARCHITECTURE.md), [ASSET_GUIDELINES §7](../../design/ASSET_GUIDELINES.md)): todo el arte y el audio del juego están en `MyWorld/content/<pack>/assets/`. `MyWorld/assets/` solo tiene el icono y el splash de la app. Las descargas CC0 (Glitch Items, Kenney; ver [FREE_ASSETS](../../design/research/FREE_ASSETS.md)) están en `assets/vendor/` **en la raíz del repositorio** y nunca se empaquetan tal cual: se copian, se renombran y se exportan a WebP en `content/core/assets/images/` con `placeholder: true`, `license: "CC0"` y `source` con la URL. El registro de licencias es `assets/vendor/LICENSES.md`.

### Criterios de aceptación
```gherkin
Scenario: el pack core se carga al arrancar
  Given el pack core con su manifest, 5 prefabs y la escena "home"
  When se ejecuta ContentRegistry.loadBundledPacks() en modo desarrollo
  Then packs() contiene el manifest de "core" con version "1.0.0"
  And prefab("core:apple_red") y scene("core:home") existen

Scenario: el mapa de assets es determinista
  Given un assets.json sin cambios
  When se ejecuta "npm run content:assets" dos veces
  Then los archivos generados son idénticos byte a byte

Scenario: el mapa generado debe estar al día
  Given una clave nueva en assets.json sin volver a generar
  When se ejecuta el script con --check
  Then termina con código de salida distinto de 0 y nombra la clave nueva

Scenario: archivo de asset inexistente
  Given una clave "obj_ghost" en assets.json cuyo file no existe
  When se ejecuta "npm run content:assets"
  Then falla con un error que nombra "obj_ghost" y la ruta del archivo

Scenario: textos en los dos idiomas
  Given la clave "object.apple_red.name" en es.json y en.json
  When se llama a t("object.apple_red.name", "es") y a t("object.apple_red.name", "en")
  Then se obtiene el texto en español y en inglés respectivamente

Scenario: textos de la app con claves ui.*
  Given la clave "ui.play.label" en es.json y en.json del pack core
  When un componente de prueba usa useT() con el idioma "en"
  Then obtiene el texto en inglés de "ui.play.label"

Scenario: idioma por defecto
  Given un dispositivo con idioma "es-MX" y sin idioma guardado en player.settings
  When se resuelve el idioma por defecto
  Then el idioma es "es"
  And con un dispositivo "en-GB" o "fr-FR" el idioma es "en"

Scenario: clave que falta en un idioma
  Given la clave "object.ball.name" solo en es.json
  When se llama a t("object.ball.name", "en") en modo producción
  Then se devuelve el texto en español
  And se registra un logger.warn con la clave

Scenario: pack con formatVersion no soportado
  Given el pack core y un pack de prueba "fx2" con formatVersion 2
  When se cargan los packs
  Then "fx2" queda deshabilitado con un error registrado
  And "core" funciona con normalidad

Scenario: ciclo de dependencias
  Given dos packs de prueba "a" y "b" que dependen uno del otro
  When se cargan los packs
  Then la carga informa un error de ciclo que nombra "a" y "b"

Scenario: referencia a un pack fuera de dependencies
  Given un pack de prueba sin dependencies cuyo prefab usa onFinish "core:apple_core"
  When se valida
  Then hay un error de referencia a un pack no declarado

Scenario: en release solo se validan manifest y schemas
  Given el pack core en modo release
  When se ejecuta loadBundledPacks()
  Then no se evalúan las referencias cruzadas
  And el tiempo de carga del contenido queda registrado para el overlay de rendimiento
```

### Casos límite
- Un JSON mal formado: el script de generación o el registry fallan con el nombre del archivo, no con un error genérico de Metro.
- Claves de asset con el prefijo de otro pack: no aplica al pack `core` (solo los packs no-core llevan prefijo, [CONTENT_PACK_SCHEMA §3](../../data/CONTENT_PACK_SCHEMA.md)).
- Imagen de más de 2048 px en cualquier eje: la rechaza el validador (HU-GAME-069), no el generador.
- Idioma del dispositivo `es-MX` o `es-419`: se trata como `es`; cualquier idioma distinto de `es*` usa `en`.

### Dependencias
- HU-GAME-003: World y ComponentRegistry (el registry valida componentes con sus schemas).

### Consideraciones técnicas
- Documentos: [CONTENT_SYSTEM](../../architecture/CONTENT_SYSTEM.md), [CONTENT_PACK_SCHEMA §1-§5](../../data/CONTENT_PACK_SCHEMA.md), [FREE_ASSETS](../../design/research/FREE_ASSETS.md).
- [NEEDED NOW] pack `core` empaquetado, registry, generador, i18n es/en.
- [DESIGNED FOR LATER] packs descargables, `checksum`, `entitlement`, extensiones de escena, variantes `@2x`.
- Esta HU instala `tsx` como devDependency para ejecutar `scripts/*.ts` en Node (lo reutiliza HU-GAME-069).
- La función que elige el idioma por defecto es pura (recibe el idioma del dispositivo); HU-GAME-075 le pasa el valor de `expo-localization`.
- Restricción: `engine/content` solo importa TS puro y zod; los `require` están solo en los archivos generados de `content/`. `useT()` vive en `src/game/`, no en el motor.

### Assets necesarios
- `env_home_bg_living_01` … `env_home_bg_bathroom_01`: 4 chunks de fondo de 1920 × 1080 (placeholder aceptable: sí; Glitch Locations o Kenney Background Elements, CC0).
- `env_home_table_round`, `obj_food_apple_red`, `obj_toy_ball`, `env_home_toybox_closed`, `env_home_toybox_open`, `env_home_lamp_floor_off`, `env_home_lamp_floor_on` (placeholder aceptable: sí; Glitch Items, CC0).
- `sfx_pickup_soft`, `sfx_drop_soft`, `sfx_reject_soft` (placeholder aceptable: sí; Kenney Interface Sounds, CC0).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Pack `core` con manifest, `assets.json`, locales es/en y el contenido de la Fase 0.
- [ ] Generador con `--check`; scripts `content:assets` en `package.json`.
- [ ] Tests del registry: carga, namespaces, alias, formatVersion, ciclos, i18n e idioma por defecto; hook `useT()`.
- [ ] `tsx` instalado; licencias de los placeholders registradas en `assets/vendor/LICENSES.md`.
- [ ] CONTENT_SYSTEM actualizado si cambia algún nombre de archivo generado.
