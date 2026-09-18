# ADR-005 — Offline-first, sin red en el MVP

**Status:** Accepted · **Date:** 2026-09-18 · **Related:** [OFFLINE_FIRST](../architecture/OFFLINE_FIRST.md), [BACKEND_FUTURE](../architecture/BACKEND_FUTURE.md), [MONETIZATION](../product/MONETIZATION.md)

## Context
Es un público infantil, con dispositivos a menudo sin conexión y con requisitos estrictos de privacidad (Kids Category, Families, COPPA). El backend (.NET 8 + PostgreSQL) está previsto a futuro.

## Decision
- El MVP **funciona al 100 % offline** y **no realiza llamadas de red de juego**.
- El contenido va empaquetado en el binario y el estado vive en SQLite en el dispositivo.
- Sin SDKs de terceros que hagan red (analytics, anuncios, crash reporting remoto) sin un ADR específico.
- El modelo de datos se diseña para una **sincronización futura**: ULIDs, `updated_at` por entidad, `GameSave` serializable y `slot_id`.

## Alternatives
| Alternativa | Por qué no |
|---|---|
| Online-first con backend desde el principio | Coste, complejidad y requisitos legales antes de validar la diversión |
| Híbrido con analytics y crash reporting de terceros | Riesgo de cumplimiento para niños. Se reevalúa con un proveedor adecuado (OQ-04). |

## Consequences
- ✅ Arranque rápido, sin estados de error de red y con privacidad por diseño.
- ⚠️ No hay telemetría de crashes en producción: se compensa con más QA en dispositivos y con un log local exportable por el adulto [DESIGNED FOR LATER].
- ⚠️ Si el dispositivo se pierde, se pierde la partida, hasta que exista el cloud save (Fase 8).

## Risks
- Bugs en producción difíciles de diagnosticar. Mitigación: tests, fixtures de guardado y reparación segura de invariantes.

## Revisit when
- Llegan los packs descargables (Fase 7), el cloud save (Fase 8) o se decide incorporar crash reporting.
