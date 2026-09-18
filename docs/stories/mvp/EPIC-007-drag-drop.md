# EPIC-007 — Drag & Drop

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 0 (HU-GAME-029 y HU-GAME-030 en Fase 1)
> **Docs:** [INPUT_SYSTEM](../../architecture/INPUT_SYSTEM.md) · [INTERACTION_SYSTEM](../../architecture/INTERACTION_SYSTEM.md) · [RENDERING](../../architecture/RENDERING.md) · [ENTITY_SCHEMA](../../data/ENTITY_SCHEMA.md) · [SAVE_SYSTEM](../../architecture/SAVE_SYSTEM.md) · [PERFORMANCE](../../architecture/PERFORMANCE.md) · [ADR-009](../../decisions/ADR-009-STATE-AND-THREADING.md)

## Objetivo del epic
Que el niño pueda coger cualquier objeto arrastrable con el dedo, sin esperas, llevarlo por la escena (con auto-scroll cerca de los bordes) y soltarlo sobre una superficie o el suelo, donde queda apoyado de forma creíble y persistente. El movimiento vive en el UI thread; el World solo cambia al soltar.

## Historias
- [HU-GAME-027 — Arrastrar objetos](#hu-game-027--arrastrar-objetos)
- [HU-GAME-028 — Soltar objetos sobre superficies y el suelo](#hu-game-028--soltar-objetos-sobre-superficies-y-el-suelo)
- [HU-GAME-029 — Auto-scroll de la cámara al arrastrar cerca del borde](#hu-game-029--auto-scroll-de-la-cámara-al-arrastrar-cerca-del-borde)
- [HU-GAME-030 — Los objetos apoyados se mueven con su mueble](#hu-game-030--los-objetos-apoyados-se-mueven-con-su-mueble)

---

## HU-GAME-027 — Arrastrar objetos

> **Status:** Draft
> **Epic:** EPIC-007 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-007 — Drag & Drop

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **coger un objeto con el dedo y moverlo por la escena al instante**
para **jugar libremente con todo lo que veo, como en una casa de muñecas**.

### Contexto
El drag empieza en cuanto hay un movimiento de 6 dp sobre una entidad `draggable`, **sin long press** ([INPUT_SYSTEM §2](../../architecture/INPUT_SYSTEM.md)). Durante el arrastre la entidad original se oculta y la dibuja el `DragProxy` en el UI thread; el World no cambia hasta el `dragEnd` ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md)). Los comandos son `dragStart`, `dragEnd` y `dragCancel` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)); el `DragSystem` aplica las transiciones de location al empezar ([INTERACTION_SYSTEM §5](../../architecture/INTERACTION_SYSTEM.md)).

### Reglas de negocio
- **R1 — Un solo detector** de gestos para toda la Canvas, en `src/engine/adapters/input/` ([INPUT_SYSTEM §1](../../architecture/INPUT_SYSTEM.md)).
- **R2 — Inicio:** el primer hit test (HU-GAME-026) decide entre drag y paneo; el drag empieza con un movimiento ≥ **6 dp** sobre una entidad con `draggable.enabled`. La decisión no cambia a mitad del gesto ([INPUT_SYSTEM §6](../../architecture/INPUT_SYSTEM.md)).
- **R3 — Validación en `dragStart { entityId, worldPoint }`:** la entidad existe, tiene `draggable` con `enabled !== false` y su location permite arrastrarla. Si no, `{ ok: false, reason }` (`entityNotFound`, `notDraggable`) y el gesto pasa a paneo.
- **R4 — Transiciones al empezar:** `dragStart` **ejecuta** las transiciones de location ([INTERACTION_SYSTEM §5](../../architecture/INTERACTION_SYSTEM.md), [GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)). El `DragSystem` tiene una tabla por `location.kind`, sin `if` por objeto, y guarda la location y la posición originales para poder deshacerlas:
  - `scene`: sin cambio;
  - `held`: el objeto sale de la mano (location → escena, en la posición del dedo) — esta HU;
  - `container` abierto: `takeOut` implícito — lo conecta HU-GAME-036;
  - personaje sentado o dormido: `standUp` implícito y pose `dangle` — lo conectan HU-GAME-017 y HU-GAME-045;
  - `worn`: **no** se arrastra directamente. La prenda solo se arrastra si un `pointerLongPress` (regla `unwear_clothes`) devuelve `startDrag` (HU-GAME-040).
