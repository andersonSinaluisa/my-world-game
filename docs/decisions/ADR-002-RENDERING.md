# ADR-002 — Render del mundo con React Native Skia

**Status:** Accepted (pendiente de confirmar con el spike de la Fase 0) · **Date:** 2026-09-18 · **Related:** [RENDERING](../architecture/RENDERING.md), [PERFORMANCE](../architecture/PERFORMANCE.md)

## Context
Hay que dibujar escenas anchas con fondos grandes, decenas o cientos de sprites con orden Z, personajes por capas con tintes, un objeto arrastrado a 60 fps y efectos simples. Las Views de React Native no escalan bien a cientos de imágenes animadas ni permiten tintes y blend modes con facilidad.

## Decision
- **Una `<Canvas>` de `@shopify/react-native-skia` por escena** para el mundo. Las propiedades animadas se enlazan a SharedValues de Reanimated.
- **La UI (HUD, menús) se hace con Views de RN encima**, no en Skia, por accesibilidad y layout.
- Entidades como componentes React-Skia memoizados con suscripción granular.

## Alternatives
| Alternativa | Por qué no |
|---|---|
| Views + `Animated`/Reanimated por sprite | Coste por View alto con cientos de elementos. Sin tintes ni blend modes simples. |
| `expo-gl` + PixiJS o un motor WebGL propio | Más complejidad, menos mantenido en RN y la integración con gestos y UI es peor |
| `react-native-game-engine` | Abstracción de bucle de juego que no necesitamos. El render seguiría en Views. |
| Canvas imperativo de Skia (Picture/API directa) sin React | Posible optimización futura en capas estáticas (fondo), pero pierde la ergonomía declarativa. [DESIGNED FOR LATER] para casos concretos. |

## Consequences
- ✅ Tintes (ColorMatrix/BlendMode), transformaciones, `drawAtlas` y texto si hiciera falta.
- ✅ Drag y paneo sin re-render de React gracias a los SharedValues.
- ⚠️ La reconciliación de React sobre el árbol Skia cuesta con muchos cambios simultáneos: se mitiga con suscripciones granulares y culling.
- ⚠️ La memoria de texturas se gestiona de forma explícita (caché LRU, ver RENDERING §6).

## Risks
- Regresiones de rendimiento entre versiones de Skia y Reanimated. Mitigación: fijar versiones y usar el escenario de estrés de [PERFORMANCE §3](../architecture/PERFORMANCE.md).
- Límites de tamaño de textura en GPUs baratas. Mitigación: máximo 2048 px y chunks.

## Revisit when
- El escenario de estrés no alcanza 55 fps en el UI thread en el Android de referencia.
- Se necesitan miles de partículas o efectos complejos. En ese caso, evaluar `drawAtlas` o Pictures antes de cambiar de tecnología.
