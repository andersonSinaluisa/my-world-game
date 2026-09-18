# Rendering

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-002](../decisions/ADR-002-RENDERING.md), [ADR-007](../decisions/ADR-007-VIRTUAL-COORDINATES.md), [ADR-009](../decisions/ADR-009-STATE-AND-THREADING.md)
> **Related Epic:** EPIC-002, EPIC-023
> **Related HU:** HU-GAME-005 a HU-GAME-009, HU-GAME-071

## 1. Tecnología

- **`@shopify/react-native-skia`**: una `<Canvas>` a pantalla completa por escena.
- Las propiedades animadas se enlazan a **SharedValues de Reanimated** (Skia las acepta directamente), así que el drag y los tweens **no re-renderizan React**.
- La UI (HUD, mochila, menús) se dibuja **con Views de RN por encima** de la Canvas, no dentro de Skia.
- **Motivo:** accesibilidad (labels), layout con flexbox y safe areas.

## 2. Resolución virtual

**Decisión: altura fija de 1080 world units y ancho variable** ([ADR-007](../decisions/ADR-007-VIRTUAL-COORDINATES.md)).

```
scale        = screenHeightPx / 1080                // en px físicos o dp, ver §2.2
viewportW    = screenWidthPx / scale                // world units visibles en horizontal
cámara       = x ∈ [bounds.minX, bounds.maxX - viewportW]
```

### 2.1 Por qué no 1920×1080 fijo con letterbox

| Dispositivo | Aspecto | Con 1920×1080 fijo | Con altura fija |
|---|---|---|---|
| iPhone moderno | ~19.5:9 | Barras laterales, o recortes si se escala por ancho | Se ven ~2340 unidades de ancho: más mundo visible |
| Android 20:9 | 20:9 | Igual | ~2400 unidades |
| iPad | 4:3 | Barras arriba y abajo, o escala menor | ~1440 unidades: menos mundo, pero sin barras |

Como el juego **se explora en horizontal**, fijar la altura y dejar que el ancho visible varíe es natural: el mundo simplemente continúa. **Regla de diseño:** todo lo importante de una zona tiene que caber en **1440 unidades** de ancho (el caso iPad). Ver [ENVIRONMENT_GUIDELINES](../design/ENVIRONMENT_GUIDELINES.md).

### 2.2 Unidades y densidad

- Skia trabaja en **dp** (puntos lógicos).
- `scale = canvasHeightDp / 1080`, y la transformación raíz de la Canvas es `scale(scale)`.
- Los assets se exportan a **1× world units**: un sprite de 200 px mide 200 unidades. En un teléfono de 1080 a 1290 px físicos de alto, eso da ~1:1 píxel físico.
- [DESIGNED FOR LATER] **Tablets** (1536 a 2048 px de alto): variantes `@2x` elegidas por el AssetLoader si `PixelRatio × canvasHeightDp > 1600`. Para esto, el manifest de assets ya admite varios `file` por clave en una versión futura.

## 3. Árbol de render

```
<Canvas>
  <Group transform={[{ scale }]}>                           // world units → dp
    <Group transform={[{ translateX: -cameraX }]}>          // SharedValue: paneo sin re-render
      <BackgroundLayers parallax />                         // chunks con culling
      <Layer name="wallDecor" />
      <Layer name="furnitureBack" />
      <Layer name="furniture" />
      <Layer name="props" />
      <Layer name="characters" />                          // personajes (grupos de capas)
      <Layer name="foreground" />                          // marcos de puerta, plantas delanteras
      <DragProxy />                                        // entidad arrastrada, siempre encima
      <Effects />                                          // partículas, highlight
    </Group>
  </Group>
</Canvas>
<HUD />   // RN Views
```

- Cada `<Layer>` renderiza `selectors.visibleEntities(viewport)` filtradas por capa y ordenadas por `z`.
- Cada entidad es un componente memoizado `EntitySprite({ id })` que se suscribe **solo a su entidad** (`useEntity(id)`).

## 4. Capas y orden Z

| Capa (`sprite.layer`) | Uso | Orden dentro de la capa |
|---|---|---|
| `background` | Fondos de escena (no son entidades; vienen de `scene.background`) | Por orden de `layers[]` |
| `wallDecor` | Cuadros, ventanas, estantes de pared | `z` (default 0); empates por `transform.x` y luego por id (estable) |
| `furnitureBack` | Partes traseras de muebles (el interior de la nevera abierta) | `z` |
| `furniture` | Muebles | `z` (default 0); los empates se deciden por `transform.y` (más abajo = delante) |
| `props` | Objetos pequeños | `transform.y`, y si empatan, el `z` de la superficie + 1 |
| `characters` | Personajes | `transform.y` (sentado: `z` del asiento + 1) |
| `foreground` | Elementos delante de todo (marcos de puerta, primer plano) | `z` |

