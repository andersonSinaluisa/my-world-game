# ADR-008 — Content Packs con namespace, versión y dependencias desde el MVP

**Status:** Accepted · **Date:** 2026-09-18 · **Related:** [CONTENT_SYSTEM](../architecture/CONTENT_SYSTEM.md), [CONTENT_PACK_SCHEMA](../data/CONTENT_PACK_SCHEMA.md)

## Context
Se quieren añadir expansiones (Escuela, Playa, Hospital, Mascotas, Restaurante, Espacio) sin cambiar el motor, y más adelante descargarlas y venderlas.

## Decision
- **Todo el contenido es un pack**, incluido el MVP (`core`), empaquetado en el binario.
- Cada pack tiene:
  - `manifest.json` con `id` (namespace), `version` (semver del contenido), `formatVersion` (schemas soportados) y `dependencies` (rangos semver);
  - `provides` (escenas y ubicaciones del mapa);
  - `idAliases` y `removedIds` (para migrar guardados).
- **IDs con namespace** (`core:apple_red`). Solo se pueden referenciar packs declarados en `dependencies`.
- **Extensiones de escena** (`extends` + `addEntities`) para que un pack enlace con escenas de otro sin modificarlo [DESIGNED FOR LATER]. El schema ya está definido.
- Descarga, checksum, firma y entitlements: [DESIGNED FOR LATER] (Fase 7).

## Alternatives
| Alternativa | Por qué no |
|---|---|
| Contenido plano sin packs, y packs "cuando haga falta" | Migrar después IDs sin namespace y guardados existentes es caro y arriesgado |
| Packs como código (bundles JS / OTA) | Los packs descargables con código plantean riesgos de seguridad y de políticas de tienda. Los datos puros son más seguros. |

## Consequences
- ✅ El MVP ya prueba la ruta del pack. La Fase 5 (Escuela) valida la independencia del motor.
- ⚠️ Algo más de ceremonia en el MVP (manifest, namespaces), aceptada por su bajo coste.

## Risks
- Colisiones de claves de asset entre packs. Mitigación: prefijo por pack y validación de unicidad global.

## Revisit when
- Fase 7 (distribución), o si aparecen packs creados por terceros (no previsto).
