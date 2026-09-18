# EPIC-017 — Home

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [MVP_SCOPE](../../product/MVP_SCOPE.md#objetos) · [SCENE_SCHEMA](../../data/SCENE_SCHEMA.md) · [OBJECT_SCHEMA](../../data/OBJECT_SCHEMA.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [INVENTORY_SYSTEM](../../architecture/INVENTORY_SYSTEM.md) · [RENDERING](../../architecture/RENDERING.md) · [AUDIO_SYSTEM](../../architecture/AUDIO_SYSTEM.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md) · [GAME_RULES](../../product/GAME_RULES.md)

## Objetivo del epic
Llenar la escena `core:home` (una sola escena de 7680 × 1080 world units con cuatro zonas: salón, cocina, dormitorio y baño) con los **38 prefabs** de la casa definidos en [MVP_SCOPE](../../product/MVP_SCOPE.md#objetos), colocados por datos, de modo que cada objeto funcione según sus capacidades y todo lo que el niño cambie persista. Son historias **de contenido**: no se escribe código de motor; si algo parece requerirlo, se revisa [INTERACTION_SYSTEM §7](../../architecture/INTERACTION_SYSTEM.md).

## Historias
- [HU-GAME-059 — Salón jugable](#hu-game-059--salón-jugable)
- [HU-GAME-060 — Cocina jugable](#hu-game-060--cocina-jugable)
- [HU-GAME-061 — Dormitorio jugable](#hu-game-061--dormitorio-jugable)
- [HU-GAME-062 — Baño jugable](#hu-game-062--baño-jugable)

---

## HU-GAME-059 — Salón jugable

> **Status:** Draft
> **Epic:** EPIC-017 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-017 — Home

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **un salón con sofá, tele, lámpara, caja de juguetes y juguetes**
para **sentar a mis personajes, encender cosas y jugar con juguetes como en una casa de muñecas**.

### Contexto
Primera zona de `core:home` y lugar de aparición por defecto. Esta HU también crea el **esqueleto de la escena** `content/core/scenes/home.json` (tamaño, fondos por chunks, suelo, las cuatro zonas, spawns y música), que reutilizan HU-GAME-060 a 062. Formato en [SCENE_SCHEMA §2–4](../../data/SCENE_SCHEMA.md); prefabs en [OBJECT_SCHEMA](../../data/OBJECT_SCHEMA.md).

### Reglas de negocio
- **RN-1 (escena):** `core:home`, `size { width: 7680, height: 1080 }`, `floor [{ y: 960 }]`, `audio.music = mus_home_calm_01`, capa de fondo `walls` con 4 chunks de 1920: `env_home_bg_living_01` (x 0), `env_home_bg_kitchen_01` (x 1920), `env_home_bg_bedroom_01` (x 3840), `env_home_bg_bathroom_01` (x 5760).
- **RN-2 (zonas):** `living` 0–1920 (snap 720), `kitchen` 1920–3840 (snap 2880, ambience `amb_kitchen_fridge_hum`), `bedroom` 3840–5760 (snap 4800), `bathroom` 5760–7680 (snap 6720, ambience `amb_bathroom_drip_01` propuesta).
- **RN-3 (spawns):** `default` (700, 960) y `front_door` (150, 960, `facing: right`).
- **RN-4 (encuadre, regla de 1440 u):** la vista de 1440 unidades centrada en `snapCameraX` (caso iPad, [RENDERING §2.1](../../architecture/RENDERING.md)) incluye todos los elementos esenciales **y los portales** de la zona ([ENVIRONMENT_GUIDELINES §1](../../design/ENVIRONMENT_GUIDELINES.md)). Salón: 0–1440, incluida la puerta de entrada (x 120) y su spawn.
- **RN-5 (prefabs del salón, 10):** posiciones = propuesta; `y` = 960 salvo indicación.

| localId | prefabId | Capacidades (componentes) | Tags | Sprite (asset key) | x |
|---|---|---|---|---|---|
| `sofa` | `core:sofa_blue` | `seat` (capacidad 1), `draggable floorOnly` | furniture | `env_home_sofa_blue` | 900 |
| `armchair` | `core:armchair_red` | `seat`, `draggable floorOnly` | furniture | `env_home_armchair_red` | 1230 |
| `coffee_table` | `core:coffee_table` | `surface`, `draggable floorOnly` | furniture | `env_home_coffee_table_wood` | 1080 |
| `tv` | `core:tv_retro` | `states` off/on, `switchable`, `draggable floorOnly` | furniture, appliance | `env_home_tv_retro_off` / `_on` | 500 |
| `floor_lamp` | `core:lamp_floor` | `states`, `switchable`, `draggable floorOnly` | furniture, light | `env_home_lamp_floor_off` / `_on` | 1400 |
| `toy_box` | `core:toy_box` | `states` closed/open, `openable`, `container` (capacidad 6 propuesta, `accepts: [toy]`), `draggable floorOnly` | furniture | `env_home_toy_box_closed` / `_open` | 300 |
| `teddy` | `core:teddy_bear` | `draggable` | toy | `obj_toy_teddy_bear` | en `toy_box` slot 0 |
| `ball` | `core:ball_red` | `draggable` | toy | `obj_toy_ball_red` | 650 |
| `book` | `core:book_blue` | `draggable` | toy | `obj_toy_book_blue` | sobre `coffee_table` (1080, y de su superficie) |
| `plant` | `core:plant_pot` | `draggable` | decor | `obj_decor_plant_pot_01` | 1320 |

- **RN-6 (puerta):** `front_door` (`core:door_front`, x 120) con `states` + `openable` (tap abre/cierra). El override `portal → core:street / home_door` se añade en Fase 2 (HU-GAME-049/063); en Fase 1 no lleva `portal` porque el validador exige que el destino exista.
- **RN-7 (sonidos):** cada prefab declara `sounds` de sus roles (`toggle` → `sfx_switch_click`/`sfx_tv_on`, `open`/`close` → `sfx_box_open`/`sfx_box_close`, `drop` → `sfx_drop_soft`/`sfx_drop_wood`); si falta, aplica el fallback de HU-GAME-056.
- **RN-8:** cada prefab tiene `metadata.name` con clave i18n en `es` y `en`. El tamaño mínimo de toque lo garantiza el hit testing en runtime (`minHitDp = 44 dp`, HU-GAME-070); si dos áreas se solapan gana la entidad más al frente, y se revisa que ningún objeto quede inaccesible.
- **RN-9:** en release, ningún asset ni prefab con `placeholder: true` ([OBJECT_SCHEMA §6](../../data/OBJECT_SCHEMA.md)). En Fase 1 se permiten placeholders marcados.

### Criterios de aceptación
```gherkin
Scenario: sentarse en el sofá
  Given un personaje de pie en el salón y el sofá libre
  When el jugador suelta el personaje sobre el sofá
  Then el personaje queda con pose "sit" anclado en seat.anchor del sofá

Scenario: asiento ocupado
  Given un personaje sentado en el sillón
  When el jugador suelta otro personaje sobre el sillón
  Then se aplica AC-REJECT-01 y el segundo personaje queda de pie junto al sillón

Scenario: encender la tele y la lámpara
  Given la tele y la lámpara de pie en estado "off"
  When el jugador toca la tele
  Then la tele pasa a "on", su sprite cambia a "env_home_tv_retro_on" y suena su sonido de toggle

Scenario: guardar un juguete en la caja
  Given la caja de juguetes abierta con espacio
  When el jugador suelta la pelota (tag "toy") en la zona "inside" de la caja
  Then la pelota tiene location { kind: 'container', containerId: 'core:home/toy_box' }

Scenario: la caja no acepta lo que no es juguete
  Given la caja de juguetes abierta
  When el jugador suelta la maceta (tag "decor") en su zona "inside"
  Then se aplica AC-REJECT-01 y la maceta se coloca con `place`

Scenario: apoyar un objeto en la mesa de centro
  Given el libro en el suelo
  When el jugador lo suelta un poco por encima de la mesa de centro
  Then la y del libro coincide con la superficie de la mesa

Scenario: contenido y validación de la escena
  Given el pack core
  When se ejecuta "npm run content:validate"
  Then no hay errores en "scenes/home.json" ni en los 10 prefabs del salón
  And todos los objetos interactivos del salón y la puerta de entrada tienen x entre 0 y 1440

@persistence
Scenario: el salón persiste
  Given el jugador encendió la lámpara, movió el sillón a x 1500 y guardó el osito en la caja
  When la app se cierra por completo y se vuelve a abrir
  Then la lámpara está "on", el sillón en x 1500 y el osito en la caja
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-REJECT-01, AC-PERF-01, AC-A11Y-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Caja de juguetes cerrada: su contenido no se ve ni se toca; soltar un juguete encima lo apoya (`place`).
- Mover la caja con juguetes dentro: el contenido viaja con ella (HU-GAME-048).
- Soltar un personaje en el suelo delante del sofá, fuera del hitbox: queda de pie (`place`).
- Tele encendida al salir de la escena: sigue encendida al volver (AC-PERSIST-01).

### Dependencias
- HU-GAME-012: zonas dentro de una escena.
- HU-GAME-034: abrir y cerrar muebles (caja de juguetes, puerta).
- HU-GAME-035: guardar objetos en contenedores (caja de juguetes).
- HU-GAME-045: sentarse en asientos.
- HU-GAME-047: objetos encendibles.

### Consideraciones técnicas
- Solo contenido: `content/core/scenes/home.json`, `content/core/prefabs/**`, `assets.json`, `locales/*.json`. Nada en `src/`.
- Presupuesto: entidades cargadas en `core:home` target ≤ 300; se esperan ~70 con 12 personajes ([PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos)).
- [NEEDED NOW].

### Assets necesarios
- Fondo: `env_home_bg_living_01` (chunk 1920 × 1080; placeholder: sí en dev, no en release).
- Muebles: `env_home_sofa_blue`, `env_home_armchair_red`, `env_home_coffee_table_wood`, `env_home_tv_retro_off`, `env_home_tv_retro_on`, `env_home_lamp_floor_off`, `env_home_lamp_floor_on`, `env_home_toy_box_closed`, `env_home_toy_box_open`, `env_home_door_front`, `env_home_door_front_open`.
- Objetos: `obj_toy_teddy_bear`, `obj_toy_ball_red`, `obj_toy_book_blue`, `obj_decor_plant_pot_01`.
- Audio: `mus_home_calm_01`, `sfx_switch_click`, `sfx_tv_on`, `sfx_box_open`, `sfx_box_close`, `sfx_drop_soft`, `sfx_drop_wood`.
- Placeholder aceptable en todos: sí en Fase 1 (marcados `placeholder: true`), no en release.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación: escena `core:home` (esqueleto) + 10 prefabs del salón en datos
- [ ] pruebas: test de escenario headless que recorre cada entidad del salón y ejecuta su capacidad
- [ ] rendimiento: escenario de estrés de [PERFORMANCE §3](../../architecture/PERFORMANCE.md) en el salón (12 personajes, 60 objetos visibles)
- [ ] persistencia: AC-PERSIST-01/02 para una entidad por capacidad
- [ ] documentación: `content:validate` en verde

---

## HU-GAME-060 — Cocina jugable

> **Status:** Draft
> **Epic:** EPIC-017 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-017 — Home

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **una cocina con nevera, alacena, frutero y comida y bebida de verdad**
para **dar de comer y de beber a mis personajes y guardar la comida donde va**.

### Contexto
Zona `kitchen` (1920–3840) de `core:home`, la más densa del MVP (14 prefabs). Reglas usadas: `eat_food`, `drink_drink`, `store_in_container`, `tap_open`, `tap_switch`, `tap_spawner`, `sit_on_seat`, `hold_item` ([INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md)).

### Reglas de negocio
- **RN-1 (encuadre):** objetos interactivos entre x 2160 y 3600 (ventana de 1440 centrada en 2880).
- **RN-2 (prefabs de la cocina, 14):** posiciones y cantidades = propuesta salvo las del ejemplo de [SCENE_SCHEMA §4](../../data/SCENE_SCHEMA.md) (nevera 3420, mesa 2600, manzana 2580/780).

| localId | prefabId | Capacidades | Tags | Sprite | Ubicación inicial |
|---|---|---|---|---|---|
| `fridge` | `core:fridge_white` | `states` closed/open, `openable`, `container` (6, `accepts: [food, drink]`) | furniture, appliance | `env_home_fridge_white` / `_open` | x 3420 |
| `table` | `core:table_round` | `surface`, `draggable floorOnly` | furniture | `env_home_table_round` | x 2600 |
| `chair_1`, `chair_2` | `core:chair_wood` | `seat`, `draggable floorOnly` | furniture | `env_home_chair_wood_01` | x 2420 / 2780 |
| `stove` | `core:stove` | `states` off/on, `switchable` | furniture, appliance | `env_home_stove_off` / `_on` | x 3050 |
| `cupboard` | `core:cupboard` | `states`, `openable` (propuesta), `container` (6, `accepts: [food, drink, misc]`) | furniture | `env_home_cupboard_closed` / `_open` (capa `wallDecor`) | x 2250, y 560 |
| `fruit_bowl` | `core:fruit_bowl` | `spawner` (`prefabId: core:apple_red`, `maxAlive: 3`), `draggable` | decor | `obj_decor_fruit_bowl_01` | sobre `table` |
| `apple_1` | `core:apple_red` | `edible` (3 mordiscos → `core:apple_core`), `draggable` | food, fruit | `obj_food_apple_red` (+ `_bite1`, `_bite2`) | (2580, 780) |
| `banana_1` | `core:banana` | `edible` (2, propuesta; `remove`) | food, fruit | `obj_food_banana_yellow` | sobre `table` |
| `sandwich_1` | `core:sandwich` | `edible` (3, propuesta; `remove`) | food | `obj_food_sandwich_ham` | sobre `table` |
| `cake_1` | `core:cake_slice` | `edible` (2, propuesta; `remove`) | food | `obj_food_cake_slice_pink` | en `fridge` slot 2 |
| `cookie_1`, `cookie_2` | `core:cookie` | `edible` (1; `remove`) | food | `obj_food_cookie_choco` | en `cupboard` slots 0–1 |
| `milk_1` | `core:milk_carton` | `drinkable` (3 sorbos, propuesta; `replace → core:milk_carton_empty`) | drink | `obj_drink_milk_carton` | en `fridge` slot 0 |
| `juice_1` | `core:juice_glass` | `drinkable` (2, propuesta; `replace → core:glass_empty`) | drink | `obj_drink_juice_glass_orange` | en `fridge` slot 1 |
| `glass_1` | `core:glass_empty` | `draggable` | misc | `obj_misc_glass_empty` | en `cupboard` slot 2 |

- **RN-3:** prefabs resultado (categoría "Otros" de [MVP_SCOPE](../../product/MVP_SCOPE.md#objetos)): `core:apple_core` (sprite `obj_food_apple_core`) y `core:milk_carton_empty` (sprite `obj_drink_milk_carton_empty`), ambos `draggable` con tag `misc`, no consumibles.
- **RN-3b:** `eat_food` y `drink_drink` exigen `isPurchased` (pasa si el objeto no tiene `purchasable`) y `poseIsNot [sleep]`: un personaje dormido no come ni bebe ([INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md)); en la casa todo es gratis, así que solo aplica la segunda.
- **RN-4:** el frutero genera manzanas junto a sí (`spawnOffset`) hasta 3 vivas; con 3 vivas, el tap no hace nada visible salvo la animación `tap` (propuesta: `wiggle`).
- **RN-5:** sonidos: `sfx_fridge_open`, `sfx_fridge_close`, `sfx_eat_crunch`, `sfx_drink_gulp`, `sfx_stove_click`, `sfx_spawn_pop`.
- **RN-6:** comida parcialmente comida se guarda con su `bitesLeft` (también dentro de un contenedor).

### Criterios de aceptación
```gherkin
Scenario: comer una manzana a mordiscos
  Given un personaje en la cocina y la manzana con 3 mordiscos
  When el jugador suelta la manzana en la zona "mouth" del personaje tres veces
  Then tras el tercer mordisco la manzana se sustituye por un "core:apple_core"
  And el id "core:home/apple_1" queda en entity_removed tras el flush

Scenario: beber jugo deja el vaso vacío
  Given el vaso de jugo con 2 sorbos
  When el personaje bebe dos veces
  Then aparece un "core:glass_empty" en la posición del vaso

Scenario: un personaje dormido no come
  Given un personaje con pose "sleep" y la manzana
  When el jugador suelta la manzana en su zona "mouth"
  Then la manzana no se come y su bitesLeft no cambia

Scenario: beber leche deja el cartón vacío
  Given el cartón de leche con 1 sorbo
  When el personaje bebe
  Then aparece un "core:milk_carton_empty" en la posición del cartón

Scenario: guardar comida en la nevera abierta
  Given la nevera abierta con espacio
  When el jugador suelta el sándwich en su zona "inside"
  Then el sándwich tiene location container de "core:home/fridge"

Scenario: la nevera cerrada no guarda
  Given la nevera cerrada
  When el jugador suelta el plátano sobre ella
  Then el plátano no entra en la nevera y se coloca con `place`

Scenario: la nevera no acepta un juguete
  Given la nevera abierta
  When el jugador suelta la pelota (tag "toy") en su zona "inside"
  Then se aplica AC-REJECT-01

Scenario: el frutero da manzanas hasta 3
  Given el frutero sin manzanas vivas generadas
  When el jugador toca el frutero 4 veces
  Then existen exactamente 3 manzanas generadas por el frutero

Scenario: encender el fogón
  Given el fogón en "off"
  When el jugador lo toca
  Then el fogón pasa a "on"

@persistence
Scenario: la cocina persiste
  Given una manzana con 1 mordisco guardada en la nevera y la nevera cerrada
  When la app se cierra por completo y se vuelve a abrir
  And el jugador abre la nevera
  Then la manzana está dentro con bitesLeft 1
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-REJECT-01, AC-PERF-01, AC-A11Y-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Nevera llena (6): rechazo amable con `rejectHint` `ui_hint_container_full` y `place`.
- Comida soltada en la mano del personaje (zona `handL`/`handR`): la sostiene (`hold_item`), no la come.
- Manzanas generadas que se comen: dejan de contar como vivas y el frutero vuelve a dar.
- Sándwich sobre la mesa y la mesa movida: con HU-GAME-030 (P2) viaja con la mesa; sin ella, se queda en su sitio.

### Dependencias
- HU-GAME-035: guardar objetos en contenedores.
- HU-GAME-042: comer alimentos por mordiscos.
- HU-GAME-043: beber bebidas.
- HU-GAME-044: dispensadores de objetos.
- HU-GAME-045: sentarse en asientos (sillas).
- HU-GAME-047: objetos encendibles (fogón).

### Consideraciones técnicas
- Solo contenido. Validar que `inContainer` apunte a contenedores con `slot < capacity` ([SCENE_SCHEMA §6](../../data/SCENE_SCHEMA.md)).
- [NEEDED NOW].

### Assets necesarios
- Fondo: `env_home_bg_kitchen_01`.
- Muebles: `env_home_fridge_white`, `env_home_fridge_white_open`, `env_home_table_round`, `env_home_chair_wood_01`, `env_home_stove_off`, `env_home_stove_on`, `env_home_cupboard_closed`, `env_home_cupboard_open`.
- Objetos: `obj_decor_fruit_bowl_01`, `obj_food_apple_red`, `obj_food_apple_red_bite1`, `obj_food_apple_red_bite2`, `obj_food_apple_core`, `obj_food_banana_yellow`, `obj_food_sandwich_ham`, `obj_food_cake_slice_pink`, `obj_food_cookie_choco`, `obj_drink_milk_carton`, `obj_drink_milk_carton_empty`, `obj_drink_juice_glass_orange`, `obj_misc_glass_empty`.
- Audio: `amb_kitchen_fridge_hum`, `sfx_fridge_open`, `sfx_fridge_close`, `sfx_eat_crunch`, `sfx_drink_gulp`, `sfx_stove_click`, `sfx_spawn_pop`.
- UI: `ui_hint_container_full`.
- Placeholder aceptable: sí en Fase 1, no en release.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación: 14 prefabs + los resultados `apple_core` y `milk_carton_empty` y su colocación en `home.json`
- [ ] pruebas: test de escenario por capacidad (comer, beber, guardar, dispensar, encender, sentarse)
- [ ] rendimiento: AC-PERF-01 con la cocina llena
- [ ] persistencia: `bitesLeft`, `sipsLeft`, contenido de contenedores y estados
- [ ] documentación: `content:validate` en verde

---

## HU-GAME-061 — Dormitorio jugable

> **Status:** Draft
> **Epic:** EPIC-017 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-017 — Home

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **un dormitorio con cama, armario lleno de ropa, mesita y lámpara**
para **acostar a mis personajes, cambiarles la ropa y dejar sus juguetes sobre la cama**.

### Contexto
Zona `bedroom` (3840–5760). Aquí se verifica el caso canónico de [SAVE_SYSTEM §1](../../architecture/SAVE_SYSTEM.md): "dejo un juguete sobre la cama y sigue ahí al volver". El armario es un contenedor más con `accepts: ["clothing"]` ([INVENTORY_SYSTEM §3](../../architecture/INVENTORY_SYSTEM.md)).

### Reglas de negocio
- **RN-1 (encuadre):** objetos interactivos entre x 4080 y 5520.
- **RN-2 (prefabs del dormitorio, 7):** posiciones = propuesta.

| localId | prefabId | Capacidades | Tags | Sprite | Ubicación inicial |
|---|---|---|---|---|---|
| `bed` | `core:bed_single` | `bed` (anchor, `coverAsset` manta delante), `surface`, `draggable floorOnly` | furniture | `env_home_bed_single_blue` + `env_home_bed_single_blue_cover` | x 4500 |
| `wardrobe` | `core:wardrobe` | `states` closed/open, `openable` (propuesta), `container` (12 propuesta, `accepts: [clothing]`) | furniture | `env_home_wardrobe_closed` / `_open` | x 5250 |
| `nightstand` | `core:nightstand` | `surface`, `draggable floorOnly` | furniture | `env_home_nightstand_wood` | x 4150 |
| `table_lamp` | `core:lamp_table` | `states` off/on, `switchable`, `draggable` | light | `env_home_lamp_table_off` / `_on` | sobre `nightstand` |
| `pillow` | `core:pillow` | `draggable` | toy, decor | `obj_decor_pillow_white` | sobre `bed` |
| `alarm_clock` | `core:alarm_clock` | `draggable`, `animations.tap: wiggle` | decor | `obj_decor_alarm_clock_red` | sobre `nightstand` |
| `toy_blocks` | `core:toy_blocks` | `draggable` | toy | `obj_toy_blocks_color` | x 4800 (suelo) |

- **RN-3 (ropa inicial del armario):** propuesta: 9 de las 15 prendas del catálogo `core` (EPIC-011): 4 superiores, 3 inferiores, 2 zapatos, declaradas con `inContainer` en slots 0–8. El resto: 2 en la cesta del baño (HU-GAME-062) y 4 a la venta en la tienda (HU-GAME-064).
- **RN-4:** la cama es a la vez `bed` (personajes) y `surface` (objetos): un personaje soltado encima duerme (`sleep_on_bed`, prioridad 85); un objeto soltado encima se apoya (`place`).
- **RN-5:** sonidos: `sfx_bed_rustle` (sleep), `sfx_wardrobe_open`, `sfx_wardrobe_close`, `sfx_switch_click`, `sfx_alarm_ring_short` (tap del despertador, propuesta).

### Criterios de aceptación
```gherkin
Scenario: dormir en la cama
  Given un personaje de pie y la cama libre
  When el jugador suelta el personaje sobre la cama
  Then su pose es "sleep", su expresión es la de dormido y la manta se dibuja delante

Scenario: dejo un juguete sobre la cama y sigue ahí al volver
  Given los bloques de juguete en el suelo del dormitorio
  When el jugador los suelta sobre la cama
  And viaja o salta a otra zona y vuelve
  Then los bloques siguen sobre la superficie de la cama

Scenario: sacar ropa del armario y vestirla
  Given el armario abierto con una prenda superior dentro
  When el jugador arrastra la prenda y la suelta sobre el cuerpo del personaje
  Then la prenda queda con location worn en el slot "top"
  And la prenda superior anterior cae junto al personaje

Scenario: el armario solo acepta ropa
  Given el armario abierto
  When el jugador suelta la almohada en su zona "inside"
  Then se aplica AC-REJECT-01

Scenario: encender la lámpara de la mesita
  Given la lámpara de mesa en "off"
  When el jugador la toca
  Then pasa a "on"

@persistence
Scenario: el dormitorio persiste tras cerrar la app
  Given un personaje dormido en la cama y el osito sobre la cama
  When la app se cierra por completo y se vuelve a abrir
  Then el personaje sigue con pose "sleep" en la cama
  And el osito sigue sobre la superficie de la cama
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-REJECT-01, AC-PERF-01, AC-A11Y-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Cama ocupada: un segundo personaje no duerme (`seatFree` falla), queda al lado con rechazo amable.
- Arrastrar al personaje dormido: `standUp` implícito y pose `dangle`.
- Armario lleno: rechazo amable y la prenda se apoya delante.
- Lámpara de mesa movida al suelo: sigue funcionando (no depende de la mesita).

### Dependencias
- HU-GAME-041: armario con ropa disponible.
- HU-GAME-046: dormir en camas.
- HU-GAME-047: objetos encendibles (lámpara de mesa).

### Consideraciones técnicas
- Solo contenido. Las prendas iniciales se declaran con `inContainer` en `home.json`.
- [NEEDED NOW].

### Assets necesarios
- Fondo: `env_home_bg_bedroom_01`.
- Muebles: `env_home_bed_single_blue`, `env_home_bed_single_blue_cover`, `env_home_wardrobe_closed`, `env_home_wardrobe_open`, `env_home_nightstand_wood`, `env_home_lamp_table_off`, `env_home_lamp_table_on`.
- Objetos: `obj_decor_pillow_white`, `obj_decor_alarm_clock_red`, `obj_toy_blocks_color`.
- Audio: `sfx_bed_rustle`, `sfx_wardrobe_open`, `sfx_wardrobe_close`, `sfx_alarm_ring_short`.
- Placeholder aceptable: sí en Fase 1, no en release.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación: 7 prefabs + ropa inicial del armario en datos
- [ ] pruebas: escenario headless del caso canónico (juguete sobre la cama) y de cada capacidad
- [ ] rendimiento: AC-PERF-01
- [ ] persistencia: pose `sleep`, contenido del armario y objetos sobre la cama
- [ ] documentación: `content:validate` en verde

---

## HU-GAME-062 — Baño jugable

> **Status:** Draft
> **Epic:** EPIC-017 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-017 — Home

### Prioridad
Should · P1

### Historia
Como **jugador**
quiero **un baño con bañera, inodoro, lavabo con grifo y patito de goma**
para **jugar a las rutinas de todos los días con mis personajes**.

### Contexto
Zona `bathroom` (5760–7680). Reutiliza capacidades existentes: `seat` (inodoro y bañera con pose `sit`), `switchable` (grifo), `container` (cesta de ropa). No hay poses nuevas en el MVP (bañarse = sentarse en la bañera).

### Reglas de negocio
- **RN-1 (encuadre):** objetos interactivos entre x 6000 y 7440.
- **RN-2 (prefabs del baño, 7):** posiciones = propuesta.

| localId | prefabId | Capacidades | Tags | Sprite | Ubicación inicial |
|---|---|---|---|---|---|
| `toilet` | `core:toilet` | `seat`, `draggable floorOnly` | furniture | `env_home_toilet_white` | x 6100 |
| `bathtub` | `core:bathtub` | `seat` (pose `sit`), `surface` (borde, propuesta) | furniture | `env_home_bathtub_white` (+ primer plano `env_home_bathtub_white_front`, capa `foreground`) | x 7050 |
| `sink` | `core:sink` | `states` off/on, `switchable` (grifo) | furniture | `env_home_sink_off` / `_on` | x 6550 |
| `towel` | `core:towel` | `draggable` | misc | `obj_misc_towel_blue` | x 6700 (suelo) |
| `toothbrush` | `core:toothbrush` | `draggable` | misc | `obj_misc_toothbrush_green` | sobre `sink` (propuesta: `sink` con `surface`) |
| `duck` | `core:rubber_duck` | `draggable`, `animations.tap: squash` | toy | `obj_toy_rubber_duck_yellow` | sobre el borde de `bathtub` |
| `laundry_basket` | `core:laundry_basket` | `container` (6 propuesta, `accepts: [clothing]`, sin `openable`: siempre accesible, porque `isOpen` pasa si no hay `openable`) | furniture | `env_home_laundry_basket_01` | x 7380 |

- **RN-3:** la cesta contiene al inicio 2 prendas del catálogo (propuesta, ver HU-GAME-061 RN-3).
- **RN-4:** el patito suena al tocarlo (`sounds.use` → `sfx_duck_squeak`, reproducido por la animación de tap; propuesta).
- **RN-5:** el agua del grifo es solo el sprite de estado `on`; animación por frames [DESIGNED FOR LATER] ([RENDERING §9](../../architecture/RENDERING.md)).
- **RN-6:** sonidos: `sfx_tap_water_on`, `sfx_toilet_flush` (al sentarse, propuesta como `use`), `sfx_duck_squeak`, `amb_bathroom_drip_01`.

### Criterios de aceptación
```gherkin
Scenario: abrir el grifo
  Given el lavabo en "off"
  When el jugador lo toca
  Then pasa a "on" y su sprite muestra el agua

Scenario: sentarse en la bañera
  Given la bañera libre
  When el jugador suelta un personaje sobre la bañera
  Then su pose es "sit" anclado en seat.anchor y el frente de la bañera se dibuja delante

Scenario: guardar ropa en la cesta sin abrirla
  Given la cesta con espacio
  When el jugador suelta una prenda en su zona "inside"
  Then la prenda tiene location container de "core:home/laundry_basket"

Scenario: la cesta solo acepta ropa
  Given la cesta con espacio
  When el jugador suelta el patito en su zona "inside"
  Then se aplica AC-REJECT-01

Scenario: el cepillo se puede sostener
  Given un personaje con una mano libre
  When el jugador suelta el cepillo de dientes sobre su mano
  Then el cepillo tiene location held del personaje

@persistence
Scenario: el baño persiste
  Given el grifo abierto y el patito dentro de la bañera
  When la app se cierra por completo y se vuelve a abrir
  Then el grifo sigue "on" y el patito en la misma posición
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-REJECT-01, AC-PERF-01, AC-A11Y-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Inodoro ocupado: rechazo amable.
- Objeto soltado dentro de la bañera: se apoya en su `surface` (o en el suelo si no la tiene).
- La bañera no es arrastrable (propuesta): es un mueble fijo; el inodoro sí (`floorOnly`).

### Dependencias
- HU-GAME-035: guardar objetos en contenedores (cesta de ropa).
- HU-GAME-045: sentarse en asientos (inodoro, bañera).
- HU-GAME-047: objetos encendibles (grifo).

### Consideraciones técnicas
- Solo contenido. El borde delantero de la bañera es un sprite en la capa `foreground` declarado como entidad inline sin prefab ([SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md)).
- [NEEDED NOW].

### Assets necesarios
- Fondo: `env_home_bg_bathroom_01`.
- Muebles: `env_home_toilet_white`, `env_home_bathtub_white`, `env_home_bathtub_white_front`, `env_home_sink_off`, `env_home_sink_on`, `env_home_laundry_basket_01`.
- Objetos: `obj_misc_towel_blue`, `obj_misc_toothbrush_green`, `obj_toy_rubber_duck_yellow`.
- Audio: `amb_bathroom_drip_01`, `sfx_tap_water_on`, `sfx_toilet_flush`, `sfx_duck_squeak`.
- Placeholder aceptable: sí en Fase 1, no en release.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación: 7 prefabs y su colocación en `home.json`
- [ ] pruebas: escenario headless por capacidad
- [ ] rendimiento: AC-PERF-01
- [ ] persistencia: estados, contenido de la cesta y posiciones
- [ ] documentación: `content:validate` en verde
