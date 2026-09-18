# ADR-001 — Stack tecnológico: React Native + Expo + TypeScript

**Status:** Accepted · **Date:** 2026-09-18 · **Related:** [ARCHITECTURE](../architecture/ARCHITECTURE.md), [ADR-002](ADR-002-RENDERING.md)

## Context
Queremos un juego 2D para iOS y Android con un equipo pequeño asistido por agentes de IA. El juego es sobre todo UI + render 2D de sprites + interacción táctil; no necesita físicas ni 3D. El proyecto ya existe como plantilla Expo (`MyWorld/`: Expo SDK 57, React Native 0.86, React 19.2, Reanimated 4.5, Gesture Handler 2.32, react-native-worklets 0.10, expo-router y React Compiler activado).

## Decision
- **React Native + Expo (managed, con development builds) + TypeScript `strict`.**
- **Render del mundo:** `@shopify/react-native-skia` ([ADR-002](ADR-002-RENDERING.md)).
- **Gestos y animación:** `react-native-gesture-handler` + `react-native-reanimated` (ya instalados).
- **Persistencia:** `expo-sqlite` ([ADR-006](ADR-006-SQLITE.md)).
- **Audio:** `expo-audio`.
- **Validación de datos:** `zod`. Una sola fuente para los schemas y los tipos TS.
- **Tests:** Jest (`jest-expo`) + el harness headless propio.
- **Navegación de pantallas:** `expo-router` (ya instalado), solo para la app shell (Title, Play, Creator, Settings).
- **Dependencias nuevas:** cada una requiere una justificación en su HU o en un ADR (ver [DEVELOPMENT_RULES](../ai/DEVELOPMENT_RULES.md)).

## Alternatives
| Alternativa | Por qué no |
|---|---|
| Unity / Godot | Más potencia de la que se necesita, peor integración con UI nativa y accesibilidad, otro lenguaje y otro pipeline. El equipo y los agentes trabajan mejor con TS. |
| Flutter + Flame | Viable, pero se prefiere el ecosistema TS/React y Expo (OTA, EAS) |
| Web (PWA) | Rendimiento y distribución peores en tiendas infantiles |
| React Native sin Expo | Más mantenimiento nativo sin beneficio claro |

### Ajustes de `app.json` (aplicados en HU-GAME-001)
- `orientation: "landscape"` ([ADR-007](ADR-007-VIRTUAL-COORDINATES.md)).
- `ios.requireFullScreen: true`, necesario para que iPad respete el bloqueo de orientación (sin multitarea en Split View).
- `userInterfaceStyle: "light"`: el juego tiene su propia paleta y no sigue el modo oscuro.
- **Web:** fuera del alcance del MVP. La configuración web de la plantilla puede quedar, pero no se prueba ni se soporta (Skia web exige CanvasKit).
- **React Compiler** (`experiments.reactCompiler`): se mantiene, pero **se verifica su compatibilidad con los worklets** en HU-GAME-001/005. Si da problemas, se desactiva y se documenta aquí (OQ-10).
  - *Resultado parcial (2026-09-18, implementación de EPIC-001/002):* las reglas de lint del compilador (`react-hooks/immutability`) prohíben `sharedValue.value = x`. Se usan `sharedValue.get()` / `.set()`, la API de Reanimated 4 compatible con el compilador. El typecheck, el lint y los bundles de Android e iOS pasan. **Falta la verificación en un dispositivo.**

## Consequences
- ✅ Un solo lenguaje (TS) para el motor, la UI, las herramientas de contenido y los tests.
- ✅ El motor en TS puro se puede probar en Node.
- ⚠️ El rendimiento depende de usar bien los threads (UI thread para animación). Ver [ADR-009](ADR-009-STATE-AND-THREADING.md).
- ⚠️ Skia y SQLite requieren development builds (no Expo Go) según la versión. Se asume `expo run:*` / EAS.

## Risks
- Ritmo de cambios de las APIs de Expo, Reanimated y worklets entre SDKs. Mitigación: fijar versiones y actualizar el SDK en HUs dedicadas.
- Rendimiento en Android de gama baja. Mitigación: los spikes de la Fase 0 y los presupuestos de [PERFORMANCE](../architecture/PERFORMANCE.md).

## Revisit when
- Los spikes de la Fase 0 no alcanzan los presupuestos "target" de drag y paneo tras optimizar.
- Se necesitan físicas, 3D o shaders complejos.
