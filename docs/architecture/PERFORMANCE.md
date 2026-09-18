# Performance

> **Status:** Accepted (v1). Los números se revisan tras las mediciones de la Fase 0. · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-002](../decisions/ADR-002-RENDERING.md), [ADR-009](../decisions/ADR-009-STATE-AND-THREADING.md)
> **Related Epic:** EPIC-023
> **Related HU:** HU-GAME-071, HU-GAME-008

## <a id="dispositivos"></a>1. Dispositivos de referencia (suposición base)

Los presupuestos se fijan para **el dispositivo más débil que queremos soportar bien**. El público son niños que usan con frecuencia tablets y móviles heredados o baratos.

| Rol | Referencia | Por qué |
|---|---|---|
| **Android bajo** (el que manda) | ~3 GB de RAM, CPU de 8 núcleos de gama baja (clase Snapdragon 680 / Helio G85), GPU Adreno 610 / Mali-G52, pantalla 720p–1080p, Android 11+ | Perfil típico de tablets infantiles baratas y móviles heredados en LATAM. Ver OQ-01. |
| **iOS bajo** | iPhone 11 / iPad de 9.ª generación (A13, 3 GB) | Los iOS más antiguos probables en el público objetivo |
| **Alto** (sanity) | Cualquier dispositivo de 2024+ | Comprobar 120 Hz y que no aparezcan bugs de temporización |

> ⚠️ **Pregunta abierta OQ-01:** confirmar el público y el mercado objetivo (país, tipo de dispositivo). Si el objetivo incluye tablets de 2 GB, habrá que bajar los presupuestos de memoria alrededor de un 30 %.

## <a id="presupuestos"></a>2. Presupuestos

Niveles:
- **target:** el objetivo de diseño.
- **warning:** hay que investigar antes de cerrar la HU.
- **critical:** bloquea el release.

| Métrica | Target | Warning | Critical | Suposición o razonamiento |
|---|---|---|---|---|
| **FPS UI thread** (drag, paneo) | 60 sostenidos | < 55 de media en 10 s | < 45 | El drag debe sentirse pegado al dedo; por debajo de ~45 fps el retraso se nota. En pantallas de 120 Hz se apunta a 60 como mínimo, no a 120. |
| **FPS JS thread** durante interacciones | ≥ 50 | < 40 | < 25 | El JS no dibuja el drag (va en el UI thread), pero sí resuelve el drop y re-renderiza. Un JS lento retrasa los drops, no el movimiento. |
| **Tiempo de respuesta del drop** (dedo arriba → estado aplicado) | ≤ 50 ms | > 100 ms | > 200 ms | Unos 100 ms es el umbral clásico de "instantáneo" en la percepción de causa y efecto |
| **RAM total de la app** | ≤ 350 MB | > 450 MB | > 600 MB | En Android de 3 GB, el sistema empieza a matar apps en background alrededor de 400–500 MB y la app en foreground corre riesgo de LMK por encima de ~600 MB |
| **Memoria de texturas en caché** | ≤ 150 MB | > 200 MB | > 280 MB | RGBA 4 B/px: un chunk de fondo de 1920×1080 son 8,3 MB. Home (4 chunks) + parallax son unos 45 MB y los objetos ~40 MB. Queda margen para la escena siguiente precargada. |
| **Entidades renderizadas** (tras culling) | ≤ 120 | > 180 | > 250 | Cada entidad es un componente React-Skia memoizado. Unos cientos de nodos se reconcilian sin problema en un cambio de estado. El coste está en actualizar muchos a la vez. |
| **Entidades cargadas por escena** (World) | ≤ 300 | > 450 | > 600 | Afecta a la carga, el guardado, el hit test y la memoria JS. Las escenas del MVP rondan las 80–150. |
| **Tamaño de escena** | ≤ 7680 × 1080 unidades | > 9600 | > 11520 | Un ancho mayor implica más chunks y más contenido que gestionar. Si se necesita, se parte en varias escenas. |
| **Textura individual** | ≤ 2048 × 2048 | — | > 2048 en cualquier eje | Límite seguro de GPU y memoria (ver RENDERING §8) |
| **Arranque en frío hasta el Title interactivo** | ≤ 3 s | > 5 s | > 8 s | Expectativa móvil habitual. El splash tapa el primer segundo. |
| **Title → escena jugable (con guardado)** | ≤ 1,5 s | > 2,5 s | > 4 s | Incluye la lectura de SQLite, el diff y la precarga de texturas visibles |
| **Transición entre escenas** (fade incluido) | ≤ 1,0 s | > 1,5 s | > 2,5 s | 600 ms de fade + ≤ 400 ms de carga. Los niños pierden la atención con esperas largas. |
| **Autosave (flush típico)** | ≤ 20 ms | > 50 ms | > 100 ms | Escritura en SQLite en una transacción. Por encima de ~50 ms puede notarse un salto si coincide con una animación del JS. |
| **Audio: efectos precargados por escena** | ≤ 30 | > 45 | > 60 | Memoria y tiempo de decodificación. Los efectos son cortos (< 1,5 s). |
| **Audio: música** | 1 pista en streaming + 1 ambiente | — | > 2 simultáneas | La música no se precarga entera |
| **Tamaño de descarga (store)** | ≤ 150 MB | > 180 MB | > 200 MB | iOS pide confirmación para descargas por datos móviles de más de 200 MB. Las tiendas infantiles penalizan los tamaños grandes. |