- **R5 — DragProxy:** se dibuja siempre encima de todo, con `liftOffset` (16 por defecto, [ENTITY_SCHEMA §5.4](../../data/ENTITY_SCHEMA.md)), escala 1,05 y sombra. Arranca con `offset = punto del dedo − pivot`, así que no hay salto visible. La entidad original se oculta mientras dura el drag.
- **R6 — World congelado:** entre `dragStart` y `dragEnd` el estado lógico no cambia (salvo las transiciones de R4) y **no** se guarda ([SAVE_SYSTEM §3](../../architecture/SAVE_SYSTEM.md)).
- **R7 — Sin React por frame:** la posición del proxy son SharedValues del UI thread; el JS solo recibe `dragPreview` cuando cambia el target (HU-GAME-033).
- **R8 — `dragEnd { entityId, worldPoint, uiTarget? }`:** delega en el resolver (HU-GAME-031) o, sin reglas, en `place` (HU-GAME-028). HU-GAME-027 y HU-GAME-028 se desarrollan en la misma iteración, en ese orden.
- **R9 — Bordes del sistema:** un drag no empieza si el toque inicial cae en los **16 dp** de cualquier borde de la pantalla ([INPUT_SYSTEM §6](../../architecture/INPUT_SYSTEM.md)).
- **R10 — Un solo puntero:** un segundo dedo durante el drag se ignora.
- **R11 — Cancelación:** si el gesto termina sin `onEnd` (llamada, app a background, cambio de orientación), se envía `dragCancel { entityId }`, que **deshace** las transiciones de R4: el objeto vuelve a su location y posición originales (a la mano, al contenedor o al asiento) ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).
- **R12 — Presupuestos** ([PERFORMANCE §2](../../architecture/PERFORMANCE.md)): FPS del UI thread 60 durante el drag (warning < 55 de media en 10 s).

### Criterios de aceptación
```gherkin
Scenario: empezar a arrastrar no cambia el World
  Given una pelota draggable en la escena en (1000, 960)
  When se despacha dragStart { entityId: pelota, worldPoint: (1000, 930) }
  Then dispatch devuelve { ok: true }
  And la pelota sigue con transform (1000, 960) y location scene
  And no se emite entityMoved

Scenario: no se puede arrastrar lo que no es draggable
  Given una nevera sin componente draggable
  When se despacha dragStart sobre la nevera
  Then dispatch devuelve { ok: false, reason: "notDraggable" }

Scenario: draggable deshabilitado
  Given un objeto con draggable { enabled: false }
  When se despacha dragStart sobre él
  Then dispatch devuelve { ok: false, reason: "notDraggable" }

Scenario: cancelar devuelve el objeto a su origen
  Given una pelota en (1000, 960) que se está arrastrando
  When se despacha dragCancel
  Then la pelota sigue en (1000, 960)
  And no se marca ninguna entidad como sucia

Scenario: arrastrar un objeto que está en una mano
  Given un objeto con location held en la mano izquierda de un personaje
  When se despacha dragStart sobre el objeto en el punto (1500, 700)
  Then la location del objeto pasa a scene
  And la mano izquierda del personaje queda libre en world.index.heldBy

Scenario: cancelar deshace la salida de la mano
  Given un objeto que estaba en la mano izquierda y se está arrastrando tras su dragStart
  When se despacha dragCancel
  Then la location del objeto vuelve a ser { kind: "held", holderId: personaje, hand: "left" }
  And world.index.heldBy(personaje) vuelve a contener el objeto

Scenario: una prenda vestida no se arrastra
  Given una prenda con location worn
  When se despacha dragStart sobre ella
  Then dispatch devuelve { ok: false }

@manual
Scenario: umbral de 6 dp sin espera
  Given una pelota en un teléfono
  When el jugador pone el dedo sobre la pelota y lo mueve 5 dp
  Then la pelota no se mueve
  And al seguir hasta 6 dp la pelota se levanta y sigue al dedo sin esperar y sin saltar

@manual
Scenario: margen de los bordes del sistema
  Given una pelota a menos de 16 dp del borde izquierdo de la pantalla
  When el jugador empieza el gesto en ese margen
  Then no empieza el drag y no se dispara el gesto "back" de la app

@manual
Scenario: interrupción por una llamada
  Given una pelota que se está arrastrando
  When entra una llamada o la app pasa a background
  Then al volver la pelota está en su posición original

@performance @manual
Scenario: fluidez del drag
  Incluye: AC-PERF-01
  # Además: el profiler de React no registra renders de entidades durante el drag.
```

