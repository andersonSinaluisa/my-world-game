# Definition of Ready (DoR)

> **Status:** Accepted · **Last Updated:** 2026-09-18
> **Related:** [DEFINITION_OF_DONE](DEFINITION_OF_DONE.md) · [ACCEPTANCE_CRITERIA](ACCEPTANCE_CRITERIA.md)

Una HU **está lista (Ready)** para empezar a desarrollarse solo cuando cumple **todo** lo siguiente.

## Checklist

- [ ] **Historia clara:** tiene el formato "Como / quiero / para" y un contexto que explica el problema.
- [ ] **Comportamiento sin ambigüedad:** las reglas de negocio indican qué pasa en el caso normal y en los casos límite listados.
- [ ] **Criterios de aceptación completos:** escenarios Given/When/Then que cubren el camino feliz, al menos un camino de error o de rechazo y, si aplica, **la persistencia**.
- [ ] **Dependencias conocidas:** todas las HU de "Dependencias" están Done o se desarrollan en la misma iteración con un orden explícito.
- [ ] **Schema definido:** si la HU usa o cambia componentes, reglas, escenas o el formato de guardado, el documento en `docs/data/` ya lo describe. Si lo cambia, la actualización del schema forma parte de la HU.
- [ ] **Sistemas identificados:** la HU aparece en [TRACEABILITY](../TRACEABILITY.md) con los sistemas afectados.
- [ ] **Assets indispensables identificados:** están listados. Si aún no existen, se acordó usar placeholders marcados `placeholder: true` y hay una tarea de arte asociada.
- [ ] **Sin decisiones arquitectónicas pendientes:** si la HU requiere una decisión nueva, primero se escribe un ADR (Proposed → Accepted).
- [ ] **Tamaño implementable:** cabe en ≤ 3 días de trabajo de una persona o agente. Si no, se divide.
- [ ] **Forma de prueba conocida:** se sabe qué parte se valida con tests headless y qué parte a mano en el dispositivo.

## Una historia NO puede comenzar si…

| Situación | Qué hacer |
|---|---|
| El comportamiento es ambiguo ("debería sentirse bien") | Concretarlo en reglas o escenarios medibles |
| Faltan criterios de aceptación, o solo existe el camino feliz | Añadir escenarios de error o límite |
| Hay dependencias desconocidas o sin terminar | Actualizar las dependencias o reordenar el backlog |
| Faltan assets indispensables y no hay placeholder acordado | Crear o conseguir placeholders (ver [FREE_ASSETS](../design/research/FREE_ASSETS.md)) |
| El schema requerido no está definido | Actualizar primero `docs/data/*` |
| Implica un cambio en invariantes de [ARCHITECTURE §6](../architecture/ARCHITECTURE.md) | Escribir un ADR primero |
