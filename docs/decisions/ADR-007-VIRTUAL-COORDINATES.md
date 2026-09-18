# ADR-007 — Coordenadas virtuales: altura fija de 1080 unidades, ancho variable, landscape

**Status:** Accepted · **Date:** 2026-09-18 · **Related:** [RENDERING §2](../architecture/RENDERING.md), [SCENE_SCHEMA](../data/SCENE_SCHEMA.md), [ENVIRONMENT_GUIDELINES](../design/ENVIRONMENT_GUIDELINES.md)

## Context
Hace falta un sistema de coordenadas independiente del dispositivo para el contenido (posiciones, hitboxes, superficies), con pantallas que van del 4:3 (iPad) al ~20:9 (teléfonos), en escenas que se exploran en horizontal. La plantilla actual está en `portrait`.

## Decision
- **Orientación: landscape bloqueada** (cambio en `app.json`, HU-GAME-001).
- **World units:** la escena mide **siempre 1080 unidades de alto**. El ancho es propio de cada escena (MVP: 3840–7680).
- **Origen** arriba a la izquierda de la escena; x hacia la derecha e y hacia abajo. **Pivot por defecto de las entidades:** centro inferior.
- **Escala** = altura del canvas en dp / 1080. El ancho visible varía según el aspecto: unas 1440 unidades en iPad y unas 2400 en teléfonos de 20:9.
- **Regla de contenido:** lo esencial de cada zona cabe en **1440 unidades** de ancho.
- **Assets a 1×** (1 px = 1 unidad). Variantes @2x para tablets [DESIGNED FOR LATER].
- Los px y dp **solo existen** en los adaptadores de render e input.

## Alternatives
| Alternativa | Por qué no |
|---|---|
| 1920×1080 fijo con letterbox o pillarbox | Barras en todos los teléfonos modernos. Desperdicia pantalla en un juego de exploración horizontal. |
| 1920×1080 escalado por ancho (recortando arriba y abajo) | En 4:3 se ve mucho menos mundo vertical y se cortan techo o suelo |
| Coordenadas normalizadas 0..1 | Poco intuitivas para diseñar contenido y para medir sprites |
| Altura virtual de 720 | Menos memoria, pero se pierde nitidez en teléfonos de 1080p o más, que ya son la mayoría |

## Consequences
- ✅ El contenido se diseña una vez para todos los dispositivos. El mundo "continúa" horizontalmente.
- ✅ Los números del contenido son legibles (una silla mide unas 220 unidades).
- ⚠️ En tablets los assets a 1× se ven algo blandos. Aceptado para el MVP.
- ⚠️ La UI (HUD) no usa world units: usa dp con safe areas.

## Risks
- Contenido que dependa de ver más de 1440 unidades. Mitigación: la regla de zona y la revisión en 4:3 están en el DoD.

## Revisit when
- Se añaden variantes @2x o se soporta portrait (no previsto).