### Casos límite
- Segundo dedo que empieza su propio gesto: se ignora; el primero sigue.
- La entidad se elimina mientras se arrastra (improbable en el MVP): el proxy desaparece y el `dragEnd` devuelve `{ ok: false, reason: "entityNotFound" }`.
- Latencia del primer frame: 1-2 frames de retraso hasta que el objeto se pega al dedo son aceptables ([INPUT_SYSTEM §3](../../architecture/INPUT_SYSTEM.md)); se mide en el spike de HU-GAME-026.
- Objeto sin comprar en la tienda: se arrastra dentro de la tienda (HU-GAME-064).

### Dependencias
- HU-GAME-026: hit testing.

### Consideraciones técnicas
- Documentos: [INPUT_SYSTEM §2, §3, §6](../../architecture/INPUT_SYSTEM.md), [INTERACTION_SYSTEM §5](../../architecture/INTERACTION_SYSTEM.md), [RENDERING §3](../../architecture/RENDERING.md), [ADR-009](../../decisions/ADR-009-STATE-AND-THREADING.md).
- [NEEDED NOW] gesto único, DragProxy, `DragSystem` con tabla de transiciones.
- [DESIGNED FOR LATER] multitouch (HU-GAME-101); hit test en el UI thread si el spike lo exige.
- Restricción: el cruce UI → JS se hace con `scheduleOnRN` de `react-native-worklets` solo en `onBegin`, al cambiar de target y en `onEnd`/`onFinalize`.

### Assets necesarios
- Sombra del DragProxy: elipse dibujada por el motor (sin asset).
- Sonido `sfx_pickup_soft` para `sounds.pickup` cuando exista el AudioService (placeholder aceptable: sí; Kenney Interface Sounds, CC0).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests en el harness de `dragStart`, `dragCancel` y transiciones `held`.
- [ ] Verificación manual de umbral, margen, interrupción y fluidez en Android e iOS.
- [ ] FPS del UI thread durante el drag anotados en la HU.

---

## HU-GAME-028 — Soltar objetos sobre superficies y el suelo

> **Status:** Draft
> **Epic:** EPIC-007 · **Fase:** 0 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-007 — Drag & Drop

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **soltar un objeto y que quede apoyado sobre la mesa, la cama o el suelo que hay debajo**
para **ordenar la casa a mi gusto y encontrar las cosas donde las dejé**.

### Contexto
Si el drop no resuelve ninguna regla, se aplica la acción `place` del `SurfaceSystem` ([INPUT_SYSTEM §7](../../architecture/INPUT_SYSTEM.md), [INTERACTION_SCHEMA §5](../../data/INTERACTION_SCHEMA.md)). Las superficies son segmentos horizontales relativos al pivot ([ENTITY_SCHEMA §5.5](../../data/ENTITY_SCHEMA.md)); el suelo se declara en la escena ([SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md)). El caso de referencia del guardado es "dejo un juguete sobre la cama y sigue ahí al volver" ([SAVE_SYSTEM §1](../../architecture/SAVE_SYSTEM.md)).

### Reglas de negocio
- **R1 — Algoritmo de `place`** ([INPUT_SYSTEM §7](../../architecture/INPUT_SYSTEM.md)):
  1. se buscan los segmentos de `surface` cuyo rango en x cubre `worldX` y cuya `y` absoluta es **≥ worldY − 40** (40 unidades de tolerancia para soltar "un poco por debajo");
  2. se elige el segmento **más alto** (menor `y`) que cumpla lo anterior: el primero con el que el objeto "caería";
  3. si no hay ninguno, se usa el segmento de `scene.floor` bajo `x`;
  4. `transform.y` pasa a la `y` del segmento; `transform.x` al `worldX`.
