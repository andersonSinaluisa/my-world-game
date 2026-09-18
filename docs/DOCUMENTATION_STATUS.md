# Documentation Status

> **Last Updated:** 2026-09-18 · **Fase actual:** 0 (Technical Prototype), sin código implementado
> **Índice:** [README.md](README.md) · **Contexto IA:** [ai/AI_CONTEXT.md](ai/AI_CONTEXT.md)

## 1. Documents created (89)

| Carpeta | Documentos |
|---|---|
| raíz `docs/` | README, TRACEABILITY, DOCUMENTATION_STATUS |
| `product/` (8) | GAME_VISION, GAME_DESIGN_DOCUMENT, TARGET_AUDIENCE, CORE_GAME_LOOP, GAME_RULES, MVP_SCOPE, ROADMAP, MONETIZATION |
| `architecture/` (15) | ARCHITECTURE, GAME_ENGINE, ECS, RENDERING, INPUT_SYSTEM, INTERACTION_SYSTEM, SCENE_SYSTEM, CHARACTER_SYSTEM, INVENTORY_SYSTEM, SAVE_SYSTEM, AUDIO_SYSTEM, CONTENT_SYSTEM, PERFORMANCE, OFFLINE_FIRST, BACKEND_FUTURE |
| `data/` (7) | ENTITY_SCHEMA, OBJECT_SCHEMA, CHARACTER_SCHEMA, SCENE_SCHEMA, INTERACTION_SCHEMA, SAVE_SCHEMA, CONTENT_PACK_SCHEMA |
| `design/` (6 + 2 de investigación) | ART_DIRECTION, CHARACTER_GUIDELINES, ENVIRONMENT_GUIDELINES, ANIMATION_GUIDELINES, UI_UX_GUIDELINES, ASSET_GUIDELINES · `research/`: ASSET_MARKET_RESEARCH, FREE_ASSETS (movidos desde `docs/`) |
| `stories/` (8 + 25 epics) | EPICS (lista maestra), MVP_USER_STORIES (índice), BACKLOG, POST_MVP_STORIES, ACCEPTANCE_CRITERIA, DEFINITION_OF_READY, DEFINITION_OF_DONE, _TEMPLATE_HU · `mvp/`: 25 archivos, uno por epic del MVP |
| `decisions/` (10) | README + ADR-001 … ADR-009 |
| `ai/` (5) | AI_CONTEXT, AGENT_INSTRUCTIONS, DEVELOPMENT_RULES, CODING_GUIDELINES, GLOSSARY |
| Raíz del repositorio | `CLAUDE.md` y `AGENTS.md`: punteros a `docs/ai/` |

**Cambios en la estructura propuesta** (mejoras):
- Las HU del MVP van en `stories/mvp/EPIC-XXX-*.md`, un archivo por epic, no en un único archivo gigante. Así un agente carga todo el contexto de un epic de una vez. `MVP_USER_STORIES.md` es su índice.
- Se añaden `POST_MVP_STORIES`, `DEFINITION_OF_READY`, `DEFINITION_OF_DONE` y `_TEMPLATE_HU`.
- Se añaden 4 ADRs a los pedidos: 006 SQLite, 007 coordenadas virtuales, 008 content packs y 009 threads/estado.
- Se añaden los epics EPIC-026 a EPIC-034 (App Shell/Parental, NPCs, Pets, Memories, Crafting, Secrets, Businesses, Cloud, Decoration).

## 2. User Stories created

| Clasificación | Nº | IDs |
|---|---|---|
| **MVP** | **75** | HU-GAME-001 … 075 (detalle completo, 527 escenarios Gherkin aprox.) |
| · P0 | 45 | ver [BACKLOG](stories/BACKLOG.md) |
| · P1 | 27 | |
| · P2 | 3 | 030, 055, 067 |
| **POST-MVP** | 23 | HU-GAME-100 … 122 (formato breve, sin refinar) |
| **FUTURE** | 7 | HU-GAME-200 … 206 |
| **Total** | **105** | |

