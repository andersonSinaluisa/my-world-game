# Input System

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-009](../decisions/ADR-009-STATE-AND-THREADING.md)
> **Related Epic:** EPIC-007, EPIC-008
> **Related HU:** HU-GAME-026, HU-GAME-027, HU-GAME-028, HU-GAME-029, HU-GAME-032, HU-GAME-017 · POST-MVP: HU-GAME-101, HU-GAME-109

## 1. Principio

- **Un solo detector de gestos** cubre toda la Canvas del mundo, y el hit testing lo hace el motor en world units. **No** hay un `GestureDetector` por entidad.
- **Motivos:**
  - las entidades no son Views;
  - el orden de apilamiento lo define el motor;
  - con cientos de detectores, el rendimiento y la gestión de conflictos se complican.

## 2. Gestos soportados

| Gesto | Definición | Resultado |
|---|---|---|
| **Tap** | Toque de < 250 ms con movimiento < 10 dp | `pointerTap` → reglas `tap` |
| **Drag de entidad** | Toque sobre una entidad `draggable` y movimiento ≥ 6 dp (**sin espera**) | `dragStart` → proxy → `dragEnd` |
| **Paneo de cámara** | Toque sobre fondo (sin entidad arrastrable) y movimiento ≥ 6 dp | Mueve `cameraX` con inercia. Al terminar la inercia → comando `cameraSettled` |
| **Long press** | ≥ 450 ms sin mover (< 10 dp) **sobre un personaje** | Comando `pointerLongPress` → reglas `longPress` (MVP: solo `unwear_clothes`, HU-GAME-040). Si el resultado trae `startDrag`, el gesto continúa como drag de esa prenda. En otros objetos: [DESIGNED FOR LATER] (información o precio). |
| **Pinch** | Dos dedos | [NOT NEEDED YET] (HU-GAME-109) |
| **Multitouch** | Varios dedos arrastrando entidades distintas a la vez | [DESIGNED FOR LATER] (HU-GAME-101). El MVP sigue **un solo puntero activo**; un segundo dedo se ignora. |

> **Sin long press para empezar a arrastrar.** En tablets infantiles, exigir una espera para arrastrar frustra a los niños pequeños. El drag empieza en cuanto hay movimiento sobre una entidad arrastrable.

## 3. Flujo en threads

```mermaid
sequenceDiagram
  participant G as Gesture (UI thread, worklet)
  participant J as JS thread (GameFacade)
  participant S as Skia (UI thread)
  G->>J: onBegin: scheduleOnRN(pointerDown, worldPoint)
  J->>J: hitTest(worldPoint) → entityId | background
  J-->>G: setea sharedValues: dragEntityId, offset, mode(drag|pan)
  loop onUpdate (60/120 Hz)
    G->>S: dragX/dragY (drag) o cameraX (pan) — sin cruzar a JS
    G->>J: (solo si cambia el target o la zona bajo el dedo) dragPreview
  end
  G->>J: onEnd: dragEnd(entityId, worldPoint, uiTarget?)
  J->>J: resolver + acciones → World
  J-->>S: el entity re-renderiza en su nueva posición; el proxy se oculta
```

- **Previsualización (`dragPreview`):** para no llamar al JS en cada frame, el worklet mantiene los bounds del target de la última previsualización y solo llama al JS cuando el dedo sale de ellos o entra en otra zona. Si el cálculo en el UI thread no es viable, se usa como fallback un muestreo a ≤ 10 Hz.
- **Latencia del primer frame:** el hit test ocurre en JS. Hay 1 o 2 frames de latencia antes de que el objeto "se pegue" al dedo, lo que es aceptable. El proxy arranca con `offset = punto del dedo - posición del pivot`, así que no hay salto visible.
- ⚠️ **Spike de la Fase 0:** medirlo en Android de gama baja. Si molesta, se pasa a una réplica de hitboxes en un SharedValue para hacer el hit test en el UI thread. Ver [ADR-009](../decisions/ADR-009-STATE-AND-THREADING.md).
- **Mientras dura el drag:**
  - la entidad original se oculta y la dibuja el **DragProxy** (siempre encima, con `liftOffset`, ligera escala 1,05 y sombra);
  - el World **no cambia por frame**. Cambia solo en dos momentos: en `dragStart` (transiciones de location: `standUp`, `takeOut` o salir de la mano, ver [INTERACTION_SYSTEM §5](INTERACTION_SYSTEM.md)) y en `dragEnd` (posición final + reglas);
  - `dragCancel` **deshace** las transiciones de `dragStart`: el objeto vuelve a su location y posición originales (la silla, el contenedor o la mano).