- **R2 — Coordenadas absolutas del segmento:** `x1 + transform.x`, `x2 + transform.x`, `y + transform.y` de la entidad que tiene la superficie (con `scale` y `flipX` aplicados, propuesta igual que HU-GAME-026).
- **R3 — Exclusiones:** no cuentan las superficies del propio objeto ni las de lo que lleva encima.
- **R4 — `floorOnly`:** si el objeto tiene `draggable.mode === 'floorOnly'` (muebles), ignora las superficies y va directo al suelo.
- **R5 — Límites:** `x` se limita a `[0, scene.width]`.
- **R6 — Índice de apoyo:** `world.index.supportOf(id)` es un índice **derivado y no persistido** que dice qué mueble sostiene cada objeto. Se recalcula a partir de la geometría (posición y segmentos) al soltar el objeto y al cargar la escena. El render lo usa para dibujar el objeto por encima de su mueble: `max(z propio, z del mueble + 1)` ([RENDERING §4](../../architecture/RENDERING.md)). Con `surface.carriesItems` la fuente pasa a ser `transform.parentId` (HU-GAME-030).
- **R7 — Presentación:** caída de ≤ 250 ms con `squash` al tocar (via `visualEffect`, HU-GAME-009). La lógica es instantánea: el World ya tiene la posición final.
- **R8 — Eventos y guardado:** el cambio emite `entityChanged`/`entityMoved` en una transacción; el DirtyTracker lo marca y el autosave guarda con debounce de 1000 ms (máximo 5 s) ([SAVE_SYSTEM §3](../../architecture/SAVE_SYSTEM.md)).
- **R9 — Tiempo de respuesta:** del dedo arriba al estado aplicado ≤ 50 ms (target; warning > 100 ms) ([PERFORMANCE §2](../../architecture/PERFORMANCE.md)).

Datos de los ejemplos: mesa en (2600, 960) con `surface.segments [{ x1: -120, x2: 120, y: -180 }]` → segmento absoluto de x 2480 a 2720 en y = 780. Suelo en y = 960.

### Criterios de aceptación
```gherkin
Scenario: soltar sobre la mesa
  Given la mesa de ejemplo y una pelota arrastrándose
  When se suelta en (2600, 800)
  Then la pelota queda en transform (2600, 780)

Scenario: soltar un poco por debajo de la mesa (tolerancia de 40)
  Given la mesa de ejemplo
  When se suelta la pelota en (2600, 815)
  Then la pelota queda en y = 780

Scenario: soltar demasiado por debajo de la mesa cae al suelo
  Given la mesa de ejemplo
  When se suelta la pelota en (2600, 830)
  Then la pelota queda en y = 960

Scenario: soltar muy por encima cae a la primera superficie
  Given la mesa de ejemplo
  When se suelta la pelota en (2600, 300)
  Then la pelota queda en y = 780

Scenario: soltar fuera de la mesa cae al suelo
  Given la mesa de ejemplo
  When se suelta la pelota en (2750, 800)
  Then la pelota queda en (2750, 960)

Scenario: un mueble floorOnly ignora las superficies
  Given una silla con draggable { mode: "floorOnly" }
  When se suelta sobre la mesa en (2600, 800)
  Then la silla queda en y = 960

Scenario: x limitada a la escena
  Given la escena "test:room" de 3840 unidades
  When se suelta la pelota en (-50, 900)
  Then la pelota queda en x = 0

Scenario: el objeto apoyado se dibuja encima de su mueble
  Given una pelota apoyada sobre la mesa
  When se calcula el orden de render
  Then world.index.supportOf(pelota) es la mesa
  And la pelota se dibuja después que la mesa

Scenario: el índice de apoyo se reconstruye al cargar la escena
  Given un guardado con la pelota en (2600, 780) sobre la mesa de ejemplo
  When se carga la escena
  Then world.index.supportOf(pelota) es la mesa
  And el SavedEntity de la pelota no contiene ninguna referencia a la mesa

@persistence
Scenario: el juguete sigue sobre la cama tras cerrar la app
  Incluye: AC-PERSIST-02
  Given un juguete soltado sobre la superficie de una cama
  And pasó al menos 1 segundo
  When la app se cierra por completo y se vuelve a abrir
  Then el juguete está en la misma x y en la y de la superficie de la cama
  # En el harness: guardar con InMemorySaveStore y recargar; se verifica cuando HU-GAME-052/053 estén Done.

Scenario: el juguete sigue sobre la cama al cambiar de escena y volver
  Incluye: AC-PERSIST-01
```

