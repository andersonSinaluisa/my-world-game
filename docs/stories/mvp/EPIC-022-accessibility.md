# EPIC-022 — Accessibility

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [INPUT_SYSTEM §8](../../architecture/INPUT_SYSTEM.md) · [UI_UX_GUIDELINES §6](../../design/UI_UX_GUIDELINES.md) · [RENDERING §2](../../architecture/RENDERING.md) · [ENTITY_SCHEMA §5.3](../../data/ENTITY_SCHEMA.md) · [GAME_RULES §1](../../product/GAME_RULES.md) · [DEFINITION_OF_DONE §6](../DEFINITION_OF_DONE.md) · [ACCEPTANCE_CRITERIA](../ACCEPTANCE_CRITERIA.md)

## Objetivo del epic
Que un niño de 4 años que no sabe leer pueda jugar sin ayuda: objetivos táctiles grandes (≥ 64 dp en botones del HUD y del creador, ≥ 44 dp efectivos en objetos del mundo, ≥ 48 dp en la UI de adultos), cero texto obligatorio, feedback por icono, animación y sonido, rechazos amables y etiquetas de accesibilidad traducidas para lectores de pantalla.

## Historias
- [HU-GAME-070 — Objetivos táctiles grandes y UI sin texto](#hu-game-070--objetivos-táctiles-grandes-y-ui-sin-texto)

---

## HU-GAME-070 — Objetivos táctiles grandes y UI sin texto

> **Status:** Draft
> **Epic:** EPIC-022 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-022 — Accessibility

### Prioridad
Must · P1

### Historia
Como **jugador que todavía no sabe leer**
quiero **tocar y arrastrar cosas fácilmente y entender los botones por sus dibujos**
para **jugar solo, sin frustrarme ni pedir ayuda a un adulto**.

### Contexto
Mínimos táctiles ([UI_UX_GUIDELINES §6](../../design/UI_UX_GUIDELINES.md), [DEFINITION_OF_DONE §6](../DEFINITION_OF_DONE.md)): 64 dp en botones del HUD y del creador, 48 dp en ajustes de adultos y **44 dp efectivos** en los objetos del mundo, garantizados en runtime por el hit testing (`minHitDp`, [INPUT_SYSTEM §8](../../architecture/INPUT_SYSTEM.md)). La escala del mundo depende del alto del dispositivo: `scale = canvasHeightDp / 1080` ([RENDERING §2.2](../../architecture/RENDERING.md)). Esta HU convierte esas reglas en comprobaciones automáticas y en una revisión de la UI.

### Reglas de negocio
- **RN-1 (HUD, creador y pantallas infantiles):** todo botón o drop target (mochila, mapa, crear personaje, continuar, regalo, opciones del creador) mide **≥ 64 dp** de área táctil efectiva (`hitSlop` incluido) y tiene al menos 8 dp de separación con el siguiente (propuesta).
- **RN-2 (UI de adultos):** ajustes, puerta parental y diálogos de confirmación: **≥ 48 dp**.
- **RN-3 (entidades del mundo):** en tiempo de ejecución, el hit testing amplía el hitbox de toda entidad hasta que mida al menos **`minHitDp = 44 dp`** por eje, convertido a world units con la escala actual (≈ 132 u en un teléfono de 360 dp de alto). Si las áreas ampliadas se solapan, gana la entidad más al frente ([INPUT_SYSTEM §5, §8](../../architecture/INPUT_SYSTEM.md)). El `padding` del contenido sigue siendo válido pero no es necesario para cumplir el mínimo; el validador no emite advertencias por ello.
- **RN-4 (sin texto):** ninguna acción de juego requiere leer. Los botones usan iconos; los rechazos son shake + `sfx_reject_soft` + icono opcional (`rejectHint`); nunca un texto de error ([GAME_RULES R4, R5](../../product/GAME_RULES.md)). El texto solo aparece en la UI de adultos.
- **RN-5 (etiquetas):** todo elemento interactivo de UI tiene `accessibilityLabel` (y `accessibilityRole`) con clave i18n en `es` y `en`.
- **RN-6 (gestos):** ninguna interacción esencial requiere dos dedos, precisión fina ni long press para arrastrar ([INPUT_SYSTEM §2](../../architecture/INPUT_SYSTEM.md)). El único long press del MVP es quitar ropa (HU-GAME-040).
- **RN-7 (bordes y safe areas):** los botones del HUD respetan safe areas y notch, y el drag no empieza en los 16 dp de los bordes ([INPUT_SYSTEM §6](../../architecture/INPUT_SYSTEM.md)).
- **RN-8 (color):** ningún estado se comunica solo con color (p. ej. encendido/apagado también cambia la forma o el brillo del sprite) (propuesta).

### Criterios de aceptación
```gherkin
Scenario: botones del HUD suficientemente grandes
  Given la pantalla de juego renderizada en un teléfono con 360 dp de alto
  When se miden los botones del HUD (mochila, mapa, ajustes)
  Then cada área táctil efectiva mide al menos 64 × 64 dp

Scenario: UI de adultos
  Given la pantalla de ajustes
  When se miden sus controles
  Then cada control mide al menos 48 × 48 dp

Scenario: ampliación del hitbox de un objeto pequeño
  Given un canvas de 360 dp de alto (scale 1/3) y un objeto `draggable` con hitbox circle r 20 y padding 12
  When el jugador toca a 60 world units del centro del objeto
  Then el hit test devuelve ese objeto (área efectiva ≥ 44 dp por eje ≈ 132 u)

Scenario: la ampliación depende de la escala
  Given el mismo objeto en un canvas de 768 dp de alto
  When se calcula su área efectiva
  Then mide al menos 44 dp por eje convertidos con esa escala

Scenario: solapamiento tras la ampliación
  Given dos objetos pequeños cuyas áreas ampliadas se solapan
  When el jugador toca en la intersección
  Then el hit test devuelve la entidad más al frente

Scenario: etiquetas de accesibilidad traducidas
  Given todos los componentes interactivos de ui/
  When un test recorre sus props
  Then cada uno tiene accessibilityLabel con una clave existente en es.json y en.json

Scenario: rechazo sin texto
  Given cualquier interacción rechazada
  When se emite interactionRejected
  Then no se muestra ningún texto en pantalla

@a11y @manual
Scenario: prueba con niños
  Given 5 niños de 4 a 7 años que no leen con fluidez
  When juegan 10 minutos sin ayuda
  Then cada uno logra arrastrar, comer, sentar y guardar un objeto guiándose por iconos, animación y sonido
```
Incluye: AC-A11Y-01, AC-REJECT-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Tablet 4:3 (768 dp de alto): la ampliación en world units es menor porque la escala es mayor; el mínimo en dp es el mismo.
- Objetos pequeños muy juntos: gana la entidad más al frente; cada HU de contenido revisa que ningún objeto quede inaccesible (se puede apoyar en el overlay de dev).
- VoiceOver/TalkBack activos: la UI RN es navegable; el mundo Skia no es navegable por lector de pantalla en el MVP (limitación aceptada, [UI_UX_GUIDELINES §6](../../design/UI_UX_GUIDELINES.md)).
- Idioma cambiado en ajustes: las etiquetas cambian sin reiniciar la app.

### Dependencias
- HU-GAME-004: GameFacade (la UI solo habla con el motor por la fachada).

### Consideraciones técnicas
- La ampliación a `minHitDp` vive en el adaptador de input (conversión dp → world units con la escala actual). Opcional: una capa del overlay de dev (HU-GAME-071) que dibuja las áreas táctiles efectivas para revisar el contenido. La UI se comprueba con tests de componentes.
- Voces o narración: [NOT NEEDED YET]. `reduceMotion` y `leftHanded`: [DESIGNED FOR LATER].
- [NEEDED NOW].

### Assets necesarios
- Set de iconos de UI coherente (`ui_btn_*`, `ui_icon_*`) sin texto incrustado (placeholder: sí en dev, no en release).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de la ampliación `minHitDp` en el hit testing y revisión del HUD
- [ ] pruebas automáticas de tamaños y etiquetas
- [ ] prueba manual con niños documentada (pasos y resultado)
- [ ] documentación
