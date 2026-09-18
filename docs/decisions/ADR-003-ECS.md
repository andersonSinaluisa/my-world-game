# ADR-003 — ECS-lite dirigido por eventos

**Status:** Accepted · **Date:** 2026-09-18 · **Related:** [ECS](../architecture/ECS.md), [GAME_ENGINE](../architecture/GAME_ENGINE.md), [INTERACTION_SYSTEM](../architecture/INTERACTION_SYSTEM.md)

## Context
Se quiere un modelo que admita cientos de objetos sin lógica específica por objeto, que sea mantenible por agentes de IA y que sea probable. La propuesta inicial era un ECS clásico con sistemas que recorren entidades en cada frame (Render, Input, Drag, Interaction, Collision, Character, Inventory, Container, Animation, Audio, Scene, Save).

## Decision
**ECS-lite:**
- **Entidades** = ID + `tags` + **una `location`** + un mapa de **componentes de datos** serializables (schemas zod).
- **Systems** = lógica pura que reacciona a **comandos y eventos**, no un bucle por frame.
- **Actions** = operaciones reutilizables (eat, sit, store…) que se invocan desde **reglas de interacción** declaradas en datos ([ADR-004](ADR-004-DATA-DRIVEN-CONTENT.md)).
- **Services** = bordes con I/O (Content, Scene, Save, Audio, Location).
- **Animación** fuera del motor lógico: la hacen Reanimated y Skia en el UI thread.
- **Sin librería ECS externa.** `Map<EntityId, Entity>` más índices derivados.
- Se descartan como sistemas separados:
  - `CollisionSystem`: no hay física, y el apoyo en superficies lo resuelve el `SurfaceSystem` con segmentos.
  - `RenderingSystem`, `InputSystem`, `AudioSystem` y `SaveSystem`: pasan a ser adaptadores o servicios.

## Alternatives
| Alternativa | Por qué no |
|---|---|
| ECS clásico por arquetipos (bitECS, miniplex) con tick a 60 Hz | Optimiza la iteración de miles de entidades por frame, que no es nuestro problema. Añade complejidad y un modelo mental menos obvio para el contenido. |
| POO con una clase por objeto (Apple extends Food) | Lleva a la lógica por objeto y a jerarquías rígidas. Contradice el enfoque data-driven. |
| Estado en React/Redux con reducers por objeto | Acopla la lógica a la UI y re-renderiza de más |

## Consequences
- ✅ Añadir objetos = añadir datos. El comportamiento nuevo = una acción o un componente nuevo, reutilizable.
- ✅ Motor determinista y testeable en Node.
- ✅ La `location` única elimina los bugs de duplicación y pérdida de objetos.
- ⚠️ El conjunto de acciones y condiciones es cerrado: las capacidades nuevas requieren código (a propósito).
- ⚠️ Los temporizadores de gameplay necesitan un `TimeSystem` de baja frecuencia [DESIGNED FOR LATER].

## Risks
- Tentación de añadir "scripting" en las reglas. Mitigación: condiciones y acciones cerradas y revisadas; las prohibiciones están en [DEVELOPMENT_RULES](../ai/DEVELOPMENT_RULES.md).
- Crecimiento de las reglas globales y conflictos de prioridad. Mitigación: orden determinista documentado y tests de resolución.

## Revisit when
- Aparecen mecánicas continuas (mascotas que se mueven solas, NPCs con rutinas), lo que requiere un tick de simulación. Evaluar entonces un tick a 10–20 Hz **solo** para esos sistemas.
- Hay más de 1000 entidades activas por escena.