### Casos límite
- Dos superficies a la misma altura bajo el punto (dos mesas pegadas): cualquiera vale para la `y`; el índice de apoyo elige la del frente (propuesta).
- Suelo que no cubre la `x`: no puede ocurrir, porque el `floor` debe cubrir `0..width` sin huecos y el validador lo impide ([SCENE_SCHEMA §3](../../data/SCENE_SCHEMA.md), regla 5b). Si aun así pasa en runtime, se registra `logger.warn` y se usa el segmento de suelo más cercano en horizontal (red de seguridad, propuesta; nunca un error para el niño).
- Soltar un objeto sobre una superficie del propio objeto (una bandeja sobre sí misma): excluido por R3.
- Soltar mientras la escena está en transición: la entrada está bloqueada ([SCENE_SYSTEM §4](../../architecture/SCENE_SYSTEM.md)); el drag se cancela.

### Dependencias
- HU-GAME-027: drag y `dragEnd`.

### Consideraciones técnicas
- Documentos: [INPUT_SYSTEM §7](../../architecture/INPUT_SYSTEM.md), [ENTITY_SCHEMA §5.5](../../data/ENTITY_SCHEMA.md), [SCENE_SCHEMA §2](../../data/SCENE_SCHEMA.md), [RENDERING §4](../../architecture/RENDERING.md), [SAVE_SYSTEM §3](../../architecture/SAVE_SYSTEM.md).
- [NEEDED NOW] `SurfaceSystem`, acción `place`, índice `supportOf`.
- [DESIGNED FOR LATER] `surface.carriesItems` (HU-GAME-030).
- Restricción: `place` es una función pura sobre el World; no conoce dp ni el tipo de objeto.

### Assets necesarios
- Sonido `sfx_drop_soft` para `sounds.drop` (placeholder aceptable: sí; Kenney Interface Sounds, CC0).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests en el harness de todos los escenarios con la mesa de ejemplo.
- [ ] Tiempo de respuesta del drop medido en el Android de referencia y anotado.
- [ ] Persistencia verificada en el harness y en el dispositivo (los tres casos del DoD global §5).

---

## HU-GAME-029 — Auto-scroll de la cámara al arrastrar cerca del borde

> **Status:** Draft
> **Epic:** EPIC-007 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-007 — Drag & Drop

### Prioridad
Must · P1

### Historia
Como **jugador**
quiero **que la pantalla se desplace sola cuando llevo un objeto hacia el borde**
para **llevar cosas de una habitación a otra sin soltarlas**.

### Contexto
La casa mide 7680 unidades y en un teléfono se ven unas 2340 ([RENDERING §2.1](../../architecture/RENDERING.md)). Sin auto-scroll, llevar la leche de la cocina al dormitorio obligaría a soltar y panear varias veces. [RENDERING §5](../../architecture/RENDERING.md) define la zona del 12 % del ancho, la velocidad proporcional a la profundidad y el máximo de 1400 unidades por segundo.

### Reglas de negocio
- **R1 — Zona:** el 12 % del ancho de la pantalla en cada lado.
- **R2 — Velocidad:** proporcional a la profundidad del dedo dentro de la zona: `v = 1400 × profundidad / anchoZona` unidades por segundo (lineal, propuesta), con un máximo de **1400 u/s**. Hacia la izquierda si el dedo está en la zona izquierda y hacia la derecha si está en la derecha.
- **R3 — Independiente del frame rate:** se integra con el delta de cada frame; a 60 Hz y a 120 Hz la cámara avanza lo mismo por segundo.
- **R4 — UI thread:** el auto-scroll corre en un frame callback del UI thread; no hay cruce a JS por frame.
- **R5 — El objeto sigue al dedo:** mientras la cámara avanza, la posición del proxy en el mundo se actualiza (`worldX = touchXdp / scale + cameraX`), así que el objeto no se queda atrás.
- **R6 — Fin:** se detiene cuando el dedo sale de la zona, cuando la cámara llega a sus bounds o cuando termina el drag. Al detenerse se despacha **una vez** `cameraSettled { cameraX }` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)), que actualiza `player.cameraX` y la zona activa (HU-GAME-012).
- **R7 — Solo durante un drag de entidad**; nunca durante un paneo.
- **R8 — Target del drop:** el `dragEnd` usa el `worldPoint` calculado con el `cameraX` final.

