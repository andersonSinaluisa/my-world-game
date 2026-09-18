# EPIC-019 — Store

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 2
> **Docs:** [MVP_SCOPE](../../product/MVP_SCOPE.md#objetos) · [SCENE_SCHEMA](../../data/SCENE_SCHEMA.md) · [SCENE_SYSTEM](../../architecture/SCENE_SYSTEM.md) · [ENTITY_SCHEMA §5.14](../../data/ENTITY_SCHEMA.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [GAME_RULES §4](../../product/GAME_RULES.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md)

## Objetivo del epic
Crear la escena `core:store` (3840 × 1080 world units) con entrada, estanterías y caja registradora, llena de productos que son **instancias de prefabs existentes** con el componente `purchasable`. La tienda se comporta como tienda **solo** por sus entidades `purchasable` y la entidad con tag `checkout`: no existe ningún `if sceneId === 'store'` ([SCENE_SYSTEM §5](../../architecture/SCENE_SYSTEM.md)). La lógica de compra es de EPIC-020.

## Historias
- [HU-GAME-064 — Tienda jugable](#hu-game-064--tienda-jugable)

---

## HU-GAME-064 — Tienda jugable

> **Status:** Draft
> **Epic:** EPIC-019 · **Fase:** 2 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-019 — Store

### Prioridad
Must · P1

### Historia
Como **jugador**
quiero **entrar en una tienda con estantes llenos de comida, juguetes y ropa, y una caja registradora**
para **elegir cosas nuevas, pagarlas con mis monedas y llevármelas a casa**.

### Contexto
La tienda tiene 3 prefabs propios (estantería `surface`, caja registradora con tag `checkout`, expositor refrigerado `container`) y productos ([MVP_SCOPE](../../product/MVP_SCOPE.md#objetos)). Cada producto es una instancia con override `purchasable { price, restock, origin }` ([ENTITY_SCHEMA §5.14](../../data/ENTITY_SCHEMA.md)). Reposición: al comprar, se crea en `origin` una copia sin comprar (stock infinito, [GAME_RULES §4](../../product/GAME_RULES.md)).

### Reglas de negocio
- **RN-1 (escena):** `content/core/scenes/store.json`; `id: store`, `location: store`, `size { width: 3840, height: 1080 }`, `floor [{ y: 960 }]`, `audio { music: mus_store_happy_01, ambience: amb_store_murmur_01 }`; 2 chunks de fondo de 1920: `env_store_bg_entrance_01` (x 0), `env_store_bg_checkout_01` (x 1920).
- **RN-2 (zonas, propuesta):** `entrance` 0–1280 (snap 640), `shelves` 1280–2560 (snap 1920), `checkout` 2560–3840 (snap 3200). La vista de 1440 u centrada en cada snap incluye los elementos esenciales y los portales de la zona (la puerta `entrance_door` en `entrance`).
- **RN-3 (spawns):** `default` (500, 960) y `entrance` (360, 960, `facing: right`) (propuesta de posiciones).
- **RN-4 (prefabs de la tienda, 3 + puerta):**

| localId | prefabId | Capacidades | Tags | Sprite | x (propuesta) |
|---|---|---|---|---|---|
| `entrance_door` | `core:door_store_inside` | `portal` (`core:street` / `store_door`), `states` + `openable` | door | `env_store_door_entrance` / `_open` | 200 |
| `shelf_1`, `shelf_2`, `shelf_3` | `core:store_shelf` | `surface` (3 baldas) | furniture | `env_store_shelf_wood` | 1350 / 1900 / 2450 |
| `register` | `core:cash_register` | `hitbox` con zona `body`, `surface` (mostrador, propuesta) | furniture, **checkout** | `env_store_register_01` | 3200 |
| `fridge_display` | `core:fridge_display` | `states` closed/open, `openable` (propuesta), `container` (6, `accepts: [food, drink]`) | furniture, appliance | `env_store_fridge_display_closed` / `_open` | 850 |

- **RN-5 (productos, propuesta de surtido y precios en el rango 2–30 de [GAME_RULES §4](../../product/GAME_RULES.md)):**

| localId | prefabId | Precio | Ubicación |
|---|---|---|---|
| `p_apple` | `core:apple_red` | 2 | `shelf_1` baldas |
| `p_banana` | `core:banana` | 2 | `shelf_1` |
| `p_cookie` | `core:cookie` | 2 | `shelf_1` |
| `p_sandwich` | `core:sandwich` | 4 | `fridge_display` slot 0 |
| `p_cake` | `core:cake_slice` | 5 | `fridge_display` slot 1 |
| `p_milk` | `core:milk_carton` | 3 | `fridge_display` slot 2 |
| `p_juice` | `core:juice_glass` | 3 | `fridge_display` slot 3 |
| `p_ball` | `core:ball_red` | 8 | `shelf_2` |
| `p_duck` | `core:rubber_duck` | 6 | `shelf_2` |
| `p_blocks` | `core:toy_blocks` | 12 | `shelf_2` |
| `p_teddy` | `core:teddy_bear` | 15 | `shelf_2` |
| `p_cloth_1..4` | 4 prendas del catálogo `core` (1 superior, 1 inferior, 2 zapatos; EPIC-011) | 10–20 | `shelf_3` |

- **RN-6:** cada producto lleva `overrides.purchasable { price }`; `restock` por defecto `true`; `origin` por defecto = transform inicial de la escena (`{x, y}`) o, para los productos declarados con `inContainer`, `{ containerId, slot }` de su slot inicial ([ENTITY_SCHEMA §5.14](../../data/ENTITY_SCHEMA.md)).
- **RN-7:** mientras `purchased = false`, el producto se puede arrastrar dentro de la tienda, pero no puede salir (portal o mochila rechazados, HU-GAME-066) y, si queda fuera de su estante, **vuelve a `origin`** al salir de la tienda o al recargar la escena.
- **RN-8:** sobre cada producto sin comprar se muestra una etiqueta de precio (icono de moneda + número), dibujada de forma genérica para toda entidad con `purchasable.purchased = false` (propuesta; no depende de la escena).
- **RN-9:** la tienda es accesible desde el principio (`core:store` en `newGame.unlocks`) y aparece en el mapa (`provides.locations`, icono `ui_map_store`, `entrySceneId: core:store`, `entrySpawnId: entrance`).
- **RN-10:** sonidos: `sfx_register_ching` (compra, rol `use` de la caja), `sfx_fridge_open`, `sfx_fridge_close`, `sfx_door_bell`.

### Criterios de aceptación
```gherkin
Scenario: entrar en la tienda
  Given un personaje en "core:street"
  When el jugador lo suelta sobre la puerta de la tienda
  Then aparece en "core:store" en el spawn "entrance"
  And los productos se ven con su etiqueta de precio

Scenario: la tienda es tienda por sus datos
  Given una escena de test que no es "core:store" con una entidad con tag "checkout" y un producto con `purchasable`
  When el jugador suelta el producto sobre la entidad "checkout" con monedas suficientes
  Then la compra se realiza igual que en "core:store"

Scenario: coger un producto del expositor refrigerado
  Given el expositor abierto con el sándwich en el slot 0
  When el jugador arrastra el sándwich fuera del expositor
  Then el sándwich queda en la escena con purchased false

Scenario: un producto del expositor vuelve a su slot
  Given el sándwich sin comprar sacado del slot 0 del expositor y soltado en el suelo
  When el jugador sale de la tienda y vuelve a entrar
  Then el sándwich tiene location container del expositor en el slot 0

Scenario: el producto vuelve a su sitio al salir
  Given un producto sin comprar soltado en el suelo lejos de su estante
  When el jugador sale de la tienda y vuelve a entrar
  Then el producto está en su origin

Scenario: reposición tras comprar
  Given el producto "p_ball" sin comprar en su origin
  When el jugador lo compra en la caja
  Then existe una nueva entidad rt_ del mismo prefab con purchased false en el origin de "p_ball"

Scenario: validación del contenido
  Given el pack core
  When se ejecuta "npm run content:validate"
  Then "scenes/store.json" no tiene errores y todos los productos tienen purchasable.price entre 2 y 30

@persistence
Scenario: un personaje dejado en la tienda sigue allí
  Given un personaje dejado junto a la caja
  When el jugador vuelve a casa, cierra la app, la abre y regresa a la tienda
  Then el personaje sigue junto a la caja
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-REJECT-01, AC-PERF-01, AC-A11Y-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Producto sin comprar soltado en otro estante o fuera del expositor: al salir de la tienda o recargar la escena vuelve a su `origin` (posición o slot del expositor). Si el slot de origen está ocupado, va al primer slot libre del mismo contenedor o, si no hay, delante de él (propuesta).
- Producto sin comprar soltado sobre un personaje (comer, beber, vestir): no pasa nada porque esas reglas exigen `isPurchased` (HU-GAME-066 RN-6).
- Objeto comprado que el niño deja en la tienda: es suyo y se queda donde lo dejó (no vuelve a `origin`).
- Estante movido: los estantes no son arrastrables (propuesta).

### Dependencias
- HU-GAME-035: guardar objetos en contenedores (expositor refrigerado).
- HU-GAME-049: puertas y portales.
- HU-GAME-066: comprar objetos.

### Consideraciones técnicas
- Solo contenido, salvo la etiqueta de precio (render genérico por componente, sin conocer la escena).
- La vuelta a `origin` y la reposición son del `EconomySystem`/`SceneService` según [ENTITY_SCHEMA §5.14](../../data/ENTITY_SCHEMA.md); esta HU solo declara los datos.
- Entidades cargadas esperadas < 60 (target ≤ 300).
- [NEEDED NOW] (Fase 2).

### Assets necesarios
- Fondos: `env_store_bg_entrance_01`, `env_store_bg_checkout_01`.
- Mobiliario: `env_store_door_entrance`, `env_store_door_entrance_open`, `env_store_shelf_wood`, `env_store_register_01`, `env_store_fridge_display_closed`, `env_store_fridge_display_open`.
- UI: `ui_price_tag`, `ui_icon_coin`, `ui_map_store`.
- Audio: `mus_store_happy_01`, `amb_store_murmur_01`, `sfx_register_ching`, `sfx_door_bell`.
- Los productos reutilizan los sprites de los prefabs de la casa y de la ropa.
- Placeholder aceptable: sí en desarrollo de Fase 2, no en release.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación: escena `core:store`, 3 prefabs, puerta y surtido de productos
- [ ] pruebas: escenario headless de entrar, coger, volver a `origin`, comprar y reponer; test "sin lógica de escena" con una escena de test
- [ ] rendimiento: AC-PERF-01 en la tienda llena
- [ ] persistencia: AC-PERSIST-01/02
- [ ] documentación: `content:validate` en verde
