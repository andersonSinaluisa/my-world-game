# AI_CONTEXT: MyWorld (léelo primero)

> **Last Updated:** 2026-09-18 · Resumen compacto para agentes de IA. Es un **mapa**: el detalle está en los documentos enlazados. Si algo aquí contradice un documento detallado, **el detallado manda**. Avísalo.

## PROJECT
- **MyWorld** (codename): juego móvil 2D sandbox / casa de muñecas para niños de 4 a 10 años, en iOS y Android, landscape y offline.
- **Estado del repo:**
  - `MyWorld/` = app Expo (plantilla sin implementar);
  - `docs/` = fuente de verdad;
  - `assets/vendor/` = placeholders CC0 descargados (Kenney y Glitch), **no son arte final**.
- El repo **no es git todavía** (OQ-06).

## VISION
El niño crea personajes y juega libre: arrastra, come, duerme, viste, abre, guarda y compra. **Todo persiste.** No se puede perder, no hace falta leer, no hay anuncios ni datos personales.
`PLAY → EXPLORE → INTERACT → CREATE STORIES → CUSTOMIZE → DISCOVER`
→ [GAME_VISION](../product/GAME_VISION.md) · [GDD](../product/GAME_DESIGN_DOCUMENT.md) · [GAME_RULES](../product/GAME_RULES.md)

## STACK
- Expo SDK 57, RN 0.86, React 19.2 y TypeScript strict.
- `@shopify/react-native-skia` para el mundo.
- Reanimated 4.5 + react-native-worklets 0.10 + Gesture Handler 2.32.
- expo-sqlite, expo-audio, zod, Jest (jest-expo) y expo-router (solo la app shell).
- **Instalados:** Skia 2.6.2, expo-sqlite, zod 4, Jest 29 + jest-expo, @testing-library/react-native 14. **Pendiente de instalar:** expo-audio (HU-056), expo-localization (HU-075), tsx (HU-068).
→ [ADR-001](../decisions/ADR-001-TECH-STACK.md)

## ARCHITECTURE
- **Motor TS puro** (`src/engine/core|systems|actions|rules|content|scene|persistence`), **sin React, RN, Skia ni Expo**.
- **Adaptadores:** `engine/adapters/{render,input,audio,sqlite}`.
- **GameFacade** (`src/game/`): el único puente con la UI (`src/ui`, `src/app`).
- **Contenido:** `MyWorld/content/<pack>/`.
- **ECS-lite dirigido por eventos**, no un tick de 60 Hz.
- El drag, la cámara y los tweens van en SharedValues (UI thread). El World (JS thread) se modifica solo en eventos discretos.
→ [ARCHITECTURE](../architecture/ARCHITECTURE.md) (§2 capas, §3 carpetas, §6 invariantes) · [GAME_ENGINE](../architecture/GAME_ENGINE.md) · [ADR-003](../decisions/ADR-003-ECS.md) · [ADR-009](../decisions/ADR-009-STATE-AND-THREADING.md)

## GAMEPLAY
- **Tap** → reglas `tap`: abrir, encender, generar, reaccionar.
- **Drag & drop** → reglas `drop`: comer, beber, vestir, sostener, sentarse, dormir, guardar, viajar, comprar. Si no hay regla, `place` sobre la superficie o el suelo.
- **Long press** (≥ 450 ms) sobre la ropa puesta → `unwear` y la prenda se sigue arrastrando.
- **Rechazo** = shake + sonido suave y el objeto se apoya (o vuelve a su estante, si es un producto de la tienda).
- **Toque:** botones ≥ 64 dp; objetos del mundo ≥ 44 dp efectivos (el hit testing los amplía).
→ [INTERACTION_SYSTEM](../architecture/INTERACTION_SYSTEM.md) · [INPUT_SYSTEM](../architecture/INPUT_SYSTEM.md)

## MVP
- **Fases 0–2.** Escenas: `core:home` (salón, cocina, dormitorio y baño como **zonas**, 7680u), `core:street` (5760u) y `core:store` (3840u).
- Creador de personajes (2 cuerpos, 8 pieles, 6 ojos, 6 bocas, 8 peinados, 8 colores de pelo, ropa inicial). Máximo 12 personajes.
- 46 prefabs + 15 prendas, mochila de 12 slots, monedas y compra en la caja.
- Autosave SQLite, audio, puerta parental, ES/EN.
- **75 HU** (HU-GAME-001..075).
→ [MVP_SCOPE](../product/MVP_SCOPE.md) · [EPICS](../stories/EPICS.md) · [BACKLOG](../stories/BACKLOG.md)

## CORE ENTITIES
- **Entity** = `{ id, prefabId?, tags[], location, components }`.
- **`location`** (ÚNICA fuente de dónde está): `scene | container | inventory | held | worn | limbo`.
- **IDs:**
  - contenido `pack:id` (`core:apple_red`);
  - instancias de escena `core:home/fridge`;
  - runtime `rt_<ulid>`.
- **Componentes (v1):**
  - base: `transform`, `sprite`, `hitbox`(+zones), `draggable`, `surface`, `states`, `openable`, `switchable`, `container`;
  - consumibles y ropa: `edible`, `drinkable`, `wearable`;
  - dispensadores: `spawnedFrom` (la entidad generada guarda de qué dispensador salió);
  - muebles y mundo: `seat`, `bed`, `portal`, `spawner`;
  - economía: `purchasable`, `collectible`;
  - presentación: `sounds`, `animations`;
  - personaje: `character`, `appearance`, `outfit`*, `holder`, `pose`, `expression`.

  (*derivado, no se persiste)