### Criterios de aceptación
```gherkin
Scenario: velocidad en el borde interior de la zona
  Given una pantalla de 844 dp de ancho (zona de 101,28 dp)
  When el dedo está a 101,28 dp del borde derecho
  Then la velocidad es 0 u/s

Scenario: velocidad en mitad de la zona
  Given la misma pantalla
  When el dedo está a 30 dp del borde derecho
  Then la velocidad es ≈ 985 u/s hacia la derecha

Scenario: velocidad máxima
  Given la misma pantalla
  When el dedo está en el borde derecho (0 dp)
  Then la velocidad es 1400 u/s

Scenario: la cámara no pasa de los bounds
  Given la escena "core:home", viewportW = 2338 y cameraX = 5300
  When el auto-scroll avanza 1 s a 1400 u/s hacia la derecha
  Then cameraX queda en 5342

Scenario: al terminar el auto-scroll se informa al motor una vez
  Given un auto-scroll en curso
  When el dedo sale de la zona del borde y la cámara se detiene en cameraX = 2000
  Then se despacha exactamente un cameraSettled { cameraX: 2000 }

Scenario: el drop cae donde está el dedo en el mundo
  Given un drag que empezó con cameraX = 0 y terminó con cameraX = 2000 tras el auto-scroll
  And scale = 0,3611 y el dedo en x = 700 dp
  When se suelta el objeto
  Then dragEnd recibe worldPoint.x ≈ 3938

@manual
Scenario: llevar un objeto de la cocina al dormitorio
  Given la leche en la cocina y la cámara en la cocina
  When el jugador la arrastra hasta el borde derecho y la mantiene ahí
  Then la cámara se desplaza hacia el dormitorio con la leche bajo el dedo
  And al alejar el dedo del borde la cámara se detiene

@manual
Scenario: misma velocidad a 60 y 120 Hz
  Given un dispositivo de 60 Hz y otro de 120 Hz
  When se mantiene el dedo en el borde durante 2 s
  Then la cámara recorre ≈ 2800 unidades en ambos

@performance @manual
Scenario: escenario de estrés con auto-scroll
  Incluye: AC-PERF-01
  # Escenario de referencia de PERFORMANCE §3: arrastrar un objeto de punta a punta de Home con auto-scroll durante 30 s.
```

### Casos límite
- El dedo entra en el margen del sistema (16 dp) durante el drag: el auto-scroll sigue; el margen solo impide **empezar** un drag.
- Escena más estrecha que el viewport: no hay auto-scroll (la cámara está fija, HU-GAME-007).
- Tablet 4:3: la zona es del 12 % de su ancho; la velocidad máxima no cambia.
- Cambio de orientación entre los dos landscape durante el drag: se cancela el drag (`dragCancel`, propuesta).

### Dependencias
- HU-GAME-027: drag.
- HU-GAME-007: cámara y bounds.

### Consideraciones técnicas
- Documentos: [RENDERING §5](../../architecture/RENDERING.md), [INPUT_SYSTEM §3, §4](../../architecture/INPUT_SYSTEM.md), [PERFORMANCE §3](../../architecture/PERFORMANCE.md).
- [NEEDED NOW] auto-scroll en el UI thread.
- Restricción: la función de velocidad es pura y se prueba sin Reanimated.

### Assets necesarios
- Ninguno.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests unitarios de la función de velocidad y del cálculo del `worldPoint` final.
- [ ] Escenario de estrés medido en release en el Android de referencia y anotado.

---

## HU-GAME-030 — Los objetos apoyados se mueven con su mueble

> **Status:** Draft
> **Epic:** EPIC-007 · **Fase:** 1 · **Alcance:** MVP P2
> **Last Updated:** 2026-09-18

### Epic
EPIC-007 — Drag & Drop

### Prioridad
Could · P2

### Historia
Como **jugador**
quiero **que las cosas que hay sobre una mesa se muevan con ella cuando la cambio de sitio**
para **redecorar sin tener que volver a colocar cada objeto**.

### Contexto
[ENTITY_SCHEMA §5.1 y §5.5](../../data/ENTITY_SCHEMA.md) ya prevén `transform.parentId` y `surface.carriesItems` como [DESIGNED FOR LATER] para esta HU. Mover muebles es HU-GAME-048. Sin esta HU, al mover una mesa los objetos se quedan flotando en su sitio.