## 3. Cómo se mide (HU-GAME-071)

- **Overlay de desarrollo** (solo en `__DEV__` o con una flag): FPS del UI y del JS, entidades montadas y cargadas, memoria estimada de texturas y el tiempo de la última transición y del último flush.
- **FPS del UI thread:** `useFrameCallback` de Reanimated, promediando los deltas.
- **FPS del JS thread:** `requestAnimationFrame` en JS.
- **Memoria:** una estimación propia de las texturas (suma de `w×h×4` en caché) y el perfilador nativo (Android Studio Profiler / Xcode Instruments) en las mediciones de hito.
- **Medir siempre en release** (`expo run:android --variant release`). El modo dev deforma mucho los números.
- **Escenario de referencia de estrés:**
  - Home con 12 personajes, todos en el salón;
  - 60 objetos visibles;
  - arrastrar un objeto de punta a punta con auto-scroll;
  - mantenerlo 30 s.

## 4. Reglas de diseño que protegen el rendimiento

1. **Nada de `setState` por frame.** El drag, el paneo y los tweens van por SharedValues.
2. **Suscripciones granulares:** una entidad re-renderiza solo cuando cambia ella (`useEntity(id)`).
3. **Culling con umbral**, no por frame (RENDERING §7).
4. **Texturas:** todo en WebP; nada mayor de lo necesario; fondos en chunks.
5. **El JSON de contenido se valida por completo en la CI**, no en el arranque de release.
6. **El autosave con debounce** nunca se ejecuta durante un drag.
7. **Sin librerías pesadas en el arranque.** Revisar el bundle cuando se añadan dependencias.

## 5. Qué hacer si se supera un umbral

| Síntoma | Primeras palancas |
|---|---|
| FPS bajos en el drag | Comprobar re-renders (React DevTools Profiler), el tamaño del sprite del proxy y el número de entidades montadas |
| Memoria alta | Reducir la precarga y bajar el tamaño de los fondos. Plan B: fondos WebP con más compresión o chunks de 960 px. |
| Transición lenta | Precargar la escena destino al acercarse al portal [DESIGNED FOR LATER]; paralelizar la lectura de SQLite y la decodificación de imágenes |
| Muchas draw calls | Atlas con `drawAtlas` para los props pequeños [DESIGNED FOR LATER] |
