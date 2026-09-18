# Development Rules

> **Status:** Accepted · **Last Updated:** 2026-09-18
> **Related:** [AGENT_INSTRUCTIONS](AGENT_INSTRUCTIONS.md) · [CODING_GUIDELINES](CODING_GUIDELINES.md) · [../stories/DEFINITION_OF_DONE.md](../stories/DEFINITION_OF_DONE.md)

## 1. Regla fundamental: no sobre-arquitecturar

- Construimos un **MVP**. La arquitectura **permite** crecer, pero **no se implementa infraestructura que todavía no se usa**.
- Cada pieza lleva una de estas etiquetas:
  - **[NEEDED NOW]:** se implementa en la HU que la necesita.
  - **[DESIGNED FOR LATER]:** el schema o la interfaz lo prevén (un campo opcional, un punto de extensión), pero **no se implementa**.
  - **[NOT NEEDED YET]:** no se diseña ni se implementa. Hacerlo requiere replanificar.
- Ante la duda, la solución más simple que cumpla la HU y no rompa los invariantes.

## 2. Invariantes (ver [ARCHITECTURE §6](../architecture/ARCHITECTURE.md))

Un cambio que rompa alguno requiere un ADR nuevo **antes** de programar:
1. El core no depende de React, RN, Skia ni Expo.
2. Sin lógica por objeto ni por escena.
3. Una única `location` por entidad; cambios de location solo vía `LocationService`.
4. IDs con namespace y estables.
5. World units con altura de 1080.
6. Guardado como diff y versionado.
7. UI ↔ motor solo mediante el GameFacade.
8. Alta frecuencia en el UI thread y estado lógico en el JS thread.
9. El contenido es un pack.

## 3. Dependencias

| Tipo | Regla |
|---|---|
| Ya decididas en [ADR-001](../decisions/ADR-001-TECH-STACK.md) | Se pueden instalar en la HU que las necesita (Skia, expo-sqlite, expo-audio, zod, jest-expo) |
| Cualquier otra | Requiere en la HU: motivo, alternativas consideradas (incluida "hacerlo a mano"), tamaño y mantenimiento. Si afecta a la arquitectura, un ADR. |
| Que hacen red (analytics, crash, ads) | **Prohibidas en el MVP** sin un ADR ([ADR-005](../decisions/ADR-005-OFFLINE-FIRST.md)) |
| Librerías ECS o de estado global | **Prohibidas** sin un ADR que reemplace [ADR-003](../decisions/ADR-003-ECS.md) o [ADR-009](../decisions/ADR-009-STATE-AND-THREADING.md) |
| Versiones | Instalar con `npx expo install` para respetar la compatibilidad del SDK |

## 4. Cambios de schema y datos

| Cambio | Requisitos |
|---|---|
| Campo opcional nuevo con default | Actualizar el doc de `data/`, el schema zod y los tests |
| Renombrar o eliminar un campo o componente persistible | `saveVersion`++, una migración pura, un fixture de test (HU-GAME-072) y actualizar SAVE_SCHEMA |
| Renombrar o eliminar un ID de contenido publicado | `idAliases`/`removedIds` en el manifest y bump **major** del pack |
| Acción o condición nueva | Handler + schema + fila en INTERACTION_SCHEMA + tests |
| Componente nuevo | Schema zod + fila en ECS.md + sección en ENTITY_SCHEMA + revisar su persistencia |

## 5. Calidad

- TypeScript `strict`. Sin `any` salvo justificado con un comentario.
- **Tests obligatorios** para systems, acciones, condiciones, resolver, serialización y migraciones.
- **El motor es determinista:** reloj, aleatoriedad y logger se inyectan.
- **Sin `console.log`** en el código que se entrega. Usar el `logger` inyectado.
- Errores: el motor no lanza hacia la UI (`CommandResult`). En dev los invariantes lanzan; en producción se reparan y se registran.

## 6. Contenido y assets

- Todo prefab, escena o regla se valida con `npm run content:validate` antes del commit.
- Los placeholders se permiten solo con `placeholder: true` y nunca en release.
- Cada asset incluye `license` y `source` en `assets.json`.

## 7. Privacidad infantil (MVP)

- Sin red, sin identificadores de dispositivo, sin datos personales y sin enlaces externos.
- Todo lo sensible pasa por la **puerta parental**.

## 8. Git (cuando exista el repositorio, ver OQ-06)

- Una rama por HU: `feature/HU-GAME-0XX-short-name`.
- Commits pequeños que mencionen la HU (`HU-GAME-027: drag proxy on UI thread`).
- **Sin commits de `assets/vendor/glitch/glitch-*`** (unos 5 GB de fuentes Flash). Van en `.gitignore`.