## 3. Epics created

**34 epics.** EPIC-001 a EPIC-024 y EPIC-026 son MVP (EPIC-021 solo con el pack core). EPIC-025 y EPIC-027 a EPIC-032 y EPIC-034 son POST-MVP. EPIC-033 es FUTURE. Ver [EPICS](stories/EPICS.md).

## 4. ADRs created

9 ADRs, todos **Accepted**. ADR-002 y ADR-009 quedan pendientes de confirmar con los spikes de la Fase 0. Ver [decisions/README](decisions/README.md).

## 5. Mejoras respecto a la propuesta inicial (resumen)

| Propuesta | Decisión | Dónde |
|---|---|---|
| ECS clásico con sistemas por frame | **ECS-lite dirigido por eventos**. Render, Input, Audio y Save pasan a ser adaptadores o servicios; no hay CollisionSystem (se usan superficies por segmentos). | [ADR-003](decisions/ADR-003-ECS.md) |
| `type: "food"` en los objetos | `category` (organización) + **componentes** (capacidades) + `tags` | [OBJECT_SCHEMA §3](data/OBJECT_SCHEMA.md) |
| Relaciones duplicadas (inventario, contenedor, mano) | **`location` única por entidad** + índices derivados | [ECS §4](architecture/ECS.md) |
| Interacciones por objeto | **Reglas de datos** + acciones y condiciones cerradas + resolución determinista | [INTERACTION_SYSTEM](architecture/INTERACTION_SYSTEM.md) |
| Resolución virtual de 1920×1080 | **Altura fija de 1080 y ancho variable** (sin letterbox) | [ADR-007](decisions/ADR-007-VIRTUAL-COORDINATES.md) |
| Guardar todo el mundo | **Diff sobre el contenido**, una fila por entidad, tres versiones | [ADR-006](decisions/ADR-006-SQLITE.md) |
| Habitaciones como escenas | **Casa = una escena con 4 zonas** (continuidad de casa de muñecas) | [SCENE_SCHEMA §5](data/SCENE_SCHEMA.md) |

## 6. Open architectural / product questions

| ID | Pregunta | Impacto | Cuándo decidir |
|---|---|---|---|
| OQ-01 | Mercado y dispositivos objetivo reales (¿tablets de 2 GB?) | Presupuestos de memoria ([PERFORMANCE](architecture/PERFORMANCE.md)) | Antes de cerrar la Fase 0 |
| OQ-02 | Nombre comercial del juego y de la ciudad | Branding, i18n | Antes de la Fase 1 (arte) |
| OQ-03 | Modelo de monetización definitivo (propuesta: freemium por packs) | Fase 7, entitlements | Tras el MVP |
| OQ-04 | ¿Crash reporting compatible con apps infantiles? | ADR-005, cumplimiento | Antes del release del MVP |
| OQ-06 | Inicializar el repositorio **git** y un `.gitignore` que excluya `assets/vendor/glitch/glitch-*` (unos 5 GB) | Flujo de trabajo de agentes (ramas por HU) | **Antes de HU-GAME-001** |
| OQ-07 | Ilustrador y presupuesto para el arte final (kit de avatar, casa, calle, tienda) | Fase 1 bloqueada por el arte | Ya |
| OQ-08 | ¿La calidad del tinte de piel y pelo es aceptable con el estilo final? | Coste de assets ×8 si no lo es | Spike en la Fase 0/1 |
| OQ-09 | ¿Borrar personajes en el MVP? (hoy es HU-GAME-122, POST-MVP) | UX con el tope de 12 | Fase 1 |
| OQ-10 | ¿El React Compiler es compatible con los worklets de Reanimated 4 y Skia? | Config de `app.json` | HU-GAME-001/005 |
| OQ-11 | ¿La latencia del hit test en JS es aceptable en Android de gama baja? Si no, se aplica el plan B de ADR-009 | Input | Spike en la Fase 0 |
| OQ-12 | ¿Un tap sobre un personaje dormido lo despierta? ¿Se permite darle objetos en la mano mientras duerme? | Reglas `tap_character` y `hold_item` | Fase 1 (playtest) |
| OQ-13 | ¿La puerta parental (multiplicación) aguanta a niños de 9–10 años? | Seguridad | Playtest de la Fase 1 |
| OQ-14 | Balance económico: 50 monedas iniciales, 10 al día, 5 por moneda escondida y precios de 2 a 30 | Diversión y progresión | Playtest de la Fase 2 |
| OQ-15 | API concreta de `expo-audio` y de `expo-sqlite` en Expo SDK 57 (verificar en la documentación de esa versión) | Adaptadores | Al implementar HU-052 y HU-056 |
| OQ-16 | Traspaso del gesto desde la bandeja de la mochila (View de RN) al drag del mundo (Skia) | HU-GAME-038 | Spike en la Fase 1 |

