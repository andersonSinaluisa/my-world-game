# EPIC-018 — Street

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 2
> **Docs:** [MVP_SCOPE](../../product/MVP_SCOPE.md#objetos) · [SCENE_SCHEMA](../../data/SCENE_SCHEMA.md) · [SCENE_SYSTEM](../../architecture/SCENE_SYSTEM.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [RENDERING](../../architecture/RENDERING.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md)

## Objetivo del epic
Crear la escena `core:street` (5760 × 1080 world units): una acera con la fachada de la casa, un parque pequeño y la fachada de la tienda, que conecta las dos ubicaciones interiores mediante portales y tiene sus propios objetos interactivos. Es una historia de contenido: la calle es calle por sus datos, no por código.

## Historias
- [HU-GAME-063 — Calle jugable](#hu-game-063--calle-jugable)

---

## HU-GAME-063 — Calle jugable

> **Status:** Draft
> **Epic:** EPIC-018 · **Fase:** 2 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-018 — Street

### Prioridad
Must · P1

### Historia
Como **jugador**
quiero **salir de casa a una calle con un banco, una farola y un buzón, y ver la tienda al fondo**
para **sentir que mi mundo es más grande que mi casa y poder ir de compras**.

### Contexto
La calle es la escena de conexión del MVP ([SCENE_SYSTEM §1](../../architecture/SCENE_SYSTEM.md)): `home_door` ↔ `core:home/front_door` y `store_door` ↔ `core:store/entrance`. Tiene 5 prefabs interactivos ([MVP_SCOPE](../../product/MVP_SCOPE.md#objetos)). Al tener 5760 unidades, depende de fondos por chunks y culling (HU-GAME-008).

### Reglas de negocio
- **RN-1 (escena):** `content/core/scenes/street.json`; `id: street`, `location: street`, `size { width: 5760, height: 1080 }`, `floor [{ y: 960 }]`, `audio { music: mus_street_day_01, ambience: amb_street_birds_01 }`.
- **RN-2 (fondos):** capa `sky` con `parallax` 0,5 (propuesta) y capa `street` con 3 chunks de 1920: `env_street_bg_home_01` (x 0), `env_street_bg_park_01` (x 1920), `env_street_bg_store_01` (x 3840). Ningún chunk supera 2048 px.
- **RN-3 (zonas, propuesta):** `home_front` 0–1920 (snap 960), `park` 1920–3840 (snap 2880), `store_front` 3840–5760 (snap 4800). La vista de 1440 unidades centrada en cada snap incluye los elementos esenciales **y los portales** de la zona ([ENVIRONMENT_GUIDELINES §1](../../design/ENVIRONMENT_GUIDELINES.md)): `home_door` (x 700) en `home_front` y `store_door` (x 4820) en `store_front`.
- **RN-4 (spawns):** `default` (960, 960), `home_door` (820, 960, `facing: right`), `store_door` (4700, 960, `facing: left`) (propuesta de posiciones).
- **RN-5 (prefabs de la calle, 5):**

| localId | prefabId | Capacidades | Tags | Sprite | x (propuesta) |
|---|---|---|---|---|---|
| `home_door` | `core:door_home_outside` | `portal` (`core:home` / `front_door`), `states` + `openable` (tap abre) | door | `env_street_door_home` / `_open` | 700 |
| `store_door` | `core:door_store` | `portal` (`core:store` / `entrance`), `states` + `openable` | door | `env_street_door_store` / `_open` | 4820 |
| `bench` | `core:bench_park` | `seat` (capacidad 1 en MVP), `surface` (propuesta) | furniture | `env_street_bench_park_green` | 2700 |
| `street_lamp` | `core:street_lamp` | `states` off/on, `switchable` | furniture, light | `env_street_lamp_off` / `_on` | 3200 |
| `mailbox` | `core:mailbox` | `states` closed/open, `openable`, `container` (capacidad 4 propuesta; `rejects` por defecto: `character`, `furniture`) | furniture | `env_street_mailbox_blue_closed` / `_open` | 1500 |

- **RN-6:** al completar esta HU se añade a `core:home/front_door` el override `portal { targetSceneId: core:street, targetSpawnId: home_door }` (queda pendiente desde HU-GAME-059).
- **RN-7:** los muebles de la calle no son arrastrables en el MVP (propuesta): son mobiliario urbano fijo.
- **RN-8:** la calle es accesible desde el principio ([GAME_RULES R7](../../product/GAME_RULES.md)); `core:street` está en `newGame.unlocks` del manifest `core`.
- **RN-9:** el manifest del pack `core` declara la ubicación de mapa `street` (`provides.locations`, icono `ui_map_street`, `entrySceneId: core:street`, `entrySpawnId: default`).
- **RN-10:** sonidos: `sfx_mailbox_open`, `sfx_mailbox_close`, `sfx_switch_click`, `sfx_door_open`.

### Criterios de aceptación
```gherkin
Scenario: salir de casa a la calle
  Given un personaje en "core:home"
  When el jugador lo suelta sobre la puerta de entrada
  Then el personaje aparece en "core:street" en el spawn "home_door"

Scenario: ir de la calle a la tienda y volver
  Given un personaje en "core:street"
  When el jugador lo suelta sobre la puerta de la tienda
  Then el personaje aparece en "core:store" en el spawn "entrance"

Scenario: sentarse en el banco
  Given el banco libre
  When el jugador suelta un personaje sobre el banco
  Then el personaje queda con pose "sit" anclado al banco

Scenario: encender la farola
  Given la farola en "off"
  When el jugador la toca
  Then pasa a "on"

Scenario: dejar algo en el buzón
  Given el buzón abierto con espacio y un personaje que trajo una manzana en la mano
  When el jugador suelta la manzana en la zona "inside" del buzón
  Then la manzana tiene location container de "core:street/mailbox"

Scenario: validación del contenido
  Given el pack core
  When se ejecuta "npm run content:validate"
  Then "scenes/street.json" no tiene errores y los portales apuntan a escenas y spawns existentes

@persistence
Scenario: la calle persiste
  Given la farola encendida, una manzana en el buzón y un personaje sentado en el banco
  When el jugador vuelve a casa, cierra la app, la abre y regresa a la calle
  Then la farola sigue "on", la manzana sigue en el buzón y el personaje sigue sentado en el banco

@performance @manual
Scenario: paneo fluido en la calle
  Given una build release en el Android de referencia
  When el jugador panea la calle de punta a punta 10 veces
  Then el overlay no muestra caídas del UI thread por debajo de 55 fps de media
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-REJECT-01 (buzón cerrado o lleno), AC-PERF-01, AC-A11Y-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Buzón cerrado: soltar encima apoya el objeto (`place`); lleno: rechazo amable.
- Objeto soltado en la calle sin personaje: se queda en la calle y persiste (se puede recoger después).
- Soltar un personaje sobre la puerta de casa estando sentado en el banco antes: `standUp` implícito al empezar el drag.
- Tablet 4:3 (~1440 unidades visibles): la puerta de la casa y su spawn quedan en la ventana de `home_front`.

### Dependencias
- HU-GAME-008: culling y carga de fondos por chunks.
- HU-GAME-035: guardar objetos en contenedores (buzón).
- HU-GAME-045: sentarse en asientos (banco).
- HU-GAME-047: objetos encendibles (farola).
- HU-GAME-049: puertas y portales entre escenas.

### Consideraciones técnicas
- Solo contenido: `scenes/street.json`, prefabs, `assets.json`, `locales`, override del portal en `home.json`.
- Entidades cargadas esperadas < 50 (target ≤ 300, [PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos)).
- Monedas escondidas en la calle: las coloca HU-GAME-067 (P2).
- [NEEDED NOW] (Fase 2).

### Assets necesarios
- Fondos: `env_street_bg_sky_01`, `env_street_bg_home_01`, `env_street_bg_park_01`, `env_street_bg_store_01`.
- Mobiliario: `env_street_door_home`, `env_street_door_home_open`, `env_street_door_store`, `env_street_door_store_open`, `env_street_bench_park_green`, `env_street_lamp_off`, `env_street_lamp_on`, `env_street_mailbox_blue_closed`, `env_street_mailbox_blue_open`.
- Audio: `mus_street_day_01`, `amb_street_birds_01`, `sfx_mailbox_open`, `sfx_mailbox_close`, `sfx_door_open`.
- UI: `ui_map_street`.
- Placeholder aceptable: sí en desarrollo de Fase 2 (marcado `placeholder: true`), no en release.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación: escena `core:street`, 5 prefabs y override del portal de la casa
- [ ] pruebas: escenario headless casa → calle → tienda → calle → casa y de cada capacidad
- [ ] rendimiento: paneo y transición medidos en release con el overlay
- [ ] persistencia: AC-PERSIST-01/02
- [ ] documentación: `content:validate` en verde; ubicación `street` en el manifest
