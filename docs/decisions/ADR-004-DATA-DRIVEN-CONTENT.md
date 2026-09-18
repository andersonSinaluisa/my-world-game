# ADR-004 — Contenido data-driven: prefabs, escenas y reglas en JSON validado

**Status:** Accepted · **Date:** 2026-09-18 · **Related:** [CONTENT_SYSTEM](../architecture/CONTENT_SYSTEM.md), [OBJECT_SCHEMA](../data/OBJECT_SCHEMA.md), [SCENE_SCHEMA](../data/SCENE_SCHEMA.md), [INTERACTION_SCHEMA](../data/INTERACTION_SCHEMA.md)

## Context
El juego debe crecer a cientos de objetos y a nuevos escenarios sin tocar el motor, y evitar escenas hardcodeadas y coordenadas dispersas por los componentes.

## Decision
- **Todo el contenido se declara en JSON** dentro de Content Packs ([ADR-008](ADR-008-CONTENT-PACKS.md)):
  - prefabs (componentes);
  - escenas (fondos, suelo, zonas, spawns, instancias con coordenadas);
  - reglas de interacción (trigger + matchers + condiciones + acciones);
  - catálogo de partes de personaje;
  - textos (i18n) y manifests de assets.
- **Validación con zod** (modo strict), con los tipos TS inferidos de los schemas. El validador de CLI se ejecuta en la CI (HU-GAME-069).
- **Referencias por clave** (assets, audio, i18n, prefabs), **nunca por ruta ni con texto literal**.
- **Sin scripting:** las reglas solo combinan acciones y condiciones del conjunto cerrado del motor.

## Alternatives
| Alternativa | Por qué no |
|---|---|
| Contenido en TS (objetos exportados) | Tipado gratis, pero mezcla contenido y código, dificulta los packs descargables y tienta a meter funciones |
| Un editor visual propio | Demasiado pronto. [DESIGNED FOR LATER] si el volumen de contenido lo justifica. |
| Lenguaje de scripting en las reglas (Lua, expresiones) | Potencia innecesaria, riesgo de seguridad en packs descargables y comportamiento difícil de probar |
| Formatos de editores de terceros (Tiled, LDtk) | Pensados para tiles o top-down. Nuestro modelo (surface, zones, components) no encaja limpio. Se podría adaptar con un importador en el futuro. |

## Consequences
- ✅ Diseñadores y agentes añaden contenido sin tocar `src/`.
- ✅ Los packs descargables son posibles, porque no llevan código.
- ⚠️ JSON es verboso y sin editor: se compensa con un validador estricto y mensajes claros.
- ⚠️ Metro necesita `require` estáticos para los assets: hace falta un script que genere el mapa de assets.

## Risks
- La deriva entre la documentación de los schemas y el código zod. Mitigación: los docs de `data/` son la fuente de verdad y cada cambio de schema actualiza ambos en la misma HU.

## Revisit when
- Hay más de 300 prefabs o varios diseñadores de contenido: considerar un editor o herramientas de autoría.
