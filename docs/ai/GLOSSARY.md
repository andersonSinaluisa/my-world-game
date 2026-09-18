# Glossary

> **Last Updated:** 2026-09-18

| Término | Definición | Doc |
|---|---|---|
| **Action** | Operación atómica reutilizable del motor (`eat`, `sit`, `store`…) que ejecutan las reglas. Conjunto cerrado. | [INTERACTION_SCHEMA §5](../data/INTERACTION_SCHEMA.md) |
| **ADR** | Architecture Decision Record | [decisions/](../decisions/README.md) |
| **AssetKey** | Clave lógica de una imagen (`obj_food_apple_red`), resuelta por `assets.json` | [ASSET_GUIDELINES](../design/ASSET_GUIDELINES.md) |
| **Chunk** | Tira de fondo de ≤ 2048 px de ancho (normalmente 1920×1080) | [RENDERING §8](../architecture/RENDERING.md) |
| **Component** | Bloque de datos serializable de una entidad. Sin lógica. | [ECS](../architecture/ECS.md) |
| **Condition** | Predicado puro de una regla (`isOpen`, `seatFree`…). Conjunto cerrado. | [INTERACTION_SCHEMA §4](../data/INTERACTION_SCHEMA.md) |
| **Content Pack** | Paquete de contenido versionado con namespace (`core`, `school`…) | [CONTENT_SYSTEM](../architecture/CONTENT_SYSTEM.md) |
| **Culling** | No renderizar lo que está fuera del viewport + margen | [RENDERING §7](../architecture/RENDERING.md) |
| **Diff (guardado)** | Solo se guarda lo que difiere del contenido definido | [SAVE_SCHEMA](../data/SAVE_SCHEMA.md) |
| **DirtyTracker** | Registro de entidades cambiadas pendientes de guardar | [SAVE_SYSTEM](../architecture/SAVE_SYSTEM.md) |
| **DragProxy** | Representación visual de la entidad arrastrada en el UI thread | [INPUT_SYSTEM](../architecture/INPUT_SYSTEM.md) |
| **Entity** | ID + tags + location + componentes | [ENTITY_SCHEMA](../data/ENTITY_SCHEMA.md) |
| **EntityId** | `pack:scene/localId` (de escena) o `rt_<ulid>` (runtime) | [ENTITY_SCHEMA §2](../data/ENTITY_SCHEMA.md) |
| **Fallback `place`** | Si no hay regla aplicable al soltar, el objeto se apoya en la superficie o el suelo | [INTERACTION_SYSTEM §3](../architecture/INTERACTION_SYSTEM.md) |
| **GameFacade** | Único puente entre la UI y el motor (comandos + selectores) | [GAME_ENGINE §6](../architecture/GAME_ENGINE.md) |
| **Harness headless** | Entorno de test que ejecuta el motor en Node, sin RN | [CODING_GUIDELINES §5](CODING_GUIDELINES.md) |
| **Hit zone** | Zona nombrada dentro de un hitbox (`mouth`, `handL`, `inside`…) | [ENTITY_SCHEMA §5.3](../data/ENTITY_SCHEMA.md) |
| **Location (entidad)** | Dónde está una entidad: `scene`, `container`, `inventory`, `held`, `worn` o `limbo` | [ECS §4](../architecture/ECS.md) |
| **MapLocation** | Ubicación del mapa (Casa, Calle, Tienda). No es lo mismo que la Location de una entidad. | [SCENE_SYSTEM](../architecture/SCENE_SYSTEM.md) |
| **Mochila** | Inventario global de 12 slots | [INVENTORY_SYSTEM](../architecture/INVENTORY_SYSTEM.md) |
| **Placeholder** | Asset provisional (CC0) marcado `placeholder: true`. Prohibido en release. | [ASSET_GUIDELINES](../design/ASSET_GUIDELINES.md) |
| **Portal** | Entidad que lleva a otra escena y a un spawn | [SCENE_SYSTEM](../architecture/SCENE_SYSTEM.md) |
| **Pose** | Estado visual del personaje (`idle`, `dangle`, `sit`, `sleep`, `eat`, `drink`) | [CHARACTER_SYSTEM §5](../architecture/CHARACTER_SYSTEM.md) |
| **Prefab** | Plantilla de entidad en un pack (`core:apple_red`) | [OBJECT_SCHEMA](../data/OBJECT_SCHEMA.md) |
| **Puerta parental** | Desafío para adultos que protege los ajustes, el reinicio y lo externo | [UI_UX_GUIDELINES §4](../design/UI_UX_GUIDELINES.md) |
| **Rule (Interaction Rule)** | Dato: trigger + source + target + condiciones → acciones | [INTERACTION_SCHEMA](../data/INTERACTION_SCHEMA.md) |
| **saveVersion** | Versión del formato de datos del guardado | [SAVE_SCHEMA §5](../data/SAVE_SCHEMA.md) |
| **Scene** | Espacio jugable declarado en JSON, de 1080 de alto | [SCENE_SCHEMA](../data/SCENE_SCHEMA.md) |
| **Service** | Módulo de borde con I/O (Content, Scene, Save, Audio, Location) | [ECS §5](../architecture/ECS.md) |
| **Spawn point** | Punto de aparición en una escena | [SCENE_SCHEMA](../data/SCENE_SCHEMA.md) |
| **Surface** | Segmentos horizontales donde se apoyan los objetos | [ENTITY_SCHEMA §5.5](../data/ENTITY_SCHEMA.md) |
| **System** | Lógica de juego pura que reacciona a comandos y eventos | [ECS §5](../architecture/ECS.md) |
| **World** | Contenedor en memoria de las entidades activas + índices derivados | [GAME_ENGINE §3](../architecture/GAME_ENGINE.md) |
| **World units** | Coordenadas virtuales: altura de escena = 1080 | [ADR-007](../decisions/ADR-007-VIRTUAL-COORDINATES.md) |
| **Zone** | Rango horizontal con nombre dentro de una escena (una habitación) | [SCENE_SCHEMA](../data/SCENE_SCHEMA.md) |
