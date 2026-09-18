# EPIC-020 — Economy

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 2
> **Docs:** [GAME_RULES §4](../../product/GAME_RULES.md) · [ENTITY_SCHEMA §5.14–5.15](../../data/ENTITY_SCHEMA.md) · [INTERACTION_SCHEMA](../../data/INTERACTION_SCHEMA.md) · [INTERACTION_SYSTEM](../../architecture/INTERACTION_SYSTEM.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md) · [SAVE_SYSTEM](../../architecture/SAVE_SYSTEM.md) · [GAME_ENGINE](../../architecture/GAME_ENGINE.md) · [ECS](../../architecture/ECS.md) · [MONETIZATION](../../product/MONETIZATION.md)

## Objetivo del epic
Una economía **blanda y sin presión**: una única moneda del juego (nunca dinero real en el MVP), un monedero visible, compras hechas llevando el producto a la caja (`buy_at_register`) y fuentes de monedas amables (monedas iniciales, regalo diario y monedas escondidas). La economía nunca bloquea la diversión básica: todo el contenido de la casa es gratis.

## Historias
- [HU-GAME-065 — Monedero de monedas](#hu-game-065--monedero-de-monedas)
- [HU-GAME-066 — Comprar objetos](#hu-game-066--comprar-objetos)
- [HU-GAME-067 — Regalo diario y monedas escondidas](#hu-game-067--regalo-diario-y-monedas-escondidas)

---

## HU-GAME-065 — Monedero de monedas

> **Status:** Draft
> **Epic:** EPIC-020 · **Fase:** 2 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-020 — Economy

### Prioridad
Must · P1

### Historia
Como **jugador**
quiero **ver cuántas monedas tengo con un icono de moneda siempre a la vista**
para **saber si puedo comprar algo en la tienda**.

### Contexto
El saldo vive en `player.wallet.coins` ([SAVE_SCHEMA §1](../../data/SAVE_SCHEMA.md)). Solo el `EconomySystem` lo modifica ([ECS §5](../../architecture/ECS.md)) y cada cambio emite `walletChanged { coins, delta }`, que el HUD muestra y que provoca un **flush inmediato** del guardado ([SAVE_SYSTEM §3](../../architecture/SAVE_SYSTEM.md)).

### Reglas de negocio
- **RN-1:** Moneda única de juego ("monedas"), entera y **≥ 0**. Sin compras con dinero real en el MVP ([MONETIZATION](../../product/MONETIZATION.md)).
- **RN-2:** Monedas iniciales de partida nueva: `newGame.coins` del manifest `core` (**50** en el MVP, [CONTENT_PACK_SCHEMA §2](../../data/CONTENT_PACK_SCHEMA.md), [GAME_RULES §4](../../product/GAME_RULES.md)). Nunca en el código.
- **RN-3:** Tope de saldo: **999** (propuesta, para que el contador tenga como máximo 3 dígitos). Las monedas que superen el tope no se suman, sin mensaje de error.
- **RN-4:** El HUD muestra un contador (icono `ui_icon_coin` + número) durante el juego, en una esquina segura (safe area). No es un botón; tocarlo solo hace una animación `bounce` (propuesta).
- **RN-5:** `walletChanged` con `delta > 0` → animación de subida del contador + `sfx_coin`; con `delta < 0` → animación de bajada sin sonido de pérdida (sin connotación negativa).
- **RN-6:** `walletChanged` → flush inmediato del guardado (no espera al debounce).
- **RN-7:** Ninguna operación deja el saldo negativo: una resta mayor que el saldo falla en `validate` y no cambia nada.

### Criterios de aceptación
```gherkin
Scenario: partida nueva con monedas iniciales
  Given una partida nueva
  When el jugador crea su primer personaje y entra en el juego
  Then player.wallet.coins es 50 y el HUD muestra 50

Scenario: sumar monedas
  Given un saldo de 50
  When el EconomySystem suma 10
  Then se emite walletChanged { coins: 60, delta: 10 }
  And suena "sfx_coin" y el contador se anima hasta 60

Scenario: el saldo nunca es negativo
  Given un saldo de 3
  When se intenta restar 5
  Then la operación falla sin cambios y el saldo sigue en 3

Scenario: tope de saldo
  Given un saldo de 995
  When el EconomySystem suma 10
  Then el saldo es 999

@persistence
Scenario: el saldo se guarda al instante
  Given un saldo que acaba de cambiar a 60
  When la app se mata inmediatamente después, sin esperar al debounce
  And se vuelve a abrir
  Then el saldo es 60
```
Incluye: AC-PERSIST-02, AC-A11Y-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Reinicio del mundo (HU-GAME-055): el saldo vuelve a las monedas iniciales.
- Varias sumas seguidas (recoger monedas rápido): cada una emite su evento; el sonido respeta el dedupe de 80 ms (HU-GAME-056).
- Pantallas estrechas: el contador no tapa botones del HUD ni la zona de 16 dp de los bordes.

### Dependencias
- HU-GAME-052: autoguardado (flush inmediato).
- HU-GAME-004: GameFacade (selector `wallet()` y hook `useWallet()`).

### Consideraciones técnicas
- `EconomySystem` en `engine/systems`; `useWallet()` con `useSyncExternalStore`. Sin re-render global al cambiar el saldo.
- [NEEDED NOW] (Fase 2).

### Assets necesarios
- `ui_icon_coin`: icono de moneda (placeholder: sí en dev, no en release).
- `ui_wallet_bg`: fondo del contador (placeholder: sí en dev).
- `sfx_coin`: global (HU-GAME-056).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación del monedero, el evento y el contador del HUD
- [ ] pruebas unitarias del `EconomySystem` (sumar, restar, tope, no negativo)
- [ ] persistencia: flush inmediato verificado
- [ ] documentación

---

## HU-GAME-066 — Comprar objetos

> **Status:** Draft
> **Epic:** EPIC-020 · **Fase:** 2 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-020 — Economy

### Prioridad
Must · P1

### Historia
Como **jugador**
quiero **llevar un producto a la caja registradora para comprarlo con mis monedas**
para **quedármelo y llevármelo a casa**.

### Contexto
La regla `core:buy_at_register` (drop, source `purchasable`, target tag `checkout`, condiciones `isPurchased(false)` y `canAfford`, acción `purchase`, prioridad 95) está en [INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md). La reposición y la vuelta a `origin` están en [ENTITY_SCHEMA §5.14](../../data/ENTITY_SCHEMA.md) y [GAME_RULES §4](../../product/GAME_RULES.md). Nada depende de la escena: basta una entidad `checkout` y productos `purchasable`.

### Reglas de negocio
- **RN-1:** Soltar un producto sin comprar sobre una entidad con tag `checkout` ejecuta `purchase` si `canAfford` (saldo ≥ `purchasable.price`).
- **RN-2:** `purchase`, en una transacción: resta `price` del monedero, pone `purchased = true` (el objeto pasa a ser del jugador), coloca el objeto sobre el mostrador de la caja (`place`, propuesta) y, si `restock` (por defecto `true`), crea en `origin` una copia nueva sin comprar con id `rt_{ulid}`.
- **RN-3:** Feedback de compra: `sfx_register_ching` + animación de monedas volando del contador a la caja (propuesta), sin texto. `walletChanged` → flush inmediato.
- **RN-4:** Sin monedas suficientes: rechazo amable (shake de la caja + `sfx_reject_soft` + `rejectHint` `ui_hint_need_coins`, sin texto) y **el producto vuelve a `purchasable.origin`**, porque `buy_at_register` declara `fallback: 'returnToOrigin'` ([INTERACTION_SCHEMA §2, §7](../../data/INTERACTION_SCHEMA.md), [GAME_RULES §4](../../product/GAME_RULES.md)). Es la única diferencia con AC-REJECT-01, que usa `place`.
- **RN-5:** Un producto sin comprar **no puede salir de la tienda**:
  - mochila: `store_in_backpack` exige `isPurchased≠false` → rechazo amable y `place`;
  - portal: si el personaje que viaja sostiene un producto sin comprar, `teleport.validate` falla con `interactionRejected(notPurchased)` ([INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md)): el personaje no viaja (queda junto a la puerta) y el producto vuelve a `origin`;
  - al descargar la escena o recargarla, todo producto sin comprar que no esté en su `origin` vuelve allí.
- **RN-6:** `eat_food`, `drink_drink` y `wear_clothes` exigen `isPurchased { value: true, ifMissing: true }`: no se puede comer, beber ni vestir un producto sin pagarlo; `eat_food` y `drink_drink` exigen además `poseIsNot [sleep]` ([INTERACTION_SCHEMA §7](../../data/INTERACTION_SCHEMA.md)). `hold_item` sigue permitido (el personaje puede llevarlo a la caja).
- **RN-7:** Soltar sobre la caja un objeto ya comprado o sin `purchasable`: `buy_at_register` no aplica; se apoya en el mostrador (`place`), sin cobro.
- **RN-8:** Persistencia: en entidades declaradas se guarda `purchasable.purchased`; las entidades runtime (`rt_`, como la copia de reposición) guardan el `purchasable` **completo** (`price`, `purchased`, `restock`, `origin`) ([SAVE_SCHEMA §2](../../data/SAVE_SCHEMA.md), [ENTITY_SCHEMA §5.14](../../data/ENTITY_SCHEMA.md)).

### Criterios de aceptación
```gherkin
Scenario: comprar un producto
  Given un saldo de 50 y la pelota a la venta con price 8 y purchased false
  When el jugador suelta la pelota sobre la entidad con tag "checkout"
  Then el saldo es 42 y se emite walletChanged { coins: 42, delta: -8 }
  And la pelota tiene purchased true y está sobre el mostrador
  And existe una nueva pelota rt_ con purchased false en el origin de la anterior
  And suena "sfx_register_ching"

Scenario: sin monedas suficientes
  Given un saldo de 5 y el osito con price 15
  When el jugador suelta el osito sobre la caja
  Then la caja hace shake, suena "sfx_reject_soft" y se muestra "ui_hint_need_coins"
  And el saldo sigue en 5 y el osito vuelve a su origin con purchased false

Scenario: no se puede meter en la mochila sin pagar
  Given un producto sin comprar
  When el jugador lo suelta sobre el botón de la mochila
  Then se aplica AC-REJECT-01 y el producto no entra en la mochila

Scenario: no se puede salir con un producto sin pagar
  Given un personaje que sostiene un producto sin comprar
  When el jugador suelta al personaje sobre la puerta de salida
  Then se emite interactionRejected con razón "notPurchased"
  And el personaje sigue en la tienda y el producto vuelve a su origin

Scenario: no se come sin pagar
  Given un personaje en la tienda y una galleta sin comprar
  When el jugador suelta la galleta en la boca del personaje
  Then la galleta no se come y su bitesLeft no cambia

Scenario: no se viste sin pagar
  Given un personaje en la tienda y una prenda sin comprar
  When el jugador suelta la prenda sobre el cuerpo del personaje
  Then la prenda no se viste y sigue con purchased false

Scenario: la copia de reposición persiste completa
  Given la copia rt_ creada al comprar la pelota
  When se produce el flush
  Then su fila en entity_state incluye purchasable con price, purchased false, restock y origin

Scenario: llevarse a casa lo comprado
  Given un personaje que sostiene un sándwich comprado
  When el jugador lo suelta sobre la puerta de salida
  Then el personaje y el sándwich aparecen en "core:street"

@persistence
Scenario: la compra sobrevive a cerrar la app
  Given el jugador acaba de comprar la pelota
  When la app se mata inmediatamente después y se vuelve a abrir
  Then el saldo refleja la compra, la pelota tiene purchased true y la copia de reposición existe
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-REJECT-01, AC-A11Y-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Saldo exacto (saldo = precio): se compra y queda en 0.
- Soltar dos veces seguidas el mismo producto sobre la caja: la segunda vez ya está comprado (RN-7), no se cobra de nuevo.
- La app pasa a background durante la animación de compra: el estado ya se aplicó y se guardó (flush inmediato).
- Producto sin comprar en la mano de un personaje que se queda en la tienda: se queda en su mano hasta que se suelte; al recargar la escena vuelve a `origin` (propuesta).

### Dependencias
- HU-GAME-065: monedero de monedas.
- HU-GAME-031: resolver interacciones mediante reglas de datos.

### Consideraciones técnicas
- Acción `purchase` y comprobación `notPurchased` en `teleport.validate`, ambas en el `EconomySystem`/`SceneService`; sin referencias a escenas concretas.
- El resolver aplica el campo `fallback: 'returnToOrigin'` de la regla ([INTERACTION_SYSTEM §3](../../architecture/INTERACTION_SYSTEM.md)).
- [NEEDED NOW] (Fase 2).

### Assets necesarios
- `ui_hint_need_coins`: pista visual de "faltan monedas" (placeholder: sí en dev, no en release).
- `vfx_coins_fly_01`: efecto de monedas volando (propuesta; placeholder: sí en dev).
- `sfx_register_ching`, `sfx_reject_soft`.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de `purchase`, reposición, vuelta a `origin` y bloqueo de salida
- [ ] pruebas de integración headless de todos los escenarios
- [ ] rendimiento: el drop sobre la caja responde en ≤ 50 ms
- [ ] persistencia: compra, saldo y copia de reposición tras matar la app
- [ ] documentación

---

## HU-GAME-067 — Regalo diario y monedas escondidas

> **Status:** Draft
> **Epic:** EPIC-020 · **Fase:** 2 · **Alcance:** MVP P2
> **Last Updated:** 2026-09-18

### Epic
EPIC-020 — Economy

### Prioridad
Could · P2

### Historia
Como **jugador**
quiero **encontrar un regalo cada día que juego y monedas escondidas por el mundo**
para **tener monedas para la tienda y la sorpresa de descubrir cosas**.

### Contexto
Fuentes de monedas de [GAME_RULES §4](../../product/GAME_RULES.md): regalo diario (propuesta 10/día, sin acumular días perdidos) y monedas escondidas (propuesta 5 cada una, recogibles una vez). El regalo usa `player.dailyReward.lastClaimDate` (YYYY-MM-DD, hora local, [SAVE_SCHEMA §1](../../data/SAVE_SCHEMA.md)); las monedas escondidas usan `collectible` ([ENTITY_SCHEMA §5.15](../../data/ENTITY_SCHEMA.md)) y la regla `tap_collect` → `collect`.

### Reglas de negocio
- **RN-1 (regalo, disponibilidad):** al entrar en `Playing` (tras cargar o al volver de background), si `lastClaimDate` no existe o es **distinta** de la fecha local de hoy, aparece en el HUD una caja de regalo animada.
- **RN-2 (regalo, recogida):** tocar la caja despacha `claimDailyGift {}` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)), que suma `newGame.dailyGiftCoins` (**10** en el MVP) y fija `lastClaimDate` = hoy; la caja desaparece con animación y `sfx_gift_open`. Los días sin jugar no se acumulan.
- **RN-3 (reloj):** la fecha viene del `clock` inyectado. `claimDailyGift` es idempotente dentro del mismo día: con `lastClaimDate` = hoy no suma nada.
- **RN-4 (monedas escondidas):** prefab `core:coin_hidden` con `collectible { reward: { coins: 5 } }`, sprite `obj_misc_coin_hidden`, sin `draggable`. Propuesta de colocación: 3 en `core:home`, 2 en `core:street`, 1 en `core:store`, parcialmente visibles (asomando detrás de muebles) y nunca tapadas por completo por una entidad con reglas `tap`.
- **RN-5 (recogida):** tap → `collect`: suma `reward.coins`; la entidad pasa a `limbo` y se registra en `entity_removed` ([ENTITY_SCHEMA §5.15](../../data/ENTITY_SCHEMA.md)); animación de salto + `sfx_coin`. Desaparece para siempre de esa partida (no hay flag `collected`).
- **RN-7:** ambas fuentes emiten `walletChanged` → flush inmediato.
- **RN-8:** la caja de regalo del HUD mide ≥ 64 dp y es comprensible sin leer.

### Criterios de aceptación
```gherkin
Scenario: primer regalo del día
  Given un reloj falso en "2026-09-18" y lastClaimDate "2026-09-17"
  When el jugador entra en el juego
  Then aparece la caja de regalo en el HUD
  When el jugador la toca
  Then el saldo aumenta en 10 y lastClaimDate es "2026-09-18"

Scenario: un solo regalo por día
  Given lastClaimDate igual a la fecha de hoy
  When el jugador vuelve de background
  Then no aparece la caja de regalo

Scenario: sin acumular días perdidos
  Given lastClaimDate "2026-09-10" y hoy "2026-09-18"
  When el jugador recoge el regalo
  Then el saldo aumenta solo en 10

Scenario: comando idempotente en el mismo día
  Given lastClaimDate "2026-09-18" y hoy "2026-09-18"
  When se despacha claimDailyGift
  Then el saldo no cambia

Scenario: recoger una moneda escondida
  Given una entidad declarada con `collectible` reward.coins 5
  When el jugador la toca
  Then el saldo aumenta en 5 y la moneda deja de verse
  And tras el flush su id está en entity_removed

@persistence
Scenario: la moneda recogida no vuelve
  Given el jugador recogió una moneda escondida de "core:home"
  When sale de la escena, cierra la app, la abre y vuelve a "core:home"
  Then la moneda no se ve y el saldo conserva las 5 monedas
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Medianoche con la app abierta: el regalo aparece la próxima vez que se entre en `Playing` o se vuelva de background (no hay tick continuo; `TimeSystem` es [DESIGNED FOR LATER]).
- Tope de 999 monedas: el regalo se recoge igual y el saldo se queda en el tope.
- Reinicio del mundo: se borra `dailyReward` y las monedas escondidas vuelven a su estado de contenido.
- Moneda escondida detrás de un mueble que el niño mueve: sigue en su sitio y ahora se ve mejor (es una entidad independiente).

### Dependencias
- HU-GAME-065: monedero de monedas.
- HU-GAME-032: interacciones por tap (`tap_collect`).

### Consideraciones técnicas
- Regalo diario: comando `claimDailyGift {}` de [GAME_ENGINE §4](../../architecture/GAME_ENGINE.md), ejecutado por el `EconomySystem`.
- Las monedas escondidas son solo contenido + la acción `collect` existente.
- [NEEDED NOW] (P2, recortable).

### Assets necesarios
- `ui_gift_box_closed`, `ui_gift_box_open`: caja de regalo del HUD (placeholder: sí en dev, no en release).
- `obj_misc_coin_hidden`: moneda escondida (placeholder: sí en dev).
- `sfx_gift_open`, `sfx_coin`.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación del regalo diario y del prefab `core:coin_hidden` con su colocación
- [ ] pruebas con reloj falso (mismo día, día siguiente, días perdidos) y de `collect`
- [ ] persistencia: `lastClaimDate`, `entity_removed` de las monedas y saldo
- [ ] documentación