## 4. Conversión de coordenadas

```
worldX = (touchXdp / scale) + cameraX
worldY =  touchYdp / scale
```

Se hace en el adaptador de input. **Nada** fuera de `engine/adapters/input` y `render` conoce los dp o los px.

## <a id="hit-testing"></a>5. Hit testing

1. Se recorren las entidades visibles (tras el culling) en **orden inverso al de render**: la más cercana al frente primero.
2. Una entidad es candidata si su forma de `hitbox`, trasladada a su `transform` y **ampliada con `padding`** (12 unidades por defecto), contiene el punto.
3. **Entidades transparentes al input:** una entidad sin `draggable` activo **y** sin ninguna regla `tap`/`longPress` aplicable (decoración pura) **no es candidata**. El toque la atraviesa.
4. Para `dragStart` se elige la primera candidata `draggable.enabled`. Si la primera candidata no es arrastrable pero **tiene reglas `tap`**, el gesto es tap o paneo, no drag de lo que hay detrás.
   - *Ejemplo:* una nevera cerrada tapa la manzana que tiene detrás; tocar ahí toca la nevera.
5. Excepción: **los objetos dentro de un contenedor abierto** son candidatos **antes** que el contenedor. Si no, sería imposible sacarlos.
6. Precisión: el hit testing usa formas geométricas simples, sin alpha de píxel. La transparencia de píxel se evalúa [NOT NEEDED YET].

## 6. Conflictos de gestos

| Conflicto | Resolución |
|---|---|
| Drag de entidad frente a paneo de cámara | Lo decide el **primer** hit test: si hay entidad arrastrable → drag; si no → pan. Nunca cambia a mitad del gesto. |
| Tap frente a drag | Umbral de movimiento de 6 dp y tiempo de 250 ms |
| Gesto del mundo frente a botones del HUD | El HUD son Views de RN **encima** de la Canvas, y sus `Pressable` capturan primero. La mochila es además un **drop target**: el adaptador consulta sus bounds medidos (`onLayout`) en `dragEnd`. |
| Gesto del sistema (back de Android, borde de iOS) | Margen de 16 dp en los bordes, donde no empieza el drag. `predictiveBackGestureEnabled: false` ya está en `app.json`. |
| Segundo dedo durante un drag | Se ignora en el MVP |
| Interrupción (llamada, background) | `onFinalize` sin `onEnd` → `dragCancel` → el objeto vuelve a su posición de origen |

## 7. Soltar objetos: superficies y suelo (HU-GAME-028)

Si el drop no resuelve ninguna regla, se aplica `place`:

1. Se buscan los segmentos de `surface` de las entidades cuya `x` cubre `worldX` y cuya `y` es **≥ worldY − 40**. Las 40 unidades de tolerancia permiten soltar "un poco por debajo" de la mesa.
2. Se elige el segmento **más alto que esté por debajo del punto**, es decir, el primero con el que "caería".
3. Si no hay ninguno, se usa el segmento de `scene.floor` bajo `x`.
4. Se ajusta `transform.y` a esa altura. En presentación, una animación de caída de ≤ 250 ms con `squash` al tocar.
5. `draggable.mode === 'floorOnly'` (muebles) ignora las superficies y va directo al suelo.
6. Se limita `x` a `[0, scene.width]`.
7. **Soporte perdido:** si se mueve o se guarda un mueble y los objetos que tenía encima (`world.index.supportOf`) se quedan sin superficie, esos objetos caen con `place` desde su x actual. Nunca quedan flotando. Con HU-GAME-030, los objetos con `parentId` se mueven con el mueble en lugar de caer.

## 8. Accesibilidad de la entrada

- **Tamaño mínimo de toque en el mundo, medido en dp:** en tiempo de ejecución, el hit testing amplía cada hitbox hasta que mida al menos **`minHitDp = 44 dp`** por eje, convertido a world units con la escala actual. En un teléfono de 360 dp de alto, 44 dp ≈ 132 unidades. Así un objeto pequeño es tocable aunque su `padding` de contenido sea bajo. Si las áreas ampliadas se solapan, gana la entidad más al frente (§5).
- Los **64 dp** son el mínimo para los **botones de la UI** (HUD), no para los objetos del mundo: exigirlos en el mundo solaparía demasiados objetos. Ver [UI_UX_GUIDELINES](../design/UI_UX_GUIDELINES.md).
- Ninguna interacción esencial requiere precisión fina ni gestos de dos dedos.
