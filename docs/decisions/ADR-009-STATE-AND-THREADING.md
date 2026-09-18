# ADR-009 — Estado lógico en el JS thread; animación de alta frecuencia en el UI thread

**Status:** Accepted (validar la latencia del hit test en el spike de la Fase 0) · **Date:** 2026-09-18 · **Related:** [GAME_ENGINE](../architecture/GAME_ENGINE.md), [INPUT_SYSTEM](../architecture/INPUT_SYSTEM.md), [RENDERING](../architecture/RENDERING.md)

## Context
React Native tiene un JS thread (lógica y React) y un UI thread (gestos de Gesture Handler y worklets de Reanimated, con Skia enlazable a SharedValues). El drag y el paneo exigen 60 fps estables incluso si el JS está ocupado. El estado del juego tiene que ser único, determinista y testeable.

## Decision
- **Fuente de verdad del juego:** el `World` en el **JS thread** (TS puro).
- **Estado transitorio de alta frecuencia en SharedValues** (UI thread): posición del drag (DragProxy), `cameraX` y tweens. **No se escribe en el World por frame.**
- **Commit al World en eventos discretos:** `dragEnd`, fin del paneo (se guarda `cameraX`), fin de una acción.
- **UI → motor:** solo mediante `GameFacade.dispatch` (comandos).
- **Motor → UI:** `useSyncExternalStore` con suscripciones granulares por entidad. **Sin librería de estado externa** (Redux, Zustand) en el MVP.
- **Cruce de threads:** `scheduleOnRN` / `runOnJS` según la API de `react-native-worklets` 0.10 y Reanimated 4 instalados. Hay que verificar la API exacta al implementar.
- **Hit test en JS** al empezar el gesto (1–2 frames de latencia aceptados). **Plan B:** una réplica de hitboxes visibles en un SharedValue para hacer el hit test en el UI thread.

## Alternatives
| Alternativa | Por qué no |
|---|---|
| Todo el estado en SharedValues o worklets | Serialización y límites de los worklets, lógica difícil de probar y persistencia complicada |
| Estado en React (`useState`/`useReducer`) | Re-renders por frame y acoplamiento de la lógica a la UI |
| Zustand, Redux o Jotai | Útiles, pero innecesarios: `useSyncExternalStore` + World cubren el caso sin dependencias |

## Consequences
- ✅ Movimiento fluido aunque el JS esté ocupado. Motor puro y testeable.
- ⚠️ Dos representaciones temporales durante el drag (proxy frente a la entidad). Mitigación: ocultar la entidad mientras el proxy existe, y un único punto de commit.
- ⚠️ Latencia inicial del hit test. La medirá el spike.

## Risks
- Cambios de API entre versiones de Reanimated y worklets. Mitigación: encapsular el cruce de threads en `engine/adapters/input`.

## Revisit when
- La latencia del hit test > 50 ms en el dispositivo de referencia (aplicar el plan B).
- El multitouch (HU-GAME-101) requiere varios proxies simultáneos.