### Reglas de negocio
- **R1 — Activación por datos:** solo las superficies con `surface.carriesItems: true` arrastran lo que tienen encima.
- **R2 — Vínculo:** al aplicar `place` sobre una superficie con `carriesItems`, el objeto recibe `transform.parentId = id del mueble` y su `x`, `y` pasan a ser **relativas** al pivot del padre.
- **R2b — Fuente única** ([RENDERING §4](../../architecture/RENDERING.md)): para esas superficies, `transform.parentId` es la **única** fuente persistida de la relación de apoyo; `world.index.supportOf` se construye a partir de él y no se calcula por geometría. Para el resto de superficies sigue el índice geométrico de HU-GAME-028.
- **R3 — Posición absoluta** para render, hit testing y superficies: `transform del padre + relativa`.
- **R4 — Mover el padre:** al soltar el mueble (HU-GAME-048), los hijos conservan su posición relativa, es decir, se mueven con él. Durante el drag del mueble, los hijos se dibujan junto al DragProxy.
- **R5 — Separar:** al arrastrar un hijo, `parentId` se elimina y sus coordenadas vuelven a ser absolutas.
- **R6 — Profundidad 1 (propuesta):** un hijo no puede ser a su vez padre. No se permiten ciclos.
- **R7 — El padre deja la escena** (p. ej. se guarda o se elimina): los hijos se sueltan con `place` en su posición absoluta actual.
- **R8 — Límites:** si al mover el padre un hijo quedaría fuera de `[0, scene.width]`, el hijo se limita a ese rango y se desvincula (propuesta).
- **R9 — Persistencia:** `transform` se persiste completo ([SAVE_SCHEMA §2](../../data/SAVE_SCHEMA.md)), incluido `parentId`. Es un campo opcional nuevo con default, por lo que es un cambio compatible y **no** sube `saveVersion` ([ENTITY_SCHEMA §7](../../data/ENTITY_SCHEMA.md)).

### Criterios de aceptación
```gherkin
Scenario: el objeto apoyado queda vinculado
  Given una mesa en (2600, 960) con surface.carriesItems true y un segmento en y = -180
  When se suelta una manzana en (2650, 800)
  Then la manzana tiene transform { x: 50, y: -180, parentId: "<id de la mesa>" }

Scenario: al mover la mesa, la manzana la acompaña
  Given la manzana vinculada a la mesa
  When la mesa se suelta en (3000, 960)
  Then la posición absoluta de la manzana es (3050, 780)
  And world.index.supportOf(manzana) es la mesa

Scenario: sacar la manzana de la mesa la desvincula
  Given la manzana vinculada a la mesa
  When se arrastra la manzana y se suelta en el suelo en (1000, 960)
  Then la manzana no tiene parentId
  And su transform es (1000, 960)

Scenario: superficie sin carriesItems
  Given una mesa sin carriesItems con una manzana encima
  When la mesa se mueve
  Then la manzana conserva su posición absoluta y no tiene parentId

Scenario: no hay vínculos en cadena
  Given una bandeja con surface.carriesItems apoyada en una mesa con carriesItems
  When se suelta una galleta sobre la bandeja
  Then la galleta no se vincula a la bandeja
  # Supuesto de profundidad 1; ver R6.

@persistence
Scenario: el vínculo sobrevive a cerrar la app
  Incluye: AC-PERSIST-02
  Given la manzana vinculada a la mesa
  When se guarda, se cierra la app y se vuelve a abrir
  Then la manzana sigue vinculada y en la misma posición absoluta
```

### Casos límite
- Guardado antiguo sin `parentId`: carga igual (coordenadas absolutas).
- El padre se consume o se elimina: R7.
- Muchos hijos sobre un mueble (6 objetos): el drag del mueble mantiene los FPS del UI thread (AC-PERF-01).

### Dependencias
- HU-GAME-028: `place` y superficies.
- HU-GAME-048: mover muebles.

### Consideraciones técnicas
- Documentos: [ENTITY_SCHEMA §5.1, §5.5, §7](../../data/ENTITY_SCHEMA.md), [RENDERING §4](../../architecture/RENDERING.md), [SAVE_SCHEMA §2](../../data/SAVE_SCHEMA.md).
- Pasa de [DESIGNED FOR LATER] a [NEEDED NOW] al empezar esta HU; hay que actualizar ENTITY_SCHEMA.
- La relación no se guarda en dos sitios ([ECS §4 y §7](../../architecture/ECS.md)): con `carriesItems`, `supportOf` deriva de `parentId` (R2b).
- Restricción: sin `if` por mueble; todo sale de `carriesItems`.

### Assets necesarios
- Ninguno.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Tests en el harness de vínculo, movimiento, separación y persistencia.
- [ ] ENTITY_SCHEMA actualizado (`parentId` y `carriesItems` pasan a NEEDED NOW).
- [ ] Test de que `supportOf` deriva de `parentId` para las superficies con `carriesItems`.
