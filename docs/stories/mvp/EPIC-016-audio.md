# EPIC-016 — Audio

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [AUDIO_SYSTEM](../../architecture/AUDIO_SYSTEM.md) · [GAME_ENGINE](../../architecture/GAME_ENGINE.md) · [SCENE_SCHEMA](../../data/SCENE_SCHEMA.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [CONTENT_PACK_SCHEMA](../../data/CONTENT_PACK_SCHEMA.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md)

## Objetivo del epic
Que cada acción del niño tenga una respuesta sonora clara (clave para un público que no lee), que cada lugar y habitación tenga su música o ambiente, y que un adulto pueda ajustar o silenciar el volumen. El audio es una consecuencia de los eventos del motor: el `AudioService` (adaptador `expo-audio`) decide qué suena; el motor no reproduce nada.

## Historias
- [HU-GAME-056 — Sonidos de interacción](#hu-game-056--sonidos-de-interacción)
- [HU-GAME-057 — Música y ambiente por ubicación](#hu-game-057--música-y-ambiente-por-ubicación)
- [HU-GAME-058 — Control de volumen y silencio](#hu-game-058--control-de-volumen-y-silencio)

---

## HU-GAME-056 — Sonidos de interacción

> **Status:** Draft
> **Epic:** EPIC-016 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-016 — Audio

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **oír un sonido distinto al coger, soltar, comer, abrir o encender cosas**
para **saber sin leer que lo que hice funcionó (o que no se puede)**.

### Contexto
[AUDIO_SYSTEM §2](../../architecture/AUDIO_SYSTEM.md) define el mapeo evento → rol → clave de audio, con fallback global. Las claves por entidad están en el componente `sounds` ([ENTITY_SCHEMA §5.16](../../data/ENTITY_SCHEMA.md)); los globales viven en `content/core/assets.json` ([CONTENT_PACK_SCHEMA §3](../../data/CONTENT_PACK_SCHEMA.md)).

### Reglas de negocio
- **RN-1:** Mapeo:

| Evento | Rol | Clave (entidad → fallback) |
|---|---|---|
| `entityMoved` escena → drag/held | `pickup` | `sounds.pickup` → `sfx_pickup_default` |
| drop con `place` | `drop` | `sounds.drop` → `sfx_drop_default` |
| `interactionPerformed` (acción X) | `eat`, `drink`, `open`, `close`, `toggle`, `spawn`, `use`… | `sounds[<rol>]` de la entidad principal → fallback por tipo de acción |
| `interactionRejected` | — | `sfx_reject_soft` (global) |
| `walletChanged` con delta > 0 | — | `sfx_coin` (global) |
| botón de UI | — | `sfx_ui_tap` (global) |

- **RN-2:** El motor solo conoce **nombres de rol**; nunca rutas ni archivos.
- **RN-3:** Polifonía máxima: **6 efectos simultáneos**. Un efecto del **mismo tipo** que llega antes de **80 ms** desde el anterior se descarta.
- **RN-4:** Si una clave tiene variantes (`sfx_drop_soft_01..03`), se elige una al azar con el `random` inyectado. Variación de pitch ±5 %: [DESIGNED FOR LATER].
- **RN-5:** Al entrar en una escena se precargan sus efectos: target **≤ 30**, warning > 45, critical > 60 ([PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos)). Los globales (UI, rechazo, moneda, fallbacks) están siempre cargados.
- **RN-6:** Formato: `.m4a` AAC mono, 44,1 kHz, 96–128 kbps, ≤ 1,5 s, normalizado ~−16 LUFS ([AUDIO_SYSTEM §4](../../architecture/AUDIO_SYSTEM.md)).
- **RN-7:** Con `muted = true` o `sfxVolume = 0` no se reproduce nada (HU-GAME-058).
- **RN-8:** En background se cortan los efectos; no hay audio en background.

### Criterios de aceptación
```gherkin
Scenario: sonido propio de la entidad
  Given un objeto con `edible` y sounds.eat "sfx_eat_crunch" (una manzana)
  When un personaje se lo come
  Then el AudioService recibe la petición de reproducir "sfx_eat_crunch"

Scenario: fallback global
  Given un objeto con `draggable` sin sounds.drop
  When el jugador lo suelta en el suelo
  Then se reproduce "sfx_drop_default"

Scenario: rechazo suave
  Given un contenedor abierto y lleno
  When el jugador suelta un objeto en su zona "inside"
  Then se reproduce "sfx_reject_soft"

Scenario: descarte anti-ametralladora
  Given un reloj falso
  When llegan dos efectos "drop" con 50 ms de diferencia
  Then solo se reproduce el primero

Scenario: límite de 6 simultáneos
  Given 6 efectos sonando
  When llega un séptimo efecto de otro tipo
  Then no hay más de 6 efectos sonando a la vez

Scenario: variantes
  Given la clave de rol "drop" con variantes "sfx_drop_soft_01..03" y un random fijo
  When se sueltan objetos 3 veces separadas por más de 80 ms
  Then la secuencia de variantes coincide con la del random inyectado
```
Incluye: AC-A11Y-01 (el feedback sonoro acompaña a cada interacción esencial), AC-PERF-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Clave de audio inexistente: imposible en release (validador); en dev, `logger.warn` y silencio.
- Muchos objetos soltados a la vez (mover un contenedor): la regla de 80 ms evita la ráfaga.
- Evento durante una transición: se reproduce si el efecto es global; los de la escena anterior se liberan al descargarla.

### Dependencias
- HU-GAME-031: resolver interacciones (fuente de `interactionPerformed`/`interactionRejected`).

### Consideraciones técnicas
- `AudioService` en `engine/adapters/audio` suscrito al EventBus vía GameFacade. La política de polifonía y dedupe es lógica pura testeable con un reproductor falso.
- ⚠️ Verificar la API de `expo-audio` en Expo SDK 57 antes de implementar ([AUDIO_SYSTEM §1](../../architecture/AUDIO_SYSTEM.md)).
- [NEEDED NOW].

### Assets necesarios
- Globales: `sfx_pickup_default`, `sfx_drop_default`, `sfx_reject_soft`, `sfx_coin`, `sfx_ui_tap` (placeholder: sí en dev, no en release).
- Fallback por acción: `sfx_eat_default`, `sfx_drink_default`, `sfx_open_default`, `sfx_close_default`, `sfx_toggle_default`, `sfx_spawn_default` (propuesta de nombres; placeholder: sí en dev).
- Variantes: `sfx_drop_soft_01`, `sfx_drop_soft_02`, `sfx_drop_soft_03`.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación del mapeo, fallback, polifonía, dedupe y precarga
- [ ] pruebas unitarias de la política con reproductor y reloj falsos
- [ ] prueba manual en Android e iOS (sin cortes ni saturación)
- [ ] documentación

---

## HU-GAME-057 — Música y ambiente por ubicación

> **Status:** Draft
> **Epic:** EPIC-016 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-016 — Audio

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **que cada lugar y cada habitación suenen distinto**
para **sentir que estoy en otro sitio cuando me muevo por la casa o salgo a la calle**.

### Contexto
La música y el ambiente se declaran por escena (`scene.audio`) y por zona (`zone.audio`) en [SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md). La zona activa se calcula con `zoneAt(cameraCenterX)` ([SCENE_SYSTEM §3](../../architecture/SCENE_SYSTEM.md)). Reglas de música en [AUDIO_SYSTEM §3](../../architecture/AUDIO_SYSTEM.md).

### Reglas de negocio
- **RN-1:** Pista efectiva = `zone.audio.music` → `scene.audio.music`; ambiente efectivo = `zone.audio.ambience` → `scene.audio.ambience`.
- **RN-2:** Una pista de música en bucle + un ambiente como máximo a la vez (target: 1 música en streaming + 1 ambiente; critical: > 2 simultáneas, [PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos)). La música no se precarga entera.
- **RN-3:** **Crossfade de 800 ms** al cambiar de zona o de escena. Si la nueva zona usa la misma pista, **no se reinicia**.
- **RN-4:** El `AudioService` reacciona al evento `zoneChanged { sceneId, zoneId? }` (emitido tras `cameraSettled { cameraX }`) y consulta `selectors.activeZone()` ([GAME_ENGINE §4–6](../../architecture/GAME_ENGINE.md)); nunca evalúa la zona por frame.
- **RN-5:** En `sceneWillChange` se hace fade out; en `sceneLoaded` suena la pista de la zona de llegada (HU-GAME-050).
- **RN-6:** En background la música se pausa; al volver se reanuda desde donde estaba.
- **RN-7:** Sesión de audio "ambient"/"mix with others": la app **no** interrumpe la música del usuario ni reproduce en background. ⚠️ Verificar la opción en `expo-audio`.
- **RN-8:** Loops sin corte: `.m4a` AAC estéreo 128–160 kbps, probado en dispositivo.

### Criterios de aceptación
```gherkin
Scenario: ambiente propio de la cocina
  Given "core:home" con música de escena "mus_home_calm_01" y la zona "kitchen" con ambience "amb_kitchen_fridge_hum"
  When la cámara se detiene en la cocina y se emite zoneChanged con zoneId "kitchen"
  Then "mus_home_calm_01" sigue sonando sin reiniciarse
  And "amb_kitchen_fridge_hum" entra con un crossfade de 800 ms

Scenario: cambio de escena con crossfade
  Given suena "mus_home_calm_01"
  When el jugador viaja a "core:street" con música "mus_street_day_01"
  Then la música cambia a "mus_street_day_01" con crossfade de 800 ms

Scenario: misma pista no se reinicia
  Given dos zonas contiguas que resuelven la misma pista
  When la cámara pasa de una a otra
  Then la posición de reproducción de la pista no vuelve a 0

Scenario: pausa en background
  Given suena música
  When la app pasa a background
  Then la música se pausa
  And al volver a foreground se reanuda

Scenario: escena sin audio declarado
  Given una escena de test sin scene.audio ni zone.audio
  When se entra en ella
  Then no suena música y no hay errores
```
Incluye: AC-PERF-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Paneo rápido que cruza varias zonas: como `cameraSettled` solo llega al terminar el paneo o la inercia, solo la zona final dispara crossfade (si uno está en curso, se parte del volumen actual).
- Música del usuario sonando (otra app): se mezcla, no se detiene.
- `muted` activado durante un crossfade: el silencio se aplica de inmediato.

### Dependencias
- HU-GAME-012: zonas dentro de una escena.

### Consideraciones técnicas
- `AudioService` escucha `sceneLoaded` y `zoneChanged` por el GameFacade.
- Música adaptativa por capas: [DESIGNED FOR LATER]. Audio posicional: [NOT NEEDED YET].

### Assets necesarios
- `mus_title_01` (pantalla de inicio, propuesta), `mus_home_calm_01`, `mus_street_day_01`, `mus_store_happy_01` (placeholder: sí en dev, no en release).
- `amb_kitchen_fridge_hum`, `amb_bathroom_drip_01`, `amb_street_birds_01`, `amb_store_murmur_01` (propuesta; placeholder: sí en dev).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de la resolución zona → escena y del crossfade
- [ ] pruebas unitarias con reproductor y reloj falsos
- [ ] prueba manual de loops sin corte en Android e iOS
- [ ] documentación

---

## HU-GAME-058 — Control de volumen y silencio

> **Status:** Draft
> **Epic:** EPIC-016 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-016 — Audio

### Prioridad
Must · P1

### Historia
Como **padre/madre**
quiero **ajustar por separado el volumen de la música y de los efectos, o silenciarlo todo**
para **adaptar el juego al lugar y al momento sin tener que salir de la app**.

### Contexto
Los ajustes de audio viven en `player.settings` (`musicVolume`, `sfxVolume` en 0..1, `muted`) ([SAVE_SCHEMA §1](../../data/SAVE_SCHEMA.md)). Se modifican con el comando `setSetting` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)) desde la pantalla de Ajustes (HU-GAME-075), que está detrás de la puerta parental.

### Reglas de negocio
- **RN-1:** Tres controles: deslizador de música (0..1), deslizador de efectos (0..1) y conmutador de silencio global.
- **RN-2:** Los cambios se aplican **de inmediato** (la música en curso cambia de volumen sin reiniciarse; al mover el deslizador de efectos suena `sfx_ui_tap` como muestra).
- **RN-3:** `muted = true` silencia música, ambiente y efectos, pero **conserva** los valores de los deslizadores; al desactivarlo se recuperan.
- **RN-4:** Volumen efectivo = `volumen de la clave en assets.json` × `settings.<tipo>Volume` × (muted ? 0 : 1). El ambiente usa `musicVolume` (propuesta).
- **RN-5:** Valores por defecto de partida nueva (propuesta): `musicVolume 0.6`, `sfxVolume 0.9`, `muted false` (los del ejemplo de [SAVE_SCHEMA §6](../../data/SAVE_SCHEMA.md)).
- **RN-6:** Paso de los deslizadores: 0,1 (propuesta). Objetivos táctiles ≥ 48 dp (UI de adultos).
- **RN-7:** Persisten vía `playerChanged` → DirtyTracker (debounce de HU-GAME-052); el reinicio del mundo los conserva (HU-GAME-055).

### Criterios de aceptación
```gherkin
Scenario: bajar la música
  Given musicVolume 0.6 y una pista sonando
  When el adulto mueve el deslizador de música a 0.2
  Then el volumen de la pista pasa a 0.2 × volumen base sin reiniciarla
  And settings.musicVolume es 0.2

Scenario: silenciar todo
  Given música y efectos activos
  When el adulto activa el silencio
  Then no suena ningún efecto al interactuar y la música queda en silencio
  And musicVolume y sfxVolume conservan sus valores

Scenario: quitar el silencio
  Given muted true con musicVolume 0.4
  When el adulto desactiva el silencio
  Then la música vuelve a sonar a 0.4 × volumen base

@persistence
Scenario: los ajustes persisten
  Given el adulto dejó sfxVolume en 0.3
  When la app se cierra por completo y se vuelve a abrir
  Then sfxVolume es 0.3 y los efectos suenan a ese volumen
```
Incluye: AC-PERSIST-02. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Volumen 0 en ambos deslizadores con `muted = false`: equivalente a silencio, sin errores.
- Volumen del sistema del dispositivo a 0: la app no lo modifica.
- Cambiar ajustes mientras se reproduce un crossfade: el crossfade continúa hacia el nuevo volumen.

### Dependencias
- HU-GAME-056: sonidos de interacción.
- HU-GAME-075: pantalla de ajustes.

### Consideraciones técnicas
- El `AudioService` lee `selectors.settings()` y se suscribe a `playerChanged`.
- No hay botón de silencio rápido en el HUD en el MVP: todo el audio se controla en Ajustes, detrás de la puerta parental, y los niños usan los botones de volumen del dispositivo.
- [NEEDED NOW].

### Assets necesarios
- `ui_icon_music`, `ui_icon_sfx`, `ui_icon_mute`: iconos de los controles (placeholder: sí en dev).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de los tres controles y su aplicación inmediata
- [ ] pruebas de integración de `setSetting` y del volumen efectivo
- [ ] persistencia tras cerrar la app
- [ ] documentación
