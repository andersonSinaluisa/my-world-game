# MVP User Stories: índice

> **Status:** Draft · **Last Updated:** 2026-09-18
> **Formato:** [_TEMPLATE_HU.md](_TEMPLATE_HU.md) · **Convenciones de criterios:** [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) · **DoR/DoD:** [DEFINITION_OF_READY](DEFINITION_OF_READY.md) / [DEFINITION_OF_DONE](DEFINITION_OF_DONE.md)

Las HU del MVP se agrupan **por epic en un archivo cada una**, dentro de [mvp/](mvp/). Así un agente lee una sola pieza de contexto con todas las HU relacionadas. Los IDs, prioridades y dependencias maestros están en [EPICS.md](EPICS.md).

### EPIC-001 — Game Foundation → [mvp/EPIC-001-foundation.md](mvp/EPIC-001-foundation.md)

- **HU-GAME-001** — Configurar el proyecto Expo para el juego · Must P0 · Fase 0
- **HU-GAME-002** — Configurar pruebas unitarias y harness headless · Must P0 · Fase 0
- **HU-GAME-003** — Núcleo del World: entidades, componentes y eventos · Must P0 · Fase 0
- **HU-GAME-004** — GameFacade: puente UI ↔ motor · Must P0 · Fase 0

### EPIC-002 — Rendering Engine → [mvp/EPIC-002-rendering.md](mvp/EPIC-002-rendering.md)

- **HU-GAME-005** — Canvas Skia con resolución virtual · Must P0 · Fase 0
- **HU-GAME-006** — Renderizar entidades por capas y orden z · Must P0 · Fase 0
- **HU-GAME-007** — Cámara horizontal con paneo · Must P0 · Fase 0
- **HU-GAME-008** — Culling y carga de fondos por chunks · Should P1 · Fase 1
- **HU-GAME-009** — Tweens y animaciones simples · Should P1 · Fase 1

### EPIC-003 — Scene Management → [mvp/EPIC-003-scenes.md](mvp/EPIC-003-scenes.md)

- **HU-GAME-010** — Cargar una escena declarada en JSON · Must P0 · Fase 0
- **HU-GAME-011** — Instanciar entidades desde prefabs con overrides · Must P0 · Fase 0
- **HU-GAME-012** — Zonas (habitaciones) dentro de una escena · Should P1 · Fase 1

### EPIC-004 — Character System → [mvp/EPIC-004-characters.md](mvp/EPIC-004-characters.md)

- **HU-GAME-013** — Renderizar un personaje por capas · Must P0 · Fase 1
- **HU-GAME-014** — Poses del personaje · Must P0 · Fase 1
- **HU-GAME-015** — Expresiones faciales · Should P1 · Fase 1
- **HU-GAME-016** — Sostener objetos en las manos · Must P0 · Fase 1
- **HU-GAME-017** — Arrastrar personajes · Must P0 · Fase 1

### EPIC-005 — Character Creator → [mvp/EPIC-005-creator.md](mvp/EPIC-005-creator.md)

- **HU-GAME-018** — Abrir el creador y elegir cuerpo y tono de piel · Must P0 · Fase 1
- **HU-GAME-019** — Elegir ojos y boca · Must P0 · Fase 1
- **HU-GAME-020** — Elegir peinado y color de pelo · Must P0 · Fase 1
- **HU-GAME-021** — Elegir ropa inicial · Must P0 · Fase 1
- **HU-GAME-022** — Guardar, listar y editar personajes · Must P0 · Fase 1
- **HU-GAME-023** — Colocar personajes creados en el mundo · Must P0 · Fase 1

### EPIC-006 — Object System → [mvp/EPIC-006-objects.md](mvp/EPIC-006-objects.md)

- **HU-GAME-024** — Registro de prefabs de objetos con validación · Must P0 · Fase 0
- **HU-GAME-025** — Estados de objetos y sprites por estado · Must P0 · Fase 0
- **HU-GAME-026** — Hitbox y hit testing · Must P0 · Fase 0

### EPIC-007 — Drag & Drop → [mvp/EPIC-007-drag-drop.md](mvp/EPIC-007-drag-drop.md)

- **HU-GAME-027** — Arrastrar objetos · Must P0 · Fase 0
- **HU-GAME-028** — Soltar objetos sobre superficies y el suelo · Must P0 · Fase 0
- **HU-GAME-029** — Auto-scroll de la cámara al arrastrar cerca del borde · Must P1 · Fase 1
- **HU-GAME-030** — Los objetos apoyados se mueven con su mueble · Could P2 · Fase 1

### EPIC-008 — Interaction System → [mvp/EPIC-008-interaction.md](mvp/EPIC-008-interaction.md)

- **HU-GAME-031** — Resolver interacciones mediante reglas de datos · Must P0 · Fase 0
- **HU-GAME-032** — Interacciones por tap · Must P0 · Fase 0
- **HU-GAME-033** — Resaltar el destino válido durante el arrastre · Should P1 · Fase 1

### EPIC-009 — Containers → [mvp/EPIC-009-containers.md](mvp/EPIC-009-containers.md)

- **HU-GAME-034** — Abrir y cerrar muebles · Must P0 · Fase 1
- **HU-GAME-035** — Guardar objetos en contenedores · Must P0 · Fase 1
- **HU-GAME-036** — Sacar objetos de contenedores · Must P0 · Fase 1

### EPIC-010 — Inventory → [mvp/EPIC-010-inventory.md](mvp/EPIC-010-inventory.md)