> OQ-05 (reposición de la tienda) quedó **resuelta**: `purchasable.restock` + `origin` ([ENTITY_SCHEMA §5.14](data/ENTITY_SCHEMA.md)).

Además, las HU contienen unos **167 valores marcados como "propuesta"**: tiempos, posiciones, capacidades, precios. Son valores por defecto razonables que se confirman al implementar y en los playtests. **No bloquean** el DoR salvo que la HU diga lo contrario.

## 7. Missing information

- **Arte final:** no existe. Solo hay placeholders CC0 en `assets/vendor/` (Kenney y Glitch), con un estilo distinto al objetivo. Falta:
  - la guía de estilo aprobada ([ART_DIRECTION](design/ART_DIRECTION.md) está en *Proposed*);
  - el kit de personaje;
  - los fondos y los ~61 prefabs.
- **Audio:** no hay efectos de sonido ni música seleccionados. Candidatos en [FREE_ASSETS](design/research/FREE_ASSETS.md).
- **Revisión legal:** privacidad infantil (COPPA, RGPD de menores, Kids Category, Families) y licencias de los assets comerciales.
- **Dispositivos físicos de prueba** de referencia (Android de gama baja + iPad o iPhone antiguo).
- **Plan de playtest con niños:** reclutamiento, consentimiento de los padres y protocolo.
- **Fuente tipográfica** confirmada (propuesta: Fredoka o Baloo 2, OFL).

## 8. Recommended next implementation step

1. **Resolver OQ-06:** inicializar git en la raíz, con un `.gitignore` que excluya `node_modules`, `assets/vendor/glitch/glitch-*` y los builds.
2. **Implementar [HU-GAME-001](stories/mvp/EPIC-001-foundation.md)** (configurar el proyecto Expo):
   - landscape, `requireFullScreen` y `userInterfaceStyle: light`;
   - limpieza de la plantilla (tabs y explore);
   - estructura de carpetas de [ARCHITECTURE §3](architecture/ARCHITECTURE.md);
   - dependencias base (Skia, expo-sqlite, zod);
   - lint con restricciones de imports por capa;
   - verificar OQ-10.
3. Seguir con el camino crítico de la Fase 0 ([BACKLOG](stories/BACKLOG.md)): 002 → 003 → 068 → 024 → 010 → 011 → 004 → 005/006/007 → 026 → 027 → 028 → 031 → 032 → 052 → 053 → 054 → 069.
4. **En paralelo al código:** encargar la hoja de estilo de arte (ART_DIRECTION §6) para que no bloquee la Fase 1.

**Prompt sugerido para un agente:**
> "Lee `docs/ai/AI_CONTEXT.md` y `docs/ai/AGENT_INSTRUCTIONS.md`. Implementa HU-GAME-001 según `docs/stories/mvp/EPIC-001-foundation.md`. No implementes nada fuera de esa HU."