→ [ECS](../architecture/ECS.md) · [ENTITY_SCHEMA](../data/ENTITY_SCHEMA.md) · [CHARACTER_SCHEMA](../data/CHARACTER_SCHEMA.md)

## CORE SYSTEMS
- **Systems:** Drag, Surface, Interaction(+InteractionResolver), State, Container, Inventory, Hold, Outfit, Consume, Seat, Spawn, Economy, Character.
- **Services:** ContentRegistry, SceneService, SaveService, AudioService, LocationService.
- **Acciones y condiciones: conjunto CERRADO** ([INTERACTION_SCHEMA §4-5](../data/INTERACTION_SCHEMA.md)).

## DATA MODEL
| Qué | Dónde | Doc |
|---|---|---|
| Prefabs | `content/<pack>/prefabs/<category>/<id>.json` | [OBJECT_SCHEMA](../data/OBJECT_SCHEMA.md) |
| Escenas | `content/<pack>/scenes/<id>.json` (altura 1080, suelo en y≈960) | [SCENE_SCHEMA](../data/SCENE_SCHEMA.md) |
| Reglas | `content/<pack>/interactions/*.rules.json` | [INTERACTION_SCHEMA](../data/INTERACTION_SCHEMA.md) |
| Packs | `manifest.json`, `assets.json`, `locales/` | [CONTENT_PACK_SCHEMA](../data/CONTENT_PACK_SCHEMA.md) |
| Guardado | SQLite: `save_slot`, `entity_state` (1 fila por entidad, diff), `entity_removed` · `saveVersion` + migraciones | [SAVE_SCHEMA](../data/SAVE_SCHEMA.md) |

## IMPORTANT DECISIONS
[ADR-001](../decisions/ADR-001-TECH-STACK.md) stack · [002](../decisions/ADR-002-RENDERING.md) Skia · [003](../decisions/ADR-003-ECS.md) ECS-lite · [004](../decisions/ADR-004-DATA-DRIVEN-CONTENT.md) datos + zod, sin scripting · [005](../decisions/ADR-005-OFFLINE-FIRST.md) offline, sin red · [006](../decisions/ADR-006-SQLITE.md) SQLite con diff · [007](../decisions/ADR-007-VIRTUAL-COORDINATES.md) altura 1080 + landscape · [008](../decisions/ADR-008-CONTENT-PACKS.md) packs con namespace · [009](../decisions/ADR-009-STATE-AND-THREADING.md) threads

## CONVENTIONS
- **World units:** altura 1080, origen arriba a la izquierda, pivot en el centro inferior. Texturas ≤ 2048.
- **Assets:** `{chr|obj|env|ui|fx|sfx|mus|amb}_{sub}_{name}[_var][_state]`, en WebP y m4a → [ASSET_GUIDELINES](../design/ASSET_GUIDELINES.md).
- **Código:** → [CODING_GUIDELINES](CODING_GUIDELINES.md) · **Reglas:** → [DEVELOPMENT_RULES](DEVELOPMENT_RULES.md).
- **Etiquetas de alcance:** `[NEEDED NOW]` / `[DESIGNED FOR LATER]` / `[NOT NEEDED YET]`.
- **Documentación:** en español. Código e identificadores: en inglés.

## CURRENT PHASE
**Fase 0: Technical Prototype.** EPIC-001 y EPIC-002 están implementados (rama `feature/EPIC-001-002-foundation-rendering`, en el repositorio git de `MyWorld/`). HU-002/003/004 están Done; 001 y 005–009 esperan la verificación manual en dispositivo (ver [BACKLOG](../stories/BACKLOG.md)).
→ [ROADMAP](../product/ROADMAP.md) · [DOCUMENTATION_STATUS](../DOCUMENTATION_STATUS.md)

## DO NOT
- ❌ Lógica por objeto o por escena (`if prefabId === …`, `if sceneId === …`).
- ❌ Importar React, RN, Skia o Expo en el motor core. La UI no llama al motor fuera del GameFacade.
- ❌ Coordenadas, textos o rutas de assets en el código. Todo va en `content/`.
- ❌ Guardar la misma relación en dos sitios (usar `location` + índices derivados).
- ❌ `setState` o escrituras en el World por frame.
- ❌ Dependencias nuevas, cambios de schema sin migración, o arquitectura nueva sin ADR.
- ❌ Scripting en las reglas; acciones o condiciones nuevas sin documentarlas.
- ❌ Red, anuncios, analytics o datos personales (MVP).
- ❌ Implementar fuera del alcance de la HU pedida.

## NEXT STEPS
1. Verificar EPIC-001/002 en dispositivo con el sandbox de render (`/dev-render`).
2. HU-GAME-068 (pack core + mapa de assets generado) → 024 (prefabs) → 010/011 (escenas desde JSON; sustituye `activateScene` provisional).
3. HU-GAME-026 → 027 → 028 → 031 → 032 (hit test, drag, superficies, reglas) y HU-GAME-052..054 (guardado).

→ Instrucciones de trabajo: [AGENT_INSTRUCTIONS](AGENT_INSTRUCTIONS.md) · Términos: [GLOSSARY](GLOSSARY.md)
