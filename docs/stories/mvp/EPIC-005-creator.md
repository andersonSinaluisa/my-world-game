# EPIC-005 — Character Creator

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [CHARACTER_SCHEMA](../../data/CHARACTER_SCHEMA.md) · [CHARACTER_SYSTEM](../../architecture/CHARACTER_SYSTEM.md) · [GAME_ENGINE](../../architecture/GAME_ENGINE.md) · [ARCHITECTURE](../../architecture/ARCHITECTURE.md) · [SCENE_SYSTEM](../../architecture/SCENE_SYSTEM.md) · [SAVE_SCHEMA](../../data/SAVE_SCHEMA.md) · [MVP_SCOPE](../../product/MVP_SCOPE.md)

## Objetivo del epic
Permitir que un niño cree y edite hasta 12 personajes eligiendo cuerpo, piel, ojos, boca, peinado, color de pelo y ropa inicial, sin leer, con una vista previa en vivo que usa el mismo renderer de personajes del juego. El creador es una pantalla RN (`expo-router`, ruta `creator`) que solo habla con el motor mediante los comandos `createCharacter` y `updateAppearance` del GameFacade; las opciones salen de `content/core/characters/parts.json`.

## Historias
- [HU-GAME-018 — Abrir el creador y elegir cuerpo y tono de piel](#hu-game-018--abrir-el-creador-y-elegir-cuerpo-y-tono-de-piel)
- [HU-GAME-019 — Elegir ojos y boca](#hu-game-019--elegir-ojos-y-boca)
- [HU-GAME-020 — Elegir peinado y color de pelo](#hu-game-020--elegir-peinado-y-color-de-pelo)
- [HU-GAME-021 — Elegir ropa inicial](#hu-game-021--elegir-ropa-inicial)
- [HU-GAME-022 — Guardar, listar y editar personajes](#hu-game-022--guardar-listar-y-editar-personajes)
- [HU-GAME-023 — Colocar personajes creados en el mundo](#hu-game-023--colocar-personajes-creados-en-el-mundo)

---

## HU-GAME-018 — Abrir el creador y elegir cuerpo y tono de piel

> **Status:** Draft
> **Epic:** EPIC-005 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-005 — Character Creator

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **abrir el creador y elegir si mi personaje es niño o adulto y su color de piel**
para **empezar a crear a alguien que se parezca a mí o a mi familia**.

### Contexto
Esta HU crea el esqueleto del creador: la pantalla, la vista previa en vivo, el borrador de apariencia y los dos primeros selectores. Las siguientes HU (019-021) añaden pestañas sobre esta base. Las opciones se leen del catálogo de partes ([CHARACTER_SCHEMA §1](../../data/CHARACTER_SCHEMA.md)) y el tinte de piel sigue [CHARACTER_SYSTEM §4](../../architecture/CHARACTER_SYSTEM.md).

### Reglas de negocio
- R1: El creador es la pantalla `app/creator` de expo-router ([ARCHITECTURE §3](../../architecture/ARCHITECTURE.md)). La UI solo accede al motor por el GameFacade ([ARCHITECTURE §6, invariante 7](../../architecture/ARCHITECTURE.md)); no importa `engine/core`.
- R2: Las opciones salen **solo** de `content/core/characters/parts.json` leído con el selector `characterCatalog()` del GameFacade. Nada hardcodeado: `bodyTypes` (2: `child`, `adult`) y `skinTones` (8).
- R3: Al abrir en modo "nuevo", el borrador arranca con `parts.defaults` (bodyType, skinTone, eyes, mouth, hairStyle, hairColor, outfit).
- R4: El borrador es **estado de UI** de la pantalla hasta que se confirma (HU-GAME-022); no toca el World ni el guardado.
- R5: La vista previa usa **el mismo renderer y la misma resolución de capas** que el juego (HU-GAME-013) mediante `previewCharacterLayers(draft)`, en pose `idle` y expresión `neutral`.
- R6: Cada cambio de opción actualiza la vista previa en ≤ 100 ms en el dispositivo de referencia (**propuesta** de umbral) y dispara `happy` 1 s en la vista previa como refuerzo (**propuesta**).
- R7: Selector de cuerpo: 2 botones con `bodyTypes[].icon`. Selector de piel: 8 muestras de color con `skinTones[].color`. La opción elegida se marca visualmente (borde + escala), sin texto.
- R8: Objetivos táctiles ≥ 64 dp; cada botón tiene `accessibilityLabel` i18n (`bodyTypes[].name` o clave de color).
- R9: El tinte de piel en la vista previa usa la técnica que decida el spike de HU-GAME-013 (`ColorMatrix` o `BlendMode.Multiply`).
- R10: Botón "volver" (icono) sale sin crear nada; si el borrador cambió, **propuesta**: no pide confirmación en el MVP (se pierde el borrador).

### Criterios de aceptación
```gherkin
Scenario: abrir el creador con valores por defecto
  Given el catálogo core con defaults { bodyType: "child", skinTone: "skin_01" }
  When el jugador abre la pantalla del creador en modo nuevo
  Then la vista previa muestra un personaje con bodyType "child" y tono "skin_01"
  And hay 2 botones de cuerpo y 8 muestras de piel

Scenario: cambiar el tipo de cuerpo
  Given el creador abierto con bodyType "child"
  When el jugador toca el botón del cuerpo "adult"
  Then la vista previa usa los sprites de bodyTypes.adult
  And el resto de elecciones del borrador se conserva

Scenario: cambiar el tono de piel
  Given el creador abierto
  When el jugador toca la muestra del tono "skin_06"
  Then las capas legs, torso, armL, armR y head de la vista previa llevan el tinte de "skin_06"
  And la ropa no cambia de color

Scenario: salir sin confirmar no crea nada
  Given el creador abierto con el borrador modificado
  When el jugador toca el botón de volver
  Then el número de personajes del World no cambia
  And no se escribe nada en el guardado

Scenario: las opciones vienen del contenido
  Given un pack de test con 3 bodyTypes y 4 skinTones
  When se abre el creador
  Then se muestran 3 botones de cuerpo y 4 muestras de piel
```
Incluye: AC-A11Y-01, AC-PERF-01 (cambio de opción repetido 10 veces) (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Catálogo con un `defaults` que referencia un id inexistente: el validador de contenido (HU-GAME-069) lo rechaza; en runtime se usa la primera opción de cada lista.
- Pantalla en tablet 4:3: la vista previa y las rejillas caben sin scroll horizontal.
- Toques muy rápidos entre opciones: solo cuenta la última; no hay parpadeo de capas.

### Dependencias
- HU-GAME-013: renderer de capas reutilizado en la vista previa.
- HU-GAME-004: GameFacade (comandos y selectores).

### Consideraciones técnicas
- Selectores del GameFacade ([GAME_ENGINE §6](../../architecture/GAME_ENGINE.md)): `characterCatalog()` para las opciones y `previewCharacterLayers(draft)` para la vista previa sin crear entidad (reutiliza `selectCharacterLayers`).
- La vista previa es un `<Canvas>` de Skia dentro de la pantalla RN; los selectores de opción son Views RN.
- Estado: [NEEDED NOW].

### Assets necesarios
- `ui_creator_body_child` y `ui_creator_body_adult`: iconos de tipo de cuerpo (placeholder aceptable: sí).
- `ui_creator_tab_body`: icono de la pestaña de cuerpo (placeholder: sí).
- `ui_creator_bg`: fondo de la pantalla del creador (placeholder: sí).
- `ui_button_back`: icono de volver (placeholder: sí).
- `sfx_ui_tap`: sonido global de botón (existente en [AUDIO_SYSTEM §2](../../architecture/AUDIO_SYSTEM.md)).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Ruta `creator` con vista previa y selectores de cuerpo y piel.
- [ ] Selectores `characterCatalog()` y `previewCharacterLayers(draft)` implementados según GAME_ENGINE §6.
- [ ] Tests unitarios del selector de borrador; test de UI (render) de la pantalla con un catálogo fixture.
- [ ] Verificación manual en Android e iOS (landscape, tablet 4:3) y sin lectura.

---

## HU-GAME-019 — Elegir ojos y boca

> **Status:** Draft
> **Epic:** EPIC-005 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-005 — Character Creator

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **elegir los ojos y la boca de mi personaje**
para **darle una cara con personalidad**.

### Contexto
Añade la pestaña de cara al creador de HU-GAME-018. Ojos y bocas se definen en el catálogo (`eyes[]`, `mouths[]`), con icono para el selector y asset para el render ([CHARACTER_SCHEMA §1](../../data/CHARACTER_SCHEMA.md)).

### Reglas de negocio
- R1: 6 ojos y 6 bocas en el MVP ([MVP_SCOPE §2](../../product/MVP_SCOPE.md)); la cantidad real la da el catálogo.
- R2: Cada opción se muestra con su `icon`; la elegida queda marcada. Sin texto.
- R3: Elegir una opción actualiza `draft.eyes` o `draft.mouth` y la vista previa (capas `eyes` y `mouth`).
- R4: Ojos y boca **no** se tiñen y son iguales para ambos tipos de cuerpo (no hay `byBodyType` en ojos ni boca).
- R5: **Propuesta:** al tocar una opción de ojos la vista previa parpadea (muestra `closedAsset` 150 ms) y al tocar una boca muestra `byExpression.happy` 1 s, para enseñar que la cara está viva.
- R6: Objetivos táctiles ≥ 64 dp y `accessibilityLabel` i18n por opción.

### Criterios de aceptación
```gherkin
Scenario: elegir unos ojos
  Given el creador abierto en la pestaña de cara
  When el jugador toca el icono de los ojos "eyes_round"
  Then draft.eyes es "eyes_round"
  And la capa "eyes" de la vista previa usa eyes[eyes_round].asset

Scenario: elegir una boca
  Given el creador abierto en la pestaña de cara
  When el jugador toca el icono de la boca "mouth_smile"
  Then draft.mouth es "mouth_smile"
  And la capa "mouth" de la vista previa usa mouths[mouth_smile].asset

Scenario: cambiar de cuerpo conserva la cara
  Given un borrador con eyes "eyes_round" y mouth "mouth_smile"
  When el jugador cambia el bodyType a "adult"
  Then draft.eyes y draft.mouth no cambian

Scenario: ojos sin variante cerrada
  Given unos ojos del catálogo sin closedAsset
  When la vista previa necesita ojos cerrados
  Then se usa el asset normal y no se produce ningún error
```
Incluye: AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Catálogo con más de 6 opciones (packs futuros): la rejilla se desplaza en vertical, nunca en horizontal.
- Ojos sin `closedAsset`: el personaje dormido en el mundo muestra los ojos normales (se registra advertencia del validador; **propuesta** hacerlo obligatorio en el pack core).

### Dependencias
- HU-GAME-018: pantalla, borrador y vista previa.

### Consideraciones técnicas
- Solo UI + selector de borrador de HU-GAME-018. No hay comando nuevo.
- Estado: [NEEDED NOW]; cejas, nariz, color de ojos [DESIGNED FOR LATER] ([CHARACTER_SCHEMA §2](../../data/CHARACTER_SCHEMA.md)).

### Assets necesarios
- `chr_eyes_{id}`, `chr_eyes_{id}_closed`, `ui_creator_eyes_{id}`: 6 ojos (placeholder aceptable: sí).
- `chr_mouth_{id}`, `chr_mouth_{id}_{expresion}`, `ui_creator_mouth_{id}`: 6 bocas (placeholder: sí).
- `ui_creator_tab_face`: icono de pestaña (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Pestaña de cara con 6 + 6 opciones desde el catálogo.
- [ ] Tests del borrador (cambios de ojos/boca y conservación al cambiar de cuerpo).
- [ ] Verificación manual sin lectura.

---

## HU-GAME-020 — Elegir peinado y color de pelo

> **Status:** Draft
> **Epic:** EPIC-005 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-005 — Character Creator

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **elegir el peinado y el color de pelo de mi personaje**
para **que se parezca a quien yo quiera**.

### Contexto
Pestaña de pelo del creador. Los peinados tienen capa trasera opcional y delantera, con variantes por tipo de cuerpo; el color se aplica como tinte en runtime ([CHARACTER_SCHEMA §1, §3](../../data/CHARACTER_SCHEMA.md), [CHARACTER_SYSTEM §4](../../architecture/CHARACTER_SYSTEM.md)).

### Reglas de negocio
- R1: 8 peinados y 8 colores de pelo en el MVP ([MVP_SCOPE §2](../../product/MVP_SCOPE.md)).
- R2: El peinado se dibuja en `hairBack` (opcional) y `hairFront`; si existe `byBodyType[bodyType]`, se usa esa variante.
- R3: El color se aplica como tinte a `hairBack` y `hairFront` con `hairColors[].color`. Los sprites de pelo están en escala de grises. Técnica según el spike de HU-GAME-013 (**pregunta abierta** de [CHARACTER_SYSTEM §4](../../architecture/CHARACTER_SYSTEM.md); plan B: sprites pre-coloreados, 8 × 8 = 64 sprites de pelo por cuerpo).
- R4: Los iconos de peinado se muestran **teñidos con el color elegido** para que el niño vea el resultado (**propuesta**).
- R5: Cambiar el cuerpo re-resuelve la variante `byBodyType` sin cambiar `draft.hairStyle`.
- R6: Objetivos táctiles ≥ 64 dp; `accessibilityLabel` i18n.

### Criterios de aceptación
```gherkin
Scenario: elegir un peinado
  Given el creador abierto en la pestaña de pelo
  When el jugador toca el peinado "hair_buns"
  Then draft.hairStyle es "hair_buns"
  And la vista previa usa hairStyles[hair_buns].front en "hairFront" y .back en "hairBack"

Scenario: elegir color de pelo
  Given el borrador con hairStyle "hair_buns"
  When el jugador toca la muestra "hair_berry"
  Then las capas hairBack y hairFront llevan el tinte de hairColors[hair_berry].color
  And la piel no cambia de tinte

Scenario: peinado sin capa trasera
  Given un peinado del catálogo sin "back"
  When el jugador lo elige
  Then la capa "hairBack" queda vacía y no hay error

Scenario: variante por tipo de cuerpo
  Given un peinado con byBodyType.adult definido
  When el borrador tiene bodyType "adult" y ese peinado
  Then la vista previa usa los assets de byBodyType.adult
```
Incluye: AC-A11Y-01, AC-PERF-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Tintes muy claros sobre gris (rubio, blanco): calidad a validar en el spike; si no es aceptable se aplica el plan B.
- Pelo largo que tapa los ojos o las manos sostenidas: orden fijo de capas; `hairFront` va sobre `mouth` y `eyes`, pero `heldL/heldR` quedan debajo de `head` (limitación aceptada del orden de CHARACTER_SCHEMA §3).

### Dependencias
- HU-GAME-018: pantalla, borrador y vista previa.

### Consideraciones técnicas
- Reutiliza el tinte de HU-GAME-013; sin shaders nuevos ([RENDERING §8](../../architecture/RENDERING.md)).
- Estado: [NEEDED NOW].

### Assets necesarios
- `chr_hair_{id}_front`, `chr_hair_{id}_back` (+ `_adult` si aplica), `ui_creator_hair_{id}`: 8 peinados en escala de grises (placeholder aceptable: sí).
- `ui_creator_tab_hair`: icono de pestaña (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Pestaña de pelo con 8 + 8 opciones desde el catálogo.
- [ ] Tests de resolución `byBodyType` y `back` opcional.
- [ ] Captura de los 8 colores sobre los 8 peinados revisada por arte (resultado del spike anotado).

---

## HU-GAME-021 — Elegir ropa inicial

> **Status:** Draft
> **Epic:** EPIC-005 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-005 — Character Creator

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **elegir la camiseta, el pantalón y los zapatos con los que empieza mi personaje**
para **vestirlo a mi gusto desde el primer momento**.

### Contexto
No existe una "ropa del creador": el creador elige entre los prefabs `wearable` de `parts.starterClothes` y, al confirmar, crea **instancias reales** de esos prefabs vestidas por el personaje ([CHARACTER_SYSTEM §7](../../architecture/CHARACTER_SYSTEM.md)). Así, la ropa elegida es la misma que luego se puede quitar y guardar en el armario (EPIC-011).

### Reglas de negocio
- R1: Opciones: prefabs de `starterClothes` agrupados por `wearable.slot`: `top` (6), `bottom` (5), `shoes` (4). **Las 15 prendas del MVP** están disponibles en el creador ([MVP_SCOPE §2](../../product/MVP_SCOPE.md), [CHARACTER_SCHEMA §1](../../data/CHARACTER_SCHEMA.md)).
- R2: Una prenda por slot. El borrador arranca con `defaults.outfit`.
- R3: **Propuesta:** los tres slots son obligatorios en el creador (no se puede dejar un slot vacío), porque [MVP_SCOPE §2](../../product/MVP_SCOPE.md) define la ropa inicial como camiseta, pantalón y zapatos.
- R4: Toda prenda tiene sprites para los dos tipos de cuerpo (`bodyVariants` o sprites neutros); si falta alguno en una prenda de `starterClothes`, el validador de contenido da **error** ([CHARACTER_SYSTEM §7](../../architecture/CHARACTER_SYSTEM.md)). Por eso siempre se ofrecen las 15.
- R5: Cambiar el `bodyType` **conserva** la ropa elegida; solo se re-resuelven sus sprites para el nuevo cuerpo.
- R6: La vista previa dibuja la prenda en sus capas de personaje (`torsoClothes`, `armClothesL/R`, `bottomClothes`, `shoes`) con la misma resolución que el juego.
- R7: Cada opción se muestra con el `sprite` "suelto" del prefab como icono; sin texto.
- R8: Al confirmar (HU-GAME-022), `createCharacter { appearance, outfit }` crea una entidad por prenda con `location { kind: "worn", characterId, slot }`; el creador no crea entidades antes de confirmar.
- R9: En modo **edición**, al confirmar, cada slot cambiado envía `setOutfitSlot { characterId, slot, prefabId }`: se viste una instancia nueva del prefab y la prenda anterior va al **armario** si tiene espacio o, si no, a los pies del personaje ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).

### Criterios de aceptación
```gherkin
Scenario: elegir una camiseta
  Given el creador abierto en la pestaña de ropa
  When el jugador toca la prenda superior "core:shirt_star_yellow"
  Then draft.outfit.top es "core:shirt_star_yellow"
  And la vista previa dibuja chr_top_star_yellow en "torsoClothes"

Scenario: una prenda por slot
  Given el borrador con una camiseta en el slot "top"
  When el jugador toca otra prenda superior
  Then draft.outfit.top es la nueva prenda y solo hay una prenda en "top"

Scenario: cambiar de cuerpo conserva la ropa
  Given un borrador bodyType "child" con outfit { top, bottom, shoes }
  When el jugador cambia el cuerpo a "adult"
  Then draft.outfit no cambia
  And la vista previa dibuja cada prenda con su sprite para "adult"

Scenario: cambiar una prenda en modo edición
  Given un personaje existente que viste la camiseta A y un armario con espacio
  When el jugador elige la camiseta B en el creador y confirma
  Then se despacha setOutfitSlot { slot: "top", prefabId: B }
  And el personaje viste una instancia nueva de B
  And la camiseta A está en el armario

Scenario: cambiar una prenda con el armario lleno
  Given un personaje existente que viste la camiseta A y el armario lleno
  When se despacha setOutfitSlot { slot: "top", prefabId: B }
  Then la camiseta A queda en la escena a los pies del personaje

Scenario: la ropa elegida se convierte en entidades reales al crear
  Given un borrador con outfit { top, bottom, shoes }
  When se ejecuta createCharacter
  Then existen 3 entidades nuevas con prefabId de las prendas elegidas
  And cada una tiene location { kind: "worn", characterId: nuevo personaje, slot }

@persistence
Scenario: la ropa inicial se conserva
  Given un personaje recién creado con su ropa inicial
  When la app se cierra por completo y se vuelve a abrir
  Then el personaje sigue vistiendo las 3 prendas
```
Incluye: AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- `starterClothes` contiene un prefab sin `wearable`: error del validador de contenido.
- Prenda de `starterClothes` sin sprite para uno de los cuerpos: error del validador; no llega a runtime.
- Varias creaciones seguidas con la misma camiseta: cada personaje recibe su propia instancia (`rt_{ulid}`), no se comparten.

### Dependencias
- HU-GAME-018: pantalla y vista previa.
- HU-GAME-039 (coordinación): resolución de capas de ropa y acción `wear`, reutilizadas por `createCharacter` y `setOutfitSlot`.
- HU-GAME-041 (coordinación): el armario recibe la prenda reemplazada por `setOutfitSlot`.

### Consideraciones técnicas
- Validación de sprites por cuerpo en el validador de contenido (HU-GAME-069): error en `starterClothes`, advertencia en el resto.
- Comando `setOutfitSlot` del GameFacade para el modo edición.
- `createCharacter` crea las prendas en la misma transacción que el personaje ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).
- Estado: [NEEDED NOW]; tintes de ropa [DESIGNED FOR LATER].

### Assets necesarios
- Sprites de las 15 prendas: suelta `obj_clothing_{name}` y puestas `chr_{slot}_{name}` (+ `_arm_l`/`_arm_r` en superiores) (placeholder aceptable: sí).
- `ui_creator_tab_clothes`: icono de pestaña (placeholder: sí).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Pestaña de ropa con 6/5/4 opciones; el cambio de cuerpo conserva la ropa.
- [ ] Comando `setOutfitSlot` con tests (armario con espacio, armario lleno, `prefabId: null`).
- [ ] Test de integración: `createCharacter` crea las 3 prendas `worn`.
- [ ] Persistencia de la ropa inicial probada (AC-PERSIST-02).

---

## HU-GAME-022 — Guardar, listar y editar personajes

> **Status:** Draft
> **Epic:** EPIC-005 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-005 — Character Creator

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **confirmar mi personaje, ver a todos los que he creado y cambiarle la cara o el pelo después**
para **tener mi propia familia de personajes y cambiarla cuando quiera**.

### Contexto
Conecta el creador con el motor: el botón de confirmar envía `createCharacter { appearance, outfit }` y el modo edición envía `updateAppearance { characterId, patch }` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)). La lista se lee con `selectors.characters()`. El guardado es automático por el DirtyTracker ([SAVE_SYSTEM §3](../../architecture/SAVE_SYSTEM.md)).

### Reglas de negocio
- R1: Confirmar (icono ✓ grande) en modo nuevo → `createCharacter`. Crea una entidad `rt_{ulid}` con tags `["character"]`, `character { isNpc: false, createdAt, colorTag }`, `appearance`, `holder { hands: ["left","right"] }`, `pose { current: "idle" }`, `draggable`, y las prendas `worn` (HU-GAME-021 R8), todo en una transacción.
- R2: Máximo **12** personajes creados por el jugador ([CHARACTER_SCHEMA §6](../../data/CHARACTER_SCHEMA.md)). Con 12, `createCharacter` devuelve `CommandResult { ok: false, reason: "maxCharacters" }` y la UI muestra el botón "nuevo" apagado con un candado; al tocarlo hace "shake" y suena el rechazo suave. Sin texto.
- R3: `colorTag`: **propuesta** — se asigna el primer color de una paleta de 12 no usado por otro personaje (paleta en contenido del pack).
- R4: Lista de personajes: rejilla con un retrato por personaje (vista previa del mismo renderer, recortada a la cabeza — **propuesta**), con marco de `colorTag` y botón "nuevo". Se lee de `selectors.characters()`.
- R5: Tocar un retrato abre el creador en **modo edición** con el borrador inicializado desde su `appearance` actual. Pestañas disponibles: cuerpo, piel, cara, pelo y ropa (la ropa se aplica con `setOutfitSlot`, HU-GAME-021 R9).
- R6: Confirmar en modo edición → `updateAppearance { characterId, patch }` con **solo** los campos cambiados, más un `setOutfitSlot` por cada slot de ropa cambiado. No cambia location, pose ni lo sostenido.
- R7: Si cambia `bodyType`, la ropa vestida **se conserva** (todas las prendas tienen sprites para ambos cuerpos; [CHARACTER_SYSTEM §7](../../architecture/CHARACTER_SYSTEM.md)).
- R8: Tras confirmar, el `entityCreated`/`entityChanged` marca sucias las entidades y el autosave hace flush (debounce 1000 ms, máx. 5 s). **Propuesta:** flush inmediato al salir del creador, como en el cambio de escena.
- R9: `nickname` no se pide en el MVP (requeriría escribir; **propuesta**, ver [CHARACTER_SCHEMA §2](../../data/CHARACTER_SCHEMA.md)).
- R10: Borrar personajes queda **fuera del MVP**: es la HU POST-MVP HU-GAME-122 (pregunta abierta OQ-09).

### Criterios de aceptación
```gherkin
Scenario: crear un personaje
  Given 0 personajes creados y el creador abierto con un borrador completo
  When el jugador toca confirmar
  Then GameFacade.dispatch(createCharacter) devuelve ok
  And existe 1 entidad con character.isNpc false y el appearance del borrador
  And la lista de personajes muestra 1 retrato

Scenario: límite de 12 personajes
  Given 12 personajes creados
  When el jugador toca el botón "nuevo" de la lista
  Then el botón hace "shake" y suena el rechazo suave
  And no se abre el creador y no aparece texto

Scenario: el comando respeta el límite aunque la UI falle
  Given 12 personajes creados
  When se despacha createCharacter
  Then el resultado es { ok: false, reason: "maxCharacters" } y no se crea ninguna entidad

Scenario: editar el pelo de un personaje existente
  Given un personaje sentado en el sofá con hairColor "hair_black"
  When el jugador lo edita, elige "hair_berry" y confirma
  Then se despacha updateAppearance con patch { hairColor: "hair_berry" }
  And el personaje sigue sentado en el sofá con la misma ropa

Scenario: cancelar la edición
  Given el creador en modo edición con cambios sin confirmar
  When el jugador toca volver
  Then el appearance del personaje no cambia

@persistence
Scenario: los personajes creados y editados sobreviven a cerrar la app
  Given un personaje creado y luego editado
  And pasó al menos 1 segundo
  When la app se cierra por completo y se vuelve a abrir
  Then la lista muestra el personaje con la apariencia editada
```
Incluye: AC-PERSIST-02, AC-REJECT-01 (adaptado a botón de UI), AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Se cierra la app justo tras confirmar: el flush por `AppState background` guarda al personaje.
- Editar un personaje que está en otra escena: todos los personajes (≤ 12) están siempre cargados como entidades globales ([GAME_ENGINE §3](../../architecture/GAME_ENGINE.md)), así que `updateAppearance` y `setOutfitSlot` funcionan igual; el cambio se ve al volver a su escena.
- `updateAppearance` con un id que no es personaje: `ok: false`, sin excepción.
- `patch` con un valor que no existe en el catálogo: `ok: false, reason: "invalidPart"` (**propuesta**).

### Dependencias
- HU-GAME-018 (y 019-021 para las pestañas completas).
- HU-GAME-052: autoguardado en SQLite.

### Consideraciones técnicas
- Comandos `createCharacter`/`updateAppearance`/`setOutfitSlot` en el GameFacade; validación zod del `appearance` contra el catálogo.
- `selectors.characters()` devuelve `CharacterSummary[]` (id, appearance, colorTag, sceneId) — **propuesta** de forma.
- Estado: [NEEDED NOW]; perfiles/varios slots [DESIGNED FOR LATER].

### Assets necesarios
- `ui_button_confirm`: icono ✓ grande (placeholder aceptable: sí).
- `ui_button_new_character` y `ui_icon_lock`: botón "nuevo" y candado (placeholder: sí).
- `ui_creator_portrait_frame`: marco de retrato teñible con `colorTag` (placeholder: sí).
- `sfx_reject_soft`, `sfx_ui_tap` (globales existentes); `sfx_character_created`: celebración al crear (placeholder: sí) — propuesta.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Comandos implementados con tests unitarios (límite 12, patch parcial, ids inválidos).
- [ ] Test de integración: crear → editar → recargar desde `InMemorySaveStore`.
- [ ] Lista de personajes con retratos verificada en dispositivo.
- [ ] Persistencia probada (AC-PERSIST-02).
- [ ] Test de edición con cambio de `bodyType` que conserva la ropa vestida.

---

## HU-GAME-023 — Colocar personajes creados en el mundo

> **Status:** Draft
> **Epic:** EPIC-005 · **Fase:** 1 · **Alcance:** MVP P0
> **Last Updated:** 2026-09-18

### Epic
EPIC-005 — Character Creator

### Prioridad
Must · P0

### Historia
Como **jugador**
quiero **que mi personaje nuevo aparezca en la casa en cuanto lo termino**
para **empezar a jugar con él enseguida**.

### Contexto
Un personaje vive en una escena (location `scene`, [SCENE_SYSTEM §2](../../architecture/SCENE_SYSTEM.md)). Esta HU define dónde aparece al crearlo y cómo vuelve el jugador del creador al juego. Usa los spawn points de la escena (`default` obligatorio, [SCENE_SCHEMA §3](../../data/SCENE_SCHEMA.md)).

### Reglas de negocio
- R1: El personaje nuevo se crea con `location { kind: "scene", sceneId: player.currentSceneId }`. En la primera partida es la escena inicial de la casa (`core:home`).
- R2: Posición: spawn point `default` de esa escena. **Propuesta:** si ya hay un personaje a menos de 120 unidades en x del spawn, se desplaza 120 unidades a la derecha hasta encontrar hueco (misma separación que los viajeros de [SCENE_SYSTEM §2](../../architecture/SCENE_SYSTEM.md)), limitado a `[0, scene.width]`.
- R3: Aparece en pose `idle`, apoyado en el suelo (`place`) y con expresión `happy` 1,5 s y un efecto de aparición (**propuesta**).
- R4: Al confirmar en el creador, la app vuelve a la pantalla de juego y despacha `focusEntity { entityId }`: la cámara se centra en el personaje nuevo con `withTiming` de 450 ms (mismo movimiento que "saltar a zona", [RENDERING §5](../../architecture/RENDERING.md)).
- R5: Editar un personaje (HU-GAME-022) **no** lo mueve.
- R6: Partida nueva: la pantalla de inicio ofrece crear un personaje ([SAVE_SYSTEM §4](../../architecture/SAVE_SYSTEM.md)); tras confirmar se entra en la escena con el personaje colocado (flujo de pantallas en HU-GAME-073).

### Criterios de aceptación
```gherkin
Scenario: el personaje nuevo aparece en el spawn default
  Given la escena activa "core:home" con spawn "default" en (1200, 960) y sin personajes cerca
  When se despacha createCharacter
  Then el personaje tiene location { kind: "scene", sceneId: "core:home" }
  And su transform es (1200, 960) y su pose "idle"

Scenario: el spawn está ocupado
  Given un personaje en (1200, 960)
  When se crea otro personaje
  Then el nuevo aparece en x = 1320

Scenario: la cámara muestra al personaje nuevo
  Given la cámara en otra zona de la casa
  When el jugador confirma el creador y vuelve al juego
  Then la cámara termina centrada en el personaje nuevo en 450 ms

Scenario: persistencia de la posición inicial
  Given un personaje recién creado en la escena activa
  When viaja a otra escena y regresa
  Then el personaje sigue en su posición
```
Incluye: AC-PERSIST-01, AC-PERSIST-02, AC-A11Y-01 (ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md)).

### Casos límite
- Spawn `default` fuera del suelo: el personaje se ajusta con `place` al segmento de suelo bajo `x`.
- La fila de desplazamiento llega al borde de la escena: **propuesta** — se prueba hacia la izquierda; si no hay hueco, se superpone en el spawn.
- Crear un personaje estando en la calle o la tienda (Fase 2): aparece en el spawn `default` de esa escena.

### Dependencias
- HU-GAME-022: comando `createCharacter`.
- HU-GAME-010: escena cargada con spawn points.

### Consideraciones técnicas
- `createCharacter` resuelve la posición en el motor (no en la UI) a partir de la escena activa; la UI solo navega de vuelta (`expo-router`) y pide el foco de cámara.
- Al volver al juego, la UI despacha `focusEntity { entityId }` con el id devuelto por `createCharacter` ([GAME_ENGINE §4](../../architecture/GAME_ENGINE.md)).
- Estado: [NEEDED NOW].

### Assets necesarios
- `sfx_character_appear`: sonido de aparición (placeholder aceptable: sí) — propuesta.
- Preset de animación `bounce` existente ([ENTITY_SCHEMA §5.7c](../../data/ENTITY_SCHEMA.md)); no requiere asset.

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] Colocación en spawn con desplazamiento de 120 u probada en el harness.
- [ ] Foco de cámara verificado a mano en dispositivo.
- [ ] Persistencia probada (AC-PERSIST-01/02).
