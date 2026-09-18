# EPIC-015 — Save System

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 0 (HU-GAME-055: Fase 1)
> **Docs:** [SAVE_SYSTEM](../../architecture/SAVE_SYSTEM.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [ECS](../../architecture/ECS.md) · [GAME_ENGINE](../../architecture/GAME_ENGINE.md) · [SCENE_SYSTEM](../../architecture/SCENE_SYSTEM.md) · [CONTENT_PACK_SCHEMA](../../data/CONTENT_PACK_SCHEMA.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md)

## Objetivo del epic
Que el niño **nunca pierda lo que hizo**, sin botón de guardar: autoguardado incremental en SQLite (una fila por entidad, modelo diff), restauración fiel al abrir la app, migraciones seguras con copia de seguridad y un reinicio del mundo controlado por un adulto. El caso canónico que debe cumplirse siempre: **"dejo un juguete sobre la cama y sigue ahí al volver"**.

## Historias
- [HU-GAME-052 — Autoguardado del mundo en SQLite](#hu-game-052--autoguardado-del-mundo-en-sqlite)
- [HU-GAME-053 — Restaurar la partida al iniciar](#hu-game-053--restaurar-la-partida-al-iniciar)
- [HU-GAME-054 — Versionado y migraciones de guardado](#hu-game-054--versionado-y-migraciones-de-guardado)
- [HU-GAME-055 — Reiniciar el mundo](#hu-game-055--reiniciar-el-mundo)

---

## HU-GAME-052 — Autoguardado del mundo en SQLite

> **Status:** Draft
> **Epic:** EPIC-015 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-015 — Save System

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **que todo lo que cambio en el mundo se guarde solo**
para **encontrarlo igual la próxima vez sin tener que acordarme de guardar**.

### Contexto
[SAVE_SYSTEM §2–3](../../architecture/SAVE_SYSTEM.md) define el `DirtyTracker`, el `SaveService`, el puerto `SaveStore` y el adaptador `SqliteSaveStore`. El formato físico (tablas `save_slot`, `entity_state`, `entity_removed`) y el filtro de componentes persistibles están en [SAVE_SCHEMA §2–3](../../data/SAVE_SCHEMA.md). El guardado es un **diff** sobre la escena definida (invariante 6 de [ARCHITECTURE §6](../../architecture/ARCHITECTURE.md)).

### Reglas de negocio
- **RN-1:** El `DirtyTracker` se suscribe a `entityCreated`, `entityChanged`, `entityMoved`, `entityRemoved` y `playerChanged`, y acumula `EntityId` sucios y el flag `playerDirty`.
- **RN-2:** Debounce de **1000 ms** que se reinicia con cada cambio, con un **máximo de 5 s** de espera desde el primer cambio pendiente.
- **RN-3:** **Flush inmediato** cuando: `AppState` pasa a `background`/`inactive`; antes de descargar una escena (`sceneWillChange`); tras `walletChanged`.
- **RN-4:** **Nunca** se guarda durante un drag: el World no cambia hasta el `dragEnd` ([SAVE_SYSTEM §3](../../architecture/SAVE_SYSTEM.md)).
- **RN-5:** Cada flush es **una transacción**: `upserts` de `entity_state` (una fila por entidad sucia, con `scene_id` desnormalizado o `NULL` si no está en escena), inserciones en `entity_removed` y actualización de `save_slot.player`/`updated_at`.
- **RN-6:** Solo se serializan los componentes persistibles de [SAVE_SCHEMA §2](../../data/SAVE_SCHEMA.md) (p. ej. `states.current`, `edible.bitesLeft`, `purchasable.purchased`, poses persistentes `idle`/`sit`/`sleep` + `seatId`). `sprite`, `hitbox`, etc. no se guardan salvo override en runtime.
- **RN-7:** Entidad **declarada en escena** que desaparece (consumida, `limbo`) → fila en `entity_removed` y borrado de su fila en `entity_state`. Entidad **runtime** (`rt_{ulid}`) que desaparece → solo se borra su fila de `entity_state`.
- **RN-8:** Presupuesto del flush típico (1–10 entidades): target **≤ 20 ms**, warning **> 50 ms**, critical **> 100 ms** en el Android de referencia ([PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos)).
- **RN-9:** Un fallo de escritura no bloquea el juego: se registra en el log local, las entidades siguen sucias y se reintenta en el siguiente disparador. Nunca se muestra un error al niño.
- **RN-10:** Slot único `'main'` en el MVP; la columna `slot_id` existe para el futuro ([DESIGNED FOR LATER]).

### Criterios de aceptación
```gherkin
Scenario: dejo un juguete sobre la cama y sigue ahí al volver
  Given un objeto con tag "toy" (un osito) en el suelo de "core:home"
  And una entidad con `bed` y `surface` (la cama)
  When el jugador suelta el osito sobre la superficie de la cama
  And pasa 1 segundo sin más cambios
  Then existe una fila en entity_state con el id del osito, scene_id "core:home"
  And su data.components.transform.y coincide con la altura de la superficie de la cama

Scenario: debounce que se reinicia
  Given un reloj falso
  When el jugador cambia una entidad en t=0 ms, otra en t=800 ms y otra en t=1600 ms
  Then no hay escritura antes de t=2600 ms
  And en t=2600 ms se escriben las tres entidades en una sola transacción

Scenario: espera máxima de 5 segundos
  Given un reloj falso y cambios cada 500 ms de forma continua
  When pasan 5 s desde el primer cambio pendiente
  Then se produce un flush aunque sigan llegando cambios

Scenario: flush inmediato al ir a background
  Given una entidad sucia dentro de la ventana de debounce
  When AppState cambia a "background"
  Then la entidad se escribe sin esperar al debounce

Scenario: sin guardado durante un drag
  Given el jugador arrastrando un objeto durante 10 s
  When no ha soltado todavía el objeto
  Then no se produce ninguna escritura en el SaveStore por ese objeto

Scenario: comida consumida declarada en escena
  Given un objeto declarado en la escena con `edible` y bites 1 (una galleta)
  When un personaje se la come
  And se produce el flush
  Then su id está en entity_removed y no tiene fila en entity_state

Scenario: un fallo de escritura no molesta al niño
  Given un SaveStore de test que falla en la siguiente escritura
  When se produce un flush
  Then no aparece ninguna pantalla de error
  And las entidades siguen marcadas como sucias y se escriben en el siguiente flush
```
Incluye: AC-PERSIST-01, AC-PERSIST-02. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Muchas entidades sucias a la vez (p. ej. mover un contenedor con 6 objetos): una sola transacción; medir que no pase de 50 ms.
- La app se mata sin pasar por background (crash): se pierde como mucho el último intervalo de debounce (≤ 5 s); la última transacción completa sigue válida.
- Entidades de contenedores de una escena no activa: no se tocan (solo se escriben entidades sucias).
- Cambio en `player.settings` (volumen): marca `playerDirty` y entra por debounce.

### Dependencias
- HU-GAME-003: núcleo del World y EventBus (fuente de los eventos).
- HU-GAME-011: instanciar entidades desde prefabs con overrides (base del diff).

### Consideraciones técnicas
- `SaveService` y `DirtyTracker` en `engine/persistence` (TS puro); `SqliteSaveStore` en `engine/adapters/sqlite` con la API async de `expo-sqlite` y `withExclusiveTransactionAsync` o equivalente. `InMemorySaveStore` para el harness.
- El flush en background debe completarse en la ventana que da el SO; la escritura es corta por diseño.
- Estado: [NEEDED NOW]. Varios slots: [DESIGNED FOR LATER]. Cifrado local: [NOT NEEDED YET].

### Assets necesarios
- Ninguno.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de `DirtyTracker`, `SaveService.flush`, `SaveStore` y `SqliteSaveStore`
- [ ] pruebas unitarias del debounce (reloj falso) y del serializador; integración con `InMemorySaveStore`
- [ ] rendimiento: flush de 10 entidades medido en release en el Android de referencia (≤ 20 ms)
- [ ] persistencia: las tres pruebas del DoD §5 (escena, background+kill, reinicio del dispositivo)
- [ ] documentación

---

## HU-GAME-053 — Restaurar la partida al iniciar

> **Status:** Draft
> **Epic:** EPIC-015 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-015 — Save System

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **que al tocar "Continuar" aparezca mi mundo exactamente como lo dejé**
para **seguir jugando donde estaba**.

### Contexto
El orden de carga está en [SAVE_SYSTEM §4](../../architecture/SAVE_SYSTEM.md) y la reconstrucción de una escena a partir de la definición + el diff en [SAVE_SCHEMA §4](../../data/SAVE_SCHEMA.md). La integridad y la reparación de invariantes están en [SAVE_SYSTEM §5](../../architecture/SAVE_SYSTEM.md).

### Reglas de negocio
- **RN-1:** Orden de carga: (1) abrir la DB y aplicar migraciones SQL (`PRAGMA user_version`); (2) leer `save_slot 'main'`; (3) comprobar `save_version` (igual → seguir; menor → HU-GAME-054; mayor → modo no compatible de HU-GAME-054); (4) aplicar `idAliases`/`removedIds` de los packs cuya versión cambió; (5) cargar las entidades globales: **todos** los personajes (de cualquier escena), sus prendas vestidas y objetos sostenidos, y la mochila; solo se renderizan los personajes de la escena activa; (6) cargar `player.currentSceneId` con el diff; (7) colocar la cámara en `player.cameraX`.
- **RN-2:** Sin `save_slot 'main'` → **partida nueva**: la pantalla de inicio ofrece crear un personaje (HU-GAME-073). El estado inicial (`sceneId`, `spawnId`, `coins`, `unlocks`, `inventoryCapacity`) sale de `newGame` en el manifest del pack `core` ([CONTENT_PACK_SCHEMA §2](../../data/CONTENT_PACK_SCHEMA.md)).
- **RN-3:** Reconstrucción de escena: entidades de la definición − `entity_removed` + fusión de `entity_state` (`scene_id = S` o location dentro de un contenedor de S); las filas sin entidad declarada se instancian desde su `prefabId` (entidades runtime).
- **RN-4:** Los componentes se resuelven como `deepMerge(prefab, overrides, saved)` ([ENTITY_SCHEMA §3](../../data/ENTITY_SCHEMA.md)): los cambios de arte o hitbox del prefab llegan a las partidas existentes.
- **RN-5:** Poses temporales (`dangle`, `eat`, `drink`) no se guardan; al cargar, el personaje vuelve a `returnTo` o a `idle`. `expression` vuelve a `neutral`.
- **RN-6:** Invariantes tras cargar: cada entidad tiene una location válida; no hay dos entidades en el mismo slot de contenedor o de mochila ni en la misma mano; ningún `seatId` apunta a un asiento ocupado por otro. En dev una violación lanza error claro; **en producción se repara**: la entidad conflictiva pasa a la escena actual en el spawn `default` y se registra `logger.warn`. Nunca se bloquea al niño.
- **RN-7:** Una entidad cuyo `prefabId` no existe y no tiene alias se descarta, se registra una advertencia y, si ocupaba un slot de contenedor o mochila, el slot queda libre ([SAVE_SCHEMA §5](../../data/SAVE_SCHEMA.md), regla 5).
- **RN-8:** Presupuesto Title → escena jugable (con guardado): target **≤ 1,5 s**, warning **> 2,5 s**, critical **> 4 s** ([PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos)).

### Criterios de aceptación
```gherkin
@persistence
Scenario: dejo un juguete sobre la cama y sigue ahí al volver (tras cerrar la app)
  Given el osito (tag "toy") colocado sobre la superficie de la cama en "core:home"
  And pasó al menos 1 segundo
  When la app se cierra por completo y se vuelve a abrir
  And el jugador toca "Continuar"
  Then el osito está en "core:home" con la misma x e y sobre la cama

Scenario: se retoma en la escena y la cámara guardadas
  Given un guardado con player.currentSceneId "core:home" y cameraX 2400
  When se carga la partida
  Then la escena activa es "core:home" y cameraX es 2400

Scenario: partida nueva sin guardado
  Given una base de datos sin save_slot "main"
  When arranca la app
  Then la pantalla de inicio ofrece crear un personaje y no ofrece "Continuar"

Scenario: pose temporal normalizada
  Given un personaje guardado mientras comía, con returnTo "sit"
  When se carga la partida
  Then su pose es "sit" y su expresión es "neutral"

Scenario: reparación de un invariante roto en producción
  Given un guardado manipulado con dos entidades en el mismo slot 0 de un contenedor
  When se carga la partida en modo producción
  Then una de ellas queda en el slot 0 y la otra en la escena actual, en el spawn "default"
  And se registra una advertencia y no se muestra ningún error

Scenario: prefab desaparecido sin alias
  Given un guardado con una entidad runtime de prefabId "core:obsolete_toy" que no existe
  When se carga la partida
  Then la entidad se descarta, su slot queda libre y se registra una advertencia

@performance @manual
Scenario: tiempo de carga
  Given una build release en el Android de referencia y un guardado con 150 entidades modificadas
  When el jugador toca "Continuar"
  Then la escena es interactiva en ≤ 1,5 s
```
Incluye: AC-PERSIST-02. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Personaje guardado sentado en un asiento cuyo prefab ya no tiene `seat`: se levanta (`idle`) junto al asiento.
- Objeto guardado dentro de un contenedor que ya no existe: se aplica RN-6 (spawn `default`).
- Guardado con `currentSceneId` de una escena retirada: se carga `newGame.sceneId` en `newGame.spawnId` y se registra una advertencia.
- DB bloqueada o ilegible: se trata como fallo de carga (HU-GAME-054, pantalla amable).

### Dependencias
- HU-GAME-052: autoguardado (formato que se lee).

### Consideraciones técnicas
- `SaveService.load()` en core; lectura por escena con `idx_entity_scene`. Validación zod del `data` JSON al leer.
- Las entidades de otras escenas no se cargan en memoria ([GAME_ENGINE §3](../../architecture/GAME_ENGINE.md)).
- [NEEDED NOW].

### Assets necesarios
- Ninguno.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación del orden de carga y de la reparación de invariantes
- [ ] pruebas de integración con fixtures de guardado (incluido el caso canónico del osito en la cama)
- [ ] rendimiento: Title → escena medido en release y anotado
- [ ] persistencia: DoD §5 completo
- [ ] documentación

---

## HU-GAME-054 — Versionado y migraciones de guardado

> **Status:** Draft
> **Epic:** EPIC-015 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-015 — Save System

### Prioridad
Must · P0

### Historia
Como **desarrollador**
quiero **un sistema de versiones y migraciones con copia de seguridad**
para **actualizar la app y el contenido sin romper ni perder ninguna partida existente**.

### Contexto
Hay **tres versiones independientes** ([SAVE_SCHEMA §5](../../data/SAVE_SCHEMA.md#migraciones)): `PRAGMA user_version` (estructura SQL), `saveVersion` (formato de `GameSave`/`SavedEntity`/componentes persistibles) y `contentVersions[pack]` (IDs renombrados o retirados, vía `idAliases`/`removedIds` del manifest, [CONTENT_PACK_SCHEMA §2](../../data/CONTENT_PACK_SCHEMA.md)). Esta HU implementa los tres mecanismos; los fixtures de regresión son HU-GAME-072.

### Reglas de negocio
- **RN-1 (SQL):** migraciones numeradas `sql/001_init.sql`, `002_…`, aplicadas en orden hasta la versión que soporta la app; cada una actualiza `PRAGMA user_version`.
- **RN-2 (formato):** funciones TS puras encadenadas `migrate_N_to_N+1`, **idempotentes por paso**, cada una con test y fixture. v1 = `saveVersion` 1.
- **RN-3 (contenido):** al detectar que `contentVersions[pack]` difiere de la versión cargada, se aplican `idAliases` (renombra `prefabId` y `EntityId` de escena) y `removedIds` (descarta entidades y libera slots), y se actualiza `contentVersions`.
- **RN-3b (pack más nuevo en el guardado que en la app):** si difiere la versión **major**, el guardado no se abre (como RN-6); si difiere solo la minor o la patch, se abre y las entidades de prefabs desconocidos se descartan (regla 6 de [SAVE_SCHEMA §5](../../data/SAVE_SCHEMA.md#migraciones)).
- **RN-4 (backup):** antes de **cualquier** migración, SQL (`user_version`) o de datos (`saveVersion`), se ejecuta `VACUUM INTO 'myworld.backup.db'`.
- **RN-5 (fallo):** si una migración falla: se restaura la copia, se muestra la pantalla amable "no pudimos cargar tu mundo" (ilustración, sin texto obligatorio para el niño), se ofrece empezar de nuevo **sin borrar la copia** y se registra el error en el log local.
- **RN-6 (hacia delante):** un guardado con `save_version` (o `user_version`) **mayor** que el soportado **no se abre ni se modifica**; se muestra un aviso. **Propuesta:** en ese modo no se ofrece empezar de nuevo desde la pantalla del niño (sobrescribiría el slot); solo desde Ajustes tras la puerta parental.
- **RN-7:** **Propuesta:** "empezar de nuevo" tras un fallo de migración requiere la puerta parental (HU-GAME-074), porque sustituye el mundo del niño.
- **RN-8:** Cambiar un componente persistible de forma incompatible exige subir `saveVersion`, escribir la migración y su fixture ([ENTITY_SCHEMA §7](../../data/ENTITY_SCHEMA.md)).

### Criterios de aceptación
```gherkin
Scenario: migración de formato con backup previo
  Given un guardado con saveVersion 1 y una app que soporta saveVersion 2 con migrate_1_to_2
  When arranca la app
  Then existe el archivo "myworld.backup.db" creado antes de migrar
  And save_slot.save_version es 2
  And el contenido migrado coincide con el fixture esperado

Scenario: la migración es idempotente por paso
  Given un GameSave v1 de fixture
  When se aplica migrate_1_to_2 dos veces sobre la salida de la primera
  Then el resultado es igual al de aplicarla una sola vez

Scenario: fallo de migración
  Given una migración de test que lanza un error
  When arranca la app con un guardado que la necesita
  Then la base de datos se restaura desde la copia
  And se muestra la pantalla amable de "no pudimos cargar tu mundo"
  And "myworld.backup.db" sigue existiendo
  And el error queda en el log local

Scenario: guardado de una versión futura
  Given un guardado con saveVersion mayor que el soportado
  When arranca la app
  Then no se ejecuta ninguna escritura sobre myworld.db
  And se muestra el aviso de guardado no compatible

Scenario: ID renombrado en el pack
  Given un guardado con una entidad de prefabId "core:apple" y contentVersions core "1.0.0"
  And el pack core 2.0.0 con idAliases { "core:apple": "core:apple_red" }
  When se carga la partida
  Then la entidad tiene prefabId "core:apple_red"
  And contentVersions.core es "2.0.0"

Scenario: pack con major más nuevo en el guardado
  Given un guardado con contentVersions core "2.0.0" y una app con el pack core "1.4.0"
  When arranca la app
  Then el guardado no se abre ni se modifica y se muestra el aviso de guardado no compatible

Scenario: pack con minor más nuevo en el guardado
  Given un guardado con contentVersions core "1.5.0", una entidad de un prefab añadido en 1.5.0 y una app con core "1.4.0"
  When arranca la app
  Then la partida se abre y esa entidad se descarta con una advertencia

Scenario: backup antes de una migración SQL
  Given una base de datos con PRAGMA user_version 1 y una app que requiere 2
  When arranca la app
  Then "myworld.backup.db" se crea antes de ejecutar sql/002

Scenario: ID retirado en el pack
  Given un guardado con una entidad en el slot 2 de la mochila cuyo prefab está en removedIds
  When se carga la partida
  Then la entidad no existe y el slot 2 de la mochila está libre
```
Incluye: AC-PERSIST-02. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Poco espacio en disco para el backup: no se migra; se trata como fallo de migración (RN-5) sin tocar el original.
- App matada a mitad de migración: al arrancar, la migración se repite desde el estado anterior (transacción) o se restaura la copia.
- `contentVersions` con un pack más nuevo que el incluido en la app (downgrade): RN-3b.
- Varias migraciones seguidas (1→2→3): una sola copia de seguridad antes de la primera.

### Dependencias
- HU-GAME-052: autoguardado (formato y tablas a versionar).

### Consideraciones técnicas
- Migraciones de formato en `engine/persistence/migrations` (TS puro, sin SQL). Migraciones SQL en el adaptador.
- Log local: sin datos personales y sin red.
- [NEEDED NOW]. Exportar/importar `GameSave` como JSON: [DESIGNED FOR LATER].

### Assets necesarios
- `ui_error_world_01`: ilustración amable de "no pudimos cargar tu mundo" (placeholder: sí en dev, no en release).
- `ui_warning_update_01`: ilustración del aviso de guardado no compatible (placeholder: sí en dev).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de los tres mecanismos de versión y del backup con `VACUUM INTO`
- [ ] pruebas: cadena de migraciones con fixture, fallo con restauración, versión futura, alias y retirados
- [ ] persistencia: el backup se conserva tras un fallo
- [ ] documentación: tabla de versiones en SAVE_SCHEMA si cambia

---

## HU-GAME-055 — Reiniciar el mundo

> **Status:** Draft
> **Epic:** EPIC-015 · **Fase:** 1 · **Alcance:** MVP P2
> **Last Updated:** 2026-09-18

### Epic
EPIC-015 — Save System

### Prioridad
Could · P2

### Historia
Como **padre/madre**
quiero **reiniciar el mundo desde los ajustes, con opción de conservar los personajes**
para **que mi hijo pueda empezar de cero o para pasar el dispositivo a un hermano**.

### Contexto
[SAVE_SYSTEM §6](../../architecture/SAVE_SYSTEM.md): solo detrás de la puerta parental, backup previo, borrado de `entity_state` y `entity_removed` del slot, reinicio de `player` conservando `settings`, y opción de conservar personajes. El comando es `resetWorld { keepCharacters }` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).

### Reglas de negocio
- **RN-1:** Solo accesible desde Ajustes (HU-GAME-075), que ya está detrás de la puerta parental (HU-GAME-074).
- **RN-2:** Confirmación de adulto: diálogo con dos opciones claras ("Reiniciar todo" / "Reiniciar y conservar personajes") y un botón de confirmar que se mantiene pulsado **2 s** (propuesta) para evitar toques accidentales. Botones ≥ 48 dp.
- **RN-3:** Antes de borrar: `VACUUM INTO 'myworld.backup.db'`. Si el backup falla, no se reinicia.
- **RN-4:** Reinicio en una transacción: se borran `entity_state` y `entity_removed` del slot `'main'`; `player` vuelve a los valores de `newGame` del manifest `core` (`sceneId`, `spawnId`, `coins`, `unlocks`, `inventoryCapacity`), con mochila vacía, `flags` vacíos y sin `dailyReward`, **conservando `settings`**.
- **RN-5:** Con `keepCharacters = true` (**propuesta** de alcance): se conservan los personajes (`character`, `appearance`) y sus prendas vestidas; aparecen en `newGame.sceneId` en `newGame.spawnId`, separados 120 unidades, con pose `idle`. Los objetos que sostenían y la mochila se vacían (vuelven a su estado de contenido).
- **RN-6:** Con `keepCharacters = false`: tras el reinicio, la app vuelve a la pantalla de inicio en modo partida nueva (crear personaje).
- **RN-7:** El comando no afecta a otras apps ni borra el backup.

### Criterios de aceptación
```gherkin
Scenario: reiniciar todo
  Given un mundo con objetos movidos, 2 personajes y 80 monedas
  And el adulto pasó la puerta parental y está en Ajustes
  When confirma "Reiniciar todo" manteniendo pulsado el botón 2 s
  Then se crea "myworld.backup.db" antes de borrar
  And entity_state y entity_removed del slot "main" están vacías
  And player.settings no cambió
  And la app muestra la pantalla de inicio en modo partida nueva

Scenario: reiniciar conservando personajes
  Given un mundo con 2 personajes vestidos, uno en "core:store"
  When el adulto confirma "Reiniciar y conservar personajes"
  Then los 2 personajes existen en "core:home", cerca del spawn "default", con pose "idle"
  And conservan su apariencia y sus prendas vestidas
  And el resto de entidades de las escenas vuelven al estado definido en el contenido

Scenario: cancelar
  Given el diálogo de confirmación abierto
  When el adulto suelta el botón antes de 2 s o toca "cancelar"
  Then no se borra nada

Scenario: backup fallido
  Given un SaveStore de test cuyo backup falla
  When el adulto confirma el reinicio
  Then el mundo no cambia y se muestra un aviso para el adulto

@persistence
Scenario: el reinicio persiste
  Given un mundo reiniciado
  When la app se cierra por completo y se vuelve a abrir
  Then el mundo sigue en el estado reiniciado y los ajustes son los de antes
```
Incluye: AC-PERSIST-02. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- App matada durante el reinicio: la transacción garantiza todo o nada.
- Reinicio con una transición de escena en curso: el botón no está disponible fuera de Ajustes, así que no hay escena activa en transición.
- Un segundo reinicio sobrescribe el backup anterior (propuesta: un solo backup en el MVP).

### Dependencias
- HU-GAME-053: restaurar la partida (el estado resultante se carga igual que una partida).
- HU-GAME-074: puerta parental.

### Consideraciones técnicas
- `SaveService.reset({ keepCharacters })` en core; el adaptador implementa el borrado en una transacción.
- Valores de "partida nueva": salen de `newGame` en el manifest del pack `core` ([CONTENT_PACK_SCHEMA §2](../../data/CONTENT_PACK_SCHEMA.md)), nunca del código.
- [NEEDED NOW] (P2, recortable).

### Assets necesarios
- `ui_icon_reset`: icono del reinicio en Ajustes (placeholder: sí en dev).
- Textos i18n del diálogo de confirmación (adulto).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación de `resetWorld` con backup y transacción
- [ ] pruebas de integración de ambos modos, cancelación y backup fallido
- [ ] persistencia tras cerrar la app
- [ ] documentación
