# Architecture Decision Records

> **Last Updated:** 2026-09-18

| ADR | Decisión | Status |
|---|---|---|
| [ADR-001](ADR-001-TECH-STACK.md) | React Native + Expo + TypeScript (+ Skia, Reanimated, Gesture Handler, expo-sqlite, expo-audio, zod) | Accepted |
| [ADR-002](ADR-002-RENDERING.md) | Render del mundo con React Native Skia; UI con Views encima | Accepted (spike en la Fase 0) |
| [ADR-003](ADR-003-ECS.md) | ECS-lite dirigido por eventos, sin librería ECS | Accepted |
| [ADR-004](ADR-004-DATA-DRIVEN-CONTENT.md) | Contenido data-driven en JSON validado con zod; reglas sin scripting | Accepted |
| [ADR-005](ADR-005-OFFLINE-FIRST.md) | Offline-first, sin red en el MVP | Accepted |
| [ADR-006](ADR-006-SQLITE.md) | expo-sqlite, una fila por entidad, diff sobre el contenido, tres versiones | Accepted |
| [ADR-007](ADR-007-VIRTUAL-COORDINATES.md) | Altura virtual de 1080, ancho variable, landscape | Accepted |
| [ADR-008](ADR-008-CONTENT-PACKS.md) | Content Packs con namespace desde el MVP | Accepted |
| [ADR-009](ADR-009-STATE-AND-THREADING.md) | World en el JS thread; drag, cámara y tweens en el UI thread | Accepted (spike en la Fase 0) |
| [ADR-010](ADR-010-CHARACTER-TINT.md) | Tinte de piel y pelo con ColorMatrix | Proposed |

## Cómo crear un ADR

1. Copiar el formato: `Status`, `Context`, `Decision`, `Alternatives`, `Consequences`, `Risks`, `Revisit when`.
2. Usar el siguiente número libre: `ADR-0XX-TITULO-CORTO.md`.
3. Empieza como `Proposed`. Pasa a `Accepted` tras revisarse.
4. Un ADR **nunca se borra**. Si cambia la decisión, se crea uno nuevo que lo **reemplaza** (`Superseded by ADR-0YY`) y se actualiza el Status del antiguo.
5. Enlazarlo desde los documentos de arquitectura afectados.

## ADRs previstos (aún no escritos)

- Acciones `combine` y `emit` + componentes `combinable` y `memoryTrigger` (Fase 3).
- Tick de simulación para mascotas y NPCs (Fase 4). Revisa ADR-003.
- Crash reporting compatible con apps infantiles (OQ-04). Revisa ADR-005.
- Distribución de packs y entitlements (Fase 7).
- Backend y sincronización (Fase 8).
