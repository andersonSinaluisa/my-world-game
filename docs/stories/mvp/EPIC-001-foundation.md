# EPIC-001 — Game Foundation

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 0
> **Docs:** [ARCHITECTURE](../../architecture/ARCHITECTURE.md) · [GAME_ENGINE](../../architecture/GAME_ENGINE.md) · [ECS](../../architecture/ECS.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [SAVE_SYSTEM](../../architecture/SAVE_SYSTEM.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md)

## Objetivo del epic
Dejar la app `MyWorld/` lista para construir el juego: proyecto Expo en landscape sin el demo de la plantilla, estructura de carpetas de [ARCHITECTURE §3](../../architecture/ARCHITECTURE.md), pruebas en Node con un harness headless, el núcleo del `World` (entidades, componentes, eventos) y el `GameFacade`, que es la única puerta entre la UI y el motor. Todo lo demás del MVP se apoya en este epic.

## Estado de implementación (2026-09-18, rama `feature/EPIC-001-002-foundation-rendering`)

| HU | Estado | Notas |
|---|---|---|
| 001 | In Progress | `app.json` según ADR-001; demo de la plantilla eliminado (inventario: `components/`, `hooks/`, `constants/`, `global.css` y `explore.tsx` solo los usaba el demo); estructura de ARCHITECTURE §3; Skia 2.6.2, expo-sqlite ~57.0.3 y zod 4.6 instalados; `typecheck` + `lint` con reglas de capas **probadas con imports prohibidos**; `expo install --check` limpio; bundles Metro de Android e iOS OK. **Pendiente:** verificación manual en dispositivo (landscape, iPad sin Split View). Se añadió `babel.config.js` (lo requiere babel-jest) y `types: ["jest","node"]` en tsconfig (TS 6 ya no incluye `@types` por defecto). Las dependencias del demo (`expo-device`, `expo-symbols`, `@expo/ui`…) se conservan; se pueden podar más adelante. |
| 002 | Done | Proyectos Jest `engine` (Node, sin preset RN: barrera probada) y `app` (jest-expo). Harness en `src/test/` (ver su README). |
| 003 | Done | `World` (transacciones con rollback, eventos por lote, structural sharing, congelado en dev), `ComponentRegistry` con los 10 componentes base, `LocationService`, ULID propio, `GameEngine.create`. `World.update` usa **semántica de reemplazo** por componente (`null` elimina). |
| 004 | Done | `createGameFacade`, `GameProvider`, `useEntity`, `useVisibleEntities`, `useActiveScene`. Se añadió `@testing-library/react-native` v14 (justificado por los tests de hooks; `react-test-renderer` está deprecado para React 19). Añadidos de la API: `getEntity`, `setAssetSizeLookup` y el espacio `dev` (solo sandbox; `activateScene` es provisional hasta HU-GAME-010). Los comandos despachados desde un listener se encolan y devuelven `{ ok: true }` (propuesta). |

## Historias
- [HU-GAME-001 — Configurar el proyecto Expo para el juego](#hu-game-001--configurar-el-proyecto-expo-para-el-juego)
- [HU-GAME-002 — Configurar pruebas unitarias y harness headless](#hu-game-002--configurar-pruebas-unitarias-y-harness-headless)
- [HU-GAME-003 — Núcleo del World: entidades, componentes y eventos](#hu-game-003--núcleo-del-world-entidades-componentes-y-eventos)
- [HU-GAME-004 — GameFacade: puente UI ↔ motor](#hu-game-004--gamefacade-puente-ui--motor)

---

## HU-GAME-001 — Configurar el proyecto Expo para el juego

> **Status:** Draft
> **Epic:** EPIC-001 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-001 — Game Foundation

### Prioridad
Must · P0

### Historia
Como **desarrollador**
quiero **un proyecto Expo configurado en landscape, sin el demo de la plantilla, con la estructura de carpetas de la arquitectura y las dependencias base instaladas**
para **empezar a implementar el motor sin deuda técnica ni código de ejemplo que confunda a personas o agentes**.

### Contexto
`MyWorld/` es la plantilla recién generada de Expo: SDK 57 (`expo ~57.0.24`), React Native 0.86.3, React 19.2.3, `react-native-reanimated` 4.5.1, `react-native-gesture-handler` ~2.32.0, `react-native-worklets` 0.10.1, `expo-router` ~57.0.22 y TypeScript ~6.0.3 en modo `strict`. `app.json` tiene `orientation: "portrait"` y los experimentos `typedRoutes` y `reactCompiler` activos. El código de `src/` es el demo de pestañas (`app-tabs.tsx`, `explore.tsx`…). **No** están instalados Skia, expo-sqlite, expo-audio, zod ni Jest.

El juego se explora en horizontal con altura virtual fija de 1080 unidades ([ADR-007](../../decisions/ADR-007-VIRTUAL-COORDINATES.md), [RENDERING §2](../../architecture/RENDERING.md)), por eso la app es **solo landscape** ([MVP_SCOPE §1](../../product/MVP_SCOPE.md)). La estructura de carpetas y las reglas de dependencia entre capas están en [ARCHITECTURE §2 y §3](../../architecture/ARCHITECTURE.md).

> `MyWorld/AGENTS.md` pide leer la documentación versionada de Expo v57 antes de escribir código. Aplica a esta HU.

### Reglas de negocio
- **R1 — `app.json`** según [ADR-001](../../decisions/ADR-001-TECH-STACK.md) ("Ajustes de `app.json`"):
  - `expo.orientation = "landscape"`: la app nunca se muestra en portrait, ni en teléfono ni en tablet;
  - `ios.requireFullScreen = true`: necesario para que el iPad respete el bloqueo de orientación (sin Split View);
  - `userInterfaceStyle = "light"`: el juego tiene su propia paleta y no sigue el modo oscuro;
  - **web** fuera del alcance del MVP: la configuración web de la plantilla puede quedar, pero no se prueba ni se soporta;
  - **React Compiler** (`experiments.reactCompiler`) se mantiene, pero su compatibilidad con los worklets se verifica en esta HU y en HU-GAME-005; si da problemas se desactiva y se documenta en ADR-001 (OQ-10).
- **R2 — Se conserva** `android.predictiveBackGestureEnabled: false` (lo exige [INPUT_SYSTEM §6](../../architecture/INPUT_SYSTEM.md)). Tampoco se tocan `icon`, `splash`, `scheme` ni `typedRoutes`.
- **R3 — Análisis antes de borrar.** Antes de eliminar nada se hace un inventario de la plantilla y se busca (`grep` de imports) qué archivos referencia cada uno. El resultado se anota en el PR. Inventario esperado:

  | Se elimina | Se conserva |
  |---|---|
  | `src/app/explore.tsx`; el contenido demo de `src/app/index.tsx` y `src/app/_layout.tsx` (se reescriben) | `assets/images/icon.png`, `android-icon-*.png`, `splash-icon.png`, `favicon.png` |
  | `src/components/*` (`app-tabs*`, `animated-icon*`, `external-link`, `hint-row`, `themed-*`, `ui/collapsible`, `web-badge`) | `assets/expo.icon/` (icono iOS referenciado en `app.json`) |
  | `src/hooks/*`, `src/constants/theme.ts` | `tsconfig.json` (alias `@/*` → `./src/*`) |
  | `src/global.css` **solo si** el inventario confirma que únicamente lo usa el demo | `MyWorld/AGENTS.md`, `MyWorld/CLAUDE.md` |
  | `assets/images/react-logo*`, `expo-logo.png`, `expo-badge*.png`, `logo-glow.png`, `tutorial-web.png`, `tabIcons/` | |

- **R4 — No se ejecuta `npm run reset-project`.** El script `scripts/reset-project.js` es interactivo (`readline`) y mueve o borra también la carpeta `scripts/`, que es donde vivirán `validate-content.ts` (HU-GAME-069) y el generador del mapa de assets (HU-GAME-068). La limpieza se hace a mano según R3; después se borran `scripts/reset-project.js` y la entrada `reset-project` de `package.json`.
- **R5 — Rutas mínimas.** `src/app/_layout.tsx` usa un `Stack` sin cabecera, sin pestañas, y monta `GestureHandlerRootView` en la raíz. `src/app/index.tsx` es un placeholder de la pantalla de título (la pantalla real es HU-GAME-073). Las rutas `play`, `creator` y `settings` se crean en las HU que las necesitan.
- **R6 — Estructura de carpetas** exactamente como [ARCHITECTURE §3](../../architecture/ARCHITECTURE.md): `src/{app,ui,game,test}`, `src/engine/{core,components,systems,actions,rules,scene,content,persistence}`, `src/engine/adapters/{render,input,audio,sqlite}`, `content/core/` (con `content/core/assets/images` y `audio`) y `scripts/`. `MyWorld/assets/` queda **solo** para el icono y el splash de la app; el arte del juego vive en `content/<pack>/assets/`. Las carpetas vacías llevan un `.gitkeep`. Una carpeta nueva de primer nivel necesita justificación documentada.
- **R7 — Assets placeholder de terceros.** Las descargas originales CC0 (Kenney, Glitch; ver [FREE_ASSETS](../../design/research/FREE_ASSETS.md)) están en `assets/vendor/` **en la raíz del repositorio**, fuera de `MyWorld/`, y nunca se empaquetan tal cual. El registro de licencias es `assets/vendor/LICENSES.md` ([ASSET_GUIDELINES §7](../../design/ASSET_GUIDELINES.md)). Los derivados se copian y renombran al pack (`MyWorld/content/core/assets/`) con `placeholder: true` (HU-GAME-068).
- **R8 — Dependencias.** Se instalan con `npx expo install` para obtener versiones compatibles con el SDK 57. Cada una se justifica:

  | Paquete | Dónde se instala | Justificación |
  |---|---|---|
  | `@shopify/react-native-skia` | **esta HU** | Render 2D ([ADR-002](../../decisions/ADR-002-RENDERING.md), [RENDERING §1](../../architecture/RENDERING.md)). Es nativo: se instala junto a sqlite para reconstruir el dev client una sola vez. |
  | `expo-sqlite` | **esta HU** | Persistencia offline ([ADR-006](../../decisions/ADR-006-SQLITE.md)). Se usa a partir de HU-GAME-052. |
  | `zod` | **esta HU** | Schemas de componentes y contenido ([ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md)). Es la única librería que puede importar `engine/core` además de TS puro. |
  | `jest`, `jest-expo`, `@types/jest` | HU-GAME-002 | Pruebas |
  | `expo-audio` | HU-GAME-056 | Audio ([AUDIO_SYSTEM](../../architecture/AUDIO_SYSTEM.md)) |
  | `expo-localization` | HU-GAME-075 | Idioma del dispositivo ([UI_UX_GUIDELINES §5](../../design/UI_UX_GUIDELINES.md)) |
  | `tsx` (devDependency) | HU-GAME-068 | Ejecutar `scripts/*.ts` en Node (generador de assets y validador) |

  No se instala ninguna librería de estado (Redux, Zustand) ni de ECS ([GAME_ENGINE §6](../../architecture/GAME_ENGINE.md), [ARCHITECTURE §7](../../architecture/ARCHITECTURE.md)).
- **R9 — Scripts npm.** Se añade `"typecheck": "tsc --noEmit"` y se mantiene `"lint": "expo lint"`. Ambos terminan con código ≠ 0 si hay errores. Los scripts `test`, `content:assets` y `content:validate` los añaden sus HU.
- **R10 — Reglas de capas con lint.** La configuración de ESLint prohíbe con `no-restricted-imports`:
  - en `src/engine/{core,components,systems,actions,rules,scene,content,persistence}`: `react`, `react-native`, `@shopify/react-native-skia` y `expo-*`;
  - en `src/ui` y `src/app`: `@/engine/core/*` (la UI solo usa `src/game`).

  Así se hace cumplir el invariante 1 y el 7 de [ARCHITECTURE §6](../../architecture/ARCHITECTURE.md) de forma automática.
- **R11 — Alias de contenido.** Se añade el alias `@content/*` → `./content/*` en `tsconfig.json` para el registry generado. El motor no importa `content/` por ruta ([CONTENT_SYSTEM §6](../../architecture/CONTENT_SYSTEM.md)); solo lo hace `content/index.ts`.

### Criterios de aceptación
```gherkin
@manual
Scenario: la app arranca en landscape en un teléfono
  Given un teléfono Android y un iPhone con la rotación automática activada
  And el dispositivo sostenido en vertical
  When se abre la app
  Then la pantalla de título se muestra en horizontal
  # Pasos: instalar el dev client, abrir con el teléfono en vertical, girarlo 360°; nunca debe verse en portrait.

@manual
Scenario: la app arranca en landscape en una tablet 4:3
  Given un iPad o una tablet Android de aspecto 4:3
  When se abre la app y se gira el dispositivo
  Then la app solo alterna entre landscape izquierdo y landscape derecho
  And en iPad no se ofrece Split View ni Slide Over

Scenario: app.json cumple ADR-001
  Given el app.json del proyecto
  When un test lee su contenido
  Then expo.orientation es "landscape"
  And expo.ios.requireFullScreen es true
  And expo.userInterfaceStyle es "light"
  And expo.android.predictiveBackGestureEnabled es false

@manual
Scenario: el arte del juego no está en MyWorld/assets
  Given el proyecto tras la limpieza
  When se lista MyWorld/assets
  Then solo contiene el icono, los iconos adaptativos de Android, el splash, el favicon y expo.icon

Scenario: el proyecto compila y pasa el lint
  Given el proyecto tras la limpieza de la plantilla
  When se ejecutan "npm run typecheck" y "npm run lint"
  Then ambos terminan con código de salida 0

Scenario: no queda código del demo de la plantilla
  Given el proyecto tras la limpieza
  When se buscan referencias a "app-tabs", "explore", "themed-text" y "reset-project" en src/, scripts/ y package.json
  Then no hay ninguna coincidencia
  And existe cada carpeta de ARCHITECTURE §3

Scenario: el lint rechaza un import prohibido en el núcleo del motor
  Given un archivo en src/engine/core que importa "react-native"
  When se ejecuta "npm run lint"
  Then el lint falla con un error de no-restricted-imports en ese archivo

Scenario: el lint rechaza que la UI importe el núcleo
  Given un archivo en src/ui que importa "@/engine/core/world"
  When se ejecuta "npm run lint"
  Then el lint falla con un error de no-restricted-imports

Scenario: las dependencias nativas son compatibles con el SDK
  Given las dependencias instaladas en esta HU
  When se ejecuta "npx expo install --check"
  Then no se informa ninguna versión incompatible
```

### Casos límite
- **iPad:** sin `ios.requireFullScreen` iOS ignoraría el bloqueo de orientación por la multitarea; por eso es obligatorio (R1).
- **Web:** `react-native-web` y `web.output` pueden quedar en la plantilla, pero la build web no se prueba ni se soporta en el MVP (Skia web exige CanvasKit).
- **React Compiler:** si al verificarlo (aquí y en el spike de HU-GAME-005) memoiza mal componentes con worklets o SharedValues, se desactiva y se documenta en ADR-001 (OQ-10).
- **`src/global.css`:** si el inventario muestra que lo usa algo que no es demo, se conserva.
- **Dev client:** Skia y expo-sqlite son nativos. Tras instalarlos hay que regenerar el dev client o comprobar que Expo Go del SDK 57 los incluye; el resultado se anota en la HU.

### Dependencias
- Ninguna. Es la primera HU del proyecto.

### Consideraciones técnicas
- Documentos: [ARCHITECTURE §2, §3, §6](../../architecture/ARCHITECTURE.md), [RENDERING §2](../../architecture/RENDERING.md), [INPUT_SYSTEM §6](../../architecture/INPUT_SYSTEM.md), [FREE_ASSETS](../../design/research/FREE_ASSETS.md).
- [NEEDED NOW] landscape, estructura de carpetas, Skia, expo-sqlite, zod, `typecheck`, reglas de lint por capa.
- [DESIGNED FOR LATER] assets `@2x` para tablets ([RENDERING §2.2](../../architecture/RENDERING.md)).
- [NOT NEEDED YET] build web ([ADR-001](../../decisions/ADR-001-TECH-STACK.md)).
- [NOT NEEDED YET] CI remota (GitHub Actions u otra). Esta HU deja los comandos listos para que la CI solo tenga que invocarlos.
- Restricción: esta HU **no** implementa lógica de juego; solo configura.

### Assets necesarios
- Ninguno nuevo. Los iconos y el splash actuales de Expo se consideran provisionales (placeholder aceptable: sí). Su sustitución es una tarea de arte previa al release ([MVP_SCOPE §4](../../product/MVP_SCOPE.md)).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] `app.json` con los ajustes de ADR-001 (landscape, `requireFullScreen`, `light`); resultado de la verificación del React Compiler anotado (OQ-10).
- [ ] Inventario de la plantilla adjunto al PR; demo eliminado; `reset-project` eliminado.
- [ ] Estructura de carpetas de ARCHITECTURE §3 creada.
- [ ] Skia, expo-sqlite y zod instalados con `npx expo install`; `npx expo install --check` limpio.
- [ ] `npm run typecheck` y `npm run lint` en verde; regla de capas probada con un import prohibido.
- [ ] Verificación manual en Android, iOS y tablet 4:3 anotada en la HU.
- [ ] Documentación: si cambia algo de ARCHITECTURE §3, se actualiza el documento.

---

## HU-GAME-002 — Configurar pruebas unitarias y harness headless

> **Status:** Draft
> **Epic:** EPIC-001 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-001 — Game Foundation

### Prioridad
Must · P0

### Historia
Como **desarrollador**
quiero **ejecutar pruebas del motor en Node, sin emulador, con un harness que cree un juego de prueba determinista y un almacén de guardado en memoria**
para **verificar cada criterio de aceptación de forma automática y rápida**.

### Contexto
El motor es TypeScript puro para poder probarse en Node ([ARCHITECTURE §2](../../architecture/ARCHITECTURE.md)). El [ACCEPTANCE_CRITERIA §1](../ACCEPTANCE_CRITERIA.md) exige que cada escenario sea automatizable en el harness headless o lleve `@manual`. [GAME_ENGINE §7](../../architecture/GAME_ENGINE.md) muestra la forma de uso: `createTestGame({ packs, scene })` y `game.dispatch(...)`. [SAVE_SYSTEM §2](../../architecture/SAVE_SYSTEM.md) define `InMemorySaveStore` con la misma interfaz que el puerto `SaveStore`.

**Orden con HU-GAME-003** ([EPICS](../EPICS.md), nota de HU-GAME-002): esta HU entrega Jest, las utilidades del harness (reloj falso, `random` sembrado, `InMemorySaveStore`, builders de fixtures) y un `createTestGame` **mínimo** que devuelve un World vacío. HU-GAME-003 lo amplía cuando existe el World real, **sin cambiar su firma**. Así no hay dependencia circular.

### Reglas de negocio
- **R1 — Herramientas.** `jest`, `jest-expo` y `@types/jest`, instalados con `npx expo install … -- --save-dev`. Scripts: `"test": "jest"` y `"test:watch": "jest --watch"`.
- **R2 — Dos proyectos de Jest:**
  - `engine`: `src/engine/**` y `src/test/**` con `testEnvironment: "node"` y **sin** el preset de React Native. Si un archivo del motor importa `react-native`, sus tests fallan: es una segunda barrera del invariante 1 de ARCHITECTURE §6.
  - `app`: `src/game/**`, `src/ui/**` con el preset `jest-expo`, para hooks y componentes.
- **R3 — `createTestGame(options)`** vive en `src/test/` y acepta `{ packs, scene?, save?, clock?, random?, logger? }`. En esta HU es **mínimo**: crea un World vacío y devuelve `clock`, `random`, `saveStore`, `events` (registro ordenado de eventos) y `advance(ms)` para mover el reloj falso. HU-GAME-003 añade `world` y `dispatch`, HU-GAME-004 añade `facade` y HU-GAME-010 la carga de `scene`.
- **R4 — Determinismo.** `clock` y `random` son falsos por defecto: reloj fijo en `2026-01-01T00:00:00Z` y generador con semilla fija (propuesta). Mismo estado + mismos comandos ⇒ mismos eventos e IDs `rt_…` ([GAME_ENGINE §7](../../architecture/GAME_ENGINE.md)). Ningún test usa temporizadores reales.
- **R5 — `InMemorySaveStore`** implementa el puerto `SaveStore` completo: `loadSlot`, `loadEntities(sceneId?)`, `writeBatch({ upserts, removals, player })`, `backup()` y `restoreBackup()` ([SAVE_SYSTEM §2](../../architecture/SAVE_SYSTEM.md)).
  - Guarda los datos **serializados en JSON**, igual que SQLite: un dato no serializable (función, `undefined` en arrays, referencias circulares) hace fallar la escritura.
  - `writeBatch` es **atómico**: si falla cualquier elemento, no se escribe nada.
  - Expone contadores de lectura (número de `writeBatch`, filas escritas) para probar el debounce del autosave (HU-GAME-052).
- **R6 — Fixtures** en `src/test/fixtures/`:
  - un pack de prueba con namespace `test` y una escena `test:room` de 3840 × 1080, suelo en `y = 960` y spawn `default`;
  - prefabs mínimos por **capacidad**: un objeto `draggable`, una mesa con `surface`, un contenedor `openable` + `container`, un objeto `switchable` y una entidad personaje;
  - builders: `p(x, y)` para puntos del mundo y `entity(...)` para crear entidades válidas con valores por defecto.
- **R7 — Convenciones.** Tests `*.test.ts(x)` junto al código que prueban (propuesta). Un test no depende del orden de ejecución de otros ([ACCEPTANCE_CRITERIA §3](../ACCEPTANCE_CRITERIA.md)).
- **R8 — Salida.** `npm test` termina con código ≠ 0 si falla algún test. No hay umbral de cobertura obligatorio en el MVP; se publica el informe (propuesta).

### Criterios de aceptación
```gherkin
Scenario: la suite se ejecuta en Node
  Given el proyecto con Jest configurado y un test de ejemplo del motor
  When se ejecuta "npm test"
  Then la suite pasa y termina con código de salida 0

Scenario: un test fallido rompe la ejecución
  Given un test del motor que falla
  When se ejecuta "npm test"
  Then el proceso termina con código de salida distinto de 0

Scenario: el proyecto engine no admite React Native
  Given un archivo de src/engine/core que importa "react-native"
  When se ejecutan los tests del proyecto "engine"
  Then la suite falla al cargar ese archivo

Scenario: InMemorySaveStore guarda y recupera un lote
  Given un InMemorySaveStore vacío
  When se escribe un writeBatch con 2 upserts de SavedEntity y un player
  Then loadEntities() devuelve las 2 entidades con los mismos datos
  And loadSlot() devuelve el player escrito

Scenario: writeBatch es atómico
  Given un InMemorySaveStore con 1 entidad guardada
  When se escribe un writeBatch con 2 upserts y uno de ellos contiene una función
  Then la escritura falla
  And el almacén sigue conteniendo solo la entidad original

Scenario: backup y restauración
  Given un InMemorySaveStore con datos y un backup() hecho
  When se escriben cambios y después se llama a restoreBackup()
  Then el almacén vuelve exactamente al estado del backup

Scenario: createTestGame mínimo
  Given las opciones por defecto
  When se llama a createTestGame()
  Then devuelve un juego con un World vacío, un reloj falso, un random sembrado y un InMemorySaveStore vacío

Scenario: el reloj falso solo avanza con advance
  Given un juego de prueba con el reloj en 2026-01-01T00:00:00Z
  When se llama a advance(1500)
  Then clock.now() devuelve 2026-01-01T00:00:01.500Z

Scenario: el random sembrado es reproducible
  Given dos juegos de prueba con la misma semilla
  When cada uno pide 5 números a su random
  Then ambas secuencias son idénticas
  # El determinismo de comandos y de IDs rt_ se prueba en HU-GAME-003.
```

### Casos límite
- Tests que necesitan tiempo (debounce de 1000 ms, máximo de 5 s del autosave): usan `advance(ms)`, nunca esperas reales.
- Módulos nativos (Skia, sqlite, audio) en el proyecto `app`: se mockean con los mocks oficiales si existen; si no, con stubs en `src/test/mocks/`.
- Un fixture inválido debe fallar con un mensaje claro de zod, no con un `undefined` más adelante.

### Dependencias
- HU-GAME-001: proyecto limpio, estructura de carpetas y zod instalados.
- HU-GAME-003 (posterior): amplía el `createTestGame` mínimo con el World real.

### Consideraciones técnicas
- Documentos: [GAME_ENGINE §2 y §7](../../architecture/GAME_ENGINE.md), [SAVE_SYSTEM §2](../../architecture/SAVE_SYSTEM.md), [ACCEPTANCE_CRITERIA](../ACCEPTANCE_CRITERIA.md).
- [NEEDED NOW] Jest, harness, `InMemorySaveStore`, fixtures.
- [DESIGNED FOR LATER] tests end-to-end en dispositivo (Maestro, Detox). Los escenarios de dispositivo se verifican `@manual` en el MVP.
- [NOT NEEDED YET] tests de snapshot visual del render Skia.
- Restricción: el harness no importa React, RN, Skia ni Expo; vive con el motor.

### Assets necesarios
- Ninguno. Los fixtures usan claves de asset ficticias (`test_obj_ball`…) resueltas por un manifest de prueba (placeholder aceptable: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Jest con los proyectos `engine` y `app`; `npm test` en verde.
- [ ] `createTestGame` mínimo, reloj falso, random sembrado, `InMemorySaveStore`, fixtures y builders en `src/test/`, con sus propios tests.
- [ ] Barrera probada: un import de RN en el motor rompe la suite `engine`.
- [ ] Guía breve de uso del harness en el README de `src/test/` (o en CODING_GUIDELINES si ya existe).

---

## HU-GAME-003 — Núcleo del World: entidades, componentes y eventos

> **Status:** Draft
> **Epic:** EPIC-001 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-001 — Game Foundation

### Prioridad
Must · P0

### Historia
Como **desarrollador**
quiero **un `World` de entidades con componentes validados, un bus de eventos y un servicio único para cambiar la location**
para **que todos los sistemas del juego modifiquen el estado de forma segura, transaccional y observable**.

### Contexto
El motor es "ECS-lite": entidades como datos, sistemas dirigidos por comandos y eventos, sin bucle lógico por frame ([ECS §1](../../architecture/ECS.md)). La `location` es el invariante central: cada entidad está en exactamente un lugar y solo `LocationService.move` la cambia ([ECS §4](../../architecture/ECS.md), [ARCHITECTURE §6](../../architecture/ARCHITECTURE.md), invariante 3). La interfaz del `World` y la lista de eventos están en [GAME_ENGINE §3 y §5](../../architecture/GAME_ENGINE.md).

### Reglas de negocio
- **R1 — Entidad.** `{ id, prefabId?, tags, location, components }` sin métodos ([ECS §2](../../architecture/ECS.md)).
- **R2 — IDs.** De escena: `{sceneId}/{localId}` (p. ej. `core:home/fridge`). De runtime: `rt_{ulid}`, generado con el `clock` y el `random` inyectados ([ENTITY_SCHEMA §2](../../data/ENTITY_SCHEMA.md)). Los IDs de contenido cumplen `^[a-z0-9_]+:[a-z0-9_]+$`.
- **R3 — ComponentRegistry con schemas zod `strict`** en `src/engine/components/`. Los tipos TS se infieren con `z.infer`. Esta HU registra los componentes base de [ENTITY_SCHEMA §5](../../data/ENTITY_SCHEMA.md): `transform`, `sprite`, `hitbox`, `draggable`, `surface`, `states`, `openable`, `switchable`, `animations` y `sounds`. El resto (`container`, `edible`, `seat`…) los añade la HU que los usa por primera vez, con el mismo mecanismo.
- **R4 — Validación.** Un componente desconocido o un campo desconocido es un error de validación ([ENTITY_SCHEMA §1](../../data/ENTITY_SCHEMA.md)). Los rangos del schema se aplican (p. ej. `transform.scale` en `0.25..4`).
- **R5 — API del World** según [GAME_ENGINE §3](../../architecture/GAME_ENGINE.md): `get`, `query({ has, tags, sceneId, locationKind })`, `create`, `update(id, patch)`, `remove`, `transaction(fn)` e `index` derivado (`heldBy`, `wornBy`, `inContainer`, `inventory`, `seatOccupant`; `supportOf` lo añade HU-GAME-028). `createTestGame` (HU-GAME-002) pasa a exponer `world` y `dispatch`.
- **R6 — Inmutabilidad hacia fuera.** `get` y `query` devuelven objetos `Readonly`. `update` copia solo los componentes tocados (structural sharing): los componentes no modificados conservan la misma referencia. En `__DEV__` los objetos devueltos se congelan (propuesta).
- **R7 — Transacciones.** Los eventos se acumulan y se emiten **al final** de `transaction`, en orden. Las transacciones anidadas se aplanan en la exterior. Si `fn` lanza una excepción, el World vuelve al estado anterior y **no** se emite ningún evento.
- **R8 — Eventos** con los nombres y payloads de [GAME_ENGINE §5](../../architecture/GAME_ENGINE.md): `entityCreated`, `entityChanged`, `entityRemoved`, `entityMoved { id, from, to }`… Son datos serializables, sin funciones.
- **R9 — LocationService.move(id, newLocation)** es la única vía para cambiar una location: valida la transición (slot libre, mano libre, entidad destino existente), actualiza los índices y emite `entityMoved`. Los índices son derivados y **no** se persisten.
- **R10 — Invariantes** (location válida, nada de doble ocupación de slot o mano): en dev lanzan un error claro; en producción se reparan de forma segura y se registra `logger.warn` ([GAME_ENGINE §8](../../architecture/GAME_ENGINE.md)).
- **R11 — `GameEngine.create({ content, saveStore, clock, random, logger })`** recibe todas sus dependencias. No hay singletons globales.
- **R12 — `dispatch(cmd)`** devuelve `CommandResult`. Un comando desconocido o inválido devuelve `{ ok: false, reason }` y nunca lanza hacia fuera ([GAME_ENGINE §8](../../architecture/GAME_ENGINE.md)).

### Criterios de aceptación
```gherkin
Scenario: crear una entidad emite entityCreated
  Given un World vacío
  When se crea una entidad "test:room/ball" con transform { x: 100, y: 960 } y location scene "test:room"
  Then world.get("test:room/ball") devuelve la entidad
  And se emite un evento entityCreated con id "test:room/ball"

Scenario: update comparte las referencias de los componentes no tocados
  Given una entidad con los componentes transform y sprite
  When se actualiza solo transform.x
  Then se emite entityChanged para esa entidad
  And la referencia del componente sprite es la misma que antes del update

Scenario: los eventos de una transacción se emiten juntos al final
  Given un listener del EventBus
  When dentro de una transacción se actualizan 3 entidades
  Then el listener no recibe nada mientras la transacción está en curso
  And al terminar recibe los 3 entityChanged en el orden en que ocurrieron

Scenario: una transacción que falla no deja rastro
  Given una entidad con transform.x = 100
  When una transacción cambia transform.x a 500 y después lanza una excepción
  Then transform.x sigue valiendo 100
  And no se emite ningún evento

Scenario: mover una entidad actualiza la location y los índices
  Given un contenedor "test:room/box" y un objeto "test:room/ball" en la escena
  When LocationService mueve "test:room/ball" al contenedor en el slot 0
  Then la location de la pelota es { kind: "container", containerId: "test:room/box", slot: 0 }
  And world.index.inContainer("test:room/box")[0] es "test:room/ball"
  And se emite entityMoved con from { kind: "scene" } y to { kind: "container" }

Scenario: no se permite ocupar un slot ocupado
  Given el slot 0 de "test:room/box" ya está ocupado
  When se intenta mover otro objeto al slot 0 en modo desarrollo
  Then se lanza un error de invariante que nombra el contenedor y el slot
  And en modo producción la operación se rechaza, el objeto queda donde estaba y se registra logger.warn

Scenario: un componente desconocido es un error de validación
  When se crea una entidad con un componente "flying"
  Then la creación falla con un error de validación que nombra "flying"

Scenario: un comando desconocido no lanza excepción
  When se despacha el comando { type: "fly" }
  Then dispatch devuelve { ok: false, reason: "unknownCommand" }

Scenario: los IDs de runtime son deterministas
  Given dos motores creados con el mismo clock y la misma semilla de random
  When cada uno crea una entidad de runtime
  Then ambas entidades tienen el mismo id con prefijo "rt_"
```

### Casos límite
- `update` sobre una entidad inexistente: en dev, error; en producción, no-op con `logger.warn`.
- `remove` de un contenedor con objetos dentro: la HU que implemente contenedores (HU-GAME-035) define qué pasa con su contenido. Aquí el invariante detecta los huérfanos.
- `query` sin filtros devuelve todas las entidades cargadas (escena activa + globales), nunca las de otras escenas ([GAME_ENGINE §3](../../architecture/GAME_ENGINE.md)).
- Location `limbo`: válida, pero la entidad no se renderiza ni se guarda ([ECS §4](../../architecture/ECS.md)).

### Dependencias
- HU-GAME-001: estructura de carpetas y zod.
- HU-GAME-002: harness y fixtures para probar.

### Consideraciones técnicas
- Documentos: [ECS](../../architecture/ECS.md), [GAME_ENGINE §2-§8](../../architecture/GAME_ENGINE.md), [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md).
- [NEEDED NOW] World, ComponentRegistry, EventBus, CommandBus/dispatch, LocationService, ULID propio (unas 20 líneas, sin dependencia; ver ENTITY_SCHEMA §2).
- [DESIGNED FOR LATER] `TimeSystem` a 1 Hz ([ECS §1](../../architecture/ECS.md)).
- [NOT NEEDED YET] librería ECS externa o ECS por arquetipos ([ADR-003](../../decisions/ADR-003-ECS.md)).
- Restricciones: sin imports de React/RN/Skia/Expo; sin lógica por `prefabId`; los componentes guardan claves, nunca objetos vivos ([ECS §7](../../architecture/ECS.md)).

### Assets necesarios
- Ninguno.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] World, EventBus, dispatch, LocationService y ComponentRegistry con los 10 componentes base.
- [ ] Tests unitarios de cada escenario; `createTestGame` conectado al World real.
- [ ] Invariantes con comportamiento distinto en dev y en producción, ambos probados.
- [ ] ENTITY_SCHEMA y ECS actualizados si la implementación revela un hueco.

---

## HU-GAME-004 — GameFacade: puente UI ↔ motor

> **Status:** Draft
> **Epic:** EPIC-001 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-001 — Game Foundation

### Prioridad
Must · P0

### Historia
Como **desarrollador**
quiero **un `GameFacade` con comandos, suscripciones granulares y hooks de React**
para **que la UI y el render lean el estado del juego y envíen intenciones sin conocer el motor y sin re-renders innecesarios**.

### Contexto
La UI solo habla con el motor a través del `GameFacade` ([ARCHITECTURE §6](../../architecture/ARCHITECTURE.md), invariante 7). La interfaz está en [GAME_ENGINE §6](../../architecture/GAME_ENGINE.md): `dispatch`, `subscribe`, `subscribeEntity`, `getSnapshot`, `selectors` y `events`. Los hooks usan `useSyncExternalStore`, sin librería de estado externa ([ADR-009](../../decisions/ADR-009-STATE-AND-THREADING.md)). El render necesita que cada entidad re-renderice **solo** cuando cambia ella ([PERFORMANCE §4](../../architecture/PERFORMANCE.md), regla 2).

### Reglas de negocio
- **R1 — Ubicación.** El facade, el contexto React y los hooks viven en `src/game/`. `src/ui` y `src/app` importan solo de `src/game` (regla de lint de HU-GAME-001).
- **R2 — Una instancia.** La app crea **un** `GameEngine` y lo expone con un `GameProvider` (contexto React). No hay singletons de módulo ([GAME_ENGINE §2](../../architecture/GAME_ENGINE.md)).
- **R3 — `dispatch(cmd)`** es la única vía de escritura y devuelve `CommandResult`. Nunca lanza excepciones hacia la UI.
- **R4 — `subscribeEntity(id, listener)`** notifica solo cuando esa entidad cambia (`entityChanged`, `entityMoved`, `entityRemoved` con ese `id`). Se notifica **una vez por transacción**, aunque la entidad cambie varias veces dentro de ella.
- **R5 — `subscribe(listener)`** notifica una vez por transacción que cambie algo.
- **R6 — `getSnapshot()`** devuelve la **misma referencia** mientras no haya cambios, para que `useSyncExternalStore` no provoque renders de más.
- **R7 — Selectores.** Esta HU implementa `visibleEntities(viewport)` con la forma `EntityRenderData` (id, asset resuelto, capa, clave de orden, transform). Los demás selectores de GAME_ENGINE §6 los añaden sus HU: `activeZone()` (HU-GAME-012), `inventorySlots`, `wallet`, `settings`, `characters`, `characterLayers`.
- **R8 — Hooks** en `src/game/hooks`: `useEntity(id)` y `useVisibleEntities()`. Los demás los añaden sus HU: `useT()` (HU-GAME-068), `useWallet`, `useInventory`, `useSettings`.
- **R9 — Eventos para adaptadores.** `facade.events` expone el EventBus para audio y efectos. La UI no se suscribe a eventos para leer estado; usa selectores.

### Criterios de aceptación
```gherkin
Scenario: la suscripción por entidad es granular
  Given dos entidades A y B y un listener suscrito con subscribeEntity(A)
  When cambia la entidad B
  Then el listener de A no se llama

Scenario: una notificación por transacción
  Given un listener suscrito con subscribeEntity(A)
  When dentro de una transacción la entidad A cambia 3 veces
  Then el listener de A se llama exactamente 1 vez

Scenario: snapshot estable sin cambios
  Given un facade sin cambios pendientes
  When se llama a getSnapshot() dos veces
  Then ambas llamadas devuelven la misma referencia

Scenario: un comando inválido llega a la UI como resultado, no como excepción
  When la UI despacha dragStart con un entityId que no existe
  Then dispatch devuelve { ok: false, reason: "entityNotFound" }
  And no se lanza ninguna excepción

Scenario: useEntity solo re-renderiza su entidad
  Given dos componentes de prueba que usan useEntity(A) y useEntity(B)
  When cambia la entidad A
  Then solo se vuelve a renderizar el componente de A

Scenario: al desmontar se cancelan las suscripciones
  Given un componente montado que usa useEntity(A)
  When se desmonta
  Then el número de listeners de A vuelve a 0

Scenario: visibleEntities devuelve datos listos para el render
  Given una escena con 3 entidades en location scene y 1 dentro de un contenedor
  When se llama a selectors.visibleEntities con un viewport que cubre toda la escena
  Then devuelve las 3 entidades de la escena con su asset, su capa y su clave de orden
  And no incluye la entidad del contenedor
```

### Casos límite
- La entidad se elimina mientras un componente la observa: `useEntity` devuelve `undefined` y el componente no dibuja nada, sin error.
- Suscripción a un `id` inexistente: se acepta y se notifica si la entidad aparece más tarde.
- Varias llamadas a `dispatch` dentro de un listener: se encolan y se procesan después del comando actual (propuesta), para mantener el orden determinista.

### Dependencias
- HU-GAME-003: World, EventBus y dispatch.

### Consideraciones técnicas
- Documentos: [GAME_ENGINE §6](../../architecture/GAME_ENGINE.md), [ARCHITECTURE §2](../../architecture/ARCHITECTURE.md), [PERFORMANCE §4](../../architecture/PERFORMANCE.md).
- [NEEDED NOW] facade, `GameProvider`, `useEntity`, `useVisibleEntities`.
- [NOT NEEDED YET] Redux, Zustand u otra librería de estado.
- Para probar hooks hace falta un renderer de pruebas de React en el proyecto `app` de Jest. Si se añade `@testing-library/react-native`, se justifica en esta HU (propuesta).
- Restricción: el facade no contiene lógica de juego; solo traduce y enruta.

### Assets necesarios
- Ninguno.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Facade, contexto y hooks en `src/game/` con tests de granularidad y de estabilidad del snapshot.
- [ ] Ningún archivo de `src/ui` o `src/app` importa `src/engine/core` (lint en verde).
- [ ] GAME_ENGINE §6 actualizado si cambian las firmas.