**Mantas de cama** (`bed.coverAsset`): se dibujan en la capa `characters`, **inmediatamente después** del personaje dormido (z del personaje + 0,5). Así lo tapan a él, pero no a lo que esté delante de la cama. Sin personaje dormido, la manta forma parte del sprite de la cama.

**Regla de apoyo:** un objeto apoyado en una superficie se dibuja **por encima** del mueble que la tiene. El render usa `max(z propio, z del mueble + 1)`. Para saber qué mueble lo sostiene:
- **MVP:** un **índice derivado no persistido** (`world.index.supportOf(id)`). Se recalcula al soltar el objeto y al cargar la escena, a partir de la geometría (posición y segmentos).
- **HU-GAME-030 (P2):** si el mueble tiene `surface.carriesItems`, la relación pasa a ser `transform.parentId`, que es persistida y la **única fuente**. El índice derivado se construye a partir de `parentId` y no se duplica.

## 5. Cámara

- Hay un `cameraX` (SharedValue) **por escena**, que se persiste en `player.cameraX` al guardar.
- **Paneo** con un dedo sobre un fondo sin entidad arrastrable (ver [INPUT_SYSTEM](INPUT_SYSTEM.md)). Incluye inercia con `withDecay`, limitada a los `bounds`.
- **Auto-scroll** durante un drag cerca del borde (HU-GAME-029):
  - zona de 12 % del ancho;
  - velocidad proporcional a la profundidad dentro de esa zona;
  - máximo de 1400 unidades por segundo.
- **Saltar a una zona** (mapa o botones de habitación): `withTiming` hacia `zone.snapCameraX - viewportW/2`, en 450 ms.
- [DESIGNED FOR LATER] **Zoom** (pinch): la escala adicional está prevista en el árbol (`<Group scale={zoom}>`), pero el MVP **no** la usa (HU-GAME-109).

## 6. Texturas, carga y caché

- **AssetLoader** (adapter): resuelve `AssetKey → require()/uri` usando `assets.json` y carga con `Skia.Image.MakeImageFromEncoded` / `useImage`.
- **Caché LRU por clave**, con un presupuesto de memoria estimado (ver [PERFORMANCE](PERFORMANCE.md)):
  - se estima el tamaño como `w × h × 4` bytes;
  - las imágenes de la escena activa y las globales (personajes y ropa) quedan **fijadas** (pinned);
  - al cambiar de escena se liberan las no fijadas de la escena anterior.
- **Precarga** al entrar en una escena: fondos visibles, prefabs de la escena y sprites de estado posibles. La transición espera a la precarga, con un timeout de 1,5 s. Lo que falte aparece con un fade cuando esté listo.
- **Formato:** WebP para todo (ver [ASSET_GUIDELINES](../design/ASSET_GUIDELINES.md)).

## 7. Culling

- Se renderizan solo las entidades cuyo AABB intersecta `[cameraX - margin, cameraX + viewportW + margin]`, con `margin = 25 % de viewportW`.
- El margen evita que aparezcan objetos de golpe durante el paneo con inercia.
- El cálculo se hace en JS al cambiar `cameraX`, **con umbral**: solo se recalcula cuando la cámara se ha movido más de 10 % del viewport desde el último cálculo. No se recalcula en cada frame.
- **Fondos por chunks:** solo se montan los chunks que intersectan viewport + margen (HU-GAME-008).

## 8. Límites técnicos

- **Tamaño máximo de textura: 2048 × 2048**. Es el límite seguro para GPUs de gama baja y para la memoria. Los fondos anchos se parten en chunks de ancho ≤ 2048 (recomendado 1920).
- **Sprites de objetos:** normalmente ≤ 512 × 512. Los muebles grandes pueden llegar a ≤ 1024 × 1024.
- **Sin shaders personalizados en el MVP**, salvo el tinte de piel y pelo (ColorMatrix o BlendMode) y el outline del resaltado.

## 9. Animaciones

- **Tweens de presentación** (bounce, squash, wiggle…): SharedValues por entidad. Se crean solo cuando se dispara un `visualEffect` y se liberan al terminar. Presets en [ANIMATION_GUIDELINES](../design/ANIMATION_GUIDELINES.md).
- **Animación por frames** (ciclos cortos: agua del grifo, llama): [DESIGNED FOR LATER] con `drawAtlas` o cambio de sprite por timer. **No hay ninguna en el P0.**
- **Idle del personaje:** un tween de respiración sencillo. Si hay muchos personajes, un **único reloj** (`useClock`) compartido con un desfase por personaje, para no crear N animaciones.

## 10. Qué medir (HU-GAME-071)

FPS del UI thread y del JS thread, número de entidades montadas, memoria estimada de texturas en caché y tiempo de transición entre escenas. Umbrales en [PERFORMANCE](PERFORMANCE.md).
