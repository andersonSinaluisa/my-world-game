# EPIC-026 — App Shell & Parental

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [ARCHITECTURE §2–3](../../architecture/ARCHITECTURE.md) · [GAME_ENGINE §2, §4](../../architecture/GAME_ENGINE.md) · [SAVE_SYSTEM §4, §6](../../architecture/SAVE_SYSTEM.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md) · [AUDIO_SYSTEM](../../architecture/AUDIO_SYSTEM.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md) · [GAME_RULES §5](../../product/GAME_RULES.md) · [MONETIZATION](../../product/MONETIZATION.md)

## Objetivo del epic
Dar a la app su "carcasa": una pantalla de inicio que se entiende sin leer (continuar o crear personaje), una **puerta parental** reutilizable que separa al niño de todo lo que es de adultos (ajustes, reinicio, enlaces externos y compras futuras), y una pantalla de ajustes para volumen, silencio, idioma y reinicio del mundo. Cumple los requisitos de Apple Kids Category y Google Families: sin anuncios, sin recogida de datos y con puerta parental.

## Historias
- [HU-GAME-073 — Pantalla de inicio](#hu-game-073--pantalla-de-inicio)
- [HU-GAME-074 — Puerta parental](#hu-game-074--puerta-parental)
- [HU-GAME-075 — Pantalla de ajustes](#hu-game-075--pantalla-de-ajustes)

---

## HU-GAME-073 — Pantalla de inicio

> **Status:** Draft
> **Epic:** EPIC-026 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-026 — App Shell & Parental

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **una pantalla de inicio con un botón grande para seguir jugando y otro para crear un personaje**
para **volver a mi mundo con un solo toque, sin tener que leer nada**.

### Contexto
La pantalla `Title` es la ruta `app/index` ([ARCHITECTURE §3](../../architecture/ARCHITECTURE.md)) y el estado `Title` del ciclo de vida ([GAME_ENGINE §2](../../architecture/GAME_ENGINE.md)). El bucle de juego empieza con "Title → Continuar (1 tap)" ([CORE_GAME_LOOP](../../product/CORE_GAME_LOOP.md)). Si no hay guardado, se ofrece crear un personaje ([SAVE_SYSTEM §4](../../architecture/SAVE_SYSTEM.md)).

### Reglas de negocio
- **RN-1 (con guardado):** se muestran dos botones grandes con icono: **Continuar** (principal, el más grande; icono "play" sobre una miniatura de la casa) y **Crear personaje** (silueta con "+").
- **RN-2 (sin guardado):** solo **Crear personaje**, destacado; al terminar el creador (EPIC-005) se crea la partida con los valores de `newGame` del manifest `core` ([CONTENT_PACK_SCHEMA §2](../../data/CONTENT_PACK_SCHEMA.md)) y el personaje aparece en `newGame.sceneId` / `newGame.spawnId` (HU-GAME-023).
- **RN-3:** **Continuar** carga `player.currentSceneId` con la cámara guardada (HU-GAME-053). Presupuesto Title → escena jugable: target ≤ 1,5 s, warning > 2,5 s, critical > 4 s.
- **RN-4:** **Crear personaje** abre el creador; si ya hay 12 personajes (máximo del MVP, [GAME_RULES §3](../../product/GAME_RULES.md)) el botón abre la lista de personajes para editar (HU-GAME-022) en vez del creador (propuesta).
- **RN-5:** Un botón de ajustes (engranaje, esquina superior, ≥ 64 dp) abre la puerta parental (HU-GAME-074); nunca abre los ajustes directamente.
- **RN-6:** Arranque en frío hasta Title interactivo: target ≤ 3 s, warning > 5 s, critical > 8 s ([PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos)). El splash cubre el primer segundo.
- **RN-7:** Música de la pantalla de inicio `mus_title_01` (propuesta), con crossfade de 800 ms al entrar en el juego.
- **RN-8:** Estados especiales delegados en HU-GAME-054: fallo de migración (pantalla amable) y guardado no compatible (aviso); en ambos, **Continuar** no aparece.
- **RN-9:** Sin texto obligatorio: los botones son iconos con `accessibilityLabel` i18n. Sin anuncios, sin enlaces externos ni botones de compra en esta pantalla.
- **RN-10:** Landscape, safe areas y notch respetados; en 4:3 los botones mantienen ≥ 64 dp.

### Criterios de aceptación
```gherkin
Scenario: continuar con un toque
  Given un guardado con player.currentSceneId "core:home"
  When el jugador toca "Continuar"
  Then la escena "core:home" es interactiva con la cámara guardada

Scenario: primera vez sin guardado
  Given una base de datos sin save_slot "main"
  When la app termina de arrancar
  Then solo se muestra el botón "Crear personaje"
  And no se muestra "Continuar"

Scenario: el engranaje pide la puerta parental
  Given la pantalla de inicio
  When el jugador toca el botón de ajustes
  Then se abre la puerta parental y no la pantalla de ajustes

Scenario: guardado no compatible
  Given un guardado con saveVersion mayor que el soportado
  When la app termina de arrancar
  Then se muestra el aviso de guardado no compatible y no aparece "Continuar"

@performance @manual
Scenario: arranque en frío
  Given una build release en el Android de referencia
  When se abre la app desde cero 5 veces
  Then la pantalla de inicio es interactiva en ≤ 3 s en cada intento
```
Incluye: AC-A11Y-01, AC-PERSIST-02, AC-PERF-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Doble toque rápido en "Continuar": se ignora el segundo (la entrada se bloquea durante la carga).
- Guardado existente con 0 personajes (todos borrados): "Continuar" lleva al mundo igual; el niño puede crear uno desde el botón.
- Volver al Title desde el juego ("salir"): flush antes de mostrar el Title (propuesta).

### Dependencias
- HU-GAME-004: GameFacade.
- HU-GAME-053: restaurar la partida al iniciar.

### Consideraciones técnicas
- Pantalla RN en `app/index`; consulta el estado del guardado por la fachada (`selectors`), sin importar `engine/core`.
- [NEEDED NOW].

### Assets necesarios
- `ui_title_bg_01`, `ui_title_logo_01`, `ui_btn_play`, `ui_btn_create_character`, `ui_btn_settings` (placeholder: sí en dev, no en release).
- `mus_title_01` (propuesta).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de la pantalla y de sus estados (con guardado, sin guardado, no compatible)
- [ ] pruebas de integración de la navegación y del estado inicial
- [ ] rendimiento: arranque en frío y Title → escena medidos en release
- [ ] persistencia: "Continuar" retoma la escena guardada
- [ ] documentación

---

## HU-GAME-074 — Puerta parental

> **Status:** Draft
> **Epic:** EPIC-026 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-026 — App Shell & Parental

### Prioridad
Must · P1

### Historia
Como **padre/madre**
quiero **un pequeño reto que solo un adulto resuelva antes de entrar en los ajustes**
para **que mi hijo no cambie la configuración, no borre su mundo ni salga de la app por accidente**.

### Contexto
Apple Kids Category y Google Families exigen una puerta parental antes de enlaces externos, compras y ajustes sensibles ([MONETIZATION](../../product/MONETIZATION.md), [GAME_RULES §5](../../product/GAME_RULES.md)). La puerta debe ser **reutilizable** ([MONETIZATION](../../product/MONETIZATION.md): "Puerta parental reutilizable (HU-GAME-074) [NEEDED NOW]") para los ajustes (MVP), el reinicio del mundo (MVP) y las compras reales y enlaces externos futuros.

### Reglas de negocio
- **RN-1 (reto de dos pasos, decidido en [UI_UX_GUIDELINES §4](../../design/UI_UX_GUIDELINES.md)):**
  1. **Mantener pulsado 3 s** el botón de engranaje (anillo de progreso visible). Soltar antes cancela sin feedback negativo. Filtra toques accidentales de los más pequeños.
  2. **Multiplicación de un número de dos cifras por uno de una cifra**, mostrada con dígitos (p. ej. `14 × 3`), con operandos aleatorios `a ∈ 11..19`, `b ∈ 3..9` (resultado entre 33 y 171). El adulto escribe la respuesta en un **teclado numérico propio** (0–9, borrar, confirmar); **no hay opciones múltiples**.
- **RN-2 (justificación):** (a) el enunciado va con dígitos y un texto corto para el adulto, y **no se lee en voz alta** ni se apoya en iconos, así que un niño que no lee no recibe pistas; (b) sin opciones múltiples no se puede acertar tocando al azar (con 3 opciones un niño acertaría 1 de cada 3 veces); (c) una multiplicación de dos cifras por una cifra supera lo que resuelven de memoria la mayoría de niños de 4 a 8 años; (d) el reto cambia cada vez, así que no se puede memorizar; (e) no pide datos personales (una fecha de nacimiento sí lo sería). Riesgo aceptado: un niño de 9–10 años podría resolverlo; es el estándar habitual del sector y se revisa en la prueba con familias.
- **RN-3 (intentos):** tras **3 respuestas incorrectas** seguidas la puerta se cierra y el engranaje queda inactivo **30 s**, con un icono de reloj de arena, sin texto de reproche.
- **RN-4 (inactividad):** si no hay interacción durante **60 s** dentro de la zona de adultos (reto o ajustes), la puerta se cierra.
- **RN-5 (alcance del pase):** superar la puerta abre **solo** el destino pedido y el pase termina al salir de él; volver a entrar exige un reto nuevo.
- **RN-6 (reutilizable):** la puerta es un componente de UI que recibe el destino (`settings`, y en el futuro `externalLink`, `purchase`) y devuelve éxito o cancelación; no contiene lógica de juego.
- **RN-7 (accesibilidad de adulto):** controles ≥ 48 dp; textos para el adulto en el idioma activo; botón de cerrar visible; el botón atrás de Android cierra la puerta.
- **RN-8:** el generador de retos usa el `random` inyectado (tests deterministas); la respuesta nunca se muestra ni se guarda.

### Criterios de aceptación
```gherkin
Scenario: abrir los ajustes superando la puerta
  Given la pantalla de inicio
  When el adulto mantiene pulsado el engranaje 3 s
  Then aparece el reto con una multiplicación y un teclado numérico
  When escribe la respuesta correcta y confirma
  Then se abre la pantalla de ajustes

Scenario: pulsación corta
  Given la pantalla de inicio
  When el niño toca el engranaje durante menos de 3 s
  Then no aparece el reto y no suena ningún rechazo

Scenario: respuesta incorrecta
  Given el reto "14 × 3" con un random fijo
  When se introduce "41" y se confirma
  Then el campo se vacía con un shake y se genera un reto nuevo
  And los ajustes no se abren

Scenario: bloqueo tras tres fallos
  Given tres respuestas incorrectas seguidas
  When se introduce la tercera
  Then la puerta se cierra y el engranaje no responde durante 30 s

Scenario: el pase no se reutiliza
  Given el adulto superó la puerta y cerró los ajustes
  When vuelve a mantener pulsado el engranaje 3 s
  Then se muestra un reto nuevo

Scenario: sin opciones múltiples ni voz
  Given el reto abierto
  When se inspecciona la UI
  Then no hay botones de respuesta predefinida y no se reproduce ningún audio con el enunciado
```
Incluye: AC-REJECT-01 (rechazo amable, sin reproche). Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- App a background con el reto abierto: al volver, la puerta está cerrada (propuesta).
- Respuesta con ceros a la izquierda ("042"): se acepta como 42.
- Lectores de pantalla activos: el enunciado es legible por el lector (lo usa un adulto); es aceptable porque el lector lo activa un adulto en la configuración del dispositivo.
- Idioma cambiado: el texto del reto se muestra en el idioma activo; los dígitos no cambian.

### Dependencias
- HU-GAME-073: pantalla de inicio (punto de entrada del engranaje).

### Consideraciones técnicas
- Componente en `ui/` sin dependencias del motor; el estado de bloqueo (30 s) es de sesión, no se persiste (propuesta).
- Se usará también para compras reales (HU-GAME-115) y enlaces externos: [DESIGNED FOR LATER].
- [NEEDED NOW].

### Assets necesarios
- `ui_btn_settings` con anillo de progreso (placeholder: sí en dev).
- `ui_icon_hourglass`, `ui_parental_bg_01` (placeholder: sí en dev, no en release).
- Textos i18n para el adulto (`parental.title`, `parental.question`).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación del reto de dos pasos, reintentos, bloqueo e inactividad
- [ ] pruebas unitarias del generador con random fijo y de la validación
- [ ] prueba manual con adultos y niños (el niño de 4–7 años no pasa sin ayuda)
- [ ] documentación: justificación del reto en la revisión de cumplimiento de tiendas

---

## HU-GAME-075 — Pantalla de ajustes

> **Status:** Draft
> **Epic:** EPIC-026 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-026 — App Shell & Parental

### Prioridad
Must · P1

### Historia
Como **padre/madre**
quiero **una pantalla de ajustes para el volumen, el silencio, el idioma y reiniciar el mundo**
para **adaptar el juego a mi familia sin que el niño lo cambie por error**.

### Contexto
Los ajustes viven en `player.settings` ([SAVE_SCHEMA §1](../../data/SAVE_SCHEMA.md)) y se cambian con `setSetting { key, value }`; el reinicio con `resetWorld { keepCharacters }` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)). La pantalla es la ruta `settings` ([ARCHITECTURE §3](../../architecture/ARCHITECTURE.md)) y siempre se abre detrás de la puerta parental (HU-GAME-074).

### Reglas de negocio
- **RN-1:** **Toda** la pantalla de ajustes está detrás de la puerta parental ([GAME_RULES §5](../../product/GAME_RULES.md)), desde el Title y desde el botón de ajustes del HUD de juego (propuesta de acceso desde el HUD). Mientras está abierta, el juego queda en `Paused`. Tras 60 s de inactividad se cierra (HU-GAME-074 RN-4).
- **RN-2 (secciones):**
  - **Sonido:** deslizador de música, deslizador de efectos y silencio global (comportamiento en HU-GAME-058). No hay silencio rápido en el HUD en el MVP: los niños usan los botones de volumen del dispositivo.
  - **Idioma:** `es` / `en`, mostrado con el nombre nativo ("Español", "English"). El cambio se aplica al instante a textos y `accessibilityLabel`, sin reiniciar la app.
  - **Mundo:** "Reiniciar el mundo" → flujo de HU-GAME-055.
  - **Información:** versión de la app, versión del pack `core` y `saveVersion` (propuesta; útil para soporte, sin datos personales).
- **RN-3:** Idioma por defecto en la primera ejecución: `es` si el idioma del dispositivo es español; si no, `en` (misma regla que HU-GAME-068 R10).
- **RN-4:** Cada cambio se aplica de inmediato y se guarda vía `playerChanged` → DirtyTracker (debounce de HU-GAME-052). Al cerrar los ajustes se hace flush (propuesta).
- **RN-5:** UI de adultos: puede tener texto; controles ≥ 48 dp; botón de cerrar claro que vuelve a la pantalla anterior (Title o juego).
- **RN-6:** Sin enlaces externos, anuncios, compras ni recogida de datos en el MVP. Cualquier enlace futuro (p. ej. política de privacidad) pedirá de nuevo la puerta parental.
- **RN-7:** El reinicio del mundo conserva los ajustes ([SAVE_SYSTEM §6](../../architecture/SAVE_SYSTEM.md)).

### Criterios de aceptación
```gherkin
Scenario: cambiar el idioma
  Given la app en español y los ajustes abiertos
  When el adulto elige "English"
  Then los textos de ajustes y los accessibilityLabel de la UI pasan a inglés sin reiniciar
  And settings.language es "en"

Scenario: ajustar el sonido
  Given los ajustes abiertos
  When el adulto baja el deslizador de efectos a 0.3
  Then settings.sfxVolume es 0.3 y el siguiente efecto suena a ese volumen

Scenario: iniciar el reinicio del mundo
  Given los ajustes abiertos
  When el adulto toca "Reiniciar el mundo"
  Then se abre el diálogo de confirmación de HU-GAME-055

Scenario: volver al juego
  Given los ajustes abiertos desde el HUD durante el juego
  When el adulto toca cerrar
  Then vuelve a la escena en el mismo estado y el juego sale de "Paused"

Scenario: primera ejecución en un dispositivo en francés
  Given un dispositivo con idioma "fr" y sin guardado
  When arranca la app
  Then settings.language es "en"

@persistence
Scenario: los ajustes persisten
  Given el adulto cambió el idioma a "en" y activó el silencio
  When la app se cierra por completo y se vuelve a abrir
  Then el idioma es "en" y el silencio sigue activo
```
Incluye: AC-PERSIST-02. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- La app pasa a background con los ajustes abiertos: al volver, los ajustes están cerrados y se vuelve a la pantalla anterior (propuesta, coherente con la puerta).
- Claves i18n que faltan en un idioma: imposible en release (el validador exige `es` y `en`).
- Cambio de idioma con el mapa o un diálogo abierto: se actualizan al volver a renderizar.

### Dependencias
- HU-GAME-074: puerta parental.

### Consideraciones técnicas
- Pantalla RN en `app/settings`; lee y escribe solo por la fachada (`selectors.settings()`, `setSetting`).
- `reduceMotion` y `leftHanded` existen en el schema como [DESIGNED FOR LATER]; no se muestran en el MVP.
- [NEEDED NOW].

### Assets necesarios
- `ui_settings_bg_01`, `ui_icon_music`, `ui_icon_sfx`, `ui_icon_mute`, `ui_icon_language`, `ui_icon_reset`, `ui_btn_close` (placeholder: sí en dev, no en release).
- Textos i18n de la pantalla en `es` y `en`.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de las secciones y del cambio de idioma en caliente
- [ ] pruebas de integración de `setSetting` y del idioma por defecto
- [ ] prueba manual en Android e iOS, landscape y 4:3
- [ ] persistencia de los ajustes y conservación tras el reinicio
- [ ] documentación