- **HU-GAME-037** — Guardar objetos en la mochila · Should P1 · Fase 1
- **HU-GAME-038** — Sacar objetos de la mochila · Should P1 · Fase 1

### EPIC-011 — Clothing → [mvp/EPIC-011-clothing.md](mvp/EPIC-011-clothing.md)

- **HU-GAME-039** — Vestir prendas soltándolas sobre el personaje · Must P0 · Fase 1
- **HU-GAME-040** — Quitar prendas del personaje · Should P1 · Fase 1
- **HU-GAME-041** — Armario con ropa disponible · Should P1 · Fase 1

### EPIC-012 — Food & Drinks → [mvp/EPIC-012-food.md](mvp/EPIC-012-food.md)

- **HU-GAME-042** — Comer alimentos por mordiscos · Must P0 · Fase 1
- **HU-GAME-043** — Beber bebidas · Must P0 · Fase 1
- **HU-GAME-044** — Dispensadores de objetos · Should P1 · Fase 1

### EPIC-013 — Furniture → [mvp/EPIC-013-furniture.md](mvp/EPIC-013-furniture.md)

- **HU-GAME-045** — Sentarse en asientos · Must P0 · Fase 1
- **HU-GAME-046** — Dormir en camas · Must P0 · Fase 1
- **HU-GAME-047** — Objetos encendibles (lámpara, TV, grifo) · Should P1 · Fase 1
- **HU-GAME-048** — Mover muebles · Should P1 · Fase 1

### EPIC-014 — Scene Navigation → [mvp/EPIC-014-navigation.md](mvp/EPIC-014-navigation.md)

- **HU-GAME-049** — Puertas y portales entre escenas · Must P0 · Fase 2
- **HU-GAME-050** — Transición entre escenas · Must P0 · Fase 2
- **HU-GAME-051** — Mapa de ubicaciones · Should P1 · Fase 2

### EPIC-015 — Save System → [mvp/EPIC-015-save.md](mvp/EPIC-015-save.md)

- **HU-GAME-052** — Autoguardado del mundo en SQLite · Must P0 · Fase 0
- **HU-GAME-053** — Restaurar la partida al iniciar · Must P0 · Fase 0
- **HU-GAME-054** — Versionado y migraciones de guardado · Must P0 · Fase 0
- **HU-GAME-055** — Reiniciar el mundo · Could P2 · Fase 1

### EPIC-016 — Audio → [mvp/EPIC-016-audio.md](mvp/EPIC-016-audio.md)

- **HU-GAME-056** — Sonidos de interacción · Should P1 · Fase 1
- **HU-GAME-057** — Música y ambiente por ubicación · Should P1 · Fase 1
- **HU-GAME-058** — Control de volumen y silencio · Must P1 · Fase 1

### EPIC-017 — Home → [mvp/EPIC-017-home.md](mvp/EPIC-017-home.md)

- **HU-GAME-059** — Salón jugable · Must P0 · Fase 1
- **HU-GAME-060** — Cocina jugable · Must P0 · Fase 1
- **HU-GAME-061** — Dormitorio jugable · Must P0 · Fase 1
- **HU-GAME-062** — Baño jugable · Should P1 · Fase 1

### EPIC-018 — Street → [mvp/EPIC-018-street.md](mvp/EPIC-018-street.md)

- **HU-GAME-063** — Calle jugable · Must P1 · Fase 2

### EPIC-019 — Store → [mvp/EPIC-019-store.md](mvp/EPIC-019-store.md)

- **HU-GAME-064** — Tienda jugable · Must P1 · Fase 2

### EPIC-020 — Economy → [mvp/EPIC-020-economy.md](mvp/EPIC-020-economy.md)

- **HU-GAME-065** — Monedero de monedas · Must P1 · Fase 2
- **HU-GAME-066** — Comprar objetos · Must P1 · Fase 2
- **HU-GAME-067** — Regalo diario y monedas escondidas · Could P2 · Fase 2

### EPIC-021 — Content Packs → [mvp/EPIC-021-content.md](mvp/EPIC-021-content.md)

- **HU-GAME-068** — Pack "core" con manifest y namespaces · Must P0 · Fase 0

### EPIC-022 — Accessibility → [mvp/EPIC-022-accessibility.md](mvp/EPIC-022-accessibility.md)

- **HU-GAME-070** — Objetivos táctiles grandes y UI sin texto · Must P1 · Fase 1

### EPIC-023 — Performance → [mvp/EPIC-023-performance.md](mvp/EPIC-023-performance.md)

- **HU-GAME-071** — Overlay de rendimiento y verificación de presupuestos · Must P1 · Fase 1

### EPIC-024 — Testing → [mvp/EPIC-024-testing.md](mvp/EPIC-024-testing.md)

- **HU-GAME-069** — Validador de contenido para la CLI y la CI · Must P0 · Fase 0
- **HU-GAME-072** — Pruebas de regresión de guardado con fixtures · Should P1 · Fase 1

### EPIC-026 — App Shell & Parental → [mvp/EPIC-026-app-shell.md](mvp/EPIC-026-app-shell.md)

- **HU-GAME-073** — Pantalla de inicio · Must P0 · Fase 1
- **HU-GAME-074** — Puerta parental · Must P1 · Fase 1
- **HU-GAME-075** — Pantalla de ajustes · Must P1 · Fase 1

---
**Total: 75 HU del MVP.** POST-MVP y FUTURE: [POST_MVP_STORIES.md](POST_MVP_STORIES.md).
