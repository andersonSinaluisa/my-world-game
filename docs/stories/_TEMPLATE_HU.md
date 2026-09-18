<!-- Plantilla: las rutas relativas asumen que la HU vive dentro de docs/stories/mvp/EPIC-XXX-*.md (como sección ## de su epic). -->
# HU-GAME-XXX — Nombre corto en español

> **Status:** Draft | Ready | In Progress | Done | Dropped
> **Epic:** EPIC-XXX · **Fase:** 0|1|2 · **Alcance:** MVP P0|P1|P2
> **Last Updated:** YYYY-MM-DD

## Epic
EPIC-XXX — Nombre del epic

## Prioridad
Must | Should | Could · P0 | P1 | P2

## Historia
Como **[jugador | padre/madre | desarrollador | diseñador de contenido]**
quiero **[acción]**
para **[beneficio]**.

## Contexto
Qué problema resuelve y por qué importa. Enlaza con los documentos de arquitectura y de datos relevantes (rutas relativas).

## Reglas de negocio
- Regla 1: concreta y verificable.
- Regla 2: con los números citados de los documentos.

## Criterios de aceptación
```gherkin
Scenario: camino feliz
  Given …
  When …
  Then …

Scenario: rechazo o error
  Given …
  When …
  Then …
```
Incluye (si aplica): AC-PERSIST-01, AC-PERSIST-02, AC-REJECT-01, AC-PERF-01, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

## Casos límite
- …

## Dependencias
- HU-GAME-XXX: motivo.

## Consideraciones técnicas
- Sistemas y documentos implicados. Sin imponer una implementación salvo restricciones de arquitectura.
- Estado de la infraestructura: [NEEDED NOW] / [DESIGNED FOR LATER] / [NOT NEEDED YET].

## Assets necesarios
- `clave_de_asset`: descripción (placeholder aceptable: sí/no).

## Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación
- [ ] pruebas (unitarias o de integración)
- [ ] rendimiento (si aplica)
- [ ] persistencia (si aplica)
- [ ] documentación
