# EPIC-002 — Rendering Engine

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 0 (HU-GAME-008 y HU-GAME-009 en Fase 1)
> **Docs:** [RENDERING](../../architecture/RENDERING.md) · [INPUT_SYSTEM](../../architecture/INPUT_SYSTEM.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [SCENE_SCHEMA](../../data/SCENE_SCHEMA.md) · [GAME_ENGINE](../../architecture/GAME_ENGINE.md)

## Objetivo del epic
Dibujar el mundo con React Native Skia en coordenadas virtuales (altura fija de 1080 unidades, ancho variable), con capas semánticas y orden z, una cámara horizontal con paneo e inercia, culling por viewport con fondos en chunks y tweens de presentación. El drag, el paneo y los tweens viven en el UI thread y no provocan re-renders de React por frame.

## Estado de implementación (2026-09-18)

| HU | Estado | Notas |
|---|---|---|
| 005 | In Progress | `computeViewport` y `screenToWorld` puros con tests; `SceneCanvas` con grupo de escala y grupo de cámara (SharedValue); recálculo por `onLayout`; `DebugGrid` en dev. **Pendiente:** verificación manual (rejilla, notch, tablet) y el spike Skia + Reanimated + React Compiler en dispositivo (OQ-10: el lint obliga a usar `.get()`/`.set()` en SharedValues). |
| 006 | In Progress | Orden de render puro (`engine/scene/render-order.ts`) con tests de cada regla; `SpriteNode` + `EntityNode` suscrito por id; `AssetRegistry` (en dev lanza con asset inexistente; en prod avisa una vez). `supportOf` es un punto de extensión (llega con HU-GAME-028). **Pendiente:** manual y profiler. |
| 007 | In Progress | Límites y `jumpTo` puros con tests; paneo de un dedo con `minDistance(6)` e inercia `withDecay` limitada; `cameraSettled { cameraX, viewportW }` una vez por gesto. El hook `resolveTarget` decide paneo frente a entidad; hasta HU-GAME-026 todo toque es paneo. **Pendiente:** manual y FPS. |
| 008 | In Progress | Culling con margen del 25 % y umbral del 10 % (solo cruza a JS al superar el umbral); chunks visibles con parallax; `TextureCache` LRU con fijado por escena y `TextureStore` con carga deduplicada. **Pendiente:** medición de estrés en release. |
| 009 | In Progress | `presetFor`, `VisualEffects.trigger/rejected` (evento `visualEffect`, sin cambiar estado ni snapshot); tweens de los 6 presets en el UI thread (≤ 400 ms). **Pendiente:** verificación manual desde el sandbox (botón "Presets"). |

**Sandbox de verificación:** pantalla `src/app/dev-render.tsx` (solo `__DEV__`), accesible desde el título. Usa `content/sandbox/` (49 entidades en 7680 unidades, placeholders CC0 de Kenney en PNG; la conversión a WebP queda para el pipeline de HU-GAME-068).

## Historias
- [HU-GAME-005 — Canvas Skia con resolución virtual](#hu-game-005--canvas-skia-con-resolución-virtual)
- [HU-GAME-006 — Renderizar entidades por capas y orden z](#hu-game-006--renderizar-entidades-por-capas-y-orden-z)
- [HU-GAME-007 — Cámara horizontal con paneo](#hu-game-007--cámara-horizontal-con-paneo)
- [HU-GAME-008 — Culling y carga de fondos por chunks](#hu-game-008--culling-y-carga-de-fondos-por-chunks)
- [HU-GAME-009 — Tweens y animaciones simples](#hu-game-009--tweens-y-animaciones-simples)

---

## HU-GAME-005 — Canvas Skia con resolución virtual

> **Status:** Draft
> **Epic:** EPIC-002 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-002 — Rendering Engine

### Prioridad
Must · P0

### Historia
Como **diseñador de contenido**
quiero **que el mundo se dibuje en una Canvas con altura virtual fija de 1080 unidades y ancho variable**
para **colocar objetos con las mismas coordenadas en cualquier teléfono o tablet sin barras negras**.

### Contexto
[ADR-007](../../decisions/ADR-007-VIRTUAL-COORDINATES.md) y [RENDERING §2](../../architecture/RENDERING.md) fijan la altura en 1080 world units y dejan que el ancho visible varíe: unas 2340 unidades en un iPhone de ~19.5:9, unas 2400 en Android 20:9 y unas 1440 en iPad 4:3. Los píxeles de pantalla solo existen en los adaptadores de render e input ([ARCHITECTURE §6](../../architecture/ARCHITECTURE.md), invariante 5). La HUD son Views de RN encima de la Canvas ([RENDERING §1](../../architecture/RENDERING.md)).

Esta HU también es el **spike técnico** de Skia en el proyecto: comprueba que Skia, Reanimated 4.5 y el React Compiler conviven.

### Reglas de negocio
- **R1 — Una Canvas** a pantalla completa por escena, en `src/engine/adapters/render/` (p. ej. `SceneCanvas`).
- **R2 — Escala:** `scale = canvasHeightDp / 1080` y `viewportW = canvasWidthDp / scale`. La transformación raíz de la Canvas es `scale(scale)` ([RENDERING §2.2](../../architecture/RENDERING.md)).
- **R3 — Árbol de render** según [RENDERING §3](../../architecture/RENDERING.md): `Group(scale)` → `Group(translateX: -cameraX)` → fondos → capas → `DragProxy` → `Effects`. En esta HU `cameraX` es un SharedValue fijo en 0 (la cámara es HU-GAME-007).
- **R4 — Conversión de coordenadas** en funciones puras del adaptador de input: `worldX = touchXdp / scale + cameraX` y `worldY = touchYdp / scale` ([INPUT_SYSTEM §4](../../architecture/INPUT_SYSTEM.md)). Nada fuera de `adapters/input` y `adapters/render` conoce dp o px.
- **R5 — Safe areas (propuesta):** la Canvas ocupa toda la ventana, incluida la zona del notch; la HUD se coloca dentro del safe area. Regla de diseño: todo lo importante de una zona cabe en 1440 unidades de ancho ([RENDERING §2.1](../../architecture/RENDERING.md)).
- **R6 — Cambios de tamaño** (rotación entre los dos landscape, ventanas en tablet, plegables): se recalculan `scale` y `viewportW` sin reconstruir el World ni perder la cámara.
- **R7 — Assets a 1×:** un sprite de 200 px mide 200 unidades ([RENDERING §2.2](../../architecture/RENDERING.md)).
- **R8 — Rejilla de depuración** (solo `__DEV__`, propuesta): líneas cada 120 unidades y un marco de 0..1080 en vertical, para verificar la escala a simple vista.

### Criterios de aceptación
```gherkin
Scenario: escala y viewport en un iPhone en landscape
  Given una Canvas de 844 × 390 dp
  When se calculan scale y viewportW
  Then scale es 390 / 1080 ≈ 0,3611
  And viewportW ≈ 2337 world units

Scenario: escala y viewport en una tablet 4:3
  Given una Canvas de 1024 × 768 dp
  When se calculan scale y viewportW
  Then scale ≈ 0,7111
  And viewportW = 1440 world units

Scenario: conversión de un toque a coordenadas del mundo
  Given scale = 0,5 y cameraX = 1000
  When se convierte el punto de pantalla (300 dp, 480 dp)
  Then el punto del mundo es (1600, 960)

Scenario: recálculo al cambiar el tamaño de la Canvas
  Given una Canvas de 844 × 390 dp con un World cargado
  When el layout cambia a 800 × 360 dp
  Then viewportW pasa a 2400 world units
  And el World conserva todas sus entidades sin recrearse

@manual
Scenario: la altura virtual llena la pantalla
  Given la rejilla de depuración activa en un teléfono y en una tablet 4:3
  When se abre la escena de prueba
  Then el marco de 0 a 1080 unidades ocupa exactamente el alto de la Canvas en ambos
  And no aparecen barras negras arriba, abajo ni a los lados
  # Pasos: activar la rejilla, hacer captura en cada dispositivo, comprobar que la línea y = 1080 coincide con el borde inferior.

@manual
Scenario: HUD dentro del safe area
  Given un iPhone con notch en landscape
  When se muestra un botón de prueba de la HUD en la esquina superior izquierda
  Then el botón no queda debajo del notch
  And la Canvas sí se dibuja detrás del notch
```

### Casos límite
- Aspectos extremos (21:9 o más): `viewportW` supera 2560 unidades; el mundo simplemente continúa. Si la escena es más estrecha que el viewport, lo resuelve la cámara (HU-GAME-007).
- React Compiler: si memoiza de forma incorrecta componentes con SharedValues o worklets, se desactiva y se documenta en [ADR-001](../../decisions/ADR-001-TECH-STACK.md) (OQ-10).
- Densidades altas en tablet (`PixelRatio × canvasHeightDp > 1600`): las variantes `@2x` son [DESIGNED FOR LATER]; el MVP escala los assets 1×.

### Dependencias
- HU-GAME-001: Skia instalado y app en landscape.

### Consideraciones técnicas
- Documentos: [RENDERING §1-§3](../../architecture/RENDERING.md), [INPUT_SYSTEM §4](../../architecture/INPUT_SYSTEM.md), [ADR-007](../../decisions/ADR-007-VIRTUAL-COORDINATES.md).
- [NEEDED NOW] Canvas, escala, conversión de coordenadas, recálculo por layout.
- [DESIGNED FOR LATER] zoom con pinch (`<Group scale={zoom}>`, HU-GAME-109); assets `@2x`.
- Restricción: `scale`, `viewportW` y la conversión son funciones puras probables sin Skia; el componente Canvas solo las usa.

### Assets necesarios
- Ninguno obligatorio. Un fondo placeholder de 1920 × 1080 para la verificación visual, copiado desde `assets/vendor/` (raíz del repo) a `content/core/assets/images/` (placeholder aceptable: sí; Kenney *Background Elements Remastered*, CC0).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Funciones de escala y conversión con tests unitarios (teléfono, 20:9, 4:3).
- [ ] Canvas visible en Android, iOS y tablet 4:3 con la verificación manual anotada.
- [ ] Resultado del spike Skia + Reanimated + React Compiler anotado en la HU.

---

## HU-GAME-006 — Renderizar entidades por capas y orden z

> **Status:** Draft
> **Epic:** EPIC-002 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-002 — Rendering Engine

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **ver los muebles, los objetos y los personajes dibujados unos delante de otros de forma lógica**
para **entender la escena como una casa de muñecas de verdad**.

### Contexto
El orden de dibujo se define por capas semánticas (`sprite.layer`) y, dentro de cada capa, por `z` o por `transform.y` ([RENDERING §4](../../architecture/RENDERING.md)). Cada entidad es un componente memoizado `EntitySprite({ id })` suscrito solo a su entidad ([RENDERING §3](../../architecture/RENDERING.md)). El orden se calcula en un selector puro del facade (`visibleEntities`, HU-GAME-004), así se prueba sin Skia.

### Reglas de negocio
- **R1 — Orden de capas** (de atrás hacia delante): `background` → `wallDecor` → `furnitureBack` → `furniture` → `props` → `characters` → `foreground` → `DragProxy` → `Effects`.
- **R2 — Orden dentro de cada capa** ([RENDERING §4](../../architecture/RENDERING.md)). `sprite.z` vale 0 por defecto:
  - `wallDecor`: por `z`; empates por `transform.x` y luego por `id`;
  - `furnitureBack`, `foreground`: por `z`;
  - `furniture`: por `z`; empates por `transform.y` (más abajo en pantalla = delante);
  - `props`: por `transform.y`; si empatan, por el `z` de la superficie + 1;
  - `characters`: por `transform.y` (sentado: `z` del asiento + 1; lo completa HU-GAME-045).
  - Si aún quedan empates, desempate final estable por `id` (propuesta), para que el orden sea determinista.
- **R3 — Regla de apoyo:** un objeto apoyado se dibuja por encima del mueble que lo sostiene: `max(z propio, z del mueble + 1)`. El mueble se obtiene de `world.index.supportOf(id)`, que crea el SurfaceSystem en HU-GAME-028; esta HU deja el punto de extensión en la clave de orden.
- **R4 — Qué se dibuja:** solo entidades con `sprite` y `location.kind === 'scene'` de la escena activa. Las que están en contenedor, mochila, mano o vestidas no se dibujan como entidades sueltas ([ENTITY_SCHEMA §5.1](../../data/ENTITY_SCHEMA.md)).
- **R5 — Geometría del sprite:** `pivot` por defecto `{ x: 0.5, y: 1 }` (centro inferior); `size` por defecto el tamaño nativo del asset; se aplican `flipX`, `scale` y `rotation` de `transform`.
- **R6 — Resolución de assets:** por clave (`AssetKey`) con el AssetLoader del adaptador de render, nunca por ruta. El mapa lo genera HU-GAME-068; mientras tanto se usa un mapa de prueba.
- **R7 — Asset inexistente:** en dev, error claro con la clave; en producción, la entidad no se dibuja y se registra `logger.warn`. El juego nunca se cierra.
- **R8 — Suscripción granular:** cambiar una entidad re-renderiza solo su `EntitySprite` ([PERFORMANCE §4](../../architecture/PERFORMANCE.md), regla 2).
- **R9 — Fondos:** los `scene.background.layers` se dibujan en la capa `background` en el orden de `layers[]`, con todos sus chunks. El culling de chunks es HU-GAME-008.
- **R10 — Fuera de alcance:** `sprite.byState` (HU-GAME-025), `sprite.tint` (se implementa con el teñido del personaje, HU-GAME-013) y la animación del DragProxy (HU-GAME-027).

### Criterios de aceptación
```gherkin
Scenario: las capas se dibujan en orden semántico
  Given una entidad en "props" y otra en "furniture" en el mismo punto
  When se calcula el orden de render
  Then la entidad de "furniture" va antes que la de "props"

Scenario: en la capa furniture, a igual z manda la y
  Given dos muebles sin z declarada (z = 0), A con transform.y 900 y B con transform.y 960
  When se calcula el orden de render
  Then A se dibuja antes que B

Scenario: en la capa wallDecor, a igual z manda la x
  Given dos cuadros con z = 0, A con transform.x 1200 y B con transform.x 800
  When se calcula el orden de render
  Then B se dibuja antes que A

Scenario: en la capa furniture la z tiene prioridad
  Given un mueble A con z 5 y transform.y 960 y un mueble B con z 1 y transform.y 900
  When se calcula el orden de render
  Then B se dibuja antes que A

Scenario: solo se dibujan entidades en la escena activa
  Given una entidad en location scene y otra en location container
  When se calcula visibleEntities
  Then solo aparece la entidad de la escena

Scenario: cambiar una entidad no re-renderiza las demás
  Given 20 entidades montadas en la Canvas
  When cambia transform.x de una de ellas
  Then solo se vuelve a renderizar el EntitySprite de esa entidad

Scenario: asset inexistente en producción
  Given una entidad cuyo sprite.asset no existe en el manifest
  When se renderiza en modo producción
  Then la entidad no se dibuja
  And se registra un logger.warn con la clave del asset
  And las demás entidades se dibujan con normalidad

@manual
Scenario: escena de prueba con profundidad correcta
  Given la escena placeholder con una mesa, una manzana sobre la mesa y una pelota en el suelo delante
  When se abre en el dispositivo
  Then la manzana se ve encima de la mesa y la pelota delante de la mesa
```

### Casos límite
- Dos props con la misma `y` y sin superficie: desempate por `id` (R2).
- `transform.scale` fuera de `0.25..4`: lo rechaza el schema (HU-GAME-003); no llega al render.
- Muchas entidades cambian a la vez (carga de escena): un único render por transacción ([GAME_ENGINE §5](../../architecture/GAME_ENGINE.md)).

### Dependencias
- HU-GAME-003: World y eventos.
- HU-GAME-005: Canvas y escala.

### Consideraciones técnicas
- Documentos: [RENDERING §3, §4, §6](../../architecture/RENDERING.md), [ENTITY_SCHEMA §5.2](../../data/ENTITY_SCHEMA.md), [GAME_ENGINE §6](../../architecture/GAME_ENGINE.md).
- [NEEDED NOW] capas, orden, `EntitySprite`, AssetLoader básico (carga por clave).
- [DESIGNED FOR LATER] atlas con `drawAtlas` si lo exigen las mediciones ([ARCHITECTURE §7](../../architecture/ARCHITECTURE.md)).
- Restricción: el cálculo de orden está en el selector puro, no en componentes React; sin `if` por prefab.
- Afecta al render: medir con el overlay (HU-GAME-071) cuando exista y anotar el resultado.

### Assets necesarios
- `test_env_table`, `test_obj_apple`, `test_obj_ball`: sprites de prueba (placeholder aceptable: sí; Glitch Items o Kenney, CC0, marcados `placeholder: true`).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Selector de orden con tests unitarios de cada regla de R2.
- [ ] Test de granularidad de re-render.
- [ ] Verificación manual en Android e iOS anotada.
- [ ] Sin re-renders de React por frame (comprobado con el profiler).

---

## HU-GAME-007 — Cámara horizontal con paneo

> **Status:** Draft
> **Epic:** EPIC-002 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-002 — Rendering Engine

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **deslizar el dedo sobre el fondo para recorrer la casa de lado a lado**
para **explorar todas las habitaciones sin menús**.

### Contexto
La cámara es un `cameraX` (SharedValue) por escena, limitado a los `bounds` de la escena, con paneo de un dedo sobre el fondo e inercia con `withDecay` ([RENDERING §5](../../architecture/RENDERING.md)). El paneo y el drag de entidades se deciden en el primer hit test y nunca cambian a mitad del gesto ([INPUT_SYSTEM §6](../../architecture/INPUT_SYSTEM.md)). La casa mide 7680 unidades ([SCENE_SCHEMA §5](../../data/SCENE_SCHEMA.md)).

### Reglas de negocio
- **R1 — Límites:** `cameraX ∈ [bounds.minX, bounds.maxX − viewportW]`; `bounds` por defecto `0..scene.size.width` ([SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md)).
- **R2 — Escena más estrecha que el viewport (propuesta):** si `bounds.maxX − bounds.minX < viewportW`, la cámara queda fija y la escena se centra.
- **R3 — Paneo:** un solo dedo que empieza sobre el fondo, sobre una entidad transparente al input o sobre una entidad **no** arrastrable, y se mueve **≥ 6 dp** ([INPUT_SYSTEM §2](../../architecture/INPUT_SYSTEM.md)). Solo cuenta el componente horizontal. Una vez empezado el paneo, el gesto ya no puede ser tap.
- **R4 — Inercia:** al soltar, `withDecay` con la velocidad del gesto, limitado a los bounds.
- **R5 — Sin React por frame:** el paneo actualiza `cameraX` en el UI thread; no hay `setState` ni cruce a JS por frame ([PERFORMANCE §4](../../architecture/PERFORMANCE.md), regla 1).
- **R6 — Sincronización con el motor:** al terminar el paneo y su inercia se despacha **una vez** el comando `cameraSettled { cameraX }` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)), que actualiza `player.cameraX` (guardado en HU-GAME-052) y la zona activa (HU-GAME-012). Nunca se envía por frame.
- **R7 — Saltar a una x:** API `jumpTo(x)` con `withTiming` de 450 ms hacia `x − viewportW / 2`, limitada a los bounds ([RENDERING §5](../../architecture/RENDERING.md)); al terminar despacha `cameraSettled`. La usan las zonas (HU-GAME-012) y el mapa (HU-GAME-051).
- **R8 — Un solo puntero:** un segundo dedo se ignora ([INPUT_SYSTEM §2](../../architecture/INPUT_SYSTEM.md)).
- **R9 — Cambio de viewport:** si cambia `viewportW` (HU-GAME-005, R6), `cameraX` se vuelve a limitar a los nuevos bounds.
- **R10 — Posición inicial:** la fija el SceneService al entrar en la escena (HU-GAME-010); esta HU solo expone en el adaptador de render una función para colocar la cámara (limitada a los bounds).

### Criterios de aceptación
```gherkin
Scenario: la cámara no sale de los límites por la derecha
  Given la escena "test:room" de 3840 unidades y viewportW = 2338
  When se pide mover la cámara a x = 3000
  Then cameraX queda en 1502

Scenario: la cámara no sale de los límites por la izquierda
  Given la misma escena
  When se pide mover la cámara a x = -200
  Then cameraX queda en 0

Scenario: escena más estrecha que el viewport
  Given una escena de 1200 unidades y viewportW = 1440
  When se calcula la posición de la cámara
  Then la cámara queda fija y la escena se dibuja centrada

Scenario: saltar a una x
  Given la escena "core:home" de 7680 unidades, viewportW = 2338 y cameraX = 0
  When se llama a jumpTo(2880)
  Then la cámara termina en 1711 tras 450 ms

Scenario: el fin del paneo actualiza el motor una sola vez
  Given un paneo con inercia que termina con cameraX = 1234
  When la inercia se detiene
  Then se despacha exactamente un comando cameraSettled { cameraX: 1234 }
  And player.cameraX vale 1234

Scenario: cameraSettled limita a los bounds
  Given la escena "test:room" de 3840 unidades y viewportW = 2338
  When se despacha cameraSettled { cameraX: 5000 }
  Then player.cameraX vale 1502

Scenario: un toque sobre una entidad arrastrable no mueve la cámara
  Given una entidad draggable bajo el dedo
  When el dedo se mueve 200 dp en horizontal
  Then se arrastra la entidad y cameraX no cambia

@manual
Scenario: paneo con inercia
  Given la escena "core:home" abierta en un teléfono
  When el jugador desliza rápido el dedo sobre el fondo hacia la izquierda y lo levanta
  Then la cámara sigue deslizándose y se frena de forma suave
  And se detiene como mucho en el borde derecho de la escena, sin rebotar fuera

@manual
Scenario: el paneo no re-renderiza React
  Given el profiler de React activo
  When el jugador hace paneo durante 5 segundos
  Then no se registran renders de componentes de entidades durante el gesto

@performance @manual
Scenario: fluidez del paneo
  Incluye: AC-PERF-01
```

### Casos límite
- Toque que empieza en los 16 dp del borde de la pantalla: el paneo se permite (el margen de [INPUT_SYSTEM §6](../../architecture/INPUT_SYSTEM.md) solo impide empezar un drag).
- Toque sobre el fondo que se mueve menos de 6 dp y dura < 250 ms: es tap, no mueve la cámara.
- Toque que empieza sobre decoración transparente al input ([INPUT_SYSTEM §5](../../architecture/INPUT_SYSTEM.md), punto 3): cuenta como fondo y puede hacer paneo.
- Rotación entre landscape izquierdo y derecho durante la inercia: se cancela la inercia y se limita la cámara (R9).
- Cambio de escena durante la inercia: la animación se cancela y la nueva escena fija su propia cámara.

### Dependencias
- HU-GAME-005: Canvas, escala y árbol de render.

### Consideraciones técnicas
- Documentos: [RENDERING §5](../../architecture/RENDERING.md), [INPUT_SYSTEM §2, §3, §6](../../architecture/INPUT_SYSTEM.md), [ADR-009](../../decisions/ADR-009-STATE-AND-THREADING.md).
- [NEEDED NOW] límites, paneo, inercia, `jumpTo`, comando `cameraSettled`.
- [DESIGNED FOR LATER] zoom (HU-GAME-109). El auto-scroll durante el drag es HU-GAME-029.
- Restricción: el cálculo de límites es una función pura con tests; el gesto solo la usa.

### Assets necesarios
- Fondo placeholder de al menos 3840 × 1080 en chunks de 1920 (placeholder aceptable: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Funciones de límites y `jumpTo` con tests unitarios.
- [ ] Verificación manual de paneo e inercia en Android e iOS, con FPS del UI thread anotados.
- [ ] Test en el harness de `cameraSettled` (una vez por gesto, limitado a los bounds).

---

## HU-GAME-008 — Culling y carga de fondos por chunks

> **Status:** Draft
> **Epic:** EPIC-002 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-002 — Rendering Engine

### Prioridad
Should · P1

### Historia
Como **jugador con una tablet barata**
quiero **que la casa entera se recorra con fluidez**
para **jugar sin tirones aunque la escena tenga muchas cosas**.

### Contexto
La casa es una sola escena de 7680 unidades con 4 chunks de fondo y entre 80 y 150 entidades ([SCENE_SCHEMA §5](../../data/SCENE_SCHEMA.md), [PERFORMANCE §2](../../architecture/PERFORMANCE.md)). Dibujar todo siempre supera los presupuestos en el Android de referencia. [RENDERING §6 y §7](../../architecture/RENDERING.md) definen el culling con margen y umbral, los chunks y la caché de texturas.

### Reglas de negocio
- **R1 — Culling de entidades:** se montan solo las entidades cuyo AABB (de `sprite.size`, `pivot` y `transform.scale`) intersecta `[cameraX − margin, cameraX + viewportW + margin]`, con `margin = 25 % de viewportW` ([RENDERING §7](../../architecture/RENDERING.md)).
- **R2 — Umbral:** el conjunto visible solo se recalcula cuando la cámara se ha movido más del **10 % de viewportW** desde el último cálculo. No se recalcula por frame.
- **R3 — Chunks de fondo:** solo se montan los chunks que intersectan viewport + margen. Con `parallax ≠ 1`, la posición en pantalla del chunk se calcula como `chunk.x − cameraX × parallax` ([SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md)).
- **R4 — Tamaño:** cada chunk mide ≤ 2048 px de ancho (recomendado 1920) y cada textura ≤ 2048 × 2048 ([RENDERING §8](../../architecture/RENDERING.md)). Lo garantiza el validador (HU-GAME-069).
- **R5 — Caché de texturas:** LRU por clave con memoria estimada `w × h × 4` bytes. Las imágenes de la escena activa y las globales (personajes y ropa) quedan fijadas; al cambiar de escena se liberan las no fijadas de la anterior ([RENDERING §6](../../architecture/RENDERING.md)). La memoria estimada se expone para el overlay (HU-GAME-071).
- **R6 — Presupuestos** ([PERFORMANCE §2](../../architecture/PERFORMANCE.md)): entidades renderizadas ≤ 120 (target; warning > 180); memoria de texturas ≤ 150 MB (warning > 200 MB); FPS del UI thread 60 (warning < 55 de media en 10 s).
- **R7 — Hit testing:** usa el mismo conjunto visible (HU-GAME-026); una entidad fuera del viewport no se puede tocar.
- **R8 — Momento del recálculo:** además del umbral de R2, el conjunto visible se recalcula al recibir `cameraSettled` (HU-GAME-007).

### Criterios de aceptación
```gherkin
Scenario: se montan las entidades del viewport más el margen
  Given viewportW = 2338 (margin = 584,5) y cameraX = 0
  And una entidad con AABB en x 2800..2900 y otra en x 3100..3200
  When se calcula el conjunto visible
  Then la primera entidad está montada
  And la segunda no

Scenario: no se recalcula por debajo del umbral
  Given un conjunto visible calculado con cameraX = 0 y viewportW = 2338
  When la cámara se mueve a x = 200 (8,6 % del viewport)
  Then no se recalcula el conjunto visible

Scenario: se recalcula al superar el umbral
  Given un conjunto visible calculado con cameraX = 0 y viewportW = 2338
  When la cámara se mueve a x = 250 (10,7 % del viewport)
  Then se recalcula el conjunto visible una vez

Scenario: chunks de fondo montados
  Given la escena "core:home" con chunks en x = 0, 1920, 3840 y 5760 de 1920 de ancho
  And cameraX = 0 y viewportW = 2338
  When se calculan los chunks visibles
  Then se montan los chunks de x = 0 y x = 1920
  And no se montan los de x = 3840 y x = 5760

Scenario: se liberan las texturas no fijadas al cambiar de escena
  Given la escena A con 3 texturas propias en caché y 2 texturas globales fijadas
  When se entra en la escena B
  Then las 3 texturas de A dejan de estar en caché
  And las 2 globales siguen en caché

@performance @manual
Scenario: escenario de estrés de referencia
  Given el Android de referencia con Home, 12 personajes en el salón y 60 objetos visibles
  When se arrastra un objeto de punta a punta con auto-scroll durante 30 s
  Then el overlay no muestra el FPS del UI thread por debajo de 55 de media en 10 s
  And las entidades renderizadas no superan 180
  # Incluye: AC-PERF-01. Medir en release (PERFORMANCE §3).
```

### Casos límite
- Paneo con inercia rápida: el margen del 25 % evita que aparezcan objetos de golpe; si aun así ocurre, se anota y se ajusta el margen con un cambio en RENDERING.
- Entidad arrastrada fuera del viewport (con auto-scroll): el DragProxy se dibuja siempre, aunque la entidad original esté fuera del conjunto visible.
- Entidades muy anchas (una alfombra de 2000 unidades): se montan si **cualquier** parte de su AABB intersecta.

### Dependencias
- HU-GAME-006: render por capas.
- HU-GAME-007: cámara.

### Consideraciones técnicas
- Documentos: [RENDERING §6-§8](../../architecture/RENDERING.md), [PERFORMANCE §2-§5](../../architecture/PERFORMANCE.md).
- [NEEDED NOW] culling con umbral, chunks, caché LRU con fijado.
- La precarga completa al entrar en una escena (con timeout de 1,5 s) es HU-GAME-050; esta HU se queda la caché LRU.
- [DESIGNED FOR LATER] precarga de la escena destino al acercarse a un portal ([PERFORMANCE §5](../../architecture/PERFORMANCE.md)); `drawAtlas`.
- Restricción: el cálculo del conjunto visible es una función pura del motor (sin Skia); el adaptador solo lo consume.

### Assets necesarios
- Fondo placeholder de 7680 × 1080 en 4 chunks de 1920 (placeholder aceptable: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests unitarios de culling, umbral, chunks y caché.
- [ ] Medición del escenario de estrés en release en el Android de referencia, con los valores anotados en la HU.
- [ ] Sin re-renders de React por frame durante el paneo.

---

## HU-GAME-009 — Tweens y animaciones simples

> **Status:** Draft
> **Epic:** EPIC-002 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-002 — Rendering Engine

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **que los objetos reboten, se aplasten o se muevan un poco cuando los toco o los suelto**
para **sentir que el mundo reacciona a lo que hago, sin necesidad de leer**.

### Contexto
El componente `animations` asocia eventos (`idle`, `tap`, `pickup`, `drop`, `use`, `open`, `close`) a presets visuales (`bounce`, `wiggle`, `squash`, `pulse`, `shake`, `spin`) ([ENTITY_SCHEMA §5.7c](../../data/ENTITY_SCHEMA.md)). El motor emite `visualEffect { entityId, preset }` ([GAME_ENGINE §5](../../architecture/GAME_ENGINE.md)) y el render aplica el tween con SharedValues que se crean al dispararse y se liberan al terminar ([RENDERING §9](../../architecture/RENDERING.md)). Es solo presentación: no cambia la lógica ni se guarda.

### Reglas de negocio
- **R1 — Presets v1:** `bounce`, `wiggle`, `squash`, `pulse`, `shake`, `spin`. Un preset desconocido lo rechaza el schema al cargar el contenido.
- **R2 — Origen:** el motor emite `visualEffect` al ocurrir el evento correspondiente si la entidad tiene `animations[evento]`. La función que decide el preset (`presetFor(entity, evento)`) es pura y está en el motor.
- **R3 — Rechazo:** una interacción rechazada emite `visualEffect { preset: "shake" }` sobre el target aunque no tenga `animations` ([AC-REJECT-01](../ACCEPTANCE_CRITERIA.md)).
- **R4 — Ciclo de vida:** los SharedValues del tween se crean al recibir el evento y se liberan al terminar. No hay animaciones permanentes por entidad.
- **R5 — Sin React por frame:** el tween corre en el UI thread.
- **R6 — Duraciones (propuesta):** cada preset dura ≤ 400 ms; la caída al soltar dura ≤ 250 ms y termina en `squash` ([INPUT_SYSTEM §7](../../architecture/INPUT_SYSTEM.md)). Los valores definitivos van en ANIMATION_GUIDELINES.
- **R7 — Sin efecto lógico:** el tween modifica solo la presentación (offset, escala, rotación visual). `transform` en el World no cambia y el hit testing usa la posición lógica.
- **R8 — Reinicio:** si llega un `visualEffect` a una entidad que ya tiene un tween en curso, el tween actual se cancela y empieza el nuevo (propuesta).
- **R9 — Fuera de alcance:** la respiración idle del personaje con reloj compartido (HU-GAME-013/014); animación por frames [DESIGNED FOR LATER]; `reduceMotion` [DESIGNED FOR LATER] (HU-GAME-110).

### Criterios de aceptación
```gherkin
Scenario: el motor elige el preset según el componente animations
  Given una entidad con animations { drop: "squash" }
  When se evalúa presetFor(entidad, "drop")
  Then el resultado es "squash"

Scenario: sin preset para el evento
  Given una entidad con animations { drop: "squash" }
  When se evalúa presetFor(entidad, "tap")
  Then no hay preset y no se emite visualEffect

Scenario: el rechazo siempre sacude el target
  Given una interacción rechazada sobre un target sin componente animations
  When el motor procesa el rechazo
  Then se emite visualEffect { entityId: target, preset: "shake" }

Scenario: el tween no cambia el estado lógico
  Given una entidad con transform { x: 500, y: 960 }
  When se emite visualEffect "bounce" sobre ella
  Then world.get(entidad).components.transform sigue siendo { x: 500, y: 960 }
  And no se marca ninguna entidad como sucia para el guardado

Scenario: preset desconocido en el contenido
  Given un prefab con animations { tap: "explode" }
  When se valida el pack
  Then la validación falla con un error en la ruta /components/animations/tap

@manual
Scenario: los presets se ven y terminan
  Given la escena de prueba con un objeto por preset
  When se dispara cada preset desde el menú de depuración
  Then cada animación dura como mucho 400 ms y el objeto vuelve a su pose exacta
```

### Casos límite
- La entidad se elimina (o se consume) durante el tween: el tween se cancela sin errores.
- Muchos tweens a la vez (12 personajes felices): se crean solo mientras duran; se comprueba en el escenario de estrés de HU-GAME-008.
- `visualEffect` para una entidad fuera del conjunto visible: se ignora.

### Dependencias
- HU-GAME-006: render por capas y `EntitySprite`.

### Consideraciones técnicas
- Documentos: [RENDERING §9](../../architecture/RENDERING.md), [ENTITY_SCHEMA §5.7c](../../data/ENTITY_SCHEMA.md), [GAME_ENGINE §5](../../architecture/GAME_ENGINE.md), ANIMATION_GUIDELINES (pendiente).
- [NEEDED NOW] presets v1 y evento `visualEffect`.
- [DESIGNED FOR LATER] animación por frames (`drawAtlas` o timer); `reduceMotion`.
- [NOT NEEDED YET] shaders personalizados ([RENDERING §8](../../architecture/RENDERING.md)).

### Assets necesarios
- Ninguno.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests unitarios de `presetFor` y del `visualEffect` de rechazo.
- [ ] Verificación manual de los 6 presets en Android e iOS.
- [ ] Duraciones definitivas anotadas en ANIMATION_GUIDELINES.
